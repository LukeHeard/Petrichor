from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import httpx
import re
from .db import get_db, DatabaseManager
from .schemas import work as schemas
import logging
import time

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# CJK detection helper
def contains_cjk(text: str) -> bool:
    # Matches Japanese (Hiragana, Katakana, Kanji)
    return bool(re.search(r'[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]', text))

app = FastAPI(title="Petrichor API")

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Tag cleaning helper (Extensive Whitelist approach)
def get_clean_tags(subjects: list[str], title: str = "") -> list[str]:
    if not subjects:
        return []
    
    # Title words for redundancy filtering
    title_words = set(re.findall(r'\w+', title.lower())) if title else set()
    
    # 1. Broad Categories & Tribes (Keywords that signal a valid Genre/Trope)
    valid_categories = {
        # Core Genres
        "Fiction", "Nonfiction", "Fantasy", "Science Fiction", "Sci Fi", "Horror", "Mystery", "Thriller", 
        "Suspense", "Romance", "Historical", "Adventure", "Western", "Musical", "Documentary",
        # Subgenres/Tropes
        "Dystopia", "Utopia", "Apocalypt", "Space Opera", "Cyberpunk", "Steampunk", "Solarpunk", "Hopepunk",
        "Grimdark", "High Fantasy", "Urban Fantasy", "Magical Realism", "Gothic", "Noir", "Hardboiled",
        "Coming Of Age", "Young Adult", "New Adult", "Paranormal", "Supernatural", "Psychological",
        "Philosophical", "Experimental", "Satire", "Allegory", "Mythology", "Folklore", "Fairy Tale",
        "Military", "Police", "Legal", "Medical", "Politics", "Diplomacy", "War", "Espionage", "Crime",
        "Detective", "Heist", "Time Travel", "Multiverse", "Artificial Intelligence", "Robot", "Alien",
        "First Contact", "Space Travel", "Interplanetary", "Dimension", "Alternate History", "Survival",
        "Self Discovery", "Identity", "Loneliness", "Grief", "Loss", "Hope", "Revenge", "Betrayal",
        "Redemption", "Quest", "Journey", "Hero", "Villain", "Antihero", "Chosen One", "Secret Identity",
        "Class Struggle", "Social Classes", "Caste System", "Revolution", "Resistance", "Conflict", "Society",
        "Existential", "Cosmic", "Love", "Obsession", "Family", "Friendship", "Tragedy", "Comedy", "Dark",
        "Cozy", "Atmospheric", "Noir", "Surreal", "Absurdist", "Classic", "Modernist", "Postmodern", "Ecology",
        # Media types
        "Manga", "Graphic Novel", "Comics", "Manhua", "Manhwa", "Slice Of Life"
    }

    # 2. Strict Blacklist for Places/Entities
    blacklist = {"Deutsch", "German", "English", "Englisch", "Amerikanisch", "New York", "London", "America", "Nyt", "Bestseller", "Award", "Series", "Franchise", "Form"}

    # 3. Words to strip from tags (e.g. "Adventure Stories" -> "Adventure")
    strip_words = {"Stories", "Literature", "Review", "Novels", "Work", "Books", "Edition"}
    
    cleaned = set()
    for s in subjects:
        # Clean: Strip parentheses and punctuation
        s_base = re.sub(r'\(.*?\)', '', s).strip()
        norm = s_base.replace("-", " ").title().replace(",", "").strip()
        
        # Avoid redundancy with title
        norm_low = norm.lower()
        if title:
            if norm_low == title.lower(): continue
            tag_words = set(re.findall(r'\w+', norm_low))
            if tag_words and tag_words.issubset(title_words): continue

        # Filter: Must match a valid category word
        # We check if any of our valid_categories is a substring or word in the tag
        matched_cat = None
        # Sort categories by length descending to catch most specific first (e.g. Science Fiction before Fiction)
        for cat in sorted(list(valid_categories), key=len, reverse=True):
            if cat.lower() in norm_low:
                matched_cat = cat
                break
        
        if not matched_cat:
            continue
            
        # 5. Blacklist check
        if any(b.lower() in norm_low for b in blacklist):
            continue

        # 6. Canonical Mapping: Use the official name from our category list
        # This groups "Dystopian", "Dystopias", etc under "Dystopia"
        norm = matched_cat
        
        if not norm: continue
            
        # Final normalization
        if "Sci Fi" in norm: norm = "Science Fiction"
        
        cleaned.add(norm)
    
    # Priority sorting (Genres first)
    priority_genres = {"Fiction", "Fantasy", "Science Fiction", "Dystopia", "Young Adult", "Adventure", "Thriller", "Mystery", "Horror", "Romance"}
    sorted_tags = sorted(list(cleaned), key=lambda x: (x not in priority_genres, x))
    return [t for t in sorted_tags if t][:8]

@app.get("/")
def read_root():
    return {"message": "Petrichor Personal Library API"}

@app.post("/works", response_model=schemas.Work)
async def create_work(work: schemas.WorkCreate, db: DatabaseManager = Depends(get_db)):
    conn = db.get_connection()
    
    # 1. Enrich with description and tags if missing
    description = work.description or ""
    if not description and (work.openlibrary_id or work.isbn or work.google_books_id):
        try:
            identifier = work.isbn or work.openlibrary_id or work.google_books_id
            enriched = await enrich_work(identifier)
            description = enriched.get("description", "")
            # Also update tags if empty
            if not work.tags:
                work.tags = enriched.get("tags", [])
            # Update IDs if found
            if not work.openlibrary_id: work.openlibrary_id = enriched.get("openlibrary_id")
            if not work.isbn: work.isbn = enriched.get("isbn")
        except Exception as e:
            logger.warning(f"Enrichment failed in create_work for {work.title}: {e}")

    try:
        # 1. Create Work node
        query = "CREATE (w:Work {title: $title, openlibrary_id: $openlib, google_books_id: $gbooks, isbn: $isbn, first_publish_year: $year, description: $description_text, page_count: $pages, rating_average: $rating_avg, rating_count: $rating_cnt, personal_rating: $pers_rating, status: $status, review: $review, personal_notes: $notes, created_at: $created}) RETURN w.id"
        result = conn.execute(
            query,
            parameters={
                "title": work.title, 
                "openlib": work.openlibrary_id or "", 
                "gbooks": work.google_books_id or "",
                "isbn": work.isbn or "",
                "year": work.first_publish_year or 0,
                "description_text": description,
                "pages": work.page_count or 0,
                "rating_avg": work.rating_average or 0.0,
                "rating_cnt": work.rating_count or 0,
                "pers_rating": work.personal_rating or 0.0,
                "status": work.status or "Owned",
                "review": work.review or "",
                "notes": work.personal_notes or "",
                "created": int(time.time())
            }
        )
        if not result.has_next():
             raise HTTPException(status_code=500, detail="Failed to create work")
        work_id = result.get_next()[0]

        # 2. Handle Tags
        tags_to_save = work.tags or []
        for tag_name in tags_to_save:
            # Match or create Tag
            tag_res = conn.execute("MATCH (t:Tag) WHERE t.name = $name RETURN t.id", {"name": tag_name})
            if tag_res.has_next():
                tag_id = tag_res.get_next()[0]
            else:
                tag_create = conn.execute("CREATE (t:Tag {name: $name}) RETURN t.id", {"name": tag_name})
                tag_id = tag_create.get_next()[0]
            
            # Link Work to Tag
            conn.execute("MATCH (w:Work), (t:Tag) WHERE w.id = $wid AND t.id = $tid CREATE (w)-[:HAS_TAG]->(t)", {"wid": work_id, "tid": tag_id})

        return await get_work(work_id, db)
    except Exception as e:
        logger.error(f"Error creating work: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/works", response_model=list[schemas.Work])
def list_works(db: DatabaseManager = Depends(get_db)):
    conn = db.get_connection()
    try:
        # 1. Match Work and optionally join with Author via WROTE relationship.
        result = conn.execute("MATCH (w:Work) OPTIONAL MATCH (a:Author)-[:WROTE]->(w) RETURN w.id, w.title, w.openlibrary_id, a.name, w.first_publish_year, w.description, w.page_count, w.rating_average, w.rating_count, w.personal_rating, w.status, w.review, w.personal_notes, w.created_at, w.google_books_id, w.isbn")
        works = []
        while result.has_next():
            row = result.get_next()
            works.append({
                "id": row[0], 
                "title": row[1], 
                "openlibrary_id": row[2], 
                "author": row[3],
                "first_publish_year": row[4],
                "description": row[5],
                "page_count": row[6],
                "rating_average": row[7],
                "rating_count": row[8],
                "personal_rating": row[9],
                "status": row[10],
                "review": row[11],
                "personal_notes": row[12],
                "created_at": row[13],
                "google_books_id": row[14],
                "isbn": row[15],
                "tags": []
            })

        # 2. Fetch ALL work-tag relationships and map them
        # Note: We fetch all because Kuzu's Python driver currently has issues with list parameters in the IN clause
        tag_result = conn.execute("MATCH (w:Work)-[:HAS_TAG]->(t:Tag) RETURN w.id, t.name")
        tag_map = {}
        while tag_result.has_next():
            t_row = tag_result.get_next()
            wid, tname = t_row[0], t_row[1]
            if wid not in tag_map:
                tag_map[wid] = []
            tag_map[wid].append(tname)
        
        for work in works:
            work["tags"] = tag_map.get(work["id"], [])

        return works
    except Exception as e:
        logger.error(f"Error listing works: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/works/{work_id}", response_model=schemas.Work)
async def get_work(work_id: int, db: DatabaseManager = Depends(get_db)):
    conn = db.get_connection()
    try:
        result = conn.execute("MATCH (w:Work) WHERE w.id = $id RETURN w.id, w.title, w.openlibrary_id, w.first_publish_year, w.description, w.page_count, w.rating_average, w.rating_count, w.personal_rating, w.status, w.review, w.personal_notes, w.created_at, w.google_books_id, w.isbn", {"id": work_id})
        if not result.has_next():
            raise HTTPException(status_code=404, detail="Work not found")
        row = result.get_next()
        
        # Self-healing: If description is missing, try to fetch it now and save it
        stored_desc = row[4]
        olid = row[2]
        gbooks_id = row[13]
        isbn = row[14]

        if not stored_desc and (olid or isbn or gbooks_id):
            logger.info(f"Self-healing: Fetching missing description for {row[1]}")
            try:
                # Use whatever identifier we have
                enriched = await enrich_work(isbn or olid or gbooks_id)
                new_desc = enriched.get("description", "")
                if new_desc:
                    conn.execute("MATCH (w:Work) WHERE w.id = $id SET w.description = $desc", {"id": work_id, "desc": new_desc})
                    stored_desc = new_desc
            except Exception as e:
                logger.warning(f"Self-healing failed for {work_id}: {e}")
  
        # Fetch tags
        tag_result = conn.execute("MATCH (w:Work)-[:HAS_TAG]->(t:Tag) WHERE w.id = $id RETURN t.name", {"id": work_id})
        tags = []
        while tag_result.has_next():
            tags.append(tag_result.get_next()[0])
  
        return {
            "id": row[0], 
            "title": row[1], 
            "openlibrary_id": olid, 
            "google_books_id": gbooks_id,
            "isbn": isbn,
            "first_publish_year": row[3],
            "description": stored_desc,
            "page_count": row[5],
            "rating_average": row[6],
            "rating_count": row[7],
            "personal_rating": row[8],
            "status": row[9],
            "review": row[10],
            "personal_notes": row[11],
            "created_at": row[12],
            "tags": tags
        }
    except Exception as e:
        logger.error(f"Error getting work: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/authors", response_model=schemas.Author)
def create_author(author: schemas.AuthorCreate, db: DatabaseManager = Depends(get_db)):
    conn = db.get_connection()
    try:
        result = conn.execute(f"CREATE (a:Author {{name: '{author.name}'}}) RETURN a.id, a.name")
        if result.has_next():
            row = result.get_next()
            return {"id": row[0], "name": row[1]}
        raise HTTPException(status_code=500, detail="Failed to create author")
    except Exception as e:
        logger.error(f"Error creating author: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/authors", response_model=list[schemas.Author])
def list_authors(db: DatabaseManager = Depends(get_db)):
    conn = db.get_connection()
    try:
        result = conn.execute("MATCH (a:Author) RETURN a.id, a.name")
        authors = []
        while result.has_next():
            row = result.get_next()
            authors.append({"id": row[0], "name": row[1]})
        return authors
    except Exception as e:
        logger.error(f"Error listing authors: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/tags", response_model=list[str])
def list_tags(db: DatabaseManager = Depends(get_db)):
    conn = db.get_connection()
    try:
        result = conn.execute("MATCH (t:Tag) RETURN t.name")
        tags = []
        while result.has_next():
            tags.append(result.get_next()[0])
        return sorted(list(set(tags))) # Return unique sorted tags
    except Exception as e:
        logger.error(f"Error listing tags: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/works/{work_id}/authors/{author_id}")
def link_author_to_work(work_id: int, author_id: int, db: DatabaseManager = Depends(get_db)):
    conn = db.get_connection()
    try:
        conn.execute(f"MATCH (w:Work), (a:Author) WHERE w.id = {work_id} AND a.id = {author_id} CREATE (a)-[:WROTE]->(w)")
        return {"message": "Success"}
    except Exception as e:
        logger.error(f"Error linking author to work: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/enrich/{identifier:path}")
async def enrich_work(identifier: str):
    """Fetch deep metadata (description, tags) from both Google Books and OpenLibrary."""
    headers = {"User-Agent": "PetrichorLibraryApp/1.0 (test@example.com)"}
    
    # Identify what we have
    isbn = identifier if len(identifier) in [10, 13] and identifier.isdigit() else None
    olid = identifier if identifier.startswith("OL") else None
    gbooks_id = identifier if not olid and not isbn else identifier
    
    description = ""
    tags = []
    olid_found = olid
    isbn_found = isbn

    async with httpx.AsyncClient(headers=headers, follow_redirects=True, timeout=15.0) as client:
        # 1. Try Google Books for clean English description and ISBN
        try:
            gb_url = ""
            if isbn: gb_url = f"https://www.googleapis.com/books/v1/volumes?q=isbn:{isbn}"
            elif gbooks_id: gb_url = f"https://www.googleapis.com/books/v1/volumes/{gbooks_id}"
            
            if gb_url:
                res = await client.get(gb_url)
                if res.is_success:
                    data = res.json()
                    item = data if "volumeInfo" in data else (data.get("items", [{}])[0])
                    info = item.get("volumeInfo", {})
                    if info:
                        description = info.get("description", "")
                        # Try to extract ISBN if we don't have it
                        if not isbn_found:
                            ids = info.get("industryIdentifiers", [])
                            for id_obj in ids:
                                if id_obj["type"] == "ISBN_13": isbn_found = id_obj["identifier"]
        except Exception as e:
            logger.warning(f"Google Books enrichment failed for {identifier}: {e}")

        # 2. Try OpenLibrary for ISBN/OLID mapping and tags
        try:
            # If we only have an ISBN, find the OLID first
            if isbn_found and not olid_found:
                ol_lookup = await client.get(f"https://openlibrary.org/api/volumes/brief/isbn/{isbn_found}.json")
                if ol_lookup.is_success:
                    ol_data = ol_lookup.json()
                    # OL returns a complex structure, try to find records
                    records = ol_data.get("records", {})
                    if records:
                        first_record = list(records.values())[0]
                        olid_found = first_record.get("work_key", "").replace("/works/", "")

            # Now fetch the Work details for tags
            if olid_found:
                res = await client.get(f"https://openlibrary.org/works/{olid_found}.json")
                if res.is_success:
                    data = res.json()
                    if not description:
                        # Fallback description from OL
                        desc_data = data.get("description", "")
                        description = desc_data.get("value", desc_data) if isinstance(desc_data, dict) else desc_data
                    
                    subjects = data.get("subjects", [])
                    tags = get_clean_tags(subjects, data.get("title", ""))
        except Exception as e:
            logger.warning(f"OpenLibrary enrichment failed for {identifier}: {e}")

    return {
        "openlibrary_id": olid_found,
        "google_books_id": gbooks_id,
        "isbn": isbn_found,
        "description": description,
        "tags": tags
    }

@app.delete("/works/{work_id}")
def delete_work(work_id: int, db: DatabaseManager = Depends(get_db)):
    conn = db.get_connection()
    try:
        conn.execute(f"MATCH (w:Work) WHERE w.id = {work_id} DETACH DELETE w")
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Error deleting work: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.patch("/works/{work_id}", response_model=schemas.Work)
async def update_work(work_id: int, work_update: schemas.WorkUpdate, db: DatabaseManager = Depends(get_db)):
    conn = db.get_connection()
    try:
        # Check if work exists
        check = conn.execute("MATCH (w:Work) WHERE w.id = $id RETURN w.id", {"id": work_id})
        if not check.has_next():
            raise HTTPException(status_code=404, detail="Work not found")
        
        # Build SET clause
        sets = []
        params = {"id": work_id}
        
        if work_update.title is not None:
            sets.append("w.title = $new_title")
            params["new_title"] = work_update.title
        if work_update.first_publish_year is not None:
            sets.append("w.first_publish_year = $publish_year")
            params["publish_year"] = work_update.first_publish_year
        if work_update.description is not None:
            sets.append("w.description = $description_text")
            params["description_text"] = work_update.description
        if work_update.personal_rating is not None:
            sets.append("w.personal_rating = $pers_rating")
            params["pers_rating"] = work_update.personal_rating
        if work_update.status is not None:
            sets.append("w.status = $status")
            params["status"] = work_update.status
        if work_update.review is not None:
            sets.append("w.review = $review")
            params["review"] = work_update.review
        if work_update.personal_notes is not None:
            sets.append("w.personal_notes = $notes")
            params["notes"] = work_update.personal_notes
        
        if sets:
            query = f"MATCH (w:Work) WHERE w.id = $id SET {', '.join(sets)}"
            conn.execute(query, params)
            
        # Handle Tags if provided
        if work_update.tags is not None:
            # 1. Get current tags
            current_tags_res = conn.execute("MATCH (w:Work)-[:HAS_TAG]->(t:Tag) WHERE w.id = $id RETURN t.name", {"id": work_id})
            current_tags = []
            while current_tags_res.has_next():
                current_tags.append(current_tags_res.get_next()[0])
            
            new_tags = set(work_update.tags)
            old_tags = set(current_tags)
            
            # Tags to add
            to_add = new_tags - old_tags
            for tag_name in to_add:
                # Match or create Tag node
                tag_check = conn.execute("MATCH (t:Tag) WHERE t.name = $name RETURN t.id", {"name": tag_name})
                if tag_check.has_next():
                    tag_id = tag_check.get_next()[0]
                else:
                    tag_create = conn.execute("CREATE (t:Tag {name: $name}) RETURN t.id", {"name": tag_name})
                    tag_id = tag_create.get_next()[0]
                
                # Create relationship
                conn.execute("MATCH (w:Work), (t:Tag) WHERE w.id = $wid AND t.id = $tid CREATE (w)-[:HAS_TAG]->(t)", {"wid": work_id, "tid": tag_id})
            
            # Tags to remove
            to_remove = old_tags - new_tags
            for tag_name in to_remove:
                conn.execute("MATCH (w:Work)-[r:HAS_TAG]->(t:Tag) WHERE w.id = $wid AND t.name = $tname DELETE r", {"wid": work_id, "tname": tag_name})
        
        return await get_work(work_id, db)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating work: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/search")
async def search_works(q: str = Query(..., min_length=1)):
    """Search Google Books for high-quality English metadata."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            # We prefer English results
            response = await client.get(
                "https://www.googleapis.com/books/v1/volumes",
                params={"q": q, "maxResults": "10", "langRestrict": "en"}
            )
            response.raise_for_status()
            data = response.json()
            results = []
            
            for item in data.get("items", []):
                info = item.get("volumeInfo", {})
                authors = info.get("authors", [])
                primary_author = authors[0] if authors else "Unknown Author"
                
                # Extract ISBN_13 if possible
                isbn = ""
                ids = info.get("industryIdentifiers", [])
                for id_obj in ids:
                    if id_obj["type"] == "ISBN_13":
                        isbn = id_obj["identifier"]
                        break
                if not isbn and ids:
                    isbn = ids[0]["identifier"]

                # We don't have deep tags yet, but we can use categories as a start
                categories = info.get("categories", [])
                tags = get_clean_tags(categories, info.get("title", ""))

                results.append({
                    "title": info.get("title", "Unknown Title"),
                    "author": primary_author,
                    "first_publish_year": int(info.get("publishedDate", "0")[:4]) if info.get("publishedDate") else None,
                    "google_books_id": item.get("id"),
                    "isbn": isbn,
                    "openlibrary_id": None, # Will be resolved during preview/enrich
                    "page_count": info.get("pageCount"),
                    "rating_average": info.get("averageRating"),
                    "rating_count": info.get("ratingsCount"),
                    "tags": tags,
                    "is_cjk": contains_cjk(info.get("title", ""))
                })
            
            # Sort to put English (Non-CJK) titles first
            results.sort(key=lambda x: x["is_cjk"])
            return results
        except Exception as e:
            logger.exception(f"Unexpected error fetching from Google Books: {e}")
            raise HTTPException(status_code=502, detail=f"External API error: {str(e)}")

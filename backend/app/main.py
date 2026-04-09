from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import httpx
import re
from .db import get_db, DatabaseManager
from .schemas import work as schemas
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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
        "Cozy", "Atmospheric", "Noir", "Surreal", "Absurdist", "Classic", "Modernist", "Postmodern", "Ecology"
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
    
    # 1. Enrich with description if missing and OLID exists
    description = work.description or ""
    if not description and work.openlibrary_id:
        try:
            async with httpx.AsyncClient(follow_redirects=True, timeout=10.0) as client:
                # OLID can be /works/OL... or just OL...
                olid = work.openlibrary_id.replace("/works/", "")
                res = await client.get(f"https://openlibrary.org/works/{olid}.json")
                if res.is_success:
                    data = res.json()
                    desc_data = data.get("description", "")
                    if isinstance(desc_data, dict):
                        description = desc_data.get("value", "")
                    else:
                        description = desc_data
        except Exception as e:
            logger.warning(f"Failed to fetch description for {work.openlibrary_id}: {e}")

    try:
        # 1. Create Work node
        query = "CREATE (w:Work {title: $title, openlibrary_id: $openlib, first_publish_year: $year, description: $description_text, page_count: $pages, rating_average: $rating_avg, rating_count: $rating_cnt, personal_rating: $pers_rating, status: $status}) RETURN w.id"
        result = conn.execute(
            query,
            parameters={
                "title": work.title, 
                "openlib": work.openlibrary_id or "", 
                "year": work.first_publish_year or 0,
                "description_text": description,
                "pages": work.page_count or 0,
                "rating_avg": work.rating_average or 0.0,
                "rating_cnt": work.rating_count or 0,
                "pers_rating": work.personal_rating or 0.0,
                "status": work.status or "Owned"
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
        result = conn.execute("MATCH (w:Work) OPTIONAL MATCH (a:Author)-[:WROTE]->(w) RETURN w.id, w.title, w.openlibrary_id, a.name, w.first_publish_year, w.description, w.page_count, w.rating_average, w.rating_count, w.personal_rating, w.status")
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
        result = conn.execute("MATCH (w:Work) WHERE w.id = $id RETURN w.id, w.title, w.openlibrary_id, w.first_publish_year, w.description, w.page_count, w.rating_average, w.rating_count, w.personal_rating, w.status", {"id": work_id})
        if not result.has_next():
            raise HTTPException(status_code=404, detail="Work not found")
        row = result.get_next()
        
        # Self-healing: If description is missing, try to fetch it now and save it
        stored_desc = row[4]
        olid = row[2]
        if not stored_desc and olid:
            logger.info(f"Self-healing: Fetching missing description for {row[1]}")
            try:
                enriched = await enrich_work(olid)
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
            "first_publish_year": row[3],
            "description": stored_desc,
            "page_count": row[5],
            "rating_average": row[6],
            "rating_count": row[7],
            "personal_rating": row[8],
            "status": row[9],
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

@app.get("/enrich/{olid:path}")
async def enrich_work(olid: str):
    """Fetch deep metadata (description, etc.) for a specific OLID without saving it."""
    headers = {"User-Agent": "PetrichorLibraryApp/1.0 (test@example.com)"}
    async with httpx.AsyncClient(headers=headers, follow_redirects=True, timeout=10.0) as client:
        try:
            # Clean OLID
            clean_olid = olid.replace("/works/", "")
            res = await client.get(f"https://openlibrary.org/works/{clean_olid}.json")
            if not res.is_success:
                raise HTTPException(status_code=404, detail="Work not found in OpenLibrary")
            
            
            data = res.json()
            description = ""
            desc_data = data.get("description", "")
            if isinstance(desc_data, dict):
                description = desc_data.get("value", "")
            else:
                description = desc_data
            
            # Extract tags from subjects
            subjects = data.get("subjects", [])
            tags = get_clean_tags(subjects, data.get("title", ""))
                
            return {
                "openlibrary_id": olid,
                "description": description,
                "tags": tags
            }
        except Exception as e:
            logger.error(f"Enrichment error for {olid}: {e}")
            raise HTTPException(status_code=502, detail="Failed to fetch details from OpenLibrary")

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
            sets.append("w.title = $title")
            params["title"] = work_update.title
        if work_update.first_publish_year is not None:
            sets.append("w.first_publish_year = $year")
            params["year"] = work_update.first_publish_year
        if work_update.description is not None:
            sets.append("w.description = $desc")
            params["desc"] = work_update.description
        if work_update.personal_rating is not None:
            sets.append("w.personal_rating = $pers_rating")
            params["pers_rating"] = work_update.personal_rating
        if work_update.status is not None:
            sets.append("w.status = $status")
            params["status"] = work_update.status
        
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
    # Standardize our request to OpenLibrary per their API guidelines
    headers = {"User-Agent": "PetrichorLibraryApp/1.0 (test@example.com)"}
    
    async with httpx.AsyncClient(headers=headers, follow_redirects=True, timeout=30.0) as client:
        try:
            response = await client.get(
                "https://openlibrary.org/search.json",
                params={"q": q, "limit": "10", "fields": "key,title,author_name,first_publish_year,number_of_pages_median,ratings_average,ratings_count,subject"}
            )
            response.raise_for_status()
            data = response.json()
            results = []
            for doc in data.get("docs", []):
                authors = doc.get("author_name", [])
                primary_author = authors[0] if authors else ""
                results.append({
                    "title": doc.get("title", "Unknown Title"),
                    "author": primary_author,
                    "first_publish_year": doc.get("first_publish_year"),
                    "openlibrary_id": doc.get("key"),
                    "page_count": doc.get("number_of_pages_median"),
                    "rating_average": doc.get("ratings_average"),
                    "rating_count": doc.get("ratings_count"),
                    "tags": get_clean_tags(doc.get("subject", []), doc.get("title", ""))
                })
            return results
        except httpx.HTTPStatusError as exc:
            logger.error(f"HTTPStatusError from OpenLibrary: {exc.response.status_code} - {exc.response.text}")
            raise HTTPException(status_code=502, detail=f"OpenLibrary API returned error: {exc.response.status_code}")
        except Exception as e:
            logger.exception(f"Unexpected error fetching from OpenLibrary: {e}")
            raise HTTPException(status_code=502, detail=f"External API error: {str(e)}")

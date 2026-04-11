from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import httpx
import re
import os
from .db import get_db, DatabaseManager
from .schemas import work as schemas
import logging
import time

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Constants
GOOGLE_BOOKS_API_KEY = os.getenv("GOOGLE_BOOKSS_API_KEY")
GOOGLE_BOOKS_BASE_URL = "https://www.googleapis.com/books/v1/volumes"

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

def parse_gb_year(published_date: str) -> int:
    if not published_date:
        return 0
    match = re.search(r'\d{4}', published_date)
    return int(match.group(0)) if match else 0

async def get_best_match(title: str, author: str):
    """Search for other editions to find better ratings or descriptions."""
    params = {
        "q": f'intitle:"{title}" inauthor:"{author}"',
        "maxResults": 10,
        "printType": "books",
    }
    if GOOGLE_BOOKS_API_KEY:
        params["key"] = GOOGLE_BOOKS_API_KEY
        
    async with httpx.AsyncClient(follow_redirects=True, timeout=10.0) as client:
        try:
            res = await client.get(GOOGLE_BOOKS_BASE_URL, params=params)
            if res.is_success:
                data = res.json()
                items = data.get("items", [])
                
                # Sort by ratingsCount descending
                items_with_ratings = [i for i in items if i.get("volumeInfo", {}).get("ratingsCount")]
                best_rating_item = None
                if items_with_ratings:
                    best_rating_item = max(items_with_ratings, key=lambda i: i.get("volumeInfo", {}).get("ratingsCount", 0))
                
                # Sort by description length descending
                best_desc_item = None
                items_with_desc = [i for i in items if i.get("volumeInfo", {}).get("description")]
                if items_with_desc:
                    best_desc_item = max(items_with_desc, key=lambda i: len(i.get("volumeInfo", {}).get("description", "")))
                
                return {
                    "rating_average": best_rating_item.get("volumeInfo", {}).get("averageRating") if best_rating_item else None,
                    "rating_count": best_rating_item.get("volumeInfo", {}).get("ratingsCount") if best_rating_item else None,
                    "description": best_desc_item.get("volumeInfo", {}).get("description") if best_desc_item else None
                }
        except Exception as e:
            logger.warning(f"Best match fallback failed: {e}")
    return {}

@app.get("/")
def read_root():
    return {"message": "Petrichor Personal Library API"}

@app.post("/works", response_model=schemas.Work)
async def create_work(work: schemas.WorkCreate, db: DatabaseManager = Depends(get_db)):
    conn = db.get_connection()
    
    # 1. Enrich with description if missing and GB ID exists
    description = work.description or ""
    thumbnail = work.thumbnail_url or ""
    rating_avg = work.rating_average or 0.0
    rating_cnt = work.rating_count or 0
    if (not description or not thumbnail or not rating_avg) and work.google_books_id:
        try:
            enriched = await enrich_work(work.google_books_id)
            description = description or enriched.get("description", "")
            thumbnail = thumbnail or enriched.get("thumbnail_url", "")
            if not rating_avg:
                rating_avg = enriched.get("rating_average") or 0.0
                rating_cnt = enriched.get("rating_count") or 0
        except Exception as e:
            logger.warning(f"Failed to fetch enrichment for {work.google_books_id}: {e}")

    try:
        # 1. Create Work node
        query = "CREATE (w:Work {title: $title, google_books_id: $gb_id, thumbnail_url: $thumb, first_publish_year: $year, description: $description_text, page_count: $pages, rating_average: $rating_avg, rating_count: $rating_cnt, personal_rating: $pers_rating, status: $status, review: $review, personal_notes: $notes, created_at: $created}) RETURN w.id"
        result = conn.execute(
            query,
            parameters={
                "title": work.title, 
                "gb_id": work.google_books_id or "", 
                "thumb": thumbnail,
                "year": work.first_publish_year or 0,
                "description_text": description,
                "pages": work.page_count or 0,
                "rating_avg": rating_avg,
                "rating_cnt": rating_cnt,
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
        result = conn.execute("MATCH (w:Work) OPTIONAL MATCH (a:Author)-[:WROTE]->(w) RETURN w.id, w.title, w.google_books_id, w.thumbnail_url, a.name, w.first_publish_year, w.description, w.page_count, w.rating_average, w.rating_count, w.personal_rating, w.status, w.review, w.personal_notes, w.created_at")
        works = []
        while result.has_next():
            row = result.get_next()
            works.append({
                "id": row[0], 
                "title": row[1], 
                "google_books_id": row[2], 
                "thumbnail_url": row[3],
                "author": row[4],
                "first_publish_year": row[5],
                "description": row[6],
                "page_count": row[7],
                "rating_average": row[8],
                "rating_count": row[9],
                "personal_rating": row[10],
                "status": row[11],
                "review": row[12],
                "personal_notes": row[13],
                "created_at": row[14],
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
        result = conn.execute("MATCH (w:Work) WHERE w.id = $id RETURN w.id, w.title, w.google_books_id, w.thumbnail_url, w.first_publish_year, w.description, w.page_count, w.rating_average, w.rating_count, w.personal_rating, w.status, w.review, w.personal_notes, w.created_at", {"id": work_id})
        if not result.has_next():
            raise HTTPException(status_code=404, detail="Work not found")
        row = result.get_next()
        
        # Self-healing: If description, thumb, or rating is missing, try to fetch it now and save it
        stored_desc = row[5]
        stored_thumb = row[3]
        stored_rating = row[7]
        gb_id = row[2]
        if (not stored_desc or not stored_thumb or not stored_rating) and gb_id:
            logger.info(f"Self-healing: Fetching missing metadata for {row[1]}")
            try:
                enriched = await enrich_work(gb_id)
                updates = []
                params = {"id": work_id}
                if not stored_desc and enriched.get("description"):
                    updates.append("w.description = $desc")
                    params["desc"] = enriched["description"]
                    stored_desc = enriched["description"]
                if not stored_thumb and enriched.get("thumbnail_url"):
                    updates.append("w.thumbnail_url = $thumb")
                    params["thumb"] = enriched["thumbnail_url"]
                    stored_thumb = enriched["thumbnail_url"]
                if not stored_rating and enriched.get("rating_average"):
                    updates.append("w.rating_average = $r_avg")
                    updates.append("w.rating_count = $r_cnt")
                    params["r_avg"] = enriched["rating_average"]
                    params["r_cnt"] = enriched["rating_count"]
                    stored_rating = enriched["rating_average"]
                
                if updates:
                    conn.execute(f"MATCH (w:Work) WHERE w.id = $id SET {', '.join(updates)}", params)
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
            "google_books_id": gb_id, 
            "thumbnail_url": stored_thumb,
            "first_publish_year": row[4],
            "description": stored_desc,
            "page_count": row[6],
            "rating_average": row[7],
            "rating_count": row[8],
            "personal_rating": row[9],
            "status": row[10],
            "review": row[11],
            "personal_notes": row[12],
            "created_at": row[13],
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

@app.get("/enrich/{gb_id:path}")
async def enrich_work(gb_id: str):
    """Fetch deep metadata (description, thumbnail, tags) for a specific Google Books Volume ID."""
    params = {"key": GOOGLE_BOOKS_API_KEY} if GOOGLE_BOOKS_API_KEY else {}
    async with httpx.AsyncClient(follow_redirects=True, timeout=10.0) as client:
        try:
            res = await client.get(f"{GOOGLE_BOOKS_BASE_URL}/{gb_id}", params=params)
            if not res.is_success:
                raise HTTPException(status_code=404, detail="Volume not found in Google Books")
            
            data = res.json()
            vinfo = data.get("volumeInfo", {})
            
            description = vinfo.get("description", "")
            rating_avg = vinfo.get("averageRating")
            rating_cnt = vinfo.get("ratingsCount")
            
            # Fallback if rating or description is missing
            if (not rating_avg or not description) and vinfo.get("title"):
                fallback = await get_best_match(vinfo.get("title"), vinfo.get("authors", [""])[0])
                if not rating_avg:
                    rating_avg = fallback.get("rating_average")
                    rating_cnt = fallback.get("rating_count")
                if not description:
                    description = fallback.get("description", "")

            # Extract thumbnail
            thumbnail = vinfo.get("imageLinks", {}).get("thumbnail", "")
            if thumbnail:
                thumbnail = thumbnail.replace("http://", "https://")
            
            # Extract tags from categories
            categories = vinfo.get("categories", [])
            tags = get_clean_tags(categories, vinfo.get("title", ""))
                
            return {
                "google_books_id": gb_id,
                "description": description,
                "thumbnail_url": thumbnail,
                "rating_average": rating_avg,
                "rating_count": rating_cnt,
                "tags": tags
            }
        except Exception as e:
            logger.error(f"Enrichment error for {gb_id}: {e}")
            raise HTTPException(status_code=502, detail="Failed to fetch details from Google Books")

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
    params = {
        "q": q,
        "maxResults": 10,
        "printType": "books",
    }
    if GOOGLE_BOOKS_API_KEY:
        params["key"] = GOOGLE_BOOKS_API_KEY
    
    async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client:
        try:
            response = await client.get(GOOGLE_BOOKS_BASE_URL, params=params)
            response.raise_for_status()
            data = response.json()
            results = []
            for item in data.get("items", []):
                vinfo = item.get("volumeInfo", {})
                authors = vinfo.get("authors", [])
                primary_author = authors[0] if authors else "Unknown Author"
                
                # Image thumbnail
                thumb = vinfo.get("imageLinks", {}).get("thumbnail", "")
                if thumb:
                    thumb = thumb.replace("http://", "https://")

                results.append({
                    "title": vinfo.get("title", "Unknown Title"),
                    "author": primary_author,
                    "first_publish_year": parse_gb_year(vinfo.get("publishedDate", "")),
                    "google_books_id": item.get("id"),
                    "thumbnail_url": thumb,
                    "page_count": vinfo.get("pageCount"),
                    "rating_average": vinfo.get("averageRating"),
                    "rating_count": vinfo.get("ratingsCount"),
                    "tags": get_clean_tags(vinfo.get("categories", []), vinfo.get("title", ""))
                })
            return results
        except httpx.HTTPStatusError as exc:
            logger.error(f"HTTPStatusError from Google Books: {exc.response.status_code} - {exc.response.text}")
            raise HTTPException(status_code=502, detail=f"Google Books API returned error: {exc.response.status_code}")
        except Exception as e:
            logger.exception(f"Unexpected error fetching from Google Books: {e}")
            raise HTTPException(status_code=502, detail=f"External API error: {str(e)}")

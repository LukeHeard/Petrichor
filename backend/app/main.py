from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import os
import logging
import time
from .db import get_db, DatabaseManager
from .schemas import work as schemas
from .services.goodreads import GoodreadsScraper

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Petrichor API")

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Petrichor Personal Library API - Goodreads Edition"}

@app.post("/works", response_model=schemas.Work)
async def create_work(work: schemas.WorkCreate, db: DatabaseManager = Depends(get_db)):
    conn = db.get_connection()
    
    goodreads_id = work.goodreads_id
    description = work.description or ""
    thumbnail = work.thumbnail_url or ""
    rating_avg = work.rating_average or 0.0
    rating_cnt = work.rating_count or 0
    tags_to_save = work.tags or []

    # Enrichment if data is missing
    if (not description or not thumbnail or not rating_avg or not work.page_count) and goodreads_id:
        try:
            enriched = await GoodreadsScraper.get_details(goodreads_id)
            if enriched:
                description = description or enriched.get("description", "")
                thumbnail = thumbnail or enriched.get("thumbnail_url", "")
                if not rating_avg:
                    rating_avg = enriched.get("rating_average") or 0.0
                    rating_cnt = enriched.get("rating_count") or 0
                if not work.page_count:
                    # Temporary override for query parameter
                    work.page_count = enriched.get("page_count") or 0
                if not tags_to_save:
                    tags_to_save = enriched.get("tags", [])
        except Exception as e:
            logger.warning(f"Failed to fetch enrichment for {goodreads_id}: {e}")

    try:
        # 1. Create Work node
        query = "CREATE (w:Work {title: $title, goodreads_id: $gr_id, thumbnail_url: $thumb, first_publish_year: $year, description: $description_text, page_count: $pages, current_page: $curr_page, rating_average: $rating_avg, rating_count: $rating_cnt, personal_rating: $pers_rating, status: $status, review: $review, personal_notes: $notes, created_at: $created}) RETURN w.id"
        result = conn.execute(
            query,
            parameters={
                "title": work.title, 
                "gr_id": goodreads_id or "", 
                "thumb": thumbnail,
                "year": work.first_publish_year or 0,
                "description_text": description,
                "pages": work.page_count or 0,
                "curr_page": work.current_page or 0,
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
        for tag_name in tags_to_save:
            tag_res = conn.execute("MATCH (t:Tag) WHERE t.name = $name RETURN t.id", {"name": tag_name})
            if tag_res.has_next():
                tag_id = tag_res.get_next()[0]
            else:
                tag_create = conn.execute("CREATE (t:Tag {name: $name}) RETURN t.id", {"name": tag_name})
                tag_id = tag_create.get_next()[0]
            
            conn.execute("MATCH (w:Work), (t:Tag) WHERE w.id = $wid AND t.id = $tid CREATE (w)-[:HAS_TAG]->(t)", {"wid": work_id, "tid": tag_id})

        return await get_work(work_id, db)
    except Exception as e:
        logger.error(f"Error creating work: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/works", response_model=list[schemas.Work])
def list_works(db: DatabaseManager = Depends(get_db)):
    conn = db.get_connection()
    try:
        result = conn.execute("MATCH (w:Work) OPTIONAL MATCH (a:Author)-[:WROTE]->(w) RETURN w.id, w.title, w.goodreads_id, w.thumbnail_url, a.name, w.first_publish_year, w.description, w.page_count, w.current_page, w.rating_average, w.rating_count, w.personal_rating, w.status, w.review, w.personal_notes, w.created_at")
        works = []
        while result.has_next():
            row = result.get_next()
            works.append({
                "id": row[0], 
                "title": row[1], 
                "goodreads_id": row[2], 
                "thumbnail_url": row[3],
                "author": row[4],
                "first_publish_year": row[5],
                "description": row[6],
                "page_count": row[7],
                "current_page": row[8],
                "rating_average": row[9],
                "rating_count": row[10],
                "personal_rating": row[11],
                "status": row[12],
                "review": row[13],
                "personal_notes": row[14],
                "created_at": row[15],
                "tags": []
            })

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
        result = conn.execute("MATCH (w:Work) WHERE w.id = $id RETURN w.id, w.title, w.goodreads_id, w.thumbnail_url, w.first_publish_year, w.description, w.page_count, w.current_page, w.rating_average, w.rating_count, w.personal_rating, w.status, w.review, w.personal_notes, w.created_at", {"id": work_id})
        if not result.has_next():
            raise HTTPException(status_code=404, detail="Work not found")
        row = result.get_next()
        
        # Self-healing and Enrichment
        tag_result = conn.execute("MATCH (w:Work)-[:HAS_TAG]->(t:Tag) WHERE w.id = $id RETURN t.name", {"id": work_id})
        tags = []
        while tag_result.has_next():
            tags.append(tag_result.get_next()[0])

        stored_desc = row[5]
        stored_thumb = row[3]
        stored_rating = row[7]
        stored_pages = row[6]
        gr_id = row[2]
        
        # Enrich if basic data is missing OR if tags are missing
        if (not stored_desc or not stored_thumb or not stored_rating or not stored_pages or not tags) and gr_id:
            try:
                enriched = await GoodreadsScraper.get_details(gr_id)
                if enriched:
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
                    if not stored_pages and enriched.get("page_count"):
                        updates.append("w.page_count = $p_count")
                        params["p_count"] = enriched["page_count"]
                        stored_pages = enriched["page_count"]
                    
                    if updates:
                        conn.execute(f"MATCH (w:Work) WHERE w.id = $id SET {', '.join(updates)}", params)

                    # Persist tags if we were missing them
                    enriched_tags = enriched.get("tags", [])
                    if not tags and enriched_tags:
                        for tag_name in enriched_tags:
                            # Use existing Tag or create new one
                            tag_check = conn.execute("MATCH (t:Tag) WHERE t.name = $name RETURN t.id", {"name": tag_name})
                            if tag_check.has_next():
                                tag_id = tag_check.get_next()[0]
                            else:
                                tag_create = conn.execute("CREATE (t:Tag {name: $name}) RETURN t.id", {"name": tag_name})
                                tag_id = tag_create.get_next()[0]
                            
                            # Create HAS_TAG relationship
                            conn.execute("MATCH (w:Work), (t:Tag) WHERE w.id = $wid AND t.id = $tid MERGE (w)-[:HAS_TAG]->(t)", {"wid": work_id, "tid": tag_id})
                            tags.append(tag_name)
            except Exception as e:
                logger.warning(f"Self-healing failed for {work_id}: {e}")
 
        return {
            "id": row[0], 
            "title": row[1], 
            "goodreads_id": gr_id, 
            "thumbnail_url": stored_thumb,
            "first_publish_year": row[4],
            "description": stored_desc,
            "page_count": stored_pages,
            "current_page": row[7],
            "rating_average": stored_rating,
            "rating_count": row[9],
            "personal_rating": row[10],
            "status": row[11],
            "review": row[12],
            "personal_notes": row[13],
            "created_at": row[14],
            "tags": tags
        }
    except Exception as e:
        logger.error(f"Error getting work: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/enrich/{gr_id:path}")
async def enrich_work(gr_id: str):
    """Fetch deep metadata from Goodreads for a specific ID."""
    try:
        data = await GoodreadsScraper.get_details(gr_id)
        if not data:
            raise HTTPException(status_code=404, detail="Book not found on Goodreads")
        return data
    except Exception as e:
        logger.error(f"Enrichment error for {gr_id}: {e}")
        raise HTTPException(status_code=502, detail="Failed to fetch details from Goodreads")

@app.get("/search")
async def search_works(q: str = Query(..., min_length=1)):
    try:
        results = await GoodreadsScraper.search(q)
        return results
    except Exception as e:
        logger.error(f"Search error: {e}")
        raise HTTPException(status_code=502, detail="Failed to search Goodreads")

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
        check = conn.execute("MATCH (w:Work) WHERE w.id = $id RETURN w.id", {"id": work_id})
        if not check.has_next():
            raise HTTPException(status_code=404, detail="Work not found")
        
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
        if work_update.current_page is not None:
            sets.append("w.current_page = $curr_page")
            params["curr_page"] = work_update.current_page
        if work_update.review is not None:
            sets.append("w.review = $review")
            params["review"] = work_update.review
        if work_update.personal_notes is not None:
            sets.append("w.personal_notes = $notes")
            params["notes"] = work_update.personal_notes
        
        if sets:
            query = f"MATCH (w:Work) WHERE w.id = $id SET {', '.join(sets)}"
            conn.execute(query, params)
            
        if work_update.tags is not None:
            current_tags_res = conn.execute("MATCH (w:Work)-[:HAS_TAG]->(t:Tag) WHERE w.id = $id RETURN t.name", {"id": work_id})
            current_tags = []
            while current_tags_res.has_next():
                current_tags.append(current_tags_res.get_next()[0])
            
            new_tags = set(work_update.tags)
            old_tags = set(current_tags)
            
            to_add = new_tags - old_tags
            for tag_name in to_add:
                tag_check = conn.execute("MATCH (t:Tag) WHERE t.name = $name RETURN t.id", {"name": tag_name})
                if tag_check.has_next():
                    tag_id = tag_check.get_next()[0]
                else:
                    tag_create = conn.execute("CREATE (t:Tag {name: $name}) RETURN t.id", {"name": tag_name})
                    tag_id = tag_create.get_next()[0]
                conn.execute("MATCH (w:Work), (t:Tag) WHERE w.id = $wid AND t.id = $tid CREATE (w)-[:HAS_TAG]->(t)", {"wid": work_id, "tid": tag_id})
            
            to_remove = old_tags - new_tags
            for tag_name in to_remove:
                conn.execute("MATCH (w:Work)-[r:HAS_TAG]->(t:Tag) WHERE w.id = $wid AND t.name = $tname DELETE r", {"wid": work_id, "tname": tag_name})
        
        return await get_work(work_id, db)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating work: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/authors", response_model=schemas.Author)
def create_author(author: schemas.AuthorCreate, db: DatabaseManager = Depends(get_db)):
    conn = db.get_connection()
    try:
        # Use parameterized query to avoid injection
        result = conn.execute("CREATE (a:Author {name: $name}) RETURN a.id, a.name", {"name": author.name})
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
        conn.execute("MATCH (w:Work), (a:Author) WHERE w.id = $wid AND a.id = $aid CREATE (a)-[:WROTE]->(w)", {"wid": work_id, "aid": author_id})
        return {"message": "Success"}
    except Exception as e:
        logger.error(f"Error linking author to work: {e}")
        raise HTTPException(status_code=500, detail=str(e))

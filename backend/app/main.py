from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import os
import logging
import time
from typing import Optional
from .db import get_db, DatabaseManager
from .schemas import work as schemas
from .schemas import tracking as tracking_schemas
from .schemas import stats as stats_schemas
from .schemas import graph as graph_schemas
from datetime import datetime, timedelta
from .services.goodreads import GoodreadsScraper

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Petrichor API")

BLOCKED_TAGS = {"Friendship", "Science Fiction Fantasy"}

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
        stored_rating = row[8]
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
 
        # Fetch author
        author_result = conn.execute("MATCH (a:Author)-[:WROTE]->(w:Work) WHERE w.id = $id RETURN a.name", {"id": work_id})
        author_name = None
        if author_result.has_next():
            author_name = author_result.get_next()[0]

        return {
            "id": row[0], 
            "title": row[1], 
            "author": author_name,
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
        if work_update.page_count is not None:
            sets.append("w.page_count = $p_count")
            params["p_count"] = work_update.page_count
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
        
        if work_update.author is not None:
            # 1. Fetch current author(s)
            curr_author_res = conn.execute("MATCH (a:Author)-[:WROTE]->(w:Work) WHERE w.id = $id RETURN a.id, a.name", {"id": work_id})
            old_authors = []
            while curr_author_res.has_next():
                row = curr_author_res.get_next()
                old_authors.append({"id": row[0], "name": row[1]})
            
            # 2. Delete existing WROTE relation
            conn.execute("MATCH (a:Author)-[r:WROTE]->(w:Work) WHERE w.id = $id DELETE r", {"id": work_id})
            
            # 3. Clean up orphaned authors
            for old_a in old_authors:
                works_count_res = conn.execute("MATCH (a:Author)-[:WROTE]->(w:Work) WHERE a.id = $aid RETURN count(w)", {"aid": old_a["id"]})
                if works_count_res.has_next():
                    count = works_count_res.get_next()[0]
                    if count == 0:
                        conn.execute("MATCH (a:Author) WHERE a.id = $aid DELETE a", {"aid": old_a["id"]})
            
            # 4. Link new author
            if work_update.author.strip():
                new_author_name = work_update.author.strip()
                new_author_res = conn.execute("MATCH (a:Author) WHERE a.name = $name RETURN a.id", {"name": new_author_name})
                if new_author_res.has_next():
                    new_author_id = new_author_res.get_next()[0]
                else:
                    create_res = conn.execute("CREATE (a:Author {name: $name}) RETURN a.id", {"name": new_author_name})
                    new_author_id = create_res.get_next()[0]
                
                conn.execute("MATCH (a:Author), (w:Work) WHERE a.id = $aid AND w.id = $wid MERGE (a)-[:WROTE]->(w)", {"aid": new_author_id, "wid": work_id})
        
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
        # Check if author exists first
        check = conn.execute("MATCH (a:Author) WHERE a.name = $name RETURN a.id, a.name", {"name": author.name})
        if check.has_next():
            row = check.get_next()
            return {"id": row[0], "name": row[1]}
            
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

@app.post("/debug/merge-authors")
def merge_duplicate_authors(db: DatabaseManager = Depends(get_db)):
    conn = db.get_connection()
    try:
        res = conn.execute("MATCH (a:Author) RETURN a.name, count(a) AS c, collect(a.id) ORDER BY c DESC")
        duplicates = []
        while res.has_next():
            row = res.get_next()
            if row[1] > 1:
                duplicates.append((row[0], row[2]))
        
        total_merged = 0
        total_deleted = 0
        
        for name, ids in duplicates:
            ids.sort()
            primary_id = ids[0]
            for dup_id in ids[1:]:
                works_res = conn.execute("MATCH (dup:Author)-[r:WROTE]->(w:Work) WHERE dup.id = $id RETURN w.id", {"id": dup_id})
                works_to_relink = []
                while works_res.has_next():
                    works_to_relink.append(works_res.get_next()[0])
                
                for work_id in works_to_relink:
                    conn.execute("MATCH (p:Author), (w:Work) WHERE p.id = $pid AND w.id = $wid MERGE (p)-[:WROTE]->(w)", {"pid": primary_id, "wid": work_id})
                    conn.execute("MATCH (dup:Author)-[r:WROTE]->(w:Work) WHERE dup.id = $id AND w.id = $wid DELETE r", {"id": dup_id, "wid": work_id})
                
                conn.execute("MATCH (dup:Author) WHERE dup.id = $id DELETE dup", {"id": dup_id})
                total_merged += len(works_to_relink)
                total_deleted += 1
                
        return {"merged_relations": total_merged, "deleted_authors": total_deleted}
    except Exception as e:
        logger.error(f"Merge error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/tags", response_model=list[str])
def list_tags(db: DatabaseManager = Depends(get_db)):
    conn = db.get_connection()
    try:
        result = conn.execute("MATCH (t:Tag) RETURN t.name")
        tags = []
        while result.has_next():
            tag_name = result.get_next()[0]
            if tag_name not in BLOCKED_TAGS:
                tags.append(tag_name)
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

@app.post("/sessions", response_model=tracking_schemas.ReadingSession)
def create_session(session: tracking_schemas.ReadingSessionCreate, db: DatabaseManager = Depends(get_db)):
    conn = db.get_connection()
    try:
        # Check if work exists
        work_res = conn.execute("MATCH (w:Work) WHERE w.id = $id RETURN w.title", {"id": session.work_id})
        if not work_res.has_next():
            raise HTTPException(status_code=404, detail="Work not found")
        work_title = work_res.get_next()[0]

        query = """
        CREATE (s:ReadingSession {date: $date, start_page: $start, end_page: $end, minutes_read: $mins})
        RETURN s.id
        """
        params = {
            "date": session.date,
            "start": session.start_page,
            "end": session.end_page,
            "mins": session.minutes_read or 0
        }
        res = conn.execute(query, params)
        if not res.has_next():
            raise HTTPException(status_code=500, detail="Failed to create reading session node")
        session_id = res.get_next()[0]

        # Link to work
        conn.execute(
            "MATCH (w:Work), (s:ReadingSession) WHERE w.id = $wid AND s.id = $sid CREATE (s)-[:SESSION_FOR]->(w)",
            {"wid": session.work_id, "sid": session_id}
        )
        
        # Update the work's current_page and status
        # Requested: current_page = finished_page, status = 'Reading'
        conn.execute(
            "MATCH (w:Work) WHERE w.id = $id SET w.current_page = $cp, w.status = 'Reading'",
            {"id": session.work_id, "cp": session.end_page}
        )

        return {
            "id": session_id,
            "work_id": session.work_id,
            "work_title": work_title,
            "date": session.date,
            "start_page": session.start_page,
            "end_page": session.end_page,
            "minutes_read": session.minutes_read or 0
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating reading session: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/sessions", response_model=list[tracking_schemas.ReadingSession])
def list_sessions(db: DatabaseManager = Depends(get_db)):
    conn = db.get_connection()
    try:
        query = """
        MATCH (s:ReadingSession)-[:SESSION_FOR]->(w:Work)
        RETURN s.id, s.date, s.start_page, s.end_page, s.minutes_read, w.id, w.title, w.thumbnail_url
        """
        res = conn.execute(query)
        sessions = []
        while res.has_next():
            row = res.get_next()
            sessions.append({
                "id": row[0],
                "date": row[1],
                "start_page": row[2],
                "end_page": row[3],
                "minutes_read": row[4],
                "work_id": row[5],
                "work_title": row[6],
                "work_thumbnail_url": row[7]
            })
        return sessions
    except Exception as e:
        logger.error(f"Error listing reading sessions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.patch("/sessions/{session_id}", response_model=tracking_schemas.ReadingSession)
def update_session(session_id: int, session_update: tracking_schemas.ReadingSessionUpdate, db: DatabaseManager = Depends(get_db)):
    conn = db.get_connection()
    try:
        # Check if session exists
        res = conn.execute("MATCH (s:ReadingSession)-[:SESSION_FOR]->(w:Work) WHERE s.id = $id RETURN s, w.id, w.title, w.thumbnail_url", {"id": session_id})
        if not res.has_next():
            raise HTTPException(status_code=404, detail="Reading session not found")
        
        # Build update query
        update_parts = []
        params = {"id": session_id}
        if session_update.date is not None:
            update_parts.append("s.date = $date")
            params["date"] = session_update.date
        if session_update.start_page is not None:
            update_parts.append("s.start_page = $start")
            params["start"] = session_update.start_page
        if session_update.end_page is not None:
            update_parts.append("s.end_page = $end")
            params["end"] = session_update.end_page
        if session_update.minutes_read is not None:
            update_parts.append("s.minutes_read = $mins")
            params["mins"] = session_update.minutes_read

        if update_parts:
            query = f"MATCH (s:ReadingSession) WHERE s.id = $id SET {', '.join(update_parts)}"
            conn.execute(query, params)
        
        # Return updated session
        res = conn.execute("MATCH (s:ReadingSession)-[:SESSION_FOR]->(w:Work) WHERE s.id = $id RETURN s.id, s.date, s.start_page, s.end_page, s.minutes_read, w.id, w.title, w.thumbnail_url", {"id": session_id})
        row = res.get_next()
        return {
            "id": row[0],
            "date": row[1],
            "start_page": row[2],
            "end_page": row[3],
            "minutes_read": row[4],
            "work_id": row[5],
            "work_title": row[6],
            "work_thumbnail_url": row[7]
        }
    except Exception as e:
        logger.error(f"Error updating reading session: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/sessions/{session_id}")
def delete_session(session_id: int, db: DatabaseManager = Depends(get_db)):
    conn = db.get_connection()
    try:
        # Check if session exists
        res = conn.execute("MATCH (s:ReadingSession) WHERE s.id = $id RETURN s.id", {"id": session_id})
        if not res.has_next():
            raise HTTPException(status_code=404, detail="Reading session not found")
        
        conn.execute("MATCH (s:ReadingSession) WHERE s.id = $id DETACH DELETE s", {"id": session_id})
        return {"message": "Reading session deleted"}
    except Exception as e:
        logger.error(f"Error deleting reading session: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/stats", response_model=stats_schemas.StatsResponse)
def get_stats(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db: DatabaseManager = Depends(get_db)
):
    conn = db.get_connection()
    try:
        # Default range: last 30 days if not provided
        now = datetime.now()
        if not end_date:
            end_date = now.strftime("%Y-%m-%d")
        if not start_date:
            start_date = (now - timedelta(days=30)).strftime("%Y-%m-%d")

        # 1. Summary & Library Totals
        res_total = conn.execute("MATCH (w:Work) RETURN count(w)")
        total_books = res_total.get_next()[0] if res_total.has_next() else 0

        res_finished = conn.execute("MATCH (w:Work) WHERE w.status = 'Finished' RETURN count(w)")
        finished_books = res_finished.get_next()[0] if res_finished.has_next() else 0

        res_tsundoku = conn.execute("MATCH (w:Work) WHERE w.status = 'Owned' RETURN count(w)")
        tsundoku_count = res_tsundoku.get_next()[0] if res_tsundoku.has_next() else 0

        res_rating = conn.execute("MATCH (w:Work) WHERE w.personal_rating > 0 RETURN avg(w.personal_rating)")
        avg_rating = res_rating.get_next()[0] if res_rating.has_next() else 0.0

        # 2. Period-specific metrics (Sessions)
        # Find the earliest session in the entire DB for truncation logic
        res_earliest = conn.execute("MATCH (s:ReadingSession) RETURN min(s.date)")
        db_earliest_date_str = res_earliest.get_next()[0] if res_earliest.has_next() else None
        
        # Determine the start date for the activity chart
        fmt = "%Y-%m-%d"
        req_start = datetime.strptime(start_date, fmt)
        req_end = datetime.strptime(end_date, fmt)

        # 1.5 Lifetime Reading Totals
        res_lifetime = conn.execute("MATCH (s:ReadingSession) RETURN sum(s.end_page - s.start_page), sum(s.minutes_read), count(s)")
        if res_lifetime.has_next():
            lrow = res_lifetime.get_next()
            total_pages_all_time = lrow[0] or 0
            total_minutes_all_time = lrow[1] or 0
            total_sessions_all_time = lrow[2] or 0
        else:
            total_pages_all_time = 0
            total_minutes_all_time = 0
            total_sessions_all_time = 0
        
        chart_start = req_start
        if db_earliest_date_str:
            db_earliest = datetime.strptime(db_earliest_date_str, fmt)
            # Only truncate if they requested "All Time" (1970-01-01)
            # Otherwise honor the specific calendar range requested
            if req_start.year == 1970 and req_start < db_earliest:
                # Provide a small padding so the chart visually starts at 0
                chart_start = db_earliest - timedelta(days=1)

        # Calculate range length
        delta = req_end - chart_start
        days_in_range = delta.days
        use_yearly = days_in_range > 1825 # > 5 years
        use_monthly = not use_yearly and days_in_range > 100

        session_query = """
        MATCH (s:ReadingSession)
        WHERE s.date >= $start AND s.date <= $end
        RETURN s.date, s.start_page, s.end_page, s.minutes_read
        ORDER BY s.date
        """
        res_sessions = conn.execute(session_query, {"start": start_date, "end": end_date})
        
        metrics = {}
        total_pages_period = 0
        total_minutes_period = 0
        
        while res_sessions.has_next():
            row = res_sessions.get_next()
            s_date_str, s_start, s_end, s_mins = row[0], row[1], row[2], row[3]
            pages = max(0, s_end - s_start)
            mins = s_mins or 0
            
            # Key for aggregation (Day, Month, or Year)
            if use_yearly:
                key = s_date_str[:4] # YYYY
            elif use_monthly:
                key = s_date_str[:7] # YYYY-MM
            else:
                key = s_date_str
            
            if key not in metrics:
                metrics[key] = {"pages": 0, "minutes": 0}
            
            metrics[key]["pages"] += pages
            metrics[key]["minutes"] += mins
            total_pages_period += pages
            total_minutes_period += mins

        # Fill in gaps and prepare activity list
        activity_data = []
        curr = chart_start
        
        if use_yearly:
            # Yearly Gap Filling
            curr = curr.replace(month=1, day=1)
            while curr <= req_end:
                y_str = curr.strftime("%Y")
                activity_data.append({
                    "date": y_str + "-01-01",
                    "pages": metrics.get(y_str, {}).get("pages", 0),
                    "minutes": metrics.get(y_str, {}).get("minutes", 0)
                })
                curr = curr.replace(year=curr.year + 1)
        elif use_monthly:
            # Monthly Gap Filling
            # Normalize curr to start of month
            curr = curr.replace(day=1)
            while curr <= req_end:
                m_str = curr.strftime("%Y-%m")
                activity_data.append({
                    "date": m_str + "-01", # Return first of month for chart compatibility
                    "pages": metrics.get(m_str, {}).get("pages", 0),
                    "minutes": metrics.get(m_str, {}).get("minutes", 0)
                })
                # Move to next month
                if curr.month == 12:
                    curr = curr.replace(year=curr.year + 1, month=1)
                else:
                    curr = curr.replace(month=curr.month + 1)
        else:
            # Daily Gap Filling
            while curr <= req_end:
                d_str = curr.strftime(fmt)
                activity_data.append({
                    "date": d_str,
                    "pages": metrics.get(d_str, {}).get("pages", 0),
                    "minutes": metrics.get(d_str, {}).get("minutes", 0)
                })
                curr += timedelta(days=1)

        # 3. Distributions
        tag_res = conn.execute("MATCH (w:Work)-[:HAS_TAG]->(t:Tag) RETURN t.name, count(w) ORDER BY count(w) DESC LIMIT 10")
        tag_distribution = []
        while tag_res.has_next():
            row = tag_res.get_next()
            tag_distribution.append({"label": row[0], "value": row[1]})

        rating_res = conn.execute("MATCH (w:Work) WHERE w.personal_rating > 0 RETURN w.personal_rating, count(w) ORDER BY w.personal_rating")
        rating_distribution = []
        while rating_res.has_next():
            row = rating_res.get_next()
            rating_distribution.append({"label": str(row[0]), "value": row[1]})

        # 4. Currently Reading
        cr_res = conn.execute("MATCH (w:Work) WHERE w.status = 'Reading' RETURN w.id, w.title, w.thumbnail_url, w.page_count, w.current_page")
        currently_reading = []
        while cr_res.has_next():
            row = cr_res.get_next()
            wid, wtitle, wthumb, wpages, wcurr = row[0], row[1], row[2], row[3], row[4]
            progress = (wcurr / wpages * 100) if wpages > 0 else 0
            currently_reading.append({
                "id": wid,
                "title": wtitle,
                "thumbnail_url": wthumb,
                "page_count": wpages,
                "current_page": wcurr,
                "progress_percentage": round(progress, 1)
            })

        return {
            "summary": {
                "total_books": total_books,
                "finished_books": finished_books,
                "total_pages_period": total_pages_period,
                "total_minutes_period": total_minutes_period,
                "average_rating": round(avg_rating, 2),
                "total_pages_all_time": total_pages_all_time,
                "total_minutes_all_time": total_minutes_all_time,
                "total_sessions_all_time": total_sessions_all_time,
                "tsundoku_count": tsundoku_count
            },
            "daily_activity": activity_data, # Kept key name for frontend compat, but content varies
            "tag_distribution": tag_distribution,
            "rating_distribution": rating_distribution,
            "currently_reading": currently_reading
        }
    except Exception as e:
        logger.error(f"Error generating stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/graph", response_model=graph_schemas.GraphResponse)
def get_graph_data(db: DatabaseManager = Depends(get_db)):
    """Fetch all works, authors, and tags nodes and their relationships for graph visualization."""
    conn = db.get_connection()
    try:
        nodes = []
        links = []
        node_ids = set()

        # Colors and sizes
        colors = {
            "Work": "#4ade80",    # Green
            "Author": "#60a5fa",  # Blue
            "Tag": "#c084fc"      # Purple
        }
        sizes = {
            "Work": 3,
            "Author": 4,
            "Tag": 2
        }

        # 1. Fetch Works
        res_works = conn.execute("MATCH (w:Work) RETURN w.id, w.title, w.thumbnail_url, w.status")
        while res_works.has_next():
            row = res_works.get_next()
            nid = f"work_{row[0]}"
            nodes.append(graph_schemas.GraphNode(
                id=nid,
                label=row[1],
                type="Work",
                val=sizes["Work"],
                color=colors["Work"],
                properties={"thumbnail_url": row[2], "status": row[3]}
            ))
            node_ids.add(nid)

        # 2. Fetch Authors
        res_authors = conn.execute("MATCH (a:Author)-[:WROTE]->(w:Work) RETURN DISTINCT a.id, a.name")
        while res_authors.has_next():
            row = res_authors.get_next()
            nid = f"author_{row[0]}"
            nodes.append(graph_schemas.GraphNode(
                id=nid,
                label=row[1],
                type="Author",
                val=sizes["Author"],
                color=colors["Author"],
                properties={}
            ))
            node_ids.add(nid)

        # 3. Fetch Tags
        res_tags = conn.execute("MATCH (t:Tag)<-[:HAS_TAG]-(w:Work) RETURN DISTINCT t.id, t.name")
        while res_tags.has_next():
            row = res_tags.get_next()
            t_name = row[1]
            if t_name in BLOCKED_TAGS:
                continue
            nid = f"tag_{row[0]}"
            nodes.append(graph_schemas.GraphNode(
                id=nid,
                label=t_name,
                type="Tag",
                val=sizes["Tag"],
                color=colors["Tag"],
                properties={}
            ))
            node_ids.add(nid)

        # 4. Fetch Relationships: WROTE (Author -> Work)
        res_wrote = conn.execute("MATCH (a:Author)-[r:WROTE]->(w:Work) RETURN a.id, w.id")
        while res_wrote.has_next():
            row = res_wrote.get_next()
            source = f"author_{row[0]}"
            target = f"work_{row[1]}"
            if source in node_ids and target in node_ids:
                links.append(graph_schemas.GraphLink(source=source, target=target, type="WROTE"))

        # 5. Fetch Relationships: HAS_TAG (Work -> Tag)
        res_has_tag = conn.execute("MATCH (w:Work)-[r:HAS_TAG]->(t:Tag) RETURN w.id, t.id")
        while res_has_tag.has_next():
            row = res_has_tag.get_next()
            source = f"work_{row[0]}"
            target = f"tag_{row[1]}"
            if source in node_ids and target in node_ids:
                links.append(graph_schemas.GraphLink(source=source, target=target, type="HAS_TAG"))

        return {"nodes": nodes, "links": links}
    except Exception as e:
        logger.error(f"Error fetching graph data: {e}")
        raise HTTPException(status_code=500, detail=str(e))

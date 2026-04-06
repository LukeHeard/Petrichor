from fastapi import FastAPI, Depends, HTTPException, Query, Body, BackgroundTasks, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import httpx
import os
import uuid
import shutil
from .db import get_db, DatabaseManager
from .schemas import work as schemas
import logging
from typing import Optional

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

# Ensure covers directory exists
COVERS_DIR = os.getenv("COVERS_PATH", "./data/covers")
if not os.path.exists(COVERS_DIR):
    os.makedirs(COVERS_DIR, exist_ok=True)

# Mount static files for covers
app.mount("/covers", StaticFiles(directory=COVERS_DIR), name="covers")

def get_cover_local_url(cover_id: str) -> Optional[str]:
    if not cover_id:
        return None
    file_path = os.path.join(COVERS_DIR, f"{cover_id}.jpg")
    if os.path.exists(file_path):
        return f"/covers/{cover_id}.jpg"
    return None

async def download_cover_task(cover_id: str):
    if not cover_id:
        return
    
    # Path relative to project root since we are running from there usually
    # or use absolute path if possible. Let's stick to COVERS_DIR.
    file_path = os.path.join(COVERS_DIR, f"{cover_id}.jpg")
    if os.path.exists(file_path):
        return

    if cover_id.isdigit():
        url = f"https://covers.openlibrary.org/b/id/{cover_id}-L.jpg"
    else:
        url = f"https://covers.openlibrary.org/b/olid/{cover_id}-L.jpg"

    try:
        headers = {"User-Agent": "PetrichorLibraryApp/1.0 (test@example.com)"}
        async with httpx.AsyncClient(headers=headers, follow_redirects=True, timeout=30.0) as client:
            response = await client.get(url)
            if response.status_code == 200:
                # Check if it's a real image (OpenLibrary returns a tiny 1x1 or default if not found)
                # Usually they return a "no cover" image if default=true (default)
                # We can check size or just save it.
                if len(response.content) > 1000: # Simple check to avoid saving 1x1 pixels
                    with open(file_path, "wb") as f:
                        f.write(response.content)
                    logger.info(f"Downloaded cover {cover_id}")
    except Exception as e:
        logger.error(f"Failed to download cover {cover_id}: {e}")

@app.get("/")
def read_root():
    return {"message": "Petrichor Personal Library API"}

@app.post("/works", response_model=schemas.Work)
async def create_work(work: schemas.WorkCreate, background_tasks: BackgroundTasks, db: DatabaseManager = Depends(get_db)):
    conn = db.get_connection()
    try:
        # Create a Work node.
        result = conn.execute(
            "CREATE (w:Work {title: $title, openlibrary_id: $openlib, cover_id: $cover}) RETURN w.id, w.title, w.openlibrary_id, w.cover_id",
            parameters={
                "title": work.title, 
                "openlib": work.openlibrary_id or "",
                "cover": work.cover_id or ""
            }
        )
        if result.has_next():
            row = result.get_next()
            work_id_internal = row[0]
            cover_id_str = row[3] if row[3] and row[3] != "" else None
            openlib_id = row[2] if row[2] else None
            
            # If no cover_id was provided, try to fetch a default one from OpenLibrary
            if not cover_id_str and openlib_id:
                try:
                    headers = {"User-Agent": "PetrichorLibraryApp/1.0 (test@example.com)"}
                    async with httpx.AsyncClient(headers=headers, follow_redirects=True, timeout=10.0) as client:
                        response = await client.get(f"https://openlibrary.org{openlib_id}.json")
                        if response.status_code == 200:
                            work_data = response.json()
                            work_covers = work_data.get("covers", [])
                            if work_covers:
                                cover_id_str = str(work_covers[0])
                                # Update the DB with the newly found default cover
                                conn.execute(
                                    f"MATCH (w:Work) WHERE w.id = {work_id_internal} SET w.cover_id = $cover",
                                    parameters={"cover": cover_id_str}
                                )
                except Exception as e:
                    logger.error(f"Failed to fetch default cover for {openlib_id}: {e}")

            if cover_id_str:
                background_tasks.add_task(download_cover_task, cover_id_str)

            return {
                "id": work_id_internal, 
                "title": row[1], 
                "openlibrary_id": openlib_id,
                "cover_id": cover_id_str,
                "cover_url": get_cover_local_url(cover_id_str)
            }
        raise HTTPException(status_code=500, detail="Failed to create work")
    except Exception as e:
        logger.error(f"Error creating work: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/works", response_model=list[schemas.Work])
def list_works(db: DatabaseManager = Depends(get_db)):
    conn = db.get_connection()
    try:
        # Match Work and optionally join with Author via WROTE relationship.
        result = conn.execute("MATCH (w:Work) OPTIONAL MATCH (a:Author)-[:WROTE]->(w) RETURN w.id, w.title, w.openlibrary_id, w.cover_id, a.name")
        works = []
        while result.has_next():
            row = result.get_next()
            cover_id_str = row[3] if row[3] and row[3] != "" else None
            works.append({
                "id": row[0], 
                "title": row[1], 
                "openlibrary_id": row[2] if row[2] else None,
                "cover_id": cover_id_str,
                "cover_url": get_cover_local_url(cover_id_str),
                "author": row[4] if row[4] else None
            })
        return works
    except Exception as e:
        logger.error(f"Error listing works: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/works/{work_id}", response_model=schemas.Work)
def get_work(work_id: int, db: DatabaseManager = Depends(get_db)):
    conn = db.get_connection()
    try:
        result = conn.execute(
            f"MATCH (w:Work) WHERE w.id = {work_id} OPTIONAL MATCH (a:Author)-[:WROTE]->(w) RETURN w.id, w.title, w.openlibrary_id, w.cover_id, a.name"
        )
        if result.has_next():
            row = result.get_next()
            cover_id_str = row[3] if row[3] and row[3] != "" else None
            return {
                "id": row[0], 
                "title": row[1], 
                "openlibrary_id": row[2] if row[2] else None,
                "cover_id": cover_id_str,
                "cover_url": get_cover_local_url(cover_id_str),
                "author": row[4] if row[4] else None
            }
        raise HTTPException(status_code=404, detail="Work not found")
    except Exception as e:
        logger.error(f"Error getting work: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.patch("/works/{work_id}", response_model=schemas.Work)
def update_work(work_id: int, background_tasks: BackgroundTasks, cover_id: str = Body(..., embed=True), db: DatabaseManager = Depends(get_db)):
    conn = db.get_connection()
    try:
        conn.execute(
            f"MATCH (w:Work) WHERE w.id = {work_id} SET w.cover_id = $cover",
            parameters={"cover": cover_id}
        )
        
        background_tasks.add_task(download_cover_task, cover_id)

        # Fetch updated work
        result = conn.execute(
            f"MATCH (w:Work) WHERE w.id = {work_id} OPTIONAL MATCH (a:Author)-[:WROTE]->(w) RETURN w.id, w.title, w.openlibrary_id, w.cover_id, a.name"
        )
        if result.has_next():
            row = result.get_next()
            cover_id_str = row[3] if row[3] and row[3] != "" else None
            return {
                "id": row[0], 
                "title": row[1], 
                "openlibrary_id": row[2] if row[2] else None,
                "cover_id": cover_id_str,
                "cover_url": get_cover_local_url(cover_id_str),
                "author": row[4] if row[4] else None
            }
        raise HTTPException(status_code=404, detail="Work not found")
    except Exception as e:
        logger.error(f"Error updating work: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/works/{work_id}/upload-cover", response_model=schemas.Work)
async def upload_work_cover(work_id: int, file: UploadFile = File(...), db: DatabaseManager = Depends(get_db)):
    try:
        # Generate a unique ID for the local upload
        # We'll use .jpg to be consistent with our serving logic, 
        # but in a real app we'd keep the original extension and update serving logic.
        local_id = f"local-{uuid.uuid4()}"
        file_name = f"{local_id}.jpg"
        file_path = os.path.join(COVERS_DIR, file_name)

        # Save the file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Update the database
        conn = db.get_connection()
        conn.execute(
            f"MATCH (w:Work) WHERE w.id = {work_id} SET w.cover_id = $cover",
            parameters={"cover": local_id}
        )
        
        # Fetch updated work
        result = conn.execute(
            f"MATCH (w:Work) WHERE w.id = {work_id} OPTIONAL MATCH (a:Author)-[:WROTE]->(w) RETURN w.id, w.title, w.openlibrary_id, w.cover_id, a.name"
        )
        if result.has_next():
            row = result.get_next()
            cover_id_str = row[3] if row[3] and row[3] != "" else None
            return {
                "id": row[0], 
                "title": row[1], 
                "openlibrary_id": row[2] if row[2] else None,
                "cover_id": cover_id_str,
                "cover_url": get_cover_local_url(cover_id_str),
                "author": row[4] if row[4] else None
            }
        raise HTTPException(status_code=404, detail="Work not found")
    except Exception as e:
        logger.error(f"Error uploading cover: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/works/{work_id}")
def delete_work(work_id: int, db: DatabaseManager = Depends(get_db)):
    conn = db.get_connection()
    try:
        # DETACH DELETE removes the node and all incoming/outgoing relationships.
        conn.execute(f"MATCH (w:Work) WHERE w.id = {work_id} DETACH DELETE w")
        return {"message": "Book removed from library"}
    except Exception as e:
        logger.error(f"Error deleting work: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/authors", response_model=schemas.Author)
def create_author(author: schemas.AuthorCreate, db: DatabaseManager = Depends(get_db)):
    conn = db.get_connection()
    try:
        result = conn.execute(f"CREATE (a:Author {{name: $name}}) RETURN a.id, a.name", parameters={"name": author.name})
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

@app.post("/works/{work_id}/authors/{author_id}")
def link_author_to_work(work_id: int, author_id: int, db: DatabaseManager = Depends(get_db)):
    conn = db.get_connection()
    try:
        conn.execute(f"MATCH (w:Work), (a:Author) WHERE w.id = {work_id} AND a.id = {author_id} CREATE (a)-[:WROTE]->(w)")
        return {"message": "Success"}
    except Exception as e:
        logger.error(f"Error linking author to work: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/search", response_model=list[schemas.SearchResult])
async def search_works(q: str = Query(..., min_length=1), db: DatabaseManager = Depends(get_db)):
    # 1. Get existing library IDs to flag results
    conn = db.get_connection()
    existing_ids = set()
    try:
        id_result = conn.execute("MATCH (w:Work) RETURN w.openlibrary_id")
        while id_result.has_next():
            row = id_result.get_next()
            if row[0]:
                existing_ids.add(row[0])
    except Exception as e:
        logger.error(f"Error fetching existing IDs: {e}")

    # 2. Search OpenLibrary
    headers = {"User-Agent": "PetrichorLibraryApp/1.0 (test@example.com)"}
    async with httpx.AsyncClient(headers=headers, follow_redirects=True, timeout=30.0) as client:
        try:
            response = await client.get(
                "https://openlibrary.org/search.json",
                params={"q": q, "limit": "10", "fields": "key,title,author_name,first_publish_year,cover_i,cover_edition_key"}
            )
            response.raise_for_status()
            data = response.json()
            results = []
            for doc in data.get("docs", []):
                authors = doc.get("author_name", [])
                primary_author = authors[0] if authors else ""
                
                ol_id = doc.get("key")
                cover_id = doc.get("cover_i")
                if not cover_id:
                  cover_id = doc.get("cover_edition_key")

                results.append({
                    "title": doc.get("title", "Unknown Title"),
                    "author": primary_author,
                    "first_publish_year": doc.get("first_publish_year"),
                    "openlibrary_id": ol_id,
                    "cover_id": str(cover_id) if cover_id else None,
                    "cover_url": get_cover_local_url(str(cover_id)) if cover_id else None,
                    "in_library": ol_id in existing_ids if ol_id else False
                })
            return results
        except Exception as e:
            logger.exception(f"Search error: {e}")
            raise HTTPException(status_code=502, detail=str(e))

@app.get("/works/{work_id}/editions")
async def get_work_editions(work_id: int, db: DatabaseManager = Depends(get_db)):
    # 1. Get the book from DB to find its OpenLibrary Work ID
    conn = db.get_connection()
    result = conn.execute(f"MATCH (w:Work) WHERE w.id = {work_id} RETURN w.openlibrary_id")
    if not result.has_next():
        raise HTTPException(status_code=404, detail="Work not found")
    
    ol_id = result.get_next()[0]
    if not ol_id:
        return []

            # 2. Fetch editions from OpenLibrary
    headers = {"User-Agent": "PetrichorLibraryApp/1.0 (test@example.com)"}
    async with httpx.AsyncClient(headers=headers, follow_redirects=True, timeout=30.0) as client:
        try:
            # Increase limit to find more covers for books with many editions
            response = await client.get(f"https://openlibrary.org{ol_id}/editions.json", params={"limit": 200})
            response.raise_for_status()
            data = response.json()
            
            # 3. Extract unique cover IDs
            covers = set()
            for entry in data.get("entries", []):
                # Check for numeric cover IDs
                for cid in entry.get("covers", []):
                    if cid and cid > 0:
                        covers.add(str(cid))
                
                # Check for edition keys (OLIDs) which can also be used as covers
                if entry.get("key"):
                    olid = entry.get("key").replace("/books/", "")
                    # Add OLID as a candidate if it seems to have a cover or just as a fallback
                    # We'll filter out duplicates or invalid ones later if needed
                    # but usually every edition *can* have a cover via its OLID
                    if "covers" in entry or entry.get("cover_i"):
                         covers.add(olid)
            
            return sorted(list(covers), key=lambda x: x.isdigit(), reverse=True)
        except Exception as e:
            logger.exception(f"Editions error: {e}")
            raise HTTPException(status_code=502, detail=str(e))

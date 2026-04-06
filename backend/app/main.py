from fastapi import FastAPI, Depends, HTTPException, Query, Body
from fastapi.middleware.cors import CORSMiddleware
import httpx
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

@app.get("/")
def read_root():
    return {"message": "Petrichor Personal Library API"}

@app.post("/works", response_model=schemas.Work)
def create_work(work: schemas.WorkCreate, db: DatabaseManager = Depends(get_db)):
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
            return {
                "id": row[0], 
                "title": row[1], 
                "openlibrary_id": row[2] if row[2] else None,
                "cover_id": row[3] if row[3] else None
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
            works.append({
                "id": row[0], 
                "title": row[1], 
                "openlibrary_id": row[2] if row[2] else None,
                "cover_id": row[3] if row[3] else None,
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
            return {
                "id": row[0], 
                "title": row[1], 
                "openlibrary_id": row[2] if row[2] else None,
                "cover_id": row[3] if row[3] else None,
                "author": row[4] if row[4] else None
            }
        raise HTTPException(status_code=404, detail="Work not found")
    except Exception as e:
        logger.error(f"Error getting work: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.patch("/works/{work_id}", response_model=schemas.Work)
def update_work(work_id: int, cover_id: str = Body(..., embed=True), db: DatabaseManager = Depends(get_db)):
    conn = db.get_connection()
    try:
        conn.execute(
            f"MATCH (w:Work) WHERE w.id = {work_id} SET w.cover_id = $cover",
            parameters={"cover": cover_id}
        )
        # Fetch updated work
        result = conn.execute(
            f"MATCH (w:Work) WHERE w.id = {work_id} OPTIONAL MATCH (a:Author)-[:WROTE]->(w) RETURN w.id, w.title, w.openlibrary_id, w.cover_id, a.name"
        )
        if result.has_next():
            row = result.get_next()
            return {
                "id": row[0], 
                "title": row[1], 
                "openlibrary_id": row[2] if row[2] else None,
                "cover_id": row[3] if row[3] else None,
                "author": row[4] if row[4] else None
            }
        raise HTTPException(status_code=404, detail="Work not found")
    except Exception as e:
        logger.error(f"Error updating work: {e}")
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

@app.get("/search")
async def search_works(q: str = Query(..., min_length=1)):
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
                
                cover_id = doc.get("cover_i")
                if not cover_id:
                  cover_id = doc.get("cover_edition_key")

                results.append({
                    "title": doc.get("title", "Unknown Title"),
                    "author": primary_author,
                    "first_publish_year": doc.get("first_publish_year"),
                    "openlibrary_id": doc.get("key"),
                    "cover_id": str(cover_id) if cover_id else None
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
            # ol_id is already something like "/works/OL123W"
            response = await client.get(f"https://openlibrary.org{ol_id}/editions.json", params={"limit": 50})
            response.raise_for_status()
            data = response.json()
            
            # 3. Extract unique cover IDs
            covers = set()
            for entry in data.get("entries", []):
                for cid in entry.get("covers", []):
                    if cid and cid > 0:
                        covers.add(str(cid))
                
                # Check for edition keys too
                if entry.get("key") and "covers" in entry:
                    covers.add(entry.get("key").replace("/books/", ""))
            
            return list(covers)
        except Exception as e:
            logger.exception(f"Editions error: {e}")
            raise HTTPException(status_code=502, detail=str(e))

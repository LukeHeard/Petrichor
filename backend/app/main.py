from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import httpx
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

@app.get("/")
def read_root():
    return {"message": "Petrichor Personal Library API"}

@app.post("/works", response_model=schemas.Work)
def create_work(work: schemas.WorkCreate, db: DatabaseManager = Depends(get_db)):
    conn = db.get_connection()
    try:
        # Create a Work node. Using parameterized query for safety.
        result = conn.execute(
            "CREATE (w:Work {title: $title, openlibrary_id: $openlib, first_publish_year: $year}) RETURN w.id, w.title, w.openlibrary_id, w.first_publish_year",
            parameters={"title": work.title, "openlib": work.openlibrary_id or "", "year": work.first_publish_year or 0}
        )
        if result.has_next():
            row = result.get_next()
            return {
                "id": row[0], 
                "title": row[1], 
                "openlibrary_id": row[2] if row[2] else None,
                "first_publish_year": row[3]
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
        result = conn.execute("MATCH (w:Work) OPTIONAL MATCH (a:Author)-[:WROTE]->(w) RETURN w.id, w.title, w.openlibrary_id, a.name, w.first_publish_year")
        works = []
        while result.has_next():
            row = result.get_next()
            works.append({
                "id": row[0], 
                "title": row[1], 
                "openlibrary_id": row[2] if row[2] else None,
                "author": row[3] if row[3] else None,
                "first_publish_year": row[4]
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
            f"MATCH (w:Work) WHERE w.id = {work_id} OPTIONAL MATCH (a:Author)-[:WROTE]->(w) RETURN w.id, w.title, w.openlibrary_id, a.name, w.first_publish_year"
        )
        if result.has_next():
            row = result.get_next()
            return {
                "id": row[0], 
                "title": row[1], 
                "openlibrary_id": row[2] if row[2] else None,
                "author": row[3] if row[3] else None,
                "first_publish_year": row[4]
            }
        raise HTTPException(status_code=404, detail="Work not found")
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
    # Standardize our request to OpenLibrary per their API guidelines
    headers = {"User-Agent": "PetrichorLibraryApp/1.0 (test@example.com)"}
    
    async with httpx.AsyncClient(headers=headers, follow_redirects=True, timeout=30.0) as client:
        try:
            response = await client.get(
                "https://openlibrary.org/search.json",
                params={"q": q, "limit": "10", "fields": "key,title,author_name,first_publish_year"}
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
                    "openlibrary_id": doc.get("key")
                })
            return results
        except httpx.HTTPStatusError as exc:
            logger.error(f"HTTPStatusError from OpenLibrary: {exc.response.status_code} - {exc.response.text}")
            raise HTTPException(status_code=502, detail=f"OpenLibrary API returned error: {exc.response.status_code}")
        except Exception as e:
            logger.exception(f"Unexpected error fetching from OpenLibrary: {e}")
            raise HTTPException(status_code=502, detail=f"External API error: {str(e)}")

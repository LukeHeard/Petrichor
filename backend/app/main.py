from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
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
        # Create a Work node. Using Cypher's CREATE with SERIAL id handled by Kuzu.
        # Kuzu's SERIAL id can be retrieved using id(n) or similar, 
        # but let's assume we want to return the created work.
        result = conn.execute(f"CREATE (w:Work {{title: '{work.title}'}}) RETURN w.id, w.title")
        if result.has_next():
            row = result.get_next()
            return {"id": row[0], "title": row[1]}
        raise HTTPException(status_code=500, detail="Failed to create work")
    except Exception as e:
        logger.error(f"Error creating work: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/works", response_model=list[schemas.Work])
def list_works(db: DatabaseManager = Depends(get_db)):
    conn = db.get_connection()
    try:
        result = conn.execute("MATCH (w:Work) RETURN w.id, w.title")
        works = []
        while result.has_next():
            row = result.get_next()
            works.append({"id": row[0], "title": row[1]})
        return works
    except Exception as e:
        logger.error(f"Error listing works: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/works/{work_id}", response_model=schemas.Work)
def get_work(work_id: int, db: DatabaseManager = Depends(get_db)):
    conn = db.get_connection()
    try:
        result = conn.execute(f"MATCH (w:Work) WHERE w.id = {work_id} RETURN w.id, w.title")
        if result.has_next():
            row = result.get_next()
            return {"id": row[0], "title": row[1]}
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

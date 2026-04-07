from pydantic import BaseModel
from typing import Optional, List

class WorkBase(BaseModel):
    title: str
    openlibrary_id: Optional[str] = None
    first_publish_year: Optional[int] = None
    description: Optional[str] = None
    page_count: Optional[int] = None
    rating_average: Optional[float] = None
    rating_count: Optional[int] = None
    tags: List[str] = []

class WorkCreate(WorkBase):
    pass

class Work(WorkBase):
    id: int
    author: Optional[str] = None
    tags: List[str] = []

    class Config:
        from_attributes = True

class AuthorBase(BaseModel):
    name: str

class AuthorCreate(AuthorBase):
    pass

class Author(AuthorBase):
    id: int

    class Config:
        from_attributes = True

class SearchResult(BaseModel):
    title: str
    author: str
    first_publish_year: Optional[int] = None
    openlibrary_id: Optional[str] = None
    tags: List[str] = []
    page_count: Optional[int] = None
    rating_average: Optional[float] = None
    rating_count: Optional[int] = None

from pydantic import BaseModel
from typing import Optional, List

class WorkBase(BaseModel):
    title: str
    goodreads_id: Optional[str] = None
    thumbnail_url: Optional[str] = None
    first_publish_year: Optional[int] = None
    description: Optional[str] = None
    page_count: Optional[int] = None
    current_page: Optional[int] = 0
    rating_average: Optional[float] = None
    rating_count: Optional[int] = None
    personal_rating: Optional[float] = 0.0
    status: Optional[str] = "Owned"
    review: Optional[str] = ""
    personal_notes: Optional[str] = ""
    tags: List[str] = []

class WorkCreate(WorkBase):
    pass

class WorkUpdate(BaseModel):
    title: Optional[str] = None
    first_publish_year: Optional[int] = None
    description: Optional[str] = None
    personal_rating: Optional[float] = None
    status: Optional[str] = None
    current_page: Optional[int] = None
    review: Optional[str] = None
    personal_notes: Optional[str] = None
    tags: Optional[List[str]] = None

class Work(WorkBase):
    id: int
    author: Optional[str] = None
    tags: List[str] = []
    created_at: Optional[int] = None

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
    goodreads_id: Optional[str] = None
    thumbnail_url: Optional[str] = None
    tags: List[str] = []
    page_count: Optional[int] = None
    current_page: Optional[int] = 0
    rating_average: Optional[float] = None
    rating_count: Optional[int] = None

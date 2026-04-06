from pydantic import BaseModel
from typing import Optional, List

class WorkBase(BaseModel):
    title: str
    openlibrary_id: Optional[str] = None
    cover_id: Optional[str] = None
    cover_url: Optional[str] = None

class WorkCreate(WorkBase):
    pass

class Work(WorkBase):
    id: int
    author: Optional[str] = None

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
    author: Optional[str] = None
    first_publish_year: Optional[int] = None
    openlibrary_id: Optional[str] = None
    cover_id: Optional[str] = None
    cover_url: Optional[str] = None
    in_library: bool = False

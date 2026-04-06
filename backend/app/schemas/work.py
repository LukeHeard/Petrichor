from pydantic import BaseModel
from typing import Optional, List

class WorkBase(BaseModel):
    title: str
    openlibrary_id: Optional[str] = None

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

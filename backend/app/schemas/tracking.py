from pydantic import BaseModel
from typing import Optional

class ReadingSessionBase(BaseModel):
    date: str
    start_page: int
    end_page: int
    minutes_read: Optional[int] = 0

class ReadingSessionCreate(ReadingSessionBase):
    work_id: int

class ReadingSession(ReadingSessionBase):
    id: int
    work_id: int
    work_title: str
    work_thumbnail_url: Optional[str] = None

    class Config:
        from_attributes = True

class ReadingSessionUpdate(BaseModel):
    date: Optional[str] = None
    start_page: Optional[int] = None
    end_page: Optional[int] = None
    minutes_read: Optional[int] = None

class TrackingSessionResponse(BaseModel):
    sessions: list[ReadingSession]

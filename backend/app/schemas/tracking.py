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

    class Config:
        from_attributes = True

class TrackingSessionResponse(BaseModel):
    sessions: list[ReadingSession]

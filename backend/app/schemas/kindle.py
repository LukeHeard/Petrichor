from pydantic import BaseModel
from typing import Optional, List


class KindleStatus(BaseModel):
    configured: bool
    # Populated only when a sync/library call has run this session.
    connected: Optional[bool] = None
    error: Optional[str] = None


class KindleLibraryBook(BaseModel):
    asin: str
    title: str
    authors: List[str] = []
    cover_url: Optional[str] = None
    resource_type: Optional[str] = None
    origin_type: Optional[str] = None
    # id of the Petrichor Work this ASIN is linked to, if any.
    linked_work_id: Optional[int] = None


class KindleLibraryResponse(BaseModel):
    books: List[KindleLibraryBook]


class KindleLink(BaseModel):
    asin: str


class KindleSyncedBook(BaseModel):
    work_id: int
    work_title: str
    asin: str
    percentage: Optional[float] = None
    old_page: int
    new_page: int
    session_created: bool
    note: Optional[str] = None


class KindleSyncResponse(BaseModel):
    synced: List[KindleSyncedBook]
    errors: List[str] = []

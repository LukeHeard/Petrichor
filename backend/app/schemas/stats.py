from pydantic import BaseModel
from typing import List, Optional

class DailyStat(BaseModel):
    date: str
    pages: int
    minutes: int

class DistributionStat(BaseModel):
    label: str
    value: int

class CurrentWorkProgress(BaseModel):
    id: int
    title: str
    thumbnail_url: Optional[str] = None
    page_count: int
    current_page: int
    progress_percentage: float

class StatsSummary(BaseModel):
    total_books: int
    finished_books: int
    total_pages_period: int
    total_minutes_period: int
    average_rating: float

class StatsResponse(BaseModel):
    summary: StatsSummary
    daily_activity: List[DailyStat]
    tag_distribution: List[DistributionStat]
    rating_distribution: List[DistributionStat]
    currently_reading: List[CurrentWorkProgress]

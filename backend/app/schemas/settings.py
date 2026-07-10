from pydantic import BaseModel
from typing import Optional


class KindleCredentialsUpdate(BaseModel):
    cookies: str
    device_token: str


class KindleSettings(BaseModel):
    configured: bool
    # Never echo secrets back to the client; just enough to show status.
    has_cookies: bool
    has_device_token: bool
    # From env fallback vs. saved in the data volume.
    source: Optional[str] = None


class SettingsResponse(BaseModel):
    kindle: KindleSettings

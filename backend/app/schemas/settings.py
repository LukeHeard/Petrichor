from pydantic import BaseModel
from typing import Optional


class KindleCredentialsUpdate(BaseModel):
    ubid_main: str
    at_main: str
    x_main: str
    session_id: str
    device_token: str


class KindleSettings(BaseModel):
    configured: bool
    # Per-credential presence, so the form can show which fields are already
    # saved without ever echoing the secret values back.
    has_ubid_main: bool
    has_at_main: bool
    has_x_main: bool
    has_session_id: bool
    has_device_token: bool
    # 'saved' (data volume) vs 'environment' (env fallback) vs None.
    source: Optional[str] = None


class SettingsResponse(BaseModel):
    kindle: KindleSettings

"""Runtime, user-editable settings persisted to the data volume.

Unlike env vars (fixed at deploy time), these can be changed from the Settings
page at runtime. Values are stored as JSON alongside the Kuzu database so they
survive container restarts. Env vars act as fallback defaults, so an operator
can still seed credentials via docker-compose if they prefer.

This is a single-user self-hosted app, so secrets are stored in plaintext in the
private data volume - the same trust level as putting them in a .env file.
"""

import json
import logging
import os
import threading

logger = logging.getLogger(__name__)

_lock = threading.Lock()
_cache: dict | None = None

# The cookies read.amazon.com's auth requires; all four must be present for the
# integration to work. (Kept here too, not just in kindle.py, to avoid a circular
# import - settings.py is imported by kindle.py.)
REQUIRED_KINDLE_COOKIES = ("ubid-main", "at-main", "x-main", "session-id")


def _settings_path() -> str:
    explicit = os.getenv("SETTINGS_PATH")
    if explicit:
        return explicit
    # DATABASE_PATH is a directory inside the persisted volume (e.g. /app/data/kuzu);
    # drop a sibling settings.json in that same volume.
    db_path = os.getenv("DATABASE_PATH", "./data/kuzu").rstrip("/\\")
    return os.path.join(os.path.dirname(db_path) or ".", "settings.json")


def _load() -> dict:
    global _cache
    if _cache is not None:
        return _cache
    path = _settings_path()
    try:
        with open(path, "r", encoding="utf-8") as f:
            _cache = json.load(f)
    except FileNotFoundError:
        _cache = {}
    except Exception as e:
        logger.warning(f"Could not read settings file, starting empty: {e}")
        _cache = {}
    return _cache


def _save(data: dict) -> None:
    global _cache
    path = _settings_path()
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    tmp = f"{path}.tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f)
    os.replace(tmp, path)
    _cache = data


# ------------------------------------------------------------- Kindle creds

def get_kindle_credentials() -> tuple[str, str]:
    """(cookies, device_token). Stored values win; env vars are the fallback."""
    with _lock:
        data = _load().get("kindle", {})
    cookies = data.get("cookies") or os.getenv("KINDLE_COOKIES", "")
    device_token = data.get("device_token") or os.getenv("KINDLE_DEVICE_TOKEN", "")
    return cookies.strip(), device_token.strip()


def _present_cookie_names(cookie_string: str) -> set[str]:
    names = set()
    for part in cookie_string.split(";"):
        key, _, value = part.partition("=")
        if key.strip() and value.strip():
            names.add(key.strip())
    return names


def kindle_cookie_names() -> set[str]:
    """Names of the cookies currently set (from saved creds or env fallback)."""
    cookies, _ = get_kindle_credentials()
    return _present_cookie_names(cookies)


def is_kindle_configured() -> bool:
    cookies, device_token = get_kindle_credentials()
    if not device_token:
        return False
    return set(REQUIRED_KINDLE_COOKIES).issubset(_present_cookie_names(cookies))


def kindle_source() -> str | None:
    """Where the active credentials come from: 'saved', 'environment', or None."""
    with _lock:
        saved = _load().get("kindle", {})
    if saved.get("cookies") and saved.get("device_token"):
        return "saved"
    if os.getenv("KINDLE_COOKIES") and os.getenv("KINDLE_DEVICE_TOKEN"):
        return "environment"
    return None


def set_kindle_credentials(cookies: str, device_token: str) -> None:
    with _lock:
        data = _load()
        data["kindle"] = {"cookies": cookies.strip(), "device_token": device_token.strip()}
        _save(data)


def clear_kindle_credentials() -> None:
    with _lock:
        data = _load()
        data.pop("kindle", None)
        _save(data)

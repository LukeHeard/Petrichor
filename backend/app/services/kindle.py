import asyncio
import json
import logging
import os
import re
import time

from curl_cffi.requests import AsyncSession

from . import settings

logger = logging.getLogger(__name__)


def _mock_enabled() -> bool:
    """Demo mode: return canned data instead of calling Amazon.

    Lets you exercise the whole link -> sync -> ReadingSession -> streak
    pipeline with no Amazon account or device. Enable with KINDLE_MOCK=1.
    """
    return os.getenv("KINDLE_MOCK", "").strip().lower() in ("1", "true", "yes")


# Fake owned library used only when KINDLE_MOCK is on.
_MOCK_LIBRARY = [
    {"asin": "MOCK-VERNE-20K", "title": "Twenty Thousand Leagues Under the Sea",
     "authors": ["Jules Verne"], "cover_url": "", "resource_type": "EBOOK", "origin_type": "PURCHASE"},
    {"asin": "MOCK-WELLS-TM", "title": "The Time Machine",
     "authors": ["H. G. Wells"], "cover_url": "", "resource_type": "EBOOK", "origin_type": "PURCHASE"},
]
# Per-asin progress that creeps forward on each sync so repeated "Sync Now"
# clicks each produce a new session.
_MOCK_PROGRESS: dict[str, float] = {}


class KindleNotConfiguredError(Exception):
    """KINDLE_COOKIES / KINDLE_DEVICE_TOKEN env vars are missing or malformed."""


class KindleAuthError(Exception):
    """Amazon rejected the request - cookies are likely expired or invalid."""


# The four cookies from a logged-in read.amazon.com browser session that Amazon
# checks; everything else in the browser's cookie string is ignorable.
REQUIRED_COOKIES = ("ubid-main", "at-main", "x-main", "session-id")

# Book metadata comes back as JSONP: loadMetadata({...})
JSONP_RE = re.compile(r"\((\{.*\})\)", re.S)


class KindleClient:
    """Client for Kindle's private read.amazon.com API.

    Protocol (reverse-engineered from github.com/Xetera/kindle-api):
      1. GET /kindle-library/search with the browser cookies lists owned books
         and rotates session-id via Set-Cookie; the fresh session-id must be
         echoed back as the x-amzn-sessionid header afterwards.
      2. GET /service/web/register/getDeviceToken exchanges the device token
         for a deviceSessionToken, sent as the x-adp-session-token header.
         This gates the per-book endpoints.
      3. GET /service/mobile/reader/startReading returns the furthest-read
         position (a Kindle "position", not a page) plus a metadataUrl.
      4. The metadataUrl JSONP holds start/endPosition, from which
         percentage read = (startPosition + position) / endPosition.

    Amazon rejects non-browser TLS fingerprints, so requests go through
    curl_cffi's Chrome impersonation rather than httpx.
    """

    BASE_URL = "https://read.amazon.com"
    CLIENT_VERSION = "2000010"
    # Amazon session tokens are refreshed by re-running the bootstrap; do so
    # when the cached ones are older than this.
    SESSION_TTL_SECONDS = 15 * 60
    # Small delay between per-book calls; the API is unofficial and
    # hammering it risks the account getting flagged.
    THROTTLE_SECONDS = 0.5

    _session: AsyncSession | None = None
    _bootstrapped_at: float | None = None

    # ---------------------------------------------------------------- config

    @classmethod
    def is_configured(cls) -> bool:
        return _mock_enabled() or settings.is_kindle_configured()

    @staticmethod
    def _parse_cookies(cookie_string: str) -> dict[str, str]:
        jar = {}
        for part in cookie_string.split(";"):
            if "=" in part:
                key, _, value = part.partition("=")
                jar[key.strip()] = value.strip()
        missing = [c for c in REQUIRED_COOKIES if not jar.get(c)]
        if missing:
            raise KindleNotConfiguredError(
                f"KINDLE_COOKIES is missing required cookie(s): {', '.join(missing)}"
            )
        return {c: jar[c] for c in REQUIRED_COOKIES}

    # ------------------------------------------------------------- lifecycle

    @classmethod
    async def aclose(cls):
        if cls._session is not None:
            await cls._session.close()
            cls._session = None
            cls._bootstrapped_at = None

    @classmethod
    async def _bootstrap(cls) -> tuple[list[dict], str | None]:
        """(Re)authenticate and return the first library page + pagination token."""
        cookie_string, device_token = settings.get_kindle_credentials()
        if not cookie_string or not device_token:
            raise KindleNotConfiguredError(
                "Kindle credentials are not set. Add them on the Settings page "
                "(copy them from a logged-in read.amazon.com browser session)."
            )
        cookies = cls._parse_cookies(cookie_string)

        await cls.aclose()
        session = AsyncSession(
            impersonate="chrome",
            timeout=20,
            headers={"Accept-Language": "en-US,en;q=0.9"},
        )
        # Cookies go in the jar (not a raw header) so Amazon's Set-Cookie
        # rotations are picked up automatically on subsequent requests.
        for name, value in cookies.items():
            session.cookies.set(name, value, domain=".amazon.com")

        books, pagination_token = await cls._fetch_library_page(session, None)

        session_id = session.cookies.get("session-id") or cookies["session-id"]
        session.headers["x-amzn-sessionid"] = session_id

        response = await session.get(
            f"{cls.BASE_URL}/service/web/register/getDeviceToken",
            params={"serialNumber": device_token, "deviceType": device_token},
        )
        device_info = cls._expect_json(response, "device token registration")
        adp_token = device_info.get("deviceSessionToken")
        if not adp_token:
            raise KindleAuthError("Device token registration returned no deviceSessionToken")
        session.headers["x-adp-session-token"] = adp_token

        cls._session = session
        cls._bootstrapped_at = time.monotonic()
        return books, pagination_token

    @classmethod
    async def _ensure_session(cls) -> AsyncSession:
        stale = (
            cls._bootstrapped_at is None
            or time.monotonic() - cls._bootstrapped_at > cls.SESSION_TTL_SECONDS
        )
        if cls._session is None or stale:
            await cls._bootstrap()
        return cls._session

    # ------------------------------------------------------------- requests

    @staticmethod
    def _expect_json(response, context: str) -> dict:
        if response.status_code != 200:
            raise KindleAuthError(
                f"Kindle {context} returned HTTP {response.status_code} - "
                "cookies are likely expired or invalid"
            )
        try:
            return response.json()
        except Exception:
            raise KindleAuthError(
                f"Kindle {context} returned a non-JSON response - "
                "cookies are likely expired or invalid"
            )

    @classmethod
    async def _fetch_library_page(
        cls, session: AsyncSession, pagination_token: str | None
    ) -> tuple[list[dict], str | None]:
        params = {
            "query": "",
            "libraryType": "BOOKS",
            "sortType": "acquisition_desc",
            "querySize": 50,
        }
        if pagination_token:
            params["paginationToken"] = pagination_token
        response = await session.get(f"{cls.BASE_URL}/kindle-library/search", params=params)
        body = cls._expect_json(response, "library search")
        return body.get("itemsList", []), body.get("paginationToken")

    # ---------------------------------------------------------------- public

    @classmethod
    async def get_library(cls) -> list[dict]:
        """All owned books, most recently acquired first."""
        if _mock_enabled():
            return [dict(b) for b in _MOCK_LIBRARY]
        raw_books, pagination_token = await cls._bootstrap()
        while pagination_token:
            await asyncio.sleep(cls.THROTTLE_SECONDS)
            more, pagination_token = await cls._fetch_library_page(cls._session, pagination_token)
            raw_books.extend(more)
        return [cls._normalize_book(b) for b in raw_books if b.get("asin")]

    @classmethod
    async def get_progress(cls, asin: str) -> dict:
        """Furthest-read progress for one book, as reported by Whispersync."""
        if _mock_enabled():
            # Advance ~11% per sync (capped at 100) so each run logs a session.
            pct = min(100.0, _MOCK_PROGRESS.get(asin, 8.0) + 11.0)
            _MOCK_PROGRESS[asin] = pct
            return {
                "asin": asin,
                "position": int(pct * 50),
                "percentage": round(pct, 1),
                "synced_at_ms": int(time.time() * 1000),
                "device": "Mock Cloud Reader",
            }

        session = await cls._ensure_session()

        response = await session.get(
            f"{cls.BASE_URL}/service/mobile/reader/startReading",
            params={"asin": asin, "clientVersion": cls.CLIENT_VERSION},
        )
        info = cls._expect_json(response, "startReading")
        last_read = info.get("lastPageReadData") or {}
        position = last_read.get("position") or 0

        percentage = None
        metadata_url = info.get("metadataUrl")
        if metadata_url:
            meta_response = await session.get(metadata_url)
            if meta_response.status_code == 200:
                match = JSONP_RE.search(meta_response.text)
                if match:
                    try:
                        meta = json.loads(match.group(1))
                        end_position = meta.get("endPosition")
                        if end_position:
                            raw = ((meta.get("startPosition") or 0) + position) / end_position * 100
                            percentage = max(0.0, min(100.0, round(raw, 1)))
                    except (ValueError, TypeError) as e:
                        logger.warning(f"Kindle metadata parse failed for {asin}: {e}")

        return {
            "asin": asin,
            "position": position,
            "percentage": percentage,
            "synced_at_ms": last_read.get("syncTime"),
            "device": last_read.get("deviceName"),
        }

    # --------------------------------------------------------------- helpers

    @staticmethod
    def _normalize_book(raw: dict) -> dict:
        return {
            "asin": raw["asin"],
            "title": raw.get("title", ""),
            "authors": KindleClient._normalize_authors(raw.get("authors") or []),
            # productUrl is actually the cover image; strip the thumbnail size
            # suffix to get the full-resolution version.
            "cover_url": re.sub(r"\._SY\d+_\.", ".", raw.get("productUrl") or ""),
            "resource_type": raw.get("resourceType", ""),
            "origin_type": raw.get("originType", ""),
        }

    @staticmethod
    def _normalize_authors(raw_authors: list[str]) -> list[str]:
        """Kindle packs all authors into one ':'-delimited 'Last, First' string."""
        if not raw_authors:
            return []
        names = []
        for chunk in raw_authors[0].split(":"):
            chunk = chunk.strip()
            if not chunk:
                continue
            last, _, first = chunk.partition(",")
            name = f"{first.strip()} {last.strip()}".strip() if first.strip() else last.strip()
            if name and name not in names:
                names.append(name)
        return names

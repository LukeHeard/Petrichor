"""Smoke test the Goodreads scraper against the live goodreads.com site.

Goodreads' HTML/JSON structure can change without notice, silently breaking
GoodreadsScraper. This script exercises the real search and detail-fetch
paths and exits non-zero if either stops returning usable data, so it can
be run on a schedule (see .github/workflows/goodreads-scraper-check.yml).
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services.goodreads import GoodreadsScraper

# Pride and Prejudice - a stable, long-lived Goodreads page unlikely to be
# removed or restructured, used as the canary for the detail-fetch path.
KNOWN_BOOK_ID = "1885"
KNOWN_BOOK_TITLE_WORD = "prejudice"


async def check_search():
    results = await GoodreadsScraper.search("Dune")
    if not results:
        raise AssertionError("search() returned no results for 'Dune'")

    first = results[0]
    for field in ("goodreads_id", "title", "author"):
        if not first.get(field):
            raise AssertionError(f"search() result missing '{field}': {first}")

    print(f"[OK] search(): {len(results)} results, first = {first['title']!r} by {first['author']!r}")


async def check_details():
    details = await GoodreadsScraper.get_details(KNOWN_BOOK_ID)
    if not details:
        raise AssertionError(f"get_details({KNOWN_BOOK_ID!r}) returned None")

    title = details.get("title", "")
    if KNOWN_BOOK_TITLE_WORD not in title.lower():
        raise AssertionError(f"get_details({KNOWN_BOOK_ID!r}) title looks wrong: {title!r}")

    if details.get("author", "Unknown") == "Unknown":
        raise AssertionError(f"get_details({KNOWN_BOOK_ID!r}) failed to parse author: {details}")

    if not details.get("rating_average"):
        raise AssertionError(f"get_details({KNOWN_BOOK_ID!r}) failed to parse rating: {details}")

    print(f"[OK] get_details(): {title!r} by {details['author']!r}, rating {details['rating_average']}")


async def main():
    try:
        await check_search()
        await check_details()
    finally:
        await GoodreadsScraper.aclose()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except AssertionError as e:
        print(f"[FAIL] {e}", file=sys.stderr)
        sys.exit(1)
    print("Goodreads scraper check passed.")

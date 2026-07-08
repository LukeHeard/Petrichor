import httpx
import re
import json
import logging
import asyncio
import datetime

logger = logging.getLogger(__name__)

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

def clean_gr_image_url(url: str) -> str:
    if not url:
        return ""
    # Remove size suffixes like ._SY75_, ._SX50_, ._UX200_, etc.
    # Pattern: ._S[YX]\d+_ or ._U[X]\d+_
    cleaned = re.sub(r'\._S[YX]\d+_', '', url)
    cleaned = re.sub(r'\._U[X]\d+_', '', cleaned)
    # Also handle // to https://
    if cleaned.startswith("//"):
        cleaned = "https:" + cleaned
    return cleaned

class GoodreadsScraper:
    BASE_URL = "https://www.goodreads.com"
    _client = None

    @classmethod
    def _get_client(cls) -> httpx.AsyncClient:
        # A shared, kept-alive client avoids paying a fresh TCP+TLS handshake
        # to www.goodreads.com on every single search/enrich call.
        if cls._client is None:
            cls._client = httpx.AsyncClient(
                headers={
                    "User-Agent": USER_AGENT,
                    "Accept-Language": "en-US,en;q=0.9",
                },
                limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
                timeout=15,
            )
        return cls._client

    @classmethod
    async def aclose(cls):
        if cls._client is not None:
            await cls._client.aclose()
            cls._client = None

    @classmethod
    async def _fetch(cls, url: str):
        client = cls._get_client()
        headers = {"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8"}
        max_retries = 3
        for i in range(max_retries):
            try:
                res = await client.get(url, headers=headers)
                if res.status_code == 200:
                    return res.text
                if res.status_code == 503:
                    logger.warning(f"Goodreads 503 (Throttled), retrying... ({i+1}/{max_retries})")
                    await asyncio.sleep(2 * (i + 1))
                    continue
                logger.warning(f"Goodreads fetch failed: {res.status_code} for {url}")
                break
            except Exception as e:
                logger.error(f"Goodreads fetch error: {e}")
                break
        return None

    @classmethod
    async def _search_fetch(cls, query: str):
        client = cls._get_client()
        try:
            res = await client.get(
                f"{cls.BASE_URL}/book/auto_complete",
                params={"format": "json", "q": query},
                headers={"Accept": "application/json"},
            )
        except Exception as e:
            logger.error(f"Goodreads autocomplete error: {e}")
            return []
        if res.status_code != 200:
            logger.warning(f"Goodreads autocomplete failed: {res.status_code} for query '{query}'")
            return []
        try:
            return res.json()
        except ValueError:
            return []

    @classmethod
    async def search(cls, query: str, limit: int = 10):
        """Search Goodreads via its book/auto_complete JSON endpoint.

        Goodreads' HTML /search page is now gated behind an AWS WAF JS
        challenge that a plain HTTP client can't pass, but this undocumented
        autocomplete endpoint (used to power the on-site search box) returns
        the same underlying data as clean JSON and isn't behind the WAF.
        """
        items = await cls._search_fetch(query)

        results = []
        for item in items[:limit]:
            title = item.get("title", "") or item.get("bookTitleBare", "")
            clean_title = re.sub(r'\(.*?\)', '', title).strip()

            series_name = ""
            series_match = re.search(r'\(([^,)]+),\s*(?:#|Book\s+)\d', title, re.IGNORECASE)
            if series_match:
                series_name = series_match.group(1).strip()

            try:
                rating_average = float(item.get("avgRating") or 0.0)
            except (TypeError, ValueError):
                rating_average = 0.0

            results.append({
                "goodreads_id": str(item.get("bookId", "")),
                "title": clean_title,
                "author": (item.get("author") or {}).get("name", "Unknown"),
                "rating_average": rating_average,
                "rating_count": item.get("ratingsCount", 0) or 0,
                "thumbnail_url": clean_gr_image_url(item.get("imageUrl", "")),
                "first_publish_year": 0,
                "series": series_name
            })

        return results

    @classmethod
    async def get_details(cls, gr_id: str):
        """Fetch book details from __NEXT_DATA__."""
        url = f"{cls.BASE_URL}/book/show/{gr_id}"
        html = await cls._fetch(url)
        if not html:
            return None

        match = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', html, re.DOTALL)
        if not match:
            return None

        try:
            data = json.loads(match.group(1))
            apollo = data.get('props', {}).get('pageProps', {}).get('apolloState', {})
            
            # Try to find the book matching the ID
            book_key = next((k for k in apollo.keys() if k.startswith("Book:") and str(apollo[k].get("legacyId")) == gr_id), None)
            if not book_key:
                # Fallback to first Book key
                book_key = next((k for k in apollo.keys() if k.startswith("Book:")), None)
            
            if not book_key:
                return None
            
            book_data = apollo[book_key]
            
            # Title
            title = book_data.get("title", "")
            
            # Description
            description = ""
            desc_field = book_data.get("description")
            
            # Preserve some formatting tags instead of stripping everything
            if desc_field:
                html_content = ""
                if isinstance(desc_field, dict) and "__ref" in desc_field:
                    html_content = apollo.get(desc_field["__ref"], {}).get("html", "")
                elif isinstance(desc_field, str):
                    html_content = desc_field
                
                if html_content:
                    # Whitelist tags: b, i, em, strong, p, br
                    allowed = ["b", "i", "em", "strong", "p", "br"]
                    # Regex to match tags
                    tag_pattern = re.compile(r'</?([a-z1-6]+).*?>', re.IGNORECASE)
                    
                    def filter_tags(match):
                        tag = match.group(1).lower()
                        if tag in allowed:
                            closing = "/" if match.group(0).startswith("</") else ""
                            return f"<{closing}{tag}>"
                        return ""
                    
                    description = tag_pattern.sub(filter_tags, html_content)

            # Stats (Ratings) - Located in the Work object
            avg_rating = 0.0
            rating_count = 0
            work_ref = book_data.get("work", {}).get("__ref")
            if work_ref:
                work_data = apollo.get(work_ref, {})
                stats_field = work_data.get("stats")
                if isinstance(stats_field, dict):
                    if "__ref" in stats_field:
                        stats_obj = apollo.get(stats_field["__ref"], {})
                    else:
                        stats_obj = stats_field
                    avg_rating = stats_obj.get("averageRating", 0.0)
                    rating_count = stats_obj.get("ratingsCount", 0)

            # Authors
            authors_list = "Unknown"
            author_goodreads_id = None
            contrib_field = book_data.get("primaryContributorEdge")
            if isinstance(contrib_field, dict):
                 edge = contrib_field
                 if "__ref" in contrib_field:
                    edge = apollo.get(contrib_field["__ref"], {})
                 node_ref = edge.get("node", {}).get("__ref", "")
                 node = apollo.get(node_ref, {})
                 authors_list = node.get("name", "Unknown")
                 author_goodreads_id = node.get("legacyId")

            # Image
            thumbnail = clean_gr_image_url(book_data.get("imageUrl", ""))

            # Tags (Genres & Themes)
            tags = []

            # 1. Try bookGenres first (curated by Goodreads)
            genres_list = book_data.get("bookGenres", [])
            for genre_edge in genres_list:
                genre_node = genre_edge.get("genre", {})
                genre_name = None
                
                if "__ref" in genre_node:
                    genre_data = apollo.get(genre_node["__ref"], {})
                    genre_name = genre_data.get("name")
                else:
                    genre_name = genre_node.get("name")
                
                if genre_name:
                    tags.append(genre_name)

            # 2. Also check popularShelves for more variety (themes, etc.)
            if work_ref:
                work_data = apollo.get(work_ref, {})
                shelves_list = work_data.get("popularShelves", [])
                for shelf_item in shelves_list:
                    shelf_name = None
                    if "__ref" in shelf_item:
                        shelf_data = apollo.get(shelf_item["__ref"], {})
                        shelf_name = shelf_data.get("name")
                    else:
                        shelf_name = shelf_item.get("name")
                        
                    if shelf_name:
                        tags.append(shelf_name)
            
            # 3. Filtering and deduplication
            ignore_tags = {
                "to-read", "currently-reading", "read", "books-i-own", "favorites", "owned", "default", 
                "adult", "book-club", "gave-up-on", "library", "audiobook", "abandoned", "audio",
                "kindle", "ebook", "e-book", "paperback", "hardcover", "series", "to-buy", "re-read",
                "reread", "dnf", "did-not-finish", "standalone", "novella", "novel", "borrowed",
                "own-it", "all-time-favorites", "physical-copy", "wish-list", "half-price-books",
                "friendship", "science-fiction-fantasy"
            }
            
            cleaned_tags = []
            seen_words = set()
            
            # Standardize for comparison
            def std(s): return s.lower().replace(" ", "-").replace("_", "-")
            def get_words(s): return set(re.findall(r'[a-z0-9]+', s.lower()))
            
            # Sort by length so we process shorter, more fundamental tags first
            sorted_tags = sorted(list(dict.fromkeys(tags)), key=len)
            
            for t in sorted_tags:
                s_t = std(t)
                if s_t in ignore_tags:
                    continue
                
                t_words = get_words(t)
                if not t_words:
                    continue
                    
                # If these words are already fully covered by the union of previously accepted tags, 
                # this tag is likely a redundant combination (e.g. "Science Fiction Fantasy").
                if t_words.issubset(seen_words):
                    continue
                
                cleaned_tags.append(t)
                seen_words.update(t_words)
            
            # Re-sort to original order or just keep the 8 most relevant ones
            # bookGenres are usually first and most relevant, so let's preserve that preference if possible
            # But the 'length' sort was useful for redundancy. 
            # I'll re-filter based on the original list but checking against our finalized set.
            final_tags = [t for t in tags if t in cleaned_tags]
            tags = final_tags

            # Series
            # Each bookSeries entry is {"__typename": "BookSeries", "userPosition": ...,
            # "series": {"__ref": "Series:..."}} - the ref is nested under "series",
            # not on the BookSeries item itself.
            series_name = ""
            series_url = ""
            book_series_list = book_data.get("bookSeries", [])
            if isinstance(book_series_list, list):
                for bs_item in book_series_list:
                    if not isinstance(bs_item, dict):
                        continue
                    series_ref_field = bs_item.get("series", {})
                    series_ref = series_ref_field.get("__ref", "") if isinstance(series_ref_field, dict) else ""
                    if not series_ref:
                        continue
                    series_data = apollo.get(series_ref, {})
                    s_title = series_data.get("title")
                    if s_title:
                        series_name = s_title
                        series_url = series_data.get("webUrl", "")
                        break

            # Fallback: extract series from the raw title parenthetical
            if not series_name and title:
                title_series_match = re.search(r'\(([^,)]+),\s*(?:#|Book\s+)\d', title, re.IGNORECASE)
                if title_series_match:
                    series_name = title_series_match.group(1).strip()

            # Year and Page Count
            publish_year = 0
            page_count = book_data.get("numPages") or book_data.get("numberOfPages") or 0
            
            details_field = book_data.get("details")
            if isinstance(details_field, dict):
                if "__ref" in details_field:
                    details_obj = apollo.get(details_field["__ref"], {})
                else:
                    details_obj = details_field
                
                if not page_count:
                    page_count = details_obj.get("numPages") or details_obj.get("numberOfPages") or 0
                
            # Prefer the canonical Work's original publish year (the FRBR "Work" level,
            # shared across every edition) over this specific edition's publicationTime.
            # Goodreads often defaults to a reprint/reissue edition (e.g. a whole series
            # re-released for a movie tie-in), whose publicationTime reflects the reprint
            # date rather than when the work was actually first published. Despite the name,
            # WorkDetails has no "publicationYear" field - it's "publicationTime" (a ms
            # timestamp) just like the edition-level details, including for pre-1970 dates.
            if work_ref:
                work_details_field = apollo.get(work_ref, {}).get("details")
                if isinstance(work_details_field, dict):
                    # This may be a normalized {"__ref": ...} pointer, or the WorkDetails
                    # object embedded inline - Goodreads' Apollo cache uses both shapes.
                    if "__ref" in work_details_field:
                        work_details = apollo.get(work_details_field["__ref"], {})
                    else:
                        work_details = work_details_field
                    work_pub_time = work_details.get("publicationTime")
                    if work_pub_time is not None:
                        try:
                            publish_year = datetime.datetime.fromtimestamp(work_pub_time / 1000).year
                        except:
                            pass

            # Fallback to this edition's publicationTime if the work-level year isn't available
            if not publish_year and isinstance(details_field, dict):
                pub_time = details_obj.get("publicationTime")
                if pub_time:
                    try:
                        # publicationTime is ms since epoch
                        publish_year = datetime.datetime.fromtimestamp(pub_time/1000).year
                    except:
                        pass

            return {
                "goodreads_id": gr_id,
                "title": title,
                "author": authors_list,
                "description": description,
                "thumbnail_url": thumbnail,
                "rating_average": avg_rating,
                "rating_count": rating_count,
                "tags": list(dict.fromkeys(tags))[:8],
                "page_count": page_count,
                "first_publish_year": publish_year,
                "series": series_name,
                "series_url": series_url,
                "author_goodreads_id": author_goodreads_id
            }

        except Exception as e:
            logger.error(f"Error parsing Goodreads NEXT_DATA: {e}")

        return None

    @classmethod
    async def get_author_books(cls, author_goodreads_id, limit: int = 30):
        """Scrape an author's Goodreads "list" page for their full bibliography.

        The /book/auto_complete search endpoint is fuzzy-matched against whatever
        query text is passed in and frequently only surfaces a handful of an
        author's books (and inconsistently at that) - this legacy server-rendered
        listing page instead gives a complete, ordered bibliography in one request.
        """
        url = f"{cls.BASE_URL}/author/list/{author_goodreads_id}"
        html = await cls._fetch(url)
        if not html:
            return []

        results = []
        for row_match in re.finditer(r'<tr itemscope itemtype="http://schema\.org/Book">(.*?)</tr>', html, re.DOTALL):
            row = row_match.group(1)

            id_match = re.search(r'/book/show/(\d+)-', row)
            if not id_match:
                continue

            title_match = re.search(r"""itemprop=['"]name['"]\s+role=['"]heading['"][^>]*>([^<]+)<""", row)
            if not title_match:
                continue
            raw_title = title_match.group(1).strip()
            clean_title = re.sub(r'\(.*?\)', '', raw_title).strip()

            series_match = re.search(r'\(([^,)]+),\s*(?:#|Book\s+)\d', raw_title, re.IGNORECASE)

            author_match = re.search(r'class="authorName"[^>]*>\s*<span itemprop="name">([^<]+)<', row)
            rating_match = re.search(r'([\d.]+)\s*avg rating', row)
            count_match = re.search(r'avg rating\s*&mdash;\s*([\d,]+)\s*rating', row)
            year_match = re.search(r'published\s*(\d{4})', row)
            thumb_match = re.search(r'class="bookCover"[^>]*src="([^"]+)"', row)

            results.append({
                "goodreads_id": id_match.group(1),
                "title": clean_title,
                "author": author_match.group(1).strip() if author_match else "Unknown",
                "rating_average": float(rating_match.group(1)) if rating_match else 0.0,
                "rating_count": int(count_match.group(1).replace(",", "")) if count_match else 0,
                "thumbnail_url": clean_gr_image_url(thumb_match.group(1)) if thumb_match else "",
                "first_publish_year": int(year_match.group(1)) if year_match else 0,
                "series": series_match.group(1).strip() if series_match else ""
            })
            if len(results) >= limit:
                break

        return results

    @classmethod
    async def get_series_books(cls, series_url: str, series_name: str = "", limit: int = 30):
        """Scrape a series' Goodreads page for its complete book list.

        Sequel titles frequently don't carry a "(Series, #N)" annotation on their own
        book page, so the fuzzy autocomplete search's series-field detection misses
        them - the series page itself lists every entry directly, in reading order.
        """
        html = await cls._fetch(series_url)
        if not html:
            return []

        title_pattern = re.compile(
            r'<a class="gr-h3 gr-h3--serif gr-h3--noMargin" href="/book/show/(\d+)-[^"]*" itemprop="url"[^>]*>\s*'
            r'<span itemprop="name"[^>]*>([^<]+)</span>'
        )
        matches = list(title_pattern.finditer(html))

        results = []
        for i, m in enumerate(matches[:limit]):
            goodreads_id, title = m.group(1), m.group(2).strip()
            window_end = matches[i + 1].start() if i + 1 < len(matches) else min(len(html), m.end() + 2000)
            chunk = html[m.end():window_end]
            preceding = html[max(0, m.start() - 800):m.start()]

            author_match = re.search(r'itemprop="author"[\s\S]*?<a itemprop="url"[^>]*>([^<]+)<', chunk)
            rating_match = re.search(r'Rated ([\d.]+) of 5', chunk)
            count_match = re.search(r'>([\d,]+)</span><span[^>]*>\s*Ratings</span>', chunk)
            thumb_match = re.search(r'<img src="([^"]+)"', preceding)

            results.append({
                "goodreads_id": goodreads_id,
                "title": title,
                "author": author_match.group(1).strip() if author_match else "Unknown",
                "rating_average": float(rating_match.group(1)) if rating_match else 0.0,
                "rating_count": int(count_match.group(1).replace(",", "")) if count_match else 0,
                "thumbnail_url": clean_gr_image_url(thumb_match.group(1)) if thumb_match else "",
                "first_publish_year": 0,
                "series": series_name
            })

        return results

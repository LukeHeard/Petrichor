import requests
import re
import json
import logging
import urllib.parse
from concurrent.futures import ThreadPoolExecutor
import asyncio

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
    _executor = ThreadPoolExecutor(max_workers=5)

    @classmethod
    def _fetch_sync(cls, url: str):
        headers = {
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        }
        max_retries = 3
        for i in range(max_retries):
            try:
                res = requests.get(url, headers=headers, timeout=15)
                if res.status_code == 200:
                    return res.text
                if res.status_code == 503:
                    import time
                    logger.warning(f"Goodreads 503 (Throttled), retrying... ({i+1}/{max_retries})")
                    time.sleep(2 * (i + 1))
                    continue
                logger.warning(f"Goodreads fetch failed: {res.status_code} for {url}")
                break
            except Exception as e:
                logger.error(f"Goodreads fetch error: {e}")
                break
        return None

    @classmethod
    async def _fetch(cls, url: str):
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(cls._executor, cls._fetch_sync, url)

    @classmethod
    async def search(cls, query: str):
        """Search Goodreads and return list of results."""
        encoded_query = urllib.parse.quote(query)
        url = f"{cls.BASE_URL}/search?q={encoded_query}"
        html = await cls._fetch(url)
        if not html:
            return []

        results = []
        # Find book rows.
        matches = list(re.finditer(r'<a class="bookTitle" itemprop="url" href="/book/show/(\d+)[^"]*">.*?<span itemprop=\'name\' role=\'heading\' aria-level=\'4\'>(.*?)</span>', html, re.DOTALL))
        
        # Author
        author_matches = list(re.finditer(r'<a class="authorName" itemprop="url" href="[^"]*"><span itemprop="name">(.*?)</span></a>', html))
        
        # Minirating
        rating_matches = list(re.finditer(r'<span class="minirating">.*?([\d\.]+) avg rating &mdash; ([\d,]+) ratings</span>', html))

        # Images
        image_matches = list(re.finditer(r'<img.*?src="([^"]*)"', html))
        images = [m.group(1) for m in image_matches if "/books/" in m.group(1) or "/nophoto/" in m.group(1)]

        # Year
        year_matches = list(re.finditer(r'published\s+(\d{4})', html))

        for i, match in enumerate(matches):
            if i >= 10: break
            gr_id = match.group(1)
            title = match.group(2).strip()
            clean_title = re.sub(r'\(.*?\)', '', title).strip()

            results.append({
                "goodreads_id": gr_id,
                "title": clean_title,
                "author": author_matches[i].group(1) if i < len(author_matches) else "Unknown",
                "rating_average": float(rating_matches[i].group(1)) if i < len(rating_matches) else 0.0,
                "rating_count": int(rating_matches[i].group(2).replace(",", "")) if i < len(rating_matches) else 0,
                "thumbnail_url": clean_gr_image_url(images[i]) if i < len(images) else "",
                "first_publish_year": int(year_matches[i].group(1)) if i < len(year_matches) else 0
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
            if isinstance(desc_field, dict) and "__ref" in desc_field:
                 desc_obj = apollo.get(desc_field["__ref"], {})
                 description = desc_obj.get("html", "")
            elif isinstance(desc_field, str):
                 description = desc_field
            description = re.sub(r'<.*?>', '', description) if description else ""

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
            contrib_field = book_data.get("primaryContributorEdge")
            if isinstance(contrib_field, dict):
                 edge = contrib_field
                 if "__ref" in contrib_field:
                    edge = apollo.get(contrib_field["__ref"], {})
                 node_ref = edge.get("node", {}).get("__ref", "")
                 node = apollo.get(node_ref, {})
                 authors_list = node.get("name", "Unknown")

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
                "own-it", "all-time-favorites", "physical-copy", "wish-list", "half-price-books"
            }
            
            cleaned_tags = []
            seen = set()
            # Standardize for comparison
            def std(s): return s.lower().replace(" ", "-").replace("_", "-")
            
            for t in tags:
                s_t = std(t)
                if s_t not in ignore_tags and s_t not in seen:
                    cleaned_tags.append(t)
                    seen.add(s_t)
            
            tags = cleaned_tags

            # Year
            publish_year = 0
            details_field = book_data.get("details")
            if isinstance(details_field, dict):
                if "__ref" in details_field:
                    details_obj = apollo.get(details_field["__ref"], {})
                else:
                    details_obj = details_field
                
                # Try numPages here too just in case
                page_count = details_obj.get("numPages", 0)
                
                # Extract year from publicationTime (timestamp in ms)
                pub_time = details_obj.get("publicationTime")
                if pub_time:
                    try:
                        # publicationTime is ms since epoch
                        import datetime
                        publish_year = datetime.datetime.fromtimestamp(pub_time/1000).year
                    except:
                        pass
            
            # Fallback to work publish year if available
            if not publish_year and work_ref:
                work_details_ref = apollo.get(work_ref, {}).get("details", {}).get("__ref")
                if work_details_ref:
                    work_details = apollo.get(work_details_ref, {})
                    publish_year = work_details.get("publicationYear", 0)

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
                "first_publish_year": publish_year
            }

        except Exception as e:
            logger.error(f"Error parsing Goodreads NEXT_DATA: {e}")
            
        return None

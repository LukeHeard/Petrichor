import httpx
import json

async def test_search():
    url = "https://openlibrary.org/search.json"
    params = {
        "q": "red rising",
        "limit": "20",
        "fields": "key,title,author_name,series"
    }
    async with httpx.AsyncClient() as client:
        res = await client.get(url, params=params)
        data = res.json()
        with open("/home/hekul/Petrichor/scratch/red_rising_search.json", "w") as f:
            json.dump(data, f, indent=2)

if __name__ == "__main__":
    import asyncio
    asyncio.run(test_search())

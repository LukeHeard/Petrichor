import os
from app.db import DatabaseManager

db = DatabaseManager()
conn = db.get_connection()

print("--- ALL WORKS WITH STATUS 'Reading' ---")
res = conn.execute("MATCH (w:Work) WHERE w.status = 'Reading' RETURN w.id, w.title, w.status, w.page_count, w.current_page")
while res.has_next():
    print(res.get_next())

print("\n--- ALL WORKS (TOP 5) ---")
res = conn.execute("MATCH (w:Work) RETURN w.id, w.title, w.status LIMIT 5")
while res.has_next():
    print(res.get_next())

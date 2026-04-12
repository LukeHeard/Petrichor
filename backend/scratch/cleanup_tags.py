import logging
from app.db import DatabaseManager

# Simple script to delete specific tags and their relationships
def cleanup_tags():
    db = DatabaseManager()
    conn = db.get_connection()
    
    tags_to_delete = ["Friendship", "Science Fiction Fantasy"]
    
    for tag_name in tags_to_delete:
        print(f"Deleting tag: {tag_name}")
        # Delete relationships and the tag node itself
        conn.execute("MATCH (t:Tag {name: $name}) DETACH DELETE t", {"name": tag_name})
    
    print("Cleanup complete.")

if __name__ == "__main__":
    cleanup_tags()

import kuzu
import os
import time

def merge_authors():
    db_path = os.getenv("DATABASE_PATH", "../data/kuzu")
    print(f"Connecting to KuzuDB at {db_path}...")
    db = kuzu.Database(db_path)
    conn = kuzu.Connection(db)
    
    print("Finding duplicate authors...")
    
    # 1. Find Author names with more than 1 node
    query_duplicates = """
    MATCH (a:Author)
    RETURN a.name, count(a) AS c, collect(a.id)
    ORDER BY c DESC
    """
    res = conn.execute(query_duplicates)
    
    duplicates = []
    while res.has_next():
        row = res.get_next()
        name, count, ids = row[0], row[1], row[2]
        if count > 1:
            duplicates.append((name, ids))
            
    if not duplicates:
        print("No duplicate authors found!")
        return

    print(f"Found {len(duplicates)} authors with duplicate nodes.")
    
    total_merged = 0
    total_deleted = 0
    
    for name, ids in duplicates:
        # Sort IDs to keep the oldest/smallest ID as the primary
        ids.sort()
        primary_id = ids[0]
        duplicate_ids = ids[1:]
        
        print(f"Merging duplicates for '{name}' into Author ID {primary_id}...")
        
        for dup_id in duplicate_ids:
            # Re-link Works: WROTE
            # Find all works the duplicate wrote
            works_query = f"MATCH (dup:Author)-[r:WROTE]->(w:Work) WHERE dup.id = {dup_id} RETURN w.id"
            works_res = conn.execute(works_query)
            works_to_relink = []
            while works_res.has_next():
                works_to_relink.append(works_res.get_next()[0])
                
            for work_id in works_to_relink:
                # Create relation from primary to the work
                conn.execute(f"MATCH (p:Author), (w:Work) WHERE p.id = {primary_id} AND w.id = {work_id} MERGE (p)-[:WROTE]->(w)")
                
                # Delete relation from duplicate
                conn.execute(f"MATCH (dup:Author)-[r:WROTE]->(w:Work) WHERE dup.id = {dup_id} AND w.id = {work_id} DELETE r")
            
            # Delete duplicate node
            conn.execute(f"MATCH (dup:Author) WHERE dup.id = {dup_id} DELETE dup")
            
            total_merged += len(works_to_relink)
            total_deleted += 1

    print(f"Cleanup complete! Relinked {total_merged} works and deleted {total_deleted} duplicate Author nodes.")

if __name__ == "__main__":
    merge_authors()

import kuzu
import os
import logging

logger = logging.getLogger(__name__)

class DatabaseManager:
    def __init__(self):
        db_path = os.getenv("DATABASE_PATH", "./data/kuzu")
        # Ensure directory exists
        os.makedirs(db_path, exist_ok=True)
        self.db = kuzu.Database(db_path)
        self.conn = kuzu.Connection(self.db)
        self._init_schema()

    def _init_schema(self):
        """Initialize the FRBR schema if it doesn't exist."""
        try:
            # Check existing tables
            res = self.conn.execute("CALL SHOW_TABLES() RETURN name")
            existing_tables = []
            while res.has_next():
                existing_tables.append(res.get_next()[0])

            # Node Tables
            node_tables = {
                "Work": "CREATE NODE TABLE Work(id SERIAL, title STRING, goodreads_id STRING, thumbnail_url STRING, first_publish_year INT64, description STRING, page_count INT64, rating_average DOUBLE, rating_count INT64, personal_rating DOUBLE, status STRING, review STRING, personal_notes STRING, created_at INT64, PRIMARY KEY(id))",
                "Tag": "CREATE NODE TABLE Tag(id SERIAL, name STRING, PRIMARY KEY(id))",
                "Author": "CREATE NODE TABLE Author(id SERIAL, name STRING, PRIMARY KEY(id))",
                "Expression": "CREATE NODE TABLE Expression(id SERIAL, language STRING, content_type STRING, PRIMARY KEY(id))",
                "Manifestation": "CREATE NODE TABLE Manifestation(id SERIAL, publisher STRING, format STRING, isbn STRING, PRIMARY KEY(id))",
                "Item": "CREATE NODE TABLE Item(id SERIAL, barcode STRING, status STRING, PRIMARY KEY(id))"
            }
            
            for table_name, create_stmt in node_tables.items():
                if table_name not in existing_tables:
                    self.conn.execute(create_stmt)
                    logger.info(f"Created node table {table_name}")

            # Relationship Tables
            rel_tables = {
                "HAS_TAG": "CREATE REL TABLE HAS_TAG(FROM Work TO Tag)",
                "WROTE": "CREATE REL TABLE WROTE(FROM Author TO Work)",
                "IS_REALIZED_BY": "CREATE REL TABLE IS_REALIZED_BY(FROM Work TO Expression)",
                "IS_EMBODIED_IN": "CREATE REL TABLE IS_EMBODIED_IN(FROM Expression TO Manifestation)",
                "IS_EXEMPLIFIED_BY": "CREATE REL TABLE IS_EXEMPLIFIED_BY(FROM Manifestation TO Item)"
            }

            for table_name, create_stmt in rel_tables.items():
                if table_name not in existing_tables:
                    self.conn.execute(create_stmt)
                    logger.info(f"Created relationship table {table_name}")
            

            # Additional columns check (for any future-proofing)
            res = self.conn.execute("CALL TABLE_INFO('Work') RETURN *")
            cols = []
            while res.has_next():
                row = res.get_next()
                cols.append(row[1])
            
            new_cols = {
                "thumbnail_url": "STRING",
                "goodreads_id": "STRING"
            }
            
            for col_name, col_type in new_cols.items():
                if col_name not in cols:
                    try:
                        self.conn.execute(f"ALTER TABLE Work ADD {col_name} {col_type} DEFAULT ''")
                        logger.info(f"Added {col_name} to Work table")
                    except Exception as e:
                        logger.error(f"Failed to add column {col_name}: {e}")

            logger.info("Schema initialization complete.")
        except Exception as e:
            logger.error(f"Error initializing schema: {e}")

    def get_connection(self):
        return kuzu.Connection(self.db)

db_manager = None

def get_db():
    global db_manager
    if db_manager is None:
        db_manager = DatabaseManager()
    return db_manager

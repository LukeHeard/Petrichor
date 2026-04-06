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
        """Initialize the FRBR schema with column detection and auto-reset."""
        try:
            # 1. Sanity check: verify if the 'cover_id' column exists.
            # We do this by attempting a MATCH query on Work table.
            # If the Work table doesn't exist at all, this will fail with a different error.
            self.conn.execute("MATCH (w:Work) RETURN w.cover_id LIMIT 1")
            logger.info("Schema integrity check passed: 'cover_id' exists.")
        except Exception as e:
            msg = str(e).lower()
            # If the table exists but doesn't have the column, we'll get a Binder exception.
            # If the table doesn't exist, we'll get a 'Table Work does not exist' or similar.
            
            if "binder exception" in msg and "cover_id" in msg:
                logger.warning("Detected outdated schema: 'cover_id' property missing in Work table. Resetting database...")
                self._force_full_reset()
                return # Base reset takes care of creation
            elif "does not exist" in msg or "not found" in msg or "no table found" in msg:
                # If table just doesn't exist, proceed to create
                self._create_tables()
            else:
                # If something else happened, log it and try creating anyway
                logger.info(f"Schema check returned unexpected result: {e}. Attempting initial creation.")
                self._create_tables()

    def _force_full_reset(self):
        """Drops all tables and recreates them from scratch."""
        tables_to_drop = ["WROTE", "IS_REALIZED_BY", "IS_EMBODIED_IN", "IS_EXEMPLIFIED_BY", 
                          "Work", "Author", "Expression", "Manifestation", "Item"]
        for table in tables_to_drop:
            try:
                # Kuzu doesn't support DROP TABLE IF EXISTS yet? Let's try...
                self.conn.execute(f"DROP TABLE {table}")
            except:
                pass
        
        self._create_tables()

    def _create_tables(self):
        """Creates the initial tables for the FRBR schema."""
        try:
            # Node Tables
            self.conn.execute("CREATE NODE TABLE Work(id SERIAL, title STRING, openlibrary_id STRING, cover_id STRING, PRIMARY KEY(id))")
            self.conn.execute("CREATE NODE TABLE Author(id SERIAL, name STRING, PRIMARY KEY(id))")
            self.conn.execute("CREATE NODE TABLE Expression(id SERIAL, language STRING, content_type STRING, PRIMARY KEY(id))")
            self.conn.execute("CREATE NODE TABLE Manifestation(id SERIAL, publisher STRING, format STRING, isbn STRING, PRIMARY KEY(id))")
            self.conn.execute("CREATE NODE TABLE Item(id SERIAL, barcode STRING, status STRING, PRIMARY KEY(id))")
            
            # Relationship Tables
            self.conn.execute("CREATE REL TABLE WROTE(FROM Author TO Work)")
            self.conn.execute("CREATE REL TABLE IS_REALIZED_BY(FROM Work TO Expression)")
            self.conn.execute("CREATE REL TABLE IS_EMBODIED_IN(FROM Expression TO Manifestation)")
            self.conn.execute("CREATE REL TABLE IS_EXEMPLIFIED_BY(FROM Manifestation TO Item)")
            
            logger.info("Schema initialized successfully.")
        except Exception as e:
            # Handle "Table already exists" if we got here from a fresh start or unexpected path
            if "already exists" in str(e).lower():
                logger.info("Schema partially exists, skipping creation for existing tables.")
            else:
                logger.error(f"Error creating schema: {e}")

    def get_connection(self):
        return kuzu.Connection(self.db)

db_manager = None

def get_db():
    global db_manager
    if db_manager is None:
        db_manager = DatabaseManager()
    return db_manager

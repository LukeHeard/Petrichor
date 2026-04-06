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
            # Node Tables
            self.conn.execute("CREATE NODE TABLE Work(id SERIAL, title STRING, PRIMARY KEY(id))")
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
            # Table already exists errors are common on restart
            if "already exists" in str(e).lower():
                logger.info("Schema already exists, skipping initialization.")
            else:
                logger.error(f"Error initializing schema: {e}")

    def get_connection(self):
        return kuzu.Connection(self.db)

db_manager = None

def get_db():
    global db_manager
    if db_manager is None:
        db_manager = DatabaseManager()
    return db_manager

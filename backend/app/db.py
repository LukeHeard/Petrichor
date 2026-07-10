import kuzu
import os
import threading
import logging

logger = logging.getLogger(__name__)

_init_lock = threading.Lock()

class DatabaseManager:
    def __init__(self):
        db_path = os.getenv("DATABASE_PATH", "./data/kuzu")
        os.makedirs(db_path, exist_ok=True)
        self.db = kuzu.Database(db_path)
        self.conn = kuzu.Connection(self.db)
        self._local = threading.local()
        self._init_schema()

    def _get_existing_tables(self):
        res = self.conn.execute("CALL SHOW_TABLES() RETURN name")
        existing = []
        while res.has_next():
            existing.append(res.get_next()[0])
        return existing

    def _create_table(self, name, stmt):
        try:
            self.conn.execute(stmt)
            logger.info(f"Created table {name}")
        except Exception as e:
            # Re-check existence — another process may have created it just now
            if name in self._get_existing_tables():
                logger.info(f"Table {name} already exists, skipping")
            else:
                logger.error(f"Failed to create table {name}: {e}")
                raise

    def _init_schema(self):
        with _init_lock:
            try:
                node_tables = {
                    "Work": "CREATE NODE TABLE Work(id SERIAL, title STRING, goodreads_id STRING, thumbnail_url STRING, first_publish_year INT64, description STRING, page_count INT64, current_page INT64, rating_average DOUBLE, rating_count INT64, personal_rating DOUBLE, status STRING, review STRING, personal_notes STRING, created_at INT64, PRIMARY KEY(id))",
                    "Tag": "CREATE NODE TABLE Tag(id SERIAL, name STRING, PRIMARY KEY(id))",
                    "Author": "CREATE NODE TABLE Author(id SERIAL, name STRING, PRIMARY KEY(id))",
                    "Series": "CREATE NODE TABLE Series(id SERIAL, name STRING, PRIMARY KEY(id))",
                    "Expression": "CREATE NODE TABLE Expression(id SERIAL, language STRING, content_type STRING, PRIMARY KEY(id))",
                    "Manifestation": "CREATE NODE TABLE Manifestation(id SERIAL, publisher STRING, format STRING, isbn STRING, PRIMARY KEY(id))",
                    "Item": "CREATE NODE TABLE Item(id SERIAL, barcode STRING, status STRING, PRIMARY KEY(id))",
                    "ReadingSession": "CREATE NODE TABLE ReadingSession(id SERIAL, date STRING, start_page INT64, end_page INT64, minutes_read INT64, PRIMARY KEY(id))"
                }
                rel_tables = {
                    "HAS_TAG": "CREATE REL TABLE HAS_TAG(FROM Work TO Tag)",
                    "WROTE": "CREATE REL TABLE WROTE(FROM Author TO Work)",
                    "IS_IN_SERIES": "CREATE REL TABLE IS_IN_SERIES(FROM Work TO Series)",
                    "IS_REALIZED_BY": "CREATE REL TABLE IS_REALIZED_BY(FROM Work TO Expression)",
                    "IS_EMBODIED_IN": "CREATE REL TABLE IS_EMBODIED_IN(FROM Expression TO Manifestation)",
                    "IS_EXEMPLIFIED_BY": "CREATE REL TABLE IS_EXEMPLIFIED_BY(FROM Manifestation TO Item)",
                    "SESSION_FOR": "CREATE REL TABLE SESSION_FOR(FROM ReadingSession TO Work)"
                }

                existing = self._get_existing_tables()

                for name, stmt in node_tables.items():
                    if name not in existing:
                        self._create_table(name, stmt)

                for name, stmt in rel_tables.items():
                    if name not in existing:
                        self._create_table(name, stmt)

                # Migration: add columns that may be missing from older schemas
                table_migrations = {
                    # kindle_asin links a Work to its Amazon edition for Whispersync progress
                    # pulls; kindle_last_pct is the last percentage we saw, so a sync can tell
                    # whether progress moved and by how much before synthesizing a ReadingSession.
                    "Work": {
                        "thumbnail_url": "STRING", "goodreads_id": "STRING", "current_page": "INT64",
                        "kindle_asin": "STRING", "kindle_last_pct": "DOUBLE",
                    },
                    # Goodreads' own numeric author id / series page URL, captured opportunistically
                    # during enrichment so future "discover more" lookups can fetch a complete
                    # bibliography/series listing instead of relying on fuzzy search matching.
                    "Author": {"goodreads_author_id": "INT64"},
                    "Series": {"goodreads_series_url": "STRING"},
                }
                for table_name, columns in table_migrations.items():
                    try:
                        res = self.conn.execute(f"CALL TABLE_INFO('{table_name}') RETURN *")
                        cols = []
                        while res.has_next():
                            cols.append(res.get_next()[1])
                        type_defaults = {"INT64": "0", "DOUBLE": "0.0", "STRING": "''"}
                        for col_name, col_type in columns.items():
                            if col_name not in cols:
                                default_val = type_defaults.get(col_type, "''")
                                self.conn.execute(f"ALTER TABLE {table_name} ADD {col_name} {col_type} DEFAULT {default_val}")
                                logger.info(f"Migrated: added {col_name} to {table_name} table")
                    except Exception as e:
                        logger.warning(f"Migration check failed for {table_name} (non-fatal): {e}")

                logger.info("Schema initialization complete.")
            except Exception as e:
                logger.error(f"Error initializing schema: {e}")

    def get_connection(self):
        # Kuzu's own concurrency model is "one Connection per thread, shared Database" -
        # reuse a single Connection per thread instead of paying its setup cost on every request.
        conn = getattr(self._local, "conn", None)
        if conn is None:
            conn = kuzu.Connection(self.db)
            self._local.conn = conn
        return conn

db_manager = None
_db_lock = threading.Lock()

def get_db():
    global db_manager
    if db_manager is None:
        with _db_lock:
            if db_manager is None:
                db_manager = DatabaseManager()
    return db_manager

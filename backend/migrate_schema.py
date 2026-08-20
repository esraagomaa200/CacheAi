"""Non-destructive migration for databases created by the older backend.

It only adds missing columns and backfills safe defaults. It never drops tables,
columns, or rows. Run it once before starting Uvicorn after replacing the files.
"""

import re

from sqlalchemy import inspect, text

from database import engine


COLUMN_DEFINITIONS = {
    "users": {
        "password_hash": "TEXT",
        "auth_provider": "VARCHAR(20) DEFAULT 'local'",
        "provider_id": "VARCHAR(255)",
        "has_seen_tour": "BOOLEAN DEFAULT FALSE",
        "created_at": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
        "updated_at": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
    },
    "patient_profiles": {
        "patient_id": "VARCHAR(100)",
        "date_of_birth": "DATE",
        "gender": "VARCHAR(30)",
        "blood_type": "VARCHAR(10)",
        "chronic_conditions": "{json_type}",
        "created_at": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
        "updated_at": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
    },
    "emergency_contacts": {
        "created_at": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
        "updated_at": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
    },
    "chat_sessions": {
        "created_at": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
        "updated_at": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
    },
    "messages": {
        "created_at": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
        "sources": "{json_type}",
        "risk_level": "VARCHAR(20)",
    },
}


BACKFILL_STATEMENTS = (
    ("users", "auth_provider", "'local'"),
    ("users", "has_seen_tour", "FALSE"),
    ("users", "created_at", "CURRENT_TIMESTAMP"),
    ("users", "updated_at", "CURRENT_TIMESTAMP"),
    ("patient_profiles", "created_at", "CURRENT_TIMESTAMP"),
    ("patient_profiles", "updated_at", "CURRENT_TIMESTAMP"),
    ("emergency_contacts", "created_at", "CURRENT_TIMESTAMP"),
    ("emergency_contacts", "updated_at", "CURRENT_TIMESTAMP"),
    ("chat_sessions", "created_at", "CURRENT_TIMESTAMP"),
    ("chat_sessions", "updated_at", "CURRENT_TIMESTAMP"),
    ("messages", "created_at", "CURRENT_TIMESTAMP"),
)


# SQLite refuses ALTER TABLE ... ADD COLUMN with a non-constant default
# (e.g. DEFAULT CURRENT_TIMESTAMP) once the table already has rows — every
# real existing DB we're migrating. Every column definition below that
# carries a DEFAULT already has a matching entry in BACKFILL_STATEMENTS, and
# the ORM sets these values in Python on every future insert anyway, so the
# DB-level DEFAULT clause isn't needed for correctness. Strip it before
# issuing the ALTER so this stays safe on both SQLite and PostgreSQL.
_DEFAULT_CLAUSE_RE = re.compile(r"\s+DEFAULT\s+.+$", re.IGNORECASE)


def migrate() -> None:
    with engine.begin() as connection:
        inspector = inspect(connection)
        existing_tables = set(inspector.get_table_names())
        json_type = "JSONB" if connection.dialect.name == "postgresql" else "JSON"

        for table_name, columns in COLUMN_DEFINITIONS.items():
            if table_name not in existing_tables:
                continue

            existing_columns = {
                column["name"] for column in inspector.get_columns(table_name)
            }
            for column_name, definition in columns.items():
                if column_name in existing_columns:
                    continue
                definition = definition.format(json_type=json_type)
                column_def = _DEFAULT_CLAUSE_RE.sub("", definition).strip()
                connection.execute(
                    text(
                        f'ALTER TABLE "{table_name}" '
                        f'ADD COLUMN "{column_name}" {column_def}'
                    )
                )
                print(f"Added {table_name}.{column_name}")

        # Fill nullable legacy rows after adding the new columns. This is safe
        # for existing records and lets the new ORM models read them normally.
        for table_name, column_name, value in BACKFILL_STATEMENTS:
            if table_name not in existing_tables:
                continue
            columns = {
                column["name"] for column in inspect(connection).get_columns(table_name)
            }
            if column_name not in columns:
                continue
            connection.execute(
                text(
                    f'UPDATE "{table_name}" '
                    f'SET "{column_name}" = {value} '
                    f'WHERE "{column_name}" IS NULL'
                )
            )

    print("Schema migration completed without deleting data.")


if __name__ == "__main__":
    migrate()

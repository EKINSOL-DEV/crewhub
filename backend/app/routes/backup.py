"""
API routes for database backup and restore.

Provides endpoints to export/import the entire database as JSON,
create file-level backups, and list existing backup files.
"""

import json
import logging
import shutil
from datetime import UTC, datetime
from pathlib import Path
from typing import Annotated, Any

import aiosqlite
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from ..auth import APIKeyInfo, require_scope
from ..db.database import DB_DIR, DB_PATH, SCHEMA_VERSION, get_db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/backup", tags=["backup"])

BACKUP_DIR = DB_DIR / "backups"


# =============================================================================
# Response Models
# =============================================================================


class ExportMetadata(BaseModel):
    """Metadata included in export files."""

    version: str = "1.0.0"
    exported_at: str
    schema_version: int
    tables: dict[str, int]  # table_name -> row_count


class ImportResponse(BaseModel):
    """Response after importing data."""

    success: bool
    tables_imported: int
    rows_imported: int
    backup_path: str


class BackupFileInfo(BaseModel):
    """Information about a backup file."""

    filename: str
    size: int
    created_at: str


class BackupCreateResponse(BaseModel):
    """Response after creating a backup."""

    path: str
    size: int


# =============================================================================
# Helper functions
# =============================================================================

# Tables to export/import (order matters for foreign keys)
EXPORT_TABLES = [
    "schema_version",
    "rooms",
    "agents",
    "session_room_assignments",
    "session_display_names",
    "room_assignment_rules",
    "settings",
    "connections",
]


async def _export_table(db: aiosqlite.Connection, table: str) -> list[dict[str, Any]]:
    """Export all rows from a table as list of dicts."""
    async with db.execute(f"SELECT * FROM {table}") as cursor:
        return await cursor.fetchall()


def _create_backup_path() -> Path:
    """Generate a timestamped backup path."""
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
    return BACKUP_DIR / f"crewhub-{timestamp}.db"


def _create_file_backup() -> Path:
    """Create a file-level backup of the database."""
    backup_path = _create_backup_path()
    shutil.copy2(str(DB_PATH), str(backup_path))
    logger.info(f"Database backed up to {backup_path}")
    return backup_path


# =============================================================================
# Routes
# =============================================================================


@router.get("/export")
async def export_database(key: Annotated[APIKeyInfo, Depends(require_scope("admin"))]):
    """
    Export the entire database as a downloadable JSON file.

    Includes all tables and metadata for version tracking.
    """
    if not DB_PATH.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Database not found",
        )

    try:
        tables_data: dict[str, list[dict[str, Any]]] = {}
        table_counts: dict[str, int] = {}

        async with get_db() as db:
            for table in EXPORT_TABLES:
                try:
                    rows = await _export_table(db, table)
                    tables_data[table] = rows
                    table_counts[table] = len(rows)
                except Exception as e:
                    logger.warning(f"Failed to export table {table}: {e}")
                    tables_data[table] = []
                    table_counts[table] = 0

        export_data = {
            "metadata": {
                "version": "1.0.0",
                "exported_at": datetime.now(UTC).isoformat(),
                "schema_version": SCHEMA_VERSION,
                "tables": table_counts,
            },
            "data": tables_data,
        }

        return JSONResponse(
            content=export_data,
            headers={
                "Content-Disposition": f'attachment; filename="crewhub-export-{datetime.now(UTC).strftime("%Y%m%d_%H%M%S")}.json"',
            },
        )

    except Exception as e:
        logger.error(f"Export failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Export failed: {str(e)}",
        )


@router.post("/import", response_model=ImportResponse)
async def _read_import_payload(file: UploadFile) -> dict[str, Any]:
    """Read and parse uploaded import JSON."""
    try:
        content = await file.read()
        return json.loads(content)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid JSON: {str(e)}") from e
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Failed to read file: {str(e)}") from e


def _extract_import_data(import_data: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    """Validate import structure and return (metadata, data)."""
    if "metadata" not in import_data or "data" not in import_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid export format: missing 'metadata' or 'data'",
        )
    return import_data["metadata"], import_data["data"]


def _validate_schema_compatibility(metadata: dict[str, Any]) -> None:
    """Ensure incoming export schema is compatible with current DB schema."""
    import_schema = metadata.get("schema_version", 0)
    if import_schema <= SCHEMA_VERSION:
        return
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=(
            f"Import schema version ({import_schema}) is newer than "
            f"current ({SCHEMA_VERSION}). Please upgrade CrewHub first."
        ),
    )


async def _replace_table_data(db: aiosqlite.Connection, table: str, rows: list[dict[str, Any]]) -> int:
    """Replace one table's contents; return imported row count."""
    await db.execute(f"DELETE FROM {table}")
    if not rows:
        return 0

    columns = list(rows[0].keys())
    placeholders = ", ".join(["?"] * len(columns))
    col_names = ", ".join(columns)

    imported_rows = 0
    for row in rows:
        values = [row.get(col) for col in columns]
        await db.execute(f"INSERT INTO {table} ({col_names}) VALUES ({placeholders})", values)
        imported_rows += 1
    return imported_rows


async def _import_tables(data: dict[str, Any]) -> tuple[int, int]:
    """Import all supported tables; returns (tables_imported, rows_imported)."""
    tables_imported = 0
    rows_imported = 0
    async with get_db() as db:
        for table in EXPORT_TABLES:
            if table not in data:
                continue
            rows_imported += await _replace_table_data(db, table, data[table])
            tables_imported += 1
        await db.commit()
    return tables_imported, rows_imported


def _restore_database_from_backup(backup_path: Path) -> None:
    """Restore DB file from a safety backup after failed import."""
    try:
        shutil.copy2(str(backup_path), str(DB_PATH))
        logger.info("Database restored from backup after failed import")
    except Exception as restore_err:
        logger.error(f"Failed to restore backup: {restore_err}")


@router.post("/import", response_model=ImportResponse)
async def import_database(
    file: Annotated[UploadFile, File(...)], key: Annotated[APIKeyInfo, Depends(require_scope("admin"))]
):
    """
    Import data from a JSON export file.

    Automatically backs up the current database before importing.
    Validates schema version compatibility.
    Replaces all data within a transaction.
    """
    import_data = await _read_import_payload(file)
    metadata, data = _extract_import_data(import_data)
    _validate_schema_compatibility(metadata)

    try:
        backup_path = _create_file_backup()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create safety backup: {str(e)}",
        ) from e

    try:
        tables_imported, rows_imported = await _import_tables(data)
    except Exception as e:
        logger.error(f"Import failed: {e}")
        _restore_database_from_backup(backup_path)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Import failed (database restored from backup): {str(e)}",
        ) from e

    logger.info(f"Import successful: {tables_imported} tables, {rows_imported} rows")
    return ImportResponse(
        success=True,
        tables_imported=tables_imported,
        rows_imported=rows_imported,
        backup_path=str(backup_path),
    )


@router.get("/list", response_model=list[BackupFileInfo])
async def list_backups(key: Annotated[APIKeyInfo, Depends(require_scope("admin"))]):
    """
    List available backup files from ~/.crewhub/backups/.

    Returns files sorted by creation time (newest first).
    """
    if not BACKUP_DIR.exists():
        return []

    backups: list[BackupFileInfo] = []
    for f in sorted(BACKUP_DIR.iterdir(), reverse=True):
        if f.is_file() and (f.suffix == ".db" or f.suffix == ".json"):
            stat = f.stat()
            backups.append(
                BackupFileInfo(
                    filename=f.name,
                    size=stat.st_size,
                    created_at=datetime.fromtimestamp(stat.st_ctime, tz=UTC).isoformat(),
                )
            )

    return backups


@router.post("/create", response_model=BackupCreateResponse)
async def create_backup(key: Annotated[APIKeyInfo, Depends(require_scope("admin"))]):
    """
    Create a manual backup of the database file.

    Copies the DB file to ~/.crewhub/backups/crewhub-{timestamp}.db.
    """
    if not DB_PATH.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Database not found",
        )

    try:
        backup_path = _create_file_backup()
        size = backup_path.stat().st_size

        return BackupCreateResponse(
            path=str(backup_path),
            size=size,
        )

    except Exception as e:
        logger.error(f"Backup creation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Backup failed: {str(e)}",
        )

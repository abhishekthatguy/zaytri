"""
Zaytri — Data Parser Agent (Reusable Sub-Agent)
Universal data fetcher and parser for:
  - CSV files (file upload or URL)
  - Google Sheets (public published URL)
  - Google Docs (public)
  - Internal database records
  - JSON / JSONL files

Design: This is a reusable sub-agent. The Master Agent or Calendar Pipeline
can invoke it for any data ingestion task. Each source type has a dedicated
parser, and the output is always a list of normalized dictionaries.
"""

import csv
import io
import json
import logging
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from enum import Enum

import httpx

from .base_agent import BaseAgent

logger = logging.getLogger(__name__)


# ─── Source Types ────────────────────────────────────────────────────────────

class DataSourceType(str, Enum):
    CSV_FILE = "csv_file"           # Direct CSV file upload (bytes/string)
    CSV_URL = "csv_url"             # CSV accessible via URL
    GOOGLE_SHEET = "google_sheet"   # Google Sheets published URL
    GOOGLE_DOC = "google_doc"       # Google Docs published URL
    JSON_FILE = "json_file"         # JSON/JSONL file
    DATABASE = "database"           # Internal database query


# ─── Column Normalizer ──────────────────────────────────────────────────────

# Maps messy column names → clean standard names
COLUMN_MAP = {
    # Date
    "date": "date",
    "scheduled date": "scheduled_date",
    "publish date": "scheduled_date",
    "post date": "scheduled_date",
    "schedule": "scheduled_date",
    # Brand
    "brand": "brand",
    "brand name": "brand",
    "company": "brand",
    "account": "brand",
    # Content type
    "content_type": "content_type",
    "content type": "content_type",
    "type": "content_type",
    "post type": "content_type",
    "format": "content_type",
    # Topic
    "topic": "topic",
    "subject": "topic",
    "title": "topic",
    "headline": "topic",
    "content topic": "topic",
    # Platforms
    "platforms": "platforms",
    "platform": "platforms",
    "channels": "platforms",
    "channel": "platforms",
    "social media": "platforms",
    # Approval
    "approval_required": "approval_required",
    "approval required": "approval_required",
    "requires approval": "approval_required",
    "approval": "approval_required",
    "needs approval": "approval_required",
    # Status
    "status": "status",
    "state": "status",
    # Default Hashtags
    "default hastags": "default_hashtags",  # Note: matches the user's "hastags" typo
    "default hashtags": "default_hashtags",
    "hashtags": "default_hashtags",
    "tags": "default_hashtags",
    # Generated Hashtags
    "generated hashtags": "generated_hashtags",
    "ai hashtags": "generated_hashtags",
    # Model
    "model": "model",
    "ai model": "model",
    "llm model": "model",
    # Tone
    "tone": "tone",
    "voice": "tone",
    "style": "tone",
    # CTA / Link
    "cta": "cta",
    "call to action": "cta",
    "link": "link",
    "url": "link",
    "cta link": "link",
    # Notes
    "notes": "notes",
    "note": "notes",
    "comments": "notes",
}


def _normalize_column_name(raw: str) -> str:
    """Normalize a raw column name to a standard field name."""
    clean = raw.strip().lower().replace("_", " ")
    return COLUMN_MAP.get(clean, raw.strip().lower().replace(" ", "_"))


def _parse_bool(value: str) -> bool:
    """Parse various boolean representations."""
    if isinstance(value, bool):
        return value
    return str(value).strip().upper() in ("TRUE", "YES", "1", "Y", "✓", "✔")


def _parse_platforms(value: str) -> List[str]:
    """Parse a comma/slash separated platform string into a list."""
    if not value:
        return []
    # Handle comma-separated, possibly quoted
    platforms = []
    for p in re.split(r'[,/|;]+', str(value)):
        cleaned = p.strip().lower()
        if cleaned:
            # Normalize platform names
            platform_aliases = {
                "x": "twitter",
                "x (twitter)": "twitter",
                "twitter/x": "twitter",
                "ig": "instagram",
                "fb": "facebook",
                "yt": "youtube",
                "li": "linkedin",
                "in": "linkedin",
            }
            platforms.append(platform_aliases.get(cleaned, cleaned))
    return platforms


def _parse_hashtags(value: str) -> List[str]:
    """Parse hashtag string into a list."""
    if not value:
        return []
    # Split by comma or space
    tags = re.split(r'[,\s]+', str(value).strip())
    result = []
    for tag in tags:
        tag = tag.strip()
        if tag:
            if not tag.startswith("#"):
                tag = f"#{tag}"
            result.append(tag)
    return result


def _parse_date(value: str) -> Optional[str]:
    """Parse various date formats to ISO 8601."""
    if not value or not str(value).strip():
        return None

    value = str(value).strip()

    # Try common date formats
    formats = [
        "%m/%d/%Y",    # 3/1/2026
        "%d/%m/%Y",    # 01/03/2026
        "%Y-%m-%d",    # 2026-03-01
        "%m-%d-%Y",    # 03-01-2026
        "%d-%m-%Y",    # 01-03-2026
        "%B %d, %Y",   # March 1, 2026
        "%b %d, %Y",   # Mar 1, 2026
        "%d %B %Y",    # 1 March 2026
        "%Y/%m/%d",    # 2026/03/01
    ]

    for fmt in formats:
        try:
            dt = datetime.strptime(value, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue

    # Return raw if no format matched
    return value


# ═════════════════════════════════════════════════════════════════════════════
# Data Parser Agent
# ═════════════════════════════════════════════════════════════════════════════

class DataParserAgent(BaseAgent):
    """
    Reusable sub-agent for data fetching and parsing.

    Supported sources:
    - CSV files (uploaded or from URL)
    - Google Sheets (public published CSV URL)
    - Google Docs (public)
    - Internal database records
    - JSON / JSONL files

    Output: Always a list of normalized dictionaries with standard field names.

    Usage by Master Agent:
        parser = DataParserAgent()
        result = await parser.run({
            "source_type": "csv_file",
            "data": csv_string_or_bytes,
        })
        rows = result["rows"]  # List[Dict]
    """

    def __init__(self):
        super().__init__("DataParser")

    async def run(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Main entry point.

        Input keys:
            source_type: DataSourceType value
            data: Raw data (for csv_file, json_file)
            url: URL to fetch (for csv_url, google_sheet, google_doc)
            query: SQL-like filter (for database)
            table: Table name (for database)
            schema_hint: Optional dict mapping expected columns

        Returns:
            {
                "rows": [...],
                "total_rows": int,
                "columns": [...],
                "source_type": str,
                "parse_errors": [...],
                "parsed_at": str,
            }
        """
        self.log_start(input_data)

        source_type = input_data.get("source_type", DataSourceType.CSV_FILE)
        if isinstance(source_type, str):
            source_type = DataSourceType(source_type)

        try:
            if source_type == DataSourceType.CSV_FILE:
                rows, columns, errors = self._parse_csv(input_data.get("data", ""))

            elif source_type == DataSourceType.CSV_URL:
                csv_data = await self._fetch_url(input_data["url"])
                rows, columns, errors = self._parse_csv(csv_data)

            elif source_type == DataSourceType.GOOGLE_SHEET:
                csv_data = await self._fetch_google_sheet(input_data["url"])
                rows, columns, errors = self._parse_csv(csv_data)

            elif source_type == DataSourceType.GOOGLE_DOC:
                doc_data = await self._fetch_google_doc(input_data["url"])
                rows, columns, errors = self._parse_google_doc(doc_data)

            elif source_type == DataSourceType.JSON_FILE:
                rows, columns, errors = self._parse_json(input_data.get("data", ""))

            elif source_type == DataSourceType.DATABASE:
                rows, columns, errors = await self._query_database(
                    table=input_data.get("table", ""),
                    filters=input_data.get("filters", {}),
                )

            else:
                raise ValueError(f"Unsupported source type: {source_type}")

            output = {
                "rows": rows,
                "total_rows": len(rows),
                "columns": columns,
                "source_type": source_type.value,
                "parse_errors": errors,
                "parsed_at": datetime.utcnow().isoformat(),
            }

            self.log_complete({"total_rows": len(rows), "columns": columns})
            return output

        except Exception as e:
            self.log_error(e)
            raise

    # ── CSV Parser ──────────────────────────────────────────────────────

    def _parse_csv(self, data: Any) -> Tuple[List[Dict], List[str], List[str]]:
        """Parse CSV data (string or bytes) into normalized rows."""
        errors = []

        # Handle bytes
        if isinstance(data, bytes):
            try:
                data = data.decode("utf-8-sig")  # Handle BOM
            except UnicodeDecodeError:
                data = data.decode("latin-1")

        # Handle file-like objects
        if hasattr(data, "read"):
            data = data.read()
            if isinstance(data, bytes):
                data = data.decode("utf-8-sig")

        if not data or not data.strip():
            return [], [], ["Empty CSV data"]

        # Parse CSV
        reader = csv.DictReader(io.StringIO(data))

        # Normalize column names
        if reader.fieldnames:
            raw_columns = list(reader.fieldnames)
            column_mapping = {raw: _normalize_column_name(raw) for raw in raw_columns}
            normalized_columns = list(column_mapping.values())
        else:
            return [], [], ["No header row found"]

        rows = []
        for i, raw_row in enumerate(reader):
            try:
                row = {}
                for raw_key, value in raw_row.items():
                    norm_key = column_mapping.get(raw_key, raw_key)
                    row[norm_key] = (value or "").strip()

                # Apply type conversions
                normalized = self._normalize_row(row, i + 2)  # +2 for header + 0-index
                rows.append(normalized)

            except Exception as e:
                errors.append(f"Row {i + 2}: {str(e)}")

        return rows, normalized_columns, errors

    def _normalize_row(self, row: Dict[str, str], row_num: int) -> Dict[str, Any]:
        """Apply type conversions and validation to a parsed row."""
        normalized = {}

        for key, value in row.items():
            if key == "date" or key == "scheduled_date":
                normalized[key] = _parse_date(value)
            elif key == "approval_required":
                normalized[key] = _parse_bool(value)
            elif key == "platforms":
                normalized[key] = _parse_platforms(value)
            elif key in ("default_hashtags", "generated_hashtags"):
                normalized[key] = _parse_hashtags(value)
            else:
                normalized[key] = value if value else None

        # Ensure required fields have defaults
        normalized.setdefault("brand", "Unknown")
        normalized.setdefault("topic", "")
        normalized.setdefault("platforms", [])
        normalized.setdefault("approval_required", False)
        normalized.setdefault("status", "pending")
        normalized.setdefault("content_type", "general")
        normalized.setdefault("default_hashtags", [])
        normalized.setdefault("tone", "professional")

        # Add metadata
        normalized["_row_number"] = row_num

        return normalized

    # ── Google Sheets Fetcher ───────────────────────────────────────────

    async def _fetch_google_sheet(self, url: str) -> str:
        """
        Fetch Google Sheets data as CSV.
        Supports:
          - Published CSV URL: .../pub?output=csv
          - Regular share URL: extracts sheet ID and builds CSV export URL
        """
        # Extract sheet ID from various URL formats
        csv_url = url

        # If it's a regular Google Sheets URL, convert to CSV export
        sheet_id_match = re.search(
            r'/spreadsheets/d/([a-zA-Z0-9_-]+)', url
        )
        if sheet_id_match and "pub?output=csv" not in url:
            sheet_id = sheet_id_match.group(1)
            # Try published CSV first; fall back to export
            csv_url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv"

        return await self._fetch_url(csv_url)

    # ── Google Docs Fetcher ─────────────────────────────────────────────

    async def _fetch_google_doc(self, url: str) -> str:
        """
        Fetch Google Docs content as plain text.
        Converts share URL to export URL.
        """
        doc_id_match = re.search(r'/document/d/([a-zA-Z0-9_-]+)', url)
        if doc_id_match:
            doc_id = doc_id_match.group(1)
            export_url = f"https://docs.google.com/document/d/{doc_id}/export?format=txt"
            return await self._fetch_url(export_url)

        # If it's already an export URL or text URL
        return await self._fetch_url(url)

    def _parse_google_doc(self, text: str) -> Tuple[List[Dict], List[str], List[str]]:
        """
        Parse Google Doc text content.
        Tries to detect if it contains CSV-like table data, a structured list,
        or key-value pairs.
        """
        errors = []

        if not text or not text.strip():
            return [], [], ["Empty document"]

        # Check if it looks like CSV (has consistent delimiters)
        lines = text.strip().split("\n")
        if len(lines) > 1:
            # Check for tab or comma delimiters
            first_line = lines[0]
            if "\t" in first_line:
                # Tab-separated — convert to CSV
                csv_data = "\n".join(
                    ",".join(f'"{cell}"' for cell in line.split("\t"))
                    for line in lines
                )
                return self._parse_csv(csv_data)
            elif "," in first_line and len(first_line.split(",")) > 2:
                return self._parse_csv(text)

        # Treat each line as a data point
        rows = []
        for i, line in enumerate(lines):
            line = line.strip()
            if not line:
                continue
            rows.append({
                "content": line,
                "line_number": i + 1,
                "_row_number": i + 1,
            })

        columns = ["content", "line_number"] if rows else []
        return rows, columns, errors

    # ── JSON Parser ─────────────────────────────────────────────────────

    def _parse_json(self, data: Any) -> Tuple[List[Dict], List[str], List[str]]:
        """Parse JSON or JSONL data."""
        errors = []

        if isinstance(data, bytes):
            data = data.decode("utf-8-sig")
        if hasattr(data, "read"):
            data = data.read()

        if not data or not str(data).strip():
            return [], [], ["Empty JSON data"]

        data = str(data).strip()

        # Try standard JSON
        try:
            parsed = json.loads(data)
            if isinstance(parsed, list):
                columns = list(set().union(*(d.keys() for d in parsed if isinstance(d, dict))))
                return parsed, columns, []
            elif isinstance(parsed, dict):
                # Single object or nested
                if any(isinstance(v, list) for v in parsed.values()):
                    # Find the first list value
                    for key, val in parsed.items():
                        if isinstance(val, list) and val and isinstance(val[0], dict):
                            columns = list(set().union(*(d.keys() for d in val)))
                            return val, columns, []
                return [parsed], list(parsed.keys()), []
        except json.JSONDecodeError:
            pass

        # Try JSONL (one JSON object per line)
        rows = []
        for i, line in enumerate(data.split("\n")):
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
                rows.append(obj)
            except json.JSONDecodeError:
                errors.append(f"Line {i + 1}: Invalid JSON")

        if rows:
            columns = list(set().union(*(d.keys() for d in rows if isinstance(d, dict))))
            return rows, columns, errors

        return [], [], ["Failed to parse JSON data"]

    # ── Database Query ──────────────────────────────────────────────────

    async def _query_database(
        self,
        table: str,
        filters: Dict[str, Any],
    ) -> Tuple[List[Dict], List[str], List[str]]:
        """
        Query internal database for records.
        Supports: calendar_entries, contents, schedules
        """
        errors = []

        from db.database import async_session
        from sqlalchemy import select, text

        table_mapping = {
            "calendar_entries": "calendar_entries",
            "calendar": "calendar_entries",
            "contents": "contents",
            "content": "contents",
            "schedules": "schedules",
        }

        actual_table = table_mapping.get(table.lower(), table)

        try:
            async with async_session() as session:
                # Use text query for flexibility
                query_str = f"SELECT * FROM {actual_table}"
                where_clauses = []

                for key, value in filters.items():
                    where_clauses.append(f"{key} = :{key}")

                if where_clauses:
                    query_str += " WHERE " + " AND ".join(where_clauses)

                query_str += " ORDER BY created_at DESC LIMIT 500"

                result = await session.execute(text(query_str), filters)
                columns = list(result.keys())
                rows = [dict(zip(columns, row)) for row in result.fetchall()]

                # Serialize non-serializable types
                for row in rows:
                    for key, val in row.items():
                        if isinstance(val, datetime):
                            row[key] = val.isoformat()
                        elif hasattr(val, "value"):  # Enum
                            row[key] = val.value
                        elif isinstance(val, bytes):
                            row[key] = val.hex()

                return rows, columns, errors

        except Exception as e:
            errors.append(f"Database query failed: {str(e)}")
            return [], [], errors

    # ── URL Fetcher (shared) ────────────────────────────────────────────

    async def _fetch_url(self, url: str, timeout: float = 30.0) -> str:
        """Fetch content from a URL with timeout and retry."""
        self.logger.info(f"Fetching URL: {url}")

        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=timeout,
        ) as client:
            for attempt in range(3):
                try:
                    response = await client.get(url)
                    response.raise_for_status()
                    return response.text
                except httpx.TimeoutException:
                    self.logger.warning(
                        f"Timeout fetching {url} (attempt {attempt + 1}/3)"
                    )
                    if attempt == 2:
                        raise
                except httpx.HTTPStatusError as e:
                    self.logger.error(f"HTTP error: {e.response.status_code}")
                    raise

        return ""

    # ── Convenience Methods (for Master Agent reuse) ────────────────────

    async def parse_csv_string(self, csv_data: str) -> Dict[str, Any]:
        """Convenience: Parse a CSV string directly."""
        return await self.run({
            "source_type": DataSourceType.CSV_FILE,
            "data": csv_data,
        })

    async def parse_csv_file(self, file_bytes: bytes) -> Dict[str, Any]:
        """Convenience: Parse uploaded CSV file bytes."""
        return await self.run({
            "source_type": DataSourceType.CSV_FILE,
            "data": file_bytes,
        })

    async def parse_google_sheet(self, url: str) -> Dict[str, Any]:
        """Convenience: Fetch and parse a Google Sheet."""
        return await self.run({
            "source_type": DataSourceType.GOOGLE_SHEET,
            "url": url,
        })

    async def parse_google_doc(self, url: str) -> Dict[str, Any]:
        """Convenience: Fetch and parse a Google Doc."""
        return await self.run({
            "source_type": DataSourceType.GOOGLE_DOC,
            "url": url,
        })

    async def parse_json_data(self, data: str) -> Dict[str, Any]:
        """Convenience: Parse JSON / JSONL data."""
        return await self.run({
            "source_type": DataSourceType.JSON_FILE,
            "data": data,
        })

    async def query_db(self, table: str, **filters) -> Dict[str, Any]:
        """Convenience: Query internal database."""
        return await self.run({
            "source_type": DataSourceType.DATABASE,
            "table": table,
            "filters": filters,
        })

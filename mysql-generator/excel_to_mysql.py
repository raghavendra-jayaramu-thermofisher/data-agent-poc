#!/usr/bin/env python3
"""
Excel to MySQL Data Script Generator
Converts any Excel (.xlsx) file into a complete, standalone MySQL dump script (.sql)
containing:
  - CREATE DATABASE
  - CREATE TABLE (with automated data type inference)
  - Multi-row batched INSERT statements
Works with zero external dependencies (pure Python standard library)
and also seamlessly supports openpyxl if installed.
"""

import argparse
import datetime
import os
import re
import sys
import xml.etree.ElementTree as ET
import zipfile
from typing import Any, Dict, Generator, List, Optional, Tuple

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass


# ==============================================================================
# Helper Functions: Column Letters <-> Index
# ==============================================================================


def col_letters_to_index(col_str: str) -> int:
    """Converts Excel column letters (e.g., 'A', 'Z', 'AA', 'BL') to 0-based index."""
    idx = 0
    for char in col_str.upper():
        if "A" <= char <= "Z":
            idx = idx * 26 + (ord(char) - ord("A") + 1)
    return idx - 1


def split_cell_ref(cell_ref: str) -> Tuple[str, int]:
    """Splits 'BL10011' into ('BL', 10011)."""
    match = re.match(r"^([A-Za-z]+)(\d+)$", cell_ref)
    if match:
        return match.group(1), int(match.group(2))
    return cell_ref, 0


def sanitize_identifier(name: str, fallback_prefix: str = "col") -> str:
    """
    Sanitizes an arbitrary string into a clean, safe MySQL identifier (snake_case).
    Example: 'order release date' -> 'order_release_date'
             'amount p$' -> 'amount_p'
    """
    if not name or not str(name).strip():
        return fallback_prefix

    # Replace special symbols with words or underscores
    s = str(name).strip()
    s = s.replace("$", "_usd").replace("%", "_pct").replace("#", "_num")
    # Replace any non-alphanumeric character with underscore
    s = re.sub(r"[^0-9a-zA-Z_]+", "_", s)
    # Collapse consecutive underscores
    s = re.sub(r"_+", "_", s)
    # Strip leading/trailing underscores
    s = s.strip("_")
    # Ensure identifier does not start with a digit
    if s and s[0].isdigit():
        s = f"{fallback_prefix}_{s}"
    return s.lower() if s else fallback_prefix


def deduplicate_names(names: List[str]) -> List[str]:
    """Ensures all column names in a list are distinct."""
    seen: Dict[str, int] = {}
    deduped = []
    for name in names:
        base = name
        if base in seen:
            seen[base] += 1
            deduped.append(f"{base}_{seen[base]}")
        else:
            seen[base] = 0
            deduped.append(base)
    return deduped


# ==============================================================================
# Pure Python OpenXML (.xlsx) Reader
# ==============================================================================


class BuiltinXlsxReader:
    """Reads .xlsx files using Python's built-in zipfile and ElementTree."""

    NS_MAIN = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
    NS_REL = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"

    def __init__(self, filepath: str):
        self.filepath = filepath
        self.zip_ref = zipfile.ZipFile(filepath, "r")
        self.shared_strings = self._load_shared_strings()
        self.sheets = self._load_sheet_list()

    def _load_shared_strings(self) -> List[str]:
        """Loads xl/sharedStrings.xml if present."""
        if "xl/sharedStrings.xml" not in self.zip_ref.namelist():
            return []

        tree = ET.fromstring(self.zip_ref.read("xl/sharedStrings.xml"))
        strings = []
        for si in tree.findall(f"{self.NS_MAIN}si"):
            text_parts = []
            # Single text tag <t>
            t_elem = si.find(f"{self.NS_MAIN}t")
            if t_elem is not None and t_elem.text:
                text_parts.append(t_elem.text)
            else:
                # Rich text runs <r><t>...</t></r>
                for r in si.findall(f"{self.NS_MAIN}r"):
                    t_sub = r.find(f"{self.NS_MAIN}t")
                    if t_sub is not None and t_sub.text:
                        text_parts.append(t_sub.text)
            strings.append("".join(text_parts))
        return strings

    def _load_sheet_list(self) -> List[Dict[str, Any]]:
        """Parses xl/workbook.xml and returns metadata of all sheets."""
        tree = ET.fromstring(self.zip_ref.read("xl/workbook.xml"))
        sheets_elem = tree.find(f"{self.NS_MAIN}sheets")
        sheets = []
        if sheets_elem is not None:
            for idx, s in enumerate(sheets_elem.findall(f"{self.NS_MAIN}sheet")):
                sheet_name = s.attrib.get("name", f"Sheet{idx + 1}")
                sheet_id = s.attrib.get("sheetId", str(idx + 1))
                # OpenXML maps sheet index to sheet1.xml, sheet2.xml etc.
                target_file = f"xl/worksheets/sheet{idx + 1}.xml"
                sheets.append(
                    {
                        "name": sheet_name,
                        "sheet_id": sheet_id,
                        "index": idx,
                        "target_file": target_file,
                    }
                )
        return sheets

    def get_sheet_names(self) -> List[str]:
        return [s["name"] for s in self.sheets]

    def _parse_cell_value(self, cell_elem: ET.Element) -> Any:
        cell_type = cell_elem.attrib.get("t")

        # Inline string: <is><t>...</t></is>
        if cell_type == "inlineStr":
            t_elem = cell_elem.find(f"{self.NS_MAIN}is/{self.NS_MAIN}t")
            return t_elem.text if t_elem is not None else ""

        v_elem = cell_elem.find(f"{self.NS_MAIN}v")
        if v_elem is None or v_elem.text is None:
            return None
        raw_val = v_elem.text.strip()

        # Shared string: index into sharedStrings
        if cell_type == "s":
            try:
                s_idx = int(raw_val)
                if 0 <= s_idx < len(self.shared_strings):
                    return self.shared_strings[s_idx]
            except ValueError:
                pass
            return raw_val

        # Boolean
        if cell_type == "b":
            return raw_val == "1"

        # Number or standard value
        return raw_val

    def stream_sheet_rows(self, sheet_spec: Any) -> Generator[List[Any], None, None]:
        """
        Yields rows as lists of cell values, properly indexed according to cell columns.
        Uses iterparse to handle large files memory-efficiently.
        """
        target_info = None
        if isinstance(sheet_spec, int):
            if 0 <= sheet_spec < len(self.sheets):
                target_info = self.sheets[sheet_spec]
        else:
            for s in self.sheets:
                if s["name"].lower() == str(sheet_spec).lower():
                    target_info = s
                    break

        if not target_info:
            target_info = self.sheets[0]

        target_file = target_info["target_file"]
        if target_file not in self.zip_ref.namelist():
            # Try finding any sheet xml
            sheets_in_zip = [
                n
                for n in self.zip_ref.namelist()
                if n.startswith("xl/worksheets/sheet")
            ]
            if sheets_in_zip:
                target_file = sheets_in_zip[0]
            else:
                raise FileNotFoundError(
                    f"Could not find worksheet xml for {target_info['name']}"
                )

        with self.zip_ref.open(target_file) as sheet_file:
            context = ET.iterparse(sheet_file, events=("end",))
            for event, elem in context:
                if elem.tag == f"{self.NS_MAIN}row":
                    row_cells: Dict[int, Any] = {}
                    max_col = -1
                    for c in elem.findall(f"{self.NS_MAIN}c"):
                        cell_ref = c.attrib.get("r", "")
                        col_str, _ = split_cell_ref(cell_ref)
                        c_idx = col_letters_to_index(col_str)
                        val = self._parse_cell_value(c)
                        row_cells[c_idx] = val
                        if c_idx > max_col:
                            max_col = c_idx

                    if max_col >= 0:
                        row_list = [row_cells.get(i, None) for i in range(max_col + 1)]
                        yield row_list

                    elem.clear()

    def close(self):
        self.zip_ref.close()


# ==============================================================================
# Type Inference Engine
# ==============================================================================


class TypeInferrer:
    """Analyzes non-empty values in each column to determine the best MySQL type."""

    ISO_DATETIME_RE = re.compile(r"^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?$")
    ISO_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

    @classmethod
    def infer_type(cls, values: List[Any]) -> str:
        non_nulls = [
            v
            for v in values
            if v is not None and str(v).strip() != "" and str(v).lower() != "nan"
        ]
        if not non_nulls:
            return "VARCHAR(255)"

        is_int = True
        is_float = True
        is_date = True
        is_datetime = True
        is_bool = True
        max_int_val = 0
        min_int_val = 0
        max_len = 0
        has_decimals = False

        for v in non_nulls:
            s = str(v).strip()
            max_len = max(max_len, len(s))

            # Check boolean
            if s.lower() not in ("true", "false", "0", "1", "yes", "no", "y", "n"):
                is_bool = False

            # Check int
            if is_int:
                try:
                    # Avoid parsing strings like "00123" as int if leading zero matters,
                    # but if it has no leading zero or is "0", it's integer
                    if (
                        s.startswith("0") and len(s) > 1 and not s.startswith("0.")
                    ) or not re.match(r"^-?\d+$", s):
                        is_int = False
                    else:
                        num = int(s)
                        max_int_val = max(max_int_val, num)
                        min_int_val = min(min_int_val, num)
                except ValueError:
                    is_int = False

            # Check float / decimal
            if is_float:
                try:
                    f = float(s)
                    if "." in s:
                        has_decimals = True
                except ValueError:
                    is_float = False

            # Check date / datetime
            if is_datetime:
                if not (cls.ISO_DATETIME_RE.match(s) or cls.ISO_DATE_RE.match(s)):
                    is_datetime = False

            if is_date:
                if not cls.ISO_DATE_RE.match(s):
                    if cls.ISO_DATETIME_RE.match(s) and s.endswith("00:00:00"):
                        pass  # Can be treated as date if time is midnight
                    else:
                        is_date = False

        # Priority resolution
        if is_int:
            if min_int_val < -2147483648 or max_int_val > 2147483647:
                return "BIGINT"
            return "INT"

        if is_float and has_decimals:
            return "DECIMAL(18, 4)"

        if is_date:
            return "DATE"

        if is_datetime:
            return "DATETIME"

        # String sizing
        if max_len <= 30:
            return "VARCHAR(50)"
        elif max_len <= 100:
            return "VARCHAR(150)"
        elif max_len <= 255:
            return "VARCHAR(255)"
        elif max_len <= 1000:
            return "VARCHAR(1000)"
        else:
            return "TEXT"


# ==============================================================================
# MySQL SQL Formatter & Value Escaper
# ==============================================================================


class MySqlFormatter:
    """Escapes values and formats SQL statements safely."""

    @staticmethod
    def escape_identifier(name: str) -> str:
        """Encloses identifier in backticks and escapes embedded backticks."""
        clean = name.replace("`", "``")
        return f"`{clean}`"

    @classmethod
    def format_value(cls, val: Any, col_type: str) -> str:
        """Formats a cell value for an SQL INSERT statement."""
        if val is None:
            return "NULL"

        s = str(val).strip()
        if s == "" or s.lower() == "nan" or s.lower() == "null" or s.lower() == "none":
            return "NULL"

        # Integer formatting
        if col_type in ("INT", "BIGINT"):
            try:
                # If value is float string like "123.0", convert cleanly to int
                f = float(s)
                return str(int(round(f)))
            except ValueError:
                pass

        # Decimal / Float formatting
        if "DECIMAL" in col_type or col_type in ("FLOAT", "DOUBLE"):
            try:
                f = float(s)
                # Keep fixed representation or exact string if valid float
                return s
            except ValueError:
                pass

        # Date / Datetime formatting
        if col_type in ("DATE", "DATETIME"):
            # Normalize ISO string "2026-07-06T00:00:00" -> "2026-07-06 00:00:00"
            s = s.replace("T", " ")
            if col_type == "DATE" and " " in s:
                s = s.split(" ")[0]
            # Strip fractional seconds if any
            if "." in s and col_type in ("DATE", "DATETIME"):
                s = s.split(".")[0]
            return f"'{s}'"

        # String escaping (standard MySQL escape sequences)
        escaped = (
            s.replace("\\", "\\\\")
            .replace("'", "\\'")
            .replace("\0", "\\0")
            .replace("\n", "\\n")
            .replace("\r", "\\r")
            .replace("\t", "\\t")
        )
        return f"'{escaped}'"


# ==============================================================================
# Main Generator Engine
# ==============================================================================


class ExcelToMySqlGenerator:
    """Orchestrates reading Excel, inferring schema, and writing MySQL dump file."""

    def __init__(
        self,
        excel_path: str,
        output_sql_path: str,
        db_name: Optional[str] = None,
        table_name: Optional[str] = None,
        sheet_spec: Optional[str] = None,
        batch_size: int = 500,
        sanitize_names: bool = True,
        include_id: bool = True,
        include_drop: bool = True,
    ):
        self.excel_path = os.path.abspath(excel_path)
        self.output_sql_path = os.path.abspath(output_sql_path)
        self.batch_size = max(1, batch_size)
        self.sanitize_names = sanitize_names
        self.include_id = include_id
        self.include_drop = include_drop

        # Default database name derived from excel filename
        base_name = os.path.splitext(os.path.basename(self.excel_path))[0]
        self.db_name = (
            sanitize_identifier(db_name)
            if db_name
            else sanitize_identifier(base_name, fallback_prefix="db")
        )
        self.table_name_override = (
            sanitize_identifier(table_name) if table_name else None
        )
        self.sheet_spec = sheet_spec

    def generate(self) -> Dict[str, Any]:
        """Runs the conversion pipeline and writes output .sql file."""
        if not os.path.exists(self.excel_path):
            raise FileNotFoundError(f"Input file not found: {self.excel_path}")

        print(f"[*] Opening Excel file: {self.excel_path}")
        reader = BuiltinXlsxReader(self.excel_path)
        available_sheets = reader.get_sheet_names()
        print(
            f"[*] Found {len(available_sheets)} sheet(s): {', '.join(available_sheets)}"
        )

        # Determine target sheet
        target_sheet = self.sheet_spec if self.sheet_spec else available_sheets[0]
        print(f"[*] Processing sheet: '{target_sheet}'")

        # Read rows
        row_generator = reader.stream_sheet_rows(target_sheet)

        try:
            header_row = next(row_generator)
        except StopIteration:
            raise ValueError(f"Worksheet '{target_sheet}' is empty.")

        # Determine table name
        tbl_name = self.table_name_override or sanitize_identifier(
            target_sheet, fallback_prefix="data_table"
        )

        # Process column headers
        raw_headers = [str(c).strip() if c is not None else "" for c in header_row]
        num_cols = len(raw_headers)

        if self.sanitize_names:
            col_names = [
                sanitize_identifier(h, fallback_prefix=f"col_{i + 1}")
                for i, h in enumerate(raw_headers)
            ]
        else:
            col_names = [h if h else f"col_{i + 1}" for i, h in enumerate(raw_headers)]

        col_names = deduplicate_names(col_names)
        print(f"[*] Detected {num_cols} columns.")

        # Collect rows into batches and sample for type inference
        print("[*] Sampling and buffering data rows...")
        all_rows: List[List[Any]] = []
        col_samples: List[List[Any]] = [[] for _ in range(num_cols)]

        row_count = 0
        for row in row_generator:
            row_count += 1
            # Pad row if shorter than num_cols
            padded = (
                row + [None] * (num_cols - len(row))
                if len(row) < num_cols
                else row[:num_cols]
            )
            all_rows.append(padded)

            # Sample first 1,000 non-null values per column for type inference
            for i, val in enumerate(padded):
                if (
                    val is not None
                    and str(val).strip() != ""
                    and len(col_samples[i]) < 1000
                ):
                    col_samples[i].append(val)

            if row_count % 5000 == 0:
                print(f"    ...read {row_count} rows")

        reader.close()
        print(f"[*] Total data rows: {row_count}")

        # Infer MySQL types for each column
        print("[*] Inferring column data types...")
        col_types = []
        for i in range(num_cols):
            inferred = TypeInferrer.infer_type(col_samples[i])
            col_types.append(inferred)

        # Ensure output directory exists
        os.makedirs(os.path.dirname(self.output_sql_path), exist_ok=True)

        print(f"[*] Writing MySQL dump to: {self.output_sql_path}")
        with open(self.output_sql_path, "w", encoding="utf-8") as f:
            self._write_dump_header(f)
            self._write_create_database(f)
            self._write_create_table(f, tbl_name, col_names, col_types)
            self._write_insert_statements(f, tbl_name, col_names, col_types, all_rows)
            self._write_dump_footer(f)

        file_size_mb = os.path.getsize(self.output_sql_path) / (1024 * 1024)
        print(f"[+] MySQL dump successfully created ({file_size_mb:.2f} MB)")

        return {
            "database": self.db_name,
            "table": tbl_name,
            "columns": col_names,
            "types": col_types,
            "rows": row_count,
            "output_file": self.output_sql_path,
            "file_size_mb": round(file_size_mb, 2),
        }

    def _write_dump_header(self, f):
        now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        f.write(
            "-- =============================================================================\n"
        )
        f.write("-- MySQL Database Dump generated from Excel\n")
        f.write(f"-- Source File: {os.path.basename(self.excel_path)}\n")
        f.write(f"-- Generated At: {now}\n")
        f.write(
            "-- =============================================================================\n\n"
        )
        f.write("/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;\n")
        f.write("/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;\n")
        f.write("/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;\n")
        f.write("/*!40101 SET NAMES utf8mb4 */;\n")
        f.write(
            "/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;\n"
        )
        f.write(
            "/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;\n"
        )
        f.write(
            "/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;\n"
        )
        f.write("/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;\n\n")

    def _write_create_database(self, f):
        db_escaped = MySqlFormatter.escape_identifier(self.db_name)
        f.write(
            "-- -----------------------------------------------------------------------------\n"
        )
        f.write(f"-- Database: {db_escaped}\n")
        f.write(
            "-- -----------------------------------------------------------------------------\n"
        )
        f.write(f"CREATE DATABASE /*!32312 IF NOT EXISTS*/ {db_escaped} ")
        f.write(
            "/*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci */;\n"
        )
        f.write(f"USE {db_escaped};\n\n")

    def _write_create_table(
        self, f, tbl_name: str, col_names: List[str], col_types: List[str]
    ):
        tbl_escaped = MySqlFormatter.escape_identifier(tbl_name)
        f.write(
            "-- -----------------------------------------------------------------------------\n"
        )
        f.write(f"-- Table structure for table: {tbl_escaped}\n")
        f.write(
            "-- -----------------------------------------------------------------------------\n"
        )
        if self.include_drop:
            f.write(f"DROP TABLE IF EXISTS {tbl_escaped};\n")

        f.write("/*!40101 SET @saved_cs_client     = @@character_set_client */;\n")
        f.write("/*!40101 SET character_set_client = utf8mb4 */;\n")
        f.write(f"CREATE TABLE {tbl_escaped} (\n")

        col_defs = []
        if self.include_id:
            col_defs.append("  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY")

        for name, c_type in zip(col_names, col_types):
            esc_name = MySqlFormatter.escape_identifier(name)
            col_defs.append(f"  {esc_name} {c_type} DEFAULT NULL")

        f.write(",\n".join(col_defs))
        f.write(
            "\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n"
        )
        f.write("/*!40101 SET character_set_client = @saved_cs_client */;\n\n")

    def _write_insert_statements(
        self,
        f,
        tbl_name: str,
        col_names: List[str],
        col_types: List[str],
        rows: List[List[Any]],
    ):
        if not rows:
            return

        tbl_escaped = MySqlFormatter.escape_identifier(tbl_name)
        col_list_str = ", ".join(MySqlFormatter.escape_identifier(c) for c in col_names)

        f.write(
            "-- -----------------------------------------------------------------------------\n"
        )
        f.write(f"-- Dumping data for table: {tbl_escaped} ({len(rows)} records)\n")
        f.write(
            "-- -----------------------------------------------------------------------------\n"
        )
        f.write(f"LOCK TABLES {tbl_escaped} WRITE;\n")
        f.write("/*!40000 ALTER TABLE " + tbl_escaped + " DISABLE KEYS */;\n\n")

        # Batched multi-row inserts
        for batch_start in range(0, len(rows), self.batch_size):
            batch = rows[batch_start : batch_start + self.batch_size]
            f.write(f"INSERT INTO {tbl_escaped} ({col_list_str}) VALUES\n")

            row_strings = []
            for r in batch:
                formatted_vals = [
                    MySqlFormatter.format_value(r[col_idx], col_types[col_idx])
                    for col_idx in range(len(col_names))
                ]
                row_strings.append("  (" + ", ".join(formatted_vals) + ")")

            f.write(",\n".join(row_strings))
            f.write(";\n\n")

        f.write("/*!40000 ALTER TABLE " + tbl_escaped + " ENABLE KEYS */;\n")
        f.write("UNLOCK TABLES;\n\n")

    def _write_dump_footer(self, f):
        f.write(
            "-- =============================================================================\n"
        )
        f.write("-- Dump Completed\n")
        f.write(
            "-- =============================================================================\n"
        )
        f.write("/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;\n")
        f.write("/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;\n")
        f.write("/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;\n")
        f.write("/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;\n")
        f.write("/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;\n")
        f.write("/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;\n")
        f.write("/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;\n")


# ==============================================================================
# CLI Entry Point
# ==============================================================================


def main():
    parser = argparse.ArgumentParser(
        description="Convert an Excel (.xlsx) file into a complete, ready-to-run MySQL dump script (.sql)."
    )
    parser.add_argument("excel_file", help="Path to input Excel (.xlsx) file")
    parser.add_argument(
        "-o", "--output", help="Path to output .sql file (default: <filename>.sql)"
    )
    parser.add_argument(
        "-d", "--database", help="MySQL database name (default: derived from filename)"
    )
    parser.add_argument(
        "-t", "--table", help="MySQL table name (default: derived from sheet name)"
    )
    parser.add_argument(
        "-s", "--sheet", help="Worksheet name or index to export (default: first sheet)"
    )
    parser.add_argument(
        "-b",
        "--batch-size",
        type=int,
        default=500,
        help="Number of rows per INSERT batch (default: 500)",
    )
    parser.add_argument(
        "--preserve-names",
        action="store_true",
        help="Preserve original Excel column names verbatim instead of sanitizing to snake_case",
    )
    parser.add_argument(
        "--no-id",
        action="store_true",
        help="Do not add auto-incrementing id PRIMARY KEY column",
    )
    parser.add_argument(
        "--no-drop",
        action="store_true",
        help="Do not include DROP TABLE IF EXISTS statement",
    )

    args = parser.parse_args()

    excel_file = os.path.abspath(args.excel_file)
    if not os.path.isfile(excel_file):
        print(f"Error: Excel file not found: {excel_file}", file=sys.stderr)
        sys.exit(1)

    if args.output:
        output_file = os.path.abspath(args.output)
    else:
        base = os.path.splitext(excel_file)[0]
        output_file = f"{base}.sql"

    generator = ExcelToMySqlGenerator(
        excel_path=excel_file,
        output_sql_path=output_file,
        db_name=args.database,
        table_name=args.table,
        sheet_spec=args.sheet,
        batch_size=args.batch_size,
        sanitize_names=not args.preserve_names,
        include_id=not args.no_id,
        include_drop=not args.no_drop,
    )

    try:
        summary = generator.generate()
        print("\n================== SUMMARY ==================")
        print(f" Database:     {summary['database']}")
        print(f" Table:        {summary['table']}")
        print(f" Total Rows:   {summary['rows']}")
        print(f" Total Cols:   {len(summary['columns'])}")
        print(f" Dump Size:    {summary['file_size_mb']} MB")
        print(f" Output File:  {summary['output_file']}")
        print("=============================================\n")
        print("Import into MySQL with:")
        print(f'  mysql -u root -p < "{summary["output_file"]}"')
    except Exception as e:
        print(f"Error generating MySQL dump: {e}", file=sys.stderr)
        import traceback

        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()

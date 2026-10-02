# Excel to MySQL Data Script Generator

A fast, reliable, standalone Python program that converts any Excel spreadsheet (`.xlsx`) into a ready-to-run MySQL database dump script (`.sql`), featuring both a **CLI tool** and an interactive **Streamlit Web UI**.

## Features

- **Everything Included in SQL Output**:
  - `CREATE DATABASE /*!32312 IF NOT EXISTS*/`
  - `USE <database>`
  - `DROP TABLE IF EXISTS`
  - `CREATE TABLE` with smart type inference
  - `INSERT INTO` statements (high-performance batched multi-row inserts)
  - `LOCK TABLES` / `UNLOCK TABLES` and `DISABLE/ENABLE KEYS` for rapid loading
  - Universal session safeguards (`utf8mb4`, foreign key checks, sql modes)
- **Zero External Dependencies for CLI**:
  - Built-in OpenXML streaming parser runs on standard Python 3.8+ using `zipfile` and `xml.etree.ElementTree`. No external packages required for the CLI!
- **Interactive Streamlit Web UI**:
  - Drag-and-drop file uploader, sample dataset loader, live row & schema inspection, customizable dump parameters, and one-click `.sql` download.
- **Automatic Schema & Type Inference**:
  - Automatically analyzes values to determine `INT`, `BIGINT`, `DECIMAL(18, 4)`, `DATE`, `DATETIME`, `VARCHAR(N)`, or `TEXT`.
  - Normalizes ISO 8601 timestamps (`YYYY-MM-DDTHH:MM:SS`) to MySQL datetime format (`YYYY-MM-DD HH:MM:SS`).
- **Safe SQL Formatting & Escaping**:
  - Handles single quotes (`'`), backslashes (`\`), null bytes (`\0`), newlines (`\n`, `\r`), and `NULL` values.
  - Encloses all table and column names in backticks.
- **Identifier Sanitization**:
  - Automatically converts messy Excel column titles (spaces, symbols like `$`, `%`, `#`, `-`) to clean MySQL `snake_case` column identifiers.
  - Deduplicates repeated column headers.
  - Option to preserve raw column names via `--preserve-names`.
- **Auto-Incrementing Primary Key**:
  - Automatically prepends an `id INT NOT NULL AUTO_INCREMENT PRIMARY KEY` column for optimal indexing and ORM/BI tool compatibility (can be disabled via `--no-id`).

---

## Project Structure & Dependencies

Dependencies and project metadata are defined in [`pyproject.yaml`](file:///d:/Projects/pocs/bi/mysql-generator/pyproject.yaml):

```yaml
project:
  name: "mysql-generator"
  version: "0.1.0"
  requires-python: ">=3.8"

dependencies:
  - "streamlit>=1.30.0"
  - "openpyxl>=3.1.2"
```

To install the optional dependencies for the Streamlit UI:
```bash
pip install streamlit openpyxl
```

---

## 1. Streamlit Web UI

To launch the interactive web application:

```bash
streamlit run app.py --server.address 127.0.0.1 --server.port 12204
```

### Features in the Web UI:
1. **Upload or Sample**: Drag-and-drop any `.xlsx` file, or click "Use Sample Dataset" to test with `Thermo_Fisher_12_Week_Data_Recent.xlsx`.
2. **Data & Schema Preview**: View the first 25 rows and see the inferred MySQL column types before generating SQL.
3. **Configuration**: Edit database name, table name, worksheet selection, and batch size.
4. **Download**: Click "Generate MySQL Dump Script" and download the `.sql` file directly.

---

## 2. Command Line Interface (CLI)

The CLI script operates with zero required packages:

### Basic Usage
```bash
python excel_to_mysql.py "path/to/your/file.xlsx"
```
Automatically generates `path/to/your/file.sql`.

### Example with Sample Data
```bash
python excel_to_mysql.py "D:\Projects\pocs\bi\samples\thermofisher-sample-data\actual-template-based-sample-data\Thermo_Fisher_12_Week_Data_Recent.xlsx" -o "thermo_fisher_dump.sql" -d "thermo_fisher_bi" -t "sales_snapshot_data"
```

### CLI Options

| Option | Short | Default | Description |
| :--- | :--- | :--- | :--- |
| `excel_file` | | *(Required)* | Path to the source `.xlsx` file |
| `--output` | `-o` | `<excel_name>.sql` | Destination path for the `.sql` dump file |
| `--database` | `-d` | Derived from file name | Name of the MySQL database to create/use |
| `--table` | `-t` | Derived from sheet name | Name of the MySQL table to create |
| `--sheet` | `-s` | First sheet | Specific sheet name or 0-based index to export |
| `--batch-size` | `-b` | `500` | Number of rows per `INSERT` statement |
| `--preserve-names` | | `False` | Preserve original column names verbatim (otherwise sanitizes to snake_case) |
| `--no-id` | | `False` | Omit auto-incrementing `id` primary key column |
| `--no-drop` | | `False` | Omit `DROP TABLE IF EXISTS` statement |

---

## 3. Importing the Generated Script into MySQL

### Via MySQL Command Line
```bash
mysql -u root -p < thermo_fisher_dump.sql
```

Or with host and port:
```bash
mysql -h localhost -P 3306 -u root -p < thermo_fisher_dump.sql
```

### Via GUI Client (DBeaver, MySQL Workbench, phpMyAdmin)
1. Open your database client and connect to your MySQL server.
2. Open the generated `.sql` file (`File -> Open SQL Script`).
3. Execute the script. The database, table schema, and all data rows will be loaded automatically.

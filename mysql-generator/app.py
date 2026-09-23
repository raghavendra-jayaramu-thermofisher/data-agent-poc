#!/usr/bin/env python3
"""
Excel to MySQL Generator - Streamlit Web UI
Interactive web application to inspect Excel workbooks, configure database/table options,
preview inferred schemas, generate complete MySQL dump scripts (.sql), and download them directly.
"""

import os
import sys
import tempfile
import time
from typing import List, Dict, Any

try:
    import streamlit as st
except ImportError:
    print(
        "Streamlit is not installed. Please run: pip install streamlit", file=sys.stderr
    )
    sys.exit(1)

# Import backend generator logic
from excel_to_mysql import (
    BuiltinXlsxReader,
    ExcelToMySqlGenerator,
    TypeInferrer,
    sanitize_identifier,
)

SAMPLE_EXCEL_PATH = r"D:\Projects\pocs\bi\samples\thermofisher-sample-data\actual-template-based-sample-data\Thermo_Fisher_12_Week_Data_Recent.xlsx"


def main():
    st.set_page_config(
        page_title="Excel to MySQL Generator",
        page_icon="🗄️",
        layout="wide",
        initial_sidebar_state="expanded",
    )

    # Custom styling
    st.markdown(
        """
        <style>
        .main-header {
            font-size: 2.2rem;
            font-weight: 700;
            color: #1E3A8A;
            margin-bottom: 0.2rem;
        }
        .sub-header {
            font-size: 1.05rem;
            color: #4B5563;
            margin-bottom: 1.5rem;
        }
        .stat-card {
            background-color: #F3F4F6;
            border-radius: 8px;
            padding: 12px;
            text-align: center;
        }
        </style>
        """,
        unsafe_allow_html=True,
    )

    st.markdown(
        '<div class="main-header">🗄️ Excel to MySQL Data Script Generator</div>',
        unsafe_allow_html=True,
    )
    st.markdown(
        '<div class="sub-header">Convert any Excel spreadsheet (.xlsx) into a complete, ready-to-run MySQL dump file with CREATE DATABASE, CREATE TABLE, and batched INSERT statements.</div>',
        unsafe_allow_html=True,
    )

    # Sidebar: Source Selection & Configuration
    st.sidebar.header("📁 Source Excel File")

    file_source = st.sidebar.radio(
        "Choose file source:",
        options=["Upload Excel File (.xlsx)", "Use Sample Dataset"]
        if os.path.exists(SAMPLE_EXCEL_PATH)
        else ["Upload Excel File (.xlsx)"],
        index=0,
    )

    excel_file_path = None
    original_filename = "data.xlsx"

    if file_source == "Upload Excel File (.xlsx)":
        uploaded_file = st.sidebar.file_uploader("Upload .xlsx file", type=["xlsx"])
        if uploaded_file:
            original_filename = uploaded_file.name
            # Save to temporary file for streaming reader
            temp_dir = tempfile.gettempdir()
            excel_file_path = os.path.join(
                temp_dir, f"upload_{int(time.time())}_{uploaded_file.name}"
            )
            with open(excel_file_path, "wb") as f:
                f.write(uploaded_file.getbuffer())
    else:
        if os.path.exists(SAMPLE_EXCEL_PATH):
            excel_file_path = SAMPLE_EXCEL_PATH
            original_filename = os.path.basename(SAMPLE_EXCEL_PATH)
            st.sidebar.success(f"Using local sample:\n`{original_filename}`")

    if not excel_file_path:
        st.info("👆 Please upload an Excel (.xlsx) file in the sidebar to get started.")
        st.markdown(
            """
            ### What this tool does:
            - **Parses Excel workbooks** with zero required dependencies using pure Python.
            - **Infers smart MySQL types** (`INT`, `BIGINT`, `DECIMAL`, `DATE`, `DATETIME`, `VARCHAR`, `TEXT`).
            - **Generates complete MySQL scripts**:
              - `CREATE DATABASE IF NOT EXISTS ...`
              - `USE <database>;`
              - `DROP TABLE IF EXISTS ...`
              - `CREATE TABLE ...` with auto-incrementing `id` primary key
              - High-performance multi-row batched `INSERT` statements
            - **Escapes special characters** (single quotes, backslashes, newlines, null bytes).
            """
        )
        return

    # Inspect Workbook
    try:
        reader = BuiltinXlsxReader(excel_file_path)
        sheets = reader.get_sheet_names()
    except Exception as e:
        st.error(f"Failed to read Excel workbook: {e}")
        return

    # Sidebar options
    st.sidebar.markdown("---")
    st.sidebar.header("⚙️ Dump Configuration")

    default_db = sanitize_identifier(
        os.path.splitext(original_filename)[0], fallback_prefix="my_database"
    )
    db_name = st.sidebar.text_input("Database Name", value=default_db)

    selected_sheet = st.sidebar.selectbox("Select Worksheet", options=sheets, index=0)
    default_table = sanitize_identifier(selected_sheet, fallback_prefix="data_table")
    table_name = st.sidebar.text_input("Table Name", value=default_table)

    batch_size = st.sidebar.slider(
        "INSERT Batch Size (rows)", min_value=100, max_value=2000, value=500, step=100
    )

    st.sidebar.markdown("---")
    st.sidebar.header("🔧 Options")
    sanitize_names = st.sidebar.checkbox(
        "Sanitize column names to snake_case", value=True
    )
    include_id = st.sidebar.checkbox(
        "Include auto-increment Primary Key (`id`)", value=True
    )
    include_drop = st.sidebar.checkbox("Include `DROP TABLE IF EXISTS`", value=True)

    # Read preview rows
    try:
        row_stream = reader.stream_sheet_rows(selected_sheet)
        header_row = next(row_stream)
        raw_headers = [str(h).strip() if h is not None else "" for h in header_row]

        # Read up to 25 sample rows for preview and schema display
        preview_rows = []
        for _ in range(25):
            try:
                row = next(row_stream)
                padded = (
                    row + [None] * (len(raw_headers) - len(row))
                    if len(row) < len(raw_headers)
                    else row[: len(raw_headers)]
                )
                preview_rows.append(padded)
            except StopIteration:
                break
    except Exception as e:
        st.error(f"Error reading rows from sheet '{selected_sheet}': {e}")
        reader.close()
        return

    reader.close()

    # Column display names
    if sanitize_names:
        final_col_names = [
            sanitize_identifier(h, fallback_prefix=f"col_{i + 1}")
            for i, h in enumerate(raw_headers)
        ]
    else:
        final_col_names = [
            h if h else f"col_{i + 1}" for i, h in enumerate(raw_headers)
        ]

    # Quick metrics display
    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("Source File", original_filename)
    with col2:
        st.metric("Worksheet", selected_sheet)
    with col3:
        st.metric("Total Columns", len(raw_headers))
    with col4:
        st.metric("Batch Size", f"{batch_size} rows")

    # Tabs for Preview
    tab_data, tab_schema = st.tabs(["📊 Data Preview", "🧬 Inferred Column Types"])

    with tab_data:
        st.caption(f"Showing sample preview of first {len(preview_rows)} rows:")
        preview_data = [
            {
                final_col_names[i]: (row[i] if i < len(row) else None)
                for i in range(len(final_col_names))
            }
            for row in preview_rows
        ]
        try:
            import pandas as pd

            st.dataframe(pd.DataFrame(preview_data), use_container_width=True)
        except ImportError:
            st.dataframe(preview_data, use_container_width=True)

    with tab_schema:
        schema_rows = []
        for i, col_name in enumerate(final_col_names):
            samples = [
                r[i]
                for r in preview_rows
                if r[i] is not None and str(r[i]).strip() != ""
            ]
            inferred = TypeInferrer.infer_type(samples)
            sample_val = str(samples[0]) if samples else "NULL"
            if len(sample_val) > 40:
                sample_val = sample_val[:37] + "..."
            schema_rows.append(
                {
                    "Column Index": i + 1,
                    "Original Header": raw_headers[i],
                    "SQL Column Name": col_name,
                    "Inferred MySQL Type": inferred,
                    "Sample Value": sample_val,
                }
            )
        try:
            import pandas as pd

            st.dataframe(pd.DataFrame(schema_rows), use_container_width=True)
        except ImportError:
            st.dataframe(schema_rows, use_container_width=True)

    st.markdown("---")

    # Generate Action
    gen_col1, gen_col2 = st.columns([1, 1])

    temp_out_dir = tempfile.gettempdir()
    output_sql_path = os.path.join(temp_out_dir, f"{db_name}_{int(time.time())}.sql")

    if st.button(
        "🚀 Generate MySQL Dump Script", type="primary", use_container_width=True
    ):
        with st.spinner("Generating MySQL dump..."):
            generator = ExcelToMySqlGenerator(
                excel_path=excel_file_path,
                output_sql_path=output_sql_path,
                db_name=db_name,
                table_name=table_name,
                sheet_spec=selected_sheet,
                batch_size=batch_size,
                sanitize_names=sanitize_names,
                include_id=include_id,
                include_drop=include_drop,
            )

            start_t = time.time()
            summary = generator.generate()
            elapsed = time.time() - start_t

        st.success(
            f"✅ MySQL dump generated successfully in **{elapsed:.2f} seconds**! "
            f"({summary['rows']:,} rows, {len(summary['columns'])} columns, {summary['file_size_mb']} MB)"
        )

        # Read SQL file for download and preview
        with open(output_sql_path, "r", encoding="utf-8") as f:
            sql_content = f.read()

        sql_download_name = f"{db_name}_{table_name}.sql"

        st.download_button(
            label="⬇️ Download MySQL Dump File (.sql)",
            data=sql_content,
            file_name=sql_download_name,
            mime="application/sql",
            type="primary",
            use_container_width=True,
        )

        st.subheader("📄 SQL Script Preview (First 50 lines)")
        preview_sql_lines = "\n".join(sql_content.splitlines()[:50])
        st.code(preview_sql_lines, language="sql")

        st.info(
            f"**To import this into your database, run:**\n"
            f'```bash\nmysql -u <user> -p < "{sql_download_name}"\n```'
        )


if __name__ == "__main__":
    main()

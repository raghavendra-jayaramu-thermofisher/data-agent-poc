# Matrix artifacts

`create_matrix` is the single new agent tool. It maps a complete stored SQL result into an
interactive matrix. Rows, columns, measures and sorting are field mappings supplied by the
model. Business filters, category definitions, calendars and measure formulas remain in the
existing knowledge and SQL workflow. The renderer and builder contain no dataset-specific rules.

## Source contract

Reference a successful `execute_sql` from the same authorized job. SQL must return one record
per detail coordinate and per requested subtotal coordinate. A truncated model preview is
allowed; a truncated stored result is rejected. Duplicate coordinates are rejected rather than
implicitly summed. Measures accept finite numbers or exact decimal strings, and NULL.

For subtotal results, provide two SQL-generated integer fields:

- `row_depth_field`: active row hierarchy prefix length, from 0 through the row-field count.
- `column_depth_field`: active column hierarchy prefix length, from 0 through the column-field count.

Full lengths identify detail cells. Intermediate lengths identify group subtotals. Zero
identifies the corresponding grand total. Derive these flags using native SQL grouping
metadata, so actual NULL dimension values remain distinct from subtotal rows. SQL can use
GROUPING SETS, ROLLUP, or a single-statement UNION ALL according to the source dialect.

Every displayed subtotal must be returned by SQL. SQL evaluates averages, distinct counts,
ratios and other measures at each requested scope; application code never adds child values
to invent a total. Cross-column totals default to off. A detail-only result is supported by
disabling all four total/subtotal options and omitting the depth fields.

Example tool mapping (all field names are illustrative SQL output aliases):

```json
{
  "sql_execution_id": "11111111-1111-4111-8111-111111111111",
  "title": "Measure by category and period",
  "rows": [{"field": "category"}, {"field": "subcategory"}],
  "columns": [{"field": "period_label", "sort_field": "period_start", "sort_type": "date"}],
  "measures": [{"field": "measure_value", "decimal_places": 2}],
  "row_depth_field": "row_depth",
  "column_depth_field": "column_depth",
  "show_row_subtotals": true,
  "show_row_grand_total": true,
  "show_column_subtotals": false,
  "show_column_grand_total": false,
  "initial_expansion_depth": 1
}
```

Sorting uses source fields, not model-supplied cell values. Numeric keys sort numerically; ISO
date/time keys sort chronologically, normalizing offsets. Sort keys must be constant for each
hierarchy member. Labels never serve as subtotal identifiers. NULL members display as `(Blank)`;
their internal IDs remain distinct from a literal string with that label.

## Display, persistence and exports

The versioned `matrix` artifact stores the specification, ordered hierarchy nodes, exact
values, source execution reference and source digest. Successful creation hides the original
flat table only after the matrix is built. Failure leaves that table unchanged. Repeated
identical creation requests in a job reuse the existing artifact.

The answer pipeline rebuilds the matrix from its persisted SQL source before accepting it as
evidence. Final-answer artifact directives and provenance use the existing infrastructure.
No matrix save-to-dashboard action is exposed.

The React view uses TanStack Table and row virtualization, with stepped rows, nested column
headers, SQL subtotals, sticky headers and first column, horizontal scrolling and keyboard
operated group buttons. Expansion preferences are stored locally by artifact ID. Column
collapse is available when SQL column subtotals are present. Expansion never changes values.

Numbers use deterministic grouping and half-up display rounding without converting decimal
strings to JavaScript Number. Missing intersections and NULL measures display blank; zero
remains zero. Source precision remains available in cell tooltips.

Copy exports the current hierarchy projection, including offscreen data rather than only
mounted virtual rows. The authenticated matrix Excel endpoint accepts only the job/artifact
IDs and collapse state. It authorizes the job organization, verifies source evidence and
reconstructs the same projection. The workbook contains grouped headers, row indentation,
subtotal styling, number formats and frozen headers/first column. Formula-looking labels
remain literal strings. Values exceeding Excel's numeric precision are exported as formatted
text, with the exact unrounded SQL value retained in a cell note.

## Deployment and limits

Apply migration `0015_matrix_artifact` before starting the updated API and workers:

```powershell
cd backend
.\.venv\Scripts\python.exe -m alembic upgrade head
```

Deploy a compatible frontend and API before enabling matrix creation in workers. Configuration:

| Setting | Default |
|---|---:|
| `AGENT_MATRIX_ENABLED` | `true` |
| `AGENT_MATRIX_MAX_NODES` | 5000 |
| `AGENT_MATRIX_MAX_COLUMNS` | 100 |
| `AGENT_MATRIX_MAX_CELLS` | 100000 |

Column and cell limits include measures and subtotal nodes. Existing stored-result row/byte
limits also apply. Limit failures request a smaller SQL aggregation; no partial matrix is
published. Set the feature flag to false to stop offering the tool while retaining support
for historical artifacts. The migration downgrade refuses to remove the artifact kind when
durable matrices exist, preserving conversation history.

## Verification

Backend tests cover source shape, exact precision, ordering, NULLs, duplicates, totals,
truncation, limits, evidence tampering, job scope, idempotency, export authorization, workbook
content and migration DDL. An unrelated sensor dataset executes real DuckDB GROUPING SETS
and AVG to verify multilevel columns and non-additive totals. Shared synthetic fixtures cover
the backend/frontend contract. Frontend tests cover parsing, rounding, expansion, reload,
copy and export state. Playwright covers desktop/mobile scrolling, sticky rows and downloads.

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest tests/unit/test_matrix.py tests/unit/test_matrix_route.py
cd ../frontend
npm run test -- --run src/analytics/matrix
$env:PLAYWRIGHT_CHANNEL = 'chrome'  # Optional installed browser; otherwise Playwright Chromium.
npx playwright test e2e/matrix.spec.ts
```

An opt-in provider evaluation checks matrix selection, explicit requests, lists, single values
and charts against the configured workspace model using synthetic result rows only. It does
not execute the model's tool calls or change datasource/job state:

```powershell
cd backend
.\.venv\Scripts\python.exe -m tests.evals.evaluate_matrix_selection --source-id SOURCE_UUID --output REPORT_PATH
```

A separate local PostgreSQL smoke test verifies the actual matrix handler, artifact constraint,
JSONB precision, evidence and idempotency inside a rollback-only transaction. It leaves no test
jobs or artifacts behind and does not invoke the destructive integration-suite fixtures:

```powershell
.\.venv\Scripts\python.exe -m tests.evals.check_matrix_persistence --source-id SOURCE_UUID
```

Dataset-specific acceptance SQL and real result captures should remain outside tracked
application code and synthetic fixtures. Business correctness is checked against the selected
source and agreed reference definitions; structural validation does not infer those definitions.

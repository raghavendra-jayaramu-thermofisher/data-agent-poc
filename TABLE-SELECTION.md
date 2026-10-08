# Table selection

On **Ask**, choose data sources, then open **Tables**. Choose **All tables** or check specific tables and views for each source, then press **Apply**. Cancel or Escape discards unfinished changes.

The selector shows the table name for one selected table and a count for multiple tables. If other sources remain unrestricted, the label also says **all in other sources**.

Selection is saved when the conversation is created and stays fixed for its follow-up questions. Open the Tables selector in an existing conversation to inspect its scope. Start a new conversation to change scope. Existing conversations default to All tables.

The catalog uses generated schema knowledge. If it is not ready, generate knowledge in Data sources. Search and Load more support large catalogs; up to 500 specific objects can be selected per source.

Selected scope filters the agent's schema discovery and validates physical SQL references before execution. Joins to unselected tables are rejected. Ambiguous unqualified names require schema qualification. Cross-database references and table functions are unavailable in selected mode. Views may read their underlying tables according to database permissions.

## Updating another installation

Run the migration from `space/poc/backend`:

```powershell
.\.venv\Scripts\python.exe -m alembic upgrade head
```

Restart the backend API and worker using the commands in `MANUAL-START.md`, then refresh the frontend. The migration has already been applied to this local installation.

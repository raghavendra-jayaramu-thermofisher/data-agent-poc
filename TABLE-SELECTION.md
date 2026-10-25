# Table selection

On **Ask**, choose data sources, then open **Tables**. Choose **All tables** or check specific tables and views for each source, then press **Apply**. Cancel or Escape discards unfinished changes.

The selector shows the table name for one selected table and a count for multiple tables. If other sources remain on all tables, the label also says **all in other sources**.

Selected tables are where the agent starts, not a restriction. When they cannot answer a question, the agent may read and query other tables in the conversation's data sources, and the answer names the extra tables it used.

Change the tables at any time from the **Tables** button in a conversation. A question that is already running keeps the tables it started with; the next question uses the new selection.

The catalog uses generated schema knowledge. If it is not ready, generate knowledge in Data sources. Search and Load more support large catalogs; up to 500 specific objects can be selected per source. Selected tables that no longer exist after knowledge is regenerated are dropped; if none remain, the source uses all tables.

## What the agent receives

With a selection, `read_knowledge_index` lists the selected tables with their type, column count and primary key, plus a count of the other tables and views. The agent requests the full index with `include_all_tables=true` only when it needs another table. Without a selection, it receives the full index.

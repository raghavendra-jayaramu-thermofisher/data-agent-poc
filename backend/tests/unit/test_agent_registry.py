from app.agent.tools import build_default_tool_registry


def test_agent_tool_surface_contains_frontend_chart_tool() -> None:
    names = [item.name for item in build_default_tool_registry().all()]
    assert names == [
        "read_knowledge_index",
        "read_table_schema",
        "execute_sql",
        "create_chart",
    ]

from app.agent.tool_schemas import (
    ChartSeriesInput,
    CreateChartArgs,
    ExecuteSQLArgs,
    ReadKnowledgeIndexArgs,
    ReadTableSchemaArgs,
)
from app.agent.tools import build_default_tool_registry


def test_agent_tool_surface_contains_frontend_chart_tool() -> None:
    tools = build_default_tool_registry().all()
    names = [item.name for item in tools]
    assert names == [
        "read_knowledge_index",
        "read_table_schema",
        "execute_sql",
        "create_chart",
    ]
    descriptions = {item.name: item.description for item in tools}
    assert "Start data discovery" in descriptions["read_knowledge_index"]
    assert "every table you intend to reference" in descriptions["read_table_schema"]
    assert "native SQL dialect" in descriptions["execute_sql"]
    assert "final grain" in descriptions["create_chart"]


def test_every_agent_tool_argument_has_a_clear_description() -> None:
    schemas = (
        ReadKnowledgeIndexArgs,
        ReadTableSchemaArgs,
        ExecuteSQLArgs,
        ChartSeriesInput,
        CreateChartArgs,
    )
    for schema in schemas:
        for field_name, field in schema.model_fields.items():
            assert field.description, f"{schema.__name__}.{field_name} needs a description"

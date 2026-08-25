from app.jobs.handlers import JobHandlerRegistry
from app.knowledge.jobs import register_knowledge_handlers


def test_knowledge_handler_registration_is_idempotent() -> None:
    registry = JobHandlerRegistry()
    register_knowledge_handlers(registry)
    register_knowledge_handlers(registry)
    assert registry.get("knowledge_generation") is not None

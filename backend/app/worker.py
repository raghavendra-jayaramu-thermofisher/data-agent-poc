from __future__ import annotations

import asyncio

from app.agent import models as agent_models  # noqa: F401
from app.agent.jobs import register_agent_handlers
from app.auth import models as auth_models  # noqa: F401
from app.audit import models as audit_models  # noqa: F401
from app.conversations import models as conversation_models  # noqa: F401
from app.core.config import get_settings
from app.core.database import close_database
from app.core.logging import configure_logging
from app.core.redis import close_redis
from app.data_sources import models as data_source_models  # noqa: F401
from app.data_sources.jobs import register_data_source_handlers
from app.jobs import models as job_models  # noqa: F401
from app.jobs.handlers import registry
from app.knowledge import models as knowledge_models  # noqa: F401
from app.knowledge.jobs import register_knowledge_handlers
from app.models import models as model_config_models  # noqa: F401
from app.organizations import models as organization_models  # noqa: F401
from app.reporting import models as reporting_models  # noqa: F401
from app.reporting.jobs import register_reporting_handlers
from app.jobs.worker import Worker


async def main() -> None:
    settings = get_settings()
    configure_logging(settings)
    register_data_source_handlers(registry)
    register_knowledge_handlers(registry)
    register_agent_handlers(registry)
    register_reporting_handlers(registry)
    worker = Worker(settings, registry)
    try:
        await worker.run()
    finally:
        await close_redis()
        await close_database()


if __name__ == "__main__":
    asyncio.run(main())

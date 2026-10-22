import uuid
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from pydantic import ValidationError

from app.agent.deep_agent import extract_usage
from app.agent.models import ModelExecution
from app.agent.repository import AgentExecutionRepository
from app.models.client import OpenAICompatibleClient
from app.models.pricing import ModelPrice, model_call_cost
from app.models.schemas import ModelProfileCreate, ModelProfileUpdate

PRICE = ModelPrice(
    input_per_million=Decimal("2.00"),
    output_per_million=Decimal("10.00"),
    cached_input_per_million=Decimal("0.10"),
)


def test_cost_charges_cached_input_at_the_cached_rate():
    cost = model_call_cost(
        PRICE, input_tokens=15_000, output_tokens=500, cached_input_tokens=10_000
    )
    # 5,000 × $2 + 10,000 × $0.10 + 500 × $10, per million tokens.
    assert cost == Decimal("0.01600000")


def test_cost_without_cached_price_uses_the_input_rate():
    price = ModelPrice(input_per_million=Decimal("2"), output_per_million=Decimal("10"))
    assert model_call_cost(
        price, input_tokens=1_000_000, output_tokens=0, cached_input_tokens=500_000
    ) == Decimal("2")


@pytest.mark.parametrize(
    "price,input_tokens,output_tokens",
    [
        (ModelPrice(None, Decimal("10")), 100, 100),
        (PRICE, None, 100),
        (PRICE, 100, None),
    ],
)
def test_cost_is_unknown_without_a_price_or_usage(price, input_tokens, output_tokens):
    assert model_call_cost(price, input_tokens=input_tokens, output_tokens=output_tokens) is None


def test_cached_tokens_never_exceed_input_tokens():
    cost = model_call_cost(PRICE, input_tokens=100, output_tokens=0, cached_input_tokens=1_000)
    assert cost == Decimal("0.00001000")


def test_provider_usage_reports_cached_input_tokens():
    usage = OpenAICompatibleClient._parse_usage(
        {
            "prompt_tokens": 1200,
            "completion_tokens": 80,
            "total_tokens": 1280,
            "prompt_tokens_details": {"cached_tokens": 1024},
        }
    )
    assert usage.cached_input_tokens == 1024
    assert OpenAICompatibleClient._parse_usage({"prompt_tokens": 5}).cached_input_tokens is None


@pytest.mark.parametrize(
    "usage,cached",
    [
        ({"input_tokens": 10, "output_tokens": 2, "input_token_details": {"cache_read": 6}}, 6),
        (
            {
                "prompt_tokens": 10,
                "completion_tokens": 2,
                "prompt_tokens_details": {"cached_tokens": 4},
            },
            4,
        ),
        ({"input_tokens": 10, "output_tokens": 2}, None),
    ],
)
def test_agent_usage_reads_cached_input_tokens(usage, cached):
    message = SimpleNamespace(usage_metadata=usage, response_metadata={})
    response = SimpleNamespace(llm_output=None, generations=[[SimpleNamespace(message=message)]])
    assert extract_usage(response)[3] == cached


@pytest.mark.asyncio
async def test_recorded_call_keeps_the_price_it_was_charged():
    profile = SimpleNamespace(
        input_price_per_million=Decimal("0.10"),
        output_price_per_million=Decimal("0.50"),
        cached_input_price_per_million=Decimal("0.01"),
    )
    session = SimpleNamespace(get=AsyncMock(return_value=profile))
    item = ModelExecution(
        model_profile_id=uuid.uuid4(),
        input_tokens=20_000,
        output_tokens=1_000,
        cached_input_tokens=0,
    )
    await AgentExecutionRepository(session).price_model_execution(item)
    assert item.cost == Decimal("0.00250000")
    profile.input_price_per_million = Decimal("9")
    assert item.input_price_per_million == Decimal("0.10")


@pytest.mark.asyncio
async def test_call_without_profile_prices_has_no_cost():
    session = SimpleNamespace(get=AsyncMock(return_value=None))
    item = ModelExecution(model_profile_id=uuid.uuid4(), input_tokens=10, output_tokens=5)
    await AgentExecutionRepository(session).price_model_execution(item)
    assert item.cost is None and item.input_price_per_million is None


def test_profile_prices_must_be_non_negative():
    base = {"connection_id": uuid.uuid4(), "display_name": "Model", "model_name": "m"}
    assert (
        ModelProfileCreate(
            **base, input_price_per_million=2, output_price_per_million=10
        ).output_price_per_million
        == 10
    )
    with pytest.raises(ValidationError):
        ModelProfileCreate(**base, input_price_per_million=-1)
    assert (
        "input_price_per_million"
        in ModelProfileUpdate(input_price_per_million=None).model_fields_set
    )

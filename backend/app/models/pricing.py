"""Model call cost from token usage and the per-million-token prices on a model profile."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

PER_MILLION = Decimal(1_000_000)


@dataclass(frozen=True, slots=True)
class ModelPrice:
    """USD per one million tokens.

    A missing cached price charges cached tokens at the input price.
    """

    input_per_million: Decimal | None
    output_per_million: Decimal | None
    cached_input_per_million: Decimal | None = None

    @property
    def complete(self) -> bool:
        return self.input_per_million is not None and self.output_per_million is not None


def model_call_cost(
    price: ModelPrice,
    *,
    input_tokens: int | None,
    output_tokens: int | None,
    cached_input_tokens: int | None = None,
) -> Decimal | None:
    """Return the USD cost of one call, or None when the price or token usage is unknown."""
    if not price.complete or input_tokens is None or output_tokens is None:
        return None
    assert price.input_per_million is not None and price.output_per_million is not None
    cached = min(max(cached_input_tokens or 0, 0), input_tokens)
    cached_rate = (
        price.cached_input_per_million
        if price.cached_input_per_million is not None
        else price.input_per_million
    )
    cost = (
        Decimal(input_tokens - cached) * price.input_per_million
        + Decimal(cached) * cached_rate
        + Decimal(output_tokens) * price.output_per_million
    ) / PER_MILLION
    return cost.quantize(Decimal("0.00000001"))

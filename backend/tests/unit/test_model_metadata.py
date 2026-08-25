from __future__ import annotations

from sqlalchemy import DateTime

from app.models.models import ModelConnection, ModelProfile


def test_model_tables_use_timezone_aware_timestamps() -> None:
    for model in (ModelConnection, ModelProfile):
        for name in ("created_at", "updated_at"):
            column = model.__table__.c[name]
            assert isinstance(column.type, DateTime)
            assert column.type.timezone is True
    assert ModelConnection.__table__.c.last_tested_at.type.timezone is True


def test_model_profile_default_is_enforced_by_partial_unique_index() -> None:
    index = next(
        item
        for item in ModelProfile.__table__.indexes
        if item.name == "uq_model_profiles_one_default_per_org"
    )
    assert index.unique is True
    where = str(index.dialect_options["postgresql"]["where"])
    assert "is_default = true" in where

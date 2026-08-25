from __future__ import annotations

import os

import pytest

if os.getenv("RUN_E2E_TESTS") != "1":
    pytest.skip("Set RUN_E2E_TESTS=1 to execute Task 1 E2E tests", allow_module_level=True)

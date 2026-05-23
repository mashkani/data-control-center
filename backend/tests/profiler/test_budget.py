"""Profile time budget."""

import pytest

from app.config import Settings
from app.services.profiler.budget import ProfileTimeBudget


def test_profile_time_budget_exhausts(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = Settings(profile_timeout_seconds=0.5)
    times = iter([0.0, 10.0])
    monkeypatch.setattr("app.services.profiler.budget.time.monotonic", lambda: next(times))
    budget = ProfileTimeBudget(settings, file_size_bytes=None)
    with pytest.raises(TimeoutError, match="exhausted"):
        budget.check()

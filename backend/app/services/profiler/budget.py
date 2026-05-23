"""Monotonic time budget for profiling work."""

from __future__ import annotations

import time

from app.config import Settings


class ProfileTimeBudget:
    def __init__(self, settings: Settings, file_size_bytes: int | None) -> None:
        timeout = settings.profile_timeout_seconds
        if file_size_bytes is not None and file_size_bytes > settings.profile_heavy_scan_max_bytes:
            timeout = max(timeout, settings.profile_large_file_timeout_seconds)
        self._deadline = time.monotonic() + timeout

    def remaining(self) -> float:
        return max(0.0, self._deadline - time.monotonic())

    def deadline(self) -> float:
        return self._deadline

    def check(self) -> None:
        if self.remaining() <= 0:
            raise TimeoutError("Profile time budget exhausted")

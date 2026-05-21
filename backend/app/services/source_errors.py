"""Shared detection for unavailable local dataset sources."""

from __future__ import annotations


MISSING_DATASET_SOURCE_MESSAGE = "Dataset source file is unavailable. Re-upload or unregister the dataset."


def is_missing_dataset_source_error(exc: Exception) -> bool:
    msg = str(exc).lower()
    return "no files found" in msg or (
        "does not exist" in msg and any(ext in msg for ext in (".csv", ".json", ".jsonl", ".parquet"))
    )

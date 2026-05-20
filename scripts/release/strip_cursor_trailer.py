"""git-filter-repo commit callback: remove Cursor co-author trailers."""

from __future__ import annotations

import re

_CURSOR_TRAILER = re.compile(
    rb"(?m)^Co-authored-by: Cursor <cursoragent@cursor.com>\s*\n?",
)


def commit_callback(commit, metadata):  # noqa: ANN001, ARG001
    commit.message = _CURSOR_TRAILER.sub(b"", commit.message)

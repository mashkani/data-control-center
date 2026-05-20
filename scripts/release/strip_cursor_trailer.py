import re

_CURSOR_TRAILER = re.compile(
    rb"(?m)^Co-authored-by: Cursor <cursoragent@cursor.com>\s*\n?",
)
commit.message = _CURSOR_TRAILER.sub(b"", commit.message)

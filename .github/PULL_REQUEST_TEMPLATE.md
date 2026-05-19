## Summary

Describe the change and the user-visible behavior.

## Validation

- [ ] [`make check`](CONTRIBUTING.md#validation) from the repo root (CI parity)
- [ ] [`make check-ci`](CONTRIBUTING.md#validation) if `frontend/package-lock.json` changed
- [ ] `cd backend && uv sync --extra dev` then `make check` if `backend/uv.lock` or `backend/pyproject.toml` changed

## Checklist

- [ ] I updated docs for setup, security, API, or workflow changes.
- [ ] I added or updated tests for changed behavior.
- [ ] I did not commit local datasets, workspace databases, upload folders, build
      output, coverage output, or cache files.
- [ ] I considered whether this affects the local-only security model.

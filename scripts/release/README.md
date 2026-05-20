# Release maintainer scripts

## Author privacy rewrite (optional)

Rewrites **all** commit author/committer emails from `faltyn.matthew@gmail.com` to
`76570855+mattfaltyn@users.noreply.github.com` and removes `Co-authored-by: Cursor`
trailers from commit messages.

**Back up first:**

```bash
git clone --mirror git@github.com:hypertrial/data-control-center.git dcc-backup.git
```

**Run from a clean checkout** (requires [git-filter-repo](https://github.com/newren/git-filter-repo)):

```bash
pip install git-filter-repo
git filter-repo --mailmap scripts/release/mailmap.txt \
  --commit-callback scripts/release/strip_cursor_trailer.py --force
git remote add origin git@github.com:hypertrial/data-control-center.git
git push --force-with-lease origin main
```

Collaborators must re-clone after a force-push; open PRs and old SHAs are invalidated.

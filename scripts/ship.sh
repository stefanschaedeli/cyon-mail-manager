#!/usr/bin/env bash
# ship.sh — summarise work since last push, update README changelog, push to GitHub
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# ── 1. Collect changes since last push ───────────────────────────────────────

UPSTREAM="origin/$(git rev-parse --abbrev-ref HEAD)"
COMMITS=$(git log "${UPSTREAM}..HEAD" --pretty=format:"- %s%n%b" 2>/dev/null || true)
DIFF_STAT=$(git diff "${UPSTREAM}..HEAD" --stat 2>/dev/null || true)

if [[ -z "$COMMITS" ]]; then
  echo "Nothing to push — no commits ahead of $UPSTREAM."
  exit 0
fi

VERSION=$(cat app/version.txt)

echo "==> Commits to push (v${VERSION}):"
echo "$COMMITS"
echo ""

# ── 2. Ask Claude to write a changelog entry for the README ──────────────────

echo "==> Asking Claude to draft README changelog entry..."

PROMPT="You are updating the README.md changelog for cyon-mail-manager v${VERSION}.

Here are the commits since the last push:
${COMMITS}

File changes:
${DIFF_STAT}

Write ONLY a single markdown changelog entry in this exact format (no extra commentary):

## v${VERSION}

- <change 1>
- <change 2>
- <change 3>

Keep bullets short, user-facing, and plain English. Max 8 bullets."

CHANGELOG_ENTRY=$(echo "$PROMPT" | claude --print --no-markdown 2>/dev/null)

echo ""
echo "==> Changelog entry:"
echo "$CHANGELOG_ENTRY"
echo ""

# ── 3. Inject entry into README.md (after the first # heading) ───────────────

README="$REPO_ROOT/README.md"

# Insert after the first blank line following the top-level heading
TMPFILE=$(mktemp)

# Find if a ## Changelog section exists; if not, add one before ## What It Does
if grep -q "^## Changelog" "$README"; then
  # Insert new entry right after "## Changelog\n"
  awk -v entry="$CHANGELOG_ENTRY" '
    /^## Changelog/ { print; print ""; print entry; print ""; next }
    { print }
  ' "$README" > "$TMPFILE"
else
  # Add a Changelog section before the first ## section
  awk -v entry="$CHANGELOG_ENTRY" '
    /^## / && !done {
      print "## Changelog\n"
      print entry
      print ""
      done=1
    }
    { print }
  ' "$README" > "$TMPFILE"
fi

mv "$TMPFILE" "$README"

# ── 4. Commit README update and push ─────────────────────────────────────────

git add README.md
git diff --cached --quiet || git commit -m "docs: update README changelog for v${VERSION}

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"

echo "==> Pushing to GitHub..."
git push

echo ""
echo "✓ Shipped v${VERSION}"

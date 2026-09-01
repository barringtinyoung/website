#!/usr/bin/env bash
#
# Render every white paper to PDF from index.html.
#
# The point of doing it this way: there is one source. The web page and the
# downloadable document are the same markup, so they cannot drift. Editing a
# paper means editing its view (and the .md beside it) and re-running this.
#
# The two-column layout lives in the @media print block in index.html and
# applies only here — a printed page is a fixed frame, so columns work; on a
# scrolling page they would mean scrolling back up once per column.
#
# Usage:  bash white-paper/make-pdfs.sh
#
set -uo pipefail
cd "$(dirname "$0")/.."

CHROME="/c/Program Files/Google/Chrome/Application/chrome.exe"
[ -x "$CHROME" ] || { echo "Chrome not found at $CHROME" >&2; exit 1; }

OUT="white-paper/pdf"
mkdir -p "$OUT"

# Git Bash gives /d/... ; Chrome needs D:/... , and & must be percent-encoded.
WIN="$(pwd -W 2>/dev/null || pwd | sed 's|^/\([a-z]\)|\1:|')"
BASE="file:///$(printf '%s' "$WIN" | sed 's/&/%26/g')/index.html"

# view id : output file name
PAPERS="whitepaper:maximizing-ai-and-ml-value
vendor-names:vendor-name-problem
expert-systems:expert-systems
rogue-it:rogue-it-spend
agents:agents-that-act-not-just-summarize
wrong-number:optimize-for-wrong-number
handover:handing-it-over-on-purpose"

fails=0
echo "source: $BASE"
echo

while IFS=: read -r view name; do
  [ -n "$view" ] || continue
  target="$OUT/$name.pdf"

  # A stale file passes a plain size check, so stamp a reference and require the
  # PDF to be newer than it. The delete can fail when the file is open in a
  # viewer — the usual reason a render does not land — so never let that abort
  # the batch, just report it.
  ref="$(mktemp)"
  rm -f "$target" 2>/dev/null || true

  profile="$(mktemp -d)"
  "$CHROME" --headless=new --disable-gpu \
            --user-data-dir="$profile" \
            --virtual-time-budget=8000 \
            --no-pdf-header-footer \
            --print-to-pdf="$WIN/$target" \
            "$BASE#$view" >/dev/null 2>&1
  rm -rf "$profile"

  if [ -s "$target" ] && [ "$target" -nt "$ref" ]; then
    printf '  %-42s %8s bytes\n' "$name.pdf" "$(wc -c < "$target")"
  else
    printf '  %-42s FAILED  (open in a PDF viewer?)\n' "$name.pdf"
    fails=$((fails + 1))
  fi
  rm -f "$ref"
done <<< "$PAPERS"

echo
if [ "$fails" -gt 0 ]; then
  echo "$fails file(s) not written — close them and re-run."
  exit 1
fi
echo "written to $OUT/"

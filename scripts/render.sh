#!/usr/bin/env bash
# Render a palette HTML file to PDF and PNG(s).
# Usage: render.sh <in.html> [outdir] [png-scale]   (default outdir = next to the html, scale 2)
# Writes <name>.pdf plus <name>.png (one page) or <name>-01.png... (one per page/slide/screen).
# Exit 0 = rendered and the layout check passed, 2 = rendered but the layout check failed.
# Chrome: set CHROME=/path/to/chrome to override the search below.
set -euo pipefail

abspath() { (cd "$(dirname "$1")" && printf '%s/%s\n' "$(pwd -P)" "$(basename "$1")"); }

in=${1:?usage: render.sh in.html [outdir] [scale]}
[[ -f $in ]] || { echo "no such file: $in" >&2; exit 1; }
in=$(abspath "$in")
out=${2:-$(dirname "$in")}; mkdir -p "$out"; out=$(cd "$out" && pwd -P)
scale=${3:-2}
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
name=$(basename "${in%.*}")

find_chrome() {
  [[ -n ${CHROME:-} ]] && { echo "$CHROME"; return; }
  local c
  for c in "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
           "/Applications/Chromium.app/Contents/MacOS/Chromium" \
           "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"; do
    [[ -x $c ]] && { echo "$c"; return; }
  done
  for c in google-chrome google-chrome-stable chromium chromium-browser microsoft-edge; do
    command -v "$c" >/dev/null 2>&1 && { command -v "$c"; return; }
  done
}
chrome=$(find_chrome || true)
[[ -n $chrome && -x $chrome ]] || { echo "Chrome or Chromium not found; set CHROME=/path/to/chrome" >&2; exit 1; }

prof=$(mktemp -d)
trap 'rm -rf "$prof"' EXIT
flags=(--headless=new --disable-gpu --no-first-run --user-data-dir="$prof" --allow-file-access-from-files
       --hide-scrollbars --virtual-time-budget=6000 --run-all-compositor-stages-before-draw)
# CI containers have no user namespace for Chrome's sandbox
[[ -n ${CI:-}${PALETTE_NO_SANDBOX:-} ]] && flags+=(--no-sandbox)

# 1. layout check (needs assets/check.js in the page)
dom=$("$chrome" "${flags[@]}" --dump-dom "file://$in" 2>/dev/null || true)
chk=$(printf '%s' "$dom" | grep -o 'data-check="[^"]*"' | head -1 || true)
notes=$(printf '%s' "$dom" | grep -o 'data-check-notes="[^"]*"' | head -1 || true)
echo "check: ${chk:-no data-check (add assets/check.js to the page)}"
[[ -n $notes ]] && echo "note:  ${notes#data-check-notes=}"

# 2. PDF at the page's own @page size (clear earlier renders first, so a 3-page run cannot leave
#    -02/-03 PNGs beside a later 1-page run)
rm -f "$out/$name.png" "$out/$name"-[0-9][0-9].png
"$chrome" "${flags[@]}" --no-pdf-header-footer --print-to-pdf="$out/$name.pdf" "file://$in" 2>/dev/null
echo "pdf:   $out/$name.pdf"

# 3. PNGs from the PDF, so PNG and PDF always match
if [[ $(uname) == Darwin ]]; then
  [[ -x $here/pdf2png ]] || swiftc -O "$here/pdf2png.swift" -o "$here/pdf2png"
  "$here/pdf2png" "$out/$name.pdf" "$out" "$scale" | sed "s|^|png:   $out/|"
elif command -v pdftoppm >/dev/null 2>&1; then
  dpi=$(awk "BEGIN{printf \"%d\", 72*$scale}")
  pages=$(pdfinfo "$out/$name.pdf" 2>/dev/null | awk '/^Pages:/{print $2}')
  if [[ ${pages:-1} == 1 ]]; then
    pdftoppm -png -r "$dpi" -singlefile "$out/$name.pdf" "$out/$name" && echo "png:   $out/$name.png"
  else
    pdftoppm -png -r "$dpi" "$out/$name.pdf" "$out/$name"
    for f in "$out/$name"-*.png; do
      n=${f##*-}; n=${n%.png}; t="$out/$name-$(printf '%02d' $((10#$n))).png"
      [[ $f == "$t" ]] || mv "$f" "$t"; echo "png:   $t"
    done
  fi
else
  echo "png:   skipped (install poppler-utils for pdftoppm)"
fi
[[ $chk == *'"OK"'* ]] || exit 2

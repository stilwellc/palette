#!/usr/bin/env bash
# Visual regression: render every template and example small, and compare each page with the saved
# reference in tests/snapshots/. Fails when a page differs from its reference by more than THRESH
# percent of its pixels (default 0.5), when a page has no reference, or when a reference has no page.
# Usage: snapshot.sh            compare, write the new renders and any diffs to ./snap-out/
#        snapshot.sh --update   replace the references with the current renders
# References are platform-specific (fonts rasterise differently), so the ones in the repo are made
# on the CI runner: download the "snapshots" artifact of a run and copy its new/ folder over
# tests/snapshots/ to accept a change. Needs ImageMagick (compare, identify).
set -euo pipefail
root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)
ref="$root/tests/snapshots"; out="$root/snap-out"; thresh=${THRESH:-0.5}
rm -rf "$out"; mkdir -p "$out/new" "$out/diff"
for f in "$root"/templates/*.html "$root"/examples/*.html; do
  grep -q 'name="palette-animation"' "$f" && continue           # animation pages are not static
  "$root/scripts/render.sh" "$f" "$out/new" 0.5 >/dev/null 2>&1 || true
done
rm -f "$out"/new/*.pdf
if [[ ${1:-} == --update ]]; then rm -rf "$ref"; mkdir -p "$ref"; cp "$out"/new/*.png "$ref"/; echo "updated $(ls "$ref" | wc -l | tr -d ' ') references"; exit 0; fi
[[ -d $ref ]] || { echo "no references yet in tests/snapshots (run with --update on the CI platform)"; exit 0; }
command -v compare >/dev/null || { echo "ImageMagick not found: cannot compare"; exit 1; }
fail=0
for n in "$out"/new/*.png; do
  b=$(basename "$n")
  [[ -f $ref/$b ]] || { echo "NEW      $b (no reference)"; fail=1; continue; }
  if [[ $(identify -format '%wx%h' "$n") != $(identify -format '%wx%h' "$ref/$b") ]]; then echo "SIZE     $b"; fail=1; continue; fi
  px=$(identify -format '%[fx:w*h]' "$n")
  ae=$(compare -metric AE -fuzz 12% "$ref/$b" "$n" "$out/diff/$b" 2>&1 | awk '{print $1}' || true)
  pct=$(awk "BEGIN{printf \"%.2f\", ${ae:-0} * 100 / $px}")
  if awk "BEGIN{exit !($pct > $thresh)}"; then echo "CHANGED  $b  ${pct}% of pixels"; fail=1; else rm -f "$out/diff/$b"; fi
done
for r in "$ref"/*.png; do [[ -f $out/new/$(basename "$r") ]] || { echo "MISSING  $(basename "$r") (reference has no render)"; fail=1; }; done
[[ $fail == 0 ]] && echo "snapshots match ($(ls "$out/new" | wc -l | tr -d ' ') pages, threshold ${thresh}%)"
exit $fail

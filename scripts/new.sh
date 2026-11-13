#!/usr/bin/env bash
# Start a new piece from a template. The copy points at this skill's assets by absolute path,
# so it renders from any folder.
# Usage: new.sh <graphic|slides|doc|dashboard> <out.html>
set -euo pipefail
kind=${1:?usage: new.sh <graphic|slides|doc|dashboard> <out.html>}
dest=${2:?usage: new.sh <graphic|slides|doc|dashboard> <out.html>}
root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)
src="$root/templates/$kind.html"
[[ -f $root/local/templates/$kind.html ]] && src="$root/local/templates/$kind.html"   # private override
[[ -f $src ]] || { echo "unknown template: $kind (graphic, slides, doc, dashboard)" >&2; exit 1; }
[[ -e $dest ]] && { echo "refusing to overwrite $dest" >&2; exit 1; }
mkdir -p "$(dirname "$dest")"
sed "s#\.\./assets/#$root/assets/#g" "$src" > "$dest"
echo "$dest  (from ${src#$root/})"

#!/usr/bin/env bash
# Start a new piece from a template. The copy points at this skill's assets by absolute path,
# so it renders from any folder.
# Usage: new.sh <kind> <out.html>   kind = a file in templates/ without .html:
#   graphic slides doc dashboard | deck whitepaper landing mobile social brand charts
set -euo pipefail
kind=${1:?usage: new.sh <kind> <out.html>}
dest=${2:?usage: new.sh <kind> <out.html>}
root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)
src="$root/templates/$kind.html"
[[ -f $root/local/templates/$kind.html ]] && src="$root/local/templates/$kind.html"   # private override
[[ -f $src ]] || { echo "unknown template: $kind ($(cd "$root/templates" && ls *.html | sed 's/\.html$//' | tr '\n' ' '))" >&2; exit 1; }
[[ -e $dest ]] && { echo "refusing to overwrite $dest" >&2; exit 1; }
mkdir -p "$(dirname "$dest")"
sed "s#\.\./assets/#$root/assets/#g" "$src" > "$dest"
echo "$dest  (from ${src#$root/})"

#!/usr/bin/env bash
# Export a palette animation page to a looping GIF.
# Usage: animate.sh <page.html> [out.gif] [--seconds N] [--fps N] [--width PX] [--hold SECONDS] [--jobs N]
#   (default out = <page>.gif next to the html, width 1440, hold 2.2 s on the last frame, 4 jobs)
# The page draws one instant per load: frame i is a headless Chrome screenshot of page.html#t=<i/fps>.
# Canvas size, duration and fps come from the page unless a flag overrides them:
#   <meta name="palette-animation" content="width=1200,height=675,seconds=7.7,fps=12.5">
# See templates/pitch.html for the contract a page has to follow.
# Chrome: set CHROME=/path/to/chrome to override the search below.
set -euo pipefail

usage="usage: animate.sh page.html [out.gif] [--seconds N] [--fps N] [--width PX] [--hold SECONDS] [--jobs N]"
abspath() { (cd "$(dirname "$1")" && printf '%s/%s\n' "$(pwd -P)" "$(basename "$1")"); }

in=; out=; seconds=; fps=; width=1440; hold=2.2; jobs=4
while (( $# )); do
  case $1 in
    --seconds) seconds=${2:?$usage}; shift 2 ;;
    --fps)     fps=${2:?$usage}; shift 2 ;;
    --width)   width=${2:?$usage}; shift 2 ;;
    --hold)    hold=${2:?$usage}; shift 2 ;;
    --jobs)    jobs=${2:?$usage}; shift 2 ;;
    -h|--help) echo "$usage"; exit 0 ;;
    --*)       echo "unknown flag: $1" >&2; echo "$usage" >&2; exit 1 ;;
    *)         if [[ -z $in ]]; then in=$1; elif [[ -z $out ]]; then out=$1; else echo "$usage" >&2; exit 1; fi; shift ;;
  esac
done
[[ -n $in ]] || { echo "$usage" >&2; exit 1; }
[[ -f $in ]] || { echo "no such file: $in" >&2; exit 1; }
in=$(abspath "$in")
out=${out:-${in%.*}.gif}; mkdir -p "$(dirname "$out")"; out=$(abspath "$out")
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)

# page defaults from <meta name="palette-animation" content="k=v,...">
meta=$(grep -o '<meta name="palette-animation"[^>]*>' "$in" | head -1 | sed -n 's/.*content="\([^"]*\)".*/\1/p' || true)
mget() { printf '%s\n' "$meta" | tr ',' '\n' | tr -d ' ' | awk -F= -v k="$1" '$1==k{print $2; exit}'; }
cw=$(mget width);  cw=${cw:-1200}
ch=$(mget height); ch=${ch:-675}
seconds=${seconds:-$(mget seconds)}
fps=${fps:-$(mget fps)}; fps=${fps:-12.5}
[[ -n $seconds ]] || { echo "no duration: pass --seconds N or add <meta name=\"palette-animation\" content=\"width=..,height=..,seconds=..,fps=..\"> to the page" >&2; exit 1; }
for v in "$cw" "$ch" "$seconds" "$fps" "$width" "$hold" "$jobs"; do
  [[ $v =~ ^[0-9]+(\.[0-9]+)?$ ]] || { echo "not a number: $v" >&2; exit 1; }
done
n=$(awk "BEGIN{n=int($seconds*$fps+0.5); print (n<1)?1:n}")
delay=$(awk "BEGIN{printf \"%.4f\", 1/$fps}")
dsf=$(awk "BEGIN{s=$width/$cw; c=int(s); if(c<s)c++; print (c<1)?1:c}")   # capture at or above the output width
(( jobs >= 1 )) || jobs=1; (( jobs > n )) && jobs=$n

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

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
frames=$tmp/frames; mkdir "$frames"

# 1. capture: job k takes frames k, k+jobs, ... with its own Chrome profile
capture() {
  local k=$1 i t f try prof="$tmp/prof$1"
  for (( i = k; i < n; i += jobs )); do
    t=$(awk "BEGIN{printf \"%.4f\", $i/$fps}")
    f=$(printf '%s/%05d.png' "$frames" "$i")
    for try in 1 2 3; do
      "$chrome" --headless=new --disable-gpu --no-first-run --user-data-dir="$prof" --allow-file-access-from-files \
        --hide-scrollbars --force-device-scale-factor="$dsf" --window-size="$cw,$ch" --virtual-time-budget=1500 \
        --run-all-compositor-stages-before-draw --screenshot="$f" "file://$in#t=$t" >/dev/null 2>&1 || true
      [[ -s $f ]] && break
    done
  done
  rm -rf "$prof"
}
echo "frames: $n at ${fps} fps, ${cw}x${ch} @${dsf}x, $jobs jobs"
for (( k = 0; k < jobs; k++ )); do capture "$k" & done
wait
got=$(find "$frames" -name '*.png' -size +0 | wc -l | tr -d ' ')
[[ $got == "$n" ]] || { echo "captured $got of $n frames; Chrome failed on the rest" >&2; exit 1; }

# 2. downsize to --width
scaled=1
if (( $(awk "BEGIN{print ($cw*$dsf != $width)}") )); then
  if [[ $(uname) == Darwin ]]; then
    find "$frames" -name '*.png' -print0 | xargs -0 -n 8 -P "$jobs" sips --resampleWidth "$width" >/dev/null 2>&1
  elif command -v magick >/dev/null 2>&1; then
    find "$frames" -name '*.png' -print0 | xargs -0 -P "$jobs" -I{} magick {} -resize "${width}x" {}
  elif command -v convert >/dev/null 2>&1; then
    find "$frames" -name '*.png' -print0 | xargs -0 -P "$jobs" -I{} convert {} -resize "${width}x" {}
  else
    scaled=0   # ffmpeg scales below; without it the frames stay at capture size
  fi
fi

# 3. assemble a looping GIF, last frame held
keep_frames() {
  local d=${out%.*}-frames
  rm -rf "$d"; mkdir -p "$d"; cp "$frames"/*.png "$d/"
  echo "gif:    skipped ($1)"
  echo "frames: $d ($n PNGs, ${delay}s each, hold the last one ${hold}s)"
  exit 3
}
if [[ $(uname) == Darwin ]]; then
  if [[ ! -x $here/frames2gif ]]; then
    command -v swiftc >/dev/null 2>&1 || keep_frames "swiftc not found; install the Xcode command line tools"
    swiftc -O "$here/frames2gif.swift" -o "$here/frames2gif"
  fi
  "$here/frames2gif" "$frames" "$out" "$delay" "$hold" >/dev/null
elif command -v ffmpeg >/dev/null 2>&1; then
  vf="tpad=stop_mode=clone:stop_duration=$(awk "BEGIN{h=$hold-$delay; printf \"%.4f\", (h<0)?0:h}")"
  (( scaled )) || vf="$vf,scale=$width:-1:flags=lanczos"
  ffmpeg -loglevel error -y -framerate "$fps" -i "$frames/%05d.png" \
    -vf "$vf,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a" -loop 0 "$out"
else
  keep_frames "install ffmpeg to assemble the GIF"
fi

size=$(wc -c < "$out" | awk '{ if ($1 >= 1048576) printf "%.1f MB", $1/1048576; else printf "%d KB", $1/1024 }')
echo "gif:    $out"
echo "        $n frames, ${width} px wide, ${delay}s per frame, last frame held ${hold}s, $size"

#!/usr/bin/env bash
# גרסת 9:16 לטלפון בפורטרט: חיתוך מרכזי 608×1080 מכל לולאה ב-content/video (הדמות ממורכזת).
set -e
cd "$(dirname "$0")/../content/video"
for f in *.mp4; do
  case "$f" in *_916.mp4) continue;; esac
  out="${f%.mp4}_916.mp4"
  [ -f "$out" ] && continue
  ffmpeg -v error -y -i "$f" -vf "crop=608:1080:656:0" -c:v libx264 -preset medium -crf 20 -movflags +faststart -an "$out"
  echo "$out"
done

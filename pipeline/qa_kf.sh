#!/usr/bin/env bash
# QA לקליף מפתח: דף פריימים + SSIM(פריים ראשון, נייטרלי) + SSIM(פריים אחרון, תמונת-מפתח). שימוש: qa_kf.sh <k>
set -e
k="$1"; d="outputs/stage3"; f="$d/${k}_kf.mp4"; kf="$d/keyframes/${k}.png"
view=$( [[ "$k" == *_side* ]] && echo side || echo front ); neutral="content/character/${view}.png"
ffmpeg -v error -y -i "$f" -vf "select='isnan(prev_selected_t)+gte(t-prev_selected_t\,0.75)',scale=640:-1,tile=3x2:margin=4:padding=4" -frames:v 1 "$d/${k}_kf_sheet.png"
ffmpeg -v error -y -i "$f" -vf "select=eq(n\,0),scale=1920:1080" -frames:v 1 "$d/_first.png"
ffmpeg -v error -y -sseof -0.05 -i "$f" -vf scale=1920:1080 -frames:v 1 "$d/_last.png"
ffmpeg -v error -y -i "$neutral" -vf scale=1920:1080 "$d/_neutral.png"
ffmpeg -v error -y -i "$kf" -vf scale=1920:1080 "$d/_kf.png"
s1=$(ffmpeg -v info -i "$d/_first.png" -i "$d/_neutral.png" -lavfi ssim -f null - 2>&1 | grep -o 'All:[0-9.]*' | cut -d: -f2)
s2=$(ffmpeg -v info -i "$d/_last.png" -i "$d/_kf.png" -lavfi ssim -f null - 2>&1 | grep -o 'All:[0-9.]*' | cut -d: -f2)
dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")
rm -f "$d/_first.png" "$d/_last.png" "$d/_neutral.png" "$d/_kf.png"
echo "$k | ${dur}s | first~neutral=${s1} | last~keyframe=${s2}"

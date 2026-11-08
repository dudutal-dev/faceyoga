#!/usr/bin/env bash
# לולאת פינג-פונג: קליף 4 ש' קדימה + אחורה = 8 ש' שמתחיל ומסתיים באותו פריים. שימוש: pingpong.sh <in.mp4> <out.mp4>
set -e
ffmpeg -v error -y -i "$1" -filter_complex "[0:v]split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1:a=0,format=yuv420p[v]" -map "[v]" -c:v libx264 -preset medium -crf 18 -movflags +faststart "$2"
ffprobe -v error -show_entries format=duration -of csv=p=0 "$2"

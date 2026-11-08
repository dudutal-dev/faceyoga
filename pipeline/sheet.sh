#!/usr/bin/env bash
# דף מרוכז 4×2 מעד 8 תמונות: sheet.sh <out.png> <img1> ... <img8>
set -e
out="$1"; shift
args=(); fc=""; n=0
for f in "$@"; do args+=(-i "$f"); fc+="[$n]scale=688:-1[s$n];"; n=$((n+1)); done
while [ $n -lt 8 ]; do args+=(-i "$1"); fc+="[$n]scale=688:-1,drawbox=c=black:t=fill[s$n];"; n=$((n+1)); done
for i in 0 1 2 3 4 5 6 7; do fc+="[s$i]"; done
fc+="xstack=inputs=8:layout=0_0|w0_0|w0+w1_0|w0+w1+w2_0|0_h0|w0_h0|w0+w1_h0|w0+w1+w2_h0"
ffmpeg -v error -y "${args[@]}" -filter_complex "$fc" -frames:v 1 "$out"

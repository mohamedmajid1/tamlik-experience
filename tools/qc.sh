#!/bin/bash
# qc.sh VIDEO OUTPREFIX — contact sheet (1 fps), loop-seam check, and per-frame brightness jumps (flicker)
set -e
V=$1; O=$2
ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate,nb_frames,profile,level,bit_rate -show_entries format=duration,size -of compact "$V"
W=$(ffprobe -v error -select_streams v:0 -show_entries stream=width -of csv=p=0 "$V" | tr -dc 0-9); H=$(ffprobe -v error -select_streams v:0 -show_entries stream=height -of csv=p=0 "$V" | tr -dc 0-9)
if [ $W -lt $H ]; then SC=180:320; T=17x4; else SC=320:180; T=10x7; fi
ffmpeg -loglevel error -y -i "$V" -vf "fps=1,scale=$SC,drawtext=text='%{n}':x=3:y=3:fontsize=13:fontcolor=white:box=1:boxcolor=black@0.5,tile=$T" "${O}_sheet_%d.png"
# per-frame mean luma; report jumps larger than 6 levels between consecutive frames (cuts/flicker)
ffmpeg -loglevel error -i "$V" -vf "scale=270:-2,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=${O}_yavg.txt" -f null -
awk -F= '/YAVG/{y=$2; if (n>0 && (y-p>6 || p-y>6)) printf "jump at frame %d: %.1f -> %.1f\n", n, p, y; p=y; n++} END {print n " frames measured"}' "${O}_yavg.txt"
# seam: last frame vs first frame
ffmpeg -loglevel error -y -sseof -0.05 -i "$V" -frames:v 1 "${O}_last.png"; ffmpeg -loglevel error -y -i "$V" -frames:v 1 "${O}_first.png"
echo "seam RMSE (last vs first, 0..1): $(compare -metric RMSE "${O}_last.png" "${O}_first.png" null: 2>&1 | grep -o '(.*)')"

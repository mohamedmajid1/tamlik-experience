#!/bin/bash
# stills.sh OUTNAME W H [URLQUERY]  -> contact sheet of one frame per 1.5 s through the loop
set -e
S=${SCRATCH:-/tmp}; OUT=$1; W=$2; H=$3; Q=${4:-}
rm -rf $S/$OUT; cd "$(dirname "$0")/.."
node tools/record.mjs --w $W --h $H --gpu gl --every 90 --start 4.5 --frames $S/$OUT > $S/$OUT.log 2>&1 || { tail -20 $S/$OUT.log; exit 1; }
grep -iE "error|EXC" $S/$OUT.log | grep -v "^ready" | head -5 || true
if [ $W -gt $H ]; then TW=480; TH=270; TILE=5x8; else TW=216; TH=384; TILE=10x4; fi
ffmpeg -loglevel error -y -pattern_type glob -i "$S/$OUT/*.png" -vf "scale=$TW:$TH,drawtext=text='%{n}':x=4:y=4:fontsize=16:fontcolor=white:box=1:boxcolor=black@0.5,tile=$TILE" -frames:v 1 $S/${OUT}_sheet.png
echo $S/${OUT}_sheet.png

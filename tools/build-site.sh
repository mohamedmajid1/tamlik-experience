#!/bin/bash
# Encode the display variants from the master renders, split them under Cloudflare Pages' 25 MiB
# per-file limit, and write site/film.json.   usage: tools/build-site.sh [portrait_master] [landscape_master]
set -euo pipefail
cd "$(dirname "$0")/.."
PM=${1:-renders/master_portrait.mp4}; LM=${2:-renders/master_landscape.mp4}
P4=renders/master_portrait_4k.mp4; L4=renders/master_landscape_4k.mp4
OUT=site; ENC=renders/enc; mkdir -p $ENC; rm -rf $OUT/v; mkdir -p $OUT/v
X264="-c:v libx264 -preset veryslow -profile:v high -pix_fmt yuv420p -sc_threshold 0 -movflags +faststart -an -colorspace bt709 -color_primaries bt709 -color_trc bt709"
enc() { # master name w h fps crf maxrate level
  local m=$1 n=$2 w=$3 h=$4 fps=$5 crf=$6 mr=$7 lvl=$8
  [ -f "$m" ] || return 0
  [ $ENC/$n.mp4 -nt "$m" ] && { echo "$n up to date"; return 0; }
  ffmpeg -loglevel error -y -i "$m" -vf "fps=$fps,scale=$w:$h:flags=lanczos" $X264 -level $lvl -crf $crf -maxrate $mr -bufsize $((${mr%M}*2))M -g $((fps*2)) -keyint_min $((fps*2)) -r $fps $ENC/$n.mp4
  echo "$n $(du -h $ENC/$n.mp4 | cut -f1)"
}
if [ -f "$PM" ]; then
  enc $PM p60 1080 1920 60 12 45M 4.2 & enc $PM p30 1080 1920 30 12 30M 4.2 & enc $PM psd 720 1280 30 21 4M 4.0 & wait
fi
if [ -f "$LM" ]; then
  enc $LM l60 1920 1080 60 12 45M 4.2 & enc $LM l30 1920 1080 30 12 30M 4.2 & enc $LM lsd 1280 720 30 21 4M 4.0 & wait
fi
[ -f "$P4" ] && enc $P4 p4k 2160 3840 60 14 90M 5.2
[ -f "$L4" ] && enc $L4 l4k 3840 2160 60 14 90M 5.2
python3 - <<'PY'
import hashlib, json, os
enc, out = 'renders/enc', 'site'
film = {}
for side, pre in (('portrait', 'p'), ('landscape', 'l')):
    for key, fps in (('4k', 60), ('60', 60), ('30', 30), ('sd', 30)):
        f = f'{enc}/{pre}{key}.mp4'
        if not os.path.exists(f): continue
        data = open(f, 'rb').read(); h = hashlib.sha256(data).hexdigest()[:10]
        parts, CH = [], 20 * 1024 * 1024
        for i in range(0, len(data), CH):
            name = f'v/{pre}{key}-{h}.{i // CH}'
            open(f'{out}/{name}', 'wb').write(data[i:i + CH])
            parts.append({'url': name, 'bytes': len(data[i:i + CH])})
        film.setdefault(side, {})[key] = {'fps': fps, 'parts': parts}
json.dump(film, open(f'{out}/film.json', 'w'), indent=1)
print(json.dumps({s: {k: sum(p['bytes'] for p in v['parts']) // 1048576 for k, v in d.items()} for s, d in film.items()}), 'MiB')
PY
mkdir -p $OUT/live && cp index.html $OUT/live/index.html
date -u +%Y%m%d%H%M%S > $OUT/version.txt

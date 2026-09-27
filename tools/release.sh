#!/bin/bash
# Full release: render the three masters from ./index.html, encode the display films, deploy to Cloudflare Pages.
# Needs: Node 22+, Google Chrome, ffmpeg, a GPU (renders take ~12-16 min each), wrangler logged in to the Tamlikoman account.
#   tools/release.sh            # render + encode + deploy
#   SKIP_RENDER=1 tools/release.sh   # only re-encode existing masters and deploy (e.g. after a player change)
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p renders
export SCRATCH=${SCRATCH:-$HOME/.cache/tamlik-rec}; mkdir -p "$SCRATCH"
if [ -z "${SKIP_RENDER:-}" ]; then
  node tools/record.mjs --w 1080 --h 1920 --scale 2 --gpu gl --crf 8 --jpeg 95 --mp4 renders/master_portrait.mp4
  node tools/record.mjs --w 1920 --h 1080 --scale 2 --gpu gl --crf 8 --jpeg 95 --mp4 renders/master_landscape.mp4
  node tools/record.mjs --w 1080 --h 1920 --scale 2 --native 1 --gpu gl --crf 10 --jpeg 97 --mp4 renders/master_portrait_4k.mp4
fi
tools/build-site.sh
date -u +%Y%m%d%H%M%S > site/version.txt
CLOUDFLARE_ACCOUNT_ID=${CLOUDFLARE_ACCOUNT_ID:-816523369947e0b0030727d6c853ff95} \
  npx wrangler pages deploy --project-name tamlik --branch main --commit-dirty=true

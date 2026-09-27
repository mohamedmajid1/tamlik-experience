# Tamlik Properties — Cinematic Loop

A self-playing, cinematic 3D film for [Tamlik Properties](https://tamlikoman.com): a flight over a procedural Muscat at dusk — the Al Hajar mountains, the Sea of Oman, a hilltop fort, the signature tower and its furnished penthouse — bookended by the 3D Tamlik logo. It loops forever with no input, made for display screens.

Built with [Three.js](https://threejs.org) and [GSAP](https://gsap.com). The film is still all in `index.html`: open it in a current browser (Chrome, Edge, Firefox or Safari) with an internet connection.

**Live:** https://tamlik.pages.dev (the display version) · https://tamlik.pages.dev/live/ (the real-time 3D version)

## How it runs on the display screens

The hallway screens are slow Android browsers, and live 3D (bloom, water reflections, 1,300 moving lights) lags on them. The film never changes and needs no input, so we **record it once to video** and the screens only play the video:

1. `tools/record.mjs` opens `index.html` in headless Chrome on a GPU and replaces the page's clock (`tools/timeshim.js`), so time only moves when the recorder says. It then captures exactly one loop, frame by frame: 3942 frames at 60 fps = 65.7 s, from one logo intro to the next, so the video loops without a visible jump. It records at twice the size and scales down for clean edges.
2. `tools/build-site.sh` encodes the display versions (1080×1920 and 1920×1080 at 60 and 30 fps, a 720p light version, and a 4K portrait version). Cloudflare Pages only accepts files up to 25 MB, so it splits each video into 20 MB parts and writes `site/film.json`.
3. `site/index.html` is the player. It downloads the parts once, keeps them in the browser's Cache Storage, and loops the video from there. It works offline and makes no requests afterwards except a small `version.txt` check every 30 minutes, which picks up new versions by itself. The first tap on the screen goes fullscreen (no install needed). If the browser blocks autoplay it shows a play button instead of a frozen picture. If the screen drops frames at 60 fps, it switches to the 30 fps film.

Links: `/` full quality · `/4k` 4K test · `/30` 30 fps · `/?nofull` never go fullscreen · `/?fps=sd` light 720p.

## Changes in this branch (look and portrait)

- **Colour story:** golden hour → blue hour → night. Haze takes the sky's colour (warm toward the sun, cool away from it) instead of black. The sky has a natural dusk gradient and sunset-lit clouds. Buildings are a mix of white limestone, sand render and grey concrete. Windows switch on as it gets dark, and street lamps light the roads at night. The boulevard is polished stone that reflects the sky. The final grade is photographic: slightly under full saturation with a gentle contrast curve.
- **Gulls:** a flock of about 34 gulls crosses the golden sky over the boulevard (film seconds ~8–17).
- **Portrait screens:** on screens narrower than 16:9 the lens opens up so the width still breathes (`?fovk=` to tune).
- **Loop-safe logo:** the logo's sway restarts with every intro. The logo renderer uses 2× supersampling instead of MSAA, because MSAA made the wordmark's front faces flicker dark on some GPUs.
- **`?record` mode:** used by the recorder (hooks: `window.__ready`, `window.__marks`, `window.__probe`).

## Making a new version

Edit `index.html`, preview it by opening the file (or `?p=0.5` to jump to a shot), then:

```bash
tools/stills.sh sheet 540 960        # quick contact sheet of the whole loop (portrait)
tools/release.sh                     # render all masters (~45 min on an RTX-class GPU) + encode + deploy
SKIP_RENDER=1 tools/release.sh       # player-only change: re-encode existing masters + deploy
tools/qc.sh renders/master_portrait.mp4 renders/qc   # contact sheet, flicker check, loop-seam check
```

Needs Node 22+, Google Chrome, ffmpeg, and for deploying, `wrangler` logged in to the Tamlik Cloudflare account (Pages project `tamlik`). Generated files (`renders/`, `site/v/`, `site/live/`, `site/film.json`) are not committed.

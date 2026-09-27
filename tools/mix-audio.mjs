// Build the film's soundtrack: one seamless loop, exactly as long as the film loop, with every sound placed on the
// film's own timeline (t = seconds from the logo appearing).   node tools/mix-audio.mjs  ->  assets/audio/loop.m4a
// Sources come from tools/fetch-assets.mjs (all public domain). Whooshes, the logo tones and the drone shimmer are
// synthesised here, tuned to the music (A minor). Needs ffmpeg.
import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rmSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (f) => join(root, 'assets', 'audio', 'src', f);
const OUT = join(root, 'assets', 'audio', 'loop.m4a');
const L = 65.7;          // film loop: 3.0 s logo + 2.4 + 56 s of shots + 3 s hold + 1.3 s to the next logo (tools/record.mjs reports the exact figure)
const XF = 4;            // music crossfade across the loop seam

// piecewise-linear gain envelope [[t, gain], ...] as an ffmpeg expression
const env = (keys) => {
  let e = String(keys[keys.length - 1][1]);
  for (let i = keys.length - 2; i >= 0; i--) {
    const [t0, v0] = keys[i], [t1, v1] = keys[i + 1];
    e = `if(lt(t,${t1}),${v0}+${v1 - v0}*(t-${t0})/${t1 - t0},${e})`;
  }
  return `if(lt(t,${keys[0][0]}),${keys[0][1]},${e})`;
};
const vol = (keys) => `volume='${env(keys)}':eval=frame`;
const place = (at) => `adelay=${Math.round(at * 1000)}|${Math.round(at * 1000)},apad,atrim=0:${L}`;

const inputs = ['-i', src('music.m4a'), '-i', src('city.ogg'), '-i', src('beach.ogg')];
const g = [];
let n = 0; const layers = [];
const layer = (chain) => { const id = `l${n++}`; g.push(`${chain}[${id}]`); layers.push(`[${id}]`); };

// music: a loop cut with an equal-power crossfade over the seam, lifting a little for the drone show and the logo
g.push(`[0:a]aformat=sample_rates=48000:channel_layouts=stereo,asplit=2[m0][m1]`);
g.push(`[m0]atrim=0:${L},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=${XF}:curve=qsin[mA]`);
g.push(`[m1]atrim=${L}:${L + XF},asetpts=PTS-STARTPTS,afade=t=out:st=0:d=${XF}:curve=qsin[mB]`);
layer(`[mA][mB]amix=inputs=2:duration=first:normalize=0,${vol([[0, 0.9], [50, 0.9], [58, 1.1], [65.7, 1.0]])}`);

// city at night (Tunis): the boulevard, then heard through the glass from inside the penthouse
g.push(`[1:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=62:${62 + L},asetpts=PTS-STARTPTS,asplit=2[c0][c1]`);
layer(`[c0]highpass=f=90,${vol([[0, 0], [11, 0], [15, 0.42], [27, 0.42], [34, 0.16], [37, 0]])}`);
layer(`[c1]lowpass=f=420,${vol([[0, 0], [36.5, 0], [38.5, 0.34], [46, 0.34], [49, 0]])}`);

// Lisbon beach: gulls (waves filtered away) as the flock crosses; the full surf at the sea and the fort
g.push(`[2:a]aformat=sample_rates=48000:channel_layouts=stereo,asplit=2[b0][b1]`);
layer(`[b0]atrim=40:${40 + L},asetpts=PTS-STARTPTS,highpass=f=1400,${vol([[0, 0], [8, 0], [11, 0.55], [21, 0.5], [25, 0]])}`);
layer(`[b1]atrim=180:${180 + L},asetpts=PTS-STARTPTS,highpass=f=40,${vol([[0, 0], [48.5, 0], [52, 0.85], [56.5, 0.85], [60, 0.22], [63.5, 0]])}`);

// high-altitude wind: brown noise in slow gusts, over the aerials, up the tower and out of the open corner
layer(`anoisesrc=c=brown:a=0.5:seed=7:d=${L}:r=48000,lowpass=f=650,highpass=f=70,aformat=channel_layouts=stereo,` +
  `volume='0.62+0.24*sin(2*PI*0.11*t)+0.14*sin(2*PI*0.047*t+1.3)':eval=frame,` +
  vol([[0, 0], [3.4, 0], [6, 0.5], [12, 0.38], [16, 0.06], [24, 0.06], [30, 0.42], [35, 0.46], [38.5, 0.05], [40, 0], [47, 0], [49.5, 0.5], [52, 0.28], [56, 0.06], [59, 0]]));

// whooshes: filtered pink noise that swells, sweeps across the stereo field and falls away
[[3.7, 2.2, 0.32], [37.1, 1.7, 0.26], [47.9, 2.3, 0.34], [64.2, 1.7, 0.28]].forEach(([at, d, gain], i) =>
  layer(`anoisesrc=c=pink:a=0.8:seed=${11 + i}:d=${d}:r=48000,highpass=f=280,lowpass=f=3200,aformat=channel_layouts=stereo,` +
    `volume='${gain}*pow(sin(PI*min(t/${d},1)),3)':eval=frame,apulsator=mode=sine:hz=${(0.5 / d).toFixed(3)}:width=0.6,${place(at)}`));

// the logo: a deep soft boom as the pieces land, then a bright A-minor chime as the light sweeps across
const boom = (at, gain) => layer(`sine=f=55:d=4:r=48000,aformat=channel_layouts=stereo,volume='${gain}*exp(-1.6*t)*min(t/0.03,1)':eval=frame,${place(at)}`);
const bell = (at, f, gain) => layer(
  `sine=f=${f}:d=4:r=48000,aformat=channel_layouts=stereo,volume='${gain}*exp(-1.9*t)*min(t/0.004,1)':eval=frame,` +
  `aecho=0.8:0.6:70|130|210:0.35|0.25|0.15,${place(at)}`);
const chime = (at, gain) => { bell(at, 659.26, gain); bell(at + 0.16, 880, gain * 0.8); bell(at + 0.34, 1318.5, gain * 0.35); };
boom(0.35, 0.5); chime(1.9, 0.07);

// drone show: an A-minor pad swells as the lights rise, a chime as the logo locks, a shimmer under the light sweep
const pad = (freqs, at, d, keys) => freqs.forEach((f, i) => layer(
  `sine=f=${f}:d=${d}:r=48000,aformat=channel_layouts=stereo,tremolo=f=${4.5 + i * 0.7}:d=0.18,` +
  `volume='${env(keys)}':eval=frame,aecho=0.8:0.7:90|160:0.3|0.2,${place(at)}`));
pad([220, 329.63, 440, 523.25], 53.5, 11, [[0, 0], [6.5, 0.035], [9.5, 0.03], [11, 0]]);
chime(60.1, 0.08);
pad([880, 1318.5, 1760], 60.6, 4.4, [[0, 0], [1.2, 0.012], [2.6, 0.012], [4.4, 0]]);

// mix, measure, then set the level (about -20 LUFS: a calm bed under a hallway, never loud) and limit the peaks
g.push(`${layers.join('')}amix=inputs=${layers.length}:duration=longest:normalize=0,atrim=0:${L}[mix]`);
const tmp = join(root, 'assets', 'audio', '_mix.wav');
execFileSync('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', g.join(';'), '-map', '[mix]', '-ar', '48000', '-c:a', 'pcm_f32le', tmp], { stdio: 'inherit' });
const report = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', tmp, '-af', 'ebur128', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
const I = +((/I:\s+(-?[\d.]+) LUFS\s*\n\s*Threshold/.exec(report) || [])[1] ?? -20);
const gain = (-20 - I).toFixed(2);
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', tmp, '-af', `volume=${gain}dB,alimiter=limit=0.84:level=false`, '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', OUT], { stdio: 'inherit' });
rmSync(tmp);
console.log(`soundtrack: ${OUT} (${L}s, ${layers.length} layers, measured ${I} LUFS, gain ${gain} dB)`);

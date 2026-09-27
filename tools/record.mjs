// Offline, frame-exact capture of the film.
//   node tools/record.mjs --url URL --w 1080 --h 1920 --fps 60 [--every N] [--start S] [--end S]
//                         [--frames DIR | --mp4 OUT.mp4] [--scale 1]
// Without --end it records exactly one loop: from the first logo intro to the next one.
import { launch, connect } from './cdp.mjs';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const A = Object.fromEntries(process.argv.slice(2).join(' ').split('--').filter(Boolean).map(s => { const [k, ...v] = s.trim().split(/\s+/); return [k, v.join(' ') || true]; }));
const W = +(A.w || 1080), H = +(A.h || 1920), FPS = +(A.fps || 60), EVERY = +(A.every || 1), SCALE = +(A.scale || 1);
const here = dirname(fileURLToPath(import.meta.url));
// with no --url, serve this repo on a free local port and record ./index.html
let url = A.url;
if (!url) {
  const { createServer } = await import('node:http');
  const { readFile } = await import('node:fs/promises');
  const { extname, resolve } = await import('node:path');
  const root = resolve(here, '..');
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
  const srv = createServer(async (req, res) => {
    const path = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/\/$/, '/index.html'));
    if (!path.startsWith(root)) { res.writeHead(403); return res.end(); }
    try { const body = await readFile(path); res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' }); res.end(body); }
    catch { res.writeHead(404); res.end(); }
  }).listen(0, '127.0.0.1');
  await new Promise(r => srv.once('listening', r));
  srv.unref();
  url = `http://127.0.0.1:${srv.address().port}/?record`;
}
const shim = readFileSync(join(here, 'timeshim.js'), 'utf8');

const { proc, page, stderr } = await launch({ w: W, h: H, gpu: A.gpu || 'vulkan', port: +(A.port || (9400 + Math.floor(Math.random() * 500))) });
const c = await connect(page.webSocketDebuggerUrl);
const logs = [];
c.on((m) => {
  if (m.method === 'Runtime.consoleAPICalled') logs.push(m.params.type + ': ' + m.params.args.map(a => a.value ?? a.description).join(' '));
  if (m.method === 'Runtime.exceptionThrown') logs.push('EXC: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
});
await c.send('Runtime.enable');
await c.send('Page.enable');
await c.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: SCALE, mobile: false });
await c.send('Page.addScriptToEvaluateOnNewDocument', { source: shim });
await c.send('Page.navigate', { url });
const t0 = Date.now();
while (!(await c.evaluate('window.__ready === true').catch(() => false))) {
  if (Date.now() - t0 > 120000) { console.error(logs.join('\n'), stderr()); throw new Error('page never became ready'); }
  await new Promise(r => setTimeout(r, 200));
}
console.error('ready in', Date.now() - t0, 'ms;', logs.filter(l => /error|EXC|warn/i.test(l)).join(' | '));

const dt = 1000 / FPS;
const start = Math.round((+(A.start || 0)) * FPS), endFixed = A.end ? Math.round(+A.end * FPS) : null;
let ff = null;
if (A.mp4) {
  ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS / EVERY), '-i', '-',
    ...(SCALE !== 1 && !A.native ? ['-vf', `scale=${W}:${H}:flags=lanczos`] : []),   // --native keeps the full device-pixel size (4K)
    '-c:v', 'libx264', '-preset', 'medium', '-crf', A.crf || '10', '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', A.mp4], { stdio: ['pipe', 'inherit', 'inherit'] });
}
if (A.frames) mkdirSync(A.frames, { recursive: true });
let k = 0, shots = 0, end = endFixed;
const tStart = Date.now();
for (;; k++) {
  await c.evaluate(`__step(${k * dt})`);
  if (end === null) {
    const marks = await c.evaluate('window.__marks');
    if (marks.length >= 2) { end = Math.round(marks[1] / dt); console.error('loop closes at frame', end, '=', (end / FPS).toFixed(3), 's'); }
  }
  if (end !== null && k >= end) break;
  if (k < start || (k - start) % EVERY) continue;
  if (A.probe) { console.log(JSON.stringify(await c.evaluate('window.__probe()'))); shots++; continue; }
  const { data } = await c.send('Page.captureScreenshot', A.jpeg ? { format: 'jpeg', quality: +A.jpeg, optimizeForSpeed: true } : { format: 'png', optimizeForSpeed: true });
  const buf = Buffer.from(data, 'base64');
  if (ff) { if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r)); }
  if (A.frames) writeFileSync(join(A.frames, `f${String(k).padStart(5, '0')}.png`), buf);
  shots++;
  if (shots % 60 === 0) console.error(`frame ${k} (${(k / FPS).toFixed(1)}s) ${((Date.now() - tStart) / shots).toFixed(0)} ms/shot`);
}
if (ff) { ff.stdin.end(); await new Promise(r => ff.on('close', r)); }
const errs = logs.filter(l => /error|EXC/i.test(l));
console.error('done:', shots, 'shots,', k, 'frames', errs.length ? '\nERRORS:\n' + errs.slice(0, 20).join('\n') : '');
c.close(); proc.kill();

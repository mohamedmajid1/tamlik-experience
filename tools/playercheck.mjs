// Load the kiosk player in headless Chrome and report playback state every few seconds.
//   node tools/playercheck.mjs URL W H DPR SECONDS OUT.png [--reload]
import { launch, connect } from './cdp.mjs';
import { writeFileSync } from 'node:fs';
const [url, w = '1080', h = '1920', dpr = '1', secs = '8', out = '/tmp/p.png', again] = process.argv.slice(2);
const { proc, page } = await launch({ w: +w, h: +h, gpu: 'gl', port: 9800 + Math.floor(Math.random() * 90), extra: ['--autoplay-policy=no-user-gesture-required'] });
const c = await connect(page.webSocketDebuggerUrl);
const logs = [];
c.on((m) => {
  if (m.method === 'Runtime.consoleAPICalled') logs.push(m.params.type + ': ' + m.params.args.map(a => a.value ?? a.description).join(' '));
  if (m.method === 'Runtime.exceptionThrown') logs.push('EXC ' + JSON.stringify(m.params.exceptionDetails).slice(0, 300));
});
await c.send('Runtime.enable'); await c.send('Page.enable'); await c.send('Network.enable');
let requests = [];
c.on((m) => { if (m.method === 'Network.requestWillBeSent') requests.push(m.params.request.url.replace(/^https?:\/\/[^/]+/, '')); });
await c.send('Emulation.setDeviceMetricsOverride', { width: +w, height: +h, deviceScaleFactor: +dpr, mobile: false, screenWidth: +w, screenHeight: +h });
const state = () => c.evaluate(`(() => { const v = document.getElementById('v'); return { t: +v.currentTime.toFixed(2), dur: v.duration, paused: v.paused, size: v.videoWidth + 'x' + v.videoHeight, cls: v.className, boot: document.getElementById('boot').className }; })()`);
async function run(label) {
  requests = [];
  await c.send('Page.navigate', { url });
  const t0 = Date.now();
  for (let i = 1; i <= +secs; i++) {
    await new Promise(r => setTimeout(r, 1000));
    if (i % 5 === 0 || i === +secs) console.log(label, `${((Date.now() - t0) / 1000).toFixed(0)}s`, JSON.stringify(await state()));
  }
  console.log(label, 'requests:', requests.length, requests.slice(0, 12).join(' '));
  console.log(label, 'cache:', JSON.stringify(await c.evaluate(`caches.open('tamlik-film').then(c => c.keys()).then(k => k.map(r => r.url.split('/').pop()))`)));
}
await run('first');
if (again) await run('reload');
if (again === '--offline') {
  await c.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await run('offline');
}
const { data } = await c.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(out, Buffer.from(data, 'base64'));
console.log(logs.join('\n') || 'no console output');
c.close(); proc.kill();

// Run the live (real-time) film for N seconds in headless Chrome, report console errors and a screenshot.
import { launch, connect } from './cdp.mjs';
import { writeFileSync } from 'node:fs';
const [url, secs = '15', out = 'live.png', w = '1280', h = '720'] = process.argv.slice(2);
const { proc, page } = await launch({ w: +w, h: +h, gpu: 'gl', port: 9900 + Math.floor(Math.random() * 90) });
const c = await connect(page.webSocketDebuggerUrl);
const logs = [];
c.on((m) => {
  if (m.method === 'Runtime.consoleAPICalled') logs.push(m.params.type + ': ' + m.params.args.map(a => a.value ?? a.description).join(' ').slice(0, 300));
  if (m.method === 'Runtime.exceptionThrown') logs.push('EXC: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 300));
});
await c.send('Runtime.enable'); await c.send('Page.enable');
await c.send('Emulation.setDeviceMetricsOverride', { width: +w, height: +h, deviceScaleFactor: 1, mobile: false });
await c.send('Page.navigate', { url });
await new Promise(r => setTimeout(r, +secs * 1000));
const { data } = await c.send('Page.captureScreenshot', { format: 'png' });
writeFileSync(out, Buffer.from(data, 'base64'));
console.log(logs.length ? logs.join('\n') : 'no console output');
c.close(); proc.kill();

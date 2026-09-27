// Does a single tap/click put the player into fullscreen? (mouse and touch)
import { launch, connect } from './cdp.mjs';
const url = process.argv[2];
for (const mode of ['mouse', 'touch']) {
  const { proc, page } = await launch({ w: 540, h: 960, gpu: 'gl', port: 9700 + Math.floor(Math.random() * 90) });
  const c = await connect(page.webSocketDebuggerUrl);
  await c.send('Page.enable');
  if (mode === 'touch') await c.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await c.send('Page.navigate', { url });
  await new Promise(r => setTimeout(r, 4000));
  const before = await c.evaluate('!!document.fullscreenElement');
  if (mode === 'mouse') {
    for (const type of ['mousePressed', 'mouseReleased']) await c.send('Input.dispatchMouseEvent', { type, x: 270, y: 480, button: 'left', clickCount: 1 });
  } else {
    await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 270, y: 480 }] });
    await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
  await new Promise(r => setTimeout(r, 1000));
  console.log(mode, 'fullscreen before:', before, 'after tap:', await c.evaluate('!!document.fullscreenElement'));
  c.close(); proc.kill();
}

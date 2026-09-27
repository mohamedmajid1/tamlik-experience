import { launch, connect } from './cdp.mjs';
const gpu = process.argv[2] || 'vulkan';
const { proc, page } = await launch({ gpu, port: 9340 + Math.floor(Math.random()*50) });
const c = await connect(page.webSocketDebuggerUrl);
const v = await c.evaluate(`(() => { const gl = document.createElement('canvas').getContext('webgl2'); if (!gl) return 'no webgl2'; const e = gl.getExtension('WEBGL_debug_renderer_info'); return gl.getParameter(e.UNMASKED_RENDERER_WEBGL); })()`);
console.log(gpu, '=>', v);
c.close(); proc.kill();

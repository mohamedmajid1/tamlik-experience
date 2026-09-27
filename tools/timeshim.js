// Virtual clock for deterministic offline capture: time only moves when the recorder calls __step(ms).
(() => {
  let vt = 0; const T0 = 1790000000000;
  const timers = new Map(); let tid = 1, rafId = 1, rafQ = [];
  performance.now = () => vt;
  Date.now = () => T0 + vt;
  window.setTimeout = (fn, ms = 0, ...a) => { const id = tid++; timers.set(id, { t: vt + Math.max(0, +ms || 0), fn, a, iv: 0 }); return id; };
  window.setInterval = (fn, ms = 0, ...a) => { const id = tid++; const iv = Math.max(1, +ms || 0); timers.set(id, { t: vt + iv, fn, a, iv }); return id; };
  window.clearTimeout = window.clearInterval = (id) => { timers.delete(id); };
  window.requestAnimationFrame = (cb) => { const id = rafId++; rafQ.push([id, cb]); return id; };
  window.cancelAnimationFrame = (id) => { rafQ = rafQ.filter((x) => x[0] !== id); };
  window.__step = (to) => {
    for (;;) {
      let best = null;
      for (const e of timers) if (e[1].t <= to && (!best || e[1].t < best[1].t)) best = e;
      if (!best) break;
      const [id, tm] = best;
      vt = Math.max(vt, tm.t);
      if (tm.iv) tm.t += tm.iv; else timers.delete(id);
      try { if (typeof tm.fn === 'function') tm.fn(...tm.a); } catch (e) { console.error(e); }
    }
    vt = Math.max(vt, to);
    const q = rafQ; rafQ = [];
    for (const [, cb] of q) { try { cb(vt); } catch (e) { console.error(e); } }
    return vt;
  };
})();

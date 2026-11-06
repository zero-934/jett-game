/**
 * @file perf.cjs
 * @purpose Render-scale cost comparison (rs = 1 / 2 / 3) at the same viewport, backend and
 *          emulated DPR: frame interval and main-thread step time percentiles, JS heap, and a
 *          framebuffer memory estimate. Headless Chromium with SwiftShader SOFTWARE WebGL:
 *          absolute numbers are NOT phone performance; only the relative scaling is informative.
 * Usage: node tests/browser/polish004/perf.cjs   (dev server on :5199)
 */
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const SCENES = { jett: ['JettScene', 'jettUI'], flap: ['FlapFortuneScene', 'flapUI'], shatter: ['ShatterStepScene', 'shatterUI'] };
const dist = (arr) => { const s = [...arr].sort((a, b) => a - b); const q = (p) => +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(2); return { n: s.length, p50: q(0.5), p95: q(0.95), p99: q(0.99) }; };
(async () => {
  const b = await chromium.launch({ args: ['--enable-precise-memory-info'] }); const rows = [];
  for (const game of Object.keys(SCENES)) for (const rs of [1, 2, 3]) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
    const p = await ctx.newPage();
    await p.goto(`http://localhost:5199/jett-game/research/harness/index.html?scene=${SCENES[game][0]}&seed=perf&rs=${rs}`);
    await p.waitForFunction(([k, u]) => window.__game?.scene.getScene(k)?.[u], SCENES[game], { timeout: 20000 });
    await p.waitForTimeout(800);
    const r = await p.evaluate(async ([k, u, game]) => {
      const g = window.__game; const ui = g.scene.getScene(k)[u];
      if (ui.round?.config) { ui.round.config.combustionFloorPerTick = 0; ui.round.config.combustionChancePerTick = 0; }
      const measure = (ms) => new Promise((res) => { const step = []; const ivl = []; let a = 0; let last = performance.now();
        const pre = () => { a = performance.now(); ivl.push(a - last); last = a; }; const post = () => step.push(performance.now() - a);
        g.events.on('prestep', pre); g.events.on('postrender', post);
        setTimeout(() => { g.events.off('prestep', pre); g.events.off('postrender', post); res({ step, ivl }); }, ms); });
      const idle = await measure(2500);
      if (game === 'shatter') { ui.onPrimary(); } else { ui.onPrimary(); if (game === 'flap') ui.onPress(); }
      const keep = setInterval(() => {
        if (game === 'flap' && ui.round) { ui.round.state.playerY = 422; ui.round.state.playerVelocityY = 0; ui.round.state.pipes.forEach((q) => { q.topHeight = 300; q.bottomHeight = 386; }); }
        if (game === 'jett' && ui.round) ui.round.state.asteroids.forEach((q) => { if (Math.abs(q.worldY - ui.round.state.altitude) < 60) q.x = q.x < 195 ? 30 : 360; });
      }, 4);
      const active = await measure(3500); clearInterval(keep);
      return { idle, active, heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null, rs: window.__renderScale(), backing: [g.canvas.width, g.canvas.height] };
    }, [...SCENES[game], game]);
    const fbMB = +((r.backing[0] * r.backing[1] * 4 * 2) / 1048576).toFixed(1); // colour back buffer + presented buffer (estimate)
    const row = { game, renderScale: r.rs.scale, backing: r.backing.join('x'), framebufferEstimateMB: fbMB, heapMB: r.heapMB, idleFrameIntervalMs: dist(r.idle.ivl), idleStepMs: dist(r.idle.step), activeFrameIntervalMs: dist(r.active.ivl), activeStepMs: dist(r.active.step) };
    rows.push(row); console.log(JSON.stringify(row));
    await ctx.close();
  }
  const out = path.resolve('docs/polish-004/evidence/perf-render-scale.json');
  fs.writeFileSync(out, JSON.stringify({ date: new Date().toISOString(), browser: `chromium ${b.version()} headless, SwiftShader software WebGL`, viewport: '390x844', emulatedDpr: 3, physicalHardware: false, caveat: 'Software rasterisation on a shared cloud CPU. Use for relative scaling only; not phone frame rates.', rows }, null, 1));
  await b.close();
})();

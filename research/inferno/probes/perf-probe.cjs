/**
 * @file perf-probe.cjs
 * @purpose RESEARCH ONLY — frame-time and resource sampling for the baseline (2977ad6, port 5181) and
 *          new (port 5180) Inferno builds in the same headless Chromium/SwiftShader environment, with and
 *          without 4× CPU throttling. Headless software WebGL is a comparison environment, not a device
 *          benchmark. Baseline spins are natural (seeded via its own RNG class); new-build spins use
 *          the cascade fixture so every sample includes a two-step cascade.
 * @author Agent 934  @date 2026-11-05  @license Proprietary – available for licensing
 */
const { chromium } = require('playwright');
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(2) : null; };
const summarize = (f) => ({ frames: f.length, p50: pct(f, 0.5), p95: pct(f, 0.95), max: f.length ? +Math.max(...f).toFixed(1) : null, longOver50ms: f.filter((x) => x > 50).length, over20ms: f.filter((x) => x > 20).length });

async function measure(build, throttle) {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  if (throttle > 1) { const cdp = await page.context().newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle }); }
  await page.addInitScript(() => { window.__frames = []; let last = performance.now(); const t = (now) => { window.__frames.push(now - last); last = now; requestAnimationFrame(t); }; requestAnimationFrame(t); });
  const url = build === 'baseline' ? 'http://localhost:5181/jett-game/research/inferno-baseline-harness/index.html' : 'http://localhost:5180/jett-game/research/inferno/harness/index.html?seed=perf';
  await page.goto(url);
  await page.waitForFunction((b) => (b === 'baseline' ? window.__b && window.__b.scene() && window.__b.scene().infernoUI : window.__inferno && window.__inferno.scene() && window.__inferno.scene().session), build, { timeout: 60000 });
  await page.waitForTimeout(800);
  const env = await page.evaluate((b) => {
    const g = b === 'baseline' ? window.__b.game : window.__inferno.game;
    const gl = g.renderer.gl; let renderer = 'canvas';
    if (gl) { const ext = gl.getExtension('WEBGL_debug_renderer_info'); renderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); }
    return { rendererType: g.renderer.type === 2 ? 'WEBGL' : 'CANVAS', glRenderer: renderer, dpr: window.devicePixelRatio, ua: navigator.userAgent, canvas: `${g.canvas.width}x${g.canvas.height}` };
  }, build);
  await page.evaluate(() => { window.__frames.length = 0; });
  await page.waitForTimeout(3000);
  const idle = await page.evaluate(() => window.__frames.slice());
  const spinFrames = []; const peaks = { tweens: 0, displayList: 0, particles: 0 };
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => { window.__frames.length = 0; });
    const p = page.evaluate(async (b) => {
      const s = b === 'baseline' ? window.__b.scene() : window.__inferno.scene();
      const peak = { tweens: 0, displayList: 0, particles: 0 };
      const sample = () => { peak.tweens = Math.max(peak.tweens, s.tweens.getTweens().length); peak.displayList = Math.max(peak.displayList, s.children.length); if (b !== 'baseline') peak.particles = Math.max(peak.particles, window.__inferno.debug().resources.particles); };
      const until = (fn) => new Promise((res) => { const iv = setInterval(() => { sample(); if (fn()) { clearInterval(iv); res(); } }, 16); });
      if (b === 'baseline') {
        if (!s.__seeded) { s.rng = new s.rng.constructor('perf-baseline'); s.__seeded = true; }
        s.handleSpin(); await new Promise((r) => setTimeout(r, 100));
        await until(() => !s.isSpinning || s.infernoState.isInCrownFlip);
        if (s.infernoState.isInCrownFlip) { s.handleCrownWalk(); }
      } else {
        window.__inferno.queueFixture('cascade');
        s.handleSpinPress();
        await until(() => s.session.phase !== 'presenting');
        if (s.session.phase === 'decision') s.handleCollect(s.session.roundId);
        await until(() => s.session.phase === 'ready');
      }
      return peak;
    }, build);
    const peak = await p;
    Object.keys(peaks).forEach((k) => { peaks[k] = Math.max(peaks[k], peak[k]); });
    spinFrames.push(...(await page.evaluate(() => window.__frames.slice())));
    await page.waitForTimeout(400);
  }
  const textures = await page.evaluate((b) => {
    const g = b === 'baseline' ? window.__b.game : window.__inferno.game;
    const keys = Object.keys(g.textures.list).filter((k) => !k.startsWith('__'));
    let bytes = 0; const own = [];
    keys.forEach((k) => { const src = g.textures.list[k].source[0]; if (src) { const sz = src.width * src.height * 4; bytes += sz; if (k.startsWith('inferno')) own.push({ key: k, size: `${src.width}x${src.height}`, mb: +(sz / 1048576).toFixed(2) }); } });
    return { count: keys.length, estimatedRgbaMb: +(bytes / 1048576).toFixed(2), infernoTextures: own, note: 'includes one canvas texture per Text object' };
  }, build);
  const counters = await page.evaluate((b) => (b === 'baseline' ? window.__b.counters : window.__inferno.counters), build);
  await browser.close();
  return { build, cpuThrottle: throttle, env, idle: summarize(idle), spin: summarize(spinFrames), peaks, textures, audioContexts: counters };
}
(async () => {
  const out = [];
  for (const throttle of [1, 4]) for (const build of ['baseline', 'new']) out.push(await measure(build, throttle));
  console.log(JSON.stringify(out, null, 2));
})();

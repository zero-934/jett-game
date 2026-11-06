/**
 * @file proto-capture.cjs
 * @purpose Captures prototype screenshots (harness, seeded, ready state) for the A/B rendering
 *          comparison, plus a timed CPU/heap probe. Headless Chromium, emulated DPR.
 * Usage: LABEL=A node tests/browser/polish004/proto-capture.cjs [extraQuery]
 */
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const LABEL = process.env.LABEL || 'A'; const extra = process.argv[2] || '';
const OUT = path.resolve('docs/polish-004/evidence/prototypes', LABEL); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch(); const meta = [];
  for (const scene of ['JettScene', 'FlapFortuneScene', 'ShatterStepScene']) for (const [w, h, dpr] of [[390, 844, 3], [320, 568, 2], [844, 390, 3]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: true });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
    await p.addInitScript(() => { try { localStorage.clear(); } catch { /* */ } });
    await p.goto(`http://localhost:5199/jett-game/research/harness/index.html?scene=${scene}&seed=proto&adaptive=0${extra}`);
    await p.waitForFunction((k) => window.__game?.scene.isActive(k), scene, { timeout: 20000 }); await p.waitForTimeout(700);
    const file = `${scene}-${w}x${h}@${dpr}x.png`; await p.screenshot({ path: path.join(OUT, file) });
    meta.push({ file, scene, viewport: `${w}x${h}`, dpr, renderScale: await p.evaluate(() => window.__renderScale && window.__renderScale()), fonts: await p.evaluate(() => window.__fontStatus), errors: errs });
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify({ label: LABEL, browser: `chromium ${b.version()} headless (emulated DPR, not hardware)`, meta }, null, 1));
  await b.close();
})();

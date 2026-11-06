/**
 * @file capture-release.cjs
 * @purpose Before/after captures from MINIFIED RELEASE builds with identical seeds. Ready states are
 *          deterministic; active/result states are reached with real taps on both builds (same
 *          seeds, same tap script, wall-clock timing — comparable, not frame-identical).
 *          Headless Chromium, emulated DPR. Writes PNGs + a JSON measurement log.
 * Usage: BASE_URL=http://localhost:4174/jett-game LABEL=before node tests/browser/polish004/capture-release.cjs
 */
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const { execSync } = require('child_process');
const BASE = process.env.BASE_URL || 'http://localhost:4173/jett-game';
const LABEL = process.env.LABEL || 'after';
const OUT = path.resolve('docs/polish-004/evidence/release', LABEL);
fs.mkdirSync(OUT, { recursive: true });
const SEEDS = { JettScene: 'review-jett-06', FlapFortuneScene: 'review-flap-01', ShatterStepScene: 'review-shatter-01' };
const READY_VIEWPORTS = [[390, 844, 1], [390, 844, 2], [390, 844, 3], [430, 932, 3], [320, 568, 2], [844, 390, 3], [667, 375, 2]];
let sha = 'unknown'; try { sha = execSync('git rev-parse HEAD').toString().trim(); } catch { /* */ }

async function open(b, scene, w, h, dpr) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: true });
  const p = await ctx.newPage(); const errors = [];
  p.on('pageerror', (e) => errors.push(String(e)));
  await p.addInitScript(() => { sessionStorage.setItem('jg_auth', 'ok'); try { localStorage.clear(); } catch { /* */ } });
  await p.goto(`${BASE}/?scene=${scene}&seed=${SEEDS[scene]}&adaptive=0`);
  await p.waitForFunction(() => document.querySelector('#app canvas'), null, { timeout: 20000 });
  await p.waitForTimeout(1200);
  return { ctx, p, errors };
}
async function measure(p) {
  return p.evaluate(() => {
    const c = document.querySelector('#app canvas'); const r = c.getBoundingClientRect();
    const faces = []; document.fonts.forEach((f) => { if (f.status === 'loaded') faces.push(`${f.family.replace(/"/g, '')} ${f.weight}`); });
    return { dpr: devicePixelRatio, css: [+r.width.toFixed(2), +r.height.toFixed(2)], backing: [c.width, c.height], backingPerPhysicalPx: +(c.width / (r.width * devicePixelRatio)).toFixed(3), loadedFaces: [...new Set(faces)] };
  });
}

(async () => {
  const b = await chromium.launch(); const log = [];
  for (const scene of Object.keys(SEEDS)) {
    for (const [w, h, dpr] of READY_VIEWPORTS) {
      const { ctx, p, errors } = await open(b, scene, w, h, dpr);
      const file = `${scene}-ready-${w}x${h}@${dpr}x.png`;
      await p.screenshot({ path: path.join(OUT, file) });
      log.push({ file, scene, state: 'ready', viewport: `${w}x${h}`, ...(await measure(p)), errors });
      await ctx.close();
    }
    // Active + result at 390×844@3 with real taps.
    const { ctx, p, errors } = await open(b, scene, 390, 844, 3);
    const tap = (x, y) => p.touchscreen.tap(x, y);
    if (scene === 'JettScene') {
      await tap(195, 802); await p.waitForTimeout(1400);
      await p.screenshot({ path: path.join(OUT, `${scene}-active-390x844@3x.png`) });
      await tap(195, 802); await p.waitForTimeout(700);
    } else if (scene === 'FlapFortuneScene') {
      await tap(195, 802); await p.waitForTimeout(150);
      for (let i = 0; i < 6; i++) { await tap(200, 300); await p.waitForTimeout(300); }
      await p.screenshot({ path: path.join(OUT, `${scene}-active-390x844@3x.png`) });
      await p.waitForTimeout(2500);
    } else {
      // Seeded board for review-shatter-01-1: rows 1–3 safe = right, right, left; row 4 safe = left.
      const pane = (row, side) => [side === 'left' ? 38.8 + 44 : 203 + 99, 628 - row * 48 + 4];
      for (const [row, side] of [[0, 'right'], [1, 'right'], [2, 'left']]) { await tap(...pane(row, side)); await p.waitForTimeout(350); }
      await p.screenshot({ path: path.join(OUT, `${scene}-active-390x844@3x.png`) });
      await tap(...pane(3, 'right')); await p.waitForTimeout(80);
      await p.screenshot({ path: path.join(OUT, `${scene}-break-390x844@3x.png`) });
      await p.waitForTimeout(900);
    }
    // Phaser's scene clock advances by capped frame deltas; under slow software WebGL the
    // presentation timeline runs behind wall time, so wait generously before the result still.
    await p.waitForTimeout(4000);
    await p.screenshot({ path: path.join(OUT, `${scene}-result-390x844@3x.png`) });
    log.push({ scene, state: 'active+result', viewport: '390x844', ...(await measure(p)), errors });
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, 'capture-log.json'), JSON.stringify({ label: LABEL, base: BASE, sha, browser: `chromium ${b.version()} headless`, emulatedDpr: true, physicalHardware: false, note: 'Minified release build. Active/result states reached with real taps on wall-clock timing.', entries: log }, null, 1));
  await b.close();
})();

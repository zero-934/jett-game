/**
 * @file record-video.cjs
 * @purpose RESEARCH ONLY — ~20 s silent screen recording (Playwright video) of: cascade fixture →
 *          Crown collect, then three natural seeded spins. Video has NO audio (headless capture);
 *          audio is reviewed separately from the rendered files.
 * @author Agent 934  @date 2026-11-05  @license Proprietary – available for licensing
 */
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');
const { BASE } = require('./lib.cjs');
const OUT = path.resolve(__dirname, '../../../docs/inferno-polish-001/review-artifacts/video');
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, recordVideo: { dir: OUT, size: { width: 390, height: 844 } } });
  const page = await context.newPage();
  await page.goto(`${BASE}?seed=video&fixture=cascade`);
  await page.waitForFunction(() => window.__inferno && window.__inferno.scene() && window.__inferno.scene().session);
  await page.waitForTimeout(800);
  const box = await page.evaluate(() => { const c = document.querySelector('canvas').getBoundingClientRect(); return { x: c.x, y: c.y, w: c.width, h: c.height }; });
  const tap = (x, y) => page.mouse.click(box.x + (x / 390) * box.w, box.y + (y / 844) * box.h);
  const until = (fn) => page.waitForFunction(fn, null, { timeout: 30000 });
  await tap(195, 716);
  await until(() => window.__inferno.debug().phase !== 'presenting');
  await page.waitForTimeout(900);
  if ((await page.evaluate(() => window.__inferno.debug().phase)) === 'decision') await tap(195, 477);
  for (let i = 0; i < 3; i++) {
    await until(() => window.__inferno.debug().phase === 'ready');
    await page.waitForTimeout(900);
    await tap(195, 716);
    await until(() => window.__inferno.debug().phase !== 'presenting');
    if ((await page.evaluate(() => window.__inferno.debug().phase)) === 'decision') { await page.waitForTimeout(900); await tap(195, 477); }
  }
  await page.waitForTimeout(1500);
  const video = page.video();
  await context.close();
  const src = await video.path();
  fs.renameSync(src, path.join(OUT, 'inferno-gameplay.webm'));
  await browser.close();
})();

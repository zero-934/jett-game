/**
 * @file lib.cjs
 * @purpose RESEARCH ONLY — shared Playwright helpers for the Inferno harness (launch, wait for state).
 * @author Agent 934  @date 2026-11-05  @license Proprietary – available for licensing
 */
const { chromium } = require('playwright');
const BASE = process.env.HARNESS_URL || 'http://localhost:5180/jett-game/research/inferno/harness/index.html';
async function open(query = '', { width = 390, height = 844, dpr = 1, args = [] } = {}) {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', ...args] });
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.stack || e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${BASE}?${query}`);
  await page.waitForFunction(() => window.__inferno && window.__inferno.scene() && window.__inferno.scene().sys.isActive() && window.__inferno.scene().session, null, { timeout: 30000 });
  await page.waitForTimeout(300);
  return { browser, context, page, errors };
}
/** Canvas-space click (390×844 game coords) translated through the FIT scale. */
async function tap(page, x, y) {
  const box = await page.evaluate(() => { const c = document.querySelector('canvas').getBoundingClientRect(); return { x: c.x, y: c.y, w: c.width, h: c.height }; });
  await page.mouse.click(box.x + (x / 390) * box.w, box.y + (y / 844) * box.h);
}
const dbg = (page) => page.evaluate(() => window.__inferno.debug());
async function waitPhase(page, phases, timeout = 15000) {
  await page.waitForFunction((ph) => ph.includes(window.__inferno.debug().phase), phases, { timeout });
}
module.exports = { open, tap, dbg, waitPhase, BASE };

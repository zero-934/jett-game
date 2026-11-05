/** Research probe: environment, renderer, canvas backing-store size, and ready-state screenshots. */
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = 'http://localhost:5199/jett-game/research/harness/index.html';
const OUT = 'docs/polish-002/evidence';
(async () => {
  const browser = await chromium.launch();
  const results = [];
  for (const dpr of [1, 3]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: dpr, hasTouch: true, isMobile: dpr === 3 });
    for (const scene of ['JettScene', 'FlapFortuneScene', 'ShatterStepScene']) {
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(String(e)));
      page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
      await page.goto(`${BASE}?scene=${scene}`);
      await page.waitForFunction(() => window.__game && window.__game.isRunning, null, { timeout: 15000 });
      await page.waitForTimeout(1500);
      const info = await page.evaluate(() => {
        const g = window.__game; const c = g.canvas;
        let gl = null;
        try { const r = g.renderer; const ctx = r.gl; if (ctx) { const ext = ctx.getExtension('WEBGL_debug_renderer_info'); gl = { version: ctx.getParameter(ctx.VERSION), renderer: ext ? ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL) : ctx.getParameter(ctx.RENDERER), maxTexture: ctx.getParameter(ctx.MAX_TEXTURE_SIZE) }; } } catch (e) { gl = String(e); }
        const rect = c.getBoundingClientRect();
        return { ua: navigator.userAgent, dpr: window.devicePixelRatio, rendererType: g.config.renderType === 2 ? 'WEBGL' : g.config.renderType === 1 ? 'CANVAS' : g.config.renderType, gl,
          canvasBackingStore: [c.width, c.height], canvasCss: [Math.round(rect.width), Math.round(rect.height)],
          upscaleFactor: +(rect.width * window.devicePixelRatio / c.width).toFixed(2), fontsInter: document.fonts.check('16px Inter'), fontsFredoka: document.fonts.check('16px "Fredoka One"'),
          actualFps: g.loop.actualFps, displayListSize: g.scene.getScenes(true)[0].sys.displayList.length };
      });
      const shot = `${OUT}/screenshots/ready-${scene}-dpr${dpr}.png`;
      await page.screenshot({ path: shot });
      results.push({ scene, dpr, ...info, errors, screenshot: shot });
      await page.close();
    }
    await ctx.close();
  }
  fs.writeFileSync(`${OUT}/browser-env.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results.map(r => ({ scene: r.scene, dpr: r.dpr, renderer: r.rendererType, gl: r.gl && r.gl.renderer, store: r.canvasBackingStore, css: r.canvasCss, up: r.upscaleFactor, inter: r.fontsInter, fredoka: r.fontsFredoka, errors: r.errors.length })), null, 1));
  console.log(results[0].ua);
  await browser.close();
})();

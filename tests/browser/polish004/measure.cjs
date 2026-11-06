/**
 * @file measure.cjs
 * @purpose polish-004 render diagnostics: for each entry/scene/viewport/DPR, records CSS canvas
 *          size, backing-store size, WebGL drawing buffer, effective backing px per CSS px
 *          (per physical px), image-rendering, loaded FontFace entries, active scene key and the
 *          shell DOM/visible-UI mode. Headless Chromium with *emulated* DPR — not a phone.
 *
 * Usage: BASE_URL=http://localhost:4173/jett-game LABEL=after OUT=docs/polish-004/evidence \
 *        node tests/browser/polish004/measure.cjs [release|harness] [shots]
 *   release → production index.html (?scene=… deep link, session auth pre-seeded)
 *   harness → research/harness/index.html (dev server only)
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BASE = process.env.BASE_URL || 'http://localhost:4173/jett-game';
const LABEL = process.env.LABEL || 'run';
const OUT = path.resolve(process.env.OUT || 'docs/polish-004/evidence');
const entry = process.argv[2] || 'release';
const shots = process.argv.includes('shots');
const SCENES = ['JettScene', 'FlapFortuneScene', 'ShatterStepScene'];
const VIEWPORTS = [[320, 568], [390, 844], [430, 932], [844, 390], [667, 375]];
const DPRS = [1, 2, 3];

let sha = 'unknown';
try { sha = execSync('git rev-parse HEAD').toString().trim(); } catch { /* not a checkout */ }

(async () => {
  const browser = await chromium.launch();
  const rows = [];
  fs.mkdirSync(path.join(OUT, 'measure', LABEL), { recursive: true });
  for (const scene of SCENES) {
    for (const [w, h] of VIEWPORTS) {
      for (const dpr of DPRS) {
        const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: true, isMobile: true });
        const page = await ctx.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        const fontRequests = [];
        page.on('requestfinished', (r) => { if (/\.(woff2?|ttf|otf)(\?|$)/.test(r.url()) || /fonts\.g/.test(r.url())) fontRequests.push(r.url().replace(BASE, '')); });
        await page.addInitScript(() => { try { sessionStorage.setItem('jg_auth', 'ok'); localStorage.clear(); } catch { /* ignore */ } });
        const url = entry === 'release' ? `${BASE}/?scene=${scene}&seed=measure` : `${BASE}/research/harness/index.html?scene=${scene}&seed=measure`;
        await page.goto(url);
        try {
          await page.waitForFunction((k) => {
            const g = window.__game || (window.Phaser && window.Phaser.GAMES && window.Phaser.GAMES[0]);
            const c = document.querySelector('#app canvas');
            return c && (!g || (g.scene.isActive(k)));
          }, scene, { timeout: 20000 });
        } catch { /* recorded below */ }
        await page.waitForTimeout(900);
        const m = await page.evaluate((scene) => {
          const c = document.querySelector('#app canvas');
          const r = c.getBoundingClientRect();
          const cs = getComputedStyle(c);
          let gl = null;
          try { const ctx = c.getContext('webgl2') || c.getContext('webgl'); if (ctx) gl = { w: ctx.drawingBufferWidth, h: ctx.drawingBufferHeight }; } catch { /* ignore */ }
          const faces = [];
          document.fonts.forEach((f) => faces.push({ family: f.family.replace(/"/g, ''), weight: f.weight, status: f.status }));
          const g = window.__game;
          const active = g ? g.scene.getScenes(true).map((s) => s.sys.settings.key) : null;
          const cam = g ? g.scene.getScene(scene)?.cameras?.main : null;
          const ui = document.querySelector('.sd-shell, .sd-a11y');
          const visibleText = ui ? [...ui.querySelectorAll('[data-ui-text]')].filter((e) => e.offsetParent !== null).length : 0;
          return {
            dpr: window.devicePixelRatio,
            css: { w: +r.width.toFixed(2), h: +r.height.toFixed(2) },
            backing: { w: c.width, h: c.height },
            drawingBuffer: gl,
            backingPerCssPx: +(c.width / r.width).toFixed(3),
            backingPerPhysicalPx: +(c.width / (r.width * window.devicePixelRatio)).toFixed(3),
            imageRendering: cs.imageRendering,
            cssTransform: cs.transform,
            cameraZoom: cam ? cam.zoom : null,
            fontFaces: faces,
            interLoaded: faces.some((f) => /Inter/i.test(f.family) && f.status === 'loaded'),
            fontsCheckInter600: document.fonts.check('600 16px Inter'),
            activeScenes: active,
            domUiTextNodes: visibleText,
            renderScale: window.__renderScale ? window.__renderScale() : null,
          };
        }, scene);
        const row = { label: LABEL, entry, sha, browser: `chromium ${browser.version()} headless`, emulated: true, physicalHardware: false, scene, viewport: `${w}x${h}`, ...m, fontRequests: [...new Set(fontRequests)], errors: errors.slice(0, 3) };
        rows.push(row);
        console.log(`${scene} ${w}x${h}@${dpr}: css ${m.css.w}x${m.css.h} backing ${m.backing.w}x${m.backing.h} (${m.backingPerPhysicalPx}/phys px) inter=${m.interLoaded} active=${m.activeScenes} err=${errors.length}`);
        if (shots && (dpr === 3 || (w === 390 && h === 844))) {
          await page.screenshot({ path: path.join(OUT, 'measure', LABEL, `${entry}-${scene}-${w}x${h}@${dpr}x.png`) });
        }
        await ctx.close();
      }
    }
  }
  fs.writeFileSync(path.join(OUT, `render-measurement-${LABEL}-${entry}.json`), JSON.stringify({ date: new Date().toISOString(), base: BASE, note: 'Headless Chromium, emulated DPR via deviceScaleFactor; software WebGL (SwiftShader). Not physical hardware.', rows }, null, 1));
  await browser.close();
})();

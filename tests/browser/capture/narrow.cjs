const { chromium } = require('playwright');
(async () => { const b = await chromium.launch();
  for (const game of ['JettScene', 'ShatterStepScene']) { const p = await b.newPage({ viewport: { width: 320, height: 568 }, deviceScaleFactor: 2 });
    await p.goto(`http://localhost:5199/jett-game/research/harness/index.html?scene=${game}&seed=narrow`); await p.waitForTimeout(1200);
    await p.evaluate(() => document.querySelectorAll('.sd-a11y button[data-id="back"],.sd-a11y button[data-id="settings"],.sd-a11y button[data-id="cta"]').forEach((e) => { e.style.outline = '2px dashed #ff4d6d'; }));
    await p.screenshot({ path: `${process.argv[2]}/narrow-320x568-${game}-targets.png` }); await p.close(); }
  await b.close(); })();

/** Renders research/mockups/directions.html to PNG (review-only proposal images). */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1300, height: 1000 }, deviceScaleFactor: 2 });
  for (const dir of ['lux', 'ill']) {
    await p.goto(`http://localhost:5199/jett-game/research/mockups/directions.html?dir=${dir}`);
    await p.waitForTimeout(600);
    await p.screenshot({ path: `docs/polish-002/mockups/direction-${dir === 'lux' ? 'A-midnight-luxury' : 'B-illustrated-night'}.png`, fullPage: true });
  }
  await b.close();
})();

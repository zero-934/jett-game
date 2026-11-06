const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('http://localhost:5199/jett-game/research/harness/index.html?scene=FlapFortuneScene&seed=review-flap-01&debug=' + (process.argv[2] || '0'));
  await p.waitForFunction(() => window.__game && window.__game.scene.getScene('FlapFortuneScene')?.flapUI, null, { timeout: 15000 });
  await p.waitForTimeout(500);
  const r = await p.evaluate(() => {
    const g = window.__game; g.loop.sleep(); window.__t = performance.now(); let t = window.__t;
    const ui = g.scene.getScene('FlapFortuneScene').flapUI;
    const key = (code) => { window.dispatchEvent(new KeyboardEvent('keydown', { code, key: ' ' })); window.dispatchEvent(new KeyboardEvent('keyup', { code, key: ' ' })); };
    const step = () => { t += 1000 / 60; window.__t = t; g.loop.step(t); };
    for (let i = 0; i < 5; i++) step();
    key('Space'); // start + first flap
    let snapAt2 = null;
    for (let f = 0; f < 3000; f++) {
      const s = ui.debugSnapshot();
      if (s.phase !== 'playing') break;
      const next = s.pipes.find((q) => q.x + 30 > 66) || s.pipes[0];
      const target = next.x < 390 ? next.top + 79 : 422;
      if (s.playerY > target + 6 && s.velocity > -1) key('Space');
      if (s.pipesCleared >= 2 && !snapAt2) { snapAt2 = s; window.__snapFrame = f; }
      if (snapAt2 && f === window.__snapFrame + 18) return { playing: ui.debugSnapshot(), frames: f };
      step();
    }
    return { failed: ui.debugSnapshot() };
  });
  await p.screenshot({ path: `${process.env.OUT || (process.env.OUT || 'capture-out')}/flap-playing${process.argv[2] === '1' ? '-debug' : ''}.png` });
  console.log(JSON.stringify(r).slice(0, 600));
  if (r.playing) {
    // Cash out with a real pointer tap on the CTA
    await p.mouse.click(195, 780);
    await p.evaluate(() => { const g = window.__game; let t = window.__t; for (let i = 0; i < 20; i++) { t += 16.67; g.loop.step(t); } window.__t = t; g.loop.wake(); }); await p.waitForTimeout(400);
    await p.screenshot({ path: `${process.env.OUT || (process.env.OUT || 'capture-out')}/flap-cashed.png` });
    console.log(JSON.stringify(await p.evaluate(() => window.__game.scene.getScene('FlapFortuneScene').flapUI.debugSnapshot())).slice(0, 400));
  }
  console.log('errors', errs);
  await b.close();
})();

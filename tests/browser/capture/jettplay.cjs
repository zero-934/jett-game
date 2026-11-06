const { chromium } = require('playwright'); const OUTD = process.env.OUT || (process.env.OUT || 'capture-out');
(async () => {
  const dbg = process.argv[2] || '0'; const seed = process.argv[3] || 'review-jett-01';
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`http://localhost:5199/jett-game/research/harness/index.html?scene=JettScene&debug=${dbg}&seed=${seed}`);
  await p.waitForFunction(() => window.__game?.scene.getScene('JettScene')?.jettUI, null, { timeout: 15000 });
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${OUTD}/jett-ready.png` });
  const r = await p.evaluate(() => {
    const g = window.__game; g.loop.sleep(); window.__t = performance.now(); let t = window.__t;
    const s = g.scene.getScene('JettScene'); const ui = s.jettUI;
    const step = () => { t += 1000 / 60; window.__t = t; g.loop.step(t); };
    for (let i = 0; i < 3; i++) step();
    ui.onPrimary(); // LAUNCH through the same handler the CTA uses
    let coinTick = null;
    for (let f = 0; f < 4000; f++) {
      const st = ui.debugSnapshot();
      if (st.phase !== 'playing') return { ended: st, f };
      // Lane choice: aim for the next coin unless an asteroid is within reach ahead; else safest lane.
      const ahead = st.asteroids.filter(a => a.y > st.altitude - 10 && a.y < st.altitude + 140);
      const danger = (x) => ahead.reduce((m, a) => Math.min(m, Math.abs(a.x - x) - a.r * 0.85 - 9.6 - 14 + Math.max(0, a.y - st.altitude - 60) * 0.2), 999);
      const coin = st.coinList.find(c => c.y > st.altitude - 5);
      let target = coin ? coin.x : st.playerX;
      if (danger(target) < 0) { let best = st.playerX, bv = -1e9; for (let x = 20; x <= 370; x += 10) { const v = danger(x) - Math.abs(x - st.playerX) * 0.02; if (v > bv) { bv = v; best = x; } } target = best; }
      ui.runner.queue('steer', Math.round(target));
      if (st.coins >= 1 && coinTick === null) coinTick = st.tick;
      if (coinTick !== null && st.tick >= coinTick + 25 && !window.__shot) { window.__shot = true; return { playing: st, f }; }
      step();
    }
    return { timeout: ui.debugSnapshot() };
  });
  await p.evaluate(() => window.__game.loop.wake()); await p.waitForTimeout(350); await p.evaluate(() => { window.__game.loop.sleep(); window.__t = window.__game.loop.lastTime; });
  await p.screenshot({ path: `${OUTD}/jett-playing${dbg === '1' ? '-debug' : ''}.png` });
  console.log(JSON.stringify(r).slice(0, 500));
  if (r.playing) {
    await p.mouse.click(195, 780); // real tap on CASH OUT
    await p.evaluate(() => { const g = window.__game; let t = window.__t; for (let i = 0; i < 6; i++) { t += 16.67; g.loop.step(t); } window.__t = t; g.loop.wake(); });
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${OUTD}/jett-cashed.png` });
    console.log(JSON.stringify(await p.evaluate(() => { const s = window.__game.scene.getScene('JettScene').jettUI.debugSnapshot(); return { phase: s.phase, settlement: s.settlement, balance: s.balance }; })));
  }
  console.log('errors', errs);
  await b.close();
})();

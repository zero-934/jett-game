const { chromium } = require('playwright');
const MODE = process.argv[2]; const WAIT = Number(process.argv[3] || 0); const RM = process.argv[4] === 'rm';
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: RM ? 'reduce' : 'no-preference' });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.addInitScript(() => { try { localStorage.clear(); } catch {} });
  await p.goto('http://localhost:5199/jett-game/research/harness/index.html?scene=ShatterStepScene&seed=review-shatter-01');
  await p.waitForFunction(() => window.__game?.scene.getScene('ShatterStepScene')?.shatterUI, null, { timeout: 15000 });
  await p.waitForTimeout(500);
  if (MODE === 'ready') { await p.screenshot({ path: 'capture-out/shatter-ready.png' }); await b.close(); return; }
  const board = await p.evaluate(() => window.__game.scene.getScene('ShatterStepScene').shatterUI.round.board); // QA peek only
  const pane = (row, side) => ({ x: (side === 'left' ? 38.8 : 203) + 148.2 / 2 + (side === 'left' ? -30 : 25), y: 628 - row * 48 + 6 });
  for (let row = 0; row < 3; row++) { const c = pane(row, board[row]); await p.mouse.click(c.x, c.y); await p.waitForTimeout(260); }
  if (MODE === 'playing') { await p.screenshot({ path: 'capture-out/shatter-playing.png' }); }
  if (MODE === 'cashout') { await p.mouse.click(195, 780); await p.waitForTimeout(450); await p.screenshot({ path: 'capture-out/shatter-cashed.png' }); }
  if (MODE === 'break') {
    const wrong = board[3] === 'left' ? 'right' : 'left'; const c = pane(3, wrong);
    await p.mouse.click(c.x, c.y);
    if (WAIT) await p.waitForTimeout(WAIT);
    await p.screenshot({ path: `capture-out/shatter-break-${WAIT}${RM ? '-rm' : ''}.png`, clip: { x: 16, y: 136, width: 358, height: 544 } });
    if (WAIT >= 700) await p.screenshot({ path: `capture-out/shatter-loss${RM ? '-rm' : ''}.png` });
  }
  console.log(MODE, WAIT, JSON.stringify(await p.evaluate(() => { const s = window.__game.scene.getScene('ShatterStepScene').shatterUI.debugSnapshot(); return { phase: s.phase, row: s.row, picks: s.picks.map(x => x.side[0] + (x.safe ? '✓' : '✗')).join(' '), settlement: s.settlement, revealed: s.revealed && s.revealed.map(x => x[0]).join(''), shards: s.visibleShards, hits: s.interactiveHits, balance: s.balance, broken: s.frameVisible.findIndex(f => f.left || f.right) }; })), errs);
  await b.close();
})();

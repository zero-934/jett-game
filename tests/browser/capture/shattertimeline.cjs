const { chromium } = require('playwright');
(async () => {
  const out = {};
  for (const rm of [false, true]) {
    const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: rm ? 'reduce' : 'no-preference' });
    const p = await ctx.newPage(); await p.addInitScript(() => { try { localStorage.clear(); } catch {} });
    await p.goto('http://localhost:5199/jett-game/research/harness/index.html?scene=ShatterStepScene&seed=review-shatter-01');
    await p.waitForFunction(() => window.__game?.scene.getScene('ShatterStepScene')?.shatterUI);
    await p.waitForTimeout(400);
    const board = await p.evaluate(() => window.__game.scene.getScene('ShatterStepScene').shatterUI.round.board);
    const pane = (row, side) => ({ x: (side === 'left' ? 38.8 : 203) + 74 + (side === 'left' ? -30 : 25), y: 628 - row * 48 + 6 });
    for (let row = 0; row < 3; row++) { const c = pane(row, board[row]); await p.mouse.click(c.x, c.y); await p.waitForTimeout(250); }
    await p.evaluate(() => {
      const ui = window.__game.scene.getScene('ShatterStepScene').shatterUI; window.__tl = [];
      const sample = () => {
        const t0 = window.__t0; if (t0 !== undefined) {
          const t = performance.now() - t0;
          window.__tl.push({ t: Math.round(t), pane: ui.panes[3][ui.round.picks[3]?.side ?? 'left'].image.visible && ui.panes[3][ui.round.picks[3]?.side ?? 'left'].image.alpha > 0.05,
            cracks: ui.cracks.commandBuffer.length > 0, shards: ui.shards.filter(s => s.visible).length, flash: ui.flash.visible && ui.flash.alpha > 0.05,
            result: ui.shell.resultObjects.length > 0, phase: ui.phase, ctaEnabled: ui.shell.footer.ctaEnabled, hits: ui.hits.filter(h => h.input?.enabled).length });
        }
        if (!window.__stop) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
      window.addEventListener('pointerdown', () => { window.__t0 = performance.now(); }, { capture: true, once: true });
    });
    const wrong = board[3] === 'left' ? 'right' : 'left'; const c = pane(3, wrong);
    await p.mouse.click(c.x, c.y); await p.waitForTimeout(900);
    const tl = await p.evaluate(() => { window.__stop = true; return window.__tl; });
    // Summarise first time each condition changes.
    const first = (f) => { const e = tl.find(f); return e ? e.t : null; };
    out[rm ? 'reducedMotion' : 'full'] = {
      samples: tl.length, frameP50ms: (() => { const d = tl.slice(1).map((e, i) => e.t - tl[i].t).sort((a, b) => a - b); return d[Math.floor(d.length / 2)]; })(),
      hitsLockedAt: first(e => e.hits === 0), flashAt: first(e => e.flash), cracksAt: first(e => e.cracks), paneGoneAt: first(e => !e.pane),
      shardsVisibleAt: first(e => e.shards > 0), maxShards: Math.max(...tl.map(e => e.shards)), shardsGoneAt: (() => { const s = tl.findIndex(e => e.shards > 0); if (s < 0) return null; const g = tl.slice(s).find(e => e.shards === 0); return g ? g.t : null; })(),
      resultAt: first(e => e.result), playAgainEnabledAt: first(e => e.phase === 'settled' && e.ctaEnabled), final: tl[tl.length - 1],
    };
    await b.close();
  }
  console.log(JSON.stringify(out, null, 1));
  require('fs').writeFileSync('capture-out/shatter-timeline.json', JSON.stringify(out, null, 2));
})();

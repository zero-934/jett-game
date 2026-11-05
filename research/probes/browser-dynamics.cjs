/**
 * @file browser-dynamics.cjs
 * @purpose RESEARCH PROBE (not production). Drives the unmodified production scenes through the
 *          research harness with a manually-stepped Phaser loop (real TimeStep smoothing, real Clock
 *          catch-up, real render) to characterise frame-rate dependence, input timing, settlement
 *          edge cases, restart ownership and coarse frame cost.
 * Usage:   (vite dev server on :5199) node research/probes/browser-dynamics.cjs
 * Output:  docs/polish-002/evidence/browser-dynamics.json + screenshots
 */
const { chromium } = require('playwright');
const fs = require('fs');

const BASE = 'http://localhost:5199/jett-game/research/harness/index.html';
const OUT = 'docs/polish-002/evidence';
const results = {};

async function open(browser, scene, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: false });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${BASE}?scene=${scene}${opts.query || ''}`);
  await page.waitForFunction(() => window.__game && window.__game.isRunning && window.__game.scene.getScenes(true).length > 0, null, { timeout: 15000 });
  await page.waitForTimeout(300);
  // Install a manual driver: sleep the rAF loop and step with synthetic timestamps.
  await page.evaluate(() => {
    const g = window.__game;
    g.loop.sleep();
    window.__t = performance.now();
    window.__step = (dt) => { window.__t += dt; g.loop.step(window.__t); };
    window.__scene = () => g.scene.getScenes(true)[0];
  });
  return { ctx, page, errors };
}

/** E1 — simulation pacing vs. display refresh and irregular frames. */
async function pacing(browser) {
  const schedules = {
    hz30: () => 1000 / 30, hz60: () => 1000 / 60, hz120: () => 1000 / 120, hz144: () => 1000 / 144,
    jitter60: (i) => 1000 / 60 + ((i * 7919) % 17) - 8, // deterministic ±8 ms jitter
    hitch60: (i) => (i === 150 ? 500 : 1000 / 60),
    hz60unfocused: () => 1000 / 60, hz30unfocused: () => 1000 / 30,
  };
  const out = {};
  for (const game of ['JettScene', 'FlapFortuneScene']) {
    out[game] = {};
    for (const [name, fn] of Object.entries(schedules)) {
      const { ctx, page } = await open(browser, game);
      const r = await page.evaluate(({ game, name, src }) => {
        const dtFn = eval(src); // eslint-disable-line no-eval
        const g = window.__game; const s = window.__scene();
        const ui = s.jettUI || s.flapUI;
        if (game === 'JettScene') { ui.handleStartGame(); } else { ui.waitingToStart = false; }
        const keepAlive = () => {
          const st = ui.state; if (!st) return;
          if (game === 'JettScene') { st.asteroids = []; st.rng = () => 0.99; }
          else { st.pipes = []; st.playerY = 400; st.playerVelocityY = 0; ui.config.rng = () => 0.99; }
        };
        const ticks = () => (game === 'JettScene' ? ui.state.tickCount : Math.round(ui.state.distanceTravelled / 3));
        if (name.includes('unfocused')) g.loop.inFocus = false;
        const run = (frames, offset) => {
          const perFrame = []; let wall = 0; const t0 = ticks();
          for (let i = 0; i < frames; i++) { keepAlive(); const before = ticks(); const dt = dtFn(i + offset); wall += dt; window.__step(dt); perFrame.push(ticks() - before); }
          const hist = {}; perFrame.forEach((n) => { hist[n] = (hist[n] || 0) + 1; });
          return { frames, wallMs: Math.round(wall), ticks: ticks() - t0, expectedAt62_5Hz: +(wall / 16).toFixed(1), simSpeed: +((ticks() - t0) / (wall / 16)).toFixed(3), ticksPerFrameHistogram: hist };
        };
        const cold = run(120, 0);          // TimeStep cool-down window (panicMax = 120 frames)
        const warm = run(300, 120);        // steady state
        return { cold, warm };
      }, { game, name, src: fn.toString() });
      out[game][name] = r;
      await ctx.close();
    }
  }
  results.pacing = out;
}

/** E2/E3 — Flap input timing: quick tap, Space start, key repeat. */
async function flapInput(browser) {
  const out = {};
  // Quick tap during waiting phase: down+up before the next tick.
  {
    const { ctx, page } = await open(browser, 'FlapFortuneScene');
    await page.evaluate(() => { for (let i = 0; i < 10; i++) window.__step(16.667); });
    await page.mouse.move(200, 500); await page.mouse.down(); await page.mouse.up();
    const r = await page.evaluate(() => { const ui = window.__scene().flapUI; ui.config.rng = () => 0.99; window.__step(16.667); return { waitingToStart: ui.waitingToStart, velocityAfterFirstTick: +ui.state.playerVelocityY.toFixed(3) }; });
    // Quick tap during play
    const r2 = await page.evaluate(() => { for (let i = 0; i < 3; i++) window.__step(16.667); return window.__scene().flapUI.state.playerVelocityY; });
    await page.mouse.down(); await page.mouse.up();
    const r3 = await page.evaluate(() => { window.__step(16.667); return +window.__scene().flapUI.state.playerVelocityY.toFixed(3); });
    // Same tap but held across a frame
    await page.mouse.down(); await page.evaluate(() => window.__step(16.667));
    const r4 = await page.evaluate(() => +window.__scene().flapUI.state.playerVelocityY.toFixed(3));
    await page.mouse.up();
    out.quickTap = { waitingPhase: r, velocityBeforePlayTap: +r2.toFixed(3), velocityAfterQuickTapInPlay: r3, velocityAfterHeldTap: r4, flapVelocityExpected: -7.05, note: 'flap applied => velocity == flapStrength + gravity = -7.05' };
    await ctx.close();
  }
  // Space while waiting
  {
    const { ctx, page } = await open(browser, 'FlapFortuneScene');
    await page.evaluate(() => { for (let i = 0; i < 5; i++) window.__step(16.667); });
    await page.keyboard.down('Space');
    await page.evaluate(() => { for (let i = 0; i < 30; i++) window.__step(16.667); });
    await page.keyboard.up('Space');
    out.spaceWhileWaiting = await page.evaluate(() => { const ui = window.__scene().flapUI; return { waitingToStart: ui.waitingToStart, distanceTravelled: ui.state.distanceTravelled }; });
    await ctx.close();
  }
  // Key repeat while held during play
  {
    const { ctx, page } = await open(browser, 'FlapFortuneScene');
    await page.evaluate(() => { const ui = window.__scene().flapUI; ui.waitingToStart = false; ui.config.rng = () => 0.99; });
    let flaps = 0;
    await page.keyboard.down('Space');
    for (let i = 0; i < 20; i++) {
      // Playwright sends keydown with repeat=true for repeated down() calls (OS auto-repeat emulation)
      if (i > 0) await page.keyboard.down('Space');
      const v = await page.evaluate(() => { const ui = window.__scene().flapUI; ui.state.pipes = []; ui.state.playerY = 400; window.__step(33.33); return ui.state.playerVelocityY; });
      if (Math.abs(v - (-7.05)) < 0.5 || v < -6) flaps++;
    }
    await page.keyboard.up('Space');
    out.heldSpaceWithRepeat = { repeatEvents: 19, framesObserved: 20, framesWithFreshFlap: flaps };
    await ctx.close();
  }
  results.flapInput = out;
}

/** E4/E5 — Jett settlement edge cases. */
async function jettSettlement(browser) {
  const out = {};
  {
    const { ctx, page } = await open(browser, 'JettScene');
    await page.evaluate(() => { for (let i = 0; i < 5; i++) window.__step(16.667); });
    await page.mouse.click(318, 70); // CASH OUT before GO
    const a = await page.evaluate(() => { for (let i = 0; i < 60; i++) window.__step(16.667); const ui = window.__scene().jettUI; return { cashedOut: ui.state.cashedOut, payout: ui.state.payout, status: ui.statusText.text, startOverlayStillUp: ui.startScreenObjects.length > 0, tickTimerRunning: !!ui.tickTimer }; });
    await page.mouse.click(195, 462); // GO after cash out
    const b = await page.evaluate(() => { for (let i = 0; i < 30; i++) window.__step(16.667); const ui = window.__scene().jettUI; return { tickTimerRunningAfterGo: !!ui.tickTimer, altitude: ui.state.altitude }; });
    await page.screenshot({ path: `${OUT}/screenshots/jett-cashout-before-go.png` });
    out.cashOutBeforeGo = { ...a, ...b };
    await ctx.close();
  }
  {
    const { ctx, page } = await open(browser, 'JettScene');
    const r = await page.evaluate(() => {
      const ui = window.__scene().jettUI; ui.handleStartGame();
      for (let i = 0; i < 30; i++) { ui.state.asteroids = []; window.__step(16.667); }
      const m1 = ui.state.multiplier;
      ui.state.rng = () => 0; window.__step(16.667); // force combustion on next tick
      return { combusted: ui.state.combusted, multiplierBefore: m1 };
    });
    await page.mouse.click(318, 70); // tap CASH OUT inside the 300 ms combustion window
    const r2 = await page.evaluate(() => {
      const ui = window.__scene().jettUI; const status1 = ui.statusText.text;
      for (let i = 0; i < 90; i++) window.__step(16.667);
      const s = window.__scene();
      const playAgainTexts = s.sys.displayList.list.filter((o) => o.type === 'Text' && o.text === 'PLAY AGAIN').length;
      return { statusImmediatelyAfterTap: status1, statusAfter1500ms: ui.statusText.text, playAgainButtons: playAgainTexts };
    });
    await page.screenshot({ path: `${OUT}/screenshots/jett-cashout-during-combustion.png` });
    out.cashOutDuringCombustionWindow = { ...r, ...r2 };
    await ctx.close();
  }
  {
    const { ctx, page } = await open(browser, 'JettScene');
    out.firstTicks = await page.evaluate(() => {
      const ui = window.__scene().jettUI; ui.handleStartGame();
      const rows = [];
      for (let i = 0; i < 3; i++) { ui.state.asteroids = []; window.__step(16.667); rows.push({ tick: ui.state.tickCount, altitude: +ui.state.altitude.toFixed(2), multiplier: ui.state.multiplier, hud: ui.multiplierText.text }); }
      return rows;
    });
    // Input leak: tapping the CASH OUT button area also steers the ship.
    out.cashOutTapSteers = await page.evaluate(() => window.__scene().jettUI.pointerX);
    await page.mouse.click(318, 70);
    out.pointerXAfterCashOutTap = await page.evaluate(() => window.__scene().jettUI.pointerX);
    await ctx.close();
  }
  results.jettSettlement = out;
}

/** E6 — Shatter Step reveal consistency after a loss. */
async function shatterReveal(browser) {
  const { ctx, page } = await open(browser, 'ShatterStepScene');
  await page.evaluate(() => { const ui = window.__scene().shatterUI; ui._rng = () => 0.1; window.__origRandom = Math.random; Math.random = () => 0.9; for (let i = 0; i < 5; i++) window.__step(16.667); });
  const leftX = 195 - (390 * 0.38) / 2 - 8; const bottomY = 844 * 0.22 + 9 * 55;
  await page.mouse.click(leftX, bottomY);
  const r = await page.evaluate(() => { for (let i = 0; i < 160; i++) window.__step(16.667); const ui = window.__scene().shatterUI; return { isAlive: ui.state.isAlive, lastPick: ui.state.lastPick, status: ui.statusText.text }; });
  await page.screenshot({ path: `${OUT}/screenshots/shatter-loss-reveal-contradiction.png` });
  await page.evaluate(() => { Math.random = window.__origRandom; });
  // Also: does PLAY AGAIN work?
  const playY = 844 * 0.88;
  await page.mouse.click(195, playY);
  const after = await page.evaluate(() => { for (let i = 0; i < 20; i++) window.__step(16.667); const ui = window.__scene().shatterUI; return { restarted: ui.state.isAlive === true && ui.state.currentRow === 0 }; });
  results.shatterReveal = { ...r, chosenSide: 'left', revealClaimsCorrectSide: 'left (Math.random=0.9 => left)', ...after, screenshot: `${OUT}/screenshots/shatter-loss-reveal-contradiction.png` };
  await ctx.close();
}

/** E7 — restart ownership: 50 restarts through the same path as PLAY AGAIN, plus same-instance start(). */
async function restarts(browser) {
  const out = {};
  for (const game of ['JettScene', 'FlapFortuneScene', 'ShatterStepScene']) {
    const { ctx, page } = await open(browser, game);
    const cdp = await ctx.newCDPSession(page);
    const gcHeap = async () => { await cdp.send('HeapProfiler.collectGarbage'); return page.evaluate(() => +(performance.memory.usedJSHeapSize / 1048576).toFixed(1)); };
    const heapBeforeGC = await gcHeap();
    out[game] = await page.evaluate(async (game) => {
      const g = window.__game; const key = game;
      const snap = () => {
        const s = g.scene.getScene(key);
        const ui = s.jettUI || s.flapUI || s.shatterUI;
        return { displayList: s.sys.displayList.length, pointerdown: s.input.listenerCount('pointerdown'), pointermove: s.input.listenerCount('pointermove'), keydownSpace: s.input.keyboard ? s.input.keyboard.listenerCount('keydown-SPACE') : null,
          timers: s.time._active.length + s.time._pendingInsertion.length, tweens: s.tweens.getTweens().length, stars: ui && ui.stars ? ui.stars.length : null,
          audioCreated: window.__counters.audioContextsCreated, audioClosed: window.__counters.audioContextsClosed,
          heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null };
      };
      for (let i = 0; i < 10; i++) window.__step(16.667);
      const before = snap();
      for (let c = 0; c < 50; c++) {
        const s = g.scene.getScene(key); const ui = s.jettUI || s.flapUI || s.shatterUI;
        if (game === 'JettScene') ui.handleStartGame(); else if (game === 'FlapFortuneScene') ui.waitingToStart = false;
        for (let i = 0; i < 20; i++) window.__step(16.667);
        ui.cleanup(); s.scene.restart();
        for (let i = 0; i < 5; i++) window.__step(16.667);
      }
      const after50 = snap();
      // Same-instance restart (what UI.start() does if called twice without a scene restart)
      const s = g.scene.getScene(key); const ui = s.jettUI || s.flapUI || s.shatterUI;
      ui.start(10); ui.start(10);
      for (let i = 0; i < 3; i++) window.__step(16.667);
      const sameInstanceTwice = snap();
      return { before, after50, sameInstanceTwice };
    }, game);
    out[game].heapAfterForcedGC = { atStartMB: heapBeforeGC, afterRestartsMB: await gcHeap() };
    await ctx.close();
  }
  results.restarts = out;
}

/** E8 — coarse frame cost (real rAF loop), active vs results, with optional CPU throttling. */
async function frameCost(browser) {
  const out = {};
  for (const throttle of [1, 4]) {
    for (const game of ['JettScene', 'FlapFortuneScene', 'ShatterStepScene']) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
      await page.goto(`${BASE}?scene=${game}`);
      await page.waitForFunction(() => window.__game && window.__game.isRunning && window.__game.scene.getScenes(true).length > 0);
      await page.waitForTimeout(500);
      const measure = async (label, ms) => page.evaluate(async ({ label, ms }) => {
        const g = window.__game; const stepTimes = []; const intervals = [];
        let last = performance.now(); let a = 0;
        const pre = () => { a = performance.now(); intervals.push(a - last); last = a; };
        const post = () => { stepTimes.push(performance.now() - a); };
        g.events.on('prestep', pre); g.events.on('postrender', post);
        await new Promise((r) => setTimeout(r, ms));
        g.events.off('prestep', pre); g.events.off('postrender', post);
        const q = (arr, p) => { const s = [...arr].sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(2); };
        return { label, frames: stepTimes.length, fps: +(stepTimes.length / (ms / 1000)).toFixed(1), stepMsP50: q(stepTimes, 0.5), stepMsP95: q(stepTimes, 0.95), stepMsMax: q(stepTimes, 1), intervalP95: q(intervals, 0.95) };
      }, { label, ms });
      const rows = [];
      // ready/idle
      rows.push(await measure('ready', 3000));
      // active
      await page.evaluate((game) => {
        const s = window.__game.scene.getScenes(true)[0]; const ui = s.jettUI || s.flapUI || s.shatterUI;
        if (game === 'JettScene') { ui.handleStartGame(); ui.state.playerRadius = -1000; /* harness: disable collisions & coin pickup, keep hazards rendered */ }
        if (game === 'FlapFortuneScene') { ui.waitingToStart = false; window.__keep = setInterval(() => { if (ui.state && ui.state.isAlive) { ui.state.playerY = 422; ui.state.playerVelocityY = 0; ui.state.pipes.forEach((p) => { p.topHeight = 200; p.bottomHeight = 844 - 200 - 158; }); } }, 5); }
      }, game);
      if (game !== 'ShatterStepScene') rows.push(await measure('active', 5000));
      await page.evaluate(() => { const s = window.__game.scene.getScenes(true)[0]; const ui = s.jettUI || s.flapUI || s.shatterUI; return { alive: ui.state && ui.state.isAlive }; }).then((x) => rows.push({ label: 'aliveAfterActive', ...x }));
      out[`${game}@cpu${throttle}x`] = rows;
      await ctx.close();
    }
  }
  results.frameCost = out;
}

(async () => {
  const browser = await chromium.launch({ args: ['--enable-precise-memory-info'] });
  const which = process.argv[2] || 'all';
  const t0 = Date.now();
  if (which === 'all' || which === 'pacing') await pacing(browser);
  if (which === 'all' || which === 'flap') await flapInput(browser);
  if (which === 'all' || which === 'jett') await jettSettlement(browser);
  if (which === 'all' || which === 'shatter') await shatterReveal(browser);
  if (which === 'all' || which === 'restarts') await restarts(browser);
  if (which === 'all' || which === 'perf') await frameCost(browser);
  results.meta = { probe: 'browser-dynamics', which, durationSec: (Date.now() - t0) / 1000, chromium: browser.version(), date: new Date().toISOString() };
  const file = `${OUT}/browser-dynamics-${which}.json`;
  fs.writeFileSync(file, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 1));
  await browser.close();
})();

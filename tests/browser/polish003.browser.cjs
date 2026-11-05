/**
 * @file polish003.browser.cjs
 * @purpose Browser integration tests for the polish-003 pilots (Jett, Flap Fortune, Shatter Step)
 *          against the REAL Phaser build served by Vite. Exercises Phaser's own TimeStep, input
 *          dispatch, scene lifecycle and rendering. Writes a JSON report and screenshots.
 *
 * Usage:
 *   npx vite --port 5199 --strictPort &           # from the repo root
 *   node tests/browser/polish003.browser.cjs [section...]
 * Sections: pacing replay input isolation shatter restarts a11y layout perf smoke captures (default: all)
 * Requires the `playwright` package and a Chromium build (preinstalled in the cloud image; locally
 * `npm i -D playwright && npx playwright install chromium`). Not part of `npm test`.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE_URL || 'http://localhost:5199/jett-game';
const HARNESS = `${BASE}/research/harness/index.html`;
const OUT = path.resolve(__dirname, '../../docs/polish-003/implementation/evidence');
fs.mkdirSync(path.join(OUT, 'screenshots'), { recursive: true });

const report = { meta: {}, results: {} };
let failures = 0;
function check(section, name, ok, detail) {
  (report.results[section] ||= []).push({ name, ok: !!ok, detail });
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'} [${section}] ${name}${detail !== undefined ? ' — ' + JSON.stringify(detail).slice(0, 300) : ''}`);
}

const SCENES = { jett: ['JettScene', 'jettUI'], flap: ['FlapFortuneScene', 'flapUI'], shatter: ['ShatterStepScene', 'shatterUI'] };

async function openGame(browser, game, opts = {}) {
  const [key, prop] = SCENES[game];
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 390, height: 844 }, deviceScaleFactor: opts.dpr || 1, reducedMotion: opts.reducedMotion ? 'reduce' : 'no-preference', hasTouch: !!opts.touch, isMobile: !!opts.mobile });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => { try { localStorage.clear(); } catch { /* ignore */ } });
  await page.goto(`${HARNESS}?scene=${key}&seed=${opts.seed || 'browser'}${opts.query || ''}`);
  await page.waitForFunction(([k, p]) => window.__game && window.__game.scene.getScene(k) && window.__game.scene.getScene(k)[p], [key, prop], { timeout: 20000 });
  await page.waitForTimeout(300);
  await page.evaluate(([k, p]) => {
    window.__ui = () => window.__game.scene.getScene(k)[p];
    window.__manual = () => { const g = window.__game; g.loop.sleep(); window.__t = performance.now(); g.loop.step(window.__t); /* absorb the stale real-loop delta while still in ready */ };
    window.__step = (dt) => { window.__t += dt; window.__game.loop.step(window.__t); };
  }, [key, prop]);
  return { ctx, page, errors };
}

// ─── Pacing & replay through the real Phaser TimeStep ─────────────────────────
async function pacingAndReplay(browser) {
  for (const game of ['flap', 'jett']) {
    const hashes = {};
    for (const [label, frame] of [['30', 1000 / 30], ['60', 1000 / 60], ['120', 1000 / 120], ['144', 1000 / 144]]) {
      const { ctx, page, errors } = await openGame(browser, game, { seed: 'pace' });
      const r = await page.evaluate(([game, frame]) => {
        window.__manual();
        const ui = window.__ui();
        // Scripted tick-indexed log injected at the simulation boundary (identical across schedules).
        const runner = ui.runner; const orig = runner.simulate;
        runner.simulate = (t, a) => {
          const extra = game === 'flap'
            ? (t % 31 === 0 ? [{ type: 'flap' }] : [])
            : [{ type: 'steer', value: 195 + Math.round(150 * Math.sin(t / 29)) }];
          if (t === 400) extra.push({ type: 'cashOut' });
          return orig(t, [...a, ...extra]);
        };
        if (game === 'flap') { ui.round.state.pipes.length = 0; ui.config.combustionFloorPerTick = 0; ui.round.config.combustionFloorPerTick = 0; ui.round.config.combustionChancePerTick = 0; }
        if (game === 'jett') { ui.round.config.combustionFloorPerTick = 0; ui.round.config.combustionChancePerTick = 0; }
        ui.onPrimary(); // start (debit) — Flap arms, Jett launches
        if (game === 'flap') ui.onPress();
        let wall = 0; const tickAt = {};
        window.__step(frame); const startTick = ui.round.tick; // pace is measured from here
        for (let i = 0; i < 20000 && ui.phase !== 'settled'; i++) {
          // keep Flap alive without changing RNG use: clear pipes after they spawn (logic-identical across schedules)
          if (game === 'flap') ui.round.state.pipes.forEach((p) => { p.topHeight = 300; p.bottomHeight = 844 - 300 - 158; });
          window.__step(frame); wall += frame;
          if (wall >= 2000 - 1e-6 && tickAt.t2000 === undefined) tickAt.t2000 = ui.round.tick - startTick;
        }
        const s = ui.debugSnapshot();
        const st = ui.round.state;
        return { tickAt2s: tickAt.t2000, settlement: s.settlement, stateJSON: JSON.stringify(st), rng: ui.round.rng.getState() };
      }, [game, frame]);
      hashes[label] = r;
      check('pacing', `${game} @${label} Hz: ticks after 2 s wall == 125 (±1)`, r.tickAt2s !== undefined && Math.abs(r.tickAt2s - 125) <= 1, { ticks: r.tickAt2s });
      if (errors.length) check('pacing', `${game} @${label} Hz: no page errors`, false, errors);
      await ctx.close();
    }
    const ref = hashes['60'];
    for (const label of ['30', '120', '144']) {
      check('replay', `${game}: ${label} Hz final state/RNG/settlement identical to 60 Hz`, hashes[label].stateJSON === ref.stateJSON && JSON.stringify(hashes[label].rng) === JSON.stringify(ref.rng) && JSON.stringify(hashes[label].settlement) === JSON.stringify(ref.settlement), { settlement: hashes[label].settlement });
    }
  }
  // Unfocused 30 Hz (the original defect ran at 0.50x)
  const { ctx, page } = await openGame(browser, 'flap', { seed: 'unfocused' });
  const r = await page.evaluate(() => {
    window.__manual(); const ui = window.__ui(); const g = window.__game;
    ui.round.config.combustionFloorPerTick = 0; ui.round.config.combustionChancePerTick = 0;
    ui.onPrimary(); ui.onPress();
    g.loop.inFocus = false; // Phaser caps smoothed delta while unfocused; the runner uses rawDelta
    window.__step(1000 / 30); const start = ui.round.tick;
    let wall = 0;
    for (let f = 0; f < 60; f++) { ui.round.state.playerY = 422; ui.round.state.playerVelocityY = 0; ui.round.state.pipes.length = 0; window.__step(1000 / 30); wall += 1000 / 30; } // exactly 2 s
    return ui.round.tick - start;
  });
  check('pacing', 'flap unfocused @30 Hz keeps real-time pace (was 0.50×)', Math.abs(r - 125) <= 1, { ticks: r });
  // 500 ms hitch retained; 1.5 s hitch pauses
  const h = await page.evaluate(() => {
    const ui = window.__ui();
    const before = ui.round.tick;
    ui.round.state.playerY = 422; ui.round.state.playerVelocityY = 0;
    window.__step(500);
    const afterHitchFrame = ui.round.tick - before;
    for (let i = 0; i < 4; i++) { ui.round.state.playerY = 422; ui.round.state.playerVelocityY = 0; window.__step(0.0001); }
    const recovered = ui.round.tick - before;
    window.__step(1500);
    return { afterHitchFrame, recovered, phase: ui.phase, paused: ui.runner.paused };
  });
  check('pacing', '500 ms hitch: debt kept (≤8 ticks/frame, 31 ticks recovered)', h.afterHitchFrame <= 8 && h.recovered === 31, h);
  check('pacing', '1.5 s hitch: explicit pause boundary', h.paused === 'hitch' && h.phase === 'paused', h);
  await ctx.close();
}

// ─── Input: quick taps, key repeat, Space start ──────────────────────────────
async function input(browser) {
  const { ctx, page } = await openGame(browser, 'flap', { seed: 'input' });
  await page.evaluate(() => window.__manual());
  // Space while ready: starts AND flaps on the first edge.
  await page.evaluate(() => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ' })); window.__step(16.7); });
  let s = await page.evaluate(() => window.__ui().debugSnapshot());
  check('input', 'Space in ready starts the round and applies the first flap', s.phase === 'playing' && Math.abs(s.velocity - -7.05) < 1e-9, { phase: s.phase, v: s.velocity });
  // Held key repeat: no extra flaps.
  const rep = await page.evaluate(() => {
    let flaps = 0;
    for (let i = 0; i < 30; i++) { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', repeat: true })); window.__step(16.7); if (Math.abs(window.__ui().round.state.playerVelocityY - -7.05) < 1e-9) flaps++; }
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ' }));
    return flaps;
  });
  check('input', 'held Space with 30 auto-repeat keydowns adds no flaps', rep === 0, { flaps: rep });
  // Quick real pointer tap (down+up before the next tick) is retained.
  await page.mouse.move(195, 400);
  await page.mouse.down(); await page.mouse.up();
  s = await page.evaluate(() => { window.__step(16.7); return window.__ui().debugSnapshot(); });
  check('input', 'quick real tap between ticks applies exactly one flap', Math.abs(s.velocity - -7.05) < 1e-9, { v: s.velocity });
  // Two-finger multi-touch in one tick → one impulse; release rearms.
  await ctx.close();
  const t = await openGame(browser, 'flap', { seed: 'touch', touch: true, mobile: true });
  const cdp = await t.ctx.newCDPSession(t.page);
  await t.page.evaluate(() => { window.__manual(); const ui = window.__ui(); ui.onPrimary(); ui.onPress(); window.__step(16.7); for (let i = 0; i < 40; i++) window.__step(16.7); });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 150, y: 400, id: 1 }, { x: 250, y: 420, id: 2 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const mt = await t.page.evaluate(() => { const a = window.__ui().runner.actionLog.length; window.__step(16.7); return { queued: window.__ui().runner.actionLog.slice(-2), v: window.__ui().round.state.playerVelocityY, a }; });
  check('input', 'two simultaneous touches in the stage flap once this tick (impulse not doubled)', Math.abs(mt.v - -7.05) < 1e-9, mt);
  await t.ctx.close();
}

// ─── Input isolation (footer/HUD never reach gameplay) ───────────────────────
async function isolation(browser) {
  {
    const { ctx, page } = await openGame(browser, 'jett', { seed: 'iso' });
    await page.evaluate(() => { window.__manual(); const ui = window.__ui(); ui.round.config.combustionFloorPerTick = 0; ui.round.config.combustionChancePerTick = 0; });
    await page.mouse.click(195, 780); // LAUNCH via the real CTA
    await page.evaluate(() => { for (let i = 0; i < 5; i++) window.__step(16.7); });
    await page.mouse.move(100, 400); await page.mouse.down(); await page.mouse.move(110, 400); await page.mouse.up(); // steer to ~x(100)
    const before = await page.evaluate(() => { window.__step(16.7); return window.__ui().debugSnapshot().targetX; });
    await page.mouse.click(195, 780); // CASH OUT tap
    const after = await page.evaluate(() => { window.__step(16.7); return window.__ui().debugSnapshot(); });
    check('isolation', 'Jett: CASH OUT tap does not steer (target unchanged) and settles once', after.targetX === before && after.settlement && after.settlement.reason === 'cashout', { before, target: after.targetX, settlement: after.settlement });
    const steersLogged = await page.evaluate(() => window.__ui().runner.actionLog.filter((a) => a.type === 'steer').map((a) => a.value));
    check('isolation', 'Jett: no steer action carries the CTA x (318/195 world) from the footer tap', !steersLogged.some((v) => v === Math.round((195 - 69.3128) / 0.6445)), { steers: steersLogged.slice(-5) });
    await ctx.close();
  }
  {
    const { ctx, page } = await openGame(browser, 'flap', { seed: 'iso' });
    await page.evaluate(() => { window.__manual(); const ui = window.__ui(); ui.onPrimary(); ui.onPress(); for (let i = 0; i < 30; i++) window.__step(16.7); });
    const a0 = await page.evaluate(() => window.__ui().runner.actionLog.filter((a) => a.type === 'flap').length);
    await page.mouse.click(195, 780); // disabled CASH OUT before the first gate
    await page.mouse.click(346, 28);  // settings icon → pauses
    const s = await page.evaluate(() => { window.__step(16.7); return { flaps: window.__ui().runner.actionLog.filter((a) => a.type === 'flap').length, phase: window.__ui().phase, paused: window.__ui().runner.paused, settingsOpen: window.__ui().shell.settingsOpen }; });
    check('isolation', 'Flap: footer and settings taps never flap', s.flaps === a0, { a0, ...s });
    check('isolation', 'Flap: opening settings pauses the round (no hidden danger)', s.paused === 'settings' && s.phase === 'paused' && s.settingsOpen, s);
    await page.mouse.click(195, 400); // tap inside the modal backdrop must not flap or resume
    const s2 = await page.evaluate(() => { window.__step(16.7); return { flaps: window.__ui().runner.actionLog.filter((a) => a.type === 'flap').length, paused: window.__ui().runner.paused }; });
    check('isolation', 'Flap: taps on the open settings panel do not reach the stage', s2.flaps === a0 && s2.paused === 'settings', s2);
    await page.keyboard.press('Escape');
    const s3 = await page.evaluate(() => ({ phase: window.__ui().phase, settingsOpen: window.__ui().shell.settingsOpen }));
    check('isolation', 'Flap: Escape closes settings and leaves the round paused until an explicit resume', !s3.settingsOpen && s3.phase === 'paused', s3);
    await ctx.close();
  }
  {
    // Same-tick cash-out ordering through the real UI: CTA queued, applied at the next tick start.
    const { ctx, page } = await openGame(browser, 'jett', { seed: 'order' });
    const r = await page.evaluate(() => {
      window.__manual(); const ui = window.__ui(); ui.onPrimary();
      for (let i = 0; i < 10; i++) window.__step(16);
      const st = ui.round.state;
      st.asteroids.push({ id: 9999, x: st.playerX, worldY: st.altitude + 22, radius: 20, driftX: 0, rotationAngle: 0, rotationSpeed: 0 });
      const tickAtQueue = ui.round.tick;
      ui.onPrimary(); // CASH OUT, queued
      window.__step(16);
      return { tickAtQueue, settlement: ui.round.settlement };
    });
    check('isolation', 'Jett: cash-out queued before a lethal tick settles as cash-out at that tick (D-6)', r.settlement && r.settlement.reason === 'cashout' && r.settlement.tick === r.tickAtQueue, r);
    await ctx.close();
  }
}

// ─── Shatter truthfulness through the UI ─────────────────────────────────────
async function shatter(browser) {
  const { ctx, page, errors } = await openGame(browser, 'shatter', { seed: 'truth' });
  const res = await page.evaluate(async () => {
    const ui = window.__ui(); const out = [];
    for (let round = 0; round < 40; round++) {
      while (ui.phase !== 'ready') { ui.onPrimary(); await new Promise((r) => setTimeout(r, 20)); }
      let lost = false;
      for (let row = 0; row < 10 && !lost && ui.phase !== 'settled'; row++) {
        const side = ((round * 7 + row * 3) % 5) < 2 ? 'left' : 'right'; // scripted, outcome-blind choice
        ui.choose(row, side, { x: 100, y: 100 });
        const p = ui.round.picks[ui.round.picks.length - 1];
        if (!p || p.side !== side) { out.push({ round, error: 'pick side mismatch', side, p }); break; }
        if (!p.safe) lost = true;
      }
      // Cosmetic sequencing runs on Phaser's scene clock, which stretches during TimeStep's start-up
      // cool-down on slow frames; wait for the settled state rather than a fixed wall time.
      for (let w = 0; w < 300 && ui.phase !== 'settled'; w++) await new Promise((r) => setTimeout(r, 10));
      await new Promise((r) => setTimeout(r, 30));
      const s = ui.debugSnapshot();
      const broken = s.settlement && s.settlement.reason === 'shatter' ? s.settlement : null;
      out.push({ round, settled: s.phase === 'settled', reveal: s.revealed, broken, picks: s.picks, shards: s.visibleShards, hits: s.interactiveHits });
    }
    return out;
  });
  const bad = res.filter((r) => r.error || (r.broken && r.reveal[r.broken.brokenRow] === r.broken.brokenSide) || r.picks.some((p) => (p.safe ? p.side !== r.reveal[p.row] : p.side === r.reveal[p.row])));
  check('shatter', '40 UI rounds: chosen pane decides outcome; losing pane never revealed safe; every pick matches the committed board', bad.length === 0, { rounds: res.length, losses: res.filter((r) => r.broken).length, bad: bad.slice(0, 2) });
  const dirty = res.filter((r) => !(r.shards === 0 && r.hits === 0 && r.settled));
  check('shatter', 'after each round: no shards left, no interactive panes', dirty.length === 0, dirty.slice(0, 3).map((r) => ({ round: r.round, shards: r.shards, hits: r.hits, settled: r.settled, picks: r.picks.length })));
  check('shatter', 'no page errors over 40 rounds', errors.length === 0, errors);
  // Future/past rows are not interactive; only the current row is.
  const rows = await page.evaluate(async () => {
    const ui = window.__ui(); while (ui.phase !== 'ready') { ui.onPrimary(); await new Promise((r) => setTimeout(r, 20)); }
    const enabled = ui.hits.map((h, i) => (h.input && h.input.enabled ? i : -1)).filter((i) => i >= 0);
    return enabled;
  });
  check('shatter', 'only the current row (2 panes) is interactive', rows.length === 2 && rows[0] === 0 && rows[1] === 1, rows);
  // Double-tap on the same pane: one pick.
  const dbl = await page.evaluate(() => {
    const ui = window.__ui(); const side = ui.round.board[0];
    ui.choose(0, side, { x: 100, y: 600 }); ui.choose(0, side, { x: 100, y: 600 });
    return ui.round.picks.length;
  });
  check('shatter', 're-entrant double pick on the same row records one pick', dbl === 1, { picks: dbl });
  await ctx.close();
}

// ─── 50 restarts & lifecycle ─────────────────────────────────────────────────
async function restarts(browser) {
  for (const game of ['jett', 'flap', 'shatter']) {
    const { ctx, page, errors } = await openGame(browser, game, { seed: 'restart' });
    const cdp = await ctx.newCDPSession(page);
    const snap = () => page.evaluate(([k]) => {
      const s = window.__game.scene.getScene(k);
      return {
        updateListeners: s.events.listenerCount('update'), shutdownListeners: s.events.listenerCount('shutdown'),
        timers: s.time._active.length + s.time._pendingInsertion.length, tweens: s.tweens.getTweens().length,
        displayList: s.sys.displayList.length, a11yRoots: document.querySelectorAll('.sd-a11y').length,
        domButtons: document.querySelectorAll('.sd-a11y button').length,
        audioContexts: window.__counters.audioContextsCreated,
      };
    }, [SCENES[game][0]]);
    await cdp.send('HeapProfiler.collectGarbage');
    const heap0 = await page.evaluate(() => performance.memory ? performance.memory.usedJSHeapSize : 0);
    const before = await snap();
    for (let c = 0; c < 50; c++) {
      await page.evaluate(async ([k, game, c]) => {
        const s = window.__game.scene.getScene(k);
        const ui = window.__ui();
        ui.onPrimary(); // start
        if (game === 'flap') ui.onPress();
        if (game === 'shatter') { const b = ui.round.board; ui.choose(0, c % 2 ? b[0] : (b[0] === 'left' ? 'right' : 'left'), { x: 120, y: 620 }); }
        await new Promise((r) => setTimeout(r, game === 'shatter' ? 60 : 30)); // restart mid-break/result
        s.scene.restart();
        await new Promise((r) => { const check = () => (window.__ui() ? r() : setTimeout(check, 10)); setTimeout(check, 30); });
      }, [SCENES[game][0], game, c]);
    }
    await page.waitForTimeout(800);
    const after = await snap();
    await cdp.send('HeapProfiler.collectGarbage');
    const heap1 = await page.evaluate(() => performance.memory ? performance.memory.usedJSHeapSize : 0);
    const flat = ['updateListeners', 'shutdownListeners', 'a11yRoots', 'domButtons', 'displayList'].every((k) => after[k] === before[k]);
    check('restarts', `${game}: 50 restarts keep listeners/DOM/display list flat`, flat, { before, after });
    check('restarts', `${game}: timers/tweens bounded after 50 restarts (mid-break/result)`, after.timers <= before.timers + 1 && after.tweens <= before.tweens + 2, { timers: [before.timers, after.timers], tweens: [before.tweens, after.tweens] });
    check('restarts', `${game}: at most one AudioContext ever (Phaser sound + app audio service)`, after.audioContexts <= 2 && after.audioContexts - before.audioContexts <= 1, { before: before.audioContexts, after: after.audioContexts });
    check('restarts', `${game}: heap after forced GC within +3 MB`, heap1 - heap0 < 3 * 1048576, { deltaMB: +((heap1 - heap0) / 1048576).toFixed(2) });
    check('restarts', `${game}: no page errors (no ghost callbacks after restart)`, errors.length === 0, errors.slice(0, 3));
    await ctx.close();
  }
}

// ─── Accessibility shell ─────────────────────────────────────────────────────
async function a11y(browser) {
  const { ctx, page } = await openGame(browser, 'shatter', { seed: 'a11y', reducedMotion: true });
  const labels = await page.evaluate(() => [...document.querySelectorAll('.sd-a11y button')].map((b) => b.getAttribute('aria-label')));
  check('a11y', 'labelled controls exist: Back, Settings, CTA, current-row panes', ['Back to lobby', 'Settings'].every((l) => labels.includes(l)) && labels.some((l) => /Start round/.test(l)) && labels.some((l) => /Row 1, left pane/.test(l)), labels);
  await page.keyboard.press('Tab');
  const focus = await page.evaluate(() => { const el = document.activeElement; const cs = getComputedStyle(el); return { label: el.getAttribute('aria-label'), outline: cs.outlineStyle, width: cs.outlineWidth }; });
  check('a11y', 'Tab focuses a shell control with a visible outline', focus.label && focus.outline !== 'none' && parseFloat(focus.width) >= 2, focus);
  // Keyboard: focus CTA, Enter starts; focus pane button, Enter picks.
  const kb = await page.evaluate(() => {
    const cta = [...document.querySelectorAll('.sd-a11y button')].find((b) => /Start round/.test(b.getAttribute('aria-label') || ''));
    cta.focus(); return !!cta;
  });
  await page.keyboard.press('Enter');
  const started = await page.evaluate(() => window.__ui().debugSnapshot().phase);
  await page.evaluate(() => { [...document.querySelectorAll('.sd-a11y button')].find((b) => /Row 1, left pane/.test(b.getAttribute('aria-label') || '')).focus(); });
  await page.keyboard.press('Enter');
  const picked = await page.evaluate(() => window.__ui().debugSnapshot().picks.length);
  check('a11y', 'keyboard: Enter on CTA starts; Enter on a pane button picks once', kb && started === 'armed' && picked === 1, { started, picked });
  const live = await page.evaluate(() => document.querySelector('.sd-a11y [aria-live]').textContent);
  check('a11y', 'aria-live region announces round events', /Row 1|Glass broke|Round started/.test(live), { live });
  const rm = await page.evaluate(() => window.__ui().shell.settings.reducedMotion);
  check('a11y', 'OS prefers-reduced-motion is the default setting', rm === true, { rm });
  // Settings dialog: open, role=dialog, checkbox toggles high contrast, persists.
  await page.evaluate(() => [...document.querySelectorAll('.sd-a11y button')].find((b) => b.getAttribute('aria-label') === 'Settings').click());
  const dlg = await page.evaluate(() => { const d = document.querySelector('.sd-a11y [role=dialog]'); const boxes = d ? [...d.querySelectorAll('input[type=checkbox]')] : []; const hc = boxes[3]; hc && hc.click(); return { open: !!d, modal: d && d.getAttribute('aria-modal'), boxes: boxes.length, focused: document.activeElement && document.activeElement.type, hc: window.__ui().shell.tokens.highContrast, saved: localStorage.getItem('jett.demo.settings.v1') }; });
  check('a11y', 'settings dialog is modal, focus moves into it, toggling persists', dlg.open && dlg.modal === 'true' && dlg.boxes === 5 && dlg.focused === 'checkbox' && dlg.hc === true && /"highContrast":true/.test(dlg.saved || ''), dlg);
  await page.screenshot({ path: path.join(OUT, 'screenshots', 'a11y-settings-high-contrast.png') });
  await ctx.close();
}

// ─── Layout: widths, landscape, DPR, CTA always visible ──────────────────────
async function layout(browser) {
  const viewports = [[320, 568, 1], [390, 844, 2], [430, 932, 3], [844, 390, 2], [568, 320, 1]];
  for (const game of ['jett', 'flap', 'shatter']) {
    for (const [w, h, dpr] of viewports) {
      const { ctx, page, errors } = await openGame(browser, game, { viewport: { width: w, height: h }, dpr, seed: 'layout' });
      await page.waitForTimeout(250);
      const m = await page.evaluate(() => {
        const c = window.__game.canvas.getBoundingClientRect();
        const cta = [...document.querySelectorAll('.sd-a11y button')].find((b) => /Start|Launch/i.test(b.getAttribute('aria-label') || ''));
        const r = cta.getBoundingClientRect();
        return { canvas: [Math.round(c.left), Math.round(c.top), Math.round(c.width), Math.round(c.height)], cta: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], vw: innerWidth, vh: innerHeight, store: [window.__game.canvas.width, window.__game.canvas.height] };
      });
      const inside = m.cta[0] >= 0 && m.cta[1] >= 0 && m.cta[0] + m.cta[2] <= m.vw + 1 && m.cta[1] + m.cta[3] <= m.vh + 1;
      const aspect = Math.abs(m.canvas[2] / m.canvas[3] - 390 / 844) < 0.01;
      check('layout', `${game} ${w}×${h}@${dpr}x: CTA fully visible, aspect preserved, no errors`, inside && aspect && errors.length === 0, m);
      if (w === 390 || w === 844) await page.screenshot({ path: path.join(OUT, 'screenshots', `layout-${game}-${w}x${h}@${dpr}x.png`) });
      await ctx.close();
    }
  }
}

// ─── Frame-time distributions (SwiftShader; relative only) ──────────────────
async function perf(browser) {
  report.results.perf = report.results.perf || [];
  const dist = (arr) => { const s = [...arr].sort((a, b) => a - b); const q = (p) => +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(2); return { n: s.length, p50: q(0.5), p95: q(0.95), p99: q(0.99), max: q(1), over33: s.filter((x) => x > 33.4).length, over50: s.filter((x) => x > 50).length }; };
  for (const throttle of [1, 4]) {
    for (const game of ['jett', 'flap', 'shatter']) {
      for (const env of [true, false]) {
        const { ctx, page } = await openGame(browser, game, { seed: 'perf-' + game });
        const cdp = await ctx.newCDPSession(page);
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
        const r = await page.evaluate(async ([game, env]) => {
          const ui = window.__ui(); const g = window.__game;
          if (!env) for (const k of ['sky', 'stars', 'planet', 'satellite', 'horizonFar', 'horizonNear', 'farLayer', 'nearLayer', 'shaft']) ui[k] && ui[k].setVisible(false);
          ui.round.config.combustionFloorPerTick = 0; ui.round.config.combustionChancePerTick = 0;
          const measure = (ms) => new Promise((res) => {
            const step = []; const ivl = []; let a = 0; let last = performance.now();
            const pre = () => { a = performance.now(); ivl.push(a - last); last = a; };
            const post = () => step.push(performance.now() - a);
            g.events.on('prestep', pre); g.events.on('postrender', post);
            setTimeout(() => { g.events.off('prestep', pre); g.events.off('postrender', post); res({ step, ivl }); }, ms);
          });
          const idle = await measure(2000);
          let active;
          if (game === 'shatter') {
            ui.onPrimary();
            const b = ui.round.board;
            ui.choose(0, b[0], { x: 0, y: 0 }); ui.choose(1, b[1], { x: 0, y: 0 });
            const p = measure(900);
            ui.choose(2, b[2] === 'left' ? 'right' : 'left', { x: 260, y: 532 }); // glass break effect window
            active = await p;
          } else {
            ui.onPrimary(); if (game === 'flap') ui.onPress();
            const keep = setInterval(() => {
              if (game === 'flap' && ui.round) { ui.round.state.playerY = 422; ui.round.state.playerVelocityY = 0; ui.round.state.pipes.forEach((q) => { q.topHeight = 300; q.bottomHeight = 386; }); }
              if (game === 'jett' && ui.round) { ui.round.state.asteroids.forEach((q) => { if (Math.abs(q.worldY - ui.round.state.altitude) < 60) q.x = q.x < 195 ? 30 : 360; }); }
            }, 4);
            active = await measure(4000);
            clearInterval(keep);
          }
          return { idle, active, phase: ui.phase };
        }, [game, env]);
        const row = { game, cpuThrottle: throttle, environment: env ? 'on' : 'off', idleStepMs: dist(r.idle.step), idleFrameIntervalMs: dist(r.idle.ivl), activeStepMs: dist(r.active.step), activeFrameIntervalMs: dist(r.active.ivl), endedPhase: r.phase };
        report.results.perf.push(row);
        console.log('PERF', JSON.stringify(row));
        await ctx.close();
      }
    }
  }
}

// ─── All-scene smoke on the production entry point (index.html → main.ts) ────
async function smoke(browser) {
  const keys = ['HomeScene', 'JettScene', 'ShatterStepScene', 'FlapFortuneScene', 'DiceScene', 'MinesScene', 'BallDropScene', 'MasqueradeScene', 'AlchemistScene', 'InfernoScene', 'SurgeScene', 'DiceDuelScene'];
  for (const key of keys) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage(); const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.route(/jett-landing/, (r) => r.abort());
    await page.addInitScript(() => sessionStorage.setItem('jg_auth', 'ok'));
    await page.goto(`${BASE}/?scene=${key}`);
    await page.waitForTimeout(1800);
    const ok = await page.evaluate((k) => { const c = document.querySelector('canvas'); return !!c && c.width > 0; }, key);
    check('smoke', `production entry ${key}: boots without page errors`, ok && errors.length === 0, errors.slice(0, 2));
    await ctx.close();
  }
}

// ─── Review captures (seeded) ────────────────────────────────────────────────
async function captures(browser) {
  for (const theme of ['gold', 'emerald', 'violet']) {
    for (const game of ['jett', 'flap', 'shatter']) {
      const { ctx, page } = await openGame(browser, game, { dpr: 2, seed: `capture-${game}` });
      await page.evaluate((theme) => { const sh = window.__ui().shell; sh.applySetting({ ...sh.settings, theme }); }, theme);
      await page.waitForTimeout(250);
      await page.screenshot({ path: path.join(OUT, 'screenshots', `ready-${game}-${theme}.png`) });
      await ctx.close();
    }
  }
}

(async () => {
  const which = process.argv.slice(2);
  const all = { pacing: pacingAndReplay, input, isolation, shatter, restarts, a11y, layout, perf, smoke, captures };
  const browser = await chromium.launch({ args: ['--enable-precise-memory-info'] });
  report.meta = { date: new Date().toISOString(), chromium: browser.version(), base: BASE, sections: which.length ? which : Object.keys(all), note: 'Headless Chromium on SwiftShader (software WebGL). Performance figures are relative to this environment only, not mobile measurements.' };
  for (const [name, fn] of Object.entries(all)) {
    if (which.length && !which.includes(name)) continue;
    if (name === 'pacing' && which.includes('replay')) continue;
    const t0 = Date.now();
    try { await fn(browser); } catch (e) { check(name, 'section completed without exceptions', false, String(e && e.stack || e).slice(0, 500)); }
    report.meta[`${name}Seconds`] = (Date.now() - t0) / 1000;
  }
  await browser.close();
  const file = path.join(OUT, `browser-report${which.length ? '-' + which.join('-') : ''}.json`);
  fs.writeFileSync(file, JSON.stringify(report, null, 2));
  const total = Object.values(report.results).flat().filter((r) => r.ok !== undefined).length;
  console.log(`\n${total - failures}/${total} browser checks passed. Report: ${path.relative(process.cwd(), file)}`);
  process.exitCode = failures ? 1 : 0;
})();

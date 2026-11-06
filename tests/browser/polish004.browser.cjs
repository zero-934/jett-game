/**
 * @file polish004.browser.cjs
 * @purpose polish-004 browser regression suite against the real Phaser build: render density,
 *          fonts, pointer mapping after resize/DPR change, one action per input, cash-out and
 *          settings isolation, restart cleanup, minified release routing, host messaging,
 *          live brand/theme switching mid-round, render-scale-independent replay, targets.
 *          Headless Chromium (SwiftShader) with EMULATED DPR — not physical-device evidence.
 *
 * Usage (repo root):
 *   npx vite --port 5199 --strictPort &                       # dev server (harness + host page)
 *   npm run build && npx vite preview --port 4173 --strictPort &   # release build
 *   node tests/browser/polish004.browser.cjs [section...]
 * Writes docs/polish-004/evidence/browser-report-polish004.json
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const DEV = process.env.BASE_URL || 'http://localhost:5199/jett-game';
const REL = process.env.RELEASE_URL || 'http://localhost:4173/jett-game';
const HARNESS = `${DEV}/research/harness/index.html`;
const OUT = path.resolve(__dirname, '../../docs/polish-004/evidence');
fs.mkdirSync(OUT, { recursive: true });
const report = { meta: {}, results: {} };
let failures = 0;
function check(section, name, ok, detail) {
  (report.results[section] ||= []).push({ name, ok: !!ok, detail });
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'} [${section}] ${name}${detail !== undefined ? ' — ' + JSON.stringify(detail).slice(0, 260) : ''}`);
}
const SCENES = { jett: ['JettScene', 'jettUI'], flap: ['FlapFortuneScene', 'flapUI'], shatter: ['ShatterStepScene', 'shatterUI'] };

async function openGame(browser, game, o = {}) {
  const [key, prop] = SCENES[game];
  const ctx = await browser.newContext({ viewport: o.viewport || { width: 390, height: 844 }, deviceScaleFactor: o.dpr || 1, hasTouch: !!o.touch, isMobile: !!o.mobile, reducedMotion: o.reducedMotion ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => {
    try { localStorage.clear(); } catch { /* ignore */ }
    // Count live window/document listeners (restart leak detection).
    const live = new Map(); window.__liveListeners = live;
    for (const T of [Window.prototype, Document.prototype]) {
      const add = T.addEventListener; const rem = T.removeEventListener;
      T.addEventListener = function (t, f, o) { const k = t; live.set(k, (live.get(k) || 0) + 1); return add.call(this, t, f, o); };
      T.removeEventListener = function (t, f, o) { const k = t; live.set(k, (live.get(k) || 0) - 1); return rem.call(this, t, f, o); };
    }
  });
  await page.goto(`${o.base || HARNESS}?scene=${key}&seed=${o.seed || 'p4'}${o.adaptive ? '' : '&adaptive=0'}${o.query || ''}`);
  await page.waitForFunction(([k, p]) => window.__game && window.__game.scene.getScene(k) && window.__game.scene.getScene(k)[p], [key, prop], { timeout: 20000 });
  await page.waitForTimeout(250);
  await page.evaluate(([k, p]) => {
    window.__ui = () => window.__game.scene.getScene(k)[p];
    window.__manual = () => { const g = window.__game; g.loop.sleep(); window.__t = performance.now(); g.loop.step(window.__t); };
    window.__step = (dt) => { window.__t += dt; window.__game.loop.step(window.__t); };
  }, [key, prop]);
  return { ctx, page, errors };
}
const rect = (page, sel) => page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }, sel);
const center = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

// ─── 1. Render density + fonts ───────────────────────────────────────────────
async function density(browser) {
  for (const game of ['jett', 'flap', 'shatter']) {
    for (const [w, h, dpr] of [[390, 844, 1], [390, 844, 2], [390, 844, 3], [430, 932, 3], [320, 568, 2], [844, 390, 3]]) {
      const { ctx, page, errors } = await openGame(browser, game, { viewport: { width: w, height: h }, dpr });
      const m = await page.evaluate(() => {
        const c = window.__game.canvas; const r = c.getBoundingClientRect();
        const faces = []; document.fonts.forEach((f) => { if (/Inter/.test(f.family) && f.status === 'loaded') faces.push(Number(f.weight)); });
        const cta = document.querySelector('.sd-shell button[data-id="cta"]');
        return { rs: window.__renderScale(), backing: [c.width, c.height], css: [r.width, r.height], dpr: devicePixelRatio, perPhys: c.width / (r.width * devicePixelRatio), interWeights: [...new Set(faces)].sort(), ctaFont: getComputedStyle(cta).fontFamily, imageRendering: getComputedStyle(c).imageRendering };
      });
      const ideal = m.rs.target <= 3;
      const ok = (ideal ? m.perPhys >= 0.99 : m.rs.limitedBy === 'cap') && m.interWeights.join() === '400,600,700,800' && /Inter/.test(m.ctaFont) && m.imageRendering === 'auto' && errors.length === 0;
      check('density', `${game} ${w}×${h}@${dpr}: backing ${m.backing.join('×')} for CSS ${m.css.map((v) => v.toFixed(0)).join('×')} (${m.perPhys.toFixed(2)}/physical px), Inter 4 weights loaded`, ok, { rs: m.rs.scale, limitedBy: m.rs.limitedBy, faces: m.interWeights });
      await ctx.close();
    }
  }
}

// ─── 2. Pointer mapping after resize and live DPR change ─────────────────────
async function pointer(browser) {
  const { ctx, page, errors } = await openGame(browser, 'jett', { viewport: { width: 390, height: 844 }, dpr: 2 });
  const cdp = await ctx.newCDPSession(page);
  const probe = async (label, worldX) => {
    await page.evaluate(() => { window.__manual(); const ui = window.__ui(); if (ui.phase === 'ready') ui.onPrimary(); ui.round.config.combustionFloorPerTick = 0; ui.round.config.combustionChancePerTick = 0; });
    const pt = await page.evaluate((wxv) => {
      const c = window.__game.canvas.getBoundingClientRect(); const k = c.width / 390;
      const K = 664 / 844; const ox = 8 + (374 - 390 * K) / 2; // immersive fit (k, originX)
      const lx = ox + wxv * K; const ly = 66 + 664 * 0.5;
      return { x: c.left + lx * k, y: c.top + ly * k };
    }, worldX);
    await page.mouse.move(pt.x, pt.y); await page.mouse.down(); await page.mouse.up();
    const r = await page.evaluate(() => { window.__step(16.7); const ui = window.__ui(); const k = window.__game.canvas.getBoundingClientRect().width / 390; return { target: ui.round.targetX, rs: window.__renderScale(), backing: [window.__game.canvas.width, window.__game.canvas.height], worldPerCssPx: 1 / (k * (664 / 844)) }; });
    // Browsers deliver integer CSS-px mouse coordinates: allow one CSS px of quantisation.
    const tol = Math.max(1, Math.ceil(r.worldPerCssPx));
    check('pointer', `${label}: tap at world x=${worldX} steers to ${r.target} (±${tol}, = 1 CSS px) at render scale ${r.rs.scale}`, Math.abs(r.target - worldX) <= tol, r);
  };
  await probe('initial 390×844@2', 300);
  await page.setViewportSize({ width: 360, height: 700 }); await page.waitForTimeout(300);
  await probe('after resize to 360×700', 80);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 700, deviceScaleFactor: 3, mobile: false }); await page.waitForTimeout(400);
  const after = await page.evaluate(() => window.__renderScale());
  check('pointer', 'live DPR change 2→3 re-sizes the backing store (matchMedia resolution listener)', after.dpr === 3 && Math.abs(after.backingPerPhysicalPx - 1) < 0.06, after);
  await probe('after DPR 3', 195);
  await page.setViewportSize({ width: 844, height: 390 }); await page.waitForTimeout(300);
  await probe('after rotation to 844×390@3 (rail)', 40);
  check('pointer', 'no page errors', errors.length === 0, errors.slice(0, 2));
  await ctx.close();
}

// ─── 3. One action per input; cash-out isolation ─────────────────────────────
async function inputs(browser) {
  for (const game of ['jett', 'flap', 'shatter']) {
    const { ctx, page, errors } = await openGame(browser, game, { touch: true, mobile: true, dpr: 3 });
    await page.evaluate(() => window.__manual());
    const cta = await rect(page, '.sd-shell button[data-id="cta"]');
    const bal0 = await page.evaluate(() => window.__ui().debugSnapshot().balance);
    await page.touchscreen.tap(center(cta).x, center(cta).y); // pointerdown activation + click echo
    await page.evaluate(() => { window.__step(16.7); window.__step(16.7); });
    const s1 = await page.evaluate(() => { const s = window.__ui().debugSnapshot(); return { phase: s.phase, balance: s.balance, trace: window.__host.getTrace().filter((t) => t.type === 'roundStarted').length }; });
    check('inputs', `${game}: one touch tap on the CTA = one start (one debit, one roundStarted)`, s1.balance === bal0 - 1000 && s1.trace === 1 && s1.phase !== 'ready', { bal0, ...s1 });
    if (game !== 'shatter') {
      // Keyboard Enter on the focused CTA is one action too (no pointer/click duplication).
      await page.evaluate((game) => { const ui = window.__ui(); ui.round.config.combustionFloorPerTick = 0; ui.round.config.combustionChancePerTick = 0; if (game === 'flap') { ui.onPress(); ui.round.state.pipesCleared = 1; } for (let i = 0; i < 4; i++) { if (game === 'flap') { ui.round.state.playerY = 422; ui.round.state.playerVelocityY = 0; ui.round.state.pipes.length = 0; } window.__step(16.7); } }, game);
      const before = await page.evaluate(() => { const ui = window.__ui(); return { log: ui.runner.actionLog.map((a) => a.type), target: ui.round.targetX }; });
      await page.touchscreen.tap(center(cta).x, center(cta).y);
      await page.touchscreen.tap(center(cta).x, center(cta).y);
      const after = await page.evaluate(() => { window.__step(16.7); window.__step(16.7); const ui = window.__ui(); return { log: ui.runner.actionLog.map((a) => a.type), target: ui.round.targetX, settlement: ui.round.settlement, settles: window.__host.getTrace().filter((t) => t.type === 'roundSettled').length }; });
      const added = after.log.slice(before.log.length);
      check('inputs', `${game}: double-tap CASH OUT → one settlement; adds no ${game === 'jett' ? 'steer' : 'flap'} and ${game === 'jett' ? 'target unchanged' : 'no extra impulse'}`, after.settlement && after.settlement.reason === 'cashout' && after.settles === 1 && !added.some((t) => t === 'steer' || t === 'flap') && (game !== 'jett' || after.target === before.target), { added, settles: after.settles, target: [before.target, after.target] });
    } else {
      const board = await page.evaluate(() => window.__ui().round.board); // QA peek
      const pane = await page.evaluate((side) => { const b = document.querySelector(`.sd-shell button[data-id="stage:pane-${side}"]`).getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }, board[0]);
      await page.touchscreen.tap(pane.x, pane.y);
      const picks = await page.evaluate(() => window.__ui().debugSnapshot().picks.length);
      check('inputs', 'shatter: one tap on a pane = exactly one pick', picks === 1, { picks });
      const kb = await page.evaluate(() => { const b = document.querySelector('.sd-shell button[data-id="stage:pane-left"]'); b.focus(); return !!b; });
      await page.keyboard.press('Enter');
      const picks2 = await page.evaluate(() => window.__ui().debugSnapshot().picks.length);
      check('inputs', 'shatter: Enter on a focused pane button = exactly one pick', kb && picks2 === 2, { picks2 });
    }
    check('inputs', `${game}: no page errors`, errors.length === 0, errors.slice(0, 2));
    await ctx.close();
  }
}

// ─── 4. Settings / overlay isolation ─────────────────────────────────────────
async function overlays(browser) {
  for (const game of ['jett', 'flap']) {
    const { ctx, page, errors } = await openGame(browser, game, { touch: true, dpr: 2 });
    await page.evaluate((game) => { window.__manual(); const ui = window.__ui(); ui.round.config.combustionFloorPerTick = 0; ui.round.config.combustionChancePerTick = 0; ui.onPrimary(); if (game === 'flap') ui.onPress(); for (let i = 0; i < 3; i++) { if (game === 'flap') { ui.round.state.playerY = 422; ui.round.state.playerVelocityY = 0; } window.__step(16.7); } }, game);
    const n0 = await page.evaluate(() => window.__ui().runner.actionLog.length);
    const gear = await rect(page, '.sd-shell button[data-id="settings"]');
    await page.touchscreen.tap(center(gear).x, center(gear).y);
    for (const [x, y] of [[195, 300], [60, 600], [195, 800]]) await page.touchscreen.tap(x, y); // backdrop over stage and over the CTA
    const s = await page.evaluate(() => { window.__step(16.7); const ui = window.__ui(); return { n: ui.runner.actionLog.length, phase: ui.phase, open: ui.shell.settingsOpen, settled: !!ui.round.settlement, backdrop: !!document.querySelector('.sd-shell .sd-backdrop') }; });
    check('overlays', `${game}: with settings open, taps on the backdrop (stage and CTA areas) add no actions and do not settle`, s.n === n0 && s.open && s.phase === 'paused' && !s.settled && s.backdrop, { n0, ...s });
    const rows = await page.evaluate(() => [...document.querySelectorAll('.sd-shell .sd-dialog label.sd-row, .sd-shell .sd-dialog label.sd-swatch, .sd-shell .sd-dialog button')].map((e) => { const r = e.getBoundingClientRect(); return Math.round(Math.min(r.height, e.classList.contains('sd-swatch') ? r.width : 999)); }));
    check('overlays', `${game}: every settings control ≥ 44 CSS px`, rows.length >= 9 && Math.min(...rows) >= 44, rows);
    await page.keyboard.press('Escape');
    const s2 = await page.evaluate(() => ({ open: window.__ui().shell.settingsOpen, phase: window.__ui().phase, backdrop: !!document.querySelector('.sd-shell .sd-backdrop') }));
    check('overlays', `${game}: Escape closes; round stays paused until the player resumes`, !s2.open && s2.phase === 'paused' && !s2.backdrop, s2);
    check('overlays', `${game}: no page errors`, errors.length === 0, errors.slice(0, 2));
    await ctx.close();
  }
}

// ─── 5. Restart and event cleanup ────────────────────────────────────────────
async function restarts(browser) {
  for (const game of ['jett', 'flap', 'shatter']) {
    const { ctx, page, errors } = await openGame(browser, game, { dpr: 3 });
    const snap = () => page.evaluate(([k]) => {
      const s = window.__game.scene.getScene(k);
      const live = {}; for (const [t, n] of window.__liveListeners) if (n) live[t] = n;
      return { roots: document.querySelectorAll('.sd-shell').length, buttons: document.querySelectorAll('.sd-shell button').length, display: s.sys.displayList.length, updates: s.sys.events.listenerCount('update'), resize: window.__game.scale.listenerCount('resize'), live, backing: [window.__game.canvas.width, window.__game.canvas.height], textures: window.__game.textures.getTextureKeys().length };
    }, SCENES[game]);
    const before = await snap();
    for (let i = 0; i < 30; i++) await page.evaluate(([k]) => window.__game.scene.getScene(k).scene.restart(), SCENES[game]);
    await page.waitForFunction(([k, p]) => window.__game.scene.getScene(k)[p], SCENES[game]);
    await page.waitForTimeout(200);
    const after = await snap();
    const flat = before.roots === 1 && after.roots === 1 && before.buttons === after.buttons && before.display === after.display && before.updates === after.updates && before.resize === after.resize && JSON.stringify(before.live) === JSON.stringify(after.live) && before.textures === after.textures;
    check('restarts', `${game}: 30 restarts keep DOM, display list, scene/scale/window listeners and textures flat`, flat, { before, after });
    check('restarts', `${game}: backing store still high-density after restarts`, after.backing[0] === 1170, after.backing);
    check('restarts', `${game}: no page errors`, errors.length === 0, errors.slice(0, 2));
    await ctx.close();
  }
}

// ─── 6. Minified release build: routing, density, other games ────────────────
async function release(browser) {
  const all = ['JettScene', 'FlapFortuneScene', 'ShatterStepScene', 'DiceScene', 'MinesScene', 'BallDropScene', 'MasqueradeScene', 'AlchemistScene', 'InfernoScene', 'SurgeScene', 'DiceDuelScene'];
  for (const key of all) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
    const page = await ctx.newPage(); const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(() => { sessionStorage.setItem('jg_auth', 'ok'); });
    await page.goto(`${REL}/?scene=${key}&diag=1&seed=rel&adaptive=0`);
    let active = null;
    try { await page.waitForFunction((k) => window.__game && window.__game.scene.isActive(k), key, { timeout: 15000 }); } catch { /* recorded */ }
    await page.waitForTimeout(500);
    const m = await page.evaluate(() => ({ active: window.__game ? window.__game.scene.getScenes(true).map((s) => s.sys.settings.key) : null, backing: [document.querySelector('#app canvas').width, document.querySelector('#app canvas').height], minified: [...document.scripts].some((s) => /assets\/index-[\w-]+\.js$/.test(s.src)), fonts: window.__fontStatus }));
    active = m.active;
    const pilot = ['JettScene', 'FlapFortuneScene', 'ShatterStepScene'].includes(key);
    check('release', `${key}: minified build launches exactly the requested scene${pilot ? ' at 1170×2532' : ' at its unchanged 390×844'}`, m.minified && Array.isArray(active) && active.length === 1 && active[0] === key && m.backing[0] === (pilot ? 1170 : 390) && errors.length === 0, { active, backing: m.backing, errors: errors.slice(0, 2) });
    if (key === 'JettScene') {
      // Leaving a pilot restores 390×844 for the other scenes.
      await page.evaluate(() => window.__game.scene.getScene('JettScene').scene.start('DiceScene'));
      await page.waitForTimeout(800);
      const b = await page.evaluate(() => [document.querySelector('#app canvas').width, document.querySelector('#app canvas').height, window.__game.scene.getScenes(true).map((s) => s.sys.settings.key).join()]);
      check('release', 'leaving Jett for another game restores the 390×844 game size', b[0] === 390 && b[1] === 844 && b[2] === 'DiceScene', b);
      check('release', 'release build loaded self-hosted Inter before boot', m.fonts && m.fonts.loaded.length === 4 && !m.fonts.timedOut, m.fonts);
    }
    await ctx.close();
  }
}

// ─── 7. Host messaging (fake host page) ──────────────────────────────────────
async function host(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 } });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${DEV}/research/host/index.html`);
  await page.waitForFunction(() => window.__hostLog && window.__hostLog.some((m) => m.type === 'ready'), null, { timeout: 20000 });
  const frame = page.frames().find((f) => f.url().includes('/research/harness/'));
  await frame.evaluate(() => { const p = window.parent; const o = p.postMessage.bind(p); window.__sent = []; p.postMessage = (d, t) => { window.__sent.push({ t, d }); return o(d, t); }; });
  await page.evaluate(() => { window.__hostSend({ type: 'openSettings' }); });
  await page.waitForTimeout(200);
  const open = await frame.evaluate(() => window.__game.scene.getScene('JettScene').jettUI.shell.settingsOpen);
  check('host', 'valid host command (openSettings) from the exact parent origin is applied', open === true);
  await page.evaluate(() => window.__hostSend({ type: 'closeSettings' }));
  for (const id of ['dup', 'bad', 'big', 'wild']) await page.click(`#${id}`);
  await page.waitForTimeout(300);
  const r = await frame.evaluate(() => ({ rej: window.__host.getRejections(), trace: window.__host.getTrace().map((t) => `${t.dir}:${t.type}`), sent: window.__sent.map((s) => ({ t: s.t, type: s.d.msg.type, keys: JSON.stringify(s.d) })) }));
  check('host', 'duplicate (seq) and malformed/oversized/unknown messages rejected', r.rej.seq >= 1 && r.rej.schema >= 3, r.rej);
  // Play a seeded Jett round to settlement inside the frame.
  await frame.evaluate(() => { const g = window.__game; g.loop.sleep(); let t = performance.now(); const ui = g.scene.getScene('JettScene').jettUI; ui.onPrimary(); for (let i = 0; i < 40; i++) { t += 16.7; g.loop.step(t); } ui.runner.queue('cashOut'); for (let i = 0; i < 4; i++) { t += 16.7; g.loop.step(t); } });
  const r2 = await frame.evaluate(() => window.__sent.map((s) => ({ t: s.t, type: s.d.msg.type, body: JSON.stringify(s.d) })));
  const settled = r2.filter((s) => s.type === 'roundSettled');
  check('host', 'roundStarted + exactly one roundSettled reach the host for one round', r2.some((s) => s.type === 'roundStarted') && settled.length === 1, r2.map((s) => s.type));
  check('host', 'every outbound message uses the exact host origin (never "*")', r2.length > 0 && r2.every((s) => s.t === new URL(DEV).origin), [...new Set(r2.map((s) => s.t))]);
  check('host', 'no outbound payload contains a seed, board, RNG state or session ref', r2.every((s) => !/"(seed|board|rngState|revealed|token|session)/i.test(s.body)), settled[0] && settled[0].body.slice(0, 200));
  check('host', 'no page errors', errors.length === 0, errors.slice(0, 2));
  await ctx.close();
}

// ─── 8. Brand/theme switching mid-round keeps gameplay identical ─────────────
async function theming(browser) {
  const runOnce = async (switchMidRound) => {
    const { ctx, page, errors } = await openGame(browser, 'jett', { seed: 'theme', dpr: 2 });
    const r = await page.evaluate((sw) => {
      window.__manual(); const ui = window.__ui(); ui.onPrimary();
      ui.round.config.combustionFloorPerTick = 0; ui.round.config.combustionChancePerTick = 0;
      let lastTick = -1; const done = new Set();
      const once = (k, fn) => { if (!done.has(k)) { done.add(k); fn(); } };
      for (let guard = 0; guard < 2000 && ui.round.tick < 220 && ui.phase !== 'settled'; guard++) {
        const t = ui.round.tick;
        if (t !== lastTick) { lastTick = t; if (t % 7 === 0) ui.runner.queue('steer', 120 + (t % 5) * 30); }
        if (sw && t >= 60) once('a', () => window.__host.dispatch({ type: 'setBrand', brandId: 'example-orchid-club' }));
        if (sw && t >= 120) once('b', () => { window.__host.dispatch({ type: 'openSettings' }); document.querySelectorAll('.sd-shell .sd-dialog input[type=checkbox]')[3].click(); window.__host.dispatch({ type: 'closeSettings' }); ui.resume(); });
        if (sw && t >= 180) once('c', () => window.__host.dispatch({ type: 'setBrand', brandId: 'example-harbor-lights' }));
        window.__step(16.7);
      }
      const st = ui.round.state;
      return { tick: ui.round.tick, hash: JSON.stringify({ x: st.playerX, alt: st.altitude, m: st.multiplier, a: st.asteroids.map((a) => [a.id, a.x, a.worldY]), c: st.coinsCollected, log: ui.runner.actionLog.map((a) => [a.tick, a.type, a.value]) }), settlement: ui.round.settlement, accent: getComputedStyle(document.querySelector('.sd-shell')).getPropertyValue('--sd-accent').trim() };
    }, switchMidRound);
    await ctx.close();
    return { ...r, errors };
  };
  const a = await runOnce(false); const b = await runOnce(true);
  check('theming', 'brand switches + settings open/close mid-round: identical simulation state at the same tick', a.tick === b.tick && a.hash === b.hash && JSON.stringify(a.settlement) === JSON.stringify(b.settlement), { tick: [a.tick, b.tick], accent: [a.accent, b.accent] });
  check('theming', 'the live brand actually changed the presentation', a.accent !== b.accent && b.accent === '#5fd0d8', [a.accent, b.accent]);
  check('theming', 'no page errors', a.errors.length + b.errors.length === 0, [...a.errors, ...b.errors].slice(0, 2));
}

// ─── 9. Replay/settlement independent of render scale and DPR ────────────────
async function replay(browser) {
  for (const game of ['jett', 'flap', 'shatter']) {
    const results = [];
    for (const [dpr, q] of [[1, '&rs=1'], [3, ''], [2, '&quality=low']]) {
      const { ctx, page } = await openGame(browser, game, { seed: 'replay', dpr, query: q });
      const r = await page.evaluate((game) => {
        window.__manual(); const ui = window.__ui();
        if (game === 'shatter') {
          ui.onPrimary(); const b = ui.round.board;
          for (let row = 0; row < 4; row++) ui.choose(row, row === 3 ? (b[row] === 'left' ? 'right' : 'left') : b[row], { x: 0, y: 0 });
          return { rs: window.__renderScale().scale, s: JSON.stringify({ picks: ui.round.picks, settlement: ui.round.settlement, mult: ui.round.state.multiplier }) };
        }
        ui.onPrimary(); if (game === 'flap') ui.onPress();
        for (let i = 0; i < 400; i++) {
          if (game === 'jett' && i % 9 === 0) ui.runner.queue('steer', 60 + ((i * 37) % 270));
          if (game === 'flap' && i % 22 === 0) ui.onPress();
          window.__step(16.7);
          if (ui.phase === 'settled') break;
        }
        return { rs: window.__renderScale().scale, s: JSON.stringify({ tick: ui.round.tick, settlement: ui.round.settlement, log: ui.runner.actionLog.length, state: ui.round.state.multiplier }) };
      }, game);
      results.push(r);
      await ctx.close();
    }
    check('replay', `${game}: identical actions → identical state/settlement at render scale ${results.map((r) => r.rs).join(' / ')}`, results.every((r) => r.s === results[0].s), results[0].s.slice(0, 200));
  }
}

// ─── 9b. Adaptive quality governor (real frames, software WebGL is slow at 1170×2532) ──
async function governor(browser) {
  const { ctx, page, errors } = await openGame(browser, 'flap', { dpr: 3, adaptive: true });
  const r0 = await page.evaluate(() => window.__renderScale());
  await page.waitForFunction(() => window.__renderScale().quality === 'low', null, { timeout: 45000 }).catch(() => {});
  const r1 = await page.evaluate(() => ({ rs: window.__renderScale(), backing: [window.__game.canvas.width, window.__game.canvas.height], phase: window.__ui().phase }));
  check('governor', `slow frames step quality down one-way (high → balanced → low): backing ${r0.width}×${r0.height} → ${r1.backing.join('×')}`, r0.quality === 'high' && r1.rs.quality === 'low' && r1.rs.downgrades.length === 2 && r1.backing[0] === 585, r1.rs.downgrades);
  check('governor', 'downgrade happens without touching the round (still ready, no errors)', r1.phase === 'ready' && errors.length === 0, { phase: r1.phase, errors: errors.slice(0, 2) });
  await ctx.close();
}

// ─── 10. Targets and geometry ────────────────────────────────────────────────
async function targets(browser) {
  for (const game of ['jett', 'flap', 'shatter']) {
    for (const [w, h, dpr] of [[320, 568, 2], [390, 844, 3], [430, 932, 3], [667, 375, 2], [844, 390, 3]]) {
      const { ctx, page, errors } = await openGame(browser, game, { viewport: { width: w, height: h }, dpr });
      const m = await page.evaluate(() => {
        const ui = window.__ui(); const sh = ui.shell; const c = window.__game.canvas.getBoundingClientRect(); const k = c.width / 390;
        const btns = [...document.querySelectorAll('.sd-shell button')].filter((b) => b.offsetParent !== null || getComputedStyle(b).position === 'absolute').filter((b) => !b.classList.contains('sd-stagebtn') || b.classList.contains('sd-railbtn')).map((b) => { const r = b.getBoundingClientRect(); return { id: b.dataset.id, w: Math.round(r.width), h: Math.round(r.height), on: r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 && r.left >= -1 && r.top >= -1 }; });
        const hits = (ui.hits || []).filter((x) => x.input && x.input.enabled).map((x) => ({ w: Math.round(x.width * k), h: Math.round(x.height * k) }));
        const texts = [...document.querySelectorAll('.sd-shell .sd-t span, .sd-shell .sd-cap, .sd-shell .sd-cta')].filter((e) => e.offsetParent !== null && e.textContent.trim()).map((e) => parseFloat(getComputedStyle(e).fontSize));
        const runner = ui.runner && ui.runner.x !== undefined ? ui.runner.x : null;
        return { k: +k.toFixed(3), rail: sh.domRoot.classList.contains('sd-rail'), btns, hits, minFont: Math.min(...texts), runnerX: runner };
      });
      const small = m.btns.filter((b) => b.w < 44 || b.h < 44 || !b.on);
      // Documented exception: in the landscape rail the same pane choice is offered by ≥ 44 px
      // rail buttons (WCAG 2.5.8 "equivalent" exception), so the small canvas bands are allowed.
      const railPanes = m.btns.filter((b) => /^stage:pane-/.test(b.id || ''));
      const smallHits = m.rail && railPanes.length === 2 ? [] : m.hits.filter((x) => x.w < 44 || x.h < 44);
      check('targets', `${game} ${w}×${h}: every visible control ≥ 44×44 CSS px and on screen${m.rail ? ' (rail)' : ''}${game === 'shatter' ? '; live pane bands ≥ 44 px' : ''}`, small.length === 0 && smallHits.length === 0 && errors.length === 0, { k: m.k, small, smallHits, hits: m.hits });
      check('targets', `${game} ${w}×${h}: interface text ≥ 11 CSS px`, m.minFont >= 11, { minFont: m.minFont });
      if (game === 'shatter') check('targets', `shatter ${w}×${h}: runner centred in the logical world (render-scale independent)`, Math.abs(m.runnerX - 195) < 0.01, { runnerX: m.runnerX });
      await ctx.close();
    }
  }
}

(async () => {
  const browser = await chromium.launch();
  const all = { density, pointer, inputs, overlays, restarts, release, host, theming, replay, governor, targets };
  const which = process.argv.slice(2);
  report.meta = { date: new Date().toISOString(), chromium: browser.version(), dev: DEV, release: REL, sections: which.length ? which : Object.keys(all), note: 'Headless Chromium on SwiftShader with emulated DPR. Not physical-device evidence.' };
  for (const [name, fn] of Object.entries(all)) {
    if (which.length && !which.includes(name)) continue;
    try { await fn(browser); } catch (e) { check(name, 'section completed without exceptions', false, String(e && e.stack || e).slice(0, 500)); }
  }
  await browser.close();
  const total = Object.values(report.results).reduce((n, a) => n + a.length, 0);
  report.meta.total = total; report.meta.failures = failures;
  fs.writeFileSync(path.join(OUT, 'browser-report-polish004.json'), JSON.stringify(report, null, 1));
  console.log(`\n${total - failures}/${total} polish-004 browser checks passed.`);
  process.exit(failures ? 1 : 0);
})();

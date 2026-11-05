/**
 * @file lifecycle-ledger-probe.cjs
 * @purpose RESEARCH ONLY — browser checks of the NEW Inferno build through the dev harness:
 *          input races (double tap, held Space, stake change mid-round), free-spin ledger, Crown
 *          exactly-once, exit during each phase, 50 restart cycles with resource counts, audio
 *          unlock/mute/visibility handling. Requires the harness dev server (see capture/lib.cjs).
 * @author Agent 934  @date 2026-11-05  @license Proprietary – available for licensing
 */
const { open, tap, dbg, waitPhase } = require('../capture/lib.cjs');
const SPIN = [195, 716];
const STAKE_50 = [321, 654];
const out = {};

async function freshPage(query) { return open(query); }

(async () => {
  // ── input races ─────────────────────────────────────────────────────────────────
  {
    const { browser, page, errors } = await freshPage('seed=race');
    await tap(page, ...SPIN); await tap(page, ...SPIN); await tap(page, ...SPIN); // fast triple tap
    const mid = await dbg(page);
    await tap(page, ...STAKE_50); // stake change while presenting
    const midStake = await dbg(page);
    await waitPhase(page, ['ready', 'decision']);
    let d = await dbg(page);
    if (d.phase === 'decision') { await page.evaluate(() => window.__inferno.scene().handleCollect(window.__inferno.debug().roundId)); }
    await waitPhase(page, ['ready']);
    d = await dbg(page);
    out.tripleTap = { roundIdAfterTaps: mid.roundId, debits: d.debits, credits: d.credits, uiPhaseDuring: mid.uiPhase, stakeDuringRound: midStake.cycle && midStake.cycle.stake, selectedAfter: d.settings && undefined };
    // held Space: keydown with repeat
    await page.keyboard.down('Space');
    for (let i = 0; i < 8; i++) await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', keyCode: 32, repeat: true })));
    await page.waitForTimeout(100);
    const held = await dbg(page);
    await page.keyboard.up('Space');
    await waitPhase(page, ['ready', 'decision']);
    out.heldSpace = { roundsStartedByHold: held.roundId - d.roundId, debitsAfter: (await dbg(page)).debits };
    out.raceErrors = errors;
    await browser.close();
  }

  // ── free spins: zero debit, fixed stake, no balance prerequisite ─────────────────
  {
    const { browser, page, errors } = await freshPage('seed=free&fixture=scatter&quick=1');
    await tap(page, ...SPIN);
    // after the paid fixture spin settles, the award cycle auto-runs; drain it fully
    await page.waitForFunction(() => { const d = window.__inferno.debug(); return d.roundId >= 1 && d.phase === 'ready' && d.freeSpins > 0; }, null, { timeout: 20000 });
    const afterPaid = await dbg(page);
    // drop the balance to zero mid-cycle to prove free spins need no balance
    await page.evaluate(() => { const s = window.__inferno.scene(); s.session = { ...s.session, balanceMilli: 0 }; });
    // drain the award cycle; if the final free spin opens a Crown decision, collect it
    await page.waitForFunction(() => { const d = window.__inferno.debug(); if (d.phase === 'decision') window.__inferno.scene().handleCollect(d.roundId); return d.phase === 'ready' && d.freeSpins === 0 && d.cycle === null; }, null, { timeout: 90000, polling: 200 });
    let d = await dbg(page);
    if (d.phase === 'decision') await page.evaluate(() => window.__inferno.scene().handleCollect(window.__inferno.debug().roundId));
    d = await dbg(page);
    out.freeSpins = { afterPaid: { roundId: afterPaid.roundId, freeSpins: afterPaid.freeSpins, debits: afterPaid.debits }, final: { rounds: d.roundId, debits: d.debits, credits: d.credits, lastCycle: d.lastCycle, balanceMilli: d.balanceMilli } };
    out.freeErrors = errors;
    await browser.close();
  }

  // ── Crown exactly once (fixture: flip wins, then collect) + repeated callbacks ──
  {
    const { browser, page, errors } = await freshPage('seed=crown&fixture=crown');
    await tap(page, ...SPIN);
    await waitPhase(page, ['decision']);
    const atDecision = await dbg(page);
    const r = await page.evaluate(async () => {
      const s = window.__inferno.scene();
      const id = s.session.roundId;
      s.handleFlip(id);            // wins (fixture random 0.1)
      s.handleFlip(id);            // second press while reveal pending → resolves the next flip? (UI locks; scene call is direct)
      return { roundId: id };
    });
    await page.waitForTimeout(1500);
    const afterFlips = await dbg(page);
    // collect if still deciding; then spam collect for the same round
    await page.evaluate(() => { const s = window.__inferno.scene(); const id = s.session.roundId; s.handleCollect(id); s.handleCollect(id); s.handleCollect(id); s.handleFlip(id); });
    await page.waitForTimeout(400);
    const final = await dbg(page);
    out.crown = { atDecision: { balanceMilli: atDecision.balanceMilli, debits: atDecision.debits, credits: atDecision.credits }, afterFlips: { phase: afterFlips.phase, credits: afterFlips.credits, balanceMilli: afterFlips.balanceMilli }, final: { phase: final.phase, credits: final.credits, debits: final.debits, balanceMilli: final.balanceMilli, ledger: final.ledger } , note: 'direct scene calls bypass the UI lock on purpose to test the Logic guards', roundId: r.roundId };
    // UI path: real taps on COLLECT twice for a fresh decision
    await page.evaluate(() => window.__inferno.queueFixture('crown'));
    await tap(page, ...SPIN);
    await waitPhase(page, ['decision']);
    const before = await dbg(page);
    await tap(page, 195, 422 + 250 - 165 - 30); // COLLECT button (panel y = 844/2 - 165 - 30; button at +250)
    await tap(page, 195, 422 + 250 - 165 - 30);
    await page.waitForTimeout(300);
    const after = await dbg(page);
    out.crownUiDoubleTap = { creditsBefore: before.credits, creditsAfter: after.credits, phase: after.phase, credited: after.balanceMilli - before.balanceMilli };
    out.crownErrors = errors;
    await browser.close();
  }

  // ── exit during each phase + 50 restart cycles ──────────────────────────────────
  {
    const { browser, page, errors } = await freshPage('seed=life');
    const base = await page.evaluate(() => ({ ctx: { ...window.__inferno.counters } }));
    const exits = [];
    const phases = [
      { name: 'spinning', fixture: 'cascade', wait: 150 },
      { name: 'cascade (removing/falling)', fixture: 'cascade', wait: 1350 },
      { name: 'crown decision', fixture: 'crown', wait: -1 },
      { name: 'free-spin cycle', fixture: 'scatter', wait: 2600 },
      { name: 'result', fixture: 'loss', wait: -2 },
    ];
    for (const ph of phases) {
      await page.evaluate((f) => window.__inferno.queueFixture(f), ph.fixture);
      await tap(page, ...SPIN);
      if (ph.wait === -1) await waitPhase(page, ['decision']);
      else if (ph.wait === -2) await waitPhase(page, ['ready']);
      else await page.waitForTimeout(ph.wait);
      const d = await dbg(page);
      await page.evaluate(() => window.__inferno.scene().scene.restart());
      await page.waitForFunction(() => window.__inferno.scene().sys.isActive() && window.__inferno.debug().roundId === 0);
      await page.waitForTimeout(1500); // any stale callback would fire in this window
      const a = await dbg(page);
      exits.push({ phase: ph.name, uiPhaseAtExit: d.uiPhase, sessionPhaseAtExit: d.phase, after: { phase: a.phase, roundId: a.roundId, tweens: a.resources.tweens, timers: a.resources.timers, timeEvents: a.timeEvents, keyboardListeners: a.keyboardListeners, sounds: a.soundCount } });
    }
    out.exitDuringPhase = exits;
    const samples = [];
    for (let i = 1; i <= 50; i++) {
      await page.evaluate(() => window.__inferno.scene().scene.restart());
      await page.waitForFunction(() => window.__inferno.scene().sys.isActive() && window.__inferno.debug().roundId === 0);
      if (i % 10 === 0) {
        await tap(page, ...SPIN);
        await waitPhase(page, ['ready', 'decision']);
        const d = await dbg(page);
        samples.push({ cycle: i, displayList: d.displayList, tweens: d.resources.tweens, timers: d.resources.timers, timeEvents: d.timeEvents, particles: d.resources.particles, keyboardListeners: d.keyboardListeners, sounds: d.soundCount, voices: d.voices, textures: await page.evaluate(() => Object.keys(window.__inferno.game.textures.list).length), audioContexts: await page.evaluate(() => ({ ...window.__inferno.counters })), heap: await page.evaluate(() => (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null)) });
      }
    }
    out.restartCycles = { base, samples };
    out.lifecycleErrors = errors;
    await browser.close();
  }

  // ── audio: locked until gesture, mute toggles, visibility suspend/resume ────────
  {
    const { chromium } = require('playwright');
    const browser = await chromium.launch(); // default autoplay policy: gesture required
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${require('../capture/lib.cjs').BASE}?seed=audio`);
    await page.waitForFunction(() => window.__inferno && window.__inferno.scene() && window.__inferno.scene().session);
    await page.waitForTimeout(500);
    const beforeGesture = await page.evaluate(() => ({ locked: window.__inferno.scene().sound.locked, ctx: window.__inferno.scene().sound.context?.state, contexts: { ...window.__inferno.counters }, musicPlaying: window.__inferno.scene().sound_.music?.isPlaying ?? null }));
    await tap(page, ...SPIN);
    await page.waitForTimeout(600);
    const afterGesture = await page.evaluate(() => ({ locked: window.__inferno.scene().sound.locked, ctx: window.__inferno.scene().sound.context?.state, musicPlaying: window.__inferno.scene().sound_.music?.isPlaying ?? null, voices: window.__inferno.debug().voices }));
    await page.evaluate(() => window.__inferno.scene().handleSettings({ music: 0, sfx: 0, reducedMotion: false, quickSpin: false }));
    await page.waitForTimeout(100);
    const muted = await page.evaluate(() => ({ musicPlaying: window.__inferno.scene().sound_.music?.isPlaying ?? null, stored: localStorage.getItem('jett.inferno.settings.v1') }));
    await page.evaluate(() => window.__inferno.scene().handleSettings({ music: 2, sfx: 2, reducedMotion: false, quickSpin: false }));
    await page.waitForTimeout(100);
    const unmuted = await page.evaluate(() => ({ musicPlaying: window.__inferno.scene().sound_.music?.isPlaying ?? null }));
    // visibility/blur: Phaser re-emits document visibilitychange as HIDDEN/VISIBLE (loop pause/resume)
    // and window blur/focus as BLUR/FOCUS; with pauseOnBlur the WebAudio context is suspended on blur.
    await page.evaluate(() => { const g = window.__inferno.game; window.__vis = { hidden: 0, visible: 0, blur: 0, focus: 0 };
      g.events.on('hidden', () => window.__vis.hidden++); g.events.on('visible', () => window.__vis.visible++); g.events.on('blur', () => window.__vis.blur++); g.events.on('focus', () => window.__vis.focus++); });
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); window.onblur && window.onblur(); });
    await page.waitForTimeout(400);
    const hidden = await page.evaluate(() => ({ ctx: window.__inferno.scene().sound.context?.state, events: { ...window.__vis } }));
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); window.onfocus && window.onfocus(); });
    await page.waitForTimeout(400);
    const visible = await page.evaluate(() => ({ ctx: window.__inferno.scene().sound.context?.state, events: { ...window.__vis }, pauseDurationMs: Math.round(window.__inferno.game.loop.pauseDuration) }));
    // a spin still completes after blur/focus (no stuck UI); first close any Crown decision from round 1
    await page.waitForFunction(() => ['ready', 'decision'].includes(window.__inferno.debug().phase), null, { timeout: 20000 });
    await page.evaluate(() => { const d = window.__inferno.debug(); if (d.phase === 'decision') window.__inferno.scene().handleCollect(d.roundId); });
    await page.waitForFunction(() => window.__inferno.debug().phase === 'ready', null, { timeout: 20000 });
    await tap(page, ...SPIN);
    await page.waitForFunction(() => ['ready', 'decision'].includes(window.__inferno.debug().phase) && window.__inferno.debug().roundId >= 2, null, { timeout: 20000 });
    const afterResume = await dbg(page);
    // reload: settings persisted
    await page.reload();
    await page.waitForFunction(() => window.__inferno && window.__inferno.scene() && window.__inferno.scene().session);
    const persisted = await page.evaluate(() => window.__inferno.debug().settings);
    out.audio = { beforeGesture, afterGesture, muted, unmuted, hidden, visible, spinAfterResume: { phase: afterResume.phase, roundId: afterResume.roundId }, persistedAfterReload: persisted, note: 'Headless Chromium: proves state transitions only, not audible output.' };
    out.audioErrors = errors;
    await browser.close();
  }
  console.log(JSON.stringify(out, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });

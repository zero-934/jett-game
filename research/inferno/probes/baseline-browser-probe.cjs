/**
 * @file baseline-browser-probe.cjs
 * @purpose RESEARCH ONLY — reproduces UI/scene-level observations against the ORIGINAL Inferno code
 *          served from the baseline worktree (2977ad6) by a throwaway harness whose source is kept at
 *          research/inferno/probes/baseline-browser-harness.main.ts.txt. Run the same probe against
 *          the new code via the main harness is not meaningful (APIs differ); see lifecycle-probe.cjs.
 * @author Agent 934  @date 2026-11-05  @license Proprietary – available for licensing
 */
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('http://localhost:5181/jett-game/research/inferno-baseline-harness/index.html');
  await page.waitForFunction(() => window.__b && window.__b.scene() && window.__b.scene().infernoUI);
  await page.waitForTimeout(500);
  const out = await page.evaluate(async () => {
    const s = window.__b.scene();
    const r = {};
    // 1. Crown: re-showing after a win adds another once() handler to both buttons
    const ui = s.infernoUI;
    ui.showCrownFlip(10, () => {}, () => {});
    const flip1 = ui.crownFlipBg.listenerCount('pointerup'), walk1 = ui.crownWalkBg.listenerCount('pointerup');
    ui.showCrownFlip(20, () => {}, () => {});
    ui.showCrownFlip(40, () => {}, () => {});
    r.crownListenersAfter1Show = { flip: flip1, walk: walk1 };
    r.crownListenersAfter3Shows = { flip: ui.crownFlipBg.listenerCount('pointerup'), walk: ui.crownWalkBg.listenerCount('pointerup') };
    ui.hideCrownFlip();
    // 1b. Real path: enter crown with 10 at risk, win two flips via the scene's own handlers, then one WALK press
    s.infernoState = { ...s.infernoState, isComplete: true, totalWin: 10, isInCrownFlip: true, crownFlipWin: 10, crownFlipChain: 0 };
    s.isSpinning = true;
    const bal0 = s.balance;
    s.rng = { random: () => 0.1, weightedChoice: (i) => i[0].value, getSeed: () => 'x' };
    s.infernoUI.showCrownFlip(10, s.handleCrownFlip, s.handleCrownWalk);
    s.infernoUI.crownFlipBg.emit('pointerup'); // win → re-show (adds handlers)
    s.infernoUI.crownFlipBg.emit('pointerup'); // win → re-show
    const walkListeners = s.infernoUI.crownWalkBg.listenerCount('pointerup');
    s.infernoUI.crownWalkBg.emit('pointerup'); // ONE press of WALK
    r.crownDoubleSettlement = { atRiskAfterTwoWins: 40, walkListenersBeforePress: walkListeners, balanceIncreaseAfterOneWalkPress: s.balance - bal0 };
    // 2. Free spin debit + balance prerequisite
    s.isSpinning = false; s.infernoState = { ...s.infernoState, isInCrownFlip: false, freeSpinsRemaining: 1, heatMeter: 0 };
    const balBefore = s.balance; s.handleSpin(); const balAfter = s.balance;
    r.freeSpinDebit = { bet: s.currentBet, balanceBefore: balBefore, balanceAfterStartingFreeSpin: balAfter };
    s.time.removeAllEvents(); s.tweens.killAll(); s.isSpinning = false;
    s.balance = 0; s.infernoState = { ...s.infernoState, isInCrownFlip: false, freeSpinsRemaining: 3 };
    s.handleSpin();
    r.freeSpinBlockedByBalance = { balance: 0, freeSpinsRemaining: 3, spinStarted: s.isSpinning };
    s.time.removeAllEvents(); s.tweens.killAll(); s.isSpinning = false;
    // 3. Heat tweens stack (repeat:-1 per active segment per update)
    const t0 = s.tweens.getTweens().length;
    for (let i = 0; i < 10; i++) s.infernoUI.updateHeatMeter(3);
    r.heatTweens = { before: t0, after10UpdatesAtLevel3: s.tweens.getTweens().length };
    s.tweens.killAll();
    return r;
  });
  // 4. AudioContexts across scene restarts
  for (let i = 0; i < 10; i++) { await page.evaluate(() => window.__b.scene().scene.restart()); await page.waitForTimeout(250); }
  out.audioContexts = await page.evaluate(() => ({ ...window.__b.counters, afterRestarts: 10 }));
  out.errors = errors;
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})();

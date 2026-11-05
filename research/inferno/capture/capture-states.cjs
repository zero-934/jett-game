/**
 * @file capture-states.cjs
 * @purpose RESEARCH ONLY — captures review screenshots of the new Inferno build from the dev harness.
 *          Natural spins are labelled "natural"; fixture states carry an on-screen DEV FIXTURE tag.
 *          Also exports the symbol atlas, a mid-cascade keyframe sequence and a short video.
 *          Output: docs/inferno-polish-001/review-artifacts/
 * @author Agent 934  @date 2026-11-05  @license Proprietary – available for licensing
 */
const fs = require('node:fs');
const path = require('node:path');
const { open, tap, dbg, waitPhase } = require('./lib.cjs');
const OUT = path.resolve(__dirname, '../../../docs/inferno-polish-001/review-artifacts');
const SPIN = [195, 716];
fs.mkdirSync(path.join(OUT, 'screens'), { recursive: true });
const shot = (page, name) => page.screenshot({ path: path.join(OUT, 'screens', `${name}.png`) });
const untilUi = (page, phases, timeout = 15000) => page.waitForFunction((p) => p.includes(window.__inferno.debug().uiPhase), phases, { timeout, polling: 5 });
const manifest = [];
const note = (file, kind, desc) => manifest.push({ file: `screens/${file}.png`, kind, desc });

(async () => {
  // 1. ready + natural spin mid-entry + natural result (390×844, DPR 2 for human review)
  {
    const { browser, page } = await open('seed=capture-natural', { dpr: 2 });
    await shot(page, '01-ready-390'); note('01-ready-390', 'natural', 'Ready state, idle display board, heat 0');
    await tap(page, ...SPIN); await page.waitForTimeout(330);
    await shot(page, '02-spin-entry-390'); note('02-spin-entry-390', 'natural', 'Reel entry ~330 ms after press: columns dropping in stagger');
    await waitPhase(page, ['ready', 'decision']); await page.waitForTimeout(450);
    await shot(page, '03-natural-result-390'); note('03-natural-result-390', 'natural', 'First natural seeded result (seed capture-natural)');
    await browser.close();
  }
  // 2. cascade fixture: identify → remove → fall → second cascade → result
  {
    const { browser, page } = await open('seed=capture&fixture=cascade', { dpr: 2 });
    await tap(page, ...SPIN);
    await untilUi(page, ['evaluating']); await page.waitForTimeout(140);
    await shot(page, '04-cluster-identified'); note('04-cluster-identified', 'fixture', 'Winning 4-EMBER cluster outlined + connected (pre-removal coordinates)');
    await untilUi(page, ['removing']); await page.waitForTimeout(70);
    await shot(page, '05-removing-embers'); note('05-removing-embers', 'fixture', 'Ember removal: shrink/fade + ≤24 pooled sparks');
    await untilUi(page, ['falling']); await page.waitForTimeout(120);
    await shot(page, '06-falling'); note('06-falling', 'fixture', 'Survivors fall to their new rows; refills drop from behind the hood');
    await untilUi(page, ['evaluating']); await page.waitForTimeout(160);
    await shot(page, '07-second-cascade'); note('07-second-cascade', 'fixture', 'Refill formed a 3-FLAME cluster: cascade 1');
    await waitPhase(page, ['decision', 'ready']);
    await page.waitForTimeout(500);
    await shot(page, '08-crown-decision-after-cascade'); note('08-crown-decision-after-cascade', 'fixture', 'Optional Crown: amount at risk, COLLECT primary, FLIP secondary');
    await page.evaluate(() => window.__inferno.scene().handleCollect(window.__inferno.debug().roundId));
    await page.waitForTimeout(700);
    await shot(page, '09-settled-profit'); note('09-settled-profit', 'fixture', 'Settled once: return, net and balance; positive tone only because net > 0');
    await browser.close();
  }
  // 3. crown flip win → doubled amount, then loss
  {
    const { browser, page } = await open('seed=capture&fixture=crown', { dpr: 2 });
    await tap(page, ...SPIN); await waitPhase(page, ['decision']);
    await page.waitForTimeout(300);
    await tap(page, 195, 529); // FLIP
    await page.waitForTimeout(260);
    await shot(page, '10-crown-flipping-locked'); note('10-crown-flipping-locked', 'fixture', 'Flip in progress: both actions locked');
    await page.waitForTimeout(900);
    await shot(page, '11-crown-doubled'); note('11-crown-doubled', 'fixture', 'Flip won (fixture random 0.1): doubled amount at risk');
    await tap(page, 195, 529); await page.waitForTimeout(1400);
    await shot(page, '12-crown-lost-settled'); note('12-crown-lost-settled', 'fixture', 'Second flip lost (fixture random 0.9): spin returns 0, neutral tone');
    await browser.close();
  }
  // 4. scatter award + free spin running; heat full; inferno spin; scatter-without-cluster
  {
    const { browser, page } = await open('seed=capture&fixture=scatter', { dpr: 2 });
    await tap(page, ...SPIN);
    await page.waitForFunction(() => { const d = window.__inferno.debug(); return d.freeSpins > 0 && d.phase === 'ready' && d.cycle !== null; }, null, { timeout: 15000, polling: 5 });
    await page.waitForTimeout(120);
    await shot(page, '13-free-spins-awarded'); note('13-free-spins-awarded', 'fixture', '3 SCATTER after a cascade: 5 free spins at the same stake (legacy rule)');
    await page.waitForFunction(() => window.__inferno.debug().roundId >= 2, null, { timeout: 15000 }); await page.waitForTimeout(300);
    await shot(page, '14-free-spin-in-progress'); note('14-free-spin-in-progress', 'natural (in fixture-awarded cycle)', 'Free spin: no charge, stake locked');
    await browser.close();
  }
  {
    const { browser, page } = await open('seed=capture&fixture=heat', { dpr: 2 });
    await tap(page, ...SPIN); await waitPhase(page, ['ready', 'decision']);
    if ((await dbg(page)).phase === 'decision') await page.evaluate(() => window.__inferno.scene().handleCollect(window.__inferno.debug().roundId));
    await page.waitForTimeout(500);
    await shot(page, '15-heat-full'); note('15-heat-full', 'fixture', 'Heat 5/5: next spin is all WILD (label states it)');
    await tap(page, ...SPIN); await page.waitForTimeout(900);
    await shot(page, '16-inferno-spin-all-wild'); note('16-inferno-spin-all-wild', 'natural (production all-WILD rule)', 'Inferno Spin lands all WILD; current rules pay 0 — open decision');
    await waitPhase(page, ['ready']); await page.waitForTimeout(400);
    await shot(page, '17-inferno-spin-result'); note('17-inferno-spin-result', 'natural', 'Honest result copy: "All-WILD board: no paying cluster"');
    await browser.close();
  }
  {
    const { browser, page } = await open('seed=capture&fixture=scatter-no-cluster', { dpr: 2 });
    await tap(page, ...SPIN); await waitPhase(page, ['ready']); await page.waitForTimeout(400);
    await shot(page, '18-three-scatter-no-cluster'); note('18-three-scatter-no-cluster', 'fixture', 'Legacy rule: 3 SCATTER without a cluster awards nothing — open decision');
    await browser.close();
  }
  // 5. settings, reduced-motion fall, widths and landscape
  {
    const { browser, page } = await open('seed=capture', { dpr: 2 });
    await tap(page, 356, 32); await page.waitForTimeout(250);
    await shot(page, '19-settings'); note('19-settings', 'natural', 'Settings: music/SFX levels, reduced motion, quick spin, reset, rules');
    await browser.close();
  }
  {
    const { browser, page } = await open('seed=capture&fixture=cascade&reduced=1', { dpr: 2 });
    await tap(page, ...SPIN); await untilUi(page, ['falling']); await page.waitForTimeout(40);
    await shot(page, '20-reduced-motion-crossfade'); note('20-reduced-motion-crossfade', 'fixture', 'Reduced motion: in-place crossfade, no travel/particles/pulse');
    await browser.close();
  }
  for (const [w, h, name] of [[320, 693, '21-width-320'], [430, 932, '22-width-430'], [844, 390, '23-landscape-844x390']]) {
    const { browser, page } = await open('seed=capture', { width: w, height: h, dpr: 2 });
    await shot(page, name); note(name, 'natural', `Viewport ${w}×${h} (Phaser FIT scaling)`);
    await browser.close();
  }
  // 6. symbol atlas export + keyframe strip
  {
    const { browser, page } = await open('seed=capture');
    const dataUrl = await page.evaluate(() => window.__inferno.game.textures.get('inferno-atlas').getSourceImage().toDataURL('image/png'));
    fs.writeFileSync(path.join(OUT, 'symbol-atlas.png'), Buffer.from(dataUrl.split(',')[1], 'base64'));
    const bg = await page.evaluate(() => window.__inferno.game.textures.get('inferno-forge-bg').getSourceImage().toDataURL('image/png'));
    fs.writeFileSync(path.join(OUT, 'forge-background-texture.png'), Buffer.from(bg.split(',')[1], 'base64'));
    await browser.close();
  }
  {
    const { browser, page } = await open('seed=capture&fixture=cascade');
    const frames = [];
    await tap(page, ...SPIN);
    const t0 = Date.now();
    for (let i = 0; i < 26; i++) {
      const clip = { x: 16, y: 72, width: 358, height: 444 };
      const file = path.join(OUT, 'keyframes', `kf-${String(i).padStart(2, '0')}.png`);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      await page.screenshot({ path: file, clip });
      frames.push({ file: path.relative(OUT, file), msSincePress: Date.now() - t0, uiPhase: (await dbg(page)).uiPhase });
      await page.waitForTimeout(80);
    }
    fs.writeFileSync(path.join(OUT, 'keyframes', 'timeline.json'), JSON.stringify(frames, null, 1));
    await browser.close();
  }
  fs.writeFileSync(path.join(OUT, 'screens', 'manifest.json'), JSON.stringify(manifest, null, 1));
  console.log(`captured ${manifest.length} screens`);
})().catch((e) => { console.error(e); process.exit(1); });

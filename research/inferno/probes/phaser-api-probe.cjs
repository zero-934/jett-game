/**
 * @file phaser-api-probe.cjs
 * @purpose RESEARCH ONLY — executes the Phaser APIs Inferno relies on, inside the INSTALLED package
 *          (node_modules/phaser, version recorded), via the harness page: tween completion vs stop /
 *          killTweensOf, tween + clock timeScale, delayedCall remove, particle emitter cap/explode/destroy,
 *          CanvasTexture frames, and the single WebAudio context reused across scene restarts.
 * @author Agent 934  @date 2026-11-05  @license Proprietary – available for licensing
 */
const { open } = require('../capture/lib.cjs');
(async () => {
  const { browser, page, errors } = await open('seed=api');
  const r = await page.evaluate(async () => {
    const P = window.__inferno.Phaser; const s = window.__inferno.scene(); const out = { phaserVersion: P.VERSION };
    const wait = (ms) => new Promise((res) => setTimeout(res, ms));
    // tweens: complete fires once; stop() fires onStop not onComplete; killTweensOf fires neither
    const t = { a: 0 }; let complete = 0, stop = 0;
    s.tweens.add({ targets: t, a: 1, duration: 60, onComplete: () => complete++ });
    const t2 = { a: 0 }; let c2 = 0, s2 = 0;
    const tw2 = s.tweens.add({ targets: t2, a: 1, duration: 500, onComplete: () => c2++, onStop: () => s2++ });
    const t3 = { a: 0 }; let c3 = 0;
    s.tweens.add({ targets: t3, a: 1, duration: 500, onComplete: () => c3++ });
    await wait(150); tw2.stop(); s.tweens.killTweensOf(t3); await wait(600);
    out.tweens = { completeFiredOnce: complete === 1, stopFiresOnStop: s2 === 1, stopFiresOnComplete: c2, killTweensOfFiresOnComplete: c3, remaining: s.tweens.getTweens().length };
    // timeScale: tweens + clock
    s.tweens.timeScale = 4; s.time.timeScale = 4;
    const t4 = { a: 0 }; let t4ms = 0; const start = performance.now();
    await new Promise((res) => s.tweens.add({ targets: t4, a: 1, duration: 400, onComplete: () => { t4ms = performance.now() - start; res(); } }));
    const start2 = performance.now(); let dcms = 0;
    await new Promise((res) => s.time.delayedCall(400, () => { dcms = performance.now() - start2; res(); }));
    s.tweens.timeScale = 1; s.time.timeScale = 1;
    let removedFired = 0; const ev = s.time.delayedCall(100, () => removedFired++); ev.remove(false); await wait(250);
    out.timeScale = { tween400msAtX4: Math.round(t4ms), delayedCall400msAtX4: Math.round(dcms), removedDelayedCallFired: removedFired };
    // particles: cap and destroy
    const em = s.add.particles(0, 0, 'inferno-atlas', { frame: 'spark', emitting: false, lifespan: 800, speed: 50, maxAliveParticles: 24 });
    em.explode(20, 100, 100); em.explode(20, 120, 100);
    out.particles = { aliveAfterExploding40WithCap24: em.getAliveParticleCount() };
    em.destroy(); out.particles.destroyedActive = em.active;
    // CanvasTexture frames
    const tex = s.textures.get('inferno-atlas');
    out.canvasTexture = { frames: tex.getFrameNames().length, frameNames: tex.getFrameNames(), source: `${tex.source[0].width}x${tex.source[0].height}` };
    out.audio = { manager: s.sound.constructor.name, contextState: s.sound.context && s.sound.context.state, locked: s.sound.locked };
    return out;
  });
  for (let i = 0; i < 5; i++) { await page.evaluate(() => window.__inferno.scene().scene.restart()); await page.waitForTimeout(300); }
  r.audioContextsAfter5Restarts = await page.evaluate(() => ({ ...window.__inferno.counters }));
  r.sameContextObject = await page.evaluate(() => window.__inferno.scene().sound.context === window.__inferno.game.sound.context);
  r.errors = errors;
  console.log(JSON.stringify(r, null, 2));
  await browser.close();
})();

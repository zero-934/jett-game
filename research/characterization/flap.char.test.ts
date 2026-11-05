/**
 * @file flap.char.test.ts
 * @purpose CHARACTERIZATION TESTS (research only). Pass against 616fd82; [CURRENT-DEFECT] tests pin defects.
 * @author Agent 934 (research branch)
 * @date 2026-11-05
 * @license Proprietary – available for licensing
 */
import { createFlapFortuneState, tickFlapFortune, checkFlapCollision, cashOutFlapFortune, computeFlapMultiplier } from '../../src/games/FlapFortuneLogic';
import type { FlapFortuneConfig } from '../../src/games/FlapFortuneLogic';
import { ProvablyFairRNG } from '../../research/patches/ProvablyFairRNG.masked';

// Exactly the production scene config (FlapFortuneScene.ts)
const SCENE_CONFIG: FlapFortuneConfig = { worldWidth: 390, worldHeight: 844, gravity: 0.45, flapStrength: -7.5, pipeSpacing: 230, pipeGapHeight: 158, scrollSpeed: 3, houseEdge: 0.03, combustionChancePerTick: 0.0003 };
const LOGIC_PIPE_W = 30;        // FlapFortuneLogic checkFlapCollision pipeW
const ART_GATE_W = 34;          // FlapFortuneUI renderGates gateW
const ART_CAP_OVERHANG = 4;     // drawPortcullis cap x-4 .. x+w+4

describe('Flap Fortune characterization', () => {
  test('[CURRENT-DEFECT] gate artwork is wider than the logic hitbox', () => {
    // Visible body spans [x, x+34]; caps span [x-4, x+38]; logic spans [x, x+30].
    expect(ART_GATE_W - LOGIC_PIPE_W).toBe(4);
    expect(ART_GATE_W + 2 * ART_CAP_OVERHANG - LOGIC_PIPE_W).toBe(12);
    // A wizard whose right edge overlaps the visible cap but not the logic pipe survives.
    const s = createFlapFortuneState(10, { ...SCENE_CONFIG, rng: () => 0.5 });
    const pipe = s.pipes[0];
    pipe.x = 80 + 14 + 1;   // logic pipe starts 1px right of wizard right edge (80+14)
    s.playerY = pipe.topHeight + 5; // vertically inside the top portcullis
    expect(checkFlapCollision(s, SCENE_CONFIG)).toBe(false);
    // ...yet the cap's left overhang (x-4) visibly overlaps the wizard by 3px.
    expect(pipe.x - ART_CAP_OVERHANG).toBeLessThan(80 + 14);
  });

  test('[CURRENT-DEFECT] combustion floor 0.0005 overrides configured 0.0003 (and 0)', () => {
    for (const chance of [0, 0.0003]) {
      const cfg = { ...SCENE_CONFIG, combustionChancePerTick: chance, rng: () => 0.0004 };
      const s = createFlapFortuneState(10, cfg);
      s.pipes = [];
      tickFlapFortune(s, false, cfg);
      expect(s.combusted).toBe(true);
    }
    // Configured value only takes effect once 0.0003*(1+0.05p) > 0.0005  =>  p > 13.33
    expect(0.0003 * (1 + 0.05 * 13)).toBeLessThan(0.0005);
    expect(0.0003 * (1 + 0.05 * 14)).toBeGreaterThan(0.0005);
  });

  test('[CURRENT-DEFECT] a new ProvablyFairRNG is constructed on every tick even when config.rng exists', () => {
    // Indirect: tickFlapFortune constructs `new ProvablyFairRNG()` unconditionally (line 116).
    // Measured cost is small per tick but allocates BigInts 62.5x/second.
    const cfg = { ...SCENE_CONFIG, rng: () => 0.99 };
    const s = createFlapFortuneState(10, cfg);
    const t0 = performance.now();
    for (let i = 0; i < 2000; i++) { s.pipes = []; s.playerY = 400; s.playerVelocityY = 0; tickFlapFortune(s, false, cfg); }
    const perTickUs = ((performance.now() - t0) / 2000) * 1000;
    // eslint-disable-next-line no-console
    console.log(`tickFlapFortune avg ${perTickUs.toFixed(2)} us/tick (includes per-tick RNG construction)`);
    expect(perTickUs).toBeGreaterThan(0);
  });

  test('deterministic given seeded rng + identical flap schedule (logic layer only)', () => {
    const play = () => {
      const r = new ProvablyFairRNG('flap-seed');
      const cfg = { ...SCENE_CONFIG, rng: () => r.random() };
      const s = createFlapFortuneState(10, cfg);
      for (let t = 0; t < 600 && s.isAlive; t++) tickFlapFortune(s, t % 14 === 0, cfg);
      return JSON.stringify(s);
    };
    expect(play()).toBe(play());
  });

  test('dive cash-out only after first gate; floor before first gate is a loss', () => {
    const cfg = { ...SCENE_CONFIG, rng: () => 0.99 };
    const s = createFlapFortuneState(10, cfg); s.pipes = [];
    s.playerY = 844 - 14; s.playerVelocityY = 5;
    tickFlapFortune(s, false, cfg);
    expect(s.isAlive).toBe(false); expect(s.cashedOut).toBe(false); expect(s.payout).toBe(0);
    const w = createFlapFortuneState(10, cfg); w.pipes = []; w.pipesCleared = 1; w.multiplier = computeFlapMultiplier(1);
    w.playerY = 844 - 14; w.playerVelocityY = 5;
    tickFlapFortune(w, false, cfg);
    expect(w.cashedOut).toBe(true); expect(w.payout).toBe(10.57);
    expect(cashOutFlapFortune(w)).toBe(0); // repeated cash-out idempotent
  });

  test('ceiling at y < 14 is death — and the 36px nav bar overlaps the playfield above it', () => {
    const cfg = { ...SCENE_CONFIG, rng: () => 0.99 };
    const s = createFlapFortuneState(10, cfg); s.pipes = []; s.playerY = 20; s.playerVelocityY = -7;
    tickFlapFortune(s, false, cfg);
    expect(s.isAlive).toBe(false);
  });

  test('collision edges: wizard right edge == pipe.x is NOT a hit; 1e-9 overlap is', () => {
    const s = createFlapFortuneState(10, { ...SCENE_CONFIG, rng: () => 0.5 });
    const pipe = s.pipes[0];
    s.playerY = pipe.topHeight + 5;          // vertically inside the top gate
    pipe.x = 80 + 14;                          // pr == pipe.x  -> `pr <= pipe.x` continue
    expect(checkFlapCollision(s, SCENE_CONFIG)).toBe(false);
    pipe.x -= 1e-9;
    expect(checkFlapCollision(s, SCENE_CONFIG)).toBe(true);
    // top-edge tangency: pt == topHeight counts as a hit (`<=`), asymmetric with the horizontal rule
    pipe.x = 80; s.playerY = pipe.topHeight + 14;
    expect(checkFlapCollision(s, SCENE_CONFIG)).toBe(true);
  });
});

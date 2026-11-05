/**
 * @file jett.char.test.ts
 * @purpose CHARACTERIZATION TESTS (research only, not part of `npm test`).
 *          Each test PASSES against the current code at 616fd82 and documents CURRENT behaviour.
 *          Tests tagged [CURRENT-DEFECT] pin a defect: when the defect is fixed the test should be
 *          inverted and moved into src/tests as a regression test.
 * @author Agent 934 (research branch)
 * @date 2026-11-05
 * @license Proprietary – available for licensing
 */
import {
  createJettState, tickJett, cashOutJett, computeMultiplier, spawnAsteroidWave, checkAsteroidCollision,
} from '../../src/games/JettLogic';
import type { JettConfig, JettState } from '../../src/games/JettLogic';
import { ProvablyFairRNG } from '../../research/patches/ProvablyFairRNG.masked';

const CONFIG: JettConfig = { worldWidth: 390, screenHeight: 844, houseEdge: 0.03, combustionChancePerTick: 0.0008 };
const PLAYER_SCREEN_Y = 844 * 0.62; // JettUI.playerScreenY
const NO_COMBUST = () => 0.99;

function seeded(seed: string): () => number { const r = new ProvablyFairRNG(seed); return () => r.random(); }

describe('Jett characterization', () => {
  test('[CURRENT-DEFECT] multiplier drops below 1.0 on the first tick (x0.9711)', () => {
    const s = createJettState(10, CONFIG);
    s.rng = NO_COMBUST;
    expect(s.multiplier).toBe(1.0);
    tickJett(s, 195, CONFIG);
    expect(s.multiplier).toBeCloseTo(0.9711, 4);
    // Break-even altitude: 1.1^(a/100) * 0.97 >= 1  =>  a >= 31.96
    expect(computeMultiplier(31.9, 0.03)).toBeLessThan(1);
    expect(computeMultiplier(32.0, 0.03)).toBeGreaterThanOrEqual(1);
    // Cash out during that window returns less than the bet.
    expect(cashOutJett(s)).toBe(9.71);
  });

  test('first coin: world Y 675.2, off-screen at start, visible at altitude ~101.9, collectable at ~675', () => {
    const s = createJettState(10, CONFIG);
    expect(s.coins[0].worldY).toBeCloseTo(675.2, 5);
    const screenY = (alt: number) => PLAYER_SCREEN_Y - (s.coins[0].worldY - alt);
    expect(screenY(0)).toBeLessThan(-50); // JettUI culls < -50
    const visibleAlt = s.coins[0].worldY - PLAYER_SCREEN_Y - 50;
    expect(visibleAlt).toBeCloseTo(101.92, 1);
    // Collection requires the player to reach the coin's world Y (±20) — ~520 ticks at 1.2–1.8/tick.
    const st = createJettState(10, CONFIG); st.rng = NO_COMBUST;
    let tick = 0;
    while (st.coinsCollected === 0 && tick < 2000) { st.asteroids = []; tickJett(st, 195, CONFIG); tick++; }
    expect(st.coinsCollected).toBe(1);
    expect(st.altitude).toBeGreaterThan(650);
    expect(st.altitude).toBeLessThan(700);
  });

  test('[CURRENT-DEFECT] coin X uses Math.random(), bypassing injected RNG — same seed, different state', () => {
    const run = () => {
      const base = seeded('fixed');
      const s = createJettState(10, CONFIG); s.rng = () => 0.001 + 0.998 * base(); // seeded, never below combustion floor
      s.playerRadius = -1000; // harness: disable collisions so the run reaches coin spawns
      for (let i = 0; i < 600; i++) tickJett(s, 195, CONFIG);
      return s.coins.map((c) => c.x);
    };
    const spy = jest.spyOn(Math, 'random');
    const a = run();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
    const b = run();
    expect(a.length).toBeGreaterThan(1);
    expect(a.slice(1)).not.toEqual(b.slice(1)); // coin 0 is centered; later coins differ
  });

  test('[CURRENT-DEFECT] combustion floor: configured chance 0 still combusts at 0.0008/tick', () => {
    const cfg = { ...CONFIG, combustionChancePerTick: 0 };
    const s = createJettState(10, cfg); s.rng = () => 0.0007; // below floor, above configured 0
    s.asteroids = [];
    tickJett(s, 195, cfg);
    expect(s.combusted).toBe(true);
  });

  test('[CURRENT-DEFECT] negative vertical scatter re-spawns the same wave band', () => {
    // rng 0.1 => yOffset = (0.1-0.5)*40 = -16 for every asteroid in the wave.
    const s = createJettState(10, CONFIG); s.rng = () => 0.1;
    for (let i = 0; i < 5; i++) tickJett(s, 2, CONFIG); // x=2 keeps player far from asteroids
    const ys = s.asteroids.map((a) => Math.round(a.worldY));
    const counts = new Map<number, number>();
    ys.forEach((y) => counts.set(y, (counts.get(y) ?? 0) + 1));
    expect(Math.max(...counts.values())).toBeGreaterThanOrEqual(5); // one duplicate wave per tick
  });

  test('duplicate-band frequency under a realistic seeded RNG (measured, informational)', () => {
    let duplicates = 0; let waves = 0;
    for (let seed = 0; seed < 50; seed++) {
      const s = createJettState(10, CONFIG); s.rng = seeded(`s${seed}`);
      const seen = new Map<number, number>();
      for (let t = 0; t < 1500 && s.isAlive; t++) {
        const before = s.nextAsteroidId;
        s.playerRadius = -1000; // harness: disable collision to observe spawning only
        tickJett(s, 195, CONFIG);
        if (s.nextAsteroidId > before) {
          waves++;
          const band = Math.round(s.asteroids[s.asteroids.length - 1].worldY / 10);
          const nominal = Math.ceil(s.asteroids[s.asteroids.length - 1].worldY / 20);
          void band;
          seen.set(nominal, (seen.get(nominal) ?? 0) + 1);
        }
      }
      for (const v of seen.values()) if (v > 1) duplicates += v - 1;
    }
    // eslint-disable-next-line no-console
    console.log(`Jett waves spawned=${waves}, waves landing in an already-occupied 20-unit band (approximate duplicate-band rate)=${duplicates} (${((duplicates / waves) * 100).toFixed(1)}%)`);
    expect(waves).toBeGreaterThan(0);
  });

  test('[CURRENT-DEFECT] horizontal teleport tunnels through an asteroid (no swept collision)', () => {
    const s = createJettState(10, CONFIG); s.rng = NO_COMBUST;
    s.playerX = 30;
    s.asteroids = [{ id: 99, x: 195, worldY: 1.2, radius: 40, driftX: 0, rotationAngle: 0, rotationSpeed: 0 }];
    tickJett(s, 360, CONFIG); // jump from x=30 to x=360 through the asteroid at x=195 in one tick
    expect(s.isAlive).toBe(true);
  });

  test('[CURRENT-DEFECT] state is not JSON-serializable for checkpoints (rng is a function)', () => {
    const s: JettState = createJettState(10, CONFIG); s.rng = seeded('x');
    const round = JSON.parse(JSON.stringify(s));
    expect(round.rng).toBeUndefined();
  });

  test('cash-out guards: after death, repeated, and before any tick', () => {
    const s = createJettState(10, CONFIG);
    expect(cashOutJett(s)).toBe(10); // before start: returns full bet (multiplier 1.0)
    expect(cashOutJett(s)).toBe(0);  // repeated: idempotent at logic level
    const d = createJettState(10, CONFIG); d.isAlive = false;
    expect(cashOutJett(d)).toBe(0);
  });

  test('asteroid wave with count=5 can place x outside its own slot (slotWidth < 2*radius)', () => {
    const wave = spawnAsteroidWave(500, 5, 390, 0, () => 0.99);
    const slotWidth = (390 - 60) / 5;
    expect(slotWidth - 2 * wave[0].radius).toBeLessThan(0); // negative jitter range
    expect(wave.length).toBe(5);
  });

  test('[CURRENT-DEFECT] collision tangency is float-rounding dependent (exact touch at x=195+35.1 registers a hit)', () => {
    const s = createJettState(10, CONFIG);
    const r = 30; const touch = s.playerRadius * 0.8 + r * 0.85; // 9.6 + 25.5 = 35.1
    s.asteroids = [{ id: 1, x: s.playerX + touch, worldY: s.playerWorldY, radius: r, driftX: 0, rotationAngle: 0, rotationSpeed: 0 }];
    expect((s.playerX + touch) - s.playerX).toBeLessThan(touch); // 35.099999999999994 < 35.1
    expect(checkAsteroidCollision(s)).toBe(true);
    s.asteroids[0].x += 1e-9;                                     // just outside
    expect(checkAsteroidCollision(s)).toBe(false);
    // Mitigation in spec: compare squared distances against squared radii with an explicit EPS.
  });
});

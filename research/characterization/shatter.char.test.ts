/**
 * @file shatter.char.test.ts
 * @purpose CHARACTERIZATION TESTS (research only). Pass against 616fd82; [CURRENT-DEFECT] tests pin defects.
 * @author Agent 934 (research branch)
 * @date 2026-11-05
 * @license Proprietary – available for licensing
 */
import { createShatterStepState, pickTile, cashOutShatterStep, computeShatterMultiplier } from '../../src/games/ShatterStepLogic';

describe('Shatter Step characterization', () => {
  test('[CURRENT-DEFECT] theoretical RTP is at most 72.75% for every stopping strategy (target 96%)', () => {
    // EV of stopping after k correct rows = 0.5^k * 1.5^k * 0.97 = 0.75^k * 0.97
    const ev = (k: number) => Math.pow(0.5, k) * computeShatterMultiplier(k, 1.5, 0.03);
    const evs = Array.from({ length: 10 }, (_, i) => ev(i + 1));
    expect(Math.max(...evs)).toBeCloseTo(0.7275, 4);
    expect(ev(10)).toBeCloseTo(0.0546, 3);
    // Fair-at-96% per-row multiplier for p=0.5 would be 2.0 with a single 0.96 factor at settlement:
    expect(Math.pow(0.5, 3) * Math.pow(2, 3) * 0.96).toBeCloseTo(0.96, 6);
  });

  test('outcome is independent of the chosen side (pick has no effect on the roll)', () => {
    const roll = 0.7;
    const a = pickTile(createShatterStepState(10), 'left', { rng: () => roll });
    const b = pickTile(createShatterStepState(10), 'right', { rng: () => roll });
    expect(a.lastPickCorrect).toBe(b.lastPickCorrect);
  });

  test('cash-out guards: before first pick, repeated, after loss, after auto cash-out at top', () => {
    const s = createShatterStepState(10);
    expect(cashOutShatterStep(s)).toBe(0);
    pickTile(s, 'left', { rng: () => 0.9 });
    expect(cashOutShatterStep(s)).toBe(14.55);
    expect(cashOutShatterStep(s)).toBe(0);
    const l = createShatterStepState(10); pickTile(l, 'left', { rng: () => 0.1 });
    expect(cashOutShatterStep(l)).toBe(0);
    const t = createShatterStepState(10);
    for (let i = 0; i < 10; i++) pickTile(t, 'left', { rng: () => 0.9 });
    expect(t.cashedOut).toBe(true);
    expect(t.payout).toBe(559.35); // 1.5^10*0.97*10
    expect(cashOutShatterStep(t)).toBe(0);
  });

  test('re-entrant pick after settlement is ignored at logic level', () => {
    const s = createShatterStepState(10);
    pickTile(s, 'left', { rng: () => 0.1 });
    pickTile(s, 'left', { rng: () => 0.9 });
    expect(s.currentRow).toBe(0); expect(s.isAlive).toBe(false);
  });

  test('[CURRENT-DEFECT] UI LCG (ShatterStepUI._rng) can return exactly 1.0 and loses precision on Date.now() seeds', () => {
    // Reproduces the UI formula verbatim.
    let seed = 1730000000000;
    const step = () => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0xffffffff; };
    const first = step();
    expect(first).toBeGreaterThanOrEqual(0);
    // Range is [0, 1] inclusive: (2^32-1)/0xffffffff === 1
    expect(0xffffffff / 0xffffffff).toBe(1);
    // Product exceeds 2^53 for millisecond seeds -> low bits are rounded before masking.
    expect(1730000000000 * 1664525).toBeGreaterThan(Number.MAX_SAFE_INTEGER);
  });
});

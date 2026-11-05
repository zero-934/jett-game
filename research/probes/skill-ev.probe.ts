/**
 * @file skill-ev.probe.ts
 * @purpose Research probe: expected return for a PERFECT-dodging player who only faces the combustion
 *          house-edge mechanic, as a function of cash-out point. Uses the production formulas verbatim.
 *          This is an UPPER BOUND on RTP (real players also hit hazards) — it shows whether the
 *          combustion mechanic alone can deliver a 96% return.
 */
import { computeMultiplier } from '../../src/games/JettLogic';
import { computeFlapMultiplier } from '../../src/games/FlapFortuneLogic';

test('perfect-play EV curves', () => {
  const rows: string[] = [];
  // Jett: speed = min(3, 1.2 + alt/900); p = max(0.0008, 0.0008*(1+alt/5000)) (scene config 0.0008)
  let alt = 0, surv = 1, best = { ev: 0, alt: 0 }; const jettMarks = [100, 250, 500, 1000, 2000, 3000, 5000, 8000];
  let tick = 0;
  while (alt < 20000) {
    const speed = Math.min(3, 1.2 + alt / 900); alt += speed; tick++;
    const p = Math.max(0.0008, 0.0008 * (1 + alt / 5000)); surv *= 1 - p;
    const ev = surv * computeMultiplier(alt, 0.03);
    if (ev > best.ev) best = { ev, alt };
    if (jettMarks.length && alt >= jettMarks[0]) { rows.push(`Jett  cash-out@alt ${jettMarks.shift()}: ticks=${tick} survival=${surv.toFixed(4)} mult=${computeMultiplier(alt, 0.03).toFixed(3)} EV=${ev.toFixed(3)}`); }
  }
  rows.push(`Jett  best EV ${best.ev.toFixed(2)}x at altitude ${best.alt.toFixed(0)}`);
  // Flap: 230/3 ticks per gate; p = max(0.0005, 0.0003*(1+0.05*gates))
  let s2 = 1, bestF = { ev: 0, k: 0 };
  for (let k = 1; k <= 200; k++) {
    const p = Math.max(0.0005, 0.0003 * (1 + 0.05 * (k - 1)));
    s2 *= Math.pow(1 - p, 230 / 3);
    const ev = s2 * computeFlapMultiplier(k, 0.03);
    if (ev > bestF.ev) bestF = { ev, k };
    if ([1, 5, 10, 20, 40, 60, 80].includes(k)) rows.push(`Flap  dive after gate ${k}: survival=${s2.toFixed(4)} mult=${computeFlapMultiplier(k, 0.03).toFixed(3)} EV=${ev.toFixed(3)}`);
  }
  rows.push(`Flap  best EV ${bestF.ev.toFixed(2)}x after gate ${bestF.k}`);
  console.log(rows.join('\n'));
  expect(rows.length).toBeGreaterThan(0);
});

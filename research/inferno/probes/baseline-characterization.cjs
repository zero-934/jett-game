/**
 * @file baseline-characterization.cjs
 * @purpose RESEARCH ONLY — reproduces the documented Inferno Logic observations against whichever
 *          source tree is passed as argv[2] (default: this checkout). Records observed behaviour;
 *          it does NOT assert desired behaviour. Run against the baseline worktree and the fixed tree.
 * @author Agent 934
 * @date 2026-11-05
 * @license Proprietary – available for licensing
 */
const path = require('node:path');
const { repoRoot } = require('../lib/load-ts.cjs');
const root = repoRoot(process.argv[2]);
const L = require(path.join(root, 'src/games/InfernoLogic.ts'));
const { createRNG } = require(path.join(root, 'src/shared/rng/ProvablyFairRNG.ts'));

const gridState = (rows, bet = 10) => {
  const s = L.createInfernoState(bet);
  s.grid = rows.map((r, ri) => r.map((symbol, ci) => ({ symbol, row: ri, col: ci, isWinning: false, isFalling: false })));
  return s;
};
const syms = (s) => s.grid.map((r) => r.map((c) => c.symbol));
const out = { sourceRoot: root, probes: {} };

// 1. all-WILD board
{
  const s = L.evaluateClusters(gridState([['WILD','WILD','WILD'],['WILD','WILD','WILD'],['WILD','WILD','WILD']]));
  const s8 = L.evaluateClusters(gridState([['EMBER','WILD','WILD'],['WILD','WILD','WILD'],['WILD','WILD','WILD']]));
  out.probes.allWild = { clusters: s.clusters.length, win: s.totalWin, comparisonOneEmberEightWild: { clusters: s8.clusters.length, win: s8.totalWin } };
}
// 2. three scatters, no paying cluster
{
  let s = L.evaluateClusters(gridState([['SCATTER','EMBER','FLAME'],['ASH','SCATTER','COAL'],['FLAME','SMOKE','SCATTER']]));
  const after = L.cascadeInferno(s, { rng: createRNG('probe') });
  out.probes.scatterWithoutCluster = { scatterCount: s.scatterCount, clusters: s.clusters.length, freeSpinsAfter: after.freeSpinsRemaining, complete: after.isComplete };
}
// 3. survivor order: column 0 = A (top), winner (middle), B (bottom)
{
  let s = gridState([['COAL','SMOKE','ASH'],['EMBER','EMBER','EMBER'],['FLAME','ASH','SMOKE']]);
  s = L.evaluateClusters(s);
  const after = L.cascadeInferno(s, { rng: createRNG('survivor') });
  const col = (g, c) => g.map((r) => r[c]);
  out.probes.survivorOrder = {
    before: { col0: col(syms(s), 0), col1: col(syms(s), 1), col2: col(syms(s), 2) },
    after: { col0: col(syms(after), 0), col1: col(syms(after), 1), col2: col(syms(after), 2) },
    expectedGravityRows1and2: { col0: ['COAL','FLAME'], col1: ['SMOKE','ASH'], col2: ['ASH','SMOKE'] },
  };
  out.probes.survivorOrder.reversed = JSON.stringify(out.probes.survivorOrder.after.col0.slice(1)) === JSON.stringify(['FLAME','COAL']);
}
// 4. simulateInfernoRTP carries no heat: equal to an explicitly fresh-state-per-round runner
{
  const rounds = 3000;
  const sim = L.simulateInfernoRTP(rounds, 1, { rng: createRNG('carry-check') });
  const rng = createRNG('carry-check');
  let paid = 0, won = 0, infernoSpins = 0, maxHeatSeen = 0;
  for (let i = 0; i < rounds; i++) {
    let s = L.createInfernoState(1);
    paid += 1;
    s = L.spinInferno(s, { rng });
    if (s.isInfernoSpin) infernoSpins++;
    for (let k = 0; k < 50; k++) { s = L.evaluateClusters(s); if (!s.clusters.length) break; s = L.cascadeInferno(s, { rng }); maxHeatSeen = Math.max(maxHeatSeen, s.heatMeter); }
    won += s.totalWin;
  }
  out.probes.simulatorCarry = { rounds, simulateInfernoRTP: sim, freshStateRunner: won / paid, identical: sim === won / paid, infernoSpinsObserved: infernoSpins, maxHeatWithinOneSpin: maxHeatSeen };
}
// 5. repeated evaluateClusters on same state accumulates totalWin (duplicate credit)
{
  let s = gridState([['EMBER','EMBER','EMBER'],['SMOKE','ASH','COAL'],['ASH','COAL','SMOKE']]);
  const once = L.evaluateClusters(s);
  const twice = L.evaluateClusters(once);
  out.probes.repeatedEvaluate = { firstTotal: once.totalWin, secondTotal: twice.totalWin };
}
// 6. WILD overlap: one WILD bridging two different symbol clusters
{
  const s = L.evaluateClusters(gridState([['EMBER','WILD','FLAME'],['EMBER','SMOKE','FLAME'],['ASH','COAL','ASH']]));
  out.probes.wildOverlap = { clusters: s.clusters.map((c) => ({ symbol: c.symbol, size: c.cells.length, payout: c.payout })), total: s.totalWin };
}
// 7. cascadeInferno without config reseeds from lastSpinSeed every call
{
  let s = gridState([['EMBER','EMBER','EMBER'],['SMOKE','ASH','COAL'],['ASH','COAL','SMOKE']]);
  s.lastSpinSeed = 'same';
  s = L.evaluateClusters(s);
  const a = L.cascadeInferno(s), b = L.cascadeInferno(s);
  out.probes.cascadeDefaultRng = { refillA: syms(a)[0], refillB: syms(b)[0], identical: JSON.stringify(syms(a)) === JSON.stringify(syms(b)) };
}
// 8. float payouts (rounding)
{
  const s = L.evaluateClusters(gridState([['COAL','COAL','COAL'],['SMOKE','ASH','EMBER'],['ASH','EMBER','SMOKE']], 3));
  out.probes.rounding = { bet: 3, coal3Payout: s.totalWin, isExactCents: Math.round(s.totalWin * 100) / 100 === s.totalWin };
}
console.log(JSON.stringify(out, null, 2));

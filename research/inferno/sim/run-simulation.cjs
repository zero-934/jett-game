/**
 * @file run-simulation.cjs
 * @purpose RESEARCH ONLY — full-cycle Inferno simulation in independent seeded batches, calling the
 *          real production Logic exports of the source tree given by --root. Writes raw per-batch
 *          aggregates (JSON + CSV) and a summary with a batch-means 95% interval.
 *
 *          Two runners:
 *          - `exports` (default for any tree): uses only the ORIGINAL public exports
 *            (createInfernoState/spinInferno/evaluateClusters/cascadeInferno/flipCrown/walkCrown),
 *            carrying heat and free spins between rounds. Works on the baseline tree and the fixed tree.
 *          - `cycles`: calls the new production `simulateInfernoCycles()` (fixed tree only).
 *          On the fixed tree both runners consume the RNG identically, so their results must match;
 *          that equality is checked by `--crosscheck`.
 *
 * Usage:
 *   node research/inferno/sim/run-simulation.cjs --label after-legacy-collect --batches 20 --cycles 1000
 *     [--root ../inferno-baseline] [--runner exports|cycles] [--policy collect|flip-once|flip-up-to:3]
 *     [--wild no-pay|pays-as-top-symbol] [--scatter after-cascade-only|any-landed-board]
 *     [--prng production|masked-proposal] [--seed-prefix inferno-polish-001] [--out dir] [--crosscheck]
 * @author Agent 934
 * @date 2026-11-05
 * @license Proprietary – available for licensing
 */
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');
const { repoRoot } = require('../lib/load-ts.cjs');

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
  return acc;
}, []));
const root = repoRoot(args.root ? path.resolve(args.root) : undefined);
const L = require(path.join(root, 'src/games/InfernoLogic.ts'));
const prngName = args.prng || 'production';
const RNGMod = prngName === 'masked-proposal'
  ? require(path.resolve(__dirname, '../../patches/ProvablyFairRNG.masked.ts'))
  : require(path.join(root, 'src/shared/rng/ProvablyFairRNG.ts'));
const makeRng = (seed) => (RNGMod.createRNG ? RNGMod.createRNG(seed) : new RNGMod.ProvablyFairRNG(seed));

const label = args.label || 'run';
const batches = Number(args.batches || 20);
const cyclesPerBatch = Number(args.cycles || 1000);
const stake = Number(args.stake || 1);
const runner = args.runner || 'exports';
const seedPrefix = args['seed-prefix'] || 'inferno-polish-001';
const policyArg = args.policy || 'collect';
const policy = policyArg === 'collect' ? { kind: 'collect' }
  : policyArg === 'flip-once' ? { kind: 'flip-once' }
  : { kind: 'flip-up-to', maxFlips: Number(policyArg.split(':')[1] || 3) };
const rules = {};
if (args.wild) rules.wildOnlyCluster = args.wild;
if (args.scatter) rules.scatterAward = args.scatter;
const outDir = path.resolve(args.out || path.join(__dirname, '../../../docs/inferno-polish-001/evidence/sim'));
const MAX_CASCADES = 200;
const BUCKETS = 12;
const milli = (x) => Math.round(x * 1000);

let sha = 'unknown';
try { sha = execSync('git rev-parse HEAD', { cwd: root }).toString().trim(); } catch { /* not a git tree */ }
let dirty = false;
try { dirty = execSync('git status --porcelain -- src', { cwd: root }).toString().trim().length > 0; } catch { /* ignore */ }

/** Cycle runner that uses only the original public exports. */
function runExportsBatch(rng) {
  const cfg = Object.keys(rules).length ? { rng, rules } : { rng };
  const b = { paidCycles: 0, paidSpins: 0, freeSpins: 0, totalPaidMilli: 0, grossReturnMilli: 0, hitCycles: 0, zeroCycles: 0, partialCycles: 0,
    breakEvenCycles: 0, profitCycles: 0, infernoSpins: 0, infernoSpinReturnMilli: 0, freeSpinAwards: 0, crownOffers: 0, crownFlips: 0,
    crownFlipWins: 0, cascadeHistogram: Array(BUCKETS).fill(0), maxCascadesObserved: 0, maxCycleReturnMilli: 0, maxSpinReturnMilli: 0,
    unresolvedSpins: 0, nonFiniteEvents: 0, unresolvedSeeds: [] };
  let state = L.createInfernoState(stake);
  for (let c = 0; c < cyclesPerBatch; c++) {
    b.paidCycles++; b.totalPaidMilli += milli(stake);
    let cycleReturn = 0; let first = true;
    while (first || state.freeSpinsRemaining > 0) {
      if (first) b.paidSpins++; else b.freeSpins++;
      first = false;
      const freeBefore = state.freeSpinsRemaining > 0 ? state.freeSpinsRemaining - 1 : 0;
      state = L.spinInferno({ ...state, bet: stake, isInCrownFlip: false }, cfg);
      if (state.isInfernoSpin) b.infernoSpins++;
      let k = 0;
      for (;;) {
        state = L.evaluateClusters(state, cfg);
        if (state.clusters.length === 0) { state = L.cascadeInferno(state, cfg); break; }
        if (k >= MAX_CASCADES) { b.unresolvedSpins++; b.unresolvedSeeds.push({ cycle: c, spinSeed: state.lastSpinSeed }); state = { ...state, isComplete: true }; break; }
        state = L.cascadeInferno(state, cfg); k++;
      }
      if (state.freeSpinsRemaining > freeBefore) b.freeSpinAwards++;
      b.cascadeHistogram[Math.min(k, BUCKETS - 1)]++;
      b.maxCascadesObserved = Math.max(b.maxCascadesObserved, k);
      if (state.isInfernoSpin) b.infernoSpinReturnMilli += milli(state.totalWin);
      let spinReturn = state.totalWin;
      const eligible = state.totalWin > 0 && state.freeSpinsRemaining === 0;
      if (eligible) {
        b.crownOffers++;
        if (policy.kind !== 'collect') {
          let crown = { ...state, isInCrownFlip: true, crownFlipWin: state.totalWin, crownFlipChain: 0, isComplete: false };
          const limit = policy.kind === 'flip-once' ? 1 : policy.maxFlips;
          let flips = 0; let lost = false;
          while (crown.isInCrownFlip && flips < limit) {
            crown = L.flipCrown(crown, cfg); flips++; b.crownFlips++;
            if (crown.isInCrownFlip) b.crownFlipWins++; else lost = true;
          }
          if (crown.isInCrownFlip) crown = L.walkCrown(crown);
          spinReturn = lost ? 0 : crown.totalWin;
          state = { ...crown, totalWin: spinReturn, isInCrownFlip: false, isComplete: true };
        }
      }
      if (!Number.isFinite(spinReturn)) b.nonFiniteEvents++;
      const sm = milli(spinReturn);
      b.maxSpinReturnMilli = Math.max(b.maxSpinReturnMilli, sm);
      cycleReturn += sm;
    }
    b.grossReturnMilli += cycleReturn;
    b.maxCycleReturnMilli = Math.max(b.maxCycleReturnMilli, cycleReturn);
    const paid = milli(stake);
    if (cycleReturn > 0) b.hitCycles++;
    if (cycleReturn === 0) b.zeroCycles++; else if (cycleReturn < paid) b.partialCycles++; else if (cycleReturn === paid) b.breakEvenCycles++; else b.profitCycles++;
  }
  b.pendingFreeSpinsAtEnd = state.freeSpinsRemaining;
  b.finalHeat = state.heatMeter;
  return b;
}

function runCyclesBatch(rng) {
  const cfg = Object.keys(rules).length ? { rng, rules } : { rng };
  const s = L.simulateInfernoCycles(cyclesPerBatch, stake, cfg, policy);
  return { ...s, unresolvedSeeds: [] };
}

const tStart = Date.now();
const rows = [];
let crosscheck = null;
for (let i = 0; i < batches; i++) {
  const seed = `${seedPrefix}:${label}:batch-${String(i).padStart(3, '0')}`;
  const t0 = Date.now();
  const b = runner === 'cycles' ? runCyclesBatch(makeRng(seed)) : runExportsBatch(makeRng(seed));
  b.batch = i; b.seed = seed; b.ms = Date.now() - t0;
  b.rtp = b.grossReturnMilli / b.totalPaidMilli;
  rows.push(b);
  if (args.crosscheck && i === 0 && L.simulateInfernoCycles) {
    const other = runner === 'cycles' ? runExportsBatch(makeRng(seed)) : runCyclesBatch(makeRng(seed));
    crosscheck = { seed, thisRunner: runner, grossThis: b.grossReturnMilli, grossOther: other.grossReturnMilli,
      cascadesEqual: JSON.stringify(b.cascadeHistogram) === JSON.stringify(other.cascadeHistogram), equal: b.grossReturnMilli === other.grossReturnMilli };
  }
}
const sum = (k) => rows.reduce((a, r) => a + r[k], 0);
const totalPaid = sum('totalPaidMilli');
const gross = sum('grossReturnMilli');
const batchRtps = rows.map((r) => r.rtp);
const mean = batchRtps.reduce((a, x) => a + x, 0) / batchRtps.length;
const sd = Math.sqrt(batchRtps.reduce((a, x) => a + (x - mean) ** 2, 0) / Math.max(1, batchRtps.length - 1));
// two-sided 95% Student t critical values for df = 1..30, then normal approximation
const T95 = [12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.160, 2.145, 2.131, 2.120, 2.110, 2.101, 2.093, 2.086, 2.080, 2.074, 2.069, 2.064, 2.060, 2.056, 2.052, 2.048, 2.045, 2.042];
const df = batchRtps.length - 1;
const tcrit = df >= 1 ? (df <= 30 ? T95[df - 1] : 1.96) : NaN;
const half = tcrit * sd / Math.sqrt(batchRtps.length);
const hist = Array(BUCKETS).fill(0).map((_, k) => sum2(k));
function sum2(k) { return rows.reduce((a, r) => a + r.cascadeHistogram[k], 0); }
const fp = L.getInfernoMathFingerprint ? L.getInfernoMathFingerprint(Object.keys(rules).length ? { rules } : undefined) : null;
const summary = {
  label, generatedAt: new Date().toISOString(), sourceRoot: path.relative(process.cwd(), root) || '.', codeSha: sha, sourceDirty: dirty,
  mathVersion: L.INFERNO_MATH_VERSION || 'inferno-math-1 (baseline, unversioned)', configFingerprint: fp ? fp.hash : 'n/a (baseline has no fingerprint export)',
  prng: prngName === 'production' ? 'ProvablyFairRNG production (unmasked BigInt xoroshiro-style)' : 'research/patches/ProvablyFairRNG.masked.ts (proposal, NOT production)',
  runner, rules: Object.keys(rules).length ? rules : 'production defaults', crownPolicy: policy, stake, batches, cyclesPerBatch,
  seedScheme: `${seedPrefix}:${label}:batch-NNN (one fresh RNG + fresh state (heat 0) per batch; state carried within a batch)`,
  paidCycles: sum('paidCycles'), paidSpins: sum('paidSpins'), freeSpins: sum('freeSpins'), totalPaidCredits: totalPaid / 1000, grossReturnCredits: gross / 1000,
  rtpPooled: gross / totalPaid, rtpBatchMean: mean, batchSd: sd, ci95: [mean - half, mean + half], ciMethod: `batch means, Student t (df=${df}); batches are independent seeded sessions`,
  hitFrequency: sum('hitCycles') / sum('paidCycles'),
  outcomeRates: { zero: sum('zeroCycles') / sum('paidCycles'), partialBelowStake: sum('partialCycles') / sum('paidCycles'), breakEven: sum('breakEvenCycles') / sum('paidCycles'), profit: sum('profitCycles') / sum('paidCycles') },
  infernoSpinsPerPaidCycle: sum('infernoSpins') / sum('paidCycles'), infernoSpinMeanReturnCredits: sum('infernoSpins') ? sum('infernoSpinReturnMilli') / 1000 / sum('infernoSpins') : 0,
  freeSpinAwardsPerPaidCycle: sum('freeSpinAwards') / sum('paidCycles'), freeSpinsPerPaidCycle: sum('freeSpins') / sum('paidCycles'),
  crownOffersPerPaidCycle: sum('crownOffers') / sum('paidCycles'), crownFlips: sum('crownFlips'), crownFlipWinRate: sum('crownFlips') ? sum('crownFlipWins') / sum('crownFlips') : null,
  cascadeHistogramBySpin: hist, maxCascadesObserved: Math.max(...rows.map((r) => r.maxCascadesObserved)),
  maxObservedCycleReturnCredits: Math.max(...rows.map((r) => r.maxCycleReturnMilli)) / 1000, maxObservedSpinReturnCredits: Math.max(...rows.map((r) => r.maxSpinReturnMilli)) / 1000,
  unresolvedSpins: sum('unresolvedSpins'), unresolvedSeeds: rows.flatMap((r) => r.unresolvedSeeds || []).slice(0, 20), nonFiniteEvents: sum('nonFiniteEvents'),
  pendingFreeSpinsAtBatchEnds: sum('pendingFreeSpinsAtEnd'), runtimeMs: Date.now() - tStart, crosscheck,
};
fs.mkdirSync(outDir, { recursive: true });
const rowsOut = rows.map(({ unresolvedSeeds, ...r }) => r);
fs.writeFileSync(path.join(outDir, `${label}.summary.json`), JSON.stringify(summary, null, 2) + '\n');
fs.writeFileSync(path.join(outDir, `${label}.batches.json`), JSON.stringify(rowsOut, null, 1) + '\n');
const cols = ['batch', 'seed', 'paidCycles', 'paidSpins', 'freeSpins', 'totalPaidMilli', 'grossReturnMilli', 'rtp', 'hitCycles', 'zeroCycles', 'partialCycles', 'breakEvenCycles', 'profitCycles', 'infernoSpins', 'freeSpinAwards', 'crownOffers', 'crownFlips', 'crownFlipWins', 'maxCascadesObserved', 'maxCycleReturnMilli', 'unresolvedSpins', 'ms'];
fs.writeFileSync(path.join(outDir, `${label}.batches.csv`), [cols.join(',')].concat(rows.map((r) => cols.map((c) => r[c]).join(','))).join('\n') + '\n');
console.log(JSON.stringify({ label, rtpPooled: summary.rtpPooled, ci95: summary.ci95, paidCycles: summary.paidCycles, unresolved: summary.unresolvedSpins, runtimeMs: summary.runtimeMs, crosscheck }, null, 0));

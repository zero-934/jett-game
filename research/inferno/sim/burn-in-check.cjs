/**
 * @file burn-in-check.cjs
 * @purpose RESEARCH ONLY — tests whether batch length (heat burn-in from a fresh heat-0 state) or the
 *          production RNG's unmasked state growth explains RTP differences between batch lengths.
 *          Per-cycle returns are bucketed by cycle index within a batch.
 * @author Agent 934  @date 2026-11-05  @license Proprietary – available for licensing
 */
const path = require('node:path');
require('../lib/load-ts.cjs');
const L = require(path.resolve(__dirname, '../../../src/games/InfernoLogic.ts'));
const prod = require(path.resolve(__dirname, '../../../src/shared/rng/ProvablyFairRNG.ts'));
const masked = require(path.resolve(__dirname, '../../patches/ProvablyFairRNG.masked.ts'));
const { deriveSeed } = require('../lib/seed.cjs');
const make = { production: (s) => prod.createRNG(deriveSeed(s)), masked: (s) => (masked.createRNG ? masked.createRNG(deriveSeed(s)) : new masked.ProvablyFairRNG(deriveSeed(s))) };
const BUCKET = 50;
function run(prng, batches, cycles) {
  const buckets = []; let paid = 0, gross = 0;
  for (let b = 0; b < batches; b++) {
    const rng = make[prng](`burnin:${prng}:${cycles}:${b}`);
    // explicit loop (same as simulateInfernoCycles, collect policy) keeping per-cycle returns
    let s = L.createInfernoState(1);
    for (let c = 0; c < cycles; c++) {
      let ret = 0; let first = true;
      while (first || s.freeSpinsRemaining > 0) { first = false; const sc = L.resolveInfernoSpin({ ...s, isInCrownFlip: false }, { rng }); s = sc.finalState; ret += sc.totalWin; }
      const k = Math.floor(c / BUCKET); buckets[k] = buckets[k] || { n: 0, ret: 0, heat0: 0 }; buckets[k].n++; buckets[k].ret += ret; paid++; gross += ret;
    }
  }
  return { prng, batches, cycles, rtp: gross / paid, byCycleIndex: buckets.map((x, k) => ({ from: k * BUCKET, rtp: +(x.ret / x.n).toFixed(4), n: x.n })) };
}
const out = [run('masked', 160, 250), run('masked', 10, 4000), run('production', 80, 250)];
console.log(JSON.stringify(out, null, 1));

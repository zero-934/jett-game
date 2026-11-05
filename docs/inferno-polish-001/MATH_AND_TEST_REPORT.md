# Inferno polish 001 — Maths and test report

> **Bottom line.** Under its current rules (`inferno-math-2`, legacy rule defaults, collect-immediately policy), Inferno returns about **90.8% of paid stakes** (95% CI 90.55–90.97%, 2,000,000 paid cycles, using the same per-round RNG the scene uses). It does **not** return 96%. The main reason is that an Inferno Spin happens in about **22.7% of paid cycles and always pays 0**. That is an open product decision (see `BASELINE_AND_DECISIONS.md`). Nothing here is certified fairness, provable fairness or a regulatory RTP. It is a seeded simulation of the production Logic.

## Method

- **Production code only.** The runners call the real exports of the tree under test (`research/inferno/lib/load-ts.cjs` transpiles the `.ts` sources). Nothing was reimplemented in another language.
  - **`exports` runner** (`research/inferno/sim/run-simulation.cjs`): uses only the original public functions (`createInfernoState`, `spinInferno`, `evaluateClusters`, `cascadeInferno`, `flipCrown`, `walkCrown`). It therefore runs unchanged on the **baseline worktree (2977ad6)** and on the fixed tree.
  - **`cycles` runner:** calls the new `simulateInfernoCycles()`. On the fixed tree, both runners consume the RNG identically. The `--crosscheck` gross returns were equal for every checked configuration (see `crosscheck` in the summaries).
- **Full cycle.**
  - Heat and free spins carry across spins and paid cycles.
  - Awarded free spins (including retriggers) are drained inside their paid cycle.
  - Only paid stakes enter the denominator.
  - A safety cap of 200 cascades per spin marks a spin `unresolved` (counted and failed, never scored as 0).
  - Results are checked for non-finite values.
- **Crown policies** are analysis policies only and don't change what a player may do:
  - `collect`: always collect (also what `simulateInfernoRTP` uses).
  - `flip-once`: one flip, then collect if won.
  - `flip-up-to:3`: a bounded analysis policy that flips until 3 wins or a loss.
- **RNG modes.**
  - `rng-scope round`: one production `ProvablyFairRNG` per spin, seeded with `deriveInfernoSeed("<batchSeed>:r<i>")` plus 16 warm-up draws. This is exactly what `InfernoScene` does now. Crown flips use that round's RNG.
  - `rng-scope batch`: one stream per batch.
  - `--prng masked-proposal`: the review-only `research/patches/ProvablyFairRNG.masked.ts`, kept as a separate labelled sensitivity run.
- **Uncertainty.**
  - Independent seeded **session batches**: each starts from a fresh state at heat 0 and carries state within the batch.
  - Batch-means **Student-t 95% interval**, using 100–200 batches for headline rows.
  - Burn-in (heat starting at 0) was checked by comparing batch lengths of 250 / 1,000 / 4,000 / 10,000 cycles (`burn-in-check.json`, `sensitivity-*-short-batches`). No material effect beyond noise was found.
  - No per-spin independence interval is used anywhere.
- **Heavy tails.** The 40-batch rows have visibly unreliable intervals. For example, the 40k scene-mode row gave 92.7% [91.0, 94.4], but a 200k rerun gave 90.6% [89.9, 91.2] and the 2M run 90.8%. Treat the 40-batch intervals as rough. The headline uses 2M cycles.
- **Identifiers.**
  - Config fingerprint `d318f821` (FNV-1a over weights, payouts, multipliers, constants and rules; `getInfernoMathFingerprint()`).
  - Code SHA as recorded in each summary.
  - Rows marked `sourceDirty: true` were run on the working tree whose Logic **maths** equals the final commit; only seed helpers were added after the run. The fingerprint is identical.
  - Reproducibility was checked: rerunning 5 batches at a later HEAD reproduced the batch gross values exactly (`superseded-raw-string-seeds/reproducibility-check.txt`).

### Rerun note: superseded data

The first bulk run seeded batches with raw strings (`…:batch-000`). While reviewing it I found that the shared generator maps suffix-only string seeds onto the **same streams**: 100 "independent" batches contained only 48 distinct ones, and one 40-batch row had just 2. Those results and their intervals are **invalid**. They are kept only for transparency under `evidence/sim/superseded-raw-string-seeds/`. Every row below uses derived numeric seeds; the `distinctBatchOutcomes` field confirms all batches are distinct.

## Results (raw files: `evidence/sim/<label>.summary.json`, `.batches.json`, `.batches.csv`; console `evidence/run/03-bulk-simulation-console.txt`)

| Label | Code | RNG | Rules / Crown policy | Paid cycles | RTP (pooled) | 95% CI (batch means) |
|---|---|---|---|---:|---:|---|
| **HEADLINE-after-math2-scene-rng-collect-2M** | math-2 | production, per round | legacy / collect | 2,000,000 | **0.9076** | 0.9055–0.9097 |
| scene-rng-before-math1-collect-400k | **baseline 2977ad6** | production, per round | legacy / collect | 400,000 | 0.9113 | 0.9069–0.9157 |
| scene-rng-flip-once-400k | math-2 | per round | legacy / flip once | 400,000 | 0.9111 | 0.9052–0.9171 |
| scene-rng-flip-up-to-3-400k | math-2 | per round | legacy / ≤3 flips | 400,000 | 0.9025 | 0.8928–0.9121 |
| scene-rng-option-scatter-any-400k | math-2 | per round | **scatter any-landed-board** / collect | 400,000 | **0.9513** | 0.9462–0.9564 |
| scene-rng-option-wild-pays-400k | math-2 | per round | **WILD-only pays as EMBER** / collect | 400,000 | **5.9800** | 5.9516–6.0083 |
| sensitivity-after-math2-masked-prng-2M | math-2 | masked proposal, batch | legacy / collect | 2,000,000 | 0.9075 | 0.9054–0.9096 |
| sensitivity-masked-round-rng-1M | math-2 | masked proposal, per round | legacy / collect | 1,000,000 | 0.9077 | 0.9046–0.9107 |
| after-math2-collect | math-2 | production, batch | legacy / collect | 100,000 | 0.9056 | 0.8960–0.9153 |
| before-math1-collect | baseline | production, batch | legacy / collect | 40,000 | 0.9094 | 0.8892–0.9296 |
| option-both-collect | math-2 | batch | both options | 40,000 | 6.2201 | 6.1326–6.3075 |

The remaining rows (40-batch policy and sensitivity variants) are in `evidence/sim/`. Total simulated: **7.7M paid cycles**, **0 unresolved spins**, **0 non-finite events**, **0 free spins pending at batch ends**.

**Survivor-order fix (math-1 → math-2):** 91.1% vs 90.8%, intervals overlapping. The direction (about −0.4 pp) is not resolved at this sample size. The fix is still required for correctness: columns visibly reordered.

**Generator sensitivity:** the production generator (per round, with warm-up) and the masked proposal agree (0.9076 vs 0.9075/0.9077). The Inferno-local seed-derivation and warm-up workaround therefore removes the measurable effect of findings 11–12 on RTP.

**Crown:** a fair 50/50 double-or-nothing leaves expected return unchanged within noise (collect 90.8%, flip-once 91.1%, ≤3 flips 90.3%). It does change the distribution: the zero-return rate goes from 44.1% to 70.5% (flip-once) and 90.3% (≤3 flips), and the observed maximum cycle return goes from 43.6× to 114.4× the stake.

### Headline row details (2M paid cycles, stake 1)

| Metric | Value |
|---|---|
| Paid spins / free spins | 2,000,000 / 372,535 (0.186 free spins per paid cycle) |
| Total paid / gross returned | 2,000,000.000 / 1,815,179.275 credits (gross and net are kept separate: net = −184,820.725; RTP 0.90759) |
| Hit frequency (cycle return > 0) | 55.9% |
| Zero / below stake / break-even / profit | 44.1% / 26.7% / 1.1% / 28.1% |
| Inferno Spins per paid cycle | 0.227, mean return **0.00** |
| Free-spin awards per paid cycle | 0.0373 |
| Crown offers per paid cycle | 0.545 |
| Cascades per spin (0,1,2,…,11+) | 1,056,734; 604,042; 351,902; 183,567; 91,245; 44,938; 21,181; 9,971; 4,742; 2,288; 1,033; 892 |
| Max cascades observed | 18 |
| **Max observed** cycle / spin return | 43.625× / 18.75× stake |

**Observed vs theoretical maximum.** The theoretical single-evaluation maximum is a full-board EMBER cluster at 0.8 × 25 = 20× (plus WILD-overlap combinations). Cascades and free spins make the theoretical cycle maximum unbounded in principle: cascades are capped only by the 200-step safety cap, and retriggers have no cap. Neither the observed nor the theoretical maximum estimates rare-event risk.

## Tests

| Suite | Count | Notes |
|---|---:|---|
| `src/tests/InfernoLogic.test.ts` (original) | 16 | **Unchanged, all pass.** Its 10,000-round title and 0.3–3.0 bounds are kept, not edited. They are *not* evidence of 96%. |
| `src/tests/InfernoPolish.test.ts` (new) | 37 | Exact payouts (horizontal, vertical, L-shape, multipliers); diagonal non-match; WILD bridge/overlap/WILD-only (legacy and option); scatter never in a cluster; idempotent evaluation; survivor order (separated, multiple rows) and move/refill mapping reconstructing `gridAfter`; legacy and option scatter rules; retrigger; heat cap/reset and the all-WILD spin; script determinism and equality with the original export sequence (50 seeds); ledger: one debit, BUSY double start, stale/repeated finish, insufficient balance, free spins with zero debit, no balance prerequisite, locked stake, Crown collect/flip/loss exactly-once with stale/repeated rejection, no Crown while free spins are pending, milli-credit exactness, checkpoint/restore determinism; cue policy; simulator carry/paid-only/determinism with the AGENTS 0.5–1.0 sanity band; fingerprint; seed derivation (shared-RNG collision kept visible, 2,000 distinct derived streams, the first-output bias kept visible, χ² on the first symbol with warm-up). |
| Full suite | **277/277** (16 suites, 514 s) | Baseline was 240/240 (15 suites); the final run is `evidence/run/11-final-full-suite.txt`. |

The research probes are not part of `npm test`; each writes JSON evidence (see the implementation report).

## Unresolved fairness and maths risks

1. **The RTP claim is wrong for the current rules:** 90.8% measured vs the 96% in comments, docs and AGENTS.md. Any change to decisions A, B or C needs re-measurement and versioning.
2. **The all-WILD Inferno Spin pays 0** (22.7% of cycles), and the "obvious" fix (WILD pays as EMBER) gives about 598%. This needs a designed value and possibly a slower heat build.
3. **Shared `ProvablyFairRNG` defects:**
   - suffix-only string seeds collide
   - the first output is heavily biased
   - state grows without bound (BigInt not masked)
   - outputs differ from reference xoroshiro128+

   Inferno works around the first two locally. The name "ProvablyFair" is not justified: there is no commit/reveal, no server seed and no verification protocol. Seeds come from `crypto.getRandomValues` in the browser, so the client controls them.
4. **The cascade count is unbounded in principle.** It is capped at 200 for safety, observed maximum 22. Retriggers are unbounded in principle. No unresolved episodes were observed.
5. **Crown has no chain limit.** It is EV-neutral but variance is unbounded. It is a gamble on demo credits; any real-money context would need a regulatory review.
6. **Display rounding:** values are shown at 2 dp while the ledger is exact to 0.001. Sub-cent amounts (e.g. 0.375) display rounded.

#!/usr/bin/env bash
# @file run-all.sh
# @purpose RESEARCH ONLY — reproducible bulk run for MATH_AND_TEST_REPORT.md (≈4–5 min on the cloud VM).
#          Requires a baseline worktree of 2977ad6 at ../inferno-baseline for the "before" rows:
#            git worktree add ../inferno-baseline 2977ad6 && ln -s "$PWD/node_modules" ../inferno-baseline/node_modules
# @author Agent 934  @date 2026-11-05  @license Proprietary – available for licensing
set -euo pipefail
cd "$(dirname "$0")/../../.."
R=research/inferno/sim/run-simulation.cjs
OUT=docs/inferno-polish-001/evidence/sim
node $R --label before-math1-collect --root ../inferno-baseline --batches 40 --cycles 1000 --out $OUT
node $R --label before-math1-flip-once --root ../inferno-baseline --batches 40 --cycles 1000 --policy flip-once --out $OUT
node $R --label after-math2-collect --batches 100 --cycles 1000 --crosscheck --out $OUT
node $R --label after-math2-flip-once --batches 40 --cycles 1000 --policy flip-once --out $OUT
node $R --label after-math2-flip-up-to-3 --batches 40 --cycles 1000 --policy flip-up-to:3 --out $OUT
node $R --label option-wild-pays-collect --batches 40 --cycles 1000 --wild pays-as-top-symbol --crosscheck --out $OUT
node $R --label option-scatter-any-collect --batches 40 --cycles 1000 --scatter any-landed-board --crosscheck --out $OUT
node $R --label option-both-collect --batches 40 --cycles 1000 --wild pays-as-top-symbol --scatter any-landed-board --out $OUT
node $R --label sensitivity-after-math2-short-batches --batches 160 --cycles 250 --out $OUT
node $R --label sensitivity-after-math2-masked-prng --batches 40 --cycles 1000 --prng masked-proposal --out $OUT
node $R --label sensitivity-after-math2-masked-prng-2M --batches 200 --cycles 10000 --prng masked-proposal --out $OUT
node research/inferno/sim/burn-in-check.cjs > $OUT/burn-in-check.json
node $R --label after-math2-collect-round-rng-like-scene --batches 40 --cycles 1000 --rng-scope round --out $OUT
# --- scene-faithful (one RNG per spin, derived seed + warm-up) — fast because RNG state stays small ---
node $R --label sensitivity-masked-round-rng-1M --batches 200 --cycles 5000 --rng-scope round --prng masked-proposal --out $OUT
node $R --label after-math2-collect-round-rng-like-scene-200k --batches 200 --cycles 1000 --rng-scope round --seed-prefix inferno-polish-001b --out $OUT
node $R --label HEADLINE-after-math2-scene-rng-collect-2M --batches 200 --cycles 10000 --rng-scope round --out $OUT
node $R --label scene-rng-flip-once-400k --batches 100 --cycles 4000 --rng-scope round --policy flip-once --out $OUT
node $R --label scene-rng-flip-up-to-3-400k --batches 100 --cycles 4000 --rng-scope round --policy flip-up-to:3 --out $OUT
node $R --label scene-rng-option-wild-pays-400k --batches 100 --cycles 4000 --rng-scope round --wild pays-as-top-symbol --out $OUT
node $R --label scene-rng-option-scatter-any-400k --batches 100 --cycles 4000 --rng-scope round --scatter any-landed-board --out $OUT
node $R --label scene-rng-before-math1-collect-400k --root ../inferno-baseline --batches 100 --cycles 4000 --rng-scope round --out $OUT

# Inferno polish 001 — Baseline and decisions

**Branch:** `fix/inferno-polish-001`, created from `research/inferno-polish-001` at **2977ad6**. Production source baseline is `616fd82` (the handoff commits only add docs). Nothing was merged, deployed or pushed to `main`. Kuro Director was not touched.

## Environment that was actually used

| Item | Value |
|---|---|
| Node / npm | v22.23.4 / 10.9.9 |
| Phaser (installed) | 4.0.0 (`node_modules/phaser/package.json`, `Phaser.VERSION` checked at runtime) |
| TypeScript / Jest / Vite | ~6.0.2 / ^30.3.0 / ^8.0.4 (`npm ci` from the lockfile) |
| Browser for probes | Headless Chromium 153.0.8010.12 via the pre-installed Playwright |
| WebGL backend | ANGLE → Vulkan → **SwiftShader** (software rendering), DPR 1 for measurements and DPR 2 for review screenshots |
| Audio tooling | ffmpeg (libvorbis, libmp3lame, ebur128), with no listening device |

**Baseline checks (before any change):** the full suite passed **240/240 tests in 15 suites** (516 s) and `npm run build` passed. Log: `evidence/run/00-baseline-full-suite-and-build.txt`. This matches the brief's figure of 16/16 Inferno tests passing.

## How each finding was checked

- **D (direct runtime):** executed against production code: Node probes, Jest, or Playwright on the real scene.
- **S (source inference):** concluded from reading the code, not executed.
- **R (secondary research):** taken from studio pages.
- **H (hypothesis):** not tested.

Baseline reproductions ran against the **untouched** code in a separate worktree at 2977ad6:
- Logic probe: `research/inferno/probes/baseline-characterization.cjs` → `evidence/run/01-baseline-logic-characterization.json`
- Browser probe: `research/inferno/probes/baseline-browser-probe.cjs` → `evidence/run/05-baseline-browser-probe.json`

## Findings, classification and what was done

| # | Observation | Evidence | Classification | Action |
|---|---|---|---|---|
| 1 | **Cascade survivors were reversed.** Survivors were collected bottom-to-top, so column `COAL / ×EMBER / FLAME` became `new, FLAME, COAL`. | D (probe 1, survivorOrder) | **Confirmed bug.** The intended rule (gravity) is unambiguous. | **Fixed.** Survivors are now collected top-to-bottom. Math version is now `inferno-math-2`. Tests cover separated survivors and multiple removed rows. |
| 2 | **Crown WALK credited several times.** After two flips won with 40 at risk, *one* WALK press credited **120** (3×). `showCrownFlip()` adds `.once()` handlers on every call. | D (browser probe: listeners 1→3; balance +120) | **Confirmed bug** (multiple settlement). | **Fixed.** Handlers are bound once. Settlement goes through a ledger guarded by round ID and phase. A scene-level busy flag covers the flip reveal. Logic tests plus browser double-tap and repeated-call tests show one credit. |
| 3 | **A free spin was charged.** Starting a free spin moved the balance 1120 → 1110. With balance 0, an awarded free spin **did not start**. | D (browser probe) | **Confirmed bug** ("free" is unambiguous). | **Fixed.** `beginInfernoSpin()`: zero debit, no balance check, and the stake is locked to the cycle stake. Browser check: 6 spins, 1 debit, award cycle ran at balance 0. |
| 4 | **`evaluateClusters()` re-credits on repeated calls** (8 → 16). | D | **Confirmed defect** (misuse is easy). | **Fixed.** Idempotent per cascade step (`lastEvaluatedCascade`). Tested. |
| 5 | **Heat tweens stacked.** Ten `updateHeatMeter(3)` calls left **30** infinite tweens. | D | **Confirmed bug.** | **Fixed.** Only changed segments animate, with one finite tween each. |
| 6 | **AudioContexts were never closed.** `new CasinoAudioManager()` runs per UI. The baseline created contexts and closed none. Scene restart also threw `TypeError … glTexture`. | D | **Confirmed defect.** | **Fixed for Inferno.** It uses Phaser's single sound manager: **1 context across 50 restarts**, with no errors. The shared `CasinoAudioManager` is unchanged. |
| 7 | **Outcome audio used provisional totals.** It played on accumulated `totalWin` per cascade, before Crown or free spins resolved. | S (InfernoScene `triggerAudio` per cascade) | **Confirmed design defect.** | **Fixed.** Intermediate cues are neutral. The profit motif plays only when a **closed paid cycle** returns more than its paid stake (`selectInfernoOutcomeCue`, tested). |
| 8 | **`simulateInfernoRTP()` carried no state.** Heat was reset every round: the result was identical to a fresh-state runner, and **0 Inferno Spins** were observed. The test title says 10,000 rounds, but the code ran 2,000 with bounds 0.3–3.0. | D | **Confirmed.** | **Fixed** (same signature). It carries heat and free spins, drains awards, counts paid stakes only and collects Crown. `simulateInfernoCycles()` adds the statistics. The original test is untouched. |
| 9 | **All-WILD board pays 0.** Heat 5 → the next spin is all WILD → no cluster. Yet 1 EMBER + 8 WILD pays 20× the stake. | D | **Open design rule.** | **Unchanged by default** and labelled honestly in the UI and rules text. Options were measured (below). |
| 10 | **Three scatters without a cluster award nothing.** | D | **Open design rule.** | **Unchanged by default.** Option measured. |
| 11 | **Shared RNG: suffix-only string seeds collide** (djb2 without masking). Seeds `…batch-000…199` gave 143 distinct streams out of 200; `session:r<id>` gave **127 out of 500**. | D (found during this run) | **Confirmed defect in the shared generator.** | Not changed (out of scope). Inferno derives numeric seeds instead (`deriveInfernoSeed`: FNV-1a 64 + splitmix64). The earlier simulation was rerun (see math report). |
| 12 | **Shared RNG: the first output after seeding is heavily biased.** Over 12,000 seeds the first weighted draw was only ever COAL or SMOKE (χ² = 14,897). From the 2nd draw on, χ² is 3–9 (normal). | D (`evidence/run/10-rng-first-output-bias.txt`) | **Confirmed defect in the shared generator.** | Not changed. Inferno round RNGs discard 16 warm-up draws (`createInfernoRoundRng`). Two tests keep the defect visible. |
| 13 | **Shared RNG state grows without bound** (unmasked BigInt). 1,000 cycles cost 664 ms and 20,000 cycles ran for more than 2 minutes from one RNG. | D | **Known issue** (`research/patches/ProvablyFairRNG.masked.ts` exists). | Not changed. Inferno now has one RNG per round, which bounds its lifetime. The simulator uses bounded batches. The masked proposal is only used as a labelled sensitivity run. |
| 14 | **WILD overlap.** One WILD can count in two different symbol clusters and is paid in both. | D | **Existing rule, kept.** | Documented and tested. |
| 15 | **Float payouts** (e.g. 3 × 0.35 = 1.0499999…). | D | **Defect in the ledger.** | Ledger is now integer milli-credits (exact for bet × base × multiplier). Display rounds to 2 dp only. |
| 16 | **`cascadeInferno()` with no config re-seeds from `lastSpinSeed`**, so refills repeat. | D | **Latent** (the scene always passes an RNG). | Documented only. Behaviour kept for export compatibility. |

The original 16 Inferno tests still pass unchanged, including the unlucky-Crown test. The known failure of that test under the proposed masked RNG was not investigated further and was not weakened.

## Exact rules as now implemented (`inferno-math-2`, defaults = `INFERNO_LEGACY_RULES`)

- **Adjacency:** orthogonal only. Diagonals never connect. A cluster needs at least 3 cells including WILDs. Payout = stake × base(symbol) × multiplier(size), with sizes ≥ 9 using ×25. Base payouts: EMBER 0.8, FLAME 0.5, COAL 0.35, ASH 0.25, SMOKE 0.15. Multipliers: 3:1, 4:2.5, 5:5, 6:8, 7:12, 8:18, 9:25. Weights: 1/2/3/4/5, WILD 1, SCATTER 1 (total 17). **None of these were changed.**
- **WILD:** never starts a cluster. It joins any adjacent symbol cluster and may be shared between clusters of different symbols (each paid). A WILD-only group pays nothing (legacy).
- **SCATTER:** never part of a cluster and never removed. It is counted on the grid **after each refill**. 3 or more award 5 free spins, at most once per spin (`isFreeSpinTriggered`). A free spin can retrigger (+5).
- **Survivor mapping:** within each column, non-winning cells keep top-to-bottom order and settle at the bottom. New symbols fill the top rows, drawn per column in order col 0→2 and top→bottom.
- **Heat:** +1 per cascade (also during free spins), capped at 5, and carried across spins and cycles. A spin that *starts* at 5 lands all WILD and resets heat to 0 before landing. That spin's cascades do not add heat (none can occur under legacy rules).
- **Free spins:** cost no debit and need no balance. The stake is fixed to the triggering paid spin. Each free spin is settled separately, and the cycle closes when none remain.
- **Crown:** offered when a completed spin returned > 0 and no free spins remain (in a free-spin cycle, only after the last spin). The player may collect or flip: 50% double, 50% lose everything. There is no chain limit (unchanged). COLLECT is now the primary/default button.
- **Rounding:** the ledger is in integer milli-credits. Display rounds to 0.01.
- **Completion:** a spin is complete when evaluation finds no cluster. A safety cap of 200 cascades marks a spin `unresolved` and it is reported; it was never hit in 7.7M simulated paid cycles (math report).

## Decisions requested from the owner (not made here)

| Decision | Options | Measured consequence (collect policy, production RNG, derived seeds; see math report) |
|---|---|---|
| **A. All-WILD Inferno Spin payout** | (a) keep 0 (current); (b) WILD-only group pays as EMBER (`pays-as-top-symbol`); (c) dedicated value or retuned heat | (a) Inferno Spins occur in ~22.7% of paid cycles and each returns **0**, a "reward" that is guaranteed to pay nothing. (b) RTP becomes about **598%** (5.98× the stake): not viable without retuning heat speed or the payout. A product decision is required; (c) needs a new value plus retuning. |
| **B. Scatter without a cluster** | (a) keep "after cascade only" (current); (b) `any-landed-board` | (b) raises RTP by about 4.4 percentage points (90.8% → 95.1%, 400k cycles). |
| **C. RTP target** | 96% claim vs measured | The current game measures **90.8% (95% CI 90.5–91.0%)**, not 96%. Any fix (A or B) changes RTP. Retuning is outside this run. |
| **D. Crown chain limit** | keep unlimited (current) vs cap | It is EV-neutral in expectation but raises variance; the bounded flip-up-to-3 analysis policy shows the spread. No cap was added. |
| **E. Shared RNG** | adopt the masked proposal plus a seed mixer and warm-up for all games | Fixes findings 11–13 globally, but changes every game's seeded outcomes. It needs its own reviewed PR. |

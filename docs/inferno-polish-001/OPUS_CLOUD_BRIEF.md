# INFERNO-POLISH-001 — bounded research and playable polish pilot

## Assignment and boundaries

Repository: `zero-934/jett-game`. Handoff branch: `research/inferno-polish-001`. Create an implementation branch `fix/inferno-polish-001` from this handoff, or an equivalent named feature branch if that name is already in use. Record actual base SHA before work. Do not reset existing implementation work.

Goal: make **Inferno**, the prospective fourth studio title, a more enjoyable, understandable and polished mobile demo. Preserve its existing 3×3 cluster/cascade identity. Deliver a researched, tested **base-spin → winning cluster → cascade → final result** segment, plus controlled visual/audio demonstrations of existing features. Do not build an entirely new slot, turn it into a crash game or extend the other three games.

Read the repository's AGENTS.md first, completing its startup checks without discarding local work. Keep Phaser 4 + TypeScript, Logic/UI/Scene separation and existing public exports. Confirm actual installed engine APIs against local package source/types. No engine upgrade, slot-engine migration or new runtime animation/audio framework in this assignment.

This is a research/build assignment for Opus cloud, explicitly requested by the owner. It is not a requirement to invoke another paid model/API. Work headlessly where possible. No wallet, real-money integration, blockchain, tokens, bonus buy, paid auto-bet, new game, licensing implementation, incorporation research or supplier outreach. Credits remain non-redeemable demo credits. Do not push to main, merge, publish, trigger deploy.yml or change production deployment. A named review branch is allowed; if push is denied, preserve commits and report the denial without alternate credentials or workarounds.

**No Kuro Director changes.** Do not attach/edit `kuro-core`, create graph pages or attempt to republish the previously denied Director branch. The prior Director work is separate, unreviewed here and based on a copied workspace. At most include a short plain-text summary suitable for a later graph import. Do not spend this run chasing ephemeral scratchpad files; preserve any available earlier reports as provisional evidence and reproduce material claims against the real game.

## Files and existing interfaces to inspect

| File | Role |
|---|---|
| `src/games/InfernoLogic.ts` | Pure TS grid generation, clusters, cascades, heat, free spins, Crown Flip and simulator |
| `src/games/InfernoUI.ts` | Rendering, SlotAnimator use, input, heat effects, modal and audio calls |
| `src/scenes/InfernoScene.ts` | Round flow, balance/stake, RNG lifetime and scene lifecycle |
| `src/tests/InfernoLogic.test.ts` | Existing16 tests; not proof of complete feature/RTP correctness |
| `src/shared/slot-engine/SlotAnimator.ts` | Existing shared reel/flash/win presentation; used by other slots |
| `src/shared/audio/CasinoAudioManager.ts`, `audioConfig.ts` | Existing Web Audio service and musical configuration |
| `src/shared/ui/UITheme.ts`, `GameHeader.ts`, `GameFooter.ts` | Existing visual/control primitives; assess reuse before replacement |
| `src/shared/rng/ProvablyFairRNG.ts` | Current gameplay RNG and known masking problem |
| `research/patches/ProvablyFairRNG.masked.ts`, `research/jest.masked-rng.cjs` | Review-only RNG proposal and isolated experiment config |
| `docs/polish-003/VISUAL_REVISION_004.md` | Owner-approved studio style; do not reskin the other games |
| `docs/polish-003/BUILD_CONTRACT.md`, `docs/polish-002/RISK_REGISTER.md` | Cross-game RNG, demo, cleanup and settlement constraints |

Preserve these existing Logic exports and argument shapes:

```ts
createInfernoState(bet: number): InfernoState
spinInferno(state: InfernoState, config?: InfernoConfig): InfernoState
evaluateClusters(state: InfernoState): InfernoState
cascadeInferno(state: InfernoState, config?: InfernoConfig): InfernoState
flipCrown(state: InfernoState, config?: InfernoConfig): InfernoState
walkCrown(state: InfernoState): InfernoState
simulateInfernoRTP(rounds: number, bet: number, config?: InfernoConfig): number

export interface InfernoConfig {
  rng?: ProvablyFairRNG;
}
```

Inspect the full current interfaces rather than inventing a replacement RNG callback type. Relevant state includes `grid`, `heatMeter`, `totalWin`, `cascadeCount`, `clusters`, `isInfernoSpin`, `isInCrownFlip`, `crownFlipWin`, `crownFlipChain`, `freeSpinsRemaining`, `scatterCount`, `isFreeSpinTriggered`, `isComplete` and `lastSpinSeed`. No Phaser import in Logic. UI must not decide payouts or outcomes. Named constants and documented public functions; no unexplained `any`. Use `drawButton()`'s returned `bg` for input, never interactive Text/Container. Preserve relevant asset registry conventions.

## Starting evidence — verified for this brief

Baseline production source is still `616fd82`; this handoff's inherited changes are research/docs only. Locally rerun: **16/16 Inferno tests pass**,7.288s, and `npm run build` passes. Logs/JSON are under this folder's `evidence/`. No browser/audio/device test was performed for this brief. A passing baseline does not establish fairness or commercial readiness.

Two direct pure-logic probes were executed against production exports:

- A nine-WILD board evaluates to **zero clusters and zero return**. `spinInferno()` creates that board when heat reaches5. The intended all-WILD payout needs a product/math decision; do not invent a high-value payout as an art fix.
- A board containing three SCATTERs and no paying cluster has `scatterCount:3`, but awards **zero free spins**; `cascadeInferno()` immediately completes it. Current scene flow also bypasses cascade when no cluster exists. Confirm the intended scatter rule and reproduce the complete UI path.

Additional **source observations to reproduce**, not completed browser findings:

1. `simulateInfernoRTP()` creates fresh state and declares the simulated heat/free-spin counters inside its round loop; it does not demonstrate a complete persistent feature cycle. Existing RTP test title mentions10,000 rounds, code runs2,000, and acceptance bounds are0.3–3.0. No96% claim is substantiated by that test.
2. Scene `handleSpin()` unconditionally deducts the stake; the free-spin continuation calls the same handler. Reproduce whether a supposedly free spin is charged and whether insufficient balance blocks an awarded feature.
3. Cascade collection traverses surviving cells bottom-to-top before concatenating the refill. Verify survivors retain correct top-to-bottom order, including separated survivors and multiple removed rows.
4. UI calls outcome audio using accumulated `totalWin` during cascades, before the eventual Crown result is known. This can misrepresent intermediate returns as settled profit.
5. Repeated heat updates add infinite tweens; repeated Crown `show...()` calls add `.once()` handlers for both actions. Check whether unchosen handlers accumulate and whether stale callbacks settle more than once.
6. UI owns `new CasinoAudioManager()` but its `destroy()` does not visibly destroy that manager. Check actual context/node/timer cleanup and shutdown subscription.
7. Shared RNG masking correction changes seeded outcomes; existing Inferno unlucky-Crown test is known to fail with the proposed corrected generator. Do not weaken/drop it or silently replace global RNG in this game-specific run.

## Bounded workflow

### A. Baseline and decisions before major changes

Record SHA, branch, installed Node/Phaser versions, dependencies, tests/build and browser backend/DPR. Run Inferno first; list broader suite constraints and relevant shared consumers. Capture actual ready, normal spin, cascade, heat, scatter/free-spin, Crown collect/loss and result states when reachable. Use clearly marked developer fixtures for rare states; never call a forced fixture a naturally sampled outcome.

Reproduce the observations above with small exact tests. Classify each as confirmed bug, unresolved design rule or rejected finding. Distinguish direct runtime evidence, source inference, secondary research and untested hypothesis. Do not reconstruct the game in Python and present that as the production engine's RTP.

Make necessary correctness fixes within Inferno when the intended rule is unambiguous (for example, exactly-once settlement, preventing a free-spin debit, preserving survivor order). Document before/after behaviour and tests. **Do not retune symbol weights, paytable, WILD allocation, heat reward, Crown odds, caps, retrigger rules or default RTP without an explicit reviewed decision.** Correcting a bug can change returns: version and measure it.

If all-WILD/feature semantics are unresolved, continue the independent base-cascade art/audio pilot and present options with consequences. Keep disputed features labelled unverified in developer/demo reporting; do not remove them, call them fixed or choose a payout to unblock a screenshot. Do not block all useful work on that one decision.

### B. Focused reference research — four titles, four studios maximum

Use these primary starting pages:

- [Play'n GO Fire Joker](https://www.playngo.com/games/fire-joker): compact presentation and readable symbols.
- [Pragmatic Play Gates of Olympus](https://www.pragmaticplay.com/en/games/gates-of-olympus/): tumble sequence clarity and separation of base/feature results. Its pay-anywhere rules differ from Inferno's adjacency clusters.
- [Hacksaw Gaming Le Bandit](https://www.hacksawgaming.com/games/le-bandit): clean character/symbol hierarchy and cascade feedback.
- [Nolimit City Fire in the Hole](https://nolimitcity.com/games/fire-in-the-hole): coherent sound/material vocabulary and feature communication; not a volatility/complexity template to copy.

Limit research to **one focused pass, roughly60–90 minutes**. Record source date/title/version. Where accessible, observe two legal non-redeemable demos or official gameplay videos, recording timestamps for reel stop, win identification, removal, fall, feature intro and result. Do not bypass age gates, logins, security warnings or access restrictions, and do not wager real funds. If access/audio is unavailable, record that and use official material; no fabricated first-hand observations or success metrics. Do not copy artwork, sounds, proprietary mechanics or claimed competitor RTP into Inferno.

Extract a small comparison table: hierarchy, pacing, visual readability, neutral/loss/win distinction, audio layers, motion/skip controls and mobile weaknesses. End with **five concrete patterns to adopt and five to avoid**, tied to Inferno. No second market-wide research project, psychology essay, claim of increased spending/retention or use of near-miss manipulation.

### C. Verify Phaser APIs with a small executable probe

Official starting references: [tweens](https://docs.phaser.io/phaser/concepts/tweens), [particles](https://docs.phaser.io/phaser/concepts/gameobjects/particles), [audio](https://docs.phaser.io/phaser/concepts/audio). Generic documentation alone does not prove compatibility with the installed package.

Before integration, verify locally: tween completion/cancellation, emitter pooling/destruction, Web Audio unlock/suspend/resume, and shutdown ownership. Report tested package version and source/type references. Use current SlotAnimator/Phaser capabilities first. Prefer an Inferno-local adapter/config extension; shared public behaviour must stay backward compatible and have relevant consumer regression tests. Do not port the game to the shared SlotEngineLogic just because it exists.

### D. Build one complete polished segment

**Visual direction: Refined2D Ember Workshop.** Same premium charcoal/slate shell and muted casino accent as the three approved games, with a restrained warm charcoal forge identity inside Inferno. Simple dark furnace/brick silhouettes or straight structural ribs, a small warm glow below the board, clean reusable symbols. No cinematic painted lava cave, photoreal flames, neon overload or ornate gold frame. Heat/fire colour is semantic; casino accent is themeable. Keep stake/result labels legible independently of theme.

Keep the3×3 grid. Replace platform-dependent emoji rendering with a consistent small original/generated/licensed symbol atlas or deterministic code-drawn textures. Retain the seven symbol identities: EMBER, FLAME, COAL, ASH, SMOKE, WILD, SCATTER. Distinguish ASH/SMOKE and EMBER/FLAME by silhouette/icon as well as colour. Wild/scatter must read clearly on small mobile screens. No new feature character is needed. Source and license manifest required for any added asset.

Mobile reference390×844; test320/390/430 widths plus landscape. Use the existing shared header/footer conventions where compatible,44px minimum controls, at least11px secondary text, readable contrast and safe-area insets. Grid approximately300–336px wide, centered below a five-segment heat meter; bottom controls remain outside the grid with stake, round return, net result, SPIN and settings. Inferno's main action is **SPIN**, not a copied cash-out button. Preserve themeability without changing mathematics.

Suggested animation target ranges, all named constants and tunable after capture:

| Phase | Target | Required behaviour |
|---|---:|---|
| Press feedback |0–80ms| Immediate visual acknowledgement; accept one spin and lock debit/stake changes |
| Reel entry/stop |650–900ms total| Compact travel, staggered stop about60–90ms between columns; correct final symbols |
| Identify paying cluster |120–180ms| Thin outline/shape cue and subtle pulse; never animate a non-winning group as a win |
| Remove matched symbols |100–160ms| Short ember dissolve/pop, not a white screen flash |
| Survivors fall/refill |180–260ms| Animate actual old→new cell mapping, no teleport/column reversal |
| Settle |60–100ms| Small overshoot, then next authoritative evaluation |
| Final return |250–450ms| Readable total and net; one settlement; skip count-up without changing amount |
| Heat increment |150–220ms| Update changed segments once; no stacked perpetual tweens |

Use the pre-removal winning coordinates and separate before/after snapshots. Animating only the post-cascade grid is insufficient. A small Inferno-local presentation event/snapshot type may live in `InfernoLogic.ts` if needed; renderer consumes it and never generates outcomes. Any new public type/export must be documented and preserve existing exports.

Represent round phases explicitly: ready → spinning → evaluating → removing → falling → feature/decision pending → settling → ready. Guard accepted input, callbacks and ledger by round ID. Animations are presentation; changing frame rate, speed/skip, reduced motion or audio must not change RNG consumption, grid sequence or payout. Cosmetic RNG must be separate. Cancel old callbacks on shutdown; no unresolved completion promises or double callback paths.

Bonus/heat/Crown visual demonstrations may use explicit fixtures after rules are characterised. Do not expand this pilot into a complete new bonus game. Keep Crown optional, show the amount at risk and collect action clearly, lock during a flip and prevent default risky selection. Do not remove/replace Crown, add a new gamble feature or introduce an arbitrary chain limit without a decision. Do not confuse a spin's gross return with net profit.

### E. Audio pilot — one short loop and a small cue set

Reuse the existing service where it is safe; if Inferno needs different cues, prefer a local profile/adapter. No second global audio engine and no new AudioContext per spin. Existing procedural sound is acceptable for the pilot; pre-baked original audio is also acceptable. Do not assume every sound has to be AI-generated.

Music direction: quiet warm forge pulse, sparse percussion/soft plucks and gentle low ambience, approximately84–96 BPM, one seamless12–20 second loop. Music and SFX independently adjustable/mutable; optional audio only after a valid gesture. User settings persist. A short phrase is enough; do not compose a soundtrack album.

| Event | Cue direction | Policy |
|---|---|---|
| Button/start | Short dry click, soft reel movement | Immediate, quiet, no profit implication |
| Reel stop | Three related muted taps | No piercing slot-machine bell |
| Cluster removal | Soft ember pop/crackle | Neutral mechanical feedback, no victory fanfare |
| Cascade landing | Soft descending/settling taps | Short tail; avoid stacking/volume escalation |
| Heat tick | Small warm tick | Reflect actual meter change; not a manufactured near miss |
| Feature granted | Brief distinct notification | Only when award is authoritative; not a settled-profit celebration |
| Crown resolution | Short outcome cue | Loss neutral/subdued; no repeated collected-win celebration |
| Final net profit | One brief restrained positive motif | Only after final settlement when total returned > original paid stake for that complete paid cycle |
| Break-even / partial / zero return | Neutral or subdued resolution | Never call a sub-stake return a win or play a win fanfare |

If Crown/free spins are pending, intermediate cascades use neutral cues even when the provisional total exceeds the stake. Track the full paid cycle; a free spin's zero local debit is not permission to celebrate every small return as profit. Prevent clipping/voice buildup with gain limits, small polyphony cap, short fades and music ducking. Proposed export ceiling≤−1dBTP where tooling supports measuring it; record actual measurements rather than claiming a loudness standard is mandatory.

Use Phaser built-ins and Web Audio first; optional offline tools: Audacity/ffmpeg. Prefer clearly licensed tools/assets. Do not depend on Aseprite, Vital or REAPER until official licence/eligibility terms are checked. Maintain `public/assets/inferno/ASSET_SOURCES.md` with source, author, license/terms, modifications and generated-asset provenance. No commercial competitor samples.

Deliver the loop, cue files or deterministic generators, a labelled WAV/MP3 audition reel if feasible, and browser unlock/mute/restart evidence. If you cannot listen, say **rendered but not auditioned**; provide files for review and do not describe subjective audio quality as verified. If headless audio capture is unavailable, don't pretend a silent screen recording proves sound works.

## Fairness, simulation and reporting contract

Do not market certified fairness, provable fairness or96% RTP from comments or a broad unit test. Seeded determinism, secure seeding, return mathematics and independent certification are separate claims. For this demo use no direct `Math.random()` for gameplay. Future server wagering would need CSPRNG seed generation, server-authoritative settlement and a reviewed verification protocol; none is implemented here.

Write down exact rules for adjacency, WILD use/overlap, scatter evaluation points, survivor mapping, heat carry/reset, free-spin debit/retriggers, Crown eligibility/odds/collect, rounding and feature completion. Record ambiguous rules before choosing an interpretation. Test repeated `evaluateClusters()` calls against duplicate credit; either make transition handling idempotent or enforce and test a single authoritative transition.

Correct simulator coverage or add a clearly named richer research runner while preserving the public function. The simulation must call real production Logic functions, carry heat and awarded features correctly, count only paid stakes in its denominator, drain legitimately awarded feature cycles, and state its Crown policy. Report separately: collect immediately, exactly one optional flip, and a bounded policy used for analysis. Do not imply a bounded simulation policy changes the game's allowed rules. Avoid unbounded flip loops. Detect overflow/nonfinite state.

Use staged runtime: deterministic fixtures first; a small pilot to estimate cost; then a **maximum five-minute bulk run by default**. Initial target at least10,000 paid entries where feasible; scale toward100,000 only if runtime/model validity allows. More spins are not a substitute for a correct model. If incomplete/ambiguous features prevent a valid full-cycle calculation, label results partial and list missing terms. Do not silently truncate a long cascade/bonus and count it as zero: count unresolved episodes, capture seeds and fail/report the run.

Report seeds/PRNG version, config/paytable hash, code SHA, paid cycles, feature spins, total paid stake, gross return, RTP estimate, hit frequency, below-stake/break-even/profit rates, cascade distribution, heat/bonus frequency, maximum **observed** payout and unresolved cases. Separate observed maximum from theoretical maximum; neither estimates rare-event risk alone. Keep gross return and net change separate.

For uncertainty use independent seeded session batches or another dependence-aware method that accounts for stateful features. Document burn-in/initial-state handling and method; do not apply an independent-spin CI to dependent free-spin/cascade observations. Prefer at least20 independent batches before presenting an approximate95% interval; if runtime/data is insufficient, report that. No numeric RTP promise or target fit is accepted by simply widening test bounds.

Commit scripts, raw per-batch aggregates/CSV or JSON, sample replay traces and readable report. Avoid enormous per-spin dumps: include a bounded representative sample and failing seeds. No source secrets, real account data, session tokens or private chat logs.

## Tests and verification

| Area | Required evidence |
|---|---|
| Core logic | Exact fixture payouts, horizontal/vertical adjacency, diagonal non-match, WILD-only/bridge/overlap cases, scatters without paying cluster, scatter retrigger rule, stable survivor order, heat threshold/reset |
| Ledger/features | One debit per paid start, zero debit for awarded free spins, no balance prerequisite for a free award, fixed stake over its award cycle, one credit per result, Crown win/loss/collect and repeated callbacks, stake/amount rounding |
| Determinism | Same versioned seed/state/actions → same grids/returns; checkpoint restore;30/60/120/144Hz presentation and reduced-motion/skip/audio toggles don't affect outcome |
| Animation/input | Actual old→new cell positions, one completion per phase, no stuck UI after skip/blur, fast double-tap/held Space, locked bet changes during paid/free/decision phases |
| Lifecycle |50 restart/scene-entry cycles; exit during spin/cascade/Crown/result; no accumulating modal listeners, heat tweens, audio contexts/nodes, particles or delayed callbacks |
| Browser/audio | First-gesture unlock, resume/rejected resume handling, muted loading, independent toggles, visibility suspend/resume, screenshot states and honest audio verification status |
| Shared regression | Inferno plus affected SlotAnimator/audio consumers; all normal suites before declaring shared changes safe. Known RNG failures stay visible; no unrelated game redesign. |

Useful test files may be added under `src/tests/` with descriptive Inferno names, retaining the existing Logic suite. Browser harness/probes and simulation scripts may live under `research/inferno/`. Keep experimental forced outcomes behind developer-only harness code, excluded from public gameplay; regular outcomes must remain real. No backdoor guaranteed-win seed UI on the public demo.

Performance: record actual baseline/after p50/p95 frame time, long frames, object/tween/emitter counts, active audio contexts and texture memory estimate for idle/spin/cascade. Cap active ember particles at about24 for the whole board, cache background, avoid permanent filter chains, allocate one atlas at a sensible mobile size. A60fps goal is a target, not a result. Report device/CPU/WebGL backend/browser/DPR. Software-WebGL and CPU throttling are comparison environments, not Android/iPhone benchmarks. Real Android/Safari audition/performance remains a later review gate if unavailable.

## Deliverables and stopping point

Keep the reporting focused. Deliver these five documents in `docs/inferno-polish-001/`, plus source, tests, assets and evidence:

1. `BASELINE_AND_DECISIONS.md`: verified source/state, original versus new failures, confirmed defects and proposed rule decisions.
2. `REFERENCE_AND_API_RESEARCH.md`: four-title comparison, sources/timestamps, five adopt/avoid patterns, actually tested installed Phaser APIs and asset/tool licenses.
3. `ART_AUDIO_AND_TIMING.md`: chosen forge treatment, symbol sheet, one keyframe board, cue list, timing table and accessibility alternatives.
4. `MATH_AND_TEST_REPORT.md`: production-based simulator method, raw-data links, assumptions/uncertainty, tests and unresolved fairness risks.
5. `IMPLEMENTATION_REPORT.md`: exact diffs/commits, before/after actual captures, short gameplay recording, audio preview/status, performance table, remaining decisions and next bounded milestone.

Persist all outputs to the repository before the session ends. Do not leave deliverables only under `/tmp`, a scratchpad or an unpushed cloud filesystem. Commit a small `review-artifacts/` folder of PNGs and short audio samples that a second account can open. If large video is unsuitable for Git, provide a durable authorised attachment and exact provenance; screenshots and an event timeline remain required. If push is blocked, report exact local commits and provide an authorised downloadable patch/artifact when available, without bypassing the denial. Do not claim the local cloud branch is on GitHub.

Suggested reviewable commits: (1) baseline/tests, (2) narrowly scoped correctness fixes, (3) art/animation pilot, (4) audio/settings/lifecycle, (5) final evidence/report. One game per implementation PR; any necessary shared change stays separately reviewable. Attach a created PR using the available app tooling where supported. Never merge it.

**Stop after one polished, end-to-end base-cascade segment, controlled existing-feature demonstrations and the evidence package.** No additional games, broad casino website, full soundtrack, extensive bonus redesign, engine upgrade or Kuro graph work. Present unresolved mathematical choices rather than extending scope to decide them silently. Website/studio packaging comes later using verified material from this run; do not start supplier outreach.

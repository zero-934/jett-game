# Engineering contract and implementation order

This is a review/build brief, not authorization to merge or deploy. Keep three-file game boundaries: pure `*Logic.ts`, Phaser `*UI.ts`, wiring `*Scene.ts`. Shared runner, RNG, input/theme/audio utilities may live in `src/shared/`. Preserve public exports and all unrelated games. No Doom Crash changes. No wallet, real-money rail, crypto, tokens, NFT implementation, new casino games or licensing system.

## Evidence and patch handling

The research commit is already in this branch. Start with `docs/polish-002/EXECUTIVE_REVIEW.md`, `RISK_REGISTER.md`, `IMPLEMENTATION_BACKLOG.md`, then `research/characterization/`. Both files under `research/patches/` are proposals. Review them before promotion; passing research tests is not production integration.

In particular the proposed runner defaults to **16 ms**, preserving nominal62.5 Hz. Its maximum8 catch-up ticks means a500 ms hitch can **drop time**. It does not prove identical wall-clock progression through arbitrary hitches. Keep replay equality by tick and separately specify the time debt/pause policy. Never claim hitch invariance based on the small runner tests alone.

## Priorities and review boundaries

| Order | Change | Deliverable and boundary |
|---|---|---|
| 1 | Trust/test gate | Remove unsupported numeric RTP claims; correct misleading test titles without weakening assertions. Add a non-deploying test workflow for branches/PRs. Do not trigger or change existing production deployment without approval. |
| 2 | Shared RNG | Correct bounded64-bit state, add versioned known vectors/state roundtrip/range tests; regression-test all games, including Inferno and Surge. Separate reviewable shared fix. |
| 3 | Flap timing/input pilot | Promote reviewed runner, deterministic queued edge inputs and replay, remove per-tick drawing, render/interpolate per frame. Correct start/hold/quick-tap behaviour. |
| 4 | Jett correctness | Exactly-once cash-out; input isolation; deterministic coins; swept collision; cleanup/audio ownership. Same runner/replay contract, separate game review. |
| 5 | Shatter truth | Precommitted safe side per row; actual picked side tested; truthful reveal and exactly-once settlement. Keep current payout schedule pending economics decision. |
| 6 | Shared shell/sharpness | HUD/results/settings/safe areas, loaded fonts, remove forced pixelated scaling, verify actual Phaser4 resolution API. Narrow shared change with all-scene smoke test. |
| 7 | Art pilot | Implement the three representative segments in ART_AND_LAYOUT.md. Compare actual browser captures with committed references; profile on mobile before expanding. |

Avoid bundling the engine upgrade with physics fixes. Verify installed engine/version/API and compatibility before proposing an upgrade; the old research's registry version is not permission to upgrade. Do not run `npm audit fix --force`. Review dev-tool advisories separately; build warning and bundle splitting remain a measured follow-up.

## Replay and simulation

- Simulation uses a fixed integer tick index, with no frame-dependent outcomes. Preserve the current nominal tick duration initially; changing from16 to16.6667 ms needs explicit pace/physics acceptance.
- Frame update feeds real elapsed time into a reviewed accumulator; simulation happens only in tick steps, drawing only once per render frame. Interpolate prior/current visual positions on120/144 Hz; interpolation never affects collision or RNG.
- Define a bounded work policy explicitly: retain catch-up debt for ordinary foreground hitches, process at most8 ticks/frame, or pause with an explicit resume boundary when the debt exceeds an agreed maximum. Do not silently cap every incoming delta to16 ms or discard elapsed time while claiming correct30 Hz speed. On visibility loss, pause input/simulation and discard/resynchronise wall-clock debt at a recorded resume boundary. Do not attempt hours of background catch-up.
- Replay header: schema version, game/config version, RNG algorithm version, canonical initial seed/state, tick duration, immutable config. Events: integer tick, monotonically increasing sequence, typed action and canonical values. End: settlement reason/tick/amount and canonical state hash. Save/restore RNG and simulation state for checkpoints. Never include a future server secret in a client replay.
- Live inputs enter at the next unsimulated tick. For deterministic comparisons use the same tick-indexed input log across frame schedules; different browser sampling times are not the same test. Keep pointer down/up edges even when both happen between ticks. Do not reconstruct RNG from `Math.random()`, browser time or cosmetic events.
- Cosmetic particles, sound and shake use a separate stream and cannot change gameplay RNG call counts. Remove gameplay RNG from UI/Scene. Fixed RNG state is **not** secure randomness and the class name `ProvablyFairRNG` proves no fairness protocol.
- Future server design: cryptographically secure seed/nonce generation with OS CSPRNG (`crypto.randomBytes` on server or suitable Web Crypto for local demo seed generation), server-authoritative outcomes, reviewed commitment/verification protocol and immutable configuration. No wagering server or cryptographic fairness claim is implemented in this milestone.

## Proposed defaults versus owner decisions

Implement unambiguous correctness fixes. Document these choices in each PR. Do not retune economics silently.

| Audit decision | Proposed handling for this demo milestone |
|---|---|
| D1: Jett starts below1× | Preserve payout math. Show the actual return and negative net when applicable; no celebratory sound. Cash-out only after playing starts. Do not clamp to1× or hide the loss. |
| D2: Shatter maximum72.75% | Preserve1.5×/row schedule for now, remove96–97% claim, document the actual model. A redesigned payout schedule requires an explicit separate approval and strategy-level analysis. |
| D3: skill RTP | Remove numeric RTP marketing from Jett/Flap; report results by strategy and failure rate. Perfect-play upper bounds are not measured player RTP. |
| D4: Jett tunnelling | Prefer swept collision between old/new positions instead of adding a new speed cap. Define exact tangency (propose contact counts as a hit); test both sides of boundary with an explicit epsilon policy. |
| D5: duplicate asteroid bands | First retain current density while making it deterministic. Propose unique-band spawning separately, with before/after encounter distribution and tests; do not bundle a difficulty change into art. |
| D6: same-tick cash-out/crash | Proposed order: validate queued actions against state at tick start; valid cash-out settles before advancing hazards; otherwise simulate collision. Dead at tick start rejects cash-out. Test/document exact order; do not use callback race order. |
| D7: Inferno/Surge seed tests | Keep legacy algorithm available under a version identifier if old replays require it. For corrected generator, review seeded tests' intended invariant and new known vectors; never blindly update expected numbers or exclude failing suites. Owner/reviewer must accept any changed seeded outcomes before integration. |

The previous report's seed-pinned failures are a cross-game risk, not grounds to rewrite Inferno/Surge mechanics. If a decision blocks one workstream, finish independent scoped fixes and present the precise question with evidence.

## Cash-out, input and lifecycle contract

Only a playing/alive/unsettled round can accept cash-out. Shatter requires at least one completed row. Return a single immutable settlement result; repeated calls cannot pay or transition twice. Round IDs guard delayed callbacks from earlier rounds. One demo ledger owner debits on start and credits on settlement, in integer hundredths. Settlement logic belongs in Logic/shared pure model, not in button code. A result overlay opening is not a second payment.

Input regions are exclusive. Footer/HUD/settings/back cannot steer, flap or choose panes; stage pointers cannot activate controls. Test pointer capture, dragging out of stage, multitouch, touch+synthetic mouse, keyboard repeat, blur, cancel and modal focus. Clear held input on blur/shutdown. One accepted start on simultaneous Space/tap. One flap per accepted press edge; no autohold. Current Shatter row locks immediately when a pick is accepted.

Subscribe to Phaser shutdown/destroy events; a method named `shutdown()` alone is insufficient. Start/stop are idempotent. Remove registered event handlers, timers, resize/visibility hooks, tweens and particles owned by the scene. Cancel delayed results and old-round sounds. Use one app-owned audio service/context or a clearly owned scene service, resume after user gesture and release nodes on shutdown. Fifty restarts must keep listeners/timers/objects/context counts flat. Do not infer audio cleanup from heap alone.

## Acceptance matrix

| Area | Required automated proof |
|---|---|
| Replay | Identical final canonical state/RNG/settlement under30/60/120/144 Hz and jitter for the same tick log; checkpoint restore; version mismatch rejection; render effects on/off unchanged |
| Timing | Foreground30 Hz real-time pace matches60 Hz;120/144 Hz interpolation;500 ms hitch follows documented debt policy; visibility pause/resume is deterministic and clears stale input |
| Input | Down/up within one tick retained; Space starts Flap and first flap; held key one edge; cash-out never steers/flaps; pointercancel/multitouch/blur/modal cases |
| Settlement | Prestart/postloss rejected, repeated same-tick requests idempotent, one debit/credit per round, same-tick collision rule, sub1× net loss, Shatter row0 disallowed and final-row auto-settlement |
| Collisions | Jett fast swipe through asteroid, exact tangency and epsilon neighbours; Flap exact gap/body/pipe edges, render bounds match collision overlay; unchanged world/pipe pitch |
| Shatter | Predetermined board same after replay; choosing left/right actually selects respective pane; losing pane never revealed safe; RNG output in[0,1); result reveal consumes no gameplay RNG |
| Restart |50 round cycles per game, repeated start/stop, switch scene during break/result, no ghost callbacks/input; timers/listeners/objects/audio contexts bounded |
| Render/accessibility |320/390/430 px portrait + landscape; DPR1/2/3; focus labels and keyboard access; reduced motion/high contrast; safe insets; CTA always visible; no visual/physics drift |

Promote useful research tests into the maintained test suite and CI. Characterization tests that assert a known bug must be rewritten into corrected regression expectations, not copied unchanged. Add meaningful browser integration tests for UI routing and lifecycle, rather than tests that only call a helper in isolation. Keep production feature fixtures independent of the static SVG generator.

## Performance and review output

Baseline software-WebGL results in polish-002 are comparisons only: Jett60 fps (30 at4× CPU throttle), Shatter idle47.7 (23.7 at4×). They are not phone measurements. Target a stable60 fps on an agreed midrange mobile; no numerical performance improvement claim until measured. Report p50/p95 frame time, long frames, draw calls, texture/backing-store memory and CPU profile for idle/active/glass-break. Test at30 Hz as correctness too. Budget glass to≤20 particles; bake tile backgrounds, cache static board layers and update only changed panes. Idle board should not redraw all glass every tick.

At review provide actual before/after gameplay captures with matching viewport/device/seed, measured results with hardware/browser/WebGL backend/DPR, complete test commands/results, changed mechanics and outstanding risks. Run all normal suites after shared changes; the masked BallDrop experiment is not a whole-suite pass. Review real Android Chrome and iPhone Safari before commercial-demo sign-off. If cloud lacks devices/GPU, mark those checks unverified and provide reproducible instructions; do not fabricate benchmarks or screenshots.

One shared prerequisite branch/PR where needed, then one game per implementation PR. No direct main push, merge, deployment trigger or production configuration edits. Commit source assets and license notices, not dependencies, generated dist or secrets.

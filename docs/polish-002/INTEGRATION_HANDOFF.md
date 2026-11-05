# JETT-POLISH-002 — Integration Handoff (for Codex)

## Checkout used
- `zero-934/jett-game` `main` @ `616fd82b5a5552ad0ae26a9dbaddb78213d0f96f`
- Research branch: `research/jett-polish-002`, committed locally and **not pushed**. Push access to this repo was not attached in the research session.
- **No production file was modified.** `git diff main -- src index.html package.json package-lock.json .github` is empty.

## What is on the branch

```
docs/polish-002/
  EXECUTIVE_REVIEW.md            ← start here
  CAPABILITIES_AND_BASELINE.md
  TOOL_AND_ASSET_RESEARCH.md
  VISUAL_DIRECTIONS.md
  RISK_REGISTER.md
  ENGINEERING_SPEC.md
  TEST_AND_BENCHMARK_REPORT.md
  IMPLEMENTATION_BACKLOG.md
  INTEGRATION_HANDOFF.md         ← this file
  logs/        build, audit, per-suite durations (baseline + masked RNG), characterization results, EV curves, registry metadata
  evidence/    browser JSON results + screenshots (current-state, not mockups)
  mockups/     direction-A-midnight-luxury.png, direction-B-illustrated-night.png (PROPOSALS)
research/
  jest.research.cjs              ← runs characterization + probes (not part of npm test)
  jest.masked-rng.cjs            ← runs EXISTING suites with the proposed RNG substituted
  tsconfig.research.json
  characterization/*.char.test.ts   (36 tests incl. probes, all pass on current code)
  probes/rng-growth.probe.ts, skill-ev.probe.ts
  probes/browser-env.cjs, browser-dynamics.cjs, render-mockups.cjs
  harness/index.html, harness-main.ts   ← boots unmodified scenes, exposes window.__game
  patches/ProvablyFairRNG.masked.ts      ← PROPOSED drop-in RNG v2 (review-only)
  patches/FixedStepRunner.ts             ← PROPOSED fixed-step runner (review-only)
  mockups/directions.html
```

`research/` sits outside `tsconfig.json` `include` and outside `jest.config.cjs` `testMatch`, so it affects neither `npm run build` nor `npm test`. Both were verified after adding it. Delete `research/` at any time without consequence.

## How to reproduce

```bash
npm ci
npm run build
npx jest --config research/jest.research.cjs                 # 36/36
npx jest --config research/jest.masked-rng.cjs src/tests/BallDropLogic.test.ts   # 2.9 s instead of >120 s
npx vite --port 5199 --strictPort &                          # harness server
node research/probes/browser-env.cjs
node research/probes/browser-dynamics.cjs pacing|flap|jett|shatter|restarts|perf
node research/probes/render-mockups.cjs
```

Playwright: the research session used a preinstalled 1.63.0 plus Chromium. Elsewhere, `npm i -D @playwright/test@<pinned>` and `npx playwright install chromium`.

## Isolated patches ready for review (not applied)

| Patch | Replaces | Status | Integrate as |
|---|---|---|---|
| `research/patches/ProvablyFairRNG.masked.ts` | `src/shared/rng/ProvablyFairRNG.ts` | Passes all existing suites except Inferno #8 and Surge #6 (seed-pinned); adds `getState`/`setState` | Backlog B-01, after decision D-7 |
| `research/patches/FixedStepRunner.ts` | new `src/shared/sim/FixedStepRunner.ts` | 6/6 tests with the current Flap logic | Backlog B-20 |

## Integration order (recommended)

1. **B-00 + B-01 + B-03**: CI test gate, RNG v2, honest RTP test names.
   - *Shared.* Run the full suite (expect < 60 s) and smoke all 13 scenes in the harness: add the missing scenes to `harness-main.ts`, or use `?scene=` deep links with `sessionStorage.jg_auth='ok'` on the dev server.
   - Resolve D-7 first.
2. **B-02**: promote stable characterization tests.
3. **Per-game isolated fixes, in any order** (each one independent):
   - Jett: B-10, B-15, B-17 (Jett part), B-14 if done with `this.sound`
   - Flap: B-16, B-17 (Flap part)
   - Shatter: B-18 (needs D-2 only if economics change; the truthful reveal alone does not)
   - All three: B-11, B-12, B-13, B-19
4. **B-20 / B-21**: fixed-step runner, input log, replay.
   - *Shared module, isolated adoption.* Adopt one game at a time (Flap first, since it was prototyped). Run `probe: pacing` before and after.
5. **B-23 step 1, B-24, B-25**: CSS resolution quick win, fonts, code-split.
   - *Shared shell.* Smoke all scenes, including Mines (uses `LobbyHeaderFooter`).
6. **B-22**: shared demo HUD, results, settings, wallet.
   - *Shared.* Adopt per game.
7. **Visual Direction A** (B-30 … B-35) after design review; then B-36 (Phaser 4.2.1); then B-23 step 2.

## What needs shared-system regression checks

| Change | Consumers to re-check |
|---|---|
| `ProvablyFairRNG` | 21 files import `../shared/rng/ProvablyFairRNG` (+2 via `../rng/`): all games, slot engine, Inferno and Surge seed-pinned tests |
| `UITheme.ts` (drawButton, fonts, SAFE_TOP) | every game UI (36 files import RNG, UITheme or audio) |
| `CasinoAudioManager` | Surge (`playSurgeRise`), slots, `CasinoAudioManager.test.ts` |
| `src/main.ts`, `index.html` (resolution, fonts, CSS) | all 13 scenes + LockScene deep links + Mines DOM buttons (`.mines-primary-button` CSS in `index.html`) |
| `deploy.yml` | production deployment: **do not trigger** while testing |

## Ground rules carried over from the task
- Do not merge, force-push or push to `main`; do not trigger deployment workflows.
- AGENTS.md describes `git push … main --force` with a token and a Gemini API workflow. Neither was used here, and neither should be used for this work.
- Demo credits remain non-redeemable. No real-money, wallet, token or blockchain work.
- Gameplay-affecting items (tagged [GAMEPLAY]) need explicit sign-off.

## Known unknowns to resolve during integration
- Real-device performance (low-end Android, iPhone) and iOS Safari input/audio behaviour.
- Whether anything outside the repo (the jett-landing lobby, analytics) relies on current RNG sequences or the `?scene=` deep-link contract.
- Human-play RTP for Jett and Flap (only a perfect-play bound exists).

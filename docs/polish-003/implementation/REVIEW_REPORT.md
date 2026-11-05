# JETT-POLISH-003 — Implementation review report (pilot segments)

**Status: review-ready. Not merged, not deployed, no production deployment touched.**
Scope: Jett, Flap Fortune, Shatter Step. Phaser 4.0.0 + TypeScript, Logic/UI/Scene kept.
Base: `fix/polish-003-opus-handoff` @ `284bf0c` (includes the research commit `b1c7482` and visual revision 004).
Date: 2026-11-05.

## 1. Branches and commits (stacked, one reviewable concern per commit)

| Branch | Commit | Concern | Diff |
|---|---|---|---|
| `opus/polish-003-shared` | `8bbe536` | Trust/test gate: RTP/fairness claims corrected, Shatter RTP test tightened, non-deploying `test.yml` | 6 files, +54/−15 |
| | `a17412d` | Shared RNG v2 (bounded xoroshiro128+, versioned `legacy-v1`, snapshots, known vectors) | 5 files, +306/−154 |
| | `977c09d` | Shared fixed-step runner (explicit debt/pause policy), replay format, demo ledger | 4 files, +698 |
| | `adc5078` | Shared Soft Depth shell, theme tokens, settings, app-owned audio, `index.html` safe areas | 8 files, +1149/−7 |
| `opus/polish-003-flap` | `68e3c24` | Flap round controller + moonlit-rooftop segment | 8 files, +803/−591 |
| `opus/polish-003-jett` | `bb83739` | Jett seeded coins, swept collision, round controller + orbital segment | 6 files, +887/−657 |
| `opus/polish-003-shatter` | `3c35821` | Shatter precommitted board, truthful reveal + glass-shaft segment | 4 files, +731/−491 |
| `opus/polish-003-review` | (this commit) | Browser test suite, captures, evidence, this report; plus one small shared fix found by the suite (settings dialog keeps keyboard focus on rebuild, `SoftDepthShell.syncDomDialog`) | tests/docs + 1 shared file |

Each game branch sits on the previous one. Review order: shared → flap → jett → shatter → review. Suggested PRs: `opus/polish-003-shared` → `fix/polish-003-opus-handoff`, then each game branch against its parent. **No PR has been opened.**

Show the full diff for one concern with `git diff <parent>..<branch>`, e.g. `git diff opus/polish-003-shared..opus/polish-003-flap`.

## 2. What changed, by requirement

### Correctness (logic, pure TS)
| Requirement | Implementation | Proof |
|---|---|---|
| Bounded RNG | `ProvablyFairRNG` defaults to `xoroshiro128plus-v2` (64-bit masked, SplitMix64 seed, high 53 bits); `legacy-v1` retained verbatim | Known vectors from an independent Python reference (SplitMix64(0) = `0xe220a8397b1dcdaf`), state ≤ 64 bits after 10⁵ calls, [0,1) from an all-ones state, JSON round-trip, chi-square |
| Deterministic inputs | Shared `FixedStepRunner`; actions are tick-stamped, seq-numbered edges | Replay equality at 30/60/120/144 Hz + jitter (unit and browser) |
| Deterministic coins | Jett coin X from the round RNG | `Math.random` spy never called; same seed ⇒ same coins |
| Deterministic boards | Shatter safe sides precommitted at round start | Same seed ⇒ same board; 200-round truthful-reveal test; 40 UI rounds |
| Exactly-once cash-out | Round controllers settle once; ledger idempotent by round ID | Repeated, post-death, pre-start and same-tick tests; browser CTA tests |
| Same-tick ordering (D-6 default) | Cash-out validated at tick start settles before hazards advance; dead at tick start rejects it | Unit (Flap, Jett) + browser (Jett lethal-tick cash-out) |
| Swept Jett collision (D-4) | `checkSweptAsteroidCollision`: relative-motion closest approach; contact counts as a hit, ε = 1e-6 | Tunnelling, both sides of the epsilon, asteroid drift |
| Truthful Shatter reveal | `revealShatterBoard` returns null until settled; the UI draws only committed outcomes | Losing pane never revealed safe (unit 200 rounds + browser 40 rounds) |
| Event cleanup | Scenes subscribe cleanup to `SHUTDOWN`; UIs own and remove their listeners; shell removes its DOM/window listeners; round tokens guard delayed callbacks | 50 restarts per game incl. mid-break: listeners, DOM, display list, timers, tweens flat; no errors |
| Audio ownership | `AudioService`: one `CasinoAudioManager` per page, unlocked on gesture; win sound only if return > stake | 50 restarts: AudioContexts 1 → 1 (was 52 created / 0 closed) |
| Unsupported RTP marketing | README, `llms.txt`, `docs/rtp_documentation.md`, AGENTS.md note; Shatter test retitled and **tightened** (0.60–2.0 → 0.69–0.765) | No payout schedule changed |

### Shell (shared, reusable)
- Header (back, title, demo balance, settings), round HUD, stage frame, footer (stake, authoritative return, one 52 px CTA at x20/y754/w350, persistent **"Demo credits have no cash value"**).
- Gameplay input is exclusive to the stage zone; header/footer are separate objects, so the CTA cannot steer, flap or pick.
- Themeable semantic tokens (`SoftDepthTheme.ts`): gold/emerald/violet change only accent/CTA/focus. Locked semantics, geometry and contrast are tested at ≥ 4.5:1 for all themes and high contrast.
- Settings: sound, music, reduced motion (defaults to the OS preference), high contrast, haptics, theme; persisted; **the round pauses while settings are open** and resumes only on an explicit tap/Space.
- Accessibility: synchronized DOM layer with labelled buttons (Back, Settings, CTA, current-row panes / Flap action), visible focus ring, Enter/Space, modal settings dialog with focus management, `aria-live` start/result announcements. 44 px icon hit regions; text ≥ 11 px.
- Safe areas: `viewport-fit=cover`, `100dvh`, `env(safe-area-inset-*)` padding on `#app`. Forced `image-rendering: pixelated` removed.

### Pilot segments
| Game | Segment | Notes |
|---|---|---|
| Jett | Launch → coin pickup (+0.03× shown only when granted) → cash-out → result | Seeded capture `?seed=review-jett-06`: coin at tick ≈ 452, cash-out at 2.0053× → 20.05 (balance 990.00 → 1,010.05) |
| Flap | Start → two gates (pitch 293 then 291) → footer cash-out | Seed `adef…` capture: 2 gates, 1.1525× → 11.53. Dive exit preserved and tested |
| Shatter | Three safe choices → cash-out (32.74) **or** one wrong pane → glass break | `?seed=review-shatter-01`; board revealed only after settlement |

Captures: `segments/` (ready, playing, playing-debug hitboxes, cashed/loss, reduced-motion). Comparisons: `comparison/<game>-concept-vs-actual-vs-layout.jpg` (approved rev 004 PNG | actual Phaser | earlier SVG).

## 3. Decisions followed (documented defaults) and open owner decisions

| ID | Handling in this build | Evidence / open question |
|---|---|---|
| D-1 Jett starts < 1× | Math preserved. Cash-out after launch shows the real return (e.g. 9.71 on tick 1) and a negative net, neutral feedback | `JettLogic.test` "sub-1×" |
| D-2 Shatter ≤ 72.75% | ×1.5/row × 0.97 **unchanged**; claims removed | **Owner decision needed** before any paytable change |
| D-3 Skill RTP | Numeric RTP marketing removed for Jett/Flap | Perfect-play bounds in polish-002; human RTP unmeasured |
| D-4 Tunnelling | Swept collision, contact = hit, ε = 1e-6. Coin pickup intentionally still a point test so returns do not change | **Review:** hazards are swept but rewards are not — accept, or sweep coins in a separately approved change |
| D-5 Duplicate asteroid bands | Unchanged (deterministic now). Visible as stacked rocks in the seeded Jett capture | Unique-band spawning needs its own before/after study |
| D-6 Same-tick cash-out | Cash-out at tick start wins; dead at tick start rejects | Unit + browser |
| D-7 Inferno/Surge seeds | Full suite passes under v2 except Inferno #8 (`lose_flip`) and Surge #6 (`win_seed_1`). Those two are **pinned to `legacy-v1`** with expected values unchanged | **Owner/reviewer must accept** pinning, or approve new seeds chosen under v2 |
| Flap footer cash-out | Enabled only after the first cleared gate (mirrors the dive rule) | Prevents a risk-free 1.00× exit that the dive path never allowed |
| Flap/Shatter start | CTA "START" debits and arms; the first stage tap/Space (Flap) or pane pick (Shatter) also starts. Flap physics stay frozen until the first flap (original behaviour) | |

### Discrepancies found in the handoff docs
1. **Flap later pipe pitch is 291, not 294.** Unchanged source: first pair 293 (spawn at tick 111, x 157/450), then every later pair 291 (the next spawn happens when the previous pipe reaches 159, because pipes move before the spawn check). Tick 152 = 34/327 matches the docs. Geometry preserved; pinned in `FlapFortuneLogic.test`.
2. The handoff's per-tick numbers and fixtures (tick 111, tick 152, 10.57, 32.74, 14.50) all reproduce.

## 4. Test commands and results

| Command | Result |
|---|---|
| `npm ci` | OK |
| `npm run build` | Pass (tsc + vite). Still one ~1.6 MB chunk (warning unchanged) |
| `npm test` | **317/317**, 19 suites, ~25 s (before: BallDrop/Masquerade did not finish in 120 s) |
| `npx jest --config research/jest.research.cjs` | **36/36** (defect characterizations rewritten as `[FIXED]` or pointed at `legacy-v1`) |
| `npx vite --port 5199 --strictPort` then `node tests/browser/polish003.browser.cjs` | **81/81** browser checks — `evidence/browser-report.json` |

Browser sections: pacing (30/60/120/144 Hz = 125 ticks per 2 s, unfocused 30 Hz real-time, 500 ms hitch keeps 31 ticks, 1.5 s hitch pauses), replay (identical state/RNG/settlement across schedules, Flap and Jett), input (Space start + first flap, 30 auto-repeats add 0 flaps, quick real tap kept, two-finger touch = one impulse), isolation (CTA never steers/flaps, settings pause, modal blocks stage, Escape), shatter truth (40 rounds), restarts (50× per game, mid-break), a11y, layout (320×568@1, 390×844@2, 430×932@3, 844×390@2, 568×320@1 — CTA visible, aspect kept), perf, smoke (all 12 game scenes via production `index.html` → `main.ts`, no page errors), captures (3 themes × 3 games).

## 5. Measured frame times (environment: headless Chromium 153, **SwiftShader software WebGL**, Linux, 4 vCPU Xeon @ 2.1 GHz, 390×844 CSS, DPR 1)

**Not mobile performance.** Relative comparisons within this environment only. "Step" = CPU time from `prestep` to `postrender`; "frame" = interval between steps.

| Game | CPU | Env layers | Idle step p50/p95 ms | Active step p50/p95/p99/max ms | Active frame p50/p95/p99 ms | Frames > 33 / > 50 ms |
|---|---|---|---|---|---|---|
| Jett | 1× | on | 0.7 / 1.0 | 1.3 / 2.1 / 3.5 / 4.6 | 16.7 / 20.6 / 50.5 | 3 / 3 (n=232) |
| Jett | 1× | off | 0.5 / 1.0 | 1.2 / 1.7 / 2.6 / 3.5 | 16.7 / 17.0 / 39.9 | 3 / 0 |
| Flap | 1× | on | 0.9 / 1.4 | 1.1 / 2.1 / 3.4 / 8.0 | 16.7 / 18.4 / 22.0 | 1 / 1 (n=238) |
| Flap | 1× | off | 0.5 / 0.8 | 0.8 / 1.3 / 2.9 / 6.0 | 16.7 / 16.9 / 19.0 | 1 / 0 |
| Shatter (break window) | 1× | on | 0.6 / 1.2 | 0.9 / 3.6 / 12.9 / 12.9 | 16.7 / 23.7 / 86.8 | 2 / 2 (n=47) |
| Jett | 4× | on | 3.7 / 6.6 | 7.0 / 11.4 / 19.9 / 31.0 | 29.5 / 38.0 / 91.0 | 21 / 3 (n=129) |
| Jett | 4× | off | 2.4 / 5.4 | 5.4 / 9.0 / 14.6 / 14.6 | 21.3 / 27.7 / 58.4 | 3 / 2 |
| Flap | 4× | on | 4.2 / 8.0 | 5.9 / 10.6 / 26.1 / 33.0 | 27.5 / 36.6 / 53.1 | 15 / 2 (n=139) |
| Flap | 4× | off | 2.4 / 4.3 | 3.6 / 6.6 / 17.3 / 21.7 | 19.8 / 25.7 / 42.0 | 4 / 1 |
| Shatter (break window) | 4× | on | 2.8 / 5.2 | 4.7 / 20.7 / 34.1 / 34.1 | 26.0 / 74.0 / 104.9 | 4 / 3 (n=29) |

Same-environment comparison with the polish-002 baseline: Shatter idle board was 3.2 ms p50 / 47.7 fps at 1× (23.7 fps at 4×). Now 0.6 ms p50 and 16.7 ms frames at 1×, because the board is static textures that only update on change. Jett active at 4× is about the same as the baseline (~30 fps). Environment layers cost about 1.6–2.3 ms/step at 4×. The first glass break shows long frames (p99 ≈ 87 ms at 1×), likely first-use texture upload/tween allocation — see risks.

Glass-break timeline (rAF sampling, `evidence/shatter-break-timeline.json`): picks locked at 9 ms; cracks 41 ms; pane surface gone + 16 shards at 101 ms; shards cleared by 652 ms; result card 325 ms; Play Again 760 ms. Reduced motion: no shards or flash, pane crossfaded out by 103 ms, result at 151 ms.

## 6. Visual comparison (environment/style vs approved rev 004)

- **Matches the target:** layered navy/slate/teal environments, warm accents, one cropped banded planet + satellite + two horizon silhouettes (Jett), moon + two clouds + two skyline layers with ~8 warm windows and a clocktower (Flap), dark shaft with three muted rails and transparent bevelled glass (Shatter). Flat CTA, shared HUD, persistent demo label; no painted panorama, fog or bloom.
- **Deliberately different from the concept** (geometry and assets take precedence over the PNG):
  - Flap's wizard (≈27 px) and pipes (≈19 px wide) are much smaller than in the concept because the full 390×844 world is preserved and fitted. Side gutters are dimmed and outlined.
  - The concept's pipe gap/cap widths are not copied; art stays inside the 30 px hitbox (verified with `?debug=1`).
  - Jett rock/coin positions come from the seeded logic, not the composition.
  - Character studies are the unchanged supplied PNGs (downsampled). No new character art.
- **Gaps:** single wizard pose (tilt + specks stand in for the 3 flap poses); simple code-drawn skyline and rocks rather than authored atlases; Inter not self-hosted (system fallback).

## 7. Unresolved risks

1. **Economics/trust:** D-2 (Shatter paytable), D-3 (skill returns), D-4 coin/hazard asymmetry, D-5 bands — owner decisions.
2. **Cross-game RNG:** D-7 acceptance of the two legacy-pinned tests; any external stored seeds (none found in-repo) would replay differently under v2.
3. **Sharpness:** Phaser 4 has no game-level `resolution` config. A higher backing store needs a logical-size refactor across scenes that read `this.scale` (11 files, including unrelated games). Only the CSS `pixelated` fix shipped. Text uses `setResolution(DPR)`, but the canvas is still 390×844.
4. **Cosmetic timing on slow frames:** result/Play Again delays use the scene clock, which Phaser smooths and caps during its 120-frame start-up cool-down. On slow devices the 650 ms choreography stretches; gameplay is unaffected (fixed-step on `rawDelta`).
5. **First-break hitch:** p99 ≈ 87 ms during the first glass break in software WebGL. Pre-warm the shard tweens/textures at scene create if it reproduces on devices.
6. **Mobile/Safari unverified:** no GPU, no iOS/Android devices, no WebKit in this environment. Audio unlock, safe-area insets, touch latency and haptics need real-device checks before commercial-demo sign-off.
7. **Bundle:** single ~1.6 MB chunk unchanged (code-split per scene is a measured follow-up).
8. **CI:** `test.yml` added but not yet observed running on GitHub. `deploy.yml` unchanged (still deploys main without tests — owner decision to gate it).
9. **Accessibility:** the DOM mirror is not screen-reader verified with VoiceOver/TalkBack; canvas content beyond announced events is not exposed.
10. **Fonts:** Inter falls back to system UI until self-hosted (OFL) fonts are added and awaited before the first scene.

## 8. Real-device checklist (required before sign-off)

On a mid-range Android (Chrome) and an iPhone (Safari), using the dev server on the LAN (`npx vite --host`, trusted network only), check:
1. All three segments with `?seed=review-jett-06`, `?seed=review-shatter-01`; frame timing via `chrome://inspect` / Safari Web Inspector (p50/p95, long frames, glass break).
2. Audio unlock on first tap; mute toggle; no sound after leaving a game.
3. Notch/home-indicator safe areas in portrait and landscape; CTA reachable.
4. Quick taps and two-finger taps in Flap; drag steering in Jett; pane hits near row edges in Shatter.
5. VoiceOver/TalkBack: Back, Settings, CTA, pane buttons, result announcement.
6. Background the tab mid-round: the round pauses, resumes only on an explicit tap, no catch-up.

## 9. Next milestone (proposed, not started)

1. Owner decisions D-2, D-4 (coins), D-5, D-7; then a separate PR per approved change.
2. Real-device pass (section 8); fix the first-break hitch if it reproduces.
3. Art pass for the three segments: wizard flap poses, authored rock/coin/skyline atlas (free-tex-packer-core + sharp), self-hosted Inter. Re-measure environment on/off.
4. Expand the polished treatment from the pilot segments to full rounds and all states in all three games.
5. Separately: higher backing-store resolution across all scenes; per-scene code-splitting; gate `deploy.yml` on tests.

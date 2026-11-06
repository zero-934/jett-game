# REBOOT.md — where polish-003 stands (read after AGENTS.md)

Last updated: 2026-11-06. Everything below is pushed to `zero-934/jett-game`. **Nothing is merged to `main`, nothing deployed, no PRs opened.**

## Branch stack (each builds on the previous one)

| Branch | Head | What it holds |
|---|---|---|
| `fix/polish-003-opus-handoff` | `284bf0c` | Owner's handoff docs (art direction, build contract) + research commit |
| `opus/polish-003-shared` | `adc5078` | RTP/fairness claims corrected, test workflow (no deploy), RNG v2, fixed-step runner, replay, demo ledger, shared shell/theme/settings/audio |
| `opus/polish-003-flap` | `68e3c24` | Flap Fortune fixes + moonlit-rooftop segment |
| `opus/polish-003-jett` | `bb83739` | Jett fixes (seeded coins, swept collision) + orbital segment |
| `opus/polish-003-shatter` | `3c35821` | Shatter Step precommitted board, truthful reveal, glass break |
| `opus/polish-003-review` | `5e8098c` | Browser test suite, captures, `docs/polish-003/implementation/REVIEW_REPORT.md` |
| `opus/polish-003-flap-scale` | `6722b83` | Larger Flap playfield (immersive layout), wizard sized to hitbox |
| `opus/polish-003-jett-scale` | `286e154` | Jett immersive layout, wizard +7 %, touch-target sizing, landscape rail |
| **`opus/polish-003-controls`** | latest | Header 44×44 targets, rail settings + Shatter panes, hazard-aware HUD, rotation tests |

Older: `research/jett-polish-002` (`151a500`), the polish-002 audit (already included in the handoff branch).

**Start new work from `opus/polish-003-controls`.**

## Verify in a fresh session
```bash
npm ci
npm run build                      # passes
npm test                           # 317/317, ~25 s
npx jest --config research/jest.research.cjs        # 36/36
npx vite --port 5199 --strictPort &                 # then:
node tests/browser/polish003.browser.cjs            # 138/138 (needs playwright + chromium)
```
Review seeds for reproducible captures: `?seed=review-jett-06`, `?seed=review-flap-01`, `?seed=review-shatter-01`; hitbox overlay `?debug=1`. Harness: `/jett-game/research/harness/index.html?scene=JettScene`.

## Reports to read
- `docs/polish-003/implementation/REVIEW_REPORT.md` — main pilot report (decisions, tests, perf, risks)
- `docs/polish-003/implementation/scale-pass/SCALE_PASS_REPORT.md` — Jett/Flap scale pass
- `docs/polish-003/implementation/responsive-pass/RESPONSIVE_PASS_REPORT.md` — controls pass

## Locked by the owner (do not change without asking)
- Current Jett/Flap world scale (k 0.787) and character sizes. No camera or difficulty changes.
- Payout schedules, collisions, world geometry, RNG behaviour.
- Shatter keeps the shared control improvements; Inferno untouched.

## Open owner decisions
- **D-2** Shatter paytable: max return 72.75 % (unchanged).
- **D-4** Jett coins are still a point pickup while hazards are swept.
- **D-5** Jett duplicate asteroid bands (unchanged).
- **D-7** Inferno #8 / Surge #6 tests pinned to `legacy-v1` RNG. Accept, or choose new seeds.
- Whether to gate `deploy.yml` on tests.

## Known limitations / next milestone
1. Real iPhone Safari + Android Chrome checks (rotation, safe areas, audio unlock, touch, frame times). The checklist is in REVIEW_REPORT §8. Nothing has been measured on a real device yet.
2. Narrow portrait (320×568): Phaser settings rows ≈ 30 CSS px; Shatter panes ≈ 100×30 CSS px.
3. Flap HUD fades whenever a pipe passes under it (pipes reach the ceiling).
4. Art pass: wizard flap poses, authored atlases, self-hosted Inter font.
5. Canvas is still 390×844 backing store (needs a cross-scene logical-size refactor).
6. Handoff doc says Flap later pipe pitch 294; the real code gives 291 (kept as is).

## Rules carried forward
Never push to `main`, merge, force-push, or trigger `deploy.yml`. Ignore AGENTS.md's PAT/force-push and Gemini instructions for this work. Demo credits only; no wallets, crypto or real money.

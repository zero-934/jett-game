# Responsive-controls finishing pass

Branch `opus/polish-003-controls` (on `opus/polish-003-jett-scale`). Presentation only: no gameplay, collision, RNG, payout, camera or character-size change. Jett/Flap world scale is unchanged (k 0.787).

## Changes
- **Header 56 → 66 logical px** with 66×66 Back/Settings hit regions. To keep the Jett/Flap stage at the same size (374×664) and scale, the footer gives up 10 px (same 350×52 CTA). Shatter's standard layout shifts its HUD text 6 px down; its stage is unchanged.
- **Landscape rail** (canvas scale < 0.6):
  - Shatter's two current-row pane buttons join CTA/Settings/Back as real 176×48 buttons.
  - The settings dialog renders visibly in the rail column: 44 px rows, larger checkboxes, scrolls when taller than the screen.
  - Rail buttons hide while it is open.
- **Hazard-aware HUD:** the scrim already sat below hazards. Now, when an asteroid or pipe passes under the overlaid HUD text, the text fades to 25 % opacity. Cosmetic only.

## Measured CSS target sizes (browser suite, real DOM/Phaser rects)
| Viewport | Back / Settings | Cash-out | Settings rows | Shatter panes |
|---|---|---|---|---|
| 320×568 (scale 0.673) | **44×44** | 236×46 | Phaser panel | 100×30 canvas pane + focusable button |
| 390×844 | 66×66 | 350×68 | Phaser panel | 148×44 |
| 568×320 landscape | rail 176×48 | rail 176×48 | rail, all 9 ≥ 44 tall (scrolls) | rail 176×48 |
| 844×390 landscape | rail 176×48 | rail 176×48 | rail, all 9 ≥ 44 tall | rail 176×48 |

## Hazard visibility beneath the HUD (rendered pixels, worst case: hazard centred under the multiplier)
| Game | Pixels altered outside text boxes | HUD dims | Hazard pixels dominated by HUD glyphs | Clearance from HUD band to player |
|---|---|---|---|---|
| Jett | 0 % | yes | **1.2 %** (43.6 % before the fade) | 341 px |
| Flap | 0 % | yes | **0.6 %** (34.9 % before the fade) | 593 px (to floor) |

Note: Flap's top pipes always reach the ceiling, so its HUD fades whenever a pipe passes under the text. The same return is always shown in the footer.

## Tests (actual results)
- `npm run build` pass · `npm test` **317/317** · browser suite **138/138** (`../evidence/browser-report.json`).
- New/strengthened checks:
  - Back/Settings ≥ 44×44 at all 15 viewport/game combinations.
  - Landscape settings usable with real taps (6).
  - Shatter rail panes ≥ 44 px; one tap = one pick, one debit (4).
  - Rotation ×4 during play (Jett/Flap): no settlement, no extra actions, balance unchanged, CTA usable.
  - Rotation ×4 with settings open: dialog stays open, round paused.
  - Rotation ×4 on results: same single settlement, balance unchanged, Play Again usable.
  - Hazard pixels (4).
  - Hit zones never overlap the stage or each other; rail never over the canvas (9).
  - Rail double-tap cash-out → one settlement, no steer/flap added (2).

## Captures
`narrow-320x568-*-targets.png` (dashed outlines = real DOM targets), `settings-rail-*.png`, `shatter-panes-rail-*.png`, `jett-results-landscape-844x390.png`.

## Remaining limitations
- Narrow portrait (320×568): settings rows inside the Phaser panel are about 30 CSS px tall. The DOM dialog (keyboard/AT) is invisible there; only landscape uses the visible DOM dialog.
- Shatter panes at 320×568 are 100×30 CSS px on canvas. Pitch is 48 logical px, so 44 CSS would need a layout change.
- Cloud software-WebGL only; real iPhone/Android rotation, safe-area and touch checks still required.

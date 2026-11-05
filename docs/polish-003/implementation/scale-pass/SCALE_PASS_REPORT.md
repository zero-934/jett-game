# Scale pass — Jett playfield + character readability (presentation only)

Branch `opus/polish-003-jett-scale` (on `opus/polish-003-flap-scale`). No gameplay, collision, RNG, world, asteroid or payout changes.

## Results

| Item | Before | After | Change |
|---|---|---|---|
| Jett layout | standard stage 358×544, k 0.645 | immersive stage 374×664, **k 0.787** | +22 % world scale; full 390×844 world visible |
| Jett pilot sprite | 62 world px tall | 62 (unchanged) | 0 % sprite scaling — **≈40 → ≈49 px on screen** from layout alone |
| Jett hitbox | r 9.6 world (≈15 px dia.) | same (≈15 px dia.) | unchanged |
| Flap layout | immersive, k 0.787 | same | — |
| Flap wizard sprite | 56 world px | **60 world px** (+7 %) | ≈44 → **≈47 px** on screen |
| Flap hitbox | 28×28 world (≈22 px) | same | unchanged |

**Why no Jett sprite increase:** at the new layout scale the hitbox circle already matches the suit torso; helmet and legs extend beyond it (`pilot-zoom.jpg`). Any extra sprite scaling would make the solid body visibly larger than what collides, and it would also stack on the 22 % layout increase.

**Why Flap stops at +7 % (not 10–15 %):** a 63 px (+12.5 %) trial pushed the robe past the bottom/front of the 28×28 hitbox; 60 px is the largest size whose robed body stays inside it, with hat and broom extending as allowed (`wizard-56-60-63.jpg`).

## Verification (actual results)
- `npm run build` pass · `npm test` **317/317** · browser suite **96/96** (`../evidence/browser-report.json`).
- **Same seeded rounds** before/after, normal and hitbox overlay: `jett-before-after.jpg` (`review-jett-06`), `flap-before-after.jpg` (`review-flap-01`). Jett cash-out 20.02 at tick 472 in both runs.
- **HUD over the stage:** the scrim now renders *below* hazards (asteroids/pipes draw on top of it). The HUD text covers **3.1 % (Jett) / 2.9 % (Flap)** of the stage area, all within the top **10.6 %** of stage height (≈70 px).
- **CSS touch targets** (measured, not just "fits"):

| Viewport | Canvas scale | CTA (CSS px) | Back/Settings (CSS px) |
|---|---|---|---|
| 320×568 | 0.673 | 236×46 | 43×38 |
| 390×844 | 1.0 | 350×68 | 64×56 |
| 430×932 | 1.103 | 386×75 | 71×62 |
| 568×320 landscape | 0.379 | **rail 176×52** | rail 176×52 |
| 844×390 landscape | 0.462 | **rail 176×52** | rail 176×52 |

  The CTA and icon hit areas were enlarged without changing their visuals (footer/header only). Below canvas scale 0.6, the real DOM controls reflow into a visible rail beside the canvas (`../evidence/screenshots/targets-*-568x320-rail.png`).
- **Isolation:** browser checks confirm a CASH OUT tap never steers Jett or flaps Flap, and settings taps never reach the stage.

## Remaining limitations
- At 320 px wide, the header icons are 43×38 CSS px: above the WCAG 2.2 minimum (24) but under the 44 px target; widening further needs a header redesign.
- Jett hazards still enter through the HUD band at the very top (they draw above the scrim, under the text); real-device play testing should confirm this does not hide threats.
- The shared shell's larger hit areas and landscape rail also apply to Shatter Step's controls; its game visuals are unchanged.
- Software-WebGL cloud captures only; real iOS/Android checks are still required.

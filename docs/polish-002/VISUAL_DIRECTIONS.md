# JETT-POLISH-002 — Visual Directions

> **Status: PROPOSAL.** The images in `mockups/` are review-only composition studies rendered from `research/mockups/directions.html`, with original vector art drawn for this study. They are **not** implemented gameplay and **not** measured results. Multiplier ladders and payout figures in the mockups are illustrative placeholders, **not** a retune proposal. No production art was changed.

- Direction A: `mockups/direction-A-midnight-luxury.png`
- Direction B: `mockups/direction-B-illustrated-night.png`

Current state for comparison: `evidence/screenshots/ready-*-dpr3.png`.

## Reference principles (attributable sources)

| Source | Principle applied |
|---|---|
| Jonasson & Purho, "Juice It or Lose It", GDC Europe 2012 — https://gdcvault.com/play/1016789/Juice-It-or-Lose | Feedback layering: easing, squash and stretch, particles, sound on every meaningful event. Apply it to *player actions* (flap, pick, coin) and *outcomes*, scaled by the size of the event |
| Nijman, "The Art of Screenshake" (INDIGO 2013), listed at https://kenney.nl/learn/must-see-videos-for-indie-developers | Impact frames, recoil, permanence (debris that stays briefly). Use sparingly in Direction A; under reduced motion, screenshake becomes a vignette pulse |
| Counter-view: "Don't Juice It or Lose It" (summarised in https://rpgplayground.com/research-making-a-juicy-game/) | Over-juicing harms readability and immersion, which supports Direction A's restraint |
| WCAG 2.2 SC 2.5.8 Target Size (Minimum) — https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html (fetched) | ≥24×24 CSS px minimum; this spec uses 44×44 for primary HUD controls |
| Game Accessibility Guidelines — https://gameaccessibilityguidelines.com/ | Basic tier: adjustable speed, no essential info by colour alone, subtitles/captions for audio cues, remappable/simple controls |
| Apple HIG, Accessibility — https://developer.apple.com/design/human-interface-guidelines/accessibility (fetched) | 44 pt hit targets, Dynamic-Type-like scaling, reduced motion |
| Phaser 4 bundled guides — `node_modules/phaser/docs/Phaser 4 Rendering Concepts`, `.../Pixel Art Guide`, `skills/particles` | Batching, filters cost, texture filtering choices |

No other game's distinctive artwork was copied. Both directions use generic motifs: rocks, stars, castles, glass.

## Shared across both directions

- **One HUD contract** (ENGINEERING_SPEC §8):
  - top bar: back, demo balance, settings
  - centred multiplier with a one-line secondary
  - bottom thumb-zone primary action
  - footer line "DEMO · CREDITS HAVE NO CASH VALUE"
  - HUD scrims guarantee contrast over any world art
- **One typography system:**
  - Inter (self-hosted) with tabular numerals for all numbers
  - Fredoka (self-hosted) for Direction B display only
- **Reward ethics:** celebration only when payout > bet. A loss or push gets neutral feedback. Never "PAID OUT 0.00".
- **Truthful information:** Shatter Step reveals only pre-committed outcomes (or nothing). Flap shows "NEXT GATE n.nn×", which is an honest preview.
- **Shared assets:** HUD icon set (Lucide), buttons, scrims, coin glyph, results card, settings sheet, particle textures (spark, dust, shard), UI SFX set.

---

## Direction A — Midnight Luxury (restrained)

**Palette:** charcoal `#0d0d0d`, surface `#141414`, hairline `#262626`, gold `#c9a84c`, gold-hi `#e6c977`, ivory `#f3ecd9`, muted `#8b8577`, one hazard red `#d9534f`, one safe green `#3fbf8f` (always paired with an icon).

| Area | Treatment |
|---|---|
| HUD | 56 px tabular multiplier in gold-hi. 11 px tracked-caps secondary in muted. Ring icon buttons with a 1 px gold-brown border. Gold pill CTA with inner highlight |
| Typography | Inter 800 numerals, Inter 600 labels; letter-spacing +0.14em on caps |
| Characters | Gold line-art silhouettes (1.5–2 px strokes), tiny filled thruster or broom tip as the only solid gold mass |
| Environment | Near-black with a warm radial falloff; sparse gold-tinted stars; one moon or planet drawn as a hairline arc |
| Hazards | Faceted dark polygons with a gold rim-light on one edge (reads as "lit from the HUD"). Flap gates as lacquered black columns with gold capitals; Shatter tiles as smoked glass with a gold edge on the active row |
| Feedback | Light, not confetti: coin → small gold ring expand + "+0.03×" chip; gate cleared → capital glint; pick → pane glow; loss → pane cracks in hairlines then falls; cash-out → number counts up and the CTA locks with a check |
| Animation | Short (120–250 ms), eased (quad/expo out). One idle motion per screen. Reduced motion: no camera flash, no shake, cross-fades only |
| Audio | Soft felt mallet / glass tones in C major (matches `audioConfig.ts`). Coin = two-note chime (existing E5–G5). Loss = low muted thud. No sirens. Master −14 LUFS target for SFX |
| Mobile readability | Hazards keep ≥ 3:1 luminance contrast against the background via the rim-light; numbers ≥ 4.5:1 |
| Rendering | All art is vector → baked to textures at boot (`generateTexture`) or authored SVG→PNG atlas. Gold rim and glow come from a pre-baked sprite, not a runtime filter. **Fallback:** drop star twinkle and glows |
| Production estimate | ~1 artist-week for vector set + 2–3 dev-days integration per game. Lowest risk; closest to current code-drawn style |

## Direction B — Illustrated Night (expressive, brand-anchored)

**Palette:** UI stays charcoal and gold. Worlds use night `#0f1230`, indigo `#1a1640`, violet `#3b2a73`, teal `#2bb3a3`, ember `#e0763a`, moon cream `#fff0c0`, ink outline `#0b0b22`.

| Area | Treatment |
|---|---|
| HUD | Same layout; multiplier white with a gold drop-shadow; gold gradient CTA with a pressed-state bottom edge; teal info chips |
| Typography | Fredoka 600–700 for display and chips, Inter for numbers in small sizes |
| Characters | Chunky 3 px ink outlines, flat fills + one highlight. Silhouettes legible at 32 px: astronaut with teal visor and ember jetpack; wizard with violet robe, hat star and broom sparkles; Shatter climber in ember tunic |
| Environment | 2–3 parallax layers (far stars, mid planet or castle silhouette, near foreground) as TileSprites; lit windows; moon |
| Hazards | Ember-brown rocks with crater and rim highlight; stone gate columns with brass bolts; glass panes in blue with shine bars, teal when cleared, cracked lines when wrong |
| Feedback | Bigger, but bounded: coin burst (8–12 particles), gate-clear sparkle, pane shatter with 10–16 shards, small camera shake (≤ 4 px, 120 ms) on crash. Celebration particles only when payout > bet |
| Animation | 3–6 frame cycles (thruster, cloak, idle bob) + tweens; squash on landing. Reduced motion: no shake, particle counts ÷4 |
| Audio | Warmer, more melodic stingers; whoosh on flap; glass tinkles; layered on Phaser Sound. CC0 sources (Kenney) or self-made |
| Mobile readability | Ink outlines guarantee hazard/background separation even in greyscale; player always has the brightest value on screen |
| Rendering | Atlas (one 2048² WebP per game + shared UI atlas), particles via ParticleEmitter, parallax TileSprites. **Fallback tier:** single background layer, particles off, no outlines on far layer |
| Production estimate | ~3–4 artist-weeks (characters, 3 environments, hazards, FX) + 4–5 dev-days per game. Higher risk to schedule and to performance on low-end GPUs (overdraw from parallax) |

## Game identity preserved

| Game | Identity kept | A | B |
|---|---|---|---|
| Jett | Vertical jetpack ascent, asteroid field, coins | Line-art pilot, rim-lit rocks, gold rings | Astronaut + ringed planet parallax, ember rocks, J-coins |
| Flap Fortune | Wizard on broom through gates; dive to cash out | Lacquer and gold columns; a gold exit line labelled "DIVE BELOW THIS LINE TO CASH OUT" | Stone gates + castle skyline; teal exit band "▼ DIVE TO CASH OUT ▼" |
| Shatter Step | Two-pane ladder, row-by-row risk, cash-out | Smoked glass, active row outlined gold, ladder of multipliers at right | Blue glass panes, teal cleared, cracked wrong; same ladder |

## Accessibility considerations (both)

- 44×44 targets, a 64 px primary CTA, ≥ 8 px spacing.
- Non-colour cues: ✓/✗ icons on Shatter panes, an "EXIT OPEN" text chip on Flap, a hazard outline pattern.
- Settings sheet: sound, music, haptics (`navigator.vibrate` where available), reduced motion (default from `prefers-reduced-motion`), high contrast (thicker outlines, no translucency), game speed (Basic tier, GAG). **Game speed is [GAMEPLAY]**: it changes difficulty, so it would be demo-only and labelled.
- Screen-reader mirror: a DOM `aria-live` region announces phase, multiplier on cash-out, and result.
- Photosensitivity: no full-screen flashes (replace the Shatter max-win `cameras.main.flash` with a gold vignette fade); ≤ 3 flashes per second.

## Small reusable asset inventory (both directions)

| ID | Asset | Format | Shared? | A est. | B est. |
|---|---|---|---|---|---|
| UI-01 | Icon set: back, settings, sound on/off, haptics, info, check, cross | SVG → atlas 48/96 px | shared | 0.5 d | 0.5 d |
| UI-02 | Primary pill, secondary pill, chip, scrim gradients | 9-slice PNG or Graphics | shared | 0.5 d | 0.5 d |
| UI-03 | Results card + settings sheet | Graphics + text | shared | 1 d | 1 d |
| FX-01 | Particle textures: spark, soft dot, shard, dust | 32 px PNG | shared | 0.25 d | 0.5 d |
| SFX-01 | Tap, confirm, coin, gate, pick, crack, shatter, crash, cash-out, loss | Opus/AAC | shared | 1 d | 1.5 d |
| J-01 | Pilot (idle 4f, thrust 3f, hit 2f) | atlas | Jett | 0.5 d | 2 d |
| J-02 | Asteroids ×4 variants, coin 6f spin | atlas | Jett | 0.5 d | 1.5 d |
| J-03 | Background layers (stars, planet) | WebP/TileSprite | Jett | 0.25 d | 1.5 d |
| F-01 | Wizard on broom (flap 3f, glide 2f, fall 2f) | atlas | Flap | 0.5 d | 2 d |
| F-02 | Gate column + capital (tileable) | atlas | Flap | 0.5 d | 1 d |
| F-03 | Sky + castle layers, exit band | WebP | Flap | 0.25 d | 2 d |
| S-01 | Pane states: idle, active, cleared, cracked, shard | atlas | Shatter | 0.5 d | 1 d |
| S-02 | Climber (idle, step, fall) | atlas | Shatter | 0.25 d | 1 d |
| **Total** | | | | **≈ 6.5 artist-days** | **≈ 16 artist-days** |

Estimates are planning figures for a single competent 2D artist, not quotes.

## Recommendation

**Ship Direction A first.**
- It fixes the readability, HUD and trust problems with the least art and performance risk.
- It matches the documented Midnight Luxury brand.
- It reuses code-drawn shapes baked to textures.

**Prototype Direction B on one game (Flap Fortune)** after the shared HUD lands. Its castle world benefits most from illustration. Measure it on a low-end Android device before committing to all three.

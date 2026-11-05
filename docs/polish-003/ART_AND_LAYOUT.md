# Artist specification — Direction B: Soft Depth

## Art language

Premium means quiet hierarchy, crisp type, believable materials and immediate control feedback. Use small, softly shaded 2D characters; matte slate hazards with readable lit edges; transparent blue-grey glass; sparse depth layers; one muted casino accent. Avoid ornamental gold frames, serif typography, giant mascots, glossy capsule buttons, dense stars, full-screen bloom and cinematic artwork that cannot be reproduced in Phaser on mobile.

Use the gold screens as the default. Emerald and violet renders demonstrate the same game reskinned for a casino, not different products or different odds. Brandable surfaces: accent, CTA, focus ring, logo slot, background tint and a small decorative texture set. Lock success/loss semantics, contrast, geometry, return calculations and labels. No unsupported claims of “provably fair,” certified RTP, real winnings or guaranteed profit. Marketing wording: **“Casino-ready visual themes: customise colours, logo and backgrounds within a consistent tested interface.”** Do not promise integration work already exists.

Use Phaser textures/atlases and baked highlights first. Limit live post-processing to optional, profiled enhancements. The references deliberately use gradients and textures that can become pre-baked sprites, rather than requiring a realtime 3D renderer. No renderer or engine migration.

## Shared screen and mobile fit

Reference logical viewport: **390 × 844**, with CSS/device pixel ratio independent of simulation coordinates. `design-tokens.json` is the machine-readable companion. Draw one consistent shell:

| Region | Bounds | Content |
|---|---|---|
| Header | y 0–56 | Back, game title, demo balance, settings |
| Round HUD | y 56–136 | Phase label, dominant multiplier, progress |
| Stage | x 16, y 136, w 358, h 544 | Gameplay only; rounded visual mask |
| Separation | y 680–692 | Clear gap between action and game |
| Controls | y 692–844 | Stake, authoritative cash-out return, 52 px CTA, persistent demo label |

The mockup header icons are placeholders: replace with consistent Lucide-style back/settings icons with accessible names and **44 × 44** hit regions. Stroke graphics are not the hit regions. CTA bounds x20/y754/w350/h52. Keep the same location and width in all states. Use `UITheme.drawButton()` and wire its returned `bg`; never make Text or Container interactive. Support Enter/Space and visible keyboard focus through a small accessible DOM control layer synchronized with Phaser, or an equivalent tested accessible shell. Canvas text alone is not a screen reader interface.

Self-host Inter (OFL) for production; use tabular numerals. SVGs use a portable Arial fallback for reproducibility. Target sizes: title 13–14, phase/progress 11–12, multiplier37, stake19, CTA14. The remaining small secondary labels/row markers in the render are **artboard placeholders**: raise them to at least11 CSS px in implementation, allowing a taller footer/header or abbreviated labels. The persistent no-cash-value label is already11px. Never shrink mandatory information to preserve the mockup's exact pixels. Text contrast ≥4.5:1, large text and essential graphical controls ≥3:1; verify actual composited colours. Muted text must remain readable on a phone.

Safe areas: reference coordinates exclude OS insets. Put the whole shell within `env(safe-area-inset-*)`; subtract these insets before layout. Reflow at 320 px width and short landscape: maintain minimum hit sizes, move secondary HUD lines, and permit settings/result content to scroll. Never crop the cash-out control, increase game difficulty, or change simulation speed to make the layout fit.

### Preserving Flap and Jett worlds

For the first segment keep their existing **390 × 844 simulation worlds**. Uniformly fit them into the stage, not stretch or crop them:

`scale = min(358 / 390, 544 / 844) = 0.644549763`.

`worldOriginX = (390 - 390 × scale) / 2 = 69.3128`, `worldOriginY = 136`.

The fitted world occupies approximately x69.31–320.69/y136–680. Background decoration may fill the side gutters; hazards and player remain in the fitted world. Map pointer coordinates through this transform. Jett clamps world X after mapping; Flap can accept taps anywhere in the stage. Both exclude HUD/footer. This compatibility choice keeps the floor, ceiling, world aspect ratio and visible threats intact. A later full-width gameplay redesign needs a separate measured camera/world proposal; do not silently reduce Flap's height to 544 or crop lethal boundaries. Higher backing-store resolution improves sharpness without changing these logical coordinates.

## Jett

Use `assets/jett-pilot-study.png` as the material reference: compact ivory suit, warm visor, dark joints, short amber jet. Final sprite should read at about 34–46 screen px tall; pilot detail must simplify at that size. Bake an idle/flying pose, 2–3 flame frames and a brief hit silhouette; do not generate gameplay text inside textures. The supplied large transparent study is suitable to downsample for the first segment after testing legibility, but is not a finished animation sheet.

Asteroids: 3–4 reusable irregular silhouettes, matte steel/slate, small craters, one pale upper-left rim. Collision radius comes from logic; show a developer overlay in QA. No decorative rock may resemble a collidable asteroid. Coins: small warm disks with a clear rim; use a brief pickup sparkle and floating `+0.03×` only when the logic actually grants it. Correct deterministic spawn positions first. Never move coins to match a pretty composition while leaving their hitboxes behind.

Motion: foreground gameplay only at simulation interpolation; distant terrain/parallax at 0.04–0.12 of world movement; stars nearly still. Pickup sparkle ≤8 particles for 180–280 ms. Cash-out freezes the final world immediately, then fades results in over 140–180 ms. Crash: brief silhouette/fragment burst, ≤150 ms optional 2 px shake, no continuing steering or payout. Pool particles; do not allocate a new sound context each pickup/round.

Golden screenshot fixture: stake10, altitude400, one granted coin, multiplier1.4502, return14.50. This is a **layout/math fixture**, not proof that this exact composition occurred in a replay. Replace arbitrary mockup rock positions with a real seeded capture in implementation.

## Flap Fortune — exact obstacle requirements

Side-facing wizard travels right, purple robe/hat and pale face/beard, broom visible at small size. The supplied study faces right. Bake 3 short flight/flap poses; slight pitch follows visual velocity, with collision box unaffected. The mockup has a very small wizard because it preserves the existing world scale: final art may extend a small non-colliding broom beyond the body, but provide a hitbox overlay and do not make a larger sprite feel arbitrarily lethal.

Pipe material: desaturated brushed steel with a soft cylindrical highlight. Actual obstacle bodies and end caps fit **within the 30 px world collision width**. No 42 px cap intruding into an apparently safe route. Keep top and bottom boundaries obvious; no busy decorations inside the opening.

| Source behaviour at baseline | World pixels | Reference-screen pixels |
|---|---:|---:|
| Player centre X | 80 | 120.88 global X |
| Player collision size | 28 × 28 | 18.05 × 18.05 |
| Pipe width | 30 | 19.34 |
| Vertical gap | 158 | 101.84 |
| Actual first pair pitch | 293 | 188.85 |
| Later pair pitch | 294 | 189.50 |
| Speed | 3 per simulation tick | 1.934 per tick |

**Important:** `pipeSpacing:230` is a spawn trigger parameter, not actual pair pitch. Initial pipe x490; new pipe x450 when previous x<160. Tick111 has first x157 and new x450; tick152 has x34 and327. Later separation is294. Do not set new spacing to230 just to match a config name or an image. Preserve first, then assess cadence separately with evidence.

Playing SVG uses tick152 pipe X positions and a constant-.6 RNG geometry fixture (gap397.6–555.6, idealised player centre476.6). It illustrates the correct geometry; it is **not** a recorded human input trace. Ready/result views reuse its composition for UI illustration. Production ready must show the actual initial state; production results retain the actual final frame.

Mobile: tap stage → one queued flap, including fast down/up between ticks. Space/ArrowUp starts and flaps on its first edge; key repeat does not add flaps; release rearms. Do not place a second “tap to flap” button over the cash-out footer. Keep the instruction in-stage and remove/fade it after learned. Cash-out is always a distinct footer action. A tap on it cannot flap.

**Preserve the existing dive exit:** reaching the floor after at least one cleared gate currently cashes out; reaching it before the first gate loses. Retain and test this behaviour. The proposed explicit footer cash-out is an intentional usability addition using the existing pure cash-out operation, so players can find the same shared action across all three games. Label the floor “Dive to cash out” after the first gate, alongside the normal tap hint. Both routes settle once at the same current return; a floor/crash callback cannot pay again after footer settlement. Do not silently turn the existing dive exit into a loss.

## Shatter Step — glass, not plastic buttons

Ten rows, two panes per row. Reference bounds: left x38.8/right x203, width148.2, height40, row pitch48; row10 centre196, row1 centre628. A 44 px minimum hit box centred on the **current** row gives at least4 px separation from adjacent row hit regions. Do not make future/past rows interactive. Draw the runner on the last confirmed safe pane; on ready place it on the starting platform. Render fixture after three safe choices uses left/right/left; row4 is active. Do not show an earlier broken losing pane with an active round.

Glass recipe, using shared atlas parts:

1. Dark shaft/structure visible behind the pane.
2. Thin underside bevel 3–4 px below the surface; pale blue edge at low opacity.
3. Surface tint about10–25% opacity, upper-left highlight and restrained diagonal reflection. Avoid opaque blue pill fills and neon borders.
4. Current row gets a thin accent outline plus a shape/icon cue. Confirmed path gets a small check; do not imply unchosen panes were safe unless the committed round data says so.
5. Wrong choice: reveal that exact selected pane as broken; the safe counterpart comes from the precommitted board. No visual random draw for outcomes or end-of-round reveal.

### Break choreography

Authoritative outcome settles on selection; the animation never delays settlement or permits another tile/cash-out. See `renders/shatter-glass-storyboard.svg`.

| Time from accepted wrong choice | Visual | Audio/input |
|---|---|---|
| 0–35 ms | Local contact flash, runner compresses briefly | Dry impact; immediately lock choices/cash-out |
| 35–85 ms | 5–7 branching cracks radiate from contact | Short high crack, optional tiny haptic if enabled |
| 85–260 ms | Pane surface disappears; 12–20 angular textured shards spread 10–35 px horizontally and fall 25–90 px | Brief glass tinkle; no win sound |
| 260–650 ms | Shards rotate/fade into shaft; jagged remnants remain on frame; runner drops behind | Result can fade in from250 ms; persistent zero return |
| After650 ms | No particles remain; final board is truthful | Play again enabled only after result state is ready |

The storyboard's final panel has no falling shards: implementation must remove/fade the falling pieces by650 ms. Use 4–6 baked irregular shard textures reused by pooled particles, not runtime mesh triangulation. 20 shards × one selected pane, never every tile. No full-screen glass filter. Reduced motion: 80–120 ms crack/crossfade to empty pane, no shake, falling camera or flashing. Audio and haptics independently toggleable. No bright strobe or celebratory net-loss audio.

## Results, settings and branding

Phase machine: ready → playing → settling → settled. An accepted cash-out immediately disables further game actions and shows the frozen authoritative return. Results show **returned credits, original stake and net change**; do not label returned stake as profit. A return below stake uses neutral/loss feedback. CTA changes in-place to Play Again. Do not create a second button or deduct again on double-tap.

Ready balance fixture1000.00; on start debit10.00 once →990.00; Jett return14.50 →1004.50; Flap10.57 →1000.57; Shatter32.74 →1022.74. Loss →990.00. Store money in integer demo-credit hundredths at the settlement boundary. Keep full internal multiplier precision for return calculations; the large multiplier is rounded for display. Cash-out return text is the authoritative amount.

Settings: sound effects, music, reduced motion, high contrast, optional haptics; readable control instructions; persist locally. Pause/suspend safely while modal settings are open and document behaviour. Do not quietly continue a dangerous round behind a settings panel. Accessible live region announces start/result, not every multiplier frame. Desktop sidebars/history are deferred; do not shrink the mobile game to imitate a casino lobby.

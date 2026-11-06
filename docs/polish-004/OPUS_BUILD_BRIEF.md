# JETT-POLISH-004 — sharp mobile rendering, character quality and portable demo host

## Outcome and authority

The owner tested the three-game preview on a phone and found text/buttons blurry and characters insufficiently polished. Deliver a visibly sharper, more professional **Jett, Flap Fortune and Shatter Step** demo, preserving the approved Refined2D direction and game behaviour. Research first, then implement and prove the fixes. Also prepare a small reusable **demo host interface** and technical integration pack, not a real-money platform.

Base implementation: `origin/opus/polish-003-controls` at `97c5797`. This handoff branch, `research/polish-004-sharpness`, includes that implementation. Create `fix/polish-004-sharpness` from this handoff. If newer accepted work exists, compare and integrate deliberately; do not reset or overwrite active branches. Keep Inferno's separate build intact and out of this change. No Kuro Director work.

Read AGENTS.md and its startup requirements. Preserve Phaser4 + TypeScript, existing game exports and Logic/UI/Scene boundaries. No migration to another engine or a new frontend framework. No paytable, odds, hitbox, collision, camera/world visibility or simulation changes for aesthetics. Existing replay/input/ledger/lifecycle tests remain mandatory.

No real-money wallet, blockchain, tokens, licensing system, production wagering server, new game, supplier outreach or casino website build. Named review branches are allowed. No merge, production deployment, deployment-workflow change or permanent public hosting. The earlier temporary preview permission does not authorise a new permanent deployment or extending its lifetime.

## What we have actually established

Read `evidence/delivered-render-measurement.json`, `character-texture-inventory.json` and `jett-delivered-baseline.jpg` in this folder.

- The **delivered compiled preview** was measured at a390×844 CSS viewport: canvas backing store390×844, CSS canvas390×844, image-rendering:auto, no loaded FontFace entries. The measuring browser's DPR was approximately1; **this was not a physical phone or a DPR3 measurement**. The owner's exact phone/browser was requested but is not yet known in this brief.
- Production and preview bootstraps use a390×844 game. Existing research and installed Phaser4.0.0 source show the old game-level `resolution` configuration is not a supported solution here. Inspect actual package source/types before touching renderer sizing. Current shell text already calls `setResolution()` up to3, which does not by itself increase the final canvas backing store.
- The shell asks for Inter but no Inter font files are present in `public/`. Production HTML loads Fredoka from Google, not Inter; the temporary preview loads no custom font faces. A family name in CSS is not evidence that a font loaded.
- Runtime wizard texture178×164, pilot154×196. Large source studies are available (wizard1317×1194, pilot1079×1458). Their alpha bounds and bytes are in the inventory. **Those runtime textures are not automatically too small** for the current47–49px sprites: calculate physical texel coverage at the actual display size and DPR before blaming texture size. Shading complexity, transparent padding, filtering and silhouette readability can also be at fault.
- The original research harness HTML still forces `image-rendering:pixelated`; the delivered temporary preview explicitly used `auto`. Do not confuse those two entry points when comparing screenshots.
- Previous local validation of controls@97c5797: production build passes and317/317 unit tests pass. The cloud report records138 browser checks; they were not rerun locally during this sharpness investigation. No claim that this handoff itself improves quality/performance.

## Answer the owner's overlay question concretely

Evaluate reusable custom panels, icons, textures, nine-slice frames, proper font loading, native browser text and high-density sprite atlases. A generic downloaded “premium overlay” is not a rendering fix. Do not flatten dynamic labels, balance, multiplier, buttons or controls into an image. Paid UI packs are not required for this pilot, and no purchase is authorised.

Official starting references:

- [MDN canvas high-resolution guidance](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas), [devicePixelRatio](https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio).
- [Phaser4 rendering concepts](https://github.com/phaserjs/phaser/blob/master/docs/Phaser%204%20Rendering%20Concepts/Phaser%204%20Rendering%20Concepts.md), [Phaser Text](https://www.phaser.io/oss/docs/phaser/concepts/gameobjects/text), [Bitmap Text](https://phaser.io/oss/docs/phaser/concepts/gameobjects/bitmap-text), [Nine Slice](https://phaser.io/oss/docs/phaser/concepts/gameobjects/nine-slice).
- [TexturePacker's Phaser atlas/nine-slice tutorial](https://www.codeandweb.com/texturepacker/tutorials/how-to-create-sprite-sheets-for-phaser3) illustrates the asset approach but is Phaser3 documentation. Validate exact installed Phaser4 APIs/export format; do not blindly copy it or buy a licence.

Do not claim all top studios use one UI renderer or identical production methods without primary evidence. Separate observed techniques, documentation and our architectural recommendation.

## A — bounded diagnosis/research, then a working rendering spike

Allow one focused60–90 minute research pass, then code. Do not spend the entire session producing another broad research essay. The task is to improve the build, with evidence.

1. Run the latest source AND a minified release build. Record actual scene, SHA, viewport CSS size, browser/DPR, backing size, renderer drawing-buffer dimensions where safely readable, filtering, fonts, canvas CSS transforms, camera/container zoom and render-target sizes. Measure at DPR1/2/3, portrait and short landscape. Record effective backing pixels per CSS pixel, not just a config value.
2. Trace every resampling step: glyph raster → text texture → game framebuffer → CSS scale → physical display; source character → atlas frame → sprite scale → framebuffer. Identify the limiting stage with native screenshot crops. Do not conclude a larger source PNG fixes a low-resolution framebuffer.
3. Compare **two small executable approaches** on Jett's header/multiplier/CTA and one gameplay scene:
   - **A: real high-density Phaser output**, with a fixed logical layout/world and separately sized renderer/cameras/input transforms. Verify local supported APIs, no simulated world enlargement.
   - **B: a visible native DOM/CSS shell** for text/buttons/settings/results over or around Phaser, with game canvas density handled independently. The current accessibility mirror is already a starting point. Prefer B for consistently crisp interactive text if the spike verifies it without introducing duplicate controls or input leaks.
4. Show native-size before/after crops of the same label, CTA and pilot, plus performance/memory numbers. Choose the simplest approach that meets quality and isolation requirements. If A requires a shared renderer refactor, keep it narrow and smoke-test every registered scene. No global engine upgrade or game rewrite.

The expected direction is a **hybrid shell with browser-rendered dynamic UI and an appropriately sized Phaser playfield**, but measure before committing. Crisp vector-looking button backgrounds can be CSS/SVG or verified nine-slice assets; neither fixes an undersized canvas automatically. Bitmap text is an option for frequently changing in-game numbers if measured beneficial, not a universal replacement for accessible UI text.

## B — implement the chosen sharpness strategy across the three pilots

Keep390×844 logical reference coordinates and each existing world transform/collision policy. Physical backing pixels are not world units. The source already has standard and immersive layouts; retain their gameplay proportions and full lethal boundaries.

For the game canvas, choose a documented render-scale policy using actual CSS display size and device DPR, with a measured cap/pixel budget. Target at least2 backing pixels per CSS pixel on capable DPR2/3 devices; use3 only if the mobile budget supports it. Do not blindly multiply a390px logical width by DPR when the CSS canvas is substantially smaller or larger. Any fallback below target must be explicit in the diagnostics. Never change game speed/geometry when reducing render quality.

Check viewport/scene scale, input mapping, DOM alignment, stage masks, particle coordinates, camera viewport, result overlays, screenshots and all pointer/keyboard paths after sizing. Avoid arbitrary `canvas.width` writes outside Phaser ownership. Keep CSS image rendering `auto` for this non-pixel-art style. Snap static UI lines to sensible physical-pixel boundaries where useful; do not quantise simulation/interpolated character movement into jitter.

Typography/control requirements:

- Self-host an appropriately licensed font (Inter is the current preference); include licence, use explicit required weights and wait for `document.fonts.load`/`document.fonts.ready` before first relevant render. Verify the face actually loaded with network/FontFace evidence. Reflow/rebuild canvas glyphs after font readiness if necessary. Do not rely solely on `document.fonts.check` for a nonexistent family.
- Body/control text roughly14–16 CSS px where space permits; secondary labels at least11–12 CSS px at actual rendered size, not unscaled logical units. Tabular numerals; appropriate weight/line-height; moderate tracking. Preserve localisation and long-value space.
- Buttons need deliberate default, pressed, focus and disabled states. Use a restrained flat/softly shaded surface, consistent radius, high contrast, generous label padding and44×44 CSS-pixel minimum actionable targets. Keep the full target inside safe regions without stealing gameplay input.
- One authoritative accessible control and one action per gesture. If promoting the existing hidden DOM mirror to visible UI, retire/hide the equivalent canvas interactive control; do not stack clickable DOM and Phaser twins. Refactor the shared UITheme/drawButton usage only as a documented renderer-specific exception; do not make Phaser Text/Container interactive.
- The demo balance, current return and net result remain authoritative ledger/controller values. Do not continuously rebuild all DOM nodes or announce every multiplier change. Use textContent/attributes and diff updates; no HTML injection.
- Keep portrait and landscape controls genuinely usable. The last report still lists narrow-portrait settings rows and Shatter panes at about30 CSS px tall. Resolve those rather than accepting them because CTA/header passed. Do not overlap adjacent row hit regions to manufacture44px targets.

Loaders, results and settings must be as sharp as the playing state. Do not hide the poor-rendering UI behind a polished screenshot while leaving other states unchanged.

## C — higher-quality character production, not simply larger sprites

Keep the approved identities: ivory-suit amber-visor Jett explorer, purple-hat/broom wizard. The owner now authorises quality refinement; preserve the selected Refined2D style, proportions and recognisability. Do not return to ornate/cinematic AI painting or redesign all environments.

1. Audit original versus runtime assets at actual47–49 CSS px and DPR1/2/3. Draw the collision overlay and mark the opaque body/torso separately from hat, broom, flame and jetpack. Include a100%-scale contact sheet, not just huge zoomed renders.
2. Improve silhouette, eye/visor readability, consistent light direction, clean alpha edges, colour grouping and pose. Reduce ambiguous microdetail. Cropping the alpha bounds alone is not enough if there is faint/noisy low-alpha padding; distinguish full alpha extent from visible-body bounds and record pivot changes.
3. Re-export from the high-resolution master where that genuinely improves sampling. If the design itself remains muddy, produce a controlled sprite cleanup/redraw or a small new candidate—not an automated upscale presented as new art. Keep the old assets available for comparison.
4. Deliver a compact coherent atlas: pilot flying/leaning plus2–3 short flame frames; wizard3 flap/flight poses. Use identical pivots/body alignment across frames. Optional hurt pose can be deferred if time is constrained. Existing Shatter runner may be cleaned up only to maintain consistency; no new character system.
5. Runtime textures must cover the maximum physical display size with headroom; choose suitable1×/2×/3× variants or one adequate atlas. Aim for a sheet≤2048² for the pilot, trim correctly, add documented extrusion and transparent padding and verify the exact atlas loader/filtering on Phaser4. No texture bleeding, black fringes, soft ghost halos or frame-size jumps.

No gameplay footprint changes. If a prettier torso cannot match the existing collision region, adjust the artwork/pivot rather than expanding hitboxes or shrinking hazards. Test all poses and tilts, not just idle. No arbitrary additional sprite enlargement; the scale pass already established the faithful size range.

If cloud has no generation tool, complete the renderer/font/UI fixes and a legitimate source-based asset cleanup plus production spec. Do not invent finished frames, fabricate previews, expose API keys or stop all independent work waiting for an image service. Name incomplete art honestly. Preserve source files, export recipe and provenance/licences; no competitor art extraction. No purchase or external paid-generation request without authorisation.

## D — research casino portability; build a demo integration seam only

The owner wants games that can be offered to multiple casinos without rewriting every UI. Separate three different concerns:

1. **Presentation host:** launch/configuration, game ID/version, theme/logo, language, device/safe areas, lobby return, pause/resume, sound settings and host notifications.
2. **Provider/RGS:** server-authoritative rounds, balances/settlement, authenticated session state, replay/history, idempotent transactions, rollback/reconciliation, reporting and operational support.
3. **Operator/aggregator adapters:** platform-specific contracts, approval/testing and commercial/regulatory onboarding. Branding is not API compatibility and an iframe alone is not complete integration.

Primary research starting points, with exact roles labelled:

- [SOFTSWISS game-provider overview](https://www.softswiss.com/game-providers/): aggregator distribution context, not a public implementable provider SDK specification.
- [EveryMatrix SlotMatrix/RGS partnership example](https://everymatrix.com/news/everymatrix-onboards-spinberry-to-slotmatrix-rgs/): illustrates a studio-to-RGS route. It is a2023 announcement, not current API documentation or a promise of access.
- [Hub88 Wallet API](https://docs.hub88.io/developer-docs/operator-api-reference/wallet-api): **operator-facing** endpoints, signed requests and idempotency examples. Do not present this as the provider-facing contract our browser must implement. A provider reference URL was inaccessible in the initial check; record access limits rather than inventing endpoints.
- [ST8 Operator API](https://docs.st8api.com/): **operator-facing** launch/session/wallet context, including iframe/new-tab launch. It is not proof that our product integrates with ST8.

Limit this pass to those examples and applicable official documentation. Produce a capability matrix: documented pattern, role, what our demo supports, what needs a future backend/adapter and what is unknown. No claim of universal compatibility, actual vendor approval, certification, guaranteed onboarding or observed commercial terms. Do not contact vendors or connect their live APIs.

Implement a **small local fake host** and framework-neutral typed `GameHostAdapter` interface, not a full SDK product. Suggested new files under `src/shared/host/` (adapt names to existing code; keep game three-file boundaries):

- `GameHostAdapter.ts`: types only for validated demo launch config and host events.
- `DemoHostAdapter.ts`: implementation wrapping the existing demo ledger/controller; no second balance truth.
- A developer host page under `research/host/` to embed/launch the built games and test two fictional casino themes. Keep it out of normal production navigation.

Contract requirements: versioned game ID/build/math/config identifiers; demo-only mode; opaque session/round IDs; locale; scoped branding tokens/logo constraints; allowlisted lobby callback; ready/loading/error/pause/round-start/round-settled notifications; immutable result reference and diagnostic replay identifier. Existing round results flow out without granting the host authority to alter outcomes. No raw hidden Shatter board, future RNG state or secret seed in public host events.

If iframe communication is used: exact targetOrigin, source-window and origin allowlists, schema/type validation, handshake/channel version and bounded payloads; never `postMessage('*')` for sensitive state. Treat query parameters/messages/logo URLs as untrusted. Validate origins/URLs, reject script URLs, protect text injection and avoid token logging. Do not implement a general remote command bus. Test embedded and standalone navigation/resize without hard-coded production lobby links. No relying on JavaScript class.name for release scene routing: minification can rename it; test actual built game identity.

Money compatibility is documentation here: future integrations need platform-specific minor-unit/exponent/currency semantics and server idempotency; do not assume all fiat/crypto uses two decimal places. Current demo can retain hundredths. **No live wallet/debit/credit/signing endpoint or crypto settlement is implemented in this pass.** Use local fixtures for duplicate/out-of-order host notifications and demonstrate that they cannot credit/debit twice or control local outcomes. The fake host is not security proof for a future wagering server.

## Implementation order and scope control

1. Evidence baseline and two small rendering approaches; choose and document.
2. Fix typography, fonts, sizing, UI ownership and high-density rendering on Jett; show a real capture before broadening.
3. Apply the verified shared solution to Flap/Shatter, preserving the latest layouts and behaviour.
4. Improve player atlases/poses within the approved style; compare originals and revisions.
5. Add the small demo host interface/harness and integration documentation. This is subordinate to the visible sharpness fix; no backend platform project.
6. Run regressions and deliver the evidence pack. Keep renderer, art and host changes in separate reviewable commits.

Do not mark done after research or a mockup. Deliver at least one complete sharpened real-game segment and the shared solution applied across the three games where feasible. If an engine constraint blocks part of the renderer, finish the native UI/font improvements and report exactly what remains. Do not silently grow into all-game resolution/layout redesign; justify any shared bootstrap change with regression evidence.

## Acceptance checks and evidence

**Rendering:** release-build captures at320×568,390×844,430×932 and two short-landscape sizes; DPR1/2/3, actual canvas/CSS ratio, loaded font evidence, no image-rendering override, native PNG crops with unscaled text/button/player examples. Provided JPEG is a contextual baseline only, not a pixel-quality benchmark. Do not use AI-generated “after” screenshots, browser zoom or resampled/compressed contact sheets as the only quality proof.

**Layout/input:**44 CSS-pixel controls including settings/panes, no overlap or gameplay leakage, focus/labels, long values/translations, safe-area simulation, rotation during play/settings/results, correct inverse coordinate mapping at multiple render scales. Full playfield and lethal boundaries remain visible. HUD obstruction handling still works.

**Gameplay:** identical same-version seeded state/RNG/settlement at matched tick/action logs before/after; cash-out idempotency; no RNG use from text, particles or poses; restart50×, audio ownership and cleanup. Run maintained317-test baseline suite and applicable browser suite; record new tests and exact results. Count alone is not acceptance—assert backing density, loaded faces and physical target sizes.

**Release/embedding:** build succeeds; minified output launches the requested distinct scene; source, release and host-harness captures have matching style/geometry; no old harness pixelation; fake host supports two brand configs/locale and correct back navigation; invalid/untrusted messages rejected; duplicate round events don't re-settle. Smoke-test all registered games if shared main/scale/theme primitives changed. Inferno's separate work must not be overwritten.

**Performance:** renderer scale1/2/3 comparison, p50/p95/p99 frame timing and memory estimate on the same backend/device/DPR; note full-screen pixel work grows quadratically with scale. Keep a quality fallback for weaker devices and explain its crispness tradeoff. No claim of phone performance from software WebGL. Request/record actual owner phone/browser when available; emulation is not physical-device verification. Audio/Safari/Android remaining gaps stay visible.

## Required outputs (commit to repo, not scratchpad)

Under `docs/polish-004/` deliver:

1. `SHARPNESS_DIAGNOSIS.md`: measured limiting stages, runtime/package versions, source/release/harness differences and strategy decision.
2. `UI_AND_ASSET_SPEC.md`: typography/components/states, chosen UI ownership, density policy, font/licence records, asset source/export manifests and before/after contact sheets.
3. `CASINO_INTEGRATION_READINESS.md`: roles, primary sources, host contract, fake adapter usage, validation/security tests and explicit future requirements. Do not describe mocks as deployed integrations.
4. `IMPLEMENTATION_AND_TEST_REPORT.md`: commits, actual screenshots/short gameplay recordings, new tests/full results, performance table and remaining risks.
5. `evidence/`: native release PNGs, crop comparisons, renderer/font/texture diagnostic JSON, test results and host traces with no credentials or private player data.

Keep temporary files/dependencies/dist out of Git except explicitly bounded review assets. Do not reuse the expiring tunnel as a durable delivery link. Provide a review branch/PR and a build/test command that the other account can reproduce. If public preview hosting is needed again, obtain approval for that preview; do not overwrite the current temporary one or the production site.

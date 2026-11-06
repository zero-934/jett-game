# Polish004 — production sharpness and demo portability

Start with [the cloud prompt](START_HERE.md) and [the full research/build brief](OPUS_BUILD_BRIEF.md).

The owner's phone feedback is the trigger: blurry text/buttons, insufficient character quality and a need for a stronger reusable studio package. The previous build is a functional polished pilot, not the final visual-quality bar.

The initial measured preview has a390×844 backing store at a390×844 CSS viewport and no loaded custom font faces. That desktop measurement used DPR≈1; actual phone metrics are still needed. Source inspection shows text texture resolution is already increased, so repeating that setting without fixing the final rendering path is insufficient. See [measurement JSON](evidence/delivered-render-measurement.json) and [texture inventory](evidence/character-texture-inventory.json).

Our proposed direction is a visible browser-rendered shell for crisp dynamic controls/text, paired with correctly sized Phaser output and carefully authored high-density player sprites. Opus must compare two executable approaches first and preserve all game coordinates/behaviour. Custom panels, icons and nine-slice assets can improve presentation; a purchased overlay is neither necessary nor a cure for canvas blur.

The second workstream is integration readiness: one small demo host contract, a fake host and honest documentation of operator/provider/RGS responsibilities. It is not a real-money integration, complete universal SDK, certification claim or server-authoritative wagering backend.

Base: `opus/polish-003-controls@97c5797`. This research handoff only adds docs/evidence; it does not change game code, replace assets, extend the temporary preview or modify production.

## Delivered (branch `opus/polish-004-sharpness`)

Read in this order:
1. [SHARPNESS_DIAGNOSIS.md](SHARPNESS_DIAGNOSIS.md) — measured cause (390×844 framebuffer at every DPR, Inter never loaded), prototypes A/B, chosen hybrid, density policy.
2. [UI_AND_ASSET_SPEC.md](UI_AND_ASSET_SPEC.md) — who draws what, typography, components, overlay answer, character export pipeline, remaining art needs.
3. [CASINO_INTEGRATION_READINESS.md](CASINO_INTEGRATION_READINESS.md) — presentation vs RGS vs operator layers, demo host contract and security behaviour, what a real integration still needs.
4. [IMPLEMENTATION_AND_TEST_REPORT.md](IMPLEMENTATION_AND_TEST_REPORT.md) — commits, exact test results, performance table and limits, risks, next milestone.

Evidence: `evidence/` (release before/after captures, native crops, measurement/perf/test JSON). All evidence is headless Chromium with emulated DPR — no physical-phone measurement yet.

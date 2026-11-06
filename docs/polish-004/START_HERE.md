# Opus cloud — paste this

```text
Repo: zero-934/jett-game
Fetch branch: research/polish-004-sharpness
Create your implementation branch from this handoff, which includes the
latest three-game controls build at97c5797. Do not start from main.

Read AGENTS.md and docs/polish-004/OPUS_BUILD_BRIEF.md in full.

The owner tested the demo on a phone: text/buttons look blurry and the
wizard/Jett pilot need higher production quality. Diagnose first, then fix.
Give the diagnosis one focused60–90 minute research pass, then implement.

Prove actual canvas backing density, font loading, texture sampling and
release-build behaviour. Compare a real high-density Phaser rendering spike
with a visible native DOM/CSS shell; choose based on evidence. Current
setResolution() text calls alone have not solved the final canvas problem.

Keep the approved Refined2D style, layouts and game mechanics. Produce
sharper text/controls and better player art/poses, not another painted
concept or arbitrary enlargement. Preserve exact collision/input mapping.

Research how provider/RGS/operator integration roles differ. Add only a
small demo host interface, local fake host, two branding examples and
integration-readiness report. No real-money wallet, crypto connection,
production server, new game, Inferno changes or Kuro Director work.

Deliver the working three-game visual pass, source assets, native release
captures, diagnostic JSON, tests, performance results and the four reports
specified in the brief. All outputs must be durable in Git, not scratchpad.
No mock fairness/certification/universal-integration claims. Do not merge,
deploy, extend the temporary tunnel or modify production hosting.
```

## Initial evidence and limits

The initial investigation measured the delivered compiled preview at a390×844 CSS viewport in a DPR≈1 desktop browser. Backing store390×844, image-rendering:auto, no loaded font faces. The native phone model/browser remains unverified pending the owner's reply. Runtime and master character sizes are inventoried under `evidence/`; no claim that larger texture dimensions alone solve their quality.

This handoff changes documentation/evidence only relative to `opus/polish-003-controls@97c5797`. The317-test/build baseline was rerun successfully before the owner's phone feedback; no new production change or performance improvement is claimed here. The earlier cloud responsive report records138 browser checks; they are existing evidence, not a fresh run for this brief.

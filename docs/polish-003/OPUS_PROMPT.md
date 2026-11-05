# Paste into Claude Opus cloud

Work in `zero-934/jett-game`, branch `fix/polish-003-opus-handoff`. Fetch it and create your own implementation branch from it. Do not work on or push to main. Do not merge, publish, trigger deploy.yml or modify the existing production deployment. The Opus research commit has already been included; do not reapply patch files.

**Owner-approved visual update:** use `docs/polish-003/VISUAL_REVISION_004.md` and `docs/polish-003/renders/approved-refined-2d-target-v2.png`. The selected style is the happy medium: clean, softly shaded 2D with simple orbital, rooftop and glass-shaft environments. Keep the existing character/gameplay assets. Do not reproduce the old bland backgrounds or the later overly detailed painted concept. If you already started implementation, incorporate this documentation/reference revision without resetting your code or reapplying the research commit.

Read AGENTS.md first. Then read, in order:

1. `docs/polish-003/README.md`
2. `docs/polish-002/EXECUTIVE_REVIEW.md` and `INTEGRATION_HANDOFF.md`
3. `docs/polish-003/VISUAL_REVISION_004.md`, then `ART_AND_LAYOUT.md`
4. `docs/polish-003/BUILD_CONTRACT.md`
5. `docs/polish-003/VALIDATION.md` and `RESEARCH_AND_ASSETS.md`

Build the polish/correctness pilot for **Jett, Flap Fortune and Shatter Step only**, preserving Phaser4 + TypeScript and Logic/UI/Scene separation. The owner selected Direction B **Soft Depth**, now refined by revision004. The new approved PNG controls environment/style; existing character sources remain unchanged; earlier SVGs remain layout/state references only. No image-generation or internet access is necessary to begin. Use layered backgrounds and reusable sprites, not a flattened screenshot. Do not treat generated mockups as exact collision, pipe spacing, sprite-size or payout specifications.

Start with correctness and tests. Review proposed RNG and fixed-step patches instead of copying blindly. In particular, the runner drops excess time after its catch-up limit; explicitly implement/test the foreground hitch and visibility policy. Fix deterministic inputs/coins/board outcomes, exact-once cash-out, event cleanup, audio ownership, swept Jett collisions and truthful Shatter reveals. Remove unsupported RTP marketing; do not retune payout schedules or weaken tests. Follow the documented defaults and call out unresolved economics/cross-game RNG decisions with evidence. Shared fixes require all-game regression, including the two known seeded-test differences.

Implement one representative polished segment per game before reskinning everything: Jett coin pickup to cash-out; Flap two source-accurate pipe pairs to cash-out; Shatter three safe choices, then cash-out or one satisfying glass break. Preserve Flap's current world geometry: gap158, pipe width30, actual pitch293/294 (config230 is only a trigger). Fit its full world uniformly into the stage, preserving lethal boundaries. Glass must be transparent and beveled, crack from contact, shed pooled angular shards and leave an empty broken frame. Never invent reveal outcomes in the renderer.

Make the HUD/results/settings/control shell reusable, mobile-first and themeable gold/emerald/violet. Expose semantic design tokens for casino branding without changing logic. Use a persistent “Demo credits have no cash value” label. Separate gameplay input from the cash-out footer. Support reduced motion, keyboard, focus/labels, contrast and safe areas. Do not add real-money wallets, blockchain, tokens, new games, licensing systems, auto-bet or dual wagers.

You may work headlessly. Use meaningful unit and browser tests for replay across30/60/120/144 Hz, quick taps/key repeat/input isolation, collision edges/tunnelling, same-tick cash-out ordering, truthful Shatter choices/reveal and50 restarts. Capture actual Phaser screenshots and compare environment/style against the approved revision004 PNG and layout/state against the geometry specification/SVGs. Record test commands, frame-time distributions, hardware/backend/DPR, unresolved risks and next milestone. Do not report cloud software-WebGL as mobile performance. Real-device Safari/Android checks remain required before commercial-demo sign-off.

Keep shared prerequisites and one-game changes in separate reviewable commits/branches/PRs. Preserve all existing exports and unrelated games. Show the actual diff, test report and rendered segment before expanding the artistic scope. Finish with a review-ready report; do not deploy or merge.

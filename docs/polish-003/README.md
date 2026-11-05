# JETT-POLISH-003 — Opus cloud build handoff

**Status: artist-approved direction, proposed implementation; no production code changed.** Scope: Jett, Flap Fortune and Shatter Step. Engine: existing Phaser 4 + TypeScript. All balances and stakes are non-redeemable demo credits.

The owner selected **Direction B — Soft Depth** after further visual review. This supersedes the recommendation to ship Direction A in polish-002. “B” here means soft shaded sprites and a restrained modern interface; it does **not** mean copy the older purple illustrated-night mockup. Keep the mechanics while fixing the documented correctness defects.

![Three proposed in-play screens](renders/playing-board.jpg)

![Glass-break timing and material reference](renders/glass-sequence.jpg)

## Start here

1. Read [the verified Opus audit](../polish-002/EXECUTIVE_REVIEW.md) and [integration handoff](../polish-002/INTEGRATION_HANDOFF.md).
2. Read [the artist specification](ART_AND_LAYOUT.md). Open [the contact sheet](index.html) through Vite, or view the committed [Jett](renders/jett-playing-gold.svg), [Flap](renders/flap-playing-gold.svg), [Shatter](renders/shatter-playing-gold.svg) and [glass storyboard](renders/shatter-glass-storyboard.svg).
3. Read [the engineering build contract](BUILD_CONTRACT.md), including pending economics decisions, replay requirements and PR boundaries.
4. Use [the copyable cloud prompt](OPUS_PROMPT.md), [validation report](VALIDATION.md) and [research/provenance](RESEARCH_AND_ASSETS.md).

## Visual package

- `renders/`: 36 editable, standalone SVG screens: three games × ready/playing/cashed-out/loss × gold/emerald/violet. SVGs embed their character references, so GitHub and browser viewers need no asset server. One four-panel glass sequence.
- `assets/`: transparent pilot and wizard studies plus the earlier A/B/C direction reference. Only its B column is selected. These PNGs are art inputs, not production-ready animation atlases.
- `design-tokens.json`: semantic palette, exact reference viewport, shell regions and geometry. Keep casino branding behind these tokens; never modify game math for a colour variant.
- `render-mockups.cjs`: regenerates the SVGs, tokens and local preview. It is design tooling only. Run `node docs/polish-003/render-mockups.cjs`, then `npm run dev` and open `/jett-game/docs/polish-003/index.html`.
- `evidence/`: tests and build rerun locally for this handoff. Baseline gameplay captures and performance probes remain under `docs/polish-002/evidence/`.

See also the [baseline-versus-proposal sheet](renders/before-after.jpg), [cash-out results](renders/cashed-out-board.jpg), [loss states](renders/loss-board.jpg), [emerald](renders/emerald-board.jpg) and [violet](renders/violet-board.jpg) skins. These are proposed screens, not implemented after-captures.

**Reference precedence:** verified production logic and explicit bug-fix decisions → exact geometry notes → screen SVG layout → raster material studies. A screenshot must never become a source of collision boxes, random outcomes or payout values.

The original research commit `151a5005753d9be45deb82b2ec7b96031ef88549` was fetched from `origin/research/jett-polish-002` and cherry-picked as `b1c7482` onto this handoff branch. Its parent was `616fd82`; the research itself touches no production files. Do not apply an additional patch copy over this commit.

## Next milestone

Deliver correctness fixes and **one polished, tested segment per game**: Jett coin pickup → cash-out; Flap two correctly spaced pipe pairs → cash-out; Shatter three safe choices → either cash-out or one visibly shattered wrong choice. Show actual Phaser screenshots beside these references before expanding the art across all content. Keep shared-system fixes and each game's implementation reviewable separately. No merge, deployment or production change is authorized by this handoff.

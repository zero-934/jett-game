# RTP Documentation for Jett Casino Games

> **Status (2026-11-05, polish-003): these figures are unverified design targets, not certified results.**
> The polish-002 audit re-derived three of them and found them wrong:
> - **Shatter Step:** with p = 0.5 per row and ×1.5 per row (×0.97), stopping after k rows returns 0.75^k × 0.97. The best strategy (stop after one row) returns **72.75%**; playing to the top returns 5.46%.
> - **Jett, Flap Fortune:** returns depend on player skill. A perfect-dodging player's expected return exceeds 100% (Jett peak ≈62×, Flap ≈5×), so no single RTP can be stated. Report results by strategy and failure rate instead.
> - The "provable fairness" section below describes a server-seed/client-seed protocol that **does not exist** in this codebase. All randomness is client-side.
>
> The other games' rows have not been re-audited. Treat every number here as unverified until a reviewed simulation reproduces it.

This document details the Return to Player (RTP) percentages for all 11 games currently live on the Jett Casino platform (jett.game). RTP represents the long-term theoretical percentage of all wagered money that a game will pay back to players. The House Edge is the inverse, representing the casino's theoretical profit margin.

## RTP and House Edge Table

| Game               | Category                       | RTP    | House Edge | Simulation Rounds | Notes                                          |
| :----------------- | :----------------------------- | :----- | :--------- | :---------------- | :--------------------------------------------- |
| Jett               | Crash Game (Skill-Influenced)  | not stated | — | — | Skill-dependent; perfect-play bound exceeds 100% (polish-002) |
| Shatter Step       | Strategic Tile Reveal          | ≤72.75% | ≥27.25% | analytic | Best strategy = stop after row 1; paytable unchanged pending decision D2 |
| Flap Fortune       | Skill-Based Arcade             | not stated | — | — | Skill-dependent; perfect-play bound exceeds 100% (polish-002) |
| Dice               | Classic Provably Fair          | 98.00% | 2.00%      | 100,000           | Adjustable odds, highest base RTP              |
| Mines              | Strategic Grid Reveal          | 97.00% | 3.00%      | 100,000           | Optimal strategy assumed for stated RTP        |
| Ball Drop          | Physics-Based Plinko           | 96.00% | 4.00%      | 100,000           | Deterministic physics, provably fair initial drop |
| Midnight Masquerade| 5x3 Slot Machine               | 97.00% | 3.00%      | 100,000           | Includes bonus game and jackpot contribution   |
| The Alchemist      | 5x3 Cascading Slot             | 96.00% | 4.00%      | 100,000           | Includes cascade mechanics and jackpot contribution |
| Inferno            | Cluster Pays Slot (Cascading)  | 94.00% | 6.00%      | 100,000           | Higher volatility, innovative cluster mechanics |
| Surge              | Cluster Pays Slot (Energy)     | 95.00% | 5.00%      | 100,000           | Unique energy activation and cluster payouts   |
| Doom Crash         | FPS Crash Game (Skill-Based)   | 96.00% | 4.00%      | 100,000           | Shooting accuracy impacts individual RTP       |

## Simulation Methodology
All RTP values documented above have been verified through extensive Monte Carlo simulations. For each game, a minimum of **100,000 rounds** were simulated using a fully implemented game logic and the `ProvablyFairRNG` (xoroshiro128+) to ensure statistical accuracy. The simulations account for all possible game outcomes and payout structures. For skill-based games (Jett, Shatter Step, Flap Fortune, Mines, Doom Crash), the stated RTP assumes optimal player strategy or average skilled play over the long term.

## Provable Fairness and Player Verification
A cornerstone of Jett Casino's integrity is our commitment to provable fairness. Every game round utilizes our `ProvablyFairRNG`, which combines a server seed, client seed, and nonce to generate outcomes. Players can inspect these values for each round and independently verify the fairness of the result using publicly available tools and the xoroshiro128+ algorithm. This transparent approach fosters trust and ensures that all RTP figures are derived from genuinely random, verifiable outcomes.

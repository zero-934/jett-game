# Doom Crash 2.0 Concept Document

## Concept: World-First FPS Crash Game

Doom Crash 2.0 reinvents the popular crypto "crash" game genre by integrating a first-person shooter (FPS) mechanic, creating a truly unique "Interactive Risk Management Gaming" experience. Players navigate a Doom-style corridor, facing increasingly aggressive pixel-art enemies. Instead of simply cashing out, players must actively shoot enemies to reduce the probability of a "crash" (game over) event, while continuously weighing the growing multiplier against the escalating risk. It's a high-stakes blend of skill, timing, and nerve.

## Gameplay Loop

1.  **Bet & Start**: Player places a bet and initiates the game.
2.  **Corridor Progression & Multiplier**: The game begins, and the player's character moves forward through a procedurally generated pixel-art corridor. A multiplier starts at 1.00x and rapidly increases.
3.  **Enemy Encounters**: Enemies (e.g., imps, demons) appear from various points in the corridor.
4.  **Skill Layer (Shooting)**: The player uses a mouse/touch to aim and click/tap to shoot enemies. Each successful hit or kill contributes to reducing the "crash probability" for that specific round. Misses or slow reactions increase the danger.
5.  **Risk Management (Cash Out)**: At any point, the player can choose to "cash out" and secure their current multiplier. The longer they stay, the higher the potential payout, but also the higher the risk of a crash.
6.  **The Crash**: If the provably fair RNG dictates a crash (influenced by player skill), the game ends, and the player loses their bet unless they have cashed out. The crash event is visually impactful (e.g., screen shatters, character explodes).

## The Skill Layer: Shooting Accuracy Reduces Crash Probability

This is the core innovation. Unlike traditional crash games where the crash point is purely random, in Doom Crash, the player's **shooting accuracy and speed directly influence the probability distribution of the crash event**.

*   **Base Crash Probability**: A baseline probability increases with time/multiplier.
*   **Skill Modifier**: Each successful enemy hit/kill provides a temporary or cumulative reduction in the instantaneous crash probability. For example, clearing a wave of enemies might grant a 5% reduction in crash chance for the next 2 seconds.
*   **Scaling Difficulty**: Enemies become faster, more numerous, or require more hits at higher multipliers, demanding greater skill to maintain a low crash probability.
*   **Provably Fair Integration**: The underlying crash point is still determined by the `ProvablyFairRNG`, but the player's skill actively "modifies" the conditions under which that RNG is applied, making skilled play statistically superior over the long term.

## House Edge & RTP

*   **RTP**: 96.00%
*   **House Edge**: 4.00%
The RTP is calculated assuming an average level of skill over extended play. Highly skilled players who consistently make optimal decisions and demonstrate superior accuracy will, over time, achieve an effective RTP closer to or slightly above the stated average (within the bounds of the 4% house edge). All outcomes are provably fair, verifiable by the player via server seed, client seed, and nonce.

## Technical Implementation

Doom Crash will leverage Jett Casino's robust 3-file architecture:

*   **`DoomCrashLogic.ts`**: Handles game state, multiplier progression, enemy spawning logic, crash probability calculation (incorporating skill modifiers), and interaction with `ProvablyFairRNG`.
*   **`DoomCrashUI.ts`**: Manages on-screen elements like the multiplier display, cash-out button, score, and shooting feedback.
*   **`DoomCrashScene.ts`**: The Phaser 3 game scene, responsible for rendering the FPS corridor, player weapon, pixel-art enemies, hit detection, and visual crash effects.
*   **`ProvablyFairRNG.ts`**: Provides the core random numbers for crash events, enemy patterns, and other random elements, ready for Solana VRF.

## Visual Design: Midnight Luxury meets Pixel Gore

The aesthetic will be a unique blend, retaining the "Midnight Luxury" palette of Jett Casino while incorporating classic "Doom"-era pixel art.

*   **Environment**: Dark, grungy, pixelated sci-fi corridors with flickering lights and industrial elements.
*   **Enemies**: Iconic low-res pixel art demons (imps, cacodemons) with simple, recognizable attack patterns.
*   **Player UI**: Minimalist, sleek UI contrasting with the pixelated environment, incorporating Jett's brand colors.
*   **Effects**: Chunky pixel blood, impactful weapon feedback, and a dramatic "crash" animation.

## Legal Classification: Interactive Risk Management Gaming

Doom Crash is a prime example of "Interactive Risk Management Gaming." The player's active skill (shooting accuracy, reaction time, decision-making on when to cash out) directly influences the game's risk profile and potential reward. This moves it significantly beyond a pure game of chance, bolstering its position for licensing under skill-based gaming regulations.

## Market Opportunity & Viral Potential

Doom Crash targets a unique demographic: traditional gamers who may be hesitant to engage with "gambling" but are drawn to skill-based challenges and nostalgic FPS aesthetics. Its "world-first" status offers immense viral potential, attracting attention from both crypto gaming and traditional gaming communities. It bridges the gap between competitive gaming and crypto casinos, offering a fresh, engaging, and highly shareable experience.

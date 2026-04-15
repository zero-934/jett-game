/**
 * @file characters.ts
 * @purpose Central character registry for jett.game.
 *          All default/placeholder characters are defined here.
 *          To swap a character for AI-generated art or an NFT, update the
 *          relevant entry in this file — the games pick it up automatically.
 *
 *          HOW TO ADD A REAL CHARACTER (when AI art is ready):
 *          1. Generate the image (recommended: 128×128 or 256×256 transparent PNG)
 *          2. Host it (Vercel /public folder, CDN, or IPFS for NFTs)
 *          3. Set `imageUrl` on the relevant CharacterDef below
 *          4. Optionally set `nftId` + `nftContractAddress` for NFT linking
 *          5. That's it — the game will use the image automatically
 *
 * @author Agent 934
 * @date 2026-04-14
 * @license Proprietary – available for licensing
 */

import type { CharacterDef } from './CharacterDef';

// ─── Jett ────────────────────────────────────────────────────────────────────
// Used in: JettUI.ts
// Appearance: stick figure with jetpack
// To replace: set imageUrl to a 128×128 PNG of your astronaut/jetpack character

/**
 * Default character for the Jett game.
 * Placeholder: code-drawn stick figure + jetpack (gold + blue).
 *
 * @example
 * // To swap for AI art:
 * jettCharacter.imageUrl = 'https://cdn.jett.game/characters/jett-001.png';
 */
export const jettCharacter: CharacterDef = {
  key: 'jett-default',
  name: 'Jett',
  // imageUrl: undefined,  ← set this when AI art is ready
  fallbackDraw: undefined, // Jett's placeholder is drawn inline in JettUI.ts for now
  meta: {
    game: 'Jett',
    role: 'pilot',
    description: 'An astronaut with a gold jetpack dodging asteroids.',
    designNotes: 'Humanoid, space suit, gold visor, compact jetpack with twin nozzles.',
  },
};

// ─── Shatter Step ────────────────────────────────────────────────────────────
// Used in: ShatterStepUI.ts
// Appearance: figure on glass tiles
// To replace: set imageUrl to a 128×128 PNG of your character

/**
 * Default character for the Shatter Step game.
 * Placeholder: code-drawn stick figure (ice blue).
 *
 * @example
 * // To swap for AI art:
 * shatterCharacter.imageUrl = 'https://cdn.jett.game/characters/shatter-001.png';
 */
export const shatterCharacter: CharacterDef = {
  key: 'shatter-default',
  name: 'Shatter',
  // imageUrl: undefined,  ← set this when AI art is ready
  fallbackDraw: undefined,
  meta: {
    game: 'Shatter Step',
    role: 'daredevil',
    description: 'A daring figure stepping across crumbling glass tiles.',
    designNotes: 'Lightweight, agile, wearing ice-blue gear. Slightly fearful expression.',
  },
};

// ─── Flap Fortune ────────────────────────────────────────────────────────────
// Used in: FlapFortuneUI.ts
// Appearance: wizard on broomstick
// To replace: set imageUrl to a 128×128 PNG of your character

/**
 * Default character for the Flap Fortune game.
 * Placeholder: code-drawn wizard on broomstick (purple robe, gold stars).
 *
 * @example
 * // To swap for AI art:
 * flapCharacter.imageUrl = 'https://cdn.jett.game/characters/flap-001.png';
 */
export const flapCharacter: CharacterDef = {
  key: 'flap-default',
  name: 'The Wizard',
  // imageUrl: undefined,  ← set this when AI art is ready
  fallbackDraw: undefined,
  meta: {
    game: 'Flap Fortune',
    role: 'wizard',
    description: 'A robed wizard flying through pipe gates on a broomstick.',
    designNotes: 'Purple robe, tall pointed hat, gold stars, white beard. Compact silhouette.',
  },
};

// ─── Dice ─────────────────────────────────────────────────────────────────────
// Used in: DiceUI.ts
// Appearance: no character per se — dice are the visual focus
// May be given a "dealer" character in the future

/**
 * Default character for the Dice game (dealer persona).
 * Not currently rendered — reserved for future UI.
 */
export const diceDealer: CharacterDef = {
  key: 'dice-dealer-default',
  name: 'The Dealer',
  // imageUrl: undefined,  ← set this when AI art is ready
  fallbackDraw: undefined,
  meta: {
    game: 'Dice',
    role: 'dealer',
    description: 'A mysterious dealer figure who rolls the dice.',
    designNotes: 'Shadowy, gold cufflinks, holding dice. Think midnight casino aesthetic.',
  },
};

// ─── Mines ────────────────────────────────────────────────────────────────────
// Used in: MinesUI.ts
// Appearance: no character yet — tiles are the focus

/**
 * Default character for the Mines game (explorer persona).
 * Not currently rendered — reserved for future UI.
 */
export const minesExplorer: CharacterDef = {
  key: 'mines-explorer-default',
  name: 'The Explorer',
  // imageUrl: undefined,  ← set this when AI art is ready
  fallbackDraw: undefined,
  meta: {
    game: 'Mines',
    role: 'explorer',
    description: 'A treasure hunter carefully revealing tiles.',
    designNotes: 'Adventure gear, headlamp, nervous energy. Compact icon-sized design.',
  },
};

// ─── Ball Drop ────────────────────────────────────────────────────────────────
// Used in: BallDropUI.ts
// Appearance: no character yet — ball is the focus

/**
 * Default character for the Ball Drop game.
 * Not currently rendered — reserved for future UI (e.g. a character who drops the ball).
 */
export const ballDropper: CharacterDef = {
  key: 'balldrop-default',
  name: 'The Dropper',
  // imageUrl: undefined,  ← set this when AI art is ready
  fallbackDraw: undefined,
  meta: {
    game: 'Ball Drop',
    role: 'player',
    description: 'A character who drops and nudges the ball through the peg board.',
    designNotes: 'Playful, arcade aesthetic. Could hold a ball or lever. Gold accents.',
  },
};

// ─── Fruit Fiesta ────────────────────────────────────────────────────────
// Used in: FruitFiestaUI.ts
// Appearance: Fruit-themed character / mascot
// To replace: set imageUrl to a 128×128 PNG of your character

/**
 * Default character for the Tropical Fruit Fiesta game.
 * Placeholder: code-drawn stylized fruit (gold accents).
 */
export const fruitFiestaCharacter: CharacterDef = {
  key: 'fruit-fiesta-default',
  name: 'Fiesta Fruity',
  // imageUrl: undefined,  ← set this when AI art is ready
  fallbackDraw: undefined, // UI handles drawing if imageUrl is not set
  tint: GOLD,
  meta: {
    game: 'Tropical Fruit Fiesta',
    role: 'mascot',
    description: 'A vibrant fruit mascot inviting players to the fiesta.',
    designNotes: 'Stylized, friendly fruit, maybe a sombrero or maracas. Bright colors with gold.',
  },
};

// ─── Cosmic Quest ────────────────────────────────────────────────────────
// Used in: CosmicQuestUI.ts
// Appearance: Astronaut / Alien / Space-themed character
// To replace: set imageUrl to a 128×128 PNG of your character

/**
 * Default character for the Cosmic Quest game.
 * Placeholder: code-drawn astronaut/rocket (gold).
 */
export const cosmicQuestCharacter: CharacterDef = {
  key: 'cosmic-quest-default',
  name: 'Cosmic Explorer',
  // imageUrl: undefined,  ← set this when AI art is ready
  fallbackDraw: undefined, // UI handles drawing if imageUrl is not set
  tint: GOLD,
  meta: {
    game: 'Cosmic Quest',
    role: 'explorer',
    description: 'A fearless explorer navigating the cosmos.',
    designNotes: 'Astronaut suit, rocket motifs, gold accents, futuristic design.',
  },
};

// ─── Wild Frontier ─────────────────────────────────────────────────────────
// Used in: WildFrontierUI.ts
// Appearance: Cowboy/Indigenous Guide themed character
// To replace: set imageUrl to a 128×128 PNG of your character

/**
 * Default character for the Wild Frontier game.
 * Placeholder: code-drawn cowboy hat / star badge (gold).
 */
export const wildFrontierCharacter: CharacterDef = {
  key: 'wild-frontier-default',
  name: 'Wild Frontiersman',
  // imageUrl: undefined,  ← set this when AI art is ready
  fallbackDraw: undefined, // UI handles drawing if imageUrl is not set
  tint: GOLD,
  meta: {
    game: 'Wild Frontier',
    role: 'explorer',
    description: 'A brave explorer seeking gold in the frontier.',
    designNotes: 'Classic cowboy hat, sheriff star badge, earthy tones with gold accents.',
  },
};

// ─── Registry ─────────────────────────────────────────────────────────────────

/**
 * Central character registry — all characters indexed by their game key.
 * Use this to look up a character by game name or iterate all characters.
 *
 * @example
 * const char = CHARACTER_REGISTRY['jett'];
 * renderCharacter(scene, char, x, y);
 */
export const CHARACTER_REGISTRY: Record<string, CharacterDef> = {
  jett:      jettCharacter,
  shatter:   shatterCharacter,
  flap:      flapCharacter,
  dice:      diceDealer,
  mines:     minesExplorer,
  ballDrop:  ballDropper,
  wildFrontier: wildFrontierCharacter,
  cosmicQuest: cosmicQuestCharacter,
  fruitFiesta: fruitFiestaCharacter,
};

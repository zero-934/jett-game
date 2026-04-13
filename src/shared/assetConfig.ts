/**
 * @file assetConfig.ts
 * @purpose Central asset registry — all game asset paths defined here.
 *          To swap any asset, change only this file. No game logic changes needed.
 *          Supports placeholder (colored rect) mode and real PNG/sprite mode.
 * @author Agent 934
 * @date 2026-04-13
 * @license Proprietary – available for licensing
 */

/**
 * Asset mode — 'placeholder' uses colored rectangles (current),
 * 'sprites' loads actual image files from the paths below.
 */
export const ASSET_MODE: 'placeholder' | 'sprites' = 'placeholder';

/** Base path for all asset files. */
const BASE = 'assets';

/**
 * Global shared assets used across multiple games.
 *
 * @example
 * this.load.image(SHARED_ASSETS.ui.cashOutButton, SHARED_ASSETS.ui.cashOutButton);
 */
export const SHARED_ASSETS = {
  ui: {
    cashOutButton: `${BASE}/ui/cash-out-button.png`,
    homeButton:    `${BASE}/ui/home-button.png`,
    goldCoin:      `${BASE}/ui/gold-coin.png`,
  },
  fonts: {
    primary: 'Fredoka One',
  },
} as const;

/**
 * Jett game assets.
 * Swap character, jetpack, or asteroid sprites here without touching JettUI.ts.
 *
 * @example
 * this.load.image(JETT_ASSETS.player.body, JETT_ASSETS.player.body);
 */
export const JETT_ASSETS = {
  player: {
    /** Stick figure body sprite (currently: gold rectangle placeholder) */
    body:    `${BASE}/jett/player-body.png`,
    /** Head sprite (currently: gold circle placeholder) */
    head:    `${BASE}/jett/player-head.png`,
    /** Jetpack sprite (currently: blue rectangle placeholder) */
    jetpack: `${BASE}/jett/jetpack.png`,
    /** Flame effect sprite sheet */
    flame:   `${BASE}/jett/flame.png`,
  },
  obstacles: {
    /** Asteroid sprite (currently: drawn polygon placeholder) */
    asteroid:      `${BASE}/jett/asteroid.png`,
    /** Asteroid variant 2 */
    asteroidLarge: `${BASE}/jett/asteroid-large.png`,
  },
  background: {
    /** Space background tile */
    space:   `${BASE}/jett/bg-space.png`,
    /** Planet 1 decoration */
    planet1: `${BASE}/jett/planet-1.png`,
    /** Planet 2 decoration */
    planet2: `${BASE}/jett/planet-2.png`,
  },
} as const;

/**
 * Shatter Step game assets.
 * Swap tile texture, player sprite, or FX here.
 *
 * @example
 * this.load.image(SHATTER_ASSETS.tile.glass, SHATTER_ASSETS.tile.glass);
 */
export const SHATTER_ASSETS = {
  tile: {
    /** Glass tile texture (currently: drawn translucent rectangle) */
    glass:       `${BASE}/shatter/tile-glass.png`,
    /** Cracked glass overlay */
    glassCracked: `${BASE}/shatter/tile-glass-cracked.png`,
    /** Winning tile glow */
    glowGreen:   `${BASE}/shatter/tile-glow-green.png`,
    /** Losing tile glow */
    glowRed:     `${BASE}/shatter/tile-glow-red.png`,
  },
  player: {
    /** Stick figure idle sprite (currently: drawn placeholder) */
    idle:  `${BASE}/shatter/player-idle.png`,
    /** Stick figure walking sprite */
    walk:  `${BASE}/shatter/player-walk.png`,
    /** Stick figure falling sprite */
    fall:  `${BASE}/shatter/player-fall.png`,
    /** Money bag prop */
    moneyBag: `${BASE}/shatter/money-bag.png`,
  },
  fx: {
    /** Glass shard particle */
    shard: `${BASE}/shatter/shard.png`,
  },
  background: {
    bg: `${BASE}/shatter/bg.png`,
  },
} as const;

/**
 * Flap Fortune game assets.
 * Swap wizard, broomstick, gate textures, or background here.
 *
 * @example
 * this.load.image(FLAP_ASSETS.player.wizardIdle, FLAP_ASSETS.player.wizardIdle);
 */
export const FLAP_ASSETS = {
  player: {
    /** Wizard body sprite (currently: drawn placeholder) */
    wizardIdle:  `${BASE}/flap/wizard-idle.png`,
    /** Wizard flying animation frame 1 */
    wizardFly1:  `${BASE}/flap/wizard-fly-1.png`,
    /** Wizard flying animation frame 2 */
    wizardFly2:  `${BASE}/flap/wizard-fly-2.png`,
    /** Broomstick sprite */
    broom:       `${BASE}/flap/broom.png`,
  },
  obstacles: {
    /** Top portcullis gate section (currently: drawn stone/iron placeholder) */
    gateTop:    `${BASE}/flap/gate-top.png`,
    /** Bottom portcullis gate section */
    gateBottom: `${BASE}/flap/gate-bottom.png`,
    /** Stone wall tile (tiled behind gate) */
    stoneWall:  `${BASE}/flap/stone-wall.png`,
  },
  background: {
    /** Twilight sky gradient */
    sky:            `${BASE}/flap/bg-sky.png`,
    /** Castle silhouette layer */
    castles:        `${BASE}/flap/bg-castles.png`,
    /** Ground cobblestone tile */
    ground:         `${BASE}/flap/bg-ground.png`,
    /** Torch glow sprite */
    torch:          `${BASE}/flap/torch.png`,
    /** Moon sprite */
    moon:           `${BASE}/flap/moon.png`,
  },
} as const;

/**
 * Returns true if the game should load sprite assets.
 * When false, all UIs fall back to colored rectangle placeholders.
 *
 * @returns boolean
 *
 * @example
 * if (useSprites()) { this.load.image(...) }
 */
export function useSprites(): boolean {
  return ASSET_MODE === 'sprites';
}

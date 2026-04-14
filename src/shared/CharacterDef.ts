/**
 * @file CharacterDef.ts
 * @purpose Defines the universal character interface for jett.game.
 *          All games accept an optional CharacterDef. If none is provided,
 *          the game falls back to its built-in placeholder renderer.
 *          Designed for future NFT integration — swap imageUrl or nftId
 *          and the character updates everywhere automatically.
 * @author Agent 934
 * @date 2026-04-14
 * @license Proprietary – available for licensing
 */

import type * as Phaser from 'phaser';

// ─── Core Interface ───────────────────────────────────────────────────────────

/**
 * A character definition — the universal "socket" for swappable characters.
 *
 * To use a placeholder: omit imageUrl and provide fallbackDraw.
 * To use AI-generated art: provide imageUrl (and optionally preload the texture).
 * To link an NFT: provide nftId + nftContractAddress.
 *
 * @example
 * // Placeholder character (no art needed)
 * const wizard: CharacterDef = {
 *   key: 'wizard-default',
 *   name: 'The Wizard',
 *   fallbackDraw: (scene, x, y) => drawWizardPlaceholder(scene, x, y),
 * };
 *
 * @example
 * // AI-generated / NFT character
 * const nftWizard: CharacterDef = {
 *   key: 'wizard-nft-001',
 *   name: 'Arcane Wizard #001',
 *   imageUrl: 'https://cdn.jett.game/characters/wizard-001.png',
 *   nftId: '001',
 *   nftContractAddress: '0xABC...',
 *   walletAddress: '0xOWNER...',
 * };
 */
export interface CharacterDef {
  /**
   * Unique key used as the Phaser texture key.
   * Must be unique per character variant (e.g. 'wizard-default', 'wizard-nft-042').
   */
  key: string;

  /** Display name shown in UI (e.g. leaderboards, character select). */
  name: string;

  /**
   * Optional URL to the character's image asset (AI-generated or hand-drawn).
   * When provided, the game will attempt to load this as a Phaser texture.
   * Recommended size: 128×128 px minimum, transparent PNG.
   */
  imageUrl?: string;

  /**
   * Optional fallback renderer — called when no imageUrl is set or texture
   * has not yet loaded. Receives the current Phaser scene and position.
   * This is how placeholder (code-drawn) characters work.
   *
   * @param scene - The active Phaser scene.
   * @param x - World x position to draw at.
   * @param y - World y position to draw at.
   * @param scale - Optional scale multiplier (default 1.0).
   */
  fallbackDraw?: (
    scene: Phaser.Scene,
    x: number,
    y: number,
    scale?: number
  ) => void;

  /**
   * Optional tint colour applied to the character sprite (Phaser integer format).
   * Useful for palette-swapped variants without needing new art.
   * @example 0xc9a84c  // gold tint
   */
  tint?: number;

  // ── NFT fields (future — not used yet) ────────────────────────────────────

  /**
   * Token ID of the NFT this character represents.
   * Not used yet — reserved for future wallet integration.
   */
  nftId?: string;

  /**
   * Smart contract address for the NFT collection.
   * Not used yet — reserved for future wallet integration.
   */
  nftContractAddress?: string;

  /**
   * Wallet address of the owner.
   * Not used yet — reserved for future wallet/auth integration.
   */
  walletAddress?: string;

  /**
   * Arbitrary metadata bag for future extensions
   * (rarity, traits, edition, etc.).
   */
  meta?: Record<string, unknown>;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Returns true if a CharacterDef has a usable image texture (not a placeholder).
 *
 * @param char - The character definition to check.
 * @returns True if imageUrl is set.
 *
 * @example
 * if (hasImage(myCharacter)) {
 *   scene.add.image(x, y, myCharacter.key);
 * } else {
 *   myCharacter.fallbackDraw?.(scene, x, y);
 * }
 */
export function hasImage(char: CharacterDef): boolean {
  return typeof char.imageUrl === 'string' && char.imageUrl.length > 0;
}

/**
 * Renders a character at the given position.
 * Prefers the image texture if available; falls back to fallbackDraw.
 * If neither is available, renders nothing (safe no-op).
 *
 * @param scene - The active Phaser scene.
 * @param char - The character definition.
 * @param x - World x position.
 * @param y - World y position.
 * @param scale - Optional scale multiplier.
 * @returns The created Phaser Image, or null if using fallbackDraw.
 *
 * @example
 * renderCharacter(this, characters.jett, playerX, playerY, 1.0);
 */
export function renderCharacter(
  scene: Phaser.Scene,
  char: CharacterDef,
  x: number,
  y: number,
  scale = 1.0
): Phaser.GameObjects.Image | null {
  if (hasImage(char) && scene.textures.exists(char.key)) {
    const img = scene.add.image(x, y, char.key).setScale(scale);
    if (char.tint !== undefined) img.setTint(char.tint);
    return img;
  }

  char.fallbackDraw?.(scene, x, y, scale);
  return null;
}

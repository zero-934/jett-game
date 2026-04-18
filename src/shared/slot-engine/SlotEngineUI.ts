/**
 * @file SlotEngineUI.ts
 * @purpose Provides a Phaser 3 UI class for rendering slot machine reels and animations.
 * @author Agent 934
 * @date 2026-04-16
 * @license Proprietary – available for licensing
 */

import * as Phaser from 'phaser';
import { CasinoAudioManager } from '../audio/CasinoAudioManager';
import type { SlotConfig, SlotSpinState, SlotWinLine } from './SlotEngineLogic';
// ProvablyFairRNG is not directly used for logic here, but might be useful for type hints or if UI needs to create its own RNG for visual effects.
// For now, it's not strictly necessary as logic is delegated.
// import { ProvablyFairRNG } from '../rng/ProvablyFairRNG';

// --- Constants ---
// const GOLD = 0xc9a84c; // reserved for future hex usage
const GOLD_STR = '#c9a84c';
const DARK = 0x0d0d0d;
// const DARK_STR = '#0d0d0d'; // reserved for future usage

const REEL_WIDTH = 150;
const REEL_HEIGHT = 150;
const SYMBOL_FONT_SIZE = 64;
const SYMBOL_FONT_FAMILY = 'Arial';
const SYMBOL_COLOR = GOLD_STR;
const HIGHLIGHT_COLOR = 0xffffff; // White for highlight border
const HIGHLIGHT_THICKNESS = 5;
const HIGHLIGHT_ALPHA = 0.8;

const SPIN_DURATION_PER_REEL = 500; // ms
const REEL_SPIN_DELAY = 150; // ms between reel starts
const SYMBOL_TWEEN_EASE = 'Quad.easeOut';

// Default emoji mapping for symbols
const DEFAULT_SYMBOL_EMOJI: Record<string, string> = {
  'WILD': '✨',
  'SCATTER': '💎',
  'GOLDEN_MASK': '🎭',
  'CHAMPAGNE': '🍾',
  'PEACOCK': '🦚',
  'GLOVES': '🧤',
  'CLOCK': '🕰️',
  'SLIPPER': '👠',
  'INVITATION': '✉️',
  'MUSIC': '🎶',
  'PHILOSOPHERS_STONE': '🪨',
  'ELIXIR': '🧪',
  'GRIMOIRE': '📜',
  'CAULDRON': '🍲',
  'HOURGLASS': '⏳',
  'VIAL': '⚗️',
  'MORTAR': '🥣',
  'RUNE': ' runes', // Using text for rune as emoji is less clear
};

/**
 * Extends SlotConfig to include UI-specific properties like symbol emoji mapping.
 * This interface is local to the UI file and does not modify the core SlotConfig.
 */
export interface SlotUIConfig extends SlotConfig {
  symbolEmoji?: Record<string, string>;
}

/**
 * SlotEngineUI class handles the visual rendering and animations of the slot machine.
 * It delegates all game logic and RNG calls to `SlotEngineLogic`.
 */
export class SlotEngineUI {
  private audioManager: CasinoAudioManager;
  private scene: Phaser.Scene;
  private x: number;
  private y: number;
  private config: SlotUIConfig;
  private symbolEmoji: Record<string, string>;

  private reelContainers: Phaser.GameObjects.Container[] = [];
  private symbolTexts: Phaser.GameObjects.Text[][] = []; // [reel][row]
  private highlightGraphics: Phaser.GameObjects.Graphics[] = [];

  /**
   * Creates an instance of SlotEngineUI.
   * @param scene The Phaser Scene this UI belongs to.
   * @param x The X coordinate for the top-left of the slot grid.
   * @param y The Y coordinate for the top-left of the slot grid.
   * @param config The slot configuration, potentially including UI-specific overrides.
   * @example
   * class GameScene extends Phaser.Scene {
   *   private slotUI: SlotEngineUI;
   *   create() {
   *     const slotConfig = { ...MASQUERADE_CONFIG, symbolEmoji: { 'GOLDEN_MASK': '👑' } };
   *     this.slotUI = new SlotEngineUI(this, 100, 100, slotConfig);
   *   }
   * }
   */
  constructor(scene: Phaser.Scene, x: number, y: number, config: SlotUIConfig) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.config = config;
    this.symbolEmoji = { ...DEFAULT_SYMBOL_EMOJI, ...config.symbolEmoji };

    this.createReels();
    this.audioManager = new CasinoAudioManager();
  }

  /**
   * Creates the Phaser Container objects for each reel and initializes symbol text objects.
   */
  private createReels(): void {
    for (let reelIndex = 0; reelIndex < this.config.reelsCount; reelIndex++) {
      const reelX = this.x + reelIndex * REEL_WIDTH;
      const reelY = this.y;

      // Create a container for each reel to manage its symbols
      const reelContainer = this.scene.add.container(reelX, reelY);
      // Phaser 4: Container does NOT have setOrigin(). Its origin is always top-left.
      // We position the container directly.

      this.reelContainers.push(reelContainer);
      this.symbolTexts.push([]);

      // Create a mask for the reel container to hide symbols outside the view
      const reelMaskShape = this.scene.add.graphics();
      reelMaskShape.fillStyle(DARK, 1);
      reelMaskShape.fillRect(reelX, reelY, REEL_WIDTH, this.config.rowsCount * REEL_HEIGHT);
      const mask = reelMaskShape.createGeometryMask();
      reelContainer.setMask(mask);
      this.highlightGraphics.push(this.scene.add.graphics()); // One graphics object per reel for highlights
    }
  }

  /**
   * Renders the current state of the slot machine, displaying symbols on the reels.
   * This method is typically called after a spin or to initialize the display.
   * @param state The `SlotSpinState` to render.
   * @example
   * this.slotUI.render(latestState);
   */
  public render(state: SlotSpinState): void {
    this.clearHighlights();

    if (!state.reelStops || state.reelStops.length === 0) {
      // If no reel stops yet, initialize with empty or placeholder symbols
      for (let reelIndex = 0; reelIndex < this.config.reelsCount; reelIndex++) {
        for (let rowIndex = 0; rowIndex < this.config.rowsCount; rowIndex++) {
          this.updateSymbolText(reelIndex, rowIndex, ''); // Clear or set default
        }
      }
      return;
    }

    for (let reelIndex = 0; reelIndex < this.config.reelsCount; reelIndex++) {
      for (let rowIndex = 0; rowIndex < this.config.rowsCount; rowIndex++) {
        const symbolKey = state.reelStops[reelIndex][rowIndex];
        this.updateSymbolText(reelIndex, rowIndex, symbolKey);
      }
    }
  }

  /**
   * Updates or creates a symbol text object at a specific reel and row.
   * @param reelIndex The index of the reel.
   * @param rowIndex The index of the row.
   * @param symbolKey The key of the symbol to display.
   */
  private updateSymbolText(reelIndex: number, rowIndex: number, symbolKey: string): void {
    const symbolDisplay = this.symbolEmoji[symbolKey] || symbolKey; // Fallback to key if no emoji

    let textObject = this.symbolTexts[reelIndex][rowIndex];
    if (!textObject) {
      // Calculate position relative to the reel container's top-left (0,0)
      const symbolX = REEL_WIDTH / 2;
      const symbolY = rowIndex * REEL_HEIGHT + REEL_HEIGHT / 2;

      textObject = this.scene.add.text(symbolX, symbolY, symbolDisplay, {
        fontSize: `${SYMBOL_FONT_SIZE}px`,
        fontFamily: SYMBOL_FONT_FAMILY,
        color: SYMBOL_COLOR,
        align: 'center',
      });
      textObject.setOrigin(0.5); // Center the text within its bounds
      this.reelContainers[reelIndex].add(textObject);
      this.symbolTexts[reelIndex][rowIndex] = textObject;
    } else {
      textObject.setText(symbolDisplay);
    }
  }

  /**
   * Animates the reels spinning and then settling to the final `reelStops` state.
   * @param state The final `SlotSpinState` after the spin.
   * @param onComplete A callback function to execute once the animation finishes.
   * @example
   * this.slotUI.animateSpin(latestState, () => console.log('Spin animation complete!'));
   */
  public animateSpin(state: SlotSpinState, onComplete: () => void): void {
    this.clearHighlights();
    const tweens: Phaser.Tweens.Tween[] = [];

    for (let reelIndex = 0; reelIndex < this.config.reelsCount; reelIndex++) {
      const reelContainer = this.reelContainers[reelIndex];
      const finalSymbols = state.reelStops[reelIndex];

      // Create temporary symbols above the view for the "spinning" effect
      const tempSymbols: Phaser.GameObjects.Text[] = [];
      for (let i = 0; i < this.config.rowsCount * 2; i++) { // Enough symbols to scroll
        const randomSymbolKey = this.config.symbols[Phaser.Math.Between(0, this.config.symbols.length - 1)].key;
        const symbolDisplay = this.symbolEmoji[randomSymbolKey] || randomSymbolKey;
        const tempText = this.scene.add.text(REEL_WIDTH / 2, -REEL_HEIGHT * (i + 1), symbolDisplay, {
          fontSize: `${SYMBOL_FONT_SIZE}px`,
          fontFamily: SYMBOL_FONT_FAMILY,
          color: SYMBOL_COLOR,
          align: 'center',
        }).setOrigin(0.5);
        reelContainer.add(tempText);
        tempSymbols.push(tempText);
      }

      // Add the final symbols below the view, ready to scroll up
      const finalSymbolObjects: Phaser.GameObjects.Text[] = [];
      for (let rowIndex = 0; rowIndex < this.config.rowsCount; rowIndex++) {
        const symbolKey = finalSymbols[rowIndex];
        const symbolDisplay = this.symbolEmoji[symbolKey] || symbolKey;
        const textObject = this.scene.add.text(REEL_WIDTH / 2, (this.config.rowsCount + rowIndex) * REEL_HEIGHT + REEL_HEIGHT / 2, symbolDisplay, {
          fontSize: `${SYMBOL_FONT_SIZE}px`,
          fontFamily: SYMBOL_FONT_FAMILY,
          color: SYMBOL_COLOR,
          align: 'center',
        }).setOrigin(0.5);
        reelContainer.add(textObject);
        finalSymbolObjects.push(textObject);
      }

      // Combine existing symbols, temp symbols, and final symbols for the tween
      const allSymbolsInReel = [...this.symbolTexts[reelIndex], ...tempSymbols, ...finalSymbolObjects];

      // Tween all symbols in the reel container
      const totalSpinDistance = (this.config.rowsCount * 2 + this.config.rowsCount) * REEL_HEIGHT; // Distance to scroll
      // finalYOffset = -this.config.rowsCount * REEL_HEIGHT; // reserved

      const reelTween = this.scene.tweens.add({
        targets: allSymbolsInReel,
        y: `-=${totalSpinDistance}`, // Scroll up
        ease: SYMBOL_TWEEN_EASE,
        duration: SPIN_DURATION_PER_REEL + reelIndex * REEL_SPIN_DELAY,
        delay: reelIndex * REEL_SPIN_DELAY,
        onComplete: () => {
          // Clean up temporary symbols
          tempSymbols.forEach(s => s.destroy());
          // Update the actual symbolTexts array with the final symbols
          for (let rowIndex = 0; rowIndex < this.config.rowsCount; rowIndex++) {
            this.symbolTexts[reelIndex][rowIndex]?.destroy(); // Destroy old text object
            this.symbolTexts[reelIndex][rowIndex] = finalSymbolObjects[rowIndex];
            // Reposition final symbols to their correct relative positions within the container
            finalSymbolObjects[rowIndex].y = rowIndex * REEL_HEIGHT + REEL_HEIGHT / 2;
          }
        },
      });
      tweens.push(reelTween);
    }

    // Wait for all reel tweens to complete
    this.scene.tweens.chain({
      tweens: tweens,
      onComplete: () => {
        // Ensure final state is rendered correctly after animation
        this.render(state);
        // Trigger audio based on spin outcome (with LDW ethical check)
        this.audioManager.onWin(state.totalWin, state.bet / state.linesBet * state.linesBet);
        onComplete();
      },
    });
  }

  /**
   * Highlights the positions of winning symbols on the reels.
   * @param winLines An array of `SlotWinLine` objects detailing the wins.
   * @example
   * this.slotUI.highlightWins(latestState.winLines);
   */
  public highlightWins(winLines: SlotWinLine[]): void {
    this.clearHighlights();

    winLines.forEach(winLine => {
      winLine.positions.forEach(pos => {
        const reelIndex = pos.reel;
        const rowIndex = pos.row;

        const graphics = this.highlightGraphics[reelIndex];
        // Position relative to the reel container's top-left (0,0)
        const rectX = 0;
        const rectY = rowIndex * REEL_HEIGHT;

        graphics.lineStyle(HIGHLIGHT_THICKNESS, HIGHLIGHT_COLOR, HIGHLIGHT_ALPHA);
        graphics.strokeRect(rectX, rectY, REEL_WIDTH, REEL_HEIGHT);
        this.reelContainers[reelIndex].add(graphics); // Add graphics to reel container
      });
    });
  }

  /**
   * Clears all active win highlights from the reels.
   * @example
   * this.slotUI.clearHighlights();
   */
  public clearHighlights(): void {
    this.highlightGraphics.forEach(graphics => graphics.clear());
  }

  /**
   * Destroys all Phaser GameObjects created by this UI class, cleaning up resources.
   * @example
   * this.slotUI.destroy();
   */
  public destroy(): void {
    this.audioManager.destroy();
    this.reelContainers.forEach(container => container.destroy());
    this.highlightGraphics.forEach(graphics => graphics.destroy());
    this.symbolTexts.forEach(reel => reel.forEach(text => text.destroy()));
    this.reelContainers = [];
    this.symbolTexts = [];
    this.highlightGraphics = [];
  }
}

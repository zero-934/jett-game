/**
 * @file src/games/AlchemistUI.ts
 * @purpose UI implementation for the Alchemist slot game, utilizing SlotAnimator for core animations.
 * @author Agent 934
 * @date 2026-04-16
 * @license Proprietary
 */

import * as Phaser from 'phaser';
import { SlotAnimator, FIVE_REEL_PRESET } from '../shared/slot-engine/SlotAnimator';
import type { AlchemistState, WinLine, AlchemistSymbol } from './AlchemistLogic'; // Assuming AlchemistLogic defines these types

// --- Constants ---
const GOLD = 0xc9a84c;
const CANVAS_WIDTH = 390;
const CANVAS_HEIGHT = 844;
const HEADER_HEIGHT = 80;
const FOOTER_HEIGHT = 120;
const HUD_TEXT_COLOR = '#ffffff';
const HUD_FONT_SIZE = '24px';
const BUTTON_FONT_SIZE = '28px';

const SYMBOL_EMOJI: Record<string, string> = {
  PHILOSOPHERS_STONE: '💎', ELIXIR: '🧪', GRIMOIRE: '📖', CAULDRON: '🫕',
  HOURGLASS: '⏳', VIAL: '⚗️', MORTAR: '🔮', RUNE: '🌀',
  WILD: '⭐', SCATTER: '✨', TRANSMUTING: '🔄'
};

const SYMBOL_BG: Record<string, number> = {
  PHILOSOPHERS_STONE: 0xc9a84c, ELIXIR: 0x00aaff, GRIMOIRE: 0x8b4513,
  CAULDRON: 0x2d4a1e, HOURGLASS: 0x8b7355, VIAL: 0x7fb3d3,
  MORTAR: 0x696969, RUNE: 0x4b0082, WILD: 0xffd700, SCATTER: 0xc9a84c,
  TRANSMUTING: 0xff8c00
};

const JACKPOT_PANEL_Y = HEADER_HEIGHT + 20;
const JACKPOT_PLAQUE_WIDTH = 100;
const JACKPOT_PLAQUE_HEIGHT = 40;
const JACKPOT_PLAQUE_GAP = 10;

/**
 * AlchemistUI class manages the visual representation and animations for the Alchemist slot game.
 * It uses SlotAnimator for core reel animations and handles game-specific UI elements.
 */
export class AlchemistUI {
  private scene: Phaser.Scene;
  private animator: SlotAnimator;

  // HUD elements
  private betText!: Phaser.GameObjects.Text;
  private winText!: Phaser.GameObjects.Text;
  private spinButton!: Phaser.GameObjects.Container;

  // Jackpot Panel elements
  private jackpotPlaques: { label: Phaser.GameObjects.Text; value: Phaser.GameObjects.Text }[] = [];

  /**
   * Creates an instance of AlchemistUI.
   * @param scene The Phaser Scene this UI belongs to.
   */
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.animator = new SlotAnimator(this.scene, FIVE_REEL_PRESET);
  }

  /**
   * Initializes the UI elements and sets up the initial game state.
   * Must be called once during the scene's create method.
   * @param initialGrid The initial symbol grid to display.
   * @param onSpin A callback function to be invoked when the spin button is pressed.
   */
  public start(initialGrid: AlchemistSymbol[][], onSpin: () => void): void {
    /* _gridX = */ this.animator.buildReels(
      this.drawSymbol.bind(this),
      this.drawBlur.bind(this)
    );
    this.buildJackpotPanel();
    this.buildHUD(onSpin);
    this.animator.snapReels(initialGrid);
  }

  /**
   * Renders the current game reels instantly without animation.
   * @param state The current game state, containing the reel stops.
   */
  public renderReels(state: AlchemistState): void {
    this.animator.snapReels(state.reelStops);
  }

  /**
   * Animates the reels spinning and then snapping to the final grid.
   * @param reelStops The final symbol grid after the spin.
   * @param onComplete Callback function to be executed after the spin animation finishes.
   */
  public animateSpin(reelStops: AlchemistSymbol[][], onComplete: () => void): void {
    this.animator.spinReels(reelStops, onComplete);
  }

  /**
   * Animates winning lines by pulsing the winning cells.
   * @param winLines An array of winning lines.
   */
  public animateWin(winLines: WinLine[]): void {
    const positions = winLines.flatMap(line => line.positions);
    this.animator.animateWin(positions);
  }

  /**
   * Animates transmuting cells by flashing them.
   * @param positions An array of {reel, row} objects indicating which cells are transmuting.
   * @param onComplete Callback function to be executed after all transmute animations finish.
   */
  public animateTransmute(positions: { reel: number; row: number }[], onComplete: () => void): void {
    let completedFlashes = 0;
    const totalFlashes = positions.length;

    if (totalFlashes === 0) {
      onComplete();
      return;
    }

    positions.forEach(pos => {
      this.animator.animateCellFlash(pos.reel, pos.row, () => {
        completedFlashes++;
        if (completedFlashes === totalFlashes) {
          onComplete();
        }
      });
    });
  }

  /**
   * Shows a full-screen flash overlay with message + sub-text.
   * Delegates to SlotAnimator's showFlash method.
   * @param message The main message to display.
   * @param sub The sub-text message to display.
   * @param durationMs The duration in milliseconds to hold the flash overlay visible.
   * @param onDone Callback function to be executed after the flash animation completes.
   */
  public showFlash(message: string, sub: string, durationMs: number, onDone: () => void): void {
    this.animator.showFlash(message, sub, durationMs, onDone);
  }

  /**
   * Updates the displayed win amount in the HUD.
   * @param amount The new win amount.
   */
  public updateWin(amount: number): void {
    if (this.winText) {
      this.winText.setText(`WIN: ${amount}`);
    }
  }

  /**
   * Cleans up all Phaser objects created by this UI instance.
   */
  public destroy(): void {
    this.animator.destroy();
    if (this.betText) this.betText.destroy();
    if (this.winText) this.winText.destroy();
    if (this.spinButton) this.spinButton.destroy();
    this.jackpotPlaques.forEach(plaque => {
      plaque.label.destroy();
      plaque.value.destroy();
    });
  }

  /**
   * Draws a specific symbol into a given container.
   * This method is passed to SlotAnimator as a callback.
   * @param container The Phaser.GameObjects.Container to draw into.
   * @param symbolKey The key of the symbol to draw.
   */
  private drawSymbol(container: Phaser.GameObjects.Container, symbolKey: string): void {
    const { symbolSize } = FIVE_REEL_PRESET;
    const inset = 4;
    const rectSize = symbolSize - inset * 2;
    const radius = 6;

    const bg = this.scene.add.graphics();
    bg.fillStyle(SYMBOL_BG[symbolKey] || 0x000000, 1);
    bg.fillRoundedRect(-rectSize / 2, -rectSize / 2, rectSize, rectSize, radius);
    container.add(bg);

    const emoji = SYMBOL_EMOJI[symbolKey] || '?';
    const text = this.scene.add.text(0, 0, emoji, {
      font: `bold ${symbolSize * 0.6}px Arial`,
      color: '#ffffff',
      align: 'center'
    }).setOrigin(0.5);
    container.add(text);
  }

  /**
   * Draws a blur placeholder into a given container.
   * This method is passed to SlotAnimator as a callback.
   * @param container The Phaser.GameObjects.Container to draw into.
   */
  private drawBlur(container: Phaser.GameObjects.Container): void {
    const { symbolSize } = FIVE_REEL_PRESET;
    const inset = 4;
    const rectSize = symbolSize - inset * 2;
    const radius = 6;

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x666666, 1);
    bg.fillRoundedRect(-rectSize / 2, -rectSize / 2, rectSize, rectSize, radius);
    container.add(bg);
  }

  /**
   * Builds the Jackpot Panel UI element.
   */
  private buildJackpotPanel(): void {
    const jackpotLabels = ['PHILOSOPHER', 'GRAND', 'MINOR'];
    const totalPanelWidth = jackpotLabels.length * JACKPOT_PLAQUE_WIDTH + (jackpotLabels.length - 1) * JACKPOT_PLAQUE_GAP;
    const startX = (CANVAS_WIDTH - totalPanelWidth) / 2;

    jackpotLabels.forEach((label, index) => {
      const plaqueX = startX + index * (JACKPOT_PLAQUE_WIDTH + JACKPOT_PLAQUE_GAP);
      const plaqueY = JACKPOT_PANEL_Y;

      const plaqueBg = this.scene.add.graphics();
      let plaqueColor = 0x8b4513; // Copper
      if (label === 'GRAND') plaqueColor = 0xffa500; // Amber
      if (label === 'PHILOSOPHER') plaqueColor = GOLD; // Gold
      plaqueBg.fillStyle(plaqueColor, 1);
      plaqueBg.fillRoundedRect(plaqueX, plaqueY, JACKPOT_PLAQUE_WIDTH, JACKPOT_PLAQUE_HEIGHT, 8);
      plaqueBg.lineStyle(2, 0x000000, 0.5);
      plaqueBg.strokeRoundedRect(plaqueX, plaqueY, JACKPOT_PLAQUE_WIDTH, JACKPOT_PLAQUE_HEIGHT, 8);
      plaqueBg.setDepth(10);

      const labelText = this.scene.add.text(
        plaqueX + JACKPOT_PLAQUE_WIDTH / 2,
        plaqueY + JACKPOT_PLAQUE_HEIGHT / 4,
        label,
        { font: 'bold 12px Arial', color: '#ffffff' }
      ).setOrigin(0.5).setDepth(11);

      const valueText = this.scene.add.text(
        plaqueX + JACKPOT_PLAQUE_WIDTH / 2,
        plaqueY + JACKPOT_PLAQUE_HEIGHT * 3 / 4,
        '$10000', // Placeholder value
        { font: 'bold 16px Arial', color: '#ffffff' }
      ).setOrigin(0.5).setDepth(11);

      this.jackpotPlaques.push({ label: labelText, value: valueText });
    });
  }

  /**
   * Builds the Head-Up Display (HUD) elements like bet, win, and spin button.
   * @param onSpin Callback function for the spin button.
   */
  private buildHUD(onSpin: () => void): void {
    // Bet Text
    this.betText = this.scene.add.text(
      CANVAS_WIDTH * 0.1,
      CANVAS_HEIGHT - FOOTER_HEIGHT / 2,
      'BET: 100',
      { font: `${HUD_FONT_SIZE} Arial`, color: HUD_TEXT_COLOR }
    ).setOrigin(0, 0.5).setDepth(100);

    // Win Text
    this.winText = this.scene.add.text(
      CANVAS_WIDTH * 0.9,
      CANVAS_HEIGHT - FOOTER_HEIGHT / 2,
      'WIN: 0',
      { font: `${HUD_FONT_SIZE} Arial`, color: HUD_TEXT_COLOR }
    ).setOrigin(1, 0.5).setDepth(100);

    // Spin Button
    const buttonWidth = 120;
    const buttonHeight = 60;
    this.spinButton = this.scene.add.container(CANVAS_WIDTH / 2, CANVAS_HEIGHT - FOOTER_HEIGHT / 2).setDepth(100);

    const spinBg = this.scene.add.graphics();
    spinBg.fillStyle(GOLD, 1);
    spinBg.fillRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 10);
    this.spinButton.add(spinBg);

    const spinText = this.scene.add.text(0, 0, 'SPIN', {
      font: `bold ${BUTTON_FONT_SIZE} Arial`,
      color: '#000000'
    }).setOrigin(0.5);
    this.spinButton.add(spinText);

    this.spinButton.setInteractive(new Phaser.Geom.Rectangle(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight), Phaser.Geom.Rectangle.Contains);
    this.spinButton.on('pointerup', onSpin);
  }
}

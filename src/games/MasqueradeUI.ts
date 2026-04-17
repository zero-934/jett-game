/**
 * @file src/games/MasqueradeUI.ts
 * @purpose UI implementation for the Masquerade slot game, utilizing SlotAnimator for core animations.
 * @author Agent 934
 * @date 2026-04-16
 * @license Proprietary
 */

import * as Phaser from 'phaser';
import { SlotAnimator, FIVE_REEL_PRESET } from '../shared/slot-engine/SlotAnimator';
import type { MasqueradeState, WinLine, MasqueradeSymbol } from './MasqueradeLogic'; // Assuming MasqueradeLogic defines these types

// --- Constants ---
const GOLD = 0xc9a84c;
const GOLD_STR = '#c9a84c';
const CANVAS_WIDTH = 390;
const CANVAS_HEIGHT = 844;
const HEADER_HEIGHT = 80;
const FOOTER_HEIGHT = 120;
const HUD_TEXT_COLOR = '#ffffff';
const HUD_FONT_SIZE = '24px';
const BUTTON_FONT_SIZE = '28px';

const SYMBOL_COLORS: Record<MasqueradeSymbol, number> = {
  GOLDEN_MASK: 0xc9a84c, CHAMPAGNE: 0x90c8e0, PEACOCK: 0x008080, GLOVES: 0x7b2fbe,
  CLOCK: 0xa8a8a8, SLIPPER: 0xe87c8a, INVITATION: 0xe8c44a, MUSIC: 0x6ab0d8,
  WILD: 0x0a0a1a, SCATTER: 0xc9a84c, MASKED: 0x3a0068
};

const SYMBOL_LABEL: Record<MasqueradeSymbol, string> = {
  GOLDEN_MASK: 'MASK', CHAMPAGNE: 'CHMP', PEACOCK: 'PCCK', GLOVES: 'GLVS',
  CLOCK: 'CLK', SLIPPER: 'SLPR', INVITATION: 'INVT', MUSIC: 'MUSC',
  WILD: 'WILD', SCATTER: '✦', MASKED: '?'
};

const JACKPOT_PANEL_Y = HEADER_HEIGHT + 20;
const JACKPOT_PLAQUE_WIDTH = 100;
const JACKPOT_PLAQUE_HEIGHT = 40;
const JACKPOT_PLAQUE_GAP = 10;

/**
 * MasqueradeUI class manages the visual representation and animations for the Masquerade slot game.
 * It uses SlotAnimator for core reel animations and handles game-specific UI elements.
 */
export class MasqueradeUI {
  private scene: Phaser.Scene;
  private animator: SlotAnimator;

  // HUD elements
  private betText!: Phaser.GameObjects.Text;
  private winText!: Phaser.GameObjects.Text;
  private freeSpinsText!: Phaser.GameObjects.Text;
  private spinButton!: Phaser.GameObjects.Container;

  // Jackpot Panel elements
  private jackpotPlaques: { label: Phaser.GameObjects.Text; value: Phaser.GameObjects.Text }[] = [];

  /**
   * Creates an instance of MasqueradeUI.
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
  public start(initialGrid: MasqueradeSymbol[][], onSpin: () => void): void {
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
  public renderReels(state: MasqueradeState): void {
    this.animator.snapReels(state.reelStops);
  }

  /**
   * Animates the reels spinning and then snapping to the final grid.
   * @param reelStops The final symbol grid after the spin.
   * @param onComplete Callback function to be executed after the spin animation finishes.
   */
  public animateSpin(reelStops: MasqueradeSymbol[][], onComplete: () => void): void {
    this.animator.spinReels(reelStops, onComplete);
  }

  /**
   * Animates the unmasking of MASKED symbols.
   * @param positions An array of {reel, row} objects indicating which cells to unmask.
   * @param finalSymbols The final symbols to reveal at those positions.
   * @param onComplete Callback function to be executed after all unmask animations finish.
   */
  public animateUnmask(positions: { reel: number; row: number }[], finalSymbols: MasqueradeSymbol[], onComplete: () => void): void {
    let completedUnmasks = 0;
    const totalUnmasks = positions.length;

    if (totalUnmasks === 0) {
      onComplete();
      return;
    }

    positions.forEach((pos, index) => {
      const cellContainer = this.animator.getCellContainer(pos.reel, pos.row);
      if (cellContainer) {
        this.scene.tweens.add({
          targets: cellContainer,
          scaleX: 0, // Shrink to hide current symbol
          duration: 150,
          ease: 'Sine.easeOut',
          onComplete: () => {
            // Clear and draw the new symbol
            this.clearContainer(cellContainer);
            this.drawSymbol(cellContainer, finalSymbols[index]);

            this.scene.tweens.add({
              targets: cellContainer,
              scaleX: 1, // Grow to reveal new symbol
              duration: 150,
              ease: 'Sine.easeIn',
              onComplete: () => {
                completedUnmasks++;
                if (completedUnmasks === totalUnmasks) {
                  onComplete();
                }
              },
            });
          },
        });
      } else {
        completedUnmasks++;
        if (completedUnmasks === totalUnmasks) {
          onComplete();
        }
      }
    });
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
   * Updates the displayed bet amount in the HUD.
   * @param bet The new bet amount.
   */
  public updateBet(bet: number): void {
    if (this.betText) {
      this.betText.setText(`BET: ${bet}`);
    }
  }

  /**
   * Updates the displayed win amount in the HUD.
   * @param win The new win amount.
   */
  public updateWin(win: number): void {
    if (this.winText) {
      this.winText.setText(`WIN: ${win}`);
    }
  }

  /**
   * Updates the displayed free spins count in the HUD.
   * @param freeSpins The current number of free spins.
   */
  public updateFreeSpins(freeSpins: number): void {
    if (this.freeSpinsText) {
      this.freeSpinsText.setText(`FREE SPINS: ${freeSpins}`);
    }
  }

  /**
   * Cleans up all Phaser objects created by this UI instance.
   */
  public destroy(): void {
    this.animator.destroy();
    if (this.betText) this.betText.destroy();
    if (this.winText) this.winText.destroy();
    if (this.freeSpinsText) this.freeSpinsText.destroy();
    if (this.spinButton) this.spinButton.destroy();
    this.jackpotPlaques.forEach(plaque => {
      plaque.label.destroy();
      plaque.value.destroy();
    });
  }

  /**
   * Clears all children from a Phaser.GameObjects.Container.
   * @param container The container to clear.
   */
  private clearContainer(container: Phaser.GameObjects.Container): void {
    container.removeAll(true); // true to destroy children
  }

  /**
   * Draws a specific symbol into a given container using Masquerade's custom shapes.
   * This method is passed to SlotAnimator as a callback.
   * @param container The Phaser.GameObjects.Container to draw into.
   * @param symbolKey The key of the symbol to draw.
   */
  private drawSymbol(container: Phaser.GameObjects.Container, symbolKey: string): void {
    const { symbolSize } = FIVE_REEL_PRESET;
    const color = SYMBOL_COLORS[symbolKey as MasqueradeSymbol] || 0x000000;
    const label = SYMBOL_LABEL[symbolKey as MasqueradeSymbol] || '?';

    // Center the drawing in the container
    const centerX = 0;
    const centerY = 0;

    const graphics = this.scene.add.graphics();
    graphics.fillStyle(color, 1);
    graphics.lineStyle(2, 0x000000, 0.5);

    switch (symbolKey) {
      case 'GOLDEN_MASK':
        graphics.fillCircle(centerX, centerY, symbolSize / 2 - 4);
        graphics.strokeCircle(centerX, centerY, symbolSize / 2 - 4);
        break;
      case 'CHAMPAGNE':
        graphics.fillRect(centerX - symbolSize / 2 + 4, centerY - symbolSize / 2 + 4, symbolSize - 8, symbolSize - 8);
        graphics.strokeRect(centerX - symbolSize / 2 + 4, centerY - symbolSize / 2 + 4, symbolSize - 8, symbolSize - 8);
        break;
      case 'SCATTER': // Hexagon
        const hexRadius = symbolSize / 2 - 4;
        graphics.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i;
          const x = centerX + hexRadius * Math.cos(angle);
          const y = centerY + hexRadius * Math.sin(angle);
          if (i === 0) graphics.moveTo(x, y);
          else graphics.lineTo(x, y);
        }
        graphics.closePath();
        graphics.fillPath();
        graphics.strokePath();
        break;
      case 'WILD': // Star
        const starPoints = 5;
        const outerRadius = symbolSize / 2 - 4;
        const innerRadius = outerRadius / 2;
        graphics.beginPath();
        for (let i = 0; i < starPoints * 2; i++) {
          const radius = i % 2 === 0 ? outerRadius : innerRadius;
          const angle = Math.PI / starPoints * i - Math.PI / 2; // Start at top
          const x = centerX + radius * Math.cos(angle);
          const y = centerY + radius * Math.sin(angle);
          if (i === 0) graphics.moveTo(x, y);
          else graphics.lineTo(x, y);
        }
        graphics.closePath();
        graphics.fillPath();
        graphics.strokePath();
        break;
      case 'MASKED': // Question mark in a dark purple rounded rect
        graphics.fillStyle(SYMBOL_COLORS.MASKED, 1);
        graphics.fillRoundedRect(centerX - symbolSize / 2 + 4, centerY - symbolSize / 2 + 4, symbolSize - 8, symbolSize - 8, 8);
        graphics.lineStyle(2, 0x000000, 0.5);
        graphics.strokeRoundedRect(centerX - symbolSize / 2 + 4, centerY - symbolSize / 2 + 4, symbolSize - 8, symbolSize - 8, 8);
        break;
      default: // Default to rounded rectangle
        graphics.fillRoundedRect(centerX - symbolSize / 2 + 4, centerY - symbolSize / 2 + 4, symbolSize - 8, symbolSize - 8, 8);
        graphics.strokeRoundedRect(centerX - symbolSize / 2 + 4, centerY - symbolSize / 2 + 4, symbolSize - 8, symbolSize - 8, 8);
        break;
    }
    container.add(graphics);

    const text = this.scene.add.text(centerX, centerY, label, {
      font: `bold ${symbolSize * 0.3}px Arial`,
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
    const radius = 8;

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x666666, 1);
    bg.fillRoundedRect(-rectSize / 2, -rectSize / 2, rectSize, rectSize, radius);
    container.add(bg);
  }

  /**
   * Builds the Jackpot Panel UI element.
   */
  private buildJackpotPanel(): void {
    const jackpotLabels = ['PHANTOM', 'MARQUIS', 'VEIL'];
    const totalPanelWidth = jackpotLabels.length * JACKPOT_PLAQUE_WIDTH + (jackpotLabels.length - 1) * JACKPOT_PLAQUE_GAP;
    const startX = (CANVAS_WIDTH - totalPanelWidth) / 2;

    jackpotLabels.forEach((label, index) => {
      const plaqueX = startX + index * (JACKPOT_PLAQUE_WIDTH + JACKPOT_PLAQUE_GAP);
      const plaqueY = JACKPOT_PANEL_Y;

      const plaqueBg = this.scene.add.graphics();
      let plaqueColor = 0x8b4513; // Copper
      if (label === 'MARQUIS') plaqueColor = 0xffa500; // Amber
      if (label === 'PHANTOM') plaqueColor = GOLD; // Gold
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
   * Builds the Head-Up Display (HUD) elements like bet, win, free spins, and spin button.
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

    // Free Spins Text (centered below win/bet, or adjusted)
    this.freeSpinsText = this.scene.add.text(
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT - FOOTER_HEIGHT + 20, // Example position
      'FREE SPINS: 0',
      { font: `${HUD_FONT_SIZE} Arial`, color: GOLD_STR }
    ).setOrigin(0.5).setDepth(100);

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

/**
 * @file src/games/InfernoUI.ts
 * @purpose UI implementation for the Inferno slot game, utilizing SlotAnimator for core animations.
 * @author Agent 934
 * @date 2026-04-16
 * @license Proprietary
 */

import * as Phaser from 'phaser';
import { SlotAnimator, THREE_REEL_PRESET } from '../shared/slot-engine/SlotAnimator';
import type { InfernoState, InfernoCluster, InfernoSymbol, InfernoCell } from './InfernoLogic'; // Assuming InfernoLogic defines these types

// --- Constants ---
const GOLD = 0xc9a84c;
const GOLD_STR = '#c9a84c';
const CANVAS_WIDTH = 390;
const CANVAS_HEIGHT = 844;
const HEADER_HEIGHT = 36; // Nav bar height
const HUD_TEXT_COLOR = '#ffffff';
const HUD_FONT_SIZE = '24px';
const BUTTON_FONT_SIZE = '28px';
const WIN_BADGE_FONT_SIZE = '36px';
const INFERNO_BANNER_FONT_SIZE = '60px';

const SYMBOL_EMOJI: Record<string, string> = {
  EMBER: '🔥', FLAME: '🌋', COAL: '⚫', ASH: '💨', SMOKE: '🌫️', WILD: '⭐', SCATTER: '💠'
};

const SYMBOL_BG: Record<string, number> = {
  EMBER: 0xff4500, FLAME: 0xff6600, COAL: 0x333333, ASH: 0x888888, SMOKE: 0xaaaaaa,
  WILD: 0xc9a84c, SCATTER: 0x0055ff
};

const HEAT_METER_SEGMENTS = 5;
const HEAT_METER_WIDTH = THREE_REEL_PRESET.reelsCount * THREE_REEL_PRESET.symbolSize + (THREE_REEL_PRESET.reelsCount - 1) * THREE_REEL_PRESET.reelGap;
const HEAT_METER_HEIGHT = 20;
const HEAT_METER_Y = HEADER_HEIGHT + 20; // Below header
const HEAT_METER_INACTIVE_COLOR = 0x333333;
const HEAT_METER_ACTIVE_COLOR_START = 0xff8c00; // Dark Orange
const HEAT_METER_ACTIVE_COLOR_END = GOLD; // Gold

const CROWN_FLIP_MODAL_Z_INDEX = 2000;
const CROWN_FLIP_COIN_RADIUS = 60;

/**
 * InfernoUI class manages the visual representation and animations for the Inferno slot game.
 * It uses SlotAnimator for core reel animations and handles game-specific UI elements.
 */
export class InfernoUI {
  private scene: Phaser.Scene;
  private animator: SlotAnimator;

  // HUD elements
  private betText!: Phaser.GameObjects.Text;
  private winText!: Phaser.GameObjects.Text;
  private spinButton!: Phaser.GameObjects.Container;

  // Heat Meter elements
  private heatMeterSegments: Phaser.GameObjects.Graphics[] = [];

  // Crown Flip Modal elements
  private crownFlipOverlay!: Phaser.GameObjects.Rectangle;
  private crownFlipContainer!: Phaser.GameObjects.Container;
  private crownFlipCoin!: Phaser.GameObjects.Graphics;
  private crownFlipWinText!: Phaser.GameObjects.Text;
  private crownFlipButton!: Phaser.GameObjects.Container;
  private crownWalkButton!: Phaser.GameObjects.Container;

  /**
   * Creates an instance of InfernoUI.
   * @param scene The Phaser Scene this UI belongs to.
   */
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.animator = new SlotAnimator(this.scene, THREE_REEL_PRESET);
  }

  /**
   * Initializes the UI elements and sets up the initial game state.
   * Must be called once during the scene's create method.
   * @param initialGrid The initial symbol grid to display.
   * @param onSpin A callback function to be invoked when the spin button is pressed.
   */
  public start(initialGrid: InfernoSymbol[][], onSpin: () => void): void {
    /* _gridX = */ this.animator.buildReels(
      this.drawSymbol.bind(this),
      this.drawBlur.bind(this)
    );
    this.buildHeatMeter();
    this.buildHUD(onSpin);
    this.buildCrownFlipModal();
    // Transpose initialGrid [row][col] -> [reel=col][row]
    const reelGrid: string[][] = [];
    for (let col = 0; col < 3; col++) {
      reelGrid.push((initialGrid as string[][]).map(row => row[col]));
    }
    this.animator.snapReels(reelGrid);
  }

  /**
   * Renders the current game grid instantly without animation.
   * @param state The current game state, containing the reel stops.
   */
  public renderGrid(state: InfernoState): void {
    // InfernoState.grid is [row][col], SlotAnimator expects [reel=col][row]
    const reelGrid: string[][] = [];
    for (let col = 0; col < 3; col++) {
      reelGrid.push(state.grid.map(row => row[col].symbol));
    }
    this.animator.snapReels(reelGrid);
  }

  /**
   * Animates the reels spinning and then snapping to the final grid.
   * @param finalGrid The final symbol grid after the spin.
   * @param onComplete Callback function to be executed after the spin animation finishes.
   */
  public animateSpin(finalGrid: InfernoCell[][], onComplete: () => void): void {
    // Transpose [row][col] → [reel=col][row] for SlotAnimator
    const reelGrid: string[][] = [];
    for (let col = 0; col < 3; col++) {
      reelGrid.push(finalGrid.map(row => row[col].symbol as string));
    }
    this.animator.spinReels(reelGrid, onComplete);
  }

  /**
   * Animates winning clusters by pulsing the winning cells.
   * @param clusters An array of winning clusters.
   * @param onComplete Callback function to be executed after the win animation finishes.
   */
  public animateClusters(clusters: InfernoCluster[], onComplete: () => void): void {
    const positions = clusters.flatMap(cluster =>
      cluster.cells.map((cell: { row: number; col: number }) => ({ reel: cell.col, row: cell.row }))
    );
    this.animator.animateWin(positions);
    this.scene.time.delayedCall(600, onComplete); // Wait for win pulse to complete
  }

  /**
   * Animates a cascade effect, where winning cells flash, then the grid updates.
   * @param state The new game state after the cascade.
   * @param onComplete Callback function to be executed after the cascade animation finishes.
   */
  public animateCascade(state: InfernoState, onComplete: () => void): void {
    const winningPositions = state.clusters.flatMap(cluster => cluster.cells);
    let completedFlashes = 0;
    const totalFlashes = winningPositions.length;

    if (totalFlashes === 0) {
      this.renderGrid(state);
      this.scene.time.delayedCall(300, onComplete);
      return;
    }

    winningPositions.forEach(pos => {
      this.animator.animateCellFlash(pos.col, pos.row, () => {
        completedFlashes++;
        if (completedFlashes === totalFlashes) {
          this.renderGrid(state);
          this.scene.time.delayedCall(300, onComplete); // Short delay after grid update
        }
      });
    });
  }

  /**
   * Shows the Crown Flip modal, allowing the player to choose to flip a coin or walk away.
   * @param currentWin The amount won that can be gambled.
   * @param onFlip Callback when the player chooses to flip.
   * @param onWalk Callback when the player chooses to walk away.
   */
  public showCrownFlip(currentWin: number, onFlip: () => void, onWalk: () => void): void {
    this.crownFlipWinText.setText(`Gamble ${currentWin}`);
    this.crownFlipButton.once('pointerup', onFlip);
    this.crownWalkButton.once('pointerup', onWalk);
    this.crownFlipContainer.setVisible(true);
    this.scene.tweens.add({
      targets: [this.crownFlipOverlay, this.crownFlipContainer],
      alpha: 1,
      duration: 200,
      ease: 'Sine.easeOut'
    });
  }

  /**
   * Hides the Crown Flip modal.
   */
  public hideCrownFlip(): void {
    this.scene.tweens.add({
      targets: [this.crownFlipOverlay, this.crownFlipContainer],
      alpha: 0,
      duration: 200,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.crownFlipContainer.setVisible(false);
      }
    });
  }

  /**
   * Shows a win badge animation (e.g., "+1000") floating upwards and fading.
   * @param amount The win amount to display.
   */
  public showWinBadge(amount: number): void {
    const winBadge = this.scene.add.text(
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT / 2,
      `+${amount}`,
      { font: `bold ${WIN_BADGE_FONT_SIZE} Arial`, color: GOLD_STR, align: 'center' }
    ).setOrigin(0.5).setDepth(100);

    this.scene.tweens.add({
      targets: winBadge,
      y: winBadge.y - 100,
      alpha: 0,
      duration: 1500,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        winBadge.destroy();
      }
    });
  }

  /**
   * Shows an "INFERNO SPIN!" banner animation.
   * @param onComplete Callback function to be executed after the banner animation finishes.
   */
  public showInfernoBanner(onComplete: () => void): void {
    const bannerText = this.scene.add.text(
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT / 2,
      'INFERNO SPIN!',
      {
        font: `bold ${INFERNO_BANNER_FONT_SIZE} Arial`,
        color: GOLD_STR, // Start with gold, can add gradient later if needed
        align: 'center',
        stroke: '#ff0000',
        strokeThickness: 8,
        shadow: {
          offsetX: 0,
          offsetY: 0,
          color: '#ff8c00',
          blur: 16,
          stroke: true,
          fill: true
        }
      }
    ).setOrigin(0.5).setScale(0).setDepth(100);

    this.scene.tweens.chain({
      tweens: [
        {
          targets: bannerText,
          scale: 1.2,
          duration: 300,
          ease: 'Back.easeOut',
        },
        {
          targets: bannerText,
          scale: 1.0,
          duration: 150,
          ease: 'Sine.easeIn',
        },
        {
          targets: bannerText,
          duration: 1200, // Hold duration
        },
        {
          targets: bannerText,
          scale: 0,
          alpha: 0,
          duration: 300,
          ease: 'Back.easeIn',
          onComplete: () => {
            bannerText.destroy();
            onComplete();
          },
        },
      ],
    });
  }

  /**
   * Updates the visual representation of the heat meter.
   * @param level The current heat level (0-5).
   */
  public updateHeatMeter(level: number): void {
    this.heatMeterSegments.forEach((segment, index) => {
      const isActive = index < level;
      segment.clear();
      const color = isActive
        ? Phaser.Display.Color.Interpolate.ColorWithColor(
            new Phaser.Display.Color(HEAT_METER_ACTIVE_COLOR_START),
            new Phaser.Display.Color(HEAT_METER_ACTIVE_COLOR_END),
            HEAT_METER_SEGMENTS,
            index + 1
          ).color
        : HEAT_METER_INACTIVE_COLOR;
      segment.fillStyle(color, 1);
      const sw = HEAT_METER_WIDTH / HEAT_METER_SEGMENTS;
      segment.fillRoundedRect(0, 0, sw, HEAT_METER_HEIGHT, 4);

      if (isActive) {
        // Add a subtle glow tween
        this.scene.tweens.add({
          targets: segment,
          alpha: { from: 1, to: 0.8 },
          duration: 500,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
      } else {
        this.scene.tweens.killTweensOf(segment);
        segment.setAlpha(1);
      }
    });
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
   * Cleans up all Phaser objects created by this UI instance.
   */
  public destroy(): void {
    this.animator.destroy();
    if (this.betText) this.betText.destroy();
    if (this.winText) this.winText.destroy();
    if (this.spinButton) this.spinButton.destroy();
    this.heatMeterSegments.forEach(s => s.destroy());
    if (this.crownFlipContainer) this.crownFlipContainer.destroy();
    if (this.crownFlipOverlay) this.crownFlipOverlay.destroy();
  }

  /**
   * Draws a specific symbol into a given container.
   * This method is passed to SlotAnimator as a callback.
   * @param container The Phaser.GameObjects.Container to draw into.
   * @param symbolKey The key of the symbol to draw.
   */
  private drawSymbol(container: Phaser.GameObjects.Container, symbolKey: string): void {
    container.removeAll(true);
    const { symbolSize } = THREE_REEL_PRESET;
    const inset = 3;

    const bg = this.scene.add.graphics();
    bg.fillStyle(SYMBOL_BG[symbolKey] || 0x222222, 1);
    bg.fillRoundedRect(inset, inset, symbolSize - inset * 2, symbolSize - inset * 2, 8);
    bg.lineStyle(2, GOLD, 0.8);
    bg.strokeRoundedRect(inset, inset, symbolSize - inset * 2, symbolSize - inset * 2, 8);
    container.add(bg);

    const emoji = SYMBOL_EMOJI[symbolKey] || '?';
    const text = this.scene.add.text(symbolSize / 2, symbolSize / 2, emoji, {
      font: `bold ${Math.floor(symbolSize * 0.5)}px Arial`,
      color: '#ffffff',
      align: 'center',
    }).setOrigin(0.5);
    container.add(text);
  }

  /**
   * Draws a blur placeholder into a given container.
   * This method is passed to SlotAnimator as a callback.
   * @param container The Phaser.GameObjects.Container to draw into.
   */
  private drawBlur(container: Phaser.GameObjects.Container): void {
    container.removeAll(true);
    const { symbolSize } = THREE_REEL_PRESET;
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x2a2a3a, 0.75);
    bg.fillRoundedRect(3, 3, symbolSize - 6, symbolSize - 6, 7);
    container.add(bg);
  }

  /**
   * Builds the Heat Meter UI element.
   */
  private buildHeatMeter(): void {
    const segmentWidth = HEAT_METER_WIDTH / HEAT_METER_SEGMENTS;
    const meterX = (CANVAS_WIDTH - HEAT_METER_WIDTH) / 2;

    for (let i = 0; i < HEAT_METER_SEGMENTS; i++) {
      const segment = this.scene.add.graphics();
      segment.x = meterX + i * segmentWidth;
      segment.y = HEAT_METER_Y;
      // segment dimensions stored in constants
      segment.fillStyle(HEAT_METER_INACTIVE_COLOR, 1);
      segment.fillRoundedRect(0, 0, segmentWidth - 2, HEAT_METER_HEIGHT, 4); // -2 for small gap
      this.heatMeterSegments.push(segment);
    }
  }

  /**
   * Builds the Head-Up Display (HUD) elements like bet, win, and spin button.
   * @param onSpin Callback function for the spin button.
   */
  private buildHUD(onSpin: () => void): void {
    // Bet Text
    this.betText = this.scene.add.text(
      CANVAS_WIDTH * 0.1,
      620,
      'BET: 100',
      { font: `${HUD_FONT_SIZE} Arial`, color: HUD_TEXT_COLOR }
    ).setOrigin(0, 0.5).setDepth(100);

    // Win Text
    this.winText = this.scene.add.text(
      CANVAS_WIDTH * 0.9,
      620,
      'WIN: 0',
      { font: `${HUD_FONT_SIZE} Arial`, color: HUD_TEXT_COLOR }
    ).setOrigin(1, 0.5).setDepth(100);

    // Spin Button
    const buttonWidth = 120;
    const buttonHeight = 60;
    this.spinButton = this.scene.add.container(CANVAS_WIDTH / 2, 560).setDepth(100);

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

  /**
   * Builds the Crown Flip modal, initially hidden.
   */
  private buildCrownFlipModal(): void {
    this.crownFlipContainer = this.scene.add.container(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2).setDepth(CROWN_FLIP_MODAL_Z_INDEX).setAlpha(0).setVisible(false);

    // Dark overlay
    this.crownFlipOverlay = this.scene.add.rectangle(
      CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH, CANVAS_HEIGHT, 0x000000, 0.8
    ).setDepth(CROWN_FLIP_MODAL_Z_INDEX - 1).setAlpha(0).setVisible(false);

    // Modal background
    const modalBg = this.scene.add.graphics();
    modalBg.fillStyle(0x333333, 1);
    modalBg.fillRoundedRect(-150, -200, 300, 400, 15);
    this.crownFlipContainer.add(modalBg);

    // Coin
    this.crownFlipCoin = this.scene.add.graphics();
    this.crownFlipCoin.fillStyle(GOLD, 1);
    this.crownFlipCoin.fillCircle(0, -100, CROWN_FLIP_COIN_RADIUS);
    this.crownFlipCoin.lineStyle(4, 0xaaaaaa, 1);
    this.crownFlipCoin.strokeCircle(0, -100, CROWN_FLIP_COIN_RADIUS);
    this.crownFlipContainer.add(this.crownFlipCoin);

    // Win text
    this.crownFlipWinText = this.scene.add.text(0, 0, 'Gamble 0', {
      font: 'bold 32px Arial',
      color: GOLD_STR
    }).setOrigin(0.5);
    this.crownFlipContainer.add(this.crownFlipWinText);

    // Flip button
    const flipButtonWidth = 180;
    const flipButtonHeight = 60;
    this.crownFlipButton = this.scene.add.container(0, 80);
    const flipBg = this.scene.add.graphics();
    flipBg.fillStyle(GOLD, 1);
    flipBg.fillRoundedRect(-flipButtonWidth / 2, -flipButtonHeight / 2, flipButtonWidth, flipButtonHeight, 10);
    this.crownFlipButton.add(flipBg);
    const flipText = this.scene.add.text(0, 0, 'FLIP', {
      font: `bold ${BUTTON_FONT_SIZE} Arial`,
      color: '#000000'
    }).setOrigin(0.5);
    this.crownFlipButton.add(flipText);
    this.crownFlipButton.setInteractive(new Phaser.Geom.Rectangle(-flipButtonWidth / 2, -flipButtonHeight / 2, flipButtonWidth, flipButtonHeight), Phaser.Geom.Rectangle.Contains);
    this.crownFlipContainer.add(this.crownFlipButton);

    // Walk button
    const walkButtonWidth = 180;
    const walkButtonHeight = 60;
    this.crownWalkButton = this.scene.add.container(0, 160);
    const walkBg = this.scene.add.graphics();
    walkBg.fillStyle(0x666666, 1);
    walkBg.fillRoundedRect(-walkButtonWidth / 2, -walkButtonHeight / 2, walkButtonWidth, walkButtonHeight, 10);
    this.crownWalkButton.add(walkBg);
    const walkText = this.scene.add.text(0, 0, 'WALK', {
      font: `bold ${BUTTON_FONT_SIZE} Arial`,
      color: '#ffffff'
    }).setOrigin(0.5);
    this.crownWalkButton.add(walkText);
    this.crownWalkButton.setInteractive(new Phaser.Geom.Rectangle(-walkButtonWidth / 2, -walkButtonHeight / 2, walkButtonWidth, walkButtonHeight), Phaser.Geom.Rectangle.Contains);
    this.crownFlipContainer.add(this.crownWalkButton);
  }
}

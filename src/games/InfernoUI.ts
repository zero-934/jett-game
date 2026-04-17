/**
 * @file InfernoUI.ts
 * @purpose Provides the Phaser 3 UI components and animations for the Inferno game.
 * @author Agent 934
 * @date 2026-04-16
 * @license Proprietary – available for licensing
 */

import * as Phaser from 'phaser';
import type { InfernoState, InfernoCluster, InfernoSymbol } from '../games/InfernoLogic';

// --- Constants ---
const GOLD = 0xc9a84c;
const GOLD_STR = '#c9a84c';
const DARK_CELL_BG = 0x1a0a00;
const CHARCOAL_BG = 0x0d0d0d;

const CELL_SIZE = 100;
const GRID_GAP = 10;
const GRID_ROWS = 3;
const GRID_COLS = 3;

const ANIM_DURATION_CLUSTER_GLOW = 300;
const ANIM_DURATION_CELL_EXPLODE = 200;
const ANIM_DURATION_CELL_FALL = 300;
const ANIM_DURATION_INFERNO_BANNER = 1500;
const ANIM_DURATION_CROWN_FLIP = 500;

const SYMBOL_EMOJIS: Record<InfernoSymbol, string> = {
  EMBER: '🔥',
  FLAME: '🌋',
  COAL: '⚫',
  ASH: '💨',
  SMOKE: '🌫️',
  WILD: '⭐',
  SCATTER: '💠',
};

// --- InfernoUI Class ---
export class InfernoUI {
  private scene: Phaser.Scene;
  private gridContainer: Phaser.GameObjects.Container;
  private cellGraphics: Phaser.GameObjects.Graphics[][];
  private cellSymbols: Phaser.GameObjects.Text[][];
  private heatMeterGraphics: Phaser.GameObjects.Graphics;
  private heatMeterLevel: number = 0;
  private crownFlipContainer: Phaser.GameObjects.Container | null = null;
  private betText: Phaser.GameObjects.Text;
  private winText: Phaser.GameObjects.Text;
  private currentWinBadge: Phaser.GameObjects.Text | null = null;
  private infernoBanner: Phaser.GameObjects.Text | null = null;

  /**
   * Creates an instance of InfernoUI.
   *
   * @param scene The Phaser Scene this UI belongs to.
   * @param x The X coordinate for the center of the grid.
   * @param y The Y coordinate for the center of the grid.
   * @example
   * const ui = new InfernoUI(this, 390 / 2, 844 / 2);
   */
  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;

    // Calculate grid dimensions
    const gridWidth = GRID_COLS * CELL_SIZE + (GRID_COLS - 1) * GRID_GAP;
    const gridHeight = GRID_ROWS * CELL_SIZE + (GRID_ROWS - 1) * GRID_GAP;

    // Create grid container
    this.gridContainer = scene.add.container(x - gridWidth / 2, y - gridHeight / 2);

    this.cellGraphics = [];
    this.cellSymbols = [];

    // Initialize grid cells
    for (let r = 0; r < GRID_ROWS; r++) {
      this.cellGraphics[r] = [];
      this.cellSymbols[r] = [];
      for (let c = 0; c < GRID_COLS; c++) {
        const cellX = c * (CELL_SIZE + GRID_GAP);
        const cellY = r * (CELL_SIZE + GRID_GAP);

        const graphics = scene.add.graphics();
        graphics.fillStyle(DARK_CELL_BG, 1);
        graphics.fillRect(cellX, cellY, CELL_SIZE, CELL_SIZE);
        graphics.lineStyle(2, GOLD, 1);
        graphics.strokeRect(cellX, cellY, CELL_SIZE, CELL_SIZE);
        this.gridContainer.add(graphics);
        this.cellGraphics[r][c] = graphics;

        const symbolText = scene.add
          .text(cellX + CELL_SIZE / 2, cellY + CELL_SIZE / 2, '', {
            fontFamily: 'Arial',
            fontSize: `${CELL_SIZE * 0.7}px`,
            color: '#ffffff',
            align: 'center',
          })
          .setOrigin(0.5);
        this.gridContainer.add(symbolText);
        this.cellSymbols[r][c] = symbolText;
      }
    }

    // Heat Meter
    this.heatMeterGraphics = scene.add.graphics();
    this.heatMeterGraphics.setDepth(10); // Ensure it's on top
    this.updateHeatMeter(0); // Initial empty meter

    // Bet and Win displays
    this.betText = scene.add
      .text(scene.scale.width * 0.1, scene.scale.height * 0.95, 'BET: $0', {
        fontFamily: 'Arial',
        fontSize: '24px',
        color: GOLD_STR,
      })
      .setOrigin(0, 0.5)
      .setDepth(10);

    this.winText = scene.add
      .text(scene.scale.width * 0.9, scene.scale.height * 0.95, 'WIN: $0', {
        fontFamily: 'Arial',
        fontSize: '24px',
        color: GOLD_STR,
      })
      .setOrigin(1, 0.5)
      .setDepth(10);
  }

  /**
   * Renders the full 3x3 grid from the given game state.
   * This function updates the visual representation of each cell,
   * including its symbol and whether it's currently falling.
   *
   * @param state The current `InfernoState` to render.
   * @example
   * ui.renderGrid(currentState);
   */
  renderGrid(state: InfernoState): void {
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const cell = state.grid[r][c];
        const symbolText = this.cellSymbols[r][c];
        const graphics = this.cellGraphics[r][c];

        symbolText.setText(SYMBOL_EMOJIS[cell.symbol]);
        symbolText.setAlpha(1);
        symbolText.setScale(1);

        graphics.clear();
        graphics.fillStyle(DARK_CELL_BG, 1);
        graphics.fillRect(0, 0, CELL_SIZE, CELL_SIZE);
        graphics.lineStyle(2, GOLD, 1);
        graphics.strokeRect(0, 0, CELL_SIZE, CELL_SIZE);

        // Position for falling animation
        const targetY = r * (CELL_SIZE + GRID_GAP);
        const startY = targetY - CELL_SIZE * 2; // Start above the grid

        if (cell.isFalling) {
          symbolText.y = startY + CELL_SIZE / 2;
          graphics.y = startY;
          this.scene.tweens.add({
            targets: [symbolText, graphics],
            y: targetY + CELL_SIZE / 2, // For text
            duration: ANIM_DURATION_CELL_FALL,
            ease: 'Bounce.easeOut',
            onComplete: () => {
              symbolText.y = targetY + CELL_SIZE / 2; // Ensure final position
              graphics.y = targetY;
            },
          });
        } else {
          symbolText.y = targetY + CELL_SIZE / 2;
          graphics.y = targetY;
        }
      }
    }
  }

  /**
   * Animates winning clusters with a glowing/pulsing effect.
   *
   * @param clusters An array of `InfernoCluster` objects representing the winning clusters.
   * @param onComplete Callback function to execute after the animation finishes.
   * @example
   * ui.animateClusters(currentState.clusters, () => {
   *   console.log('Cluster animation complete!');
   * });
   */
  animateClusters(clusters: InfernoCluster[], onComplete: () => void): void {
    if (clusters.length === 0) {
      onComplete();
      return;
    }

    const winningCells: Set<string> = new Set();
    clusters.forEach((cluster) => {
      cluster.cells.forEach((cell) => winningCells.add(`${cell.row},${cell.col}`));
    });

    const tweens: Phaser.Tweens.Tween[] = [];

    winningCells.forEach((key) => {
      const [r, c] = key.split(',').map(Number);
      const graphics = this.cellGraphics[r][c];

      // Create a temporary glow graphic
      const glow = this.scene.add.graphics();
      glow.setDepth(1); // Above cell background, below symbol
      glow.fillStyle(GOLD, 0);
      glow.fillRoundedRect(
        graphics.x + this.gridContainer.x,
        graphics.y + this.gridContainer.y,
        CELL_SIZE,
        CELL_SIZE,
        10,
      );
      this.gridContainer.add(glow); // Add to container for relative positioning

      const tween = this.scene.tweens.add({
        targets: glow,
        alpha: { from: 0, to: 0.8 },
        scale: { from: 1, to: 1.1 },
        duration: ANIM_DURATION_CLUSTER_GLOW,
        yoyo: true,
        repeat: 1, // Glow in, glow out
        ease: 'Sine.easeInOut',
        onComplete: () => {
          glow.destroy();
        },
      });
      tweens.push(tween);
    });

    // Wait for all tweens to complete
    if (tweens.length > 0) {
      this.scene.tweens.chain({
        tweens: tweens,
        onComplete: onComplete,
      });
    } else {
      onComplete();
    }
  }

  /**
   * Animates cells exploding (winning cells shrinking/fading) and new cells falling in.
   * This function should be called after `cascadeInferno` has updated the state.
   *
   * @param previousState The state *before* the cascade, used to identify exploding cells.
   * @param newState The state *after* the cascade, used to identify falling cells.
   * @param onComplete Callback function to execute after the animation finishes.
   * @example
   * ui.animateCascade(oldState, newState, () => {
   *   console.log('Cascade animation complete!');
   * });
   */
  animateCascade(previousState: InfernoState, newState: InfernoState, onComplete: () => void): void {
    const tweens: Phaser.Tweens.Tween[] = [];

    // Animate winning cells exploding
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        if (previousState.grid[r][c].isWinning) {
          const symbolText = this.cellSymbols[r][c];
          const graphics = this.cellGraphics[r][c];

          tweens.push(
            this.scene.tweens.add({
              targets: [symbolText, graphics],
              alpha: 0,
              scale: 0,
              duration: ANIM_DURATION_CELL_EXPLODE,
              ease: 'Quad.easeOut',
              onComplete: () => {
                // Reset for next render cycle
                symbolText.setAlpha(1).setScale(1);
                graphics.setAlpha(1).setScale(1);
              },
            }),
          );
        }
      }
    }

    // Animate new cells falling in (handled by renderGrid after this)
    // The renderGrid function will detect `isFalling` and apply the tween.
    // So, we just need to ensure the explosion tweens complete.

    if (tweens.length > 0) {
      this.scene.tweens.chain({
        tweens: tweens,
        onComplete: () => {
          this.renderGrid(newState); // Render the new state with falling animations
          // Wait for falling animations to complete before calling onComplete
          this.scene.time.delayedCall(ANIM_DURATION_CELL_FALL, onComplete);
        },
      });
    } else {
      this.renderGrid(newState); // Just render if no explosions
      this.scene.time.delayedCall(ANIM_DURATION_CELL_FALL, onComplete);
    }
  }

  /**
   * Updates the visual representation of the heat meter bar.
   *
   * @param level The current heat meter level (0-5).
   * @example
   * ui.updateHeatMeter(3); // Fills 3 segments of the meter
   */
  updateHeatMeter(level: number): void {
    this.heatMeterLevel = level;
    this.heatMeterGraphics.clear();

    const meterWidth = this.scene.scale.width * 0.6;
    const meterHeight = 20;
    const meterX = (this.scene.scale.width - meterWidth) / 2;
    const meterY = this.scene.scale.height * 0.05;
    const segmentWidth = meterWidth / 5;

    // Draw background
    this.heatMeterGraphics.lineStyle(2, GOLD, 1);
    this.heatMeterGraphics.strokeRect(meterX, meterY, meterWidth, meterHeight);

    // Draw filled segments
    for (let i = 0; i < this.heatMeterLevel; i++) {
      const segmentX = meterX + i * segmentWidth;
      this.heatMeterGraphics.fillStyle(0xff8c00, 1); // Ember orange
      this.heatMeterGraphics.fillRect(segmentX, meterY, segmentWidth, meterHeight);
    }
  }

  /**
   * Shows the Crown Flip modal, allowing the player to flip or walk away.
   *
   * @param currentWin The current win amount to be displayed in the modal.
   * @param onFlip Callback function for when the player chooses to flip.
   * @param onWalk Callback function for when the player chooses to walk away.
   * @example
   * ui.showCrownFlip(200, () => {
   *   console.log('Player chose to flip!');
   * }, () => {
   *   console.log('Player chose to walk!');
   * });
   */
  showCrownFlip(currentWin: number, onFlip: () => void, onWalk: () => void): void {
    this.hideCrownFlip(); // Ensure any existing modal is removed

    const screenWidth = this.scene.scale.width;
    const screenHeight = this.scene.scale.height;

    this.crownFlipContainer = this.scene.add.container(screenWidth / 2, screenHeight / 2);
    this.crownFlipContainer.setDepth(100); // Ensure it's on top of everything

    // Dark overlay
    const overlay = this.scene.add.graphics();
    overlay.fillStyle(CHARCOAL_BG, 0.8);
    overlay.fillRect(-screenWidth / 2, -screenHeight / 2, screenWidth, screenHeight);
    this.crownFlipContainer.add(overlay);

    // Crown graphic (gold circle)
    const crownRadius = 100;
    const crown = this.scene.add.graphics();
    crown.fillStyle(GOLD, 1);
    crown.fillCircle(0, -crownRadius / 2, crownRadius);
    crown.lineStyle(5, 0xffd700, 1); // Brighter gold outline
    crown.strokeCircle(0, -crownRadius / 2, crownRadius);
    this.crownFlipContainer.add(crown);

    // Win amount text
    const winText = this.scene.add
      .text(0, -crownRadius / 2, `$${currentWin}`, {
        fontFamily: 'Arial',
        fontSize: '48px',
        color: '#ffffff',
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(101);
    this.crownFlipContainer.add(winText);

    // FLIP button
    const flipButton = this.scene.add
      .text(0, crownRadius + 50, 'FLIP', {
        fontFamily: 'Arial',
        fontSize: '36px',
        color: GOLD_STR,
        backgroundColor: '#333333',
        padding: { x: 20, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.scene.tweens.add({
          targets: crown,
          angle: 360,
          duration: ANIM_DURATION_CROWN_FLIP,
          ease: 'Linear',
          onComplete: () => {
            onFlip();
          },
        });
      });
    this.crownFlipContainer.add(flipButton);

    // WALK button
    const walkButton = this.scene.add
      .text(0, crownRadius + 120, 'WALK AWAY', {
        fontFamily: 'Arial',
        fontSize: '24px',
        color: '#aaaaaa',
        backgroundColor: '#333333',
        padding: { x: 15, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        onWalk();
      });
    this.crownFlipContainer.add(walkButton);

    this.crownFlipContainer.setScale(0);
    this.scene.tweens.add({
      targets: this.crownFlipContainer,
      scale: 1,
      duration: 300,
      ease: 'Back.easeOut',
    });
  }

  /**
   * Hides and destroys the Crown Flip modal.
   * @example
   * ui.hideCrownFlip();
   */
  hideCrownFlip(): void {
    if (this.crownFlipContainer) {
      this.scene.tweens.add({
        targets: this.crownFlipContainer,
        alpha: 0,
        scale: 0,
        duration: 200,
        ease: 'Quad.easeIn',
        onComplete: () => {
          this.crownFlipContainer?.destroy();
          this.crownFlipContainer = null;
        },
      });
    }
  }

  /**
   * Shows a win amount badge animating upward from the center of the grid.
   *
   * @param amount The win amount to display.
   * @example
   * ui.showWinBadge(150);
   */
  showWinBadge(amount: number): void {
    if (this.currentWinBadge) {
      this.currentWinBadge.destroy();
    }

    const gridCenterX = this.gridContainer.x + this.gridContainer.width / 2;
    const gridCenterY = this.gridContainer.y + this.gridContainer.height / 2;

    this.currentWinBadge = this.scene.add
      .text(gridCenterX, gridCenterY, `+$${amount}`, {
        fontFamily: 'Arial',
        fontSize: '48px',
        color: GOLD_STR,
        stroke: '#000000',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(50);

    this.scene.tweens.add({
      targets: this.currentWinBadge,
      y: gridCenterY - 100,
      alpha: 0,
      duration: 1500,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.currentWinBadge?.destroy();
        this.currentWinBadge = null;
      },
    });
  }

  /**
   * Updates the displayed bet amount.
   *
   * @param bet The new bet amount.
   * @example
   * ui.updateBet(25);
   */
  updateBet(bet: number): void {
    this.betText.setText(`BET: $${bet}`);
  }

  /**
   * Updates the displayed total win amount for the current spin.
   *
   * @param win The new total win amount.
   * @example
   * ui.updateWin(50);
   */
  updateWin(win: number): void {
    this.winText.setText(`WIN: $${win}`);
  }

  /**
   * Shows a dramatic "INFERNO SPIN" banner animation.
   *
   * @param onComplete Callback function to execute after the banner animation finishes.
   * @example
   * ui.showInfernoBanner(() => {
   *   console.log('Inferno banner complete!');
   * });
   */
  showInfernoBanner(onComplete: () => void): void {
    if (this.infernoBanner) {
      this.infernoBanner.destroy();
    }

    this.infernoBanner = this.scene.add
      .text(this.scene.scale.width / 2, this.scene.scale.height / 2, 'INFERNO SPIN!', {
        fontFamily: 'Arial Black',
        fontSize: '80px',
        color: '#ff0000',
        stroke: GOLD_STR,
        strokeThickness: 10,
        shadow: {
          offsetX: 5,
          offsetY: 5,
          color: '#000',
          blur: 10,
          fill: true,
        },
      })
      .setOrigin(0.5)
      .setDepth(200)
      .setScale(0)
      .setAlpha(0);

    this.scene.tweens.add({
      targets: this.infernoBanner,
      alpha: 1,
      scale: 1.2,
      duration: ANIM_DURATION_INFERNO_BANNER / 2,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.scene.tweens.add({
          targets: this.infernoBanner,
          alpha: 0,
          scale: 0,
          duration: ANIM_DURATION_INFERNO_BANNER / 2,
          ease: 'Back.easeIn',
          delay: 500, // Hold for a bit
          onComplete: () => {
            this.infernoBanner?.destroy();
            this.infernoBanner = null;
            onComplete();
          },
        });
      },
    });
  }

  /**
   * Destroys all UI elements created by this class, cleaning up resources.
   * @example
   * ui.destroy();
   */
  destroy(): void {
    this.gridContainer.destroy();
    this.heatMeterGraphics.destroy();
    this.betText.destroy();
    this.winText.destroy();
    this.currentWinBadge?.destroy();
    this.infernoBanner?.destroy();
    this.hideCrownFlip(); // Ensure crown flip container is destroyed
  }
}

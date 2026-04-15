/**
 * @file WildFrontierUI.ts
 * @purpose Phaser rendering for Wild Frontier slot — themed UI, reel display, spin button, win animations.
 * @author C-3PO
 * @date 2026-04-14
 * @license Proprietary – available for licensing
 */

import * as Phaser from 'phaser';
import type { WildFrontierSymbol, WildFrontierConfig, WildFrontierState } from './WildFrontierLogic';
import { createWildFrontierState, spinWildFrontier, REELS_COUNT, ROWS_COUNT } from './WildFrontierLogic';

const GOLD         = 0xc9a84c;
const GOLD_STR     = '#c9a84c';
const DARK_STR     = '#080812';
const FONT_PRIMARY = '"Fredoka One", sans-serif';
// const FONT_SECONDARY = '"Fredoka", sans-serif'; // Removed as it was unused

export class WildFrontierUI {
  private scene: Phaser.Scene;
  private config: WildFrontierConfig;
  private state: WildFrontierState | null = null;

  private reels: Phaser.GameObjects.Container[] = [];
  private symbols: Phaser.GameObjects.Image[][] = []; // For actual symbol display
  private spinButton: Phaser.GameObjects.Container | null = null;
  private spinLabel: Phaser.GameObjects.Text | null = null;
  private winText: Phaser.GameObjects.Text | null = null;
  private betText: Phaser.GameObjects.Text | null = null;
  private paylinesGraphic: Phaser.GameObjects.Graphics | null = null;
  private homeButton: Phaser.GameObjects.Text | null = null;
  private freeSpinsText: Phaser.GameObjects.Text | null = null;

  private readonly SYMBOL_SIZE = 100;
  private readonly REEL_WIDTH  = 110; // Slightly wider than symbol to allow spacing
  // REEL_HEIGHT is calculated using ROWS_COUNT from Logic, no longer a local constant
  private readonly GAP         = 10; // Gap between reels

  constructor(scene: Phaser.Scene, config: WildFrontierConfig = {}) {
    this.scene  = scene;
    this.config = config;
  }

  public start(): void {
    this.cleanup();
    this.state = createWildFrontierState(1, 25); // Bet 1 credit per line on 25 lines
    this.loadAssets(); // Ensure assets are loaded
    this.buildBackground();
    this.buildReels();
    this.buildSlotFrame();
    this.buildSpinButton();
    this.buildHUD();
    this.updateReels(this.state.reelStops, false); // Initial display
  }

  public cleanup(): void {
    // Destroy all UI elements to prevent memory leaks
    this.reels.forEach(reel => reel.destroy());
    this.symbols.forEach(col => col.forEach(s => s.destroy()));
    this.spinButton?.destroy();
    this.spinLabel?.destroy();
    this.winText?.destroy();
    this.betText?.destroy();
    this.paylinesGraphic?.destroy();
    this.homeButton?.destroy();
    this.freeSpinsText?.destroy();
    this.reels = [];
    this.symbols = [];
    this.state = null;
  }

  // ─── Asset Loading ────────────────────────────────────────────────────────
  private loadAssets(): void {
    // These are placeholders. Real assets would be loaded via scene.load.image().
    // For now, we will draw simple graphic representations.
    // Once AI assets are ready, this method will be properly implemented.

    // Ensure the scene has access to graphics for drawing placeholder symbols.
    // If we were loading actual images, this would not be needed here.
    if (!this.scene.textures.exists('placeholder_square')) {
      const graphics = this.scene.add.graphics({ fillStyle: { color: 0xffffff } });
      graphics.fillRect(0, 0, 1, 1); // 1x1 white pixel
      graphics.generateTexture('placeholder_square', 1, 1);
      graphics.destroy();
    }
  }

  // ─── Build UI Components ──────────────────────────────────────────────────

  private buildBackground(): void {
    // Conceptual background: dusty canyons, arid plains. For now, a simple dark grey.
    this.scene.add.rectangle(
      this.scene.scale.width / 2,
      this.scene.scale.height / 2,
      this.scene.scale.width,
      this.scene.scale.height,
      0x1a1a1a // Dark grey for a dusty, arid feel
    ).setOrigin(0.5);
  }

  private buildReels(): void {
    const { width, height } = this.scene.scale;
    const totalReelWidth = (this.REEL_WIDTH * REELS_COUNT) + (this.GAP * (REELS_COUNT - 1));
    const startX = (width - totalReelWidth) / 2;
    const y = height * 0.45; // Centered vertically for reels

    for (let i = 0; i < REELS_COUNT; i++) {
      const reelContainer = this.scene.add.container(startX + i * (this.REEL_WIDTH + this.GAP), y);
      reelContainer.setSize(this.REEL_WIDTH, this.SYMBOL_SIZE * ROWS_COUNT);
      // Note: Phaser.GameObjects.Container does not support setOrigin; position is already the anchor
      this.reels.push(reelContainer);

      const symbolColumn: Phaser.GameObjects.Image[] = [];
      for (let j = 0; j < ROWS_COUNT; j++) {
        const symbol = this.drawSymbolPlaceholder(
          0, // x relative to container
          (j - (ROWS_COUNT - 1) / 2) * this.SYMBOL_SIZE, // y relative to container
          this.SYMBOL_SIZE, '10' // Default symbol
        );
        reelContainer.add(symbol);
        symbolColumn.push(symbol);
      }
      this.symbols.push(symbolColumn);
    }
  }

  private buildSlotFrame(): void {
    const { width, height } = this.scene.scale;
    const totalReelWidth = (this.REEL_WIDTH * REELS_COUNT) + (this.GAP * (REELS_COUNT - 1));
    const frameWidth = totalReelWidth + 40; // Frame wider than reels
    const frameHeight = (this.SYMBOL_SIZE * ROWS_COUNT) + 40; // Frame taller than reels
    const frameX = width / 2;
    const frameY = height * 0.45; // Same center Y as reels

    const frame = this.scene.add.graphics();
    frame.fillStyle(0x4a2c1b, 1); // Rough-hewn timber dark brown
    frame.lineStyle(4, GOLD, 0.8); // Gold trim
    frame.fillRoundedRect(frameX - frameWidth / 2, frameY - frameHeight / 2, frameWidth, frameHeight, 20);
    frame.strokeRoundedRect(frameX - frameWidth / 2, frameY - frameHeight / 2, frameWidth, frameHeight, 20);

    // Add frame to scene, behind reels
    this.scene.children.sendToBack(frame);
  }

  private buildSpinButton(): void {
    const { width, height } = this.scene.scale;
    const cx = width / 2, cy = height * 0.85;

    const buttonBg = this.scene.add.graphics();
    buttonBg.fillStyle(GOLD, 1);
    buttonBg.fillRoundedRect(-100, -30, 200, 60, 15); // Relative coords for container

    const buttonLabel = this.scene.add.text(0, 0, 'SPIN', {
      fontFamily: FONT_PRIMARY, fontSize: '36px', color: DARK_STR,
    }).setOrigin(0.5);

    this.spinButton = this.scene.add.container(cx, cy, [buttonBg, buttonLabel])
      .setSize(200, 60)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.handleSpin())
      .on('pointerover', () => buttonBg.fillStyle(0xddb83a, 1).fillRoundedRect(-100, -30, 200, 60, 15))
      .on('pointerout',  () => buttonBg.fillStyle(GOLD, 1).fillRoundedRect(-100, -30, 200, 60, 15));

    this.spinLabel = buttonLabel; // Keep reference to label for text changes
  }

  private buildHUD(): void {
    const { width, height } = this.scene.scale;

    this.betText = this.scene.add.text(width * 0.15, height * 0.10, `BET: $${this.state?.bet || 1} / LINE`, {
      fontFamily: FONT_PRIMARY, fontSize: '20px', color: GOLD_STR,
    }).setOrigin(0.5).setDepth(10);

    this.winText = this.scene.add.text(width * 0.85, height * 0.10, 'WIN: $0.00', {
      fontFamily: FONT_PRIMARY, fontSize: '20px', color: GOLD_STR,
    }).setOrigin(0.5).setDepth(10);

    this.freeSpinsText = this.scene.add.text(width / 2, height * 0.15, '', {
      fontFamily: FONT_PRIMARY, fontSize: '24px', color: '#44ff88', // Green for free spins
    }).setOrigin(0.5).setDepth(10);

    this.homeButton = this.scene.add.text(width / 2, height - 20, '< HOME', {
      fontFamily: FONT_PRIMARY, fontSize: '14px', color: '#666677',
    }).setOrigin(0.5).setDepth(10)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => { this.cleanup(); this.scene.scene.start('HomeScene'); });
  }

  // ─── Symbol Drawing ───────────────────────────────────────────────────────

  private getSymbolColor(symbol: WildFrontierSymbol): number {
    switch (symbol) {
      case 'COWBOY':       return 0xcc4444;
      case 'INDIGENOUS_GUIDE': return 0x44cc44;
      case 'HORSE':        return 0x4444cc;
      case 'BUFFALO':      return 0xaaaaaa;
      case 'GOLD_NUGGET':  return 0xffff00;
      case 'WILD':         return 0xff8800;
      case 'SCATTER':      return 0x00ffff;
      case 'A':            return 0x888888;
      case 'K':            return 0x777777;
      case 'Q':            return 0x666666;
      case 'J':            return 0x555555;
      case '10':           return 0x444444;
      default:             return 0xffffff;
    }
  }

  private drawSymbolPlaceholder(
    x: number, y: number, size: number, symbol: WildFrontierSymbol
  ): Phaser.GameObjects.Image {
    // For now, we use a simple colored rectangle with text.
    // This will be replaced by actual image assets later.
    const graphics = this.scene.add.graphics();
    graphics.fillStyle(this.getSymbolColor(symbol), 1);
    graphics.fillRect(-size / 2, -size / 2, size, size); // Centered rectangle
    graphics.lineStyle(2, GOLD, 0.5);
    graphics.strokeRect(-size / 2, -size / 2, size, size);

    const text = this.scene.add.text(0, 0, this.getSymbolText(symbol), {
      fontFamily: FONT_PRIMARY, fontSize: '24px', color: DARK_STR, // Use DARK_STR
      align: 'center',
    }).setOrigin(0.5);

    const container = this.scene.add.container(x, y, [graphics, text]);
    return container as unknown as Phaser.GameObjects.Image; // Treat container as image for reel animation
  }

  private getSymbolText(symbol: WildFrontierSymbol): string {
    switch (symbol) {
      case 'INDIGENOUS_GUIDE': return 'IND.'; // Abbreviate for placeholder
      case 'GOLD_NUGGET': return 'GOLD';
      default: return symbol.toString();
    }
  }

  // ─── Update/Interaction ───────────────────────────────────────────────────

  /**
   * Updates the visual display of the reels.
   * @param reelStops - The final symbols to display on the reels.
   * @param animate - Whether to animate the reel spin (true) or just snap (false).
   */
  public updateReels(reelStops: WildFrontierSymbol[][], _animate: boolean): void {
    // This will be the complex part for animations later.
    // For now, it will simply update the symbols directly.
    reelStops.forEach((column, reelIndex) => {
      column.forEach((symbol, rowIndex) => {
        // Replace the old symbol graphic with a new one
        if (this.symbols[reelIndex] && this.symbols[reelIndex][rowIndex]) {
          this.symbols[reelIndex][rowIndex].destroy();
        }
        const newSymbol = this.drawSymbolPlaceholder(
          0, // x relative to container
          (rowIndex - (ROWS_COUNT - 1) / 2) * this.SYMBOL_SIZE, // y relative to container
          this.SYMBOL_SIZE, symbol
        );
        this.reels[reelIndex].add(newSymbol);
        this.symbols[reelIndex][rowIndex] = newSymbol;
      });
    });

    this.paylinesGraphic?.clear(); // Clear old payline highlights
    this.winText?.setText(`WIN: $${this.state!.totalWin.toFixed(2)}`);
  }

  private handleSpin(): void {
    if (!this.state || !this.spinButton) return;

    this.spinButton.disableInteractive();
    this.spinLabel?.setText('SPINNING...');
    this.winText?.setText('WIN: $0.00'); // Reset win text
    this.paylinesGraphic?.clear(); // Clear previous win highlights

    spinWildFrontier(this.state, this.config);

    // Simulate spin animation for now
    this.scene.time.delayedCall(1500, () => {
      this.updateReels(this.state!.reelStops, true);
      this.spinButton?.setInteractive({ useHandCursor: true });
      this.spinLabel?.setText('SPIN');
      this.showWinAnimation(this.state!.totalWin);
      if (this.state!.freeSpinsRemaining > 0) {
        this.freeSpinsText?.setText(`FREE SPINS: ${this.state!.freeSpinsRemaining}`);
      } else {
        this.freeSpinsText?.setText('');
      }
    });
  }

  private showWinAnimation(winAmount: number): void {
    if (winAmount > 0) {
      this.winText?.setText(`BIG WIN! $${winAmount.toFixed(2)}`).setColor('#44ff88');
      // TODO: Play win sound, particle effects, highlight winning paylines
    } else {
      this.winText?.setText(`WIN: $0.00`).setColor(GOLD_STR);
    }
  }
}

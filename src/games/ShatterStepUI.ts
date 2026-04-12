/**
 * @file ShatterStepUI.ts
 * @purpose Phaser rendering and input for Shatter Step — 10-row ladder, tile buttons,
 *          multiplier HUD, cash-out button. Delegates logic to ShatterStepLogic.
 * @author Agent 934
 * @date 2026-04-12
 * @license Proprietary – available for licensing
 */

import Phaser from 'phaser';
import {
  ShatterStepState,
  ShatterStepConfig,
  TileSide,
  createShatterStepState,
  pickTile,
  cashOutShatterStep,
} from './ShatterStepLogic';

const GOLD = 0xc9a84c;
const TILE_IDLE = 0x1a1a2e;
const TILE_HOVER = 0x2a2a4e;
const TILE_WIN = 0x1a3a1a;
const TILE_LOSE = 0x3a1a1a;
const TOTAL_ROWS = 10;

/**
 * Manages all Phaser game objects for Shatter Step within a given scene.
 *
 * @example
 * const ui = new ShatterStepUI(scene, 390, 844);
 * ui.start(10);
 */
export class ShatterStepUI {
  private scene: Phaser.Scene;
  private worldWidth: number;
  private worldHeight: number;
  private state: ShatterStepState | null = null;
  private config: ShatterStepConfig = {};

  private tileObjects: Array<{
    left: Phaser.GameObjects.Rectangle;
    right: Phaser.GameObjects.Rectangle;
    leftLabel: Phaser.GameObjects.Text;
    rightLabel: Phaser.GameObjects.Text;
  }> = [];

  private multiplierText: Phaser.GameObjects.Text | null = null;
  private rowText: Phaser.GameObjects.Text | null = null;
  private statusText: Phaser.GameObjects.Text | null = null;
  private cashOutButton: Phaser.GameObjects.Rectangle | null = null;
  private cashOutLabel: Phaser.GameObjects.Text | null = null;

  constructor(scene: Phaser.Scene, worldWidth: number, worldHeight: number) {
    this.scene = scene;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
  }

  /**
   * Starts a new Shatter Step game with the given bet.
   *
   * @param bet - Credit amount wagered.
   * @returns void
   *
   * @example
   * ui.start(10);
   */
  public start(bet: number): void {
    this.cleanup();
    this.state = createShatterStepState(bet, this.config);
    this.buildLadder();
    this.buildHUD();
  }

  /**
   * Destroys all Phaser game objects managed by this UI.
   *
   * @returns void
   */
  public cleanup(): void {
    for (const row of this.tileObjects) {
      row.left.destroy();
      row.right.destroy();
      row.leftLabel.destroy();
      row.rightLabel.destroy();
    }
    this.tileObjects = [];
    this.multiplierText?.destroy();
    this.rowText?.destroy();
    this.statusText?.destroy();
    this.cashOutButton?.destroy();
    this.cashOutLabel?.destroy();
    this.state = null;
  }

  private buildLadder(): void {
    const tileWidth = this.worldWidth * 0.38;
    const tileHeight = 48;
    const gapY = 10;
    const ladderStartY = this.worldHeight * 0.25;
    const centerX = this.worldWidth / 2;

    for (let rowIndex = 0; rowIndex < TOTAL_ROWS; rowIndex++) {
      const displayRow = TOTAL_ROWS - rowIndex; // top row = row 10
      const y = ladderStartY + rowIndex * (tileHeight + gapY);

      const leftRect = this.scene.add
        .rectangle(centerX - tileWidth / 2 - 6, y, tileWidth, tileHeight, TILE_IDLE)
        .setStrokeStyle(1, GOLD, 0.3)
        .setInteractive({ useHandCursor: true });

      const rightRect = this.scene.add
        .rectangle(centerX + tileWidth / 2 + 6, y, tileWidth, tileHeight, TILE_IDLE)
        .setStrokeStyle(1, GOLD, 0.3)
        .setInteractive({ useHandCursor: true });

      const leftLabel = this.scene.add
        .text(centerX - tileWidth / 2 - 6, y, `${displayRow}L`, {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: '#c9a84c',
        })
        .setOrigin(0.5);

      const rightLabel = this.scene.add
        .text(centerX + tileWidth / 2 + 6, y, `${displayRow}R`, {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: '#c9a84c',
        })
        .setOrigin(0.5);

      leftRect.on('pointerover', () => leftRect.setFillColor(TILE_HOVER));
      leftRect.on('pointerout', () => leftRect.setFillColor(TILE_IDLE));
      rightRect.on('pointerover', () => rightRect.setFillColor(TILE_HOVER));
      rightRect.on('pointerout', () => rightRect.setFillColor(TILE_IDLE));

      leftRect.on('pointerdown', () => this.handlePick('left', rowIndex));
      rightRect.on('pointerdown', () => this.handlePick('right', rowIndex));

      this.tileObjects.push({ left: leftRect, right: rightRect, leftLabel, rightLabel });
    }
  }

  private buildHUD(): void {
    this.multiplierText = this.scene.add
      .text(16, 16, 'x1.00', {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#c9a84c',
      });

    this.rowText = this.scene.add
      .text(16, 44, 'ROW: 0 / 10', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#888888',
      });

    this.statusText = this.scene.add
      .text(this.worldWidth / 2, this.worldHeight * 0.88, '', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    this.cashOutButton = this.scene.add
      .rectangle(this.worldWidth - 70, 28, 120, 40, GOLD)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.handleCashOut());

    this.cashOutLabel = this.scene.add
      .text(this.worldWidth - 70, 28, 'CASH OUT', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#0d0d0d',
      })
      .setOrigin(0.5);
  }

  private handlePick(side: TileSide, rowIndex: number): void {
    if (!this.state || !this.state.isAlive || this.state.cashedOut) return;

    // Only allow picking the current row (bottom-most active row)
    const activeRowIndex = TOTAL_ROWS - 1 - this.state.currentRow;
    if (rowIndex !== activeRowIndex) return;

    pickTile(this.state, side, this.config);
    this.updateTileResult(rowIndex, side, this.state.lastPickCorrect === true);

    if (!this.state.isAlive) {
      this.lockAllTiles();
      this.showStatus('SHATTERED', '#ff4444');
    } else {
      this.multiplierText?.setText(`x${this.state.multiplier.toFixed(2)}`);
      this.rowText?.setText(`ROW: ${this.state.currentRow} / 10`);
      if (this.state.cashedOut) {
        this.showStatus(`PAID OUT: ${this.state.payout.toFixed(2)}`, '#c9a84c');
      }
    }
  }

  private handleCashOut(): void {
    if (!this.state) return;
    const payout = cashOutShatterStep(this.state);
    if (payout > 0) {
      this.lockAllTiles();
      this.showStatus(`PAID OUT: ${payout.toFixed(2)}`, '#c9a84c');
    }
  }

  private updateTileResult(rowIndex: number, side: TileSide, won: boolean): void {
    const row = this.tileObjects[rowIndex];
    if (!row) return;
    const winColor = won ? TILE_WIN : TILE_LOSE;
    const loseColor = won ? TILE_LOSE : TILE_WIN;
    if (side === 'left') {
      row.left.setFillColor(winColor);
      row.right.setFillColor(loseColor);
    } else {
      row.right.setFillColor(winColor);
      row.left.setFillColor(loseColor);
    }
  }

  private lockAllTiles(): void {
    for (const row of this.tileObjects) {
      row.left.disableInteractive();
      row.right.disableInteractive();
    }
  }

  private showStatus(message: string, color: string): void {
    this.statusText?.setText(message).setColor(color);
  }
}

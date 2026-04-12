/**
 * @file ShatterStepUI.ts
 * @purpose Phaser rendering for Shatter Step — glass tile ladder, 2D mini player
 *          that walks upward on correct picks and falls with shatter animation on wrong picks.
 * @author Agent 934
 * @date 2026-04-12
 * @license Proprietary – available for licensing
 */

import * as Phaser from 'phaser';
import type { ShatterStepState, ShatterStepConfig, TileSide } from './ShatterStepLogic';
import { createShatterStepState, pickTile, cashOutShatterStep } from './ShatterStepLogic';

const GOLD = 0xc9a84c;
const GOLD_STR = '#c9a84c';
const TOTAL_ROWS = 10;

// Glass tile colours
const GLASS_FILL   = 0x88ccee;
const GLASS_ALPHA  = 0.18;
const GLASS_STROKE = 0xaaddff;
const GLASS_SHINE  = 0xffffff;

const CRACK_COLOR  = 0xffffff;
const WIN_GLOW     = 0x44ffaa;
const LOSE_GLOW    = 0xff4444;

/**
 * Manages Phaser game objects for Shatter Step.
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

  // Tile geometry cache
  private tileRows: Array<{
    y: number;
    leftX: number;
    rightX: number;
    tileW: number;
    tileH: number;
  }> = [];

  // Tile Phaser objects
  private tileObjects: Array<{
    leftBg: Phaser.GameObjects.Graphics;
    rightBg: Phaser.GameObjects.Graphics;
    leftHit: Phaser.GameObjects.Rectangle;
    rightHit: Phaser.GameObjects.Rectangle;
    leftLabel: Phaser.GameObjects.Text;
    rightLabel: Phaser.GameObjects.Text;
  }> = [];

  // Player sprite (simple 2D figure)
  private playerGroup: Phaser.GameObjects.Group | null = null;
  private playerBody: Phaser.GameObjects.Rectangle | null = null;
  private playerHead: Phaser.GameObjects.Arc | null = null;
  private playerTargetY = 0;
  private playerCurrentY = 0;
  private playerX = 0;
  private playerAlive = true;
  private playerVelocityY = 0;

  // HUD
  private multiplierText: Phaser.GameObjects.Text | null = null;
  private rowText: Phaser.GameObjects.Text | null = null;
  private statusText: Phaser.GameObjects.Text | null = null;
  private cashOutButton: Phaser.GameObjects.Rectangle | null = null;
  private cashOutLabel: Phaser.GameObjects.Text | null = null;

  // Shard pool for shatter FX
  private shards: Phaser.GameObjects.Rectangle[] = [];

  // Update loop
  private updateTimer: Phaser.Time.TimerEvent | null = null;

  constructor(scene: Phaser.Scene, worldWidth: number, worldHeight: number) {
    this.scene = scene;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
  }

  /**
   * Starts a new Shatter Step game.
   *
   * @param bet - Credit wager.
   * @returns void
   *
   * @example
   * ui.start(10);
   */
  public start(bet: number): void {
    this.cleanup();
    this.state = createShatterStepState(bet, this.config);
    this.buildLadder();
    this.buildPlayer();
    this.buildHUD();
    this.updateTimer = this.scene.time.addEvent({
      delay: 16,
      loop: true,
      callback: this.onUpdate,
      callbackScope: this,
    });
  }

  /** Destroys all managed Phaser objects. */
  public cleanup(): void {
    this.updateTimer?.remove();
    this.updateTimer = null;
    for (const row of this.tileObjects) {
      row.leftBg.destroy();
      row.rightBg.destroy();
      row.leftHit.destroy();
      row.rightHit.destroy();
      row.leftLabel.destroy();
      row.rightLabel.destroy();
    }
    this.tileObjects = [];
    this.tileRows = [];
    this.playerBody?.destroy();
    this.playerHead?.destroy();
    this.playerGroup?.destroy(true);
    for (const s of this.shards) s.destroy();
    this.shards = [];
    this.multiplierText?.destroy();
    this.rowText?.destroy();
    this.statusText?.destroy();
    this.cashOutButton?.destroy();
    this.cashOutLabel?.destroy();
    this.state = null;
  }

  // ─── Build ────────────────────────────────────────────────────────────────

  private buildLadder(): void {
    const tileW   = this.worldWidth * 0.38;
    const tileH   = 46;
    const gapY    = 9;
    const startY  = this.worldHeight * 0.22;
    const centerX = this.worldWidth / 2;
    const leftX   = centerX - tileW / 2 - 8;
    const rightX  = centerX + tileW / 2 + 8;

    for (let i = 0; i < TOTAL_ROWS; i++) {
      const y = startY + i * (tileH + gapY);
      this.tileRows.push({ y, leftX, rightX, tileW, tileH });

      const leftBg  = this.makeGlassTile(leftX,  y, tileW, tileH);
      const rightBg = this.makeGlassTile(rightX, y, tileW, tileH);

      // Invisible hit areas
      const leftHit = this.scene.add
        .rectangle(leftX, y, tileW, tileH, 0x000000, 0)
        .setInteractive({ useHandCursor: true });
      const rightHit = this.scene.add
        .rectangle(rightX, y, tileW, tileH, 0x000000, 0)
        .setInteractive({ useHandCursor: true });

      const rowLabel = TOTAL_ROWS - i;
      const labelStyle = {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#aaddff',
      };
      const leftLabel  = this.scene.add.text(leftX,  y, `${rowLabel}`, labelStyle).setOrigin(0.5);
      const rightLabel = this.scene.add.text(rightX, y, `${rowLabel}`, labelStyle).setOrigin(0.5);

      leftHit.on('pointerdown',  () => this.handlePick('left',  i));
      rightHit.on('pointerdown', () => this.handlePick('right', i));

      this.tileObjects.push({ leftBg, rightBg, leftHit, rightHit, leftLabel, rightLabel });
    }

    // Player starts below the bottom row
    const bottomRow = this.tileRows[TOTAL_ROWS - 1];
    this.playerX  = this.worldWidth / 2;
    this.playerTargetY  = bottomRow.y + 60;
    this.playerCurrentY = this.playerTargetY;
  }

  private makeGlassTile(
    cx: number, cy: number, w: number, h: number
  ): Phaser.GameObjects.Graphics {
    const g = this.scene.add.graphics();
    this.drawGlass(g, cx, cy, w, h, false);
    return g;
  }

  private drawGlass(
    g: Phaser.GameObjects.Graphics,
    cx: number, cy: number, w: number, h: number,
    cracked: boolean
  ): void {
    g.clear();
    const x = cx - w / 2;
    const y = cy - h / 2;
    const r = 6;

    // Main glass fill
    g.fillStyle(GLASS_FILL, GLASS_ALPHA);
    g.fillRoundedRect(x, y, w, h, r);

    // Stroke
    g.lineStyle(1.5, GLASS_STROKE, 0.7);
    g.strokeRoundedRect(x, y, w, h, r);

    // Top shine strip
    g.fillStyle(GLASS_SHINE, 0.18);
    g.fillRoundedRect(x + 4, y + 3, w - 8, h * 0.3, 3);

    if (cracked) {
      // Draw crack lines
      g.lineStyle(1, CRACK_COLOR, 0.9);
      // Main crack
      g.beginPath();
      g.moveTo(cx - 5, cy - h * 0.4);
      g.lineTo(cx + 8, cy + h * 0.1);
      g.lineTo(cx - 3, cy + h * 0.4);
      g.strokePath();
      // Branch crack
      g.beginPath();
      g.moveTo(cx + 8, cy + h * 0.1);
      g.lineTo(cx + 20, cy - h * 0.1);
      g.strokePath();
      g.beginPath();
      g.moveTo(cx + 8, cy + h * 0.1);
      g.lineTo(cx + 15, cy + h * 0.35);
      g.strokePath();
    }
  }

  private buildPlayer(): void {
    // Simple 2D stick figure: circle head + rectangle body
    this.playerHead = this.scene.add.arc(
      this.playerX,
      this.playerCurrentY - 18,
      8, 0, 360, false, GOLD
    );
    this.playerBody = this.scene.add.rectangle(
      this.playerX,
      this.playerCurrentY,
      8, 20,
      GOLD
    );
    this.playerAlive = true;
  }

  private buildHUD(): void {
    this.multiplierText = this.scene.add
      .text(16, 16, 'x1.00', {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: GOLD_STR,
      });

    this.rowText = this.scene.add
      .text(16, 44, 'ROW: 0 / 10', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#888888',
      });

    this.statusText = this.scene.add
      .text(this.worldWidth / 2, this.worldHeight * 0.90, '', {
        fontFamily: 'monospace',
        fontSize: '18px',
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

  // ─── Interaction ──────────────────────────────────────────────────────────

  private handlePick(side: TileSide, rowIndex: number): void {
    if (!this.state || !this.state.isAlive || this.state.cashedOut) return;

    const activeRowIndex = TOTAL_ROWS - 1 - this.state.currentRow;
    if (rowIndex !== activeRowIndex) return;

    pickTile(this.state, side, this.config);
    const row = this.tileRows[rowIndex];
    const obj = this.tileObjects[rowIndex];
    const won = this.state.lastPickCorrect === true;

    if (won) {
      // Flash winning tile gold, crack the other
      const winX  = side === 'left' ? row.leftX  : row.rightX;
      const loseX = side === 'left' ? row.rightX : row.leftX;
      const winBg  = side === 'left' ? obj.leftBg  : obj.rightBg;
      const loseBg = side === 'left' ? obj.rightBg : obj.leftBg;

      // Gold glow on winner
      this.flashTile(winBg, winX, row.y, row.tileW, row.tileH, WIN_GLOW);
      // Crack on the wrong tile
      this.drawGlass(loseBg, loseX, row.y, row.tileW, row.tileH, true);

      // Move player INTO the winning tile (on top of it)
      this.playerX = winX;
      this.playerTargetY = row.y - row.tileH / 2 - 22; // land on top of tile surface
      this.multiplierText?.setText(`x${this.state.multiplier.toFixed(2)}`);
      this.rowText?.setText(`ROW: ${this.state.currentRow} / 10`);

      if (this.state.cashedOut) {
        this.statusText?.setText(`✓ PAID OUT: ${this.state.payout.toFixed(2)}`).setColor(GOLD_STR);
        this.lockAllTiles();
      }
    } else {
      // Wrong pick — crack the chosen tile, then shatter + fall
      const chosenBg = side === 'left' ? obj.leftBg : obj.rightBg;
      const chosenX  = side === 'left' ? row.leftX  : row.rightX;

      this.drawGlass(chosenBg, chosenX, row.y, row.tileW, row.tileH, true);

      // Brief delay then shatter
      this.scene.time.delayedCall(180, () => {
        this.shatterTile(chosenBg, chosenX, row.y, row.tileW, row.tileH);
        this.playerAlive = false;
        this.playerVelocityY = -2; // small upward bump then fall
      });

      this.lockAllTiles();
      this.scene.time.delayedCall(900, () => {
        this.statusText?.setText('✗ SHATTERED').setColor('#ff4444');
      });
    }
  }

  private handleCashOut(): void {
    if (!this.state) return;
    const payout = cashOutShatterStep(this.state);
    if (payout > 0) {
      this.lockAllTiles();
      this.statusText?.setText(`✓ PAID OUT: ${payout.toFixed(2)}`).setColor(GOLD_STR);
    }
  }

  // ─── Visual FX ────────────────────────────────────────────────────────────

  private flashTile(
    g: Phaser.GameObjects.Graphics,
    cx: number, cy: number, w: number, h: number,
    color: number
  ): void {
    g.clear();
    const x = cx - w / 2;
    const y = cy - h / 2;
    g.fillStyle(color, 0.35);
    g.fillRoundedRect(x, y, w, h, 6);
    g.lineStyle(2, color, 1);
    g.strokeRoundedRect(x, y, w, h, 6);
    // Fade back to glass after 400ms
    this.scene.time.delayedCall(400, () => {
      this.drawGlass(g, cx, cy, w, h, false);
    });
  }

  private shatterTile(
    g: Phaser.GameObjects.Graphics,
    cx: number, cy: number, w: number, h: number
  ): void {
    g.clear(); // Remove tile

    // Spawn glass shards
    const shardCount = 10;
    for (let i = 0; i < shardCount; i++) {
      const sw = Phaser.Math.Between(6, 18);
      const sh = Phaser.Math.Between(4, 12);
      const shard = this.scene.add.rectangle(cx, cy, sw, sh, GLASS_STROKE, 0.8);
      this.shards.push(shard);

      const angle = (i / shardCount) * Math.PI * 2;
      const speed = Phaser.Math.Between(60, 160);
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed - 80;

      this.scene.tweens.add({
        targets: shard,
        x: shard.x + vx * 0.6,
        y: shard.y + vy * 0.6 + 120,
        alpha: 0,
        angle: Phaser.Math.Between(-180, 180),
        duration: 700,
        ease: 'Quad.easeIn',
        onComplete: () => {
          shard.destroy();
          this.shards = this.shards.filter(s => s !== shard);
        },
      });
    }

    // Flash red
    const flash = this.scene.add.rectangle(cx, cy, w, h, LOSE_GLOW, 0.4);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 300,
      onComplete: () => flash.destroy(),
    });
  }

  // ─── Update loop ──────────────────────────────────────────────────────────

  private onUpdate(): void {
    if (!this.playerBody || !this.playerHead) return;

    if (this.playerAlive) {
      // Smooth walk up toward target
      const dy = this.playerTargetY - this.playerCurrentY;
      if (Math.abs(dy) > 1) {
        this.playerCurrentY += dy * 0.12;
      } else {
        this.playerCurrentY = this.playerTargetY;
      }
    } else {
      // Fall with gravity
      this.playerVelocityY += 0.6;
      this.playerCurrentY  += this.playerVelocityY;

      // Rotate and fade as they fall
      this.playerBody.angle += 3;
      this.playerHead.angle += 3;
      if (this.playerBody.alpha > 0) {
        this.playerBody.alpha -= 0.012;
        this.playerHead.alpha -= 0.012;
      }
    }

    this.playerBody.setPosition(this.playerX, this.playerCurrentY);
    this.playerHead.setPosition(this.playerX, this.playerCurrentY - 18);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private lockAllTiles(): void {
    for (const obj of this.tileObjects) {
      obj.leftHit.disableInteractive();
      obj.rightHit.disableInteractive();
    }
  }
}

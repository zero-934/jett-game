/**
 * @file MinesUI.ts
 * @purpose Phaser rendering for Mines — 5×5 grid, bomb selector, reveal FX, cash-out.
 * @author Agent 934
 * @date 2026-04-13
 * @license Proprietary – available for licensing
 */

import * as Phaser from 'phaser';
import type { MinesConfig, BombCount } from './MinesLogic';
import { createMinesState, revealTile, cashOutMines } from './MinesLogic';

const GOLD     = 0xc9a84c;
const GOLD_STR = '#c9a84c';
const DARK     = 0x080812;
const TILE_HIDDEN = 0x0e0e1c;
const TILE_SAFE   = 0x0a2a0a;
const TILE_BOMB   = 0x2a0a0a;

export class MinesUI {
  private scene:  Phaser.Scene;
  private config: MinesConfig;
  private state:  ReturnType<typeof createMinesState> | null = null;

  private tileObjects: { bg: Phaser.GameObjects.Graphics; icon: Phaser.GameObjects.Text }[] = [];
  private multiplierText: Phaser.GameObjects.Text | null = null;
  private statusText:     Phaser.GameObjects.Text | null = null;
  private cashOutBtn:     Phaser.GameObjects.Rectangle | null = null;
  private cashOutLabel:   Phaser.GameObjects.Text | null = null;
  private homeButton:     Phaser.GameObjects.Container | null = null;
  private bombSelectorObjs: Phaser.GameObjects.GameObject[] = [];


  private readonly BET = 10;
  private selectedBombs: BombCount = 5;

  constructor(scene: Phaser.Scene, config: MinesConfig = {}) {
    this.scene  = scene;
    this.config = config;
  }

  public start(): void {
    this.cleanup();

    this.buildBombSelector();
  }

  public cleanup(): void {
    for (const { bg, icon } of this.tileObjects) { bg.destroy(); icon.destroy(); }
    this.tileObjects = [];
    for (const o of this.bombSelectorObjs) (o as Phaser.GameObjects.GameObject & { destroy(): void }).destroy();
    this.bombSelectorObjs = [];
    this.multiplierText?.destroy();
    this.statusText?.destroy();
    this.cashOutBtn?.destroy();
    this.cashOutLabel?.destroy();
    this.homeButton?.destroy();
    this.state = null;
  }

  private buildBombSelector(): void {
    const { width, height } = this.scene.scale;
    const cy = height * 0.38;

    const title = this.scene.add.text(width / 2, cy - 60, 'HOW MANY MINES?', {
      fontFamily: '"Fredoka One", sans-serif', fontSize: '18px', color: '#444455', letterSpacing: 2,
    }).setOrigin(0.5);
    this.bombSelectorObjs.push(title);

    const options: BombCount[] = [3, 5, 10];
    const btnW = 80, btnH = 56, gap = 14;
    const total = options.length * btnW + (options.length - 1) * gap;
    const startX = (width - total) / 2;

    for (let i = 0; i < options.length; i++) {
      const count = options[i];
      const cx = startX + i * (btnW + gap) + btnW / 2;

      const bg = this.scene.add.graphics();
      this.paintSelectorBtn(bg, cx, cy, btnW, btnH, count === this.selectedBombs);

      const label = this.scene.add.text(cx, cy, `${count} 💣`, {
        fontFamily: '"Fredoka One", sans-serif', fontSize: '20px', color: GOLD_STR,
      }).setOrigin(0.5).setDepth(2);

      const hit = this.scene.add.rectangle(cx, cy, btnW, btnH, 0, 0)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          this.selectedBombs = count;
          // Refresh button styles
          for (let j = 0; j < options.length; j++) {
            const bj = this.bombSelectorObjs[1 + j * 3] as Phaser.GameObjects.Graphics;
            this.paintSelectorBtn(bj, startX + j * (btnW + gap) + btnW / 2, cy, btnW, btnH, options[j] === count);
          }
        });

      this.bombSelectorObjs.push(bg, label, hit);
    }

    // START button
    const startCy = cy + 60;
    const startBg = this.scene.add.rectangle(width / 2, startCy, 160, 52, GOLD)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.startGame());
    const startLabel = this.scene.add.text(width / 2, startCy, 'START', {
      fontFamily: '"Fredoka One", sans-serif', fontSize: '22px', color: '#000000',
    }).setOrigin(0.5).setDepth(2);
    this.bombSelectorObjs.push(startBg, startLabel);

    // HOME button — gold pill, bottom-centre, always on screen
    const homeBg = this.scene.add.graphics();
    homeBg.fillStyle(0x1a1a2e, 1);
    homeBg.lineStyle(1, 0xc9a84c, 0.6);
    homeBg.fillRoundedRect(-48, -14, 96, 28, 8);
    homeBg.strokeRoundedRect(-48, -14, 96, 28, 8);
    const homeLabel = this.scene.add.text(0, 0, '‹ HOME', {
      fontFamily: 'Arial, sans-serif', fontSize: '14px', color: '#c9a84c',
    }).setOrigin(0.5);
    this.homeButton = this.scene.add.container(width / 2, height - 22, [homeBg, homeLabel])
      .setSize(96, 28).setDepth(20)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => { this.cleanup(); this.scene.scene.start('HomeScene'); });
  }

  private paintSelectorBtn(g: Phaser.GameObjects.Graphics, cx: number, cy: number, w: number, h: number, selected: boolean): void {
    g.clear();
    g.fillStyle(selected ? 0x1a0a0a : DARK, 1);
    g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 10);
    g.lineStyle(selected ? 2 : 1, GOLD, selected ? 0.9 : 0.2);
    g.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 10);
  }

  private startGame(): void {
    // Remove selector
    for (const o of this.bombSelectorObjs) (o as Phaser.GameObjects.GameObject & { destroy(): void }).destroy();
    this.bombSelectorObjs = [];

    this.state = createMinesState(this.BET, this.selectedBombs, this.config);
    this.buildInstructions();
    this.buildGrid();
    this.buildCashOut();
  }

  private buildInstructions(): void {
    const { width, height } = this.scene.scale;
    this.scene.add.text(width / 2, height * 0.085, 'Reveal tiles to grow your multiplier.\nHit a bomb and you lose everything.', {
      fontFamily: '"Fredoka", sans-serif',
      fontSize: '12px', color: '#444455', align: 'center', lineSpacing: 4,
    }).setOrigin(0.5);
  }

  private buildGrid(): void {
    const { width, height } = this.scene.scale;
    const cols = 5, rows = 5;
    const tileW = 62, tileH = 62, gap = 8;
    const totalW = cols * tileW + (cols - 1) * gap;
    const _totalH = rows * tileH + (rows - 1) * gap; void _totalH;
    const startX = (width - totalW) / 2;
    const startY = height * 0.20;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * 5 + c;
        const cx  = startX + c * (tileW + gap) + tileW / 2;
        const cy  = startY + r * (tileH + gap) + tileH / 2;

        const bg = this.scene.add.graphics();
        this.paintTile(bg, cx, cy, tileW, tileH, 'hidden');

        const icon = this.scene.add.text(cx, cy, '', {
          fontFamily: '"Fredoka One", sans-serif', fontSize: '26px', color: GOLD_STR,
        }).setOrigin(0.5).setDepth(2);

        this.scene.add.rectangle(cx, cy, tileW, tileH, 0, 0)
          .setInteractive({ useHandCursor: true })
          .on('pointerdown', () => this.handleReveal(idx, bg, icon, cx, cy, tileW, tileH))
          .on('pointerover', () => { bg.setAlpha(0.7); })
          .on('pointerout',  () => { bg.setAlpha(1); });

        this.tileObjects.push({ bg, icon });
      }
    }
  }

  private paintTile(g: Phaser.GameObjects.Graphics, cx: number, cy: number, w: number, h: number, state: 'hidden' | 'safe' | 'bomb'): void {
    g.clear();
    const color = state === 'safe' ? TILE_SAFE : state === 'bomb' ? TILE_BOMB : TILE_HIDDEN;
    g.fillStyle(color, 1);
    g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 8);
    const borderColor = state === 'safe' ? 0x44ff88 : state === 'bomb' ? 0xff4444 : GOLD;
    const borderAlpha = state === 'hidden' ? 0.18 : 0.8;
    g.lineStyle(1.5, borderColor, borderAlpha);
    g.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 8);
  }

  private buildCashOut(): void {
    const { width, height } = this.scene.scale;

    const { width: w2, height: h2 } = this.scene.scale;

    // Multiplier shown prominently below the grid
    this.scene.add.text(w2 / 2, h2 * 0.72, 'MULTIPLIER', {
      fontFamily: '"Fredoka One", sans-serif', fontSize: '12px', color: '#444455', letterSpacing: 2,
    }).setOrigin(0.5).setDepth(10);

    this.multiplierText = this.scene.add.text(w2 / 2, h2 * 0.765, 'x1.00', {
      fontFamily: '"Fredoka One", sans-serif', fontSize: '32px', color: GOLD_STR,
    }).setOrigin(0.5).setDepth(10);

    this.scene.add.text(16, 16, `BET: ${this.BET}`, {
      fontFamily: '"Fredoka One", sans-serif', fontSize: '15px', color: GOLD_STR,
    }).setDepth(10);

    this.statusText = this.scene.add.text(width / 2, height * 0.88, '', {
      fontFamily: '"Fredoka One", sans-serif', fontSize: '22px', color: '#ffffff', align: 'center',
    }).setOrigin(0.5).setDepth(10);

    this.cashOutBtn = this.scene.add.rectangle(width - 70, 30, 124, 44, GOLD)
      .setInteractive({ useHandCursor: true }).setDepth(10)
      .on('pointerdown', () => this.handleCashOut());

    this.cashOutLabel = this.scene.add.text(width - 70, 30, 'CASH OUT', {
      fontFamily: '"Fredoka One", sans-serif', fontSize: '11px', color: '#000000',
    }).setOrigin(0.5).setDepth(11);
  }

  private handleReveal(
    idx: number,
    bg: Phaser.GameObjects.Graphics,
    icon: Phaser.GameObjects.Text,
    cx: number, cy: number, w: number, h: number
  ): void {
    if (!this.state || !this.state.isAlive || this.state.cashedOut) return;

    revealTile(this.state, idx, this.config);
    const tile = this.state.grid[idx];

    if (tile.state === 'safe') {
      this.paintTile(bg, cx, cy, w, h, 'safe');
      icon.setText('💎');
      this.multiplierText?.setText(`x${this.state.multiplier.toFixed(2)}`).setOrigin(0.5);
    } else if (tile.state === 'bomb') {
      this.paintTile(bg, cx, cy, w, h, 'bomb');
      icon.setText('💣');
      // Reveal all bombs
      for (let i = 0; i < this.tileObjects.length; i++) {
        if (this.state.grid[i].hasBomb && this.state.grid[i].state !== 'bomb') {
          this.paintTile(this.tileObjects[i].bg, 0, 0, w, h, 'bomb');
          this.tileObjects[i].icon.setText('💣');
        }
      }
      this.cashOutBtn?.disableInteractive();
      this.statusText?.setText('BOOM! GAME OVER').setColor('#ff4444');
      this.scene.time.delayedCall(600, () => this.showPlayAgain());
    }
  }

  private handleCashOut(): void {
    if (!this.state) return;
    const payout = cashOutMines(this.state);
    if (payout > 0) {
      this.cashOutBtn?.disableInteractive();
      this.statusText?.setText(`PAID OUT\n${payout.toFixed(2)} credits`).setColor(GOLD_STR);
      this.scene.time.delayedCall(600, () => this.showPlayAgain());
    }
  }

  private showPlayAgain(): void {
    const { width, height } = this.scene.scale;
    const btn = this.scene.add.rectangle(width / 2, height * 0.94, 180, 50, GOLD)
      .setInteractive({ useHandCursor: true }).setDepth(20);
    this.scene.add.text(width / 2, height * 0.94, 'PLAY AGAIN', {
      fontFamily: '"Fredoka One", sans-serif', fontSize: '14px', color: '#000000',
    }).setOrigin(0.5).setDepth(21);
    btn.on('pointerdown', () => { this.cleanup(); this.scene.scene.restart(); });
  }
}

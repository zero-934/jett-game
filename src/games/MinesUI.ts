import * as Phaser from 'phaser';
import type { MinesConfig, BombCount } from './MinesLogic';
import { createMinesState, revealTile, cashOutMines } from './MinesLogic';
import {
  COLOR_SURFACE,
  COLOR_BORDER,
  COLOR_GOLD,
  COLOR_DANGER,
  STR_GOLD,
  STR_DANGER,
  STR_TEXT,
  STR_MUTED,
  FONT_SIZE_SM,
  FONT_SIZE_BASE,
  FONT_SIZE_LG,
  FONT_SIZE_XL,
  FONT_SIZE_3XL,
  TEXT_STYLE_LABEL,
  TEXT_STYLE_BODY,
  TEXT_STYLE_SEMIBOLD,
  TEXT_STYLE_GOLD_SEMIBOLD,
  SAFE_TOP,
  drawButton
} from '../shared/ui/UITheme';

export class MinesUI {
  private scene:  Phaser.Scene;
  private config: MinesConfig;
  private state:  ReturnType<typeof createMinesState> | null = null;

  private tileObjects: { bg: Phaser.GameObjects.Graphics; icon: Phaser.GameObjects.Text }[] = [];
  private multiplierText: Phaser.GameObjects.Text | null = null;
  private statusText:     Phaser.GameObjects.Text | null = null;
  private cashOutBtnBg:   Phaser.GameObjects.Graphics | null = null;
  private cashOutLabel:   Phaser.GameObjects.Text | null = null;

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
    this.cashOutBtnBg?.destroy();
    this.cashOutLabel?.destroy();
    this.state = null;
  }

  private buildBombSelector(): void {
    const { width, height } = this.scene.scale;
    const cy = height / 2 - 30;

    const title = this.scene.add.text(width / 2, cy - 60, 'HOW MANY MINES?', {
      ...TEXT_STYLE_LABEL,
      fontSize: FONT_SIZE_LG,
      color: STR_MUTED,
      letterSpacing: 0.5,
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
        ...TEXT_STYLE_GOLD_SEMIBOLD,
        fontSize: FONT_SIZE_XL,
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
    const { bg: startBg, text: startLabel } = drawButton(this.scene, width / 2, startCy, 160, 52, 'START', 'primary', 2);
    startBg.setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.startGame());
    this.bombSelectorObjs.push(startBg, startLabel);
  }

  private paintSelectorBtn(g: Phaser.GameObjects.Graphics, cx: number, cy: number, w: number, h: number, selected: boolean): void {
    g.clear();
    if (selected) {
      g.fillStyle(COLOR_DANGER, 0.2); // Soft red background for selected bombs
      g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 8);
      g.lineStyle(1.5, COLOR_DANGER, 0.8); // Red border
      g.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 8);
    } else {
      g.fillStyle(COLOR_SURFACE, 1);
      g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 8);
      g.lineStyle(1, COLOR_BORDER, 0.8);
      g.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 8);
    }
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
    const { width } = this.scene.scale;
    this.scene.add.text(width / 2, SAFE_TOP + 12, 'Reveal tiles · Hit a bomb and lose everything', {
      ...TEXT_STYLE_LABEL,
      fontSize: FONT_SIZE_SM,
      align: 'center',
    }).setOrigin(0.5);
  }

  private buildGrid(): void {
    const { width, height } = this.scene.scale;
    const cols = 5, rows = 5;
    const tileW = 64, tileH = 64, gap = 6;
    const totalW = cols * tileW + (cols - 1) * gap;
    const totalH = rows * tileH + (rows - 1) * gap;
    const startX = (width - totalW) / 2;
    const startY = SAFE_TOP + 40 + (height - SAFE_TOP - 40 - totalH - 120) / 2; // centred in space between header and bottom HUD

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * 5 + c;
        const cx  = startX + c * (tileW + gap) + tileW / 2;
        const cy  = startY + r * (tileH + gap) + tileH / 2;

        const bg = this.scene.add.graphics();
        this.paintTile(bg, cx, cy, tileW, tileH, 'hidden');

        const icon = this.scene.add.text(cx, cy, '', {
          ...TEXT_STYLE_SEMIBOLD,
          fontSize: FONT_SIZE_XL,
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
    let fillColor: number;
    let borderColor: number;
    let borderAlpha: number;

    if (state === 'safe') {
      fillColor = 0x142e14; // Darker green for safe
      borderColor = 0x22c55e; // UITheme green
      borderAlpha = 0.8;
    } else if (state === 'bomb') {
      fillColor = 0x2e1414; // Darker red for bomb
      borderColor = 0xef4444; // UITheme red
      borderAlpha = 0.8;
    } else { // hidden
      fillColor = COLOR_SURFACE;
      borderColor = COLOR_BORDER;
      borderAlpha = 0.8;
    }

    g.fillStyle(fillColor, 1);
    g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 8);
    g.lineStyle(1.5, borderColor, borderAlpha);
    g.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 8);
  }

  private buildCashOut(): void {
    const { width, height } = this.scene.scale;

    // Multiplier shown prominently below the grid
    const gridBottom = (SAFE_TOP + 40 + (height - SAFE_TOP - 40 - (5 * 64 + 4 * 6) - 120) / 2) + (5 * 64 + 4 * 6);
    this.scene.add.text(width / 2, gridBottom + 18, 'MULTIPLIER', {
      ...TEXT_STYLE_LABEL,
      fontSize: FONT_SIZE_SM,
      letterSpacing: 0.5,
    }).setOrigin(0.5).setDepth(10);

    this.multiplierText = this.scene.add.text(width / 2, gridBottom + 48, 'x1.00', {
      ...TEXT_STYLE_GOLD_SEMIBOLD,
      fontSize: FONT_SIZE_3XL,
    }).setOrigin(0.5).setDepth(10);

    this.scene.add.text(16, SAFE_TOP + 12, `BET: ${this.BET}`, {
      ...TEXT_STYLE_BODY,
      fontSize: FONT_SIZE_BASE,
      color: STR_GOLD,
    }).setDepth(10);

    this.statusText = this.scene.add.text(width / 2, height - 80, '', {
      ...TEXT_STYLE_SEMIBOLD,
      fontSize: FONT_SIZE_XL,
      color: STR_TEXT,
      align: 'center',
    }).setOrigin(0.5).setDepth(10);

    const { bg, text } = drawButton(this.scene, width - 70, SAFE_TOP + 28, 124, 44, 'CASH OUT', 'primary', 10);
    this.cashOutBtnBg = bg;
    this.cashOutLabel = text;
    this.cashOutBtnBg
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.handleCashOut());
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
          // Temporarily set to current tile's position for painting, then reset
          const originalTile = this.tileObjects[i].bg;
          const originalX = originalTile.x;
          const originalY = originalTile.y;
          originalTile.x = cx;
          originalTile.y = cy;
          this.paintTile(originalTile, cx, cy, w, h, 'bomb');
          originalTile.x = originalX;
          originalTile.y = originalY;
          this.tileObjects[i].icon.setText('💣');
        }
      }
      this.cashOutBtnBg?.disableInteractive();
      this.cashOutLabel?.setText('GAME OVER');
      this.cashOutBtnBg?.clear().fillStyle(COLOR_DANGER, 0.4).fillRoundedRect(this.cashOutBtnBg.x, this.cashOutBtnBg.y, 124, 44, 10); // Indicate disabled
      this.statusText?.setText('BOOM! GAME OVER').setColor(STR_DANGER);
      this.scene.time.delayedCall(600, () => this.showPlayAgain());
    }
  }

  private handleCashOut(): void {
    if (!this.state) return;
    const payout = cashOutMines(this.state);
    if (payout > 0) {
      this.cashOutBtnBg?.disableInteractive();
      this.cashOutLabel?.setText('CASHED OUT');
      this.cashOutBtnBg?.clear().fillStyle(COLOR_SURFACE, 0.8).lineStyle(1.5, COLOR_GOLD, 0.4).strokeRoundedRect(this.cashOutBtnBg.x, this.cashOutBtnBg.y, 124, 44, 10).fillRoundedRect(this.cashOutBtnBg.x, this.cashOutBtnBg.y, 124, 44, 10); // Secondary style for cashed out
      this.statusText?.setText(`PAID OUT\n${payout.toFixed(2)} credits`).setColor(STR_GOLD);
      this.scene.time.delayedCall(600, () => this.showPlayAgain());
    }
  }

  private showPlayAgain(): void {
    const { width, height } = this.scene.scale;
    const { bg: btn, text: label } = drawButton(this.scene, width / 2, height - 44, 180, 50, 'PLAY AGAIN', 'primary', 20);
    btn.on('pointerdown', () => { this.cleanup(); this.scene.scene.restart(); });
  }
}

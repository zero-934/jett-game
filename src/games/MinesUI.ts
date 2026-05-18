import * as Phaser from 'phaser';
import type { MinesConfig, BombCount } from './MinesLogic';
import { createMinesState, revealTile, cashOutMines } from './MinesLogic';
import {
  COLOR_SURFACE,
  COLOR_BORDER,
  FONT_SIZE_XL,
  TEXT_STYLE_SEMIBOLD,
  SAFE_TOP,
} from '../shared/ui/UITheme';

export class MinesUI {
  private scene:  Phaser.Scene;
  private config: MinesConfig;
  private state:  ReturnType<typeof createMinesState> | null = null;

  private tileObjects: { bg: Phaser.GameObjects.Graphics; icon: Phaser.GameObjects.Text }[] = [];
  private multiplierText: Phaser.GameObjects.DOMElement | null = null;
  private statusText:     Phaser.GameObjects.DOMElement | null = null;
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

    // Title at top
    const titleDOM = this.scene.add.dom(width / 2, SAFE_TOP + 14, 'div', 'class="mines-title"', 'MINES');
    titleDOM.setOrigin(0.5);
    this.bombSelectorObjs.push(titleDOM);

    // Initialize state so we can build grid
    this.state = createMinesState(this.BET, this.selectedBombs, this.config);
    this.buildGrid();

    // Grid is now showing! Now put selector BELOW it
    const gridBottom = (SAFE_TOP + 40 + (height - SAFE_TOP - 40 - (5 * 64 + 4 * 6) - 120) / 2) + (5 * 64 + 4 * 6);
    const selectorY = gridBottom + 80;

    // Show multiplier while selecting
    const gridBottom = (SAFE_TOP + 40 + (height - SAFE_TOP - 40 - (5 * 64 + 4 * 6) - 120) / 2) + (5 * 64 + 4 * 6);
    
    const multiplierLabelDOM = this.scene.add.dom(width / 2, gridBottom + 18, 'div', 'class="mines-multiplier-label"', 'MULTIPLIER');
    multiplierLabelDOM.setOrigin(0.5);
    this.bombSelectorObjs.push(multiplierLabelDOM);

    const multiplierValueDOM = this.scene.add.dom(width / 2, gridBottom + 48, 'div', 'class="mines-multiplier-value"', `x${this.state.multiplier.toFixed(2)}`);
    multiplierValueDOM.setOrigin(0.5);
    this.bombSelectorObjs.push(multiplierValueDOM);
    this.multiplierText = multiplierValueDOM as any;

    // Create HTML prompt
    const promptDOM = this.scene.add.dom(width / 2, selectorY - 40, 'div', 'class="mines-prompt"', 'HOW MANY MINES?');
    promptDOM.setOrigin(0.5);
    this.bombSelectorObjs.push(promptDOM);

    const options: BombCount[] = [3, 5, 10];
    const btnW = 80, gap = 14;
    const total = options.length * btnW + (options.length - 1) * gap;
    const startX = (width - total) / 2;

    // Create HTML mine selector buttons
    for (let i = 0; i < options.length; i++) {
      const count = options[i];
      const cx = startX + i * (btnW + gap) + btnW / 2;

      const buttonDOM = this.scene.add.dom(cx, selectorY, 'button', 'class="mines-button ' + (count === this.selectedBombs ? 'selected' : '') + '"', `${count} 💣`);
      buttonDOM.setOrigin(0.5);
      
      buttonDOM.node.addEventListener('click', () => {
        this.selectedBombs = count;
        // Update all button styles
        const buttons = document.querySelectorAll('.mines-button');
        buttons.forEach((btn, idx) => {
          if (options[idx] === count) {
            btn.classList.add('selected');
          } else {
            btn.classList.remove('selected');
          }
        });
      });

      this.bombSelectorObjs.push(buttonDOM);
    }

    // Create HTML START button
    const startButtonDOM = this.scene.add.dom(width / 2, selectorY + 60, 'button', 'class="mines-primary-button"', 'START');
    startButtonDOM.setOrigin(0.5);
    
    startButtonDOM.node.addEventListener('click', () => this.startGameAfterSelection());
    this.bombSelectorObjs.push(startButtonDOM);
  }

  private startGameAfterSelection(): void {
    // Remove selector UI only, keep grid
    for (const o of this.bombSelectorObjs) (o as Phaser.GameObjects.GameObject & { destroy(): void }).destroy();
    this.bombSelectorObjs = [];

    // State already created, just show game UI
    this.buildCashOut();
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

    // MINES title — HTML overlay
    const titleDOM = this.scene.add.dom(width / 2, SAFE_TOP + 14, 'div', 'class="mines-title"', 'MINES');
    titleDOM.setOrigin(0.5);

    // Multiplier section
    const gridBottom = (SAFE_TOP + 40 + (height - SAFE_TOP - 40 - (5 * 64 + 4 * 6) - 120) / 2) + (5 * 64 + 4 * 6);
    
    const multiplierLabelDOM = this.scene.add.dom(width / 2, gridBottom + 18, 'div', 'class="mines-multiplier-label"', 'MULTIPLIER');
    multiplierLabelDOM.setOrigin(0.5);

    const multiplierValueDOM = this.scene.add.dom(width / 2, gridBottom + 48, 'div', 'class="mines-multiplier-value"', 'x1.00');
    multiplierValueDOM.setOrigin(0.5);
    this.multiplierText = multiplierValueDOM as any; // Store for updates

    // BET label — HTML overlay
    const betLabelDOM = this.scene.add.dom(16, SAFE_TOP + 12, 'div', 'class="mines-label"', `BET: ${this.BET}`);
    betLabelDOM.setOrigin(0);

    // Status text — HTML overlay
    const statusDOM = this.scene.add.dom(width / 2, height - 80, 'div', 'class="mines-status"', '');
    statusDOM.setOrigin(0.5);
    this.statusText = statusDOM as any; // Store for updates

    // CASH OUT button — HTML overlay
    const cashOutButtonDOM = this.scene.add.dom(width - 70, SAFE_TOP + 28, 'button', 'class="mines-primary-button"', 'CASH OUT');
    cashOutButtonDOM.setOrigin(0.5);
    
    cashOutButtonDOM.node.addEventListener('click', () => this.handleCashOut());
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
      if (this.multiplierText?.node) {
        this.multiplierText.node.textContent = `x${this.state.multiplier.toFixed(2)}`;
      }
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
      // Update HTML elements for game over
      const cashOutBtn = document.querySelector('.mines-primary-button') as HTMLButtonElement;
      if (cashOutBtn) {
        cashOutBtn.disabled = true;
        cashOutBtn.textContent = 'GAME OVER';
        cashOutBtn.style.opacity = '0.5';
      }
      if (this.statusText?.node) {
        this.statusText.node.textContent = 'BOOM! GAME OVER';
        (this.statusText.node as HTMLElement).style.color = '#ff4444';
      }
      this.scene.time.delayedCall(600, () => this.showPlayAgain());
    }
  }

  private handleCashOut(): void {
    if (!this.state) return;
    const payout = cashOutMines(this.state);
    if (payout > 0) {
      const cashOutBtn = document.querySelector('.mines-primary-button') as HTMLButtonElement;
      if (cashOutBtn) {
        cashOutBtn.disabled = true;
        cashOutBtn.textContent = 'CASHED OUT';
        cashOutBtn.style.opacity = '0.6';
      }
      if (this.statusText?.node) {
        this.statusText.node.innerHTML = `PAID OUT<br>${payout.toFixed(2)} credits`;
        (this.statusText.node as HTMLElement).style.color = '#c9a84c';
      }
      this.scene.time.delayedCall(600, () => this.showPlayAgain());
    }
  }

  private showPlayAgain(): void {
    const { width, height } = this.scene.scale;
    const playAgainBtn = this.scene.add.dom(width / 2, height - 44, 'button', 'class="mines-primary-button"', 'PLAY AGAIN');
    playAgainBtn.setOrigin(0.5);
    playAgainBtn.node.addEventListener('click', () => { this.cleanup(); this.scene.scene.restart(); });
  }
}

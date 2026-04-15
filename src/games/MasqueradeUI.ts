/**
 * @file MasqueradeUI.ts
 * @purpose Phaser rendering for Midnight Masquerade slot — symbol grid, spin button,
 *          HUD, masked-symbol animation, and win highlights.
 * @author Agent 934
 * @date 2026-04-15
 * @license Proprietary – available for licensing
 */

import * as Phaser from 'phaser';
import type { MasqueradeSymbol, MasqueradeState, WinLine } from './MasqueradeLogic';
import { REELS_COUNT, ROWS_COUNT, GOLD, GOLD_STR, DARK, DARK_STR, BET_PER_LINE, LINES_COUNT } from './MasqueradeLogic';
import { createMasqueradeState, spinMasquerade } from './MasqueradeLogic';

// ─── UI Constants ─────────────────────────────────────────────────────────────
const SYMBOL_SIZE    = 90;
const REEL_GAP       = 8;
const FONT_PRIMARY   = '"Georgia", serif';
const FONT_UI        = '"Fredoka One", sans-serif';

// Symbol fill colors
const SYMBOL_COLORS: Record<MasqueradeSymbol, number> = {
  GOLDEN_MASK: GOLD,
  CHAMPAGNE:   0xadd8e6,
  PEACOCK:     0x008080,
  GLOVES:      0x6a0dad,
  CLOCK:       0xb0b0b0,
  SLIPPER:     0xff91a4,
  INVITATION:  0xffd700,
  MUSIC:       0x87ceeb,
  WILD:        DARK,
  SCATTER:     GOLD,
  MASKED:      0x4b0082,
};

const SYMBOL_LABELS: Record<MasqueradeSymbol, string> = {
  GOLDEN_MASK: 'MASK',
  CHAMPAGNE:   'CHAMP',
  PEACOCK:     'PCCK',
  GLOVES:      'GLVS',
  CLOCK:       'CLK',
  SLIPPER:     'SLPR',
  INVITATION:  'INVT',
  MUSIC:       'MUSC',
  WILD:        'WILD',
  SCATTER:     'SCAT',
  MASKED:      '?',
};

// ─── MasqueradeUI Class ───────────────────────────────────────────────────────

export class MasqueradeUI {
  private scene:        Phaser.Scene;
  private config:       Parameters<typeof spinMasquerade>[1];
  private state:        MasqueradeState | null = null;

  // Grid of containers — [reel][row]
  private symbolGrid:   Phaser.GameObjects.Container[][] = [];

  private spinButton:   Phaser.GameObjects.Container | null = null;
  private spinLabel:    Phaser.GameObjects.Text       | null = null;
  private winText:      Phaser.GameObjects.Text       | null = null;
  private betText:      Phaser.GameObjects.Text       | null = null;
  private freeSpinText: Phaser.GameObjects.Text       | null = null;
  private homeButton:   Phaser.GameObjects.Text       | null = null;
  private messageText:  Phaser.GameObjects.Text       | null = null;

  constructor(scene: Phaser.Scene, config: Parameters<typeof spinMasquerade>[1] = {}) {
    this.scene  = scene;
    this.config = config;
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  public start(): void {
    this.cleanup();
    this.state = createMasqueradeState(BET_PER_LINE * LINES_COUNT, LINES_COUNT);
    this.buildGrid();
    this.buildSpinButton();
    this.buildHUD();
    this.renderReels(this.state.reelStops, []);
  }

  public cleanup(): void {
    this.symbolGrid.forEach(col => col.forEach(c => c.destroy()));
    this.symbolGrid = [];
    this.spinButton?.destroy();
    this.winText?.destroy();
    this.betText?.destroy();
    this.freeSpinText?.destroy();
    this.homeButton?.destroy();
    this.messageText?.destroy();
    this.spinButton   = null;
    this.spinLabel    = null;
    this.winText      = null;
    this.betText      = null;
    this.freeSpinText = null;
    this.homeButton   = null;
    this.messageText  = null;
    this.state        = null;
  }

  // ─── Build UI ───────────────────────────────────────────────────────────────

  private buildGrid(): void {
    const { width, height } = this.scene.scale;
    const totalW = REELS_COUNT * SYMBOL_SIZE + (REELS_COUNT - 1) * REEL_GAP;
    const totalH = ROWS_COUNT  * SYMBOL_SIZE + (ROWS_COUNT  - 1) * REEL_GAP;
    const startX = (width  - totalW) / 2;
    const startY = (height - totalH) / 2 - 20;

    for (let r = 0; r < REELS_COUNT; r++) {
      this.symbolGrid[r] = [];
      for (let row = 0; row < ROWS_COUNT; row++) {
        const x = startX + r   * (SYMBOL_SIZE + REEL_GAP);
        const y = startY + row * (SYMBOL_SIZE + REEL_GAP);
        const container = this.scene.add.container(x, y);
        container.setSize(SYMBOL_SIZE, SYMBOL_SIZE);
        this.symbolGrid[r][row] = container;
      }
    }
  }

  private buildSpinButton(): void {
    const { width, height } = this.scene.scale;
    const cx = width / 2;
    const cy = height * 0.88;

    const bg = this.scene.add.graphics();
    bg.fillStyle(GOLD, 1);
    bg.fillRoundedRect(-90, -28, 180, 56, 14);

    const label = this.scene.add.text(0, 0, 'SPIN', {
      fontFamily: FONT_UI, fontSize: '32px', color: DARK_STR,
    }).setOrigin(0.5);

    this.spinButton = this.scene.add.container(cx, cy, [bg, label])
      .setSize(180, 56)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.handleSpin())
      .on('pointerover',  () => { bg.clear(); bg.fillStyle(0xddb83a, 1); bg.fillRoundedRect(-90, -28, 180, 56, 14); })
      .on('pointerout',   () => { bg.clear(); bg.fillStyle(GOLD,    1); bg.fillRoundedRect(-90, -28, 180, 56, 14); });

    this.spinLabel = label;
  }

  private buildHUD(): void {
    const { width, height } = this.scene.scale;

    this.betText = this.scene.add.text(20, height * 0.82, `BET: ${BET_PER_LINE * LINES_COUNT}`, {
      fontFamily: FONT_UI, fontSize: '18px', color: GOLD_STR,
    });

    this.winText = this.scene.add.text(width - 20, height * 0.82, 'WIN: 0', {
      fontFamily: FONT_UI, fontSize: '18px', color: GOLD_STR,
    }).setOrigin(1, 0);

    this.freeSpinText = this.scene.add.text(width / 2, height * 0.82, '', {
      fontFamily: FONT_UI, fontSize: '20px', color: '#cc44ff',
    }).setOrigin(0.5, 0);

    this.messageText = this.scene.add.text(width / 2, height * 0.14, '', {
      fontFamily: FONT_UI, fontSize: '22px', color: '#cc44ff',
    }).setOrigin(0.5);

    this.homeButton = this.scene.add.text(width / 2, height - 18, '‹ HOME', {
      fontFamily: FONT_UI, fontSize: '14px', color: '#555566',
    }).setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => { this.cleanup(); this.scene.scene.start('HomeScene'); });
  }

  // ─── Render Symbols ──────────────────────────────────────────────────────────

  private drawSymbol(container: Phaser.GameObjects.Container, symbol: MasqueradeSymbol): void {
    container.removeAll(true);

    const g    = this.scene.add.graphics();
    const s    = SYMBOL_SIZE;
    const half = s / 2;
    const col  = SYMBOL_COLORS[symbol];

    if (symbol === 'MASKED') {
      // Dark purple circle
      g.fillStyle(col, 1);
      g.fillCircle(half, half, half - 4);
      g.lineStyle(2, GOLD, 0.7);
      g.strokeCircle(half, half, half - 4);
    } else if (symbol === 'WILD') {
      // Near-black rectangle with gold outline (mysterious stranger silhouette)
      g.fillStyle(col, 1);
      g.fillRoundedRect(4, 4, s - 8, s - 8, 6);
      g.lineStyle(2, GOLD, 1);
      g.strokeRoundedRect(4, 4, s - 8, s - 8, 6);
    } else if (symbol === 'SCATTER') {
      // Gold chandelier: hexagon + radiating lines
      g.fillStyle(col, 1);
      g.lineStyle(2, DARK, 1);
      g.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        const px = half + (half - 10) * Math.cos(angle);
        const py = half + (half - 10) * Math.sin(angle);
        i === 0 ? g.moveTo(px, py) : g.lineTo(px, py);
      }
      g.closePath();
      g.fillPath();
      g.strokePath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        g.lineBetween(half, half, half + (half - 18) * Math.cos(angle), half + (half - 18) * Math.sin(angle));
      }
    } else {
      // Standard rounded rect per symbol
      g.fillStyle(col, 1);
      g.fillRoundedRect(4, 4, s - 8, s - 8, 8);
      g.lineStyle(1, 0x000000, 0.3);
      g.strokeRoundedRect(4, 4, s - 8, s - 8, 8);
    }

    const labelColor = (symbol === 'WILD' || symbol === 'MASKED') ? GOLD_STR : DARK_STR;
    const labelSize  = symbol === 'MASKED' ? '38px' : '20px';

    const label = this.scene.add.text(half, half, SYMBOL_LABELS[symbol], {
      fontFamily: FONT_PRIMARY,
      fontSize:   labelSize,
      color:      labelColor,
      fontStyle:  'bold',
    }).setOrigin(0.5);

    container.add([g, label]);
  }

  // ─── Public Render ───────────────────────────────────────────────────────────

  /**
   * Renders the full reel grid.
   * @param stops           - The symbol grid to display.
   * @param maskedPositions - Positions that should render as MASKED.
   */
  public renderReels(stops: MasqueradeSymbol[][], maskedPositions: { reel: number; row: number }[]): void {
    const maskedSet = new Set(maskedPositions.map(p => `${p.reel},${p.row}`));
    for (let r = 0; r < REELS_COUNT; r++) {
      for (let row = 0; row < ROWS_COUNT; row++) {
        const sym = maskedSet.has(`${r},${row}`) ? 'MASKED' : stops[r][row];
        this.drawSymbol(this.symbolGrid[r][row], sym);
      }
    }
    if (this.winText) this.winText.setText(`WIN: ${this.state?.totalWin.toFixed(2) ?? '0.00'}`);
  }

  /**
   * Flash-then-reveal animation for unmasking during free spins.
   * @param revealed   - Array of positions and their revealed symbols.
   * @param onComplete - Callback when all animations finish.
   */
  public animateUnmask(
    revealed: { reel: number; row: number; symbol: MasqueradeSymbol }[],
    onComplete: () => void
  ): void {
    if (revealed.length === 0) { onComplete(); return; }
    let remaining = revealed.length;
    revealed.forEach(({ reel, row, symbol }) => {
      const container = this.symbolGrid[reel][row];
      this.scene.tweens.add({
        targets:  container,
        alpha:    0.3,
        duration: 120,
        yoyo:     true,
        repeat:   2,
        onComplete: () => {
          container.setAlpha(1);
          this.drawSymbol(container, symbol);
          if (--remaining === 0) onComplete();
        },
      });
    });
  }

  /**
   * Pulses winning symbol positions.
   * @param winLines - Winning lines from the game state.
   */
  public animateWin(winLines: WinLine[]): void {
    winLines.forEach(line => {
      line.positions.forEach(({ reel, row }) => {
        this.scene.tweens.add({
          targets:  this.symbolGrid[reel][row],
          scaleX:   1.12,
          scaleY:   1.12,
          duration: 180,
          yoyo:     true,
          repeat:   2,
          ease:     'Sine.easeInOut',
        });
      });
    });
  }

  // ─── Spin Handler ────────────────────────────────────────────────────────────

  private handleSpin(): void {
    if (!this.state || !this.state.isComplete) return;

    this.state.isComplete = false;
    this.spinButton?.disableInteractive();
    this.spinLabel?.setText('...');
    this.winText?.setText('WIN: —');
    this.messageText?.setText('');

    this.state = spinMasquerade(this.state, this.config);
    const snap = this.state;

    // Simulate reel spin delay then show results
    this.scene.time.delayedCall(1200, () => {
      this.renderReels(snap.reelStops, snap.maskedPositions);
      this.winText?.setText(`WIN: ${snap.totalWin.toFixed(2)}`);

      if (snap.freeSpinsRemaining > 0) {
        this.freeSpinText?.setText(`FREE SPINS: ${snap.freeSpinsRemaining}`);
      } else {
        this.freeSpinText?.setText('');
      }

      if (snap.isFreeSpinTriggered) {
        this.messageText?.setText('🎭 FREE SPINS!');
      } else if (snap.isFreeSpinRetriggered) {
        this.messageText?.setText('🎭 RETRIGGER!');
      }

      const afterReels = () => {
        if (snap.winLines.length > 0) {
          this.animateWin(snap.winLines);
        }
        // Re-enable after win animation
        this.scene.time.delayedCall(800, () => {
          if (this.state) this.state.isComplete = true;
          this.spinButton?.setInteractive({ useHandCursor: true });
          this.spinLabel?.setText(snap.freeSpinsRemaining > 0 ? 'FREE' : 'SPIN');
        });
      };

      if (snap.revealedSymbols.length > 0) {
        this.animateUnmask(snap.revealedSymbols, afterReels);
      } else {
        afterReels();
      }
    });
  }
}

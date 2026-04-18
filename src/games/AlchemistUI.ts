/**
 * @file AlchemistUI.ts
 * @purpose Phaser rendering for The Alchemist slot — symbol grid, spinning reel animation,
 *          jackpot plaques, transmutation reveal, big win flash overlay, and HUD.
 * @author Agent 934
 * @date 2026-04-15
 * @license Proprietary – available for licensing
 */

import * as Phaser from 'phaser';
import type { AlchemistSymbol, WinLine, JackpotResult } from './AlchemistLogic';
import {
  REELS_COUNT, ROWS_COUNT,
  GOLD, GOLD_STR, DARK, DARK_STR, COPPER, AMBER,
  BET_PER_LINE, LINES_COUNT,
  JACKPOT_MULTIPLIERS,
  createAlchemistState, spinAlchemist,
} from './AlchemistLogic';
import type { AlchemistState } from './AlchemistLogic';

// ─── Layout constants ─────────────────────────────────────────────────────────
const SYM        = 66;
const REEL_GAP   = 4;
const GRID_TOP   = 290;
const SPIN_ROWS  = 8;
const REEL_DELAY = 120;

// ─── Visual constants ─────────────────────────────────────────────────────────
const FONT_UI = 'Arial, sans-serif';

const SYMBOL_COLORS: Record<AlchemistSymbol, number> = {
  PHILOSOPHERS_STONE: GOLD,
  ELIXIR:      AMBER,
  GRIMOIRE:    0x4a0080,
  CAULDRON:    COPPER,
  HOURGLASS:   0x708090,
  VIAL:        0x2e8b57,
  MORTAR:      0x5c4033,
  RUNE:        0x2a2a3a,
  WILD:        DARK,
  SCATTER:     GOLD,
  TRANSMUTING: 0xff6600,
};

const SYMBOL_LABEL: Record<AlchemistSymbol, string> = {
  PHILOSOPHERS_STONE: 'STONE',
  ELIXIR:      'ELIXIR',
  GRIMOIRE:    'GRIM',
  CAULDRON:    'CALD',
  HOURGLASS:   'HOUR',
  VIAL:        'VIAL',
  MORTAR:      'MRTR',
  RUNE:        'RUNE',
  WILD:        'WILD',
  SCATTER:     '✦',
  TRANSMUTING: '~',
};

// ─── AlchemistUI ──────────────────────────────────────────────────────────────

export class AlchemistUI {
  private scene:  Phaser.Scene;
  private config: Parameters<typeof spinAlchemist>[1];
  private state:  AlchemistState | null = null;
  private spinning = false;

  private philosopherPlaque: Phaser.GameObjects.Graphics | null = null;
  private reelCols: Phaser.GameObjects.Container[][] = [];

  private spinBtn:      Phaser.GameObjects.Container | null = null;
  private spinBtnLabel: Phaser.GameObjects.Text      | null = null;
  private winDisplay:   Phaser.GameObjects.Text      | null = null;
  private betDisplay:   Phaser.GameObjects.Text      | null = null;
  private balance:      number = 10000;
  private currentBet:   number = 25;
  private balanceText:  Phaser.GameObjects.Text | null = null;
  private betBtns:      Phaser.GameObjects.Text[] = [];
  private fsDisplay:    Phaser.GameObjects.Text      | null = null;
  private flashOverlay: Phaser.GameObjects.Container | null = null;

  constructor(scene: Phaser.Scene, config: Parameters<typeof spinAlchemist>[1] = {}) {
    this.scene  = scene;
    this.config = config;
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  public start(): void {
    this.cleanup();
    this.state = createAlchemistState(BET_PER_LINE * LINES_COUNT, LINES_COUNT);
    this.buildJackpotPanel();
    this.buildReelFrame();
    this.buildReels();
    this.buildHUD();
    this.buildFlashOverlay();
    this.snapReels(this.state.reelStops, []);
  }

  public cleanup(): void {
    this.philosopherPlaque = null;
    this.reelCols.forEach(col => col.forEach(c => c.destroy()));
    this.reelCols  = [];
    this.spinBtn?.destroy();
    this.winDisplay?.destroy();
    this.betDisplay?.destroy();
    this.fsDisplay?.destroy();
    this.flashOverlay?.destroy();
    this.spinBtn      = null;
    this.spinBtnLabel = null;
    this.winDisplay   = null;
    this.betDisplay   = null;
    this.balanceText?.destroy();
    this.balanceText  = null;
    this.betBtns.forEach(b => b.destroy());
    this.betBtns      = [];
    this.fsDisplay    = null;
    this.flashOverlay = null;
    this.state        = null;
    this.spinning     = false;
  }

  // ─── Build ───────────────────────────────────────────────────────────────────

  private get gridW(): number { return REELS_COUNT * SYM + (REELS_COUNT - 1) * REEL_GAP; }
  private get gridH(): number { return ROWS_COUNT  * SYM + (ROWS_COUNT  - 1) * REEL_GAP; }
  private get gridX(): number { return ((this.scene.game.config.width as number || 390) - this.gridW) / 2; }

  /** Three jackpot plaques above the reel grid (y 64–120). */
  private buildJackpotPanel(): void {
    const { width } = this.scene.scale;
    const panelY    = 64;
    const panelH    = 48;
    const phantomH  = panelH + 10;
    const corner    = 6;
    const border    = 1.5;
    const gap       = 6;
    const sideW     = (width - gap * 4) * 0.28;
    const centreW   = (width - gap * 4) * 0.40;

    const minorX      = gap;
    const philoX      = minorX + sideW + gap;
    const grandX      = philoX + centreW + gap;

    // MINOR (left)
    const minor = this.scene.add.graphics();
    minor.fillStyle(0x2a1a0a, 1);
    minor.lineStyle(border, COPPER, 0.7);
    minor.fillRoundedRect(minorX, panelY, sideW, panelH, corner);
    minor.strokeRoundedRect(minorX, panelY, sideW, panelH, corner);
    this.scene.add.text(minorX + sideW / 2, panelY + 13, 'MINOR', {
      fontFamily: FONT_UI, fontSize: '11px', color: '#8877aa',
    }).setOrigin(0.5, 0.5);
    this.scene.add.text(minorX + sideW / 2, panelY + 33, `${JACKPOT_MULTIPLIERS.MINOR}×`, {
      fontFamily: FONT_UI, fontSize: '15px', color: GOLD_STR, fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);

    // PHILOSOPHER (centre, tallest)
    const philo = this.scene.add.graphics();
    philo.fillStyle(0x0a0a1a, 1);
    philo.lineStyle(border + 0.5, GOLD, 1);
    philo.fillRoundedRect(philoX, panelY - 5, centreW, phantomH, corner + 2);
    philo.strokeRoundedRect(philoX, panelY - 5, centreW, phantomH, corner + 2);
    this.philosopherPlaque = philo;
    this.scene.add.text(philoX + centreW / 2, panelY + 8, 'PHILOSOPHER', {
      fontFamily: FONT_UI, fontSize: '12px', color: '#aaaacc',
    }).setOrigin(0.5, 0.5);
    this.scene.add.text(philoX + centreW / 2, panelY + 33, `${JACKPOT_MULTIPLIERS.PHILOSOPHER}×`, {
      fontFamily: FONT_UI, fontSize: '20px', color: GOLD_STR, fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);

    // GRAND (right)
    const grand = this.scene.add.graphics();
    grand.fillStyle(0x1a0a2a, 1);
    grand.lineStyle(border, COPPER, 0.7);
    grand.fillRoundedRect(grandX, panelY, sideW, panelH, corner);
    grand.strokeRoundedRect(grandX, panelY, sideW, panelH, corner);
    this.scene.add.text(grandX + sideW / 2, panelY + 13, 'GRAND', {
      fontFamily: FONT_UI, fontSize: '11px', color: '#8877aa',
    }).setOrigin(0.5, 0.5);
    this.scene.add.text(grandX + sideW / 2, panelY + 33, `${JACKPOT_MULTIPLIERS.GRAND}×`, {
      fontFamily: FONT_UI, fontSize: '15px', color: GOLD_STR, fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);

    // Pulse philosopher plaque
    this.scene.tweens.add({
      targets:  this.philosopherPlaque,
      alpha:    0.80,
      duration: 1800,
      yoyo:     true,
      repeat:   -1,
      ease:     'Sine.easeInOut',
    });
  }

  /** Decorative copper frame around the reel grid. */
  private buildReelFrame(): void {
    const { width } = this.scene.scale;
    const gx = this.gridX - 8;
    const gy = GRID_TOP   - 8;
    const gw = this.gridW  + 16;
    const gh = this.gridH  + 16;

    const frame = this.scene.add.graphics();
    frame.fillStyle(0x0d0a05, 1);
    frame.lineStyle(2, COPPER, 0.8);
    frame.fillRoundedRect(gx, gy, gw, gh, 10);
    frame.strokeRoundedRect(gx, gy, gw, gh, 10);

    // Side bars to clip off-screen container overflow
    const leftBar  = this.scene.add.graphics();
    const rightBar = this.scene.add.graphics();
    leftBar.fillStyle(0x08060a, 1);
    leftBar.fillRect(0, GRID_TOP - 2, gx, this.gridH + 4);
    rightBar.fillStyle(0x08060a, 1);
    rightBar.fillRect(gx + gw, GRID_TOP - 2, width - (gx + gw), this.gridH + 4);
  }

  /** Creates SPIN_ROWS + ROWS_COUNT containers per reel, all hidden initially. */
  private buildReels(): void {
    const totalRows = SPIN_ROWS + ROWS_COUNT;
    for (let r = 0; r < REELS_COUNT; r++) {
      this.reelCols[r] = [];
      const reelX = this.gridX + r * (SYM + REEL_GAP);
      for (let i = 0; i < totalRows; i++) {
        const container = this.scene.add.container(reelX, -9999);
        container.setSize(SYM, SYM);
        container.setAlpha(0);
        this.reelCols[r].push(container);
      }
    }
  }

  private buildHUD(): void {
    const { width } = this.scene.scale;
    const hudY = GRID_TOP + this.gridH + 16;

    // Balance display
    this.balanceText = this.scene.add.text(width - 16, hudY - 30, `BAL  ${this.balance.toLocaleString()}`, {
      fontFamily: FONT_UI, fontSize: '13px', color: GOLD_STR,
    }).setOrigin(1, 0.5);

    // Bet selector
    const BET_OPTIONS_A = [1, 10, 50, 250, 1000];
    const betSpacingA = Math.floor((width - 32) / BET_OPTIONS_A.length);
    BET_OPTIONS_A.forEach((bet: number, i: number) => {
      const bx = 16 + betSpacingA * i + betSpacingA / 2;
      const btn = this.scene.add.text(bx, hudY + 30, `$${bet.toLocaleString()}`, {
        fontFamily: FONT_UI, fontSize: '13px',
        color: this.currentBet === bet ? DARK_STR : GOLD_STR,
        backgroundColor: this.currentBet === bet ? GOLD_STR : '#333333',
        padding: { x: 8, y: 4 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      btn.on('pointerdown', () => {
        this.currentBet = bet;
        this.betBtns.forEach((b, j) => {
          b.setStyle({ backgroundColor: j === i ? GOLD_STR : '#333333', color: j === i ? DARK_STR : GOLD_STR });
        });
        this.betDisplay?.setText(`BET  ${bet.toLocaleString()}`);
      });
      this.betBtns.push(btn);
    });

    this.betDisplay = this.scene.add.text(16, hudY, `BET  ${this.currentBet.toLocaleString()}`, {
      fontFamily: FONT_UI, fontSize: '14px', color: COPPER_STR,
    });

    this.winDisplay = this.scene.add.text(width - 16, hudY, 'WIN  —', {
      fontFamily: FONT_UI, fontSize: '14px', color: COPPER_STR,
    }).setOrigin(1, 0);

    this.fsDisplay = this.scene.add.text(width / 2, hudY, '', {
      fontFamily: FONT_UI, fontSize: '14px', color: '#ff8800',
    }).setOrigin(0.5, 0);

    const btnY = hudY + 110;
    const bg   = this.scene.add.graphics();
    this.drawBtnBg(bg, false);
    const label = this.scene.add.text(0, 0, 'SPIN', {
      fontFamily: FONT_UI, fontSize: '28px', color: DARK_STR, fontStyle: 'bold',
    }).setOrigin(0.5);

    this.spinBtn = this.scene.add.container(width / 2, btnY, [bg, label])
      .setSize(160, 50).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.handleSpin())
      .on('pointerover',  () => this.drawBtnBg(bg, true))
      .on('pointerout',   () => this.drawBtnBg(bg, false));

    this.spinBtnLabel = label;
  }

  private drawBtnBg(g: Phaser.GameObjects.Graphics, hover: boolean): void {
    g.clear();
    g.fillStyle(hover ? 0xcc8822 : COPPER, 1);
    g.fillRoundedRect(-80, -25, 160, 50, 12);
  }

  private buildFlashOverlay(): void {
    const { width, height } = this.scene.scale;

    const dim = this.scene.add.graphics();
    dim.fillStyle(0x000000, 0.7);
    dim.fillRect(0, 0, width, height);

    const msg = this.scene.add.text(width / 2, height / 2, '', {
      fontFamily: '"Georgia", serif',
      fontSize:   '52px',
      color:      GOLD_STR,
      stroke:     '#000000',
      strokeThickness: 8,
      align: 'center',
    }).setOrigin(0.5);

    const sub = this.scene.add.text(width / 2, height / 2 + 68, '', {
      fontFamily: FONT_UI,
      fontSize:   '24px',
      color:      '#ffffff',
      align:      'center',
    }).setOrigin(0.5);

    this.flashOverlay = this.scene.add.container(0, 0, [dim, msg, sub]);
    this.flashOverlay.setVisible(false);
    this.flashOverlay.setDepth(100);
    (this.flashOverlay as unknown as Record<string, unknown>)['_msg'] = msg;
    (this.flashOverlay as unknown as Record<string, unknown>)['_sub'] = sub;
  }

  // ─── Symbol Drawing ───────────────────────────────────────────────────────────

  /** Grey placeholder during spin scroll — no colour, no text. */
  private drawBlurSym(container: Phaser.GameObjects.Container): void {
    container.removeAll(true);
    const g = this.scene.add.graphics();
    g.fillStyle(0x1a1a10, 0.75);
    g.fillRoundedRect(3, 3, SYM - 6, SYM - 6, 7);
    container.add(g);
  }

  private drawSym(container: Phaser.GameObjects.Container, symbol: AlchemistSymbol): void {
    container.removeAll(true);
    const g    = this.scene.add.graphics();
    const half = SYM / 2;
    const col  = SYMBOL_COLORS[symbol];

    if (symbol === 'TRANSMUTING') {
      // Glowing orange circle
      g.fillStyle(0xff6600, 0.25);
      g.fillCircle(half, half, half - 1);
      g.fillStyle(col, 1);
      g.fillCircle(half, half, half - 6);
      g.lineStyle(2, GOLD, 0.8);
      g.strokeCircle(half, half, half - 6);
    } else if (symbol === 'WILD') {
      g.fillStyle(col, 1);
      g.fillRoundedRect(3, 3, SYM - 6, SYM - 6, 6);
      g.lineStyle(2, COPPER, 1);
      g.strokeRoundedRect(3, 3, SYM - 6, SYM - 6, 6);
    } else if (symbol === 'SCATTER') {
      // Alchemical circle — hexagon with radiating lines
      g.fillStyle(col, 1);
      g.lineStyle(2, DARK, 1);
      g.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const px = half + (half - 8) * Math.cos(a);
        const py = half + (half - 8) * Math.sin(a);
        i === 0 ? g.moveTo(px, py) : g.lineTo(px, py);
      }
      g.closePath(); g.fillPath(); g.strokePath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i;
        g.lineBetween(half, half,
          half + (half - 16) * Math.cos(a),
          half + (half - 16) * Math.sin(a));
      }
    } else {
      g.fillStyle(col, 1);
      g.fillRoundedRect(3, 3, SYM - 6, SYM - 6, 7);
      g.lineStyle(1, 0x000000, 0.2);
      g.strokeRoundedRect(3, 3, SYM - 6, SYM - 6, 7);
    }

    const isLight = symbol !== 'WILD' && symbol !== 'TRANSMUTING' && symbol !== 'RUNE';
    const lbl = this.scene.add.text(half, half, SYMBOL_LABEL[symbol], {
      fontFamily: FONT_UI,
      fontSize:   symbol === 'TRANSMUTING' ? '28px' : '13px',
      color:      isLight ? '#111111' : GOLD_STR,
      fontStyle:  'bold',
      align:      'center',
    }).setOrigin(0.5);

    container.add([g, lbl]);
  }

  // ─── Reel Snap ───────────────────────────────────────────────────────────────

  private snapReels(stops: AlchemistSymbol[][], transmuting: { reel: number; row: number }[]): void {
    const transmutingSet = new Set(transmuting.map(p => `${p.reel},${p.row}`));
    const totalRows = SPIN_ROWS + ROWS_COUNT;

    for (let r = 0; r < REELS_COUNT; r++) {
      for (let i = 0; i < totalRows; i++) {
        const visRow  = i - SPIN_ROWS;
        const container = this.reelCols[r][i];

        if (visRow >= 0 && visRow < ROWS_COUNT) {
          container.setPosition(this.gridX + r * (SYM + REEL_GAP), GRID_TOP + visRow * (SYM + REEL_GAP));
          container.setAlpha(1);
          const sym = transmutingSet.has(`${r},${visRow}`) ? 'TRANSMUTING' : stops[r][visRow];
          this.drawSym(container, sym);
        } else {
          container.setPosition(this.gridX + r * (SYM + REEL_GAP), -9999);
          container.setAlpha(0);
        }
      }
    }
  }

  // ─── Reel Spin Animation ──────────────────────────────────────────────────────

  private spinReel(
    reelIndex: number,
    finalSymbols: AlchemistSymbol[],
    transmuting: { reel: number; row: number }[],
    spinDuration: number
  ): Promise<void> {
    return new Promise(resolve => {
      const col       = this.reelCols[reelIndex];
      const totalRows = col.length;
      const transmutingSet = new Set(transmuting.map(p => `${p.reel},${p.row}`));

      // Stack all containers above viewport with blur symbols
      col.forEach((c, i) => {
        this.drawBlurSym(c);
        c.setPosition(
          this.gridX + reelIndex * (SYM + REEL_GAP),
          GRID_TOP - (totalRows - i) * (SYM + REEL_GAP)
        );
        c.setAlpha(1);
      });

      const totalDist = totalRows * (SYM + REEL_GAP);
      this.scene.tweens.add({
        targets:    col,
        y:          `+=${totalDist}`,
        duration:   spinDuration,
        ease:       'Cubic.easeOut',
        onUpdate:   () => {
          // Fade containers outside the visible grid area (matches MasqueradeUI exactly)
          col.forEach(c => {
            const relY   = c.y - GRID_TOP;
            const inGrid = relY >= -SYM && relY <= this.gridH;
            c.setAlpha(inGrid ? 1 : Math.max(0, 1 - Math.abs(relY - this.gridH / 2) / (this.gridH * 0.8)));
          });
        },
        onComplete: () => {
          // Snap visible rows
          for (let row = 0; row < ROWS_COUNT; row++) {
            const container = col[totalRows - ROWS_COUNT + row];
            const sym = transmutingSet.has(`${reelIndex},${row}`) ? 'TRANSMUTING' : finalSymbols[row];
            this.drawSym(container, sym);
            container.setPosition(
              this.gridX + reelIndex * (SYM + REEL_GAP),
              GRID_TOP + row * (SYM + REEL_GAP)
            );
            container.setAlpha(1);
          }
          // Hide off-screen rows
          for (let i = 0; i < totalRows - ROWS_COUNT; i++) {
            col[i].setAlpha(0);
          }
          resolve();
        },
      });
    });
  }

  // ─── Flash Overlay ────────────────────────────────────────────────────────────

  private showFlash(message: string, sub: string, durationMs: number, onDone: () => void): void {
    if (!this.flashOverlay) { onDone(); return; }
    const overlay = this.flashOverlay;
    const msg     = (overlay as unknown as Record<string, unknown>)['_msg'] as Phaser.GameObjects.Text;
    const subText = (overlay as unknown as Record<string, unknown>)['_sub'] as Phaser.GameObjects.Text;
    msg.setText(message);
    subText.setText(sub);
    overlay.setVisible(true).setAlpha(0);
    this.scene.tweens.add({
      targets: overlay, alpha: 1, duration: 180,
      onComplete: () => {
        this.scene.time.delayedCall(durationMs, () => {
          this.scene.tweens.add({
            targets: overlay, alpha: 0, duration: 200,
            onComplete: () => { overlay.setVisible(false); onDone(); },
          });
        });
      },
    });
  }

  private showJackpotFlash(result: JackpotResult, onDone: () => void): void {
    const msgs: Record<string, { msg: string; sub: string; dur: number }> = {
      PHILOSOPHER: { msg: 'PHILOSOPHER STONE!', sub: `+${JACKPOT_MULTIPLIERS.PHILOSOPHER}× YOUR BET`, dur: 2500 },
      GRAND:       { msg: 'GRAND JACKPOT',      sub: `+${JACKPOT_MULTIPLIERS.GRAND}× YOUR BET`,       dur: 2000 },
      MINOR:       { msg: 'MINOR JACKPOT',       sub: `+${JACKPOT_MULTIPLIERS.MINOR}× YOUR BET`,       dur: 1600 },
    };
    const { msg, sub, dur } = msgs[result.tier];
    this.showFlash(msg, sub, dur, onDone);
  }

  // ─── Win / Transmute Animations ───────────────────────────────────────────────

  public animateTransmute(
    transmuted: { reel: number; row: number; symbol: AlchemistSymbol }[],
    onComplete: () => void
  ): void {
    if (transmuted.length === 0) { onComplete(); return; }
    let remaining = transmuted.length;
    const totalRows = this.reelCols[0].length;
    transmuted.forEach(({ reel, row, symbol }) => {
      const container = this.reelCols[reel][totalRows - ROWS_COUNT + row];
      this.scene.tweens.add({
        targets: container, alpha: 0.2, duration: 100, yoyo: true, repeat: 3,
        onComplete: () => {
          container.setAlpha(1);
          this.drawSym(container, symbol);
          if (--remaining === 0) onComplete();
        },
      });
    });
  }

  public animateWin(winLines: WinLine[]): void {
    const totalRows = this.reelCols[0].length;
    winLines.forEach(line => {
      line.positions.forEach(({ reel, row }) => {
        const c = this.reelCols[reel][totalRows - ROWS_COUNT + row];
        this.scene.tweens.add({
          targets: c, scaleX: 1.15, scaleY: 1.15,
          duration: 160, yoyo: true, repeat: 3, ease: 'Sine.easeInOut',
        });
      });
    });
  }

  // ─── Spin Handler ─────────────────────────────────────────────────────────────

  private handleSpin(): void {
    if (!this.state || !this.state.isComplete || this.spinning) return;

    this.spinning = true;
    this.state.isComplete = false;
    this.spinBtn?.disableInteractive();
    this.spinBtnLabel?.setText('...');
    this.winDisplay?.setText('WIN  —');
    this.fsDisplay?.setText('');

    this.state = spinAlchemist(this.state, this.config);
    const snap = this.state;

    const baseDuration = 700;
    const reelPromises: Promise<void>[] = [];

    for (let r = 0; r < REELS_COUNT; r++) {
      const duration  = baseDuration + r * REEL_DELAY;
      const finalSyms = snap.reelStops[r];
      reelPromises.push(
        new Promise(resolve => {
          this.scene.time.delayedCall(r * REEL_DELAY, () => {
            this.spinReel(r, finalSyms, snap.transmutingPositions, duration).then(resolve);
          });
        })
      );
    }

    Promise.all(reelPromises).then(() => {
      this.balance += snap.totalWin - this.currentBet;
      this.winDisplay?.setText(`WIN  ${snap.totalWin > 0 ? snap.totalWin.toFixed(2) : '—'}`);
      this.balanceText?.setText(`BAL  ${this.balance.toLocaleString()}`);
      if (snap.freeSpinsRemaining > 0) {
        this.fsDisplay?.setText(`FREE SPINS: ${snap.freeSpinsRemaining}`);
      }

      const afterFlash = () => {
        const afterAnimate = () => {
          if (snap.winLines.length > 0) this.animateWin(snap.winLines);
          if (snap.transmutedSymbols.length > 0) {
            this.animateTransmute(snap.transmutedSymbols, () => {
              if (this.state) this.state.isComplete = true;
              this.spinning = false;
              this.spinBtn?.setInteractive({ useHandCursor: true });
              this.spinBtnLabel?.setText(snap.freeSpinsRemaining > 0 ? 'FREE' : 'SPIN');
            });
          } else {
            this.scene.time.delayedCall(900, () => {
              if (this.state) this.state.isComplete = true;
              this.spinning = false;
              this.spinBtn?.setInteractive({ useHandCursor: true });
              this.spinBtnLabel?.setText(snap.freeSpinsRemaining > 0 ? 'FREE' : 'SPIN');
            });
          }
        };

        if (snap.isFreeSpinTriggered) {
          this.showFlash('FREE SPINS!', `${snap.freeSpinsRemaining} spins awarded`, 1400, afterAnimate);
        } else if (snap.isFreeSpinRetriggered) {
          this.showFlash('TRANSMUTATION RETRIGGER!', `+${snap.freeSpinsRemaining} more spins`, 1400, afterAnimate);
        } else if (snap.totalWin >= 200) {
          this.showFlash('MEGA WIN', `+${snap.totalWin.toFixed(0)} credits`, 1600, afterAnimate);
        } else if (snap.totalWin >= 50) {
          this.showFlash('BIG WIN', `+${snap.totalWin.toFixed(0)} credits`, 1200, afterAnimate);
        } else if (snap.totalWin > 0) {
          this.showFlash(`WIN  +${snap.totalWin.toFixed(0)}`, '', 900, afterAnimate);
        } else {
          afterAnimate();
        }
      };

      if (snap.jackpotResult) {
        this.showJackpotFlash(snap.jackpotResult, afterFlash);
      } else {
        afterFlash();
      }
    });
  }
}

// Re-export for use in AlchemistScene
const COPPER_STR = '#b87333';
export { COPPER_STR };

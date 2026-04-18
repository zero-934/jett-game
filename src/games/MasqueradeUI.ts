/**
 * @file MasqueradeUI.ts
 * @purpose Phaser rendering for Midnight Masquerade slot — symbol grid, spinning reel animation,
 *          big win flash overlay, masked-symbol reveal, and HUD.
 * @author Agent 934
 * @date 2026-04-15
 * @license Proprietary – available for licensing
 */

import * as Phaser from 'phaser';
import { CasinoAudioManager } from '../shared/audio/CasinoAudioManager';
import type { MasqueradeSymbol, WinLine, JackpotResult } from './MasqueradeLogic';
import {
  REELS_COUNT, ROWS_COUNT,
  GOLD, GOLD_STR, DARK, DARK_STR,
  BET_PER_LINE, LINES_COUNT,
  JACKPOT_MULTIPLIERS,
  createMasqueradeState, spinMasquerade,
} from './MasqueradeLogic';
import type { MasqueradeState } from './MasqueradeLogic';

// ─── Layout constants ─────────────────────────────────────────────────────────
const SYM         = 66;   // symbol cell size — 5 reels fit comfortably on 390px
const REEL_GAP    = 4;
const GRID_TOP    = 290;  // y where reel grid starts (below jackpot panel)
const SPIN_ROWS   = 8;    // off-screen rows for scroll animation (hidden on init)
const REEL_DELAY  = 120;  // ms stagger between each reel stopping

// ─── Visual constants ─────────────────────────────────────────────────────────
const FONT_TITLE  = '"Georgia", serif';
const FONT_UI     = 'Arial, sans-serif';

const SYMBOL_COLORS: Record<MasqueradeSymbol, number> = {
  GOLDEN_MASK: GOLD,
  CHAMPAGNE:   0x90c8e0,
  PEACOCK:     0x008080,
  GLOVES:      0x7b2fbe,
  CLOCK:       0xa8a8a8,
  SLIPPER:     0xe87c8a,
  INVITATION:  0xe8c44a,
  MUSIC:       0x6ab0d8,
  WILD:        0x0a0a1a,
  SCATTER:     GOLD,
  MASKED:      0x3a0068,
};

const SYMBOL_LABEL: Record<MasqueradeSymbol, string> = {
  GOLDEN_MASK: 'MASK',
  CHAMPAGNE:   'CHMP',
  PEACOCK:     'PCCK',
  GLOVES:      'GLVS',
  CLOCK:       'CLK',
  SLIPPER:     'SLPR',
  INVITATION:  'INVT',
  MUSIC:       'MUSC',
  WILD:        'WILD',
  SCATTER:     '✦',
  MASKED:      '?',
};



// ─── MasqueradeUI ─────────────────────────────────────────────────────────────

export class MasqueradeUI {
  private scene:  Phaser.Scene;
  private config: Parameters<typeof spinMasquerade>[1];
  private state:  MasqueradeState | null = null;
  private spinning = false;
  private audioManager = new CasinoAudioManager();

  // Jackpot panel
  private phantomPlaque: Phaser.GameObjects.Graphics | null = null;

  // Reel columns — each holds SPIN_ROWS + ROWS_COUNT containers that scroll
  private reelCols: Phaser.GameObjects.Container[][] = []; // [reel][symbolIdx]
  private reelMasks: Phaser.GameObjects.Graphics[]   = []; // clipping masks

  // HUD
  private spinBtn:      Phaser.GameObjects.Container | null = null;
  private balance:      number = 10000;
  private currentBet:   number = 25;
  private balanceText:  Phaser.GameObjects.Text | null = null;
  private betBtns:      Phaser.GameObjects.Text[] = [];

  private spinBtnLabel: Phaser.GameObjects.Text      | null = null;
  private winDisplay:   Phaser.GameObjects.Text      | null = null;
  private betDisplay:   Phaser.GameObjects.Text      | null = null;
  private fsDisplay:    Phaser.GameObjects.Text      | null = null;

  // Big flash overlay
  private flashOverlay: Phaser.GameObjects.Container | null = null;

  constructor(scene: Phaser.Scene, config: Parameters<typeof spinMasquerade>[1] = {}) {
    this.scene  = scene;
    this.config = config;
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  public start(): void {
    this.cleanup();
    this.state = createMasqueradeState(BET_PER_LINE * LINES_COUNT, LINES_COUNT);
    this.buildJackpotPanel();
    this.buildReelFrame();
    this.buildReels();
    this.buildHUD();
    this.buildFlashOverlay();
    this.snapReels(this.state.reelStops, []);
  }

  public cleanup(): void {
    this.phantomPlaque = null; // destroyed by scene when scene shuts down
    this.reelCols.forEach(col => col.forEach(c => c.destroy()));
    this.reelMasks.forEach(m => m.destroy());
    this.reelCols  = [];
    this.reelMasks = [];
    this.spinBtn?.destroy();
    this.winDisplay?.destroy();
    this.betDisplay?.destroy();
    this.fsDisplay?.destroy();
    this.flashOverlay?.destroy();
    this.spinBtn      = null;
    this.balanceText?.destroy();
    this.balanceText  = null;
    this.betBtns.forEach(b => b.destroy());
    this.betBtns      = [];

    this.spinBtnLabel = null;
    this.winDisplay   = null;
    this.betDisplay   = null;
    this.fsDisplay    = null;
    this.flashOverlay = null;
    this.state        = null;
    this.spinning     = false;
  }

  // ─── Build ───────────────────────────────────────────────────────────────────

  /** Three jackpot plaques displayed above the reel grid (y 64–124). */
  private buildJackpotPanel(): void {
    const { width }   = this.scene.scale;
    const panelY      = 64;
    const panelH      = 48;
    const phantomH    = panelH + 10; // centre plaque is taller
    const corner      = 6;
    const border      = 1.5;
    const gap         = 6;
    const sideW       = (width - gap * 4) * 0.28;
    const centreW     = (width - gap * 4) * 0.40;

    const veilX    = gap;
    const phantomX = veilX + sideW + gap;
    const marquisX = phantomX + centreW + gap;

    // ── VEIL (left) ──
    const veil = this.scene.add.graphics();
    veil.fillStyle(0x3a0068, 1);
    veil.lineStyle(border, GOLD, 0.7);
    veil.fillRoundedRect(veilX, panelY, sideW, panelH, corner);
    veil.strokeRoundedRect(veilX, panelY, sideW, panelH, corner);

    this.scene.add.text(veilX + sideW / 2, panelY + 13, 'VEIL', {
      fontFamily: FONT_UI, fontSize: '11px', color: '#8877aa', align: 'center',
    }).setOrigin(0.5, 0.5);

    this.scene.add.text(veilX + sideW / 2, panelY + 33, `${JACKPOT_MULTIPLIERS.VEIL}×`, {
      fontFamily: FONT_UI, fontSize: '15px', color: GOLD_STR, fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5, 0.5);

    // ── PHANTOM (centre, tallest) ──
    const phantom = this.scene.add.graphics();
    phantom.fillStyle(0x0a0a1a, 1);
    phantom.lineStyle(border + 0.5, GOLD, 1);
    phantom.fillRoundedRect(phantomX, panelY - 5, centreW, phantomH, corner + 2);
    phantom.strokeRoundedRect(phantomX, panelY - 5, centreW, phantomH, corner + 2);
    this.phantomPlaque = phantom;

    this.scene.add.text(phantomX + centreW / 2, panelY + 8, 'PHANTOM', {
      fontFamily: FONT_UI, fontSize: '13px', color: '#aaaacc', align: 'center',
    }).setOrigin(0.5, 0.5);

    this.scene.add.text(phantomX + centreW / 2, panelY + 33, `${JACKPOT_MULTIPLIERS.PHANTOM}×`, {
      fontFamily: FONT_UI, fontSize: '20px', color: GOLD_STR, fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5, 0.5);

    // ── MARQUIS (right) ──
    const marquis = this.scene.add.graphics();
    marquis.fillStyle(0x2a0050, 1);
    marquis.lineStyle(border, GOLD, 0.7);
    marquis.fillRoundedRect(marquisX, panelY, sideW, panelH, corner);
    marquis.strokeRoundedRect(marquisX, panelY, sideW, panelH, corner);

    this.scene.add.text(marquisX + sideW / 2, panelY + 13, 'MARQUIS', {
      fontFamily: FONT_UI, fontSize: '11px', color: '#8877aa', align: 'center',
    }).setOrigin(0.5, 0.5);

    this.scene.add.text(marquisX + sideW / 2, panelY + 33, `${JACKPOT_MULTIPLIERS.MARQUIS}×`, {
      fontFamily: FONT_UI, fontSize: '15px', color: GOLD_STR, fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5, 0.5);

    // Pulse the PHANTOM plaque subtly
    this.scene.tweens.add({
      targets:  this.phantomPlaque,
      alpha:    0.80,
      duration: 1800,
      yoyo:     true,
      repeat:   -1,
      ease:     'Sine.easeInOut',
    });
  }

  private get gridW(): number { return REELS_COUNT * SYM + (REELS_COUNT - 1) * REEL_GAP; }
  private get gridH(): number { return ROWS_COUNT  * SYM + (ROWS_COUNT  - 1) * REEL_GAP; }
  private get gridX(): number { return ((this.scene.game.config.width as number || 390) - this.gridW) / 2; }

  /** Decorative frame around the reel grid */
  private buildReelFrame(): void {
    const { width } = this.scene.scale;
    const gx = this.gridX - 10;
    const gy = GRID_TOP   - 10;
    const gw = this.gridW  + 20;
    const gh = this.gridH  + 20;

    const frame = this.scene.add.graphics();
    // Dark fill
    frame.fillStyle(0x1a0033, 1);
    frame.fillRoundedRect(gx, gy, gw, gh, 12);
    // Outer gold border
    frame.lineStyle(3, GOLD, 1);
    frame.strokeRoundedRect(gx, gy, gw, gh, 12);
    // Inner accent line
    frame.lineStyle(1, GOLD, 0.35);
    frame.strokeRoundedRect(gx + 4, gy + 4, gw - 8, gh - 8, 9);
    // Corner diamonds
    const corners = [[gx, gy], [gx+gw, gy], [gx, gy+gh], [gx+gw, gy+gh]];
    corners.forEach(([cx, cy]) => {
      frame.fillStyle(GOLD, 1);
      frame.fillRect(cx - 3, cy - 3, 6, 6);
    });

    // Side bars that cover any off-screen symbol overflow (match background gradient start colour)
    const leftBar  = this.scene.add.graphics();
    const rightBar = this.scene.add.graphics();
    leftBar.fillStyle(0x100020, 1);
    leftBar.fillRect(0, GRID_TOP - 2, gx, this.gridH + 4);
    rightBar.fillStyle(0x100020, 1);
    rightBar.fillRect(gx + gw, GRID_TOP - 2, width - (gx + gw), this.gridH + 4);
  }

  /** Builds SPIN_ROWS + ROWS_COUNT symbol containers per reel for scroll animation */
  private buildReels(): void {
    const totalRows = SPIN_ROWS + ROWS_COUNT;

    for (let r = 0; r < REELS_COUNT; r++) {
      this.reelCols[r] = [];
      const reelX = this.gridX + r * (SYM + REEL_GAP);

      for (let i = 0; i < totalRows; i++) {
        const container = this.scene.add.container(reelX, -9999); // hidden off-screen until snap
        container.setSize(SYM, SYM);
        container.setAlpha(0); // invisible until snapReels positions them
        this.reelCols[r].push(container);
      }
    }
  }

  private buildHUD(): void {
    const { width } = this.scene.scale;
    const hudY = GRID_TOP + this.gridH + 16;

    // Balance display (top right of HUD row)
    this.balanceText = this.scene.add.text(width - 16, hudY - 30, `BAL  ${this.balance.toLocaleString()}`, {
      fontFamily: FONT_UI, fontSize: '13px', color: GOLD_STR,
    }).setOrigin(1, 0.5);

    // Bet selector buttons
    const BET_OPTIONS = [1, 10, 50, 250, 1000];
    const betSpacing = Math.floor((width - 32) / BET_OPTIONS.length);
    BET_OPTIONS.forEach((bet: number, i: number) => {
      const bx = 16 + betSpacing * i + betSpacing / 2;
      const btn = this.scene.add.text(bx, hudY + 30, `$${bet.toLocaleString()}`, {
        fontFamily: FONT_UI, fontSize: '13px', color: GOLD_STR,
        backgroundColor: this.currentBet === bet ? GOLD_STR : '#333333',
        padding: { x: 8, y: 4 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      if (this.currentBet === bet) btn.setStyle({ color: DARK_STR });
      btn.on('pointerdown', () => {
        this.currentBet = bet;
        this.betBtns.forEach((b, j) => {
          b.setStyle({ backgroundColor: j === i ? GOLD_STR : '#333333', color: j === i ? DARK_STR : GOLD_STR });
        });
        this.betDisplay?.setText(`BET  ${bet.toLocaleString()}`);
        this.state = createMasqueradeState ? createMasqueradeState(bet, LINES_COUNT) : this.state;
      });
      this.betBtns.push(btn);
    });

    // BET label
    this.betDisplay = this.scene.add.text(16, hudY, `BET  ${this.currentBet.toLocaleString()}`, {
      fontFamily: FONT_UI, fontSize: '14px', color: GOLD_STR,
    });

    // WIN label
    this.winDisplay = this.scene.add.text(width - 16, hudY, 'WIN  —', {
      fontFamily: FONT_UI, fontSize: '14px', color: GOLD_STR,
    }).setOrigin(1, 0);

    // Free spins counter (centred)
    this.fsDisplay = this.scene.add.text(width / 2, hudY, '', {
      fontFamily: FONT_UI, fontSize: '14px', color: '#cc88ff',
    }).setOrigin(0.5, 0);

    // SPIN button
    const btnY = hudY + 110;
    const bg   = this.scene.add.graphics();
    this.drawBtnBg(bg, false);

    const label = this.scene.add.text(0, 0, 'SPIN', {
      fontFamily: FONT_UI, fontSize: '28px', color: DARK_STR, fontStyle: 'bold',
    }).setOrigin(0.5);

    this.spinBtn = this.scene.add.container(width / 2, btnY, [bg, label])
      .setSize(160, 50)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.handleSpin())
      .on('pointerover',  () => this.drawBtnBg(bg, true))
      .on('pointerout',   () => this.drawBtnBg(bg, false));


    this.spinBtnLabel = label;

    // HOME
    // Home navigation handled by MasqueradeScene nav bar
  }

  private drawBtnBg(g: Phaser.GameObjects.Graphics, hover: boolean): void {
    g.clear();
    g.fillStyle(hover ? 0xddb83a : GOLD, 1);
    g.fillRoundedRect(-80, -25, 160, 50, 12);
  }

  /** Full-screen flash overlay for win / free-spins announcements */
  private buildFlashOverlay(): void {
    const { width, height } = this.scene.scale;

    const dim = this.scene.add.graphics();
    dim.fillStyle(0x000000, 0.65);
    dim.fillRect(0, 0, width, height);

    const msg = this.scene.add.text(width / 2, height / 2, '', {
      fontFamily: FONT_TITLE,
      fontSize:   '52px',
      color:      GOLD_STR,
      stroke:     '#000000',
      strokeThickness: 8,
      align:      'center',
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

    // Store refs so we can update text
    (this.flashOverlay as unknown as Record<string, unknown>)['_msg'] = msg;
    (this.flashOverlay as unknown as Record<string, unknown>)['_sub'] = sub;
  }

  // ─── Symbol Drawing ───────────────────────────────────────────────────────────

  /**
   * Draws a neutral grey placeholder — used during reel spin for visual comfort.
   * No colours, no labels. Eyes track motion without being distracted by content.
   */
  private drawBlurSym(container: Phaser.GameObjects.Container): void {
    container.removeAll(true);
    const g = this.scene.add.graphics();
    g.fillStyle(0x2a2a3a, 0.75);
    g.fillRoundedRect(3, 3, SYM - 6, SYM - 6, 7);
    container.add(g);
  }

  private drawSym(container: Phaser.GameObjects.Container, symbol: MasqueradeSymbol): void {
    container.removeAll(true);

    const g    = this.scene.add.graphics();
    const half = SYM / 2;
    const col  = SYMBOL_COLORS[symbol];

    if (symbol === 'MASKED') {
      g.fillStyle(col, 1);
      g.fillCircle(half, half, half - 3);
      g.lineStyle(2, GOLD, 0.8);
      g.strokeCircle(half, half, half - 3);
    } else if (symbol === 'WILD') {
      g.fillStyle(col, 1);
      g.fillRoundedRect(3, 3, SYM - 6, SYM - 6, 6);
      g.lineStyle(2, GOLD, 1);
      g.strokeRoundedRect(3, 3, SYM - 6, SYM - 6, 6);
    } else if (symbol === 'SCATTER') {
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
      g.lineStyle(1, 0x000000, 0.25);
      g.strokeRoundedRect(3, 3, SYM - 6, SYM - 6, 7);
    }

    const isLight = symbol !== 'WILD' && symbol !== 'MASKED';
    const lbl = this.scene.add.text(half, half, SYMBOL_LABEL[symbol], {
      fontFamily: FONT_UI,
      fontSize:   symbol === 'MASKED' ? '30px' : '13px',
      color:      isLight ? '#111111' : GOLD_STR,
      fontStyle:  'bold',
      align:      'center',
    }).setOrigin(0.5);

    container.add([g, lbl]);
  }

  // ─── Reel Snap (instant, no animation) ───────────────────────────────────────

  private snapReels(stops: MasqueradeSymbol[][], masked: { reel: number; row: number }[]): void {
    const maskedSet = new Set(masked.map(p => `${p.reel},${p.row}`));
    const totalRows = SPIN_ROWS + ROWS_COUNT;

    for (let r = 0; r < REELS_COUNT; r++) {
      for (let i = 0; i < totalRows; i++) {
        const visRow  = i - SPIN_ROWS; // 0..ROWS_COUNT-1 are visible; negative = off-screen
        const container = this.reelCols[r][i];

        if (visRow >= 0 && visRow < ROWS_COUNT) {
          // Visible row — position correctly and draw symbol
          container.setPosition(
            this.gridX + r * (SYM + REEL_GAP),
            GRID_TOP + visRow * (SYM + REEL_GAP)
          );
          container.setAlpha(1);
          const sym = maskedSet.has(`${r},${visRow}`) ? 'MASKED' : stops[r][visRow];
          this.drawSym(container, sym);
        } else {
          // Off-screen row — keep hidden, positioned far above viewport
          container.setPosition(this.gridX + r * (SYM + REEL_GAP), -9999);
          container.setAlpha(0);
        }
      }
    }
  }

  // ─── Reel Spin Animation ──────────────────────────────────────────────────────

  /**
   * Spins a single reel with a blur-scroll effect, then snaps to finalSymbols.
   * Returns a Promise that resolves when the reel stops.
   */
  private spinReel(
    reelIndex: number,
    finalSymbols: MasqueradeSymbol[],
    masked: { reel: number; row: number }[],
    spinDuration: number
  ): Promise<void> {
    return new Promise(resolve => {
      const col       = this.reelCols[reelIndex];
      const totalRows = col.length;
      const maskedSet = new Set(masked.map(p => `${p.reel},${p.row}`));

      // Fill all off-screen containers with blur placeholders (easy on the eyes during scroll)
      col.forEach((c, i) => {
        this.drawBlurSym(c);
        // Stack them above the viewport to start
        c.setPosition(
          this.gridX + reelIndex * (SYM + REEL_GAP),
          GRID_TOP - (totalRows - i) * (SYM + REEL_GAP)
        );
      });

      // Total distance to travel: bring all rows into view
      const totalDist = totalRows * (SYM + REEL_GAP);
      const reelX     = this.gridX + reelIndex * (SYM + REEL_GAP);

      // Tween: scroll all containers down by totalDist
      this.scene.tweens.add({
        targets:    col,
        y:          `+=${totalDist}`,
        duration:   spinDuration,
        ease:       'Cubic.easeOut',
        onUpdate:   () => {
          // Alpha blur effect — symbols near top/bottom fade
          col.forEach(c => {
            const relY = c.y - GRID_TOP;
            const inGrid = relY >= -SYM && relY <= this.gridH;
            c.setAlpha(inGrid ? 1 : Math.max(0, 1 - Math.abs(relY - this.gridH / 2) / (this.gridH * 0.8)));
          });
        },
        onComplete: () => {
          // Snap: position final symbols in the visible rows
          for (let row = 0; row < ROWS_COUNT; row++) {
            const container = col[totalRows - ROWS_COUNT + row];
            const sym = maskedSet.has(`${reelIndex},${row}`) ? 'MASKED' : finalSymbols[row];
            this.drawSym(container, sym);
            container.setPosition(reelX, GRID_TOP + row * (SYM + REEL_GAP));
            container.setAlpha(1);
          }
          // Hide off-screen containers
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
      targets:  overlay,
      alpha:    1,
      duration: 180,
      onComplete: () => {
        this.scene.time.delayedCall(durationMs, () => {
          this.scene.tweens.add({
            targets:  overlay,
            alpha:    0,
            duration: 200,
            onComplete: () => { overlay.setVisible(false); onDone(); },
          });
        });
      },
    });
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  public renderReels(stops: MasqueradeSymbol[][], masked: { reel: number; row: number }[]): void {
    this.snapReels(stops, masked);
    this.winDisplay?.setText(`WIN  ${this.state?.totalWin.toFixed(2) ?? '—'}`);
  }

  public animateUnmask(
    revealed: { reel: number; row: number; symbol: MasqueradeSymbol }[],
    onComplete: () => void
  ): void {
    if (revealed.length === 0) { onComplete(); return; }
    let remaining = revealed.length;
    revealed.forEach(({ reel, row, symbol }) => {
      const totalRows = this.reelCols[reel].length;
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

  /**
   * Shows a jackpot-specific flash overlay with tier-appropriate messaging.
   * @param result   - The JackpotResult from this spin.
   * @param onDone   - Callback when the flash finishes.
   */
  private showJackpotFlash(result: JackpotResult, onDone: () => void): void {
    const msgs: Record<string, { msg: string; sub: string; dur: number }> = {
      PHANTOM: { msg: 'PHANTOM JACKPOT',  sub: `+${JACKPOT_MULTIPLIERS.PHANTOM}× YOUR BET`, dur: 2500 },
      MARQUIS: { msg: 'MARQUIS JACKPOT',  sub: `+${JACKPOT_MULTIPLIERS.MARQUIS}× YOUR BET`, dur: 2000 },
      VEIL:    { msg: 'VEIL JACKPOT',     sub: `+${JACKPOT_MULTIPLIERS.VEIL}× YOUR BET`,    dur: 1600 },
    };
    const { msg, sub, dur } = msgs[result.tier];
    this.showFlash(msg, sub, dur, onDone);
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

    // Run game logic
    this.state = spinMasquerade(this.state, this.config);
    const snap = this.state;

    // Kick off reel spin animations — each reel stops REEL_DELAY ms after the previous
    const baseDuration = 700;
    const reelPromises: Promise<void>[] = [];

    for (let r = 0; r < REELS_COUNT; r++) {
      const duration  = baseDuration + r * REEL_DELAY;
      const finalSyms = snap.reelStops[r];
      reelPromises.push(
        new Promise(resolve => {
          this.scene.time.delayedCall(r * REEL_DELAY, () => {
            this.spinReel(r, finalSyms, snap.maskedPositions, duration).then(resolve);
          });
        })
      );
    }

    // After all reels stop
    Promise.all(reelPromises).then(() => {
      this.balance += snap.totalWin - this.currentBet;
      this.winDisplay?.setText(`WIN  ${snap.totalWin > 0 ? snap.totalWin.toFixed(2) : '—'}`);
      this.audioManager.onWin(snap.totalWin, this.currentBet);
      this.balanceText?.setText(`BAL  ${this.balance.toLocaleString()}`);

      if (snap.freeSpinsRemaining > 0) {
        this.fsDisplay?.setText(`FREE SPINS: ${snap.freeSpinsRemaining}`);
      }

      const afterFlash = () => {
        // Unmask animation (free spins)
        const afterUnmask = () => {
          if (snap.winLines.length > 0) {
            this.animateWin(snap.winLines);
          }
          this.scene.time.delayedCall(900, () => {
            if (this.state) this.state.isComplete = true;
            this.spinning = false;
            this.spinBtn?.setInteractive({ useHandCursor: true });
            this.spinBtnLabel?.setText(snap.freeSpinsRemaining > 0 ? 'FREE' : 'SPIN');
          });
        };

        if (snap.revealedSymbols.length > 0) {
          this.animateUnmask(snap.revealedSymbols, afterUnmask);
        } else {
          afterUnmask();
        }
      };

      // Big flash announcements — jackpot first, then win/free spins
      const showWinFlash = () => {
        if (snap.isFreeSpinTriggered) {
          this.showFlash('FREE SPINS!', `${snap.freeSpinsRemaining} spins awarded`, 1400, afterFlash);
        } else if (snap.isFreeSpinRetriggered) {
          this.showFlash('RETRIGGER!', `+${snap.freeSpinsRemaining} more spins`, 1400, afterFlash);
        } else if (snap.totalWin >= 200) {
          this.showFlash('MEGA WIN', `+${snap.totalWin.toFixed(0)} credits`, 1600, afterFlash);
        } else if (snap.totalWin >= 50) {
          this.showFlash('BIG WIN', `+${snap.totalWin.toFixed(0)} credits`, 1200, afterFlash);
        } else if (snap.totalWin > 0) {
          this.showFlash(`WIN  +${snap.totalWin.toFixed(0)}`, '', 900, afterFlash);
        } else {
          afterFlash();
        }
      };

      if (snap.jackpotResult) {
        this.showJackpotFlash(snap.jackpotResult, showWinFlash);
      } else {
        showWinFlash();
      }
    });
  }
}

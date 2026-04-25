import * as Phaser from 'phaser';
import { CasinoAudioManager } from '../shared/audio/CasinoAudioManager';
import type { MasqueradeSymbol, WinLine, JackpotResult } from './MasqueradeLogic';
import {
  REELS_COUNT, ROWS_COUNT,
  BET_PER_LINE, LINES_COUNT,
  JACKPOT_MULTIPLIERS,
  createMasqueradeState, spinMasquerade,
} from './MasqueradeLogic';
import type { MasqueradeState } from './MasqueradeLogic';

import {
  COLOR_BG,
  COLOR_SURFACE,
  COLOR_BORDER,
  COLOR_GOLD,
  STR_GOLD,
  STR_TEXT,
  STR_MUTED,
  FONT_PRIMARY,
  FONT_SIZE_XS,
  FONT_SIZE_SM,
  FONT_SIZE_BASE,
  FONT_SIZE_XL,
  FONT_SIZE_2XL,
  TEXT_STYLE_LABEL,
  TEXT_STYLE_BODY,
  TEXT_STYLE_SEMIBOLD,
  TEXT_STYLE_GOLD_SEMIBOLD,
  TEXT_STYLE_DISPLAY,
  BTN_PRIMARY_BG,
  BTN_PRIMARY_RADIUS,
  BTN_SECONDARY_BG,
  BTN_SECONDARY_TEXT,
  BTN_SECONDARY_RADIUS,
  TEXT_STYLE_BTN_SECONDARY,
  drawButton
} from '../shared/ui/UITheme';

// ─── Layout constants ─────────────────────────────────────────────────────────
const SYM         = 66;   // symbol cell size — 5 reels fit comfortably on 390px
const REEL_GAP    = 4;
const GRID_TOP    = 290;  // y where reel grid starts (below jackpot panel)
const SPIN_ROWS   = 8;    // off-screen rows for scroll animation (hidden on init)
const REEL_DELAY  = 120;  // ms stagger between each reel stopping

// ─── Visual constants ─────────────────────────────────────────────────────────

// Masquerade-specific atmospheric colors
const MASQUERADE_PURPLE_DARK    = 0x3a0068;
const MASQUERADE_PURPLE_MEDIUM  = 0x2a0050;
const MASQUERADE_ACCENT_BLUE    = 0x0a0a1a; // Used for Wild symbol and Phantom plaque background

const SYMBOL_COLORS: Record<MasqueradeSymbol, number> = {
  GOLDEN_MASK: COLOR_GOLD,
  CHAMPAGNE:   0x90c8e0,
  PEACOCK:     0x008080,
  GLOVES:      0x7b2fbe,
  CLOCK:       0xa8a8a8,
  SLIPPER:     0xe87c8a,
  INVITATION:  0xe8c44a,
  MUSIC:       0x6ab0d8,
  WILD:        MASQUERADE_ACCENT_BLUE,
  SCATTER:     COLOR_GOLD,
  MASKED:      MASQUERADE_PURPLE_DARK,
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
  private spinBtn:      { bg: Phaser.GameObjects.Graphics; text: Phaser.GameObjects.Text } | null = null;
  private balance:      number = 10000;
  private currentBet:   number = 25;
  private balanceText:  Phaser.GameObjects.Text | null = null;
  private betBtnObjects: { bg: Phaser.GameObjects.Graphics; text: Phaser.GameObjects.Text }[] = [];

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
    this.spinBtn?.bg.destroy();
    this.spinBtn?.text.destroy();
    this.winDisplay?.destroy();
    this.betDisplay?.destroy();
    this.fsDisplay?.destroy();
    this.flashOverlay?.destroy();
    this.spinBtn      = null;
    this.balanceText?.destroy();
    this.balanceText  = null;
    this.betBtnObjects.forEach(b => { b.bg.destroy(); b.text.destroy(); });
    this.betBtnObjects      = [];

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
    veil.fillStyle(MASQUERADE_PURPLE_DARK, 1);
    veil.lineStyle(border, COLOR_GOLD, 0.7);
    veil.fillRoundedRect(veilX, panelY, sideW, panelH, corner);
    veil.strokeRoundedRect(veilX, panelY, sideW, panelH, corner);

    this.scene.add.text(veilX + sideW / 2, panelY + 13, 'VEIL', {
      ...TEXT_STYLE_LABEL,
      fontSize: FONT_SIZE_XS,
      color: STR_MUTED, // Specific to this text, slightly brighter muted
    }).setOrigin(0.5, 0.5);

    this.scene.add.text(veilX + sideW / 2, panelY + 33, `${JACKPOT_MULTIPLIERS.VEIL}×`, {
      ...TEXT_STYLE_GOLD_SEMIBOLD,
      fontSize: FONT_SIZE_BASE,
    }).setOrigin(0.5, 0.5);

    // ── PHANTOM (centre, tallest) ──
    const phantom = this.scene.add.graphics();
    phantom.fillStyle(MASQUERADE_ACCENT_BLUE, 1);
    phantom.lineStyle(border + 0.5, COLOR_GOLD, 1);
    phantom.fillRoundedRect(phantomX, panelY - 5, centreW, phantomH, corner + 2);
    phantom.strokeRoundedRect(phantomX, panelY - 5, centreW, phantomH, corner + 2);
    this.phantomPlaque = phantom;

    this.scene.add.text(phantomX + centreW / 2, panelY + 8, 'PHANTOM', {
      ...TEXT_STYLE_SEMIBOLD,
      fontSize: FONT_SIZE_SM,
      color: STR_TEXT, // Specific to this text
    }).setOrigin(0.5, 0.5);

    this.scene.add.text(phantomX + centreW / 2, panelY + 33, `${JACKPOT_MULTIPLIERS.PHANTOM}×`, {
      ...TEXT_STYLE_GOLD_SEMIBOLD,
      fontSize: FONT_SIZE_XL,
    }).setOrigin(0.5, 0.5);

    // ── MARQUIS (right) ──
    const marquis = this.scene.add.graphics();
    marquis.fillStyle(MASQUERADE_PURPLE_MEDIUM, 1);
    marquis.lineStyle(border, COLOR_GOLD, 0.7);
    marquis.fillRoundedRect(marquisX, panelY, sideW, panelH, corner);
    marquis.strokeRoundedRect(marquisX, panelY, sideW, panelH, corner);

    this.scene.add.text(marquisX + sideW / 2, panelY + 13, 'MARQUIS', {
      ...TEXT_STYLE_LABEL,
      fontSize: FONT_SIZE_XS,
      color: STR_MUTED, // Specific to this text, slightly brighter muted
    }).setOrigin(0.5, 0.5);

    this.scene.add.text(marquisX + sideW / 2, panelY + 33, `${JACKPOT_MULTIPLIERS.MARQUIS}×`, {
      ...TEXT_STYLE_GOLD_SEMIBOLD,
      fontSize: FONT_SIZE_BASE,
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
    frame.fillStyle(MASQUERADE_PURPLE_DARK, 1); // Specific atmospheric dark purple
    frame.fillRoundedRect(gx, gy, gw, gh, 12);
    // Outer gold border
    frame.lineStyle(3, COLOR_GOLD, 1);
    frame.strokeRoundedRect(gx, gy, gw, gh, 12);
    // Inner accent line
    frame.lineStyle(1, COLOR_GOLD, 0.35);
    frame.strokeRoundedRect(gx + 4, gy + 4, gw - 8, gh - 8, 9);
    // Corner diamonds
    const corners = [[gx, gy], [gx+gw, gy], [gx, gy+gh], [gx+gw, gy+gh]];
    corners.forEach(([cx, cy]) => {
      frame.fillStyle(COLOR_GOLD, 1);
      frame.fillRect(cx - 3, cy - 3, 6, 6);
    });

    // Side bars that cover any off-screen symbol overflow (match background gradient start colour)
    const leftBar  = this.scene.add.graphics();
    const rightBar = this.scene.add.graphics();
    leftBar.fillStyle(COLOR_BG, 1); // Use theme background color
    leftBar.fillRect(0, GRID_TOP - 2, gx, this.gridH + 4);
    rightBar.fillStyle(COLOR_BG, 1); // Use theme background color
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
      ...TEXT_STYLE_GOLD_SEMIBOLD,
      fontSize: FONT_SIZE_SM,
    }).setOrigin(1, 0.5);

    // Bet selector buttons
    const BET_OPTIONS = [1, 10, 50, 250, 1000];
    const betBtnW = 60;
    const betBtnH = 30;
    const betSpacing = (width - 32 - BET_OPTIONS.length * betBtnW) / (BET_OPTIONS.length - 1 || 1);
    
    BET_OPTIONS.forEach((bet: number, i: number) => {
      const bx = 16 + i * (betBtnW + betSpacing) + betBtnW / 2;
      const variant = this.currentBet === bet ? 'secondary' : 'secondary'; // All bet buttons are secondary style
      const btn = drawButton(this.scene, bx, hudY + 30, betBtnW, betBtnH, `$${bet.toLocaleString()}`, variant);
      
      btn.text.setStyle({
        ...TEXT_STYLE_BTN_SECONDARY,
        fontSize: FONT_SIZE_SM,
        color: this.currentBet === bet ? BTN_SECONDARY_TEXT : STR_MUTED, // Active button gold text, others muted
      });

      // Update appearance for active bet
      if (this.currentBet === bet) {
        btn.bg.destroy(); // Destroy previous graphic
        btn.bg = this.scene.add.graphics();
        btn.bg.fillStyle(BTN_SECONDARY_BG, 1);
        btn.bg.fillRoundedRect(bx - betBtnW / 2, hudY + 30 - betBtnH / 2, betBtnW, betBtnH, BTN_SECONDARY_RADIUS);
        btn.bg.lineStyle(1.5, COLOR_GOLD, 1); // Active button has gold border
        btn.bg.strokeRoundedRect(bx - betBtnW / 2, hudY + 30 - betBtnH / 2, betBtnW, betBtnH, BTN_SECONDARY_RADIUS);
        btn.text.setColor(STR_GOLD);
      } else {
        btn.bg.destroy(); // Destroy previous graphic
        btn.bg = this.scene.add.graphics();
        btn.bg.fillStyle(BTN_SECONDARY_BG, 1);
        btn.bg.fillRoundedRect(bx - betBtnW / 2, hudY + 30 - betBtnH / 2, betBtnW, betBtnH, BTN_SECONDARY_RADIUS);
        btn.bg.lineStyle(1.5, COLOR_BORDER, 1); // Inactive buttons have a subtle border
        btn.bg.strokeRoundedRect(bx - betBtnW / 2, hudY + 30 - betBtnH / 2, betBtnW, betBtnH, BTN_SECONDARY_RADIUS);
        btn.text.setColor(STR_MUTED);
      }

      btn.text.setInteractive({ useHandCursor: true });
      btn.text.on('pointerdown', () => {
        if (this.spinning) return;
        this.currentBet = bet;
        this.betBtnObjects.forEach((bObj, j) => {
          bObj.bg.clear();
          if (j === i) {
            bObj.bg.fillStyle(BTN_SECONDARY_BG, 1);
            bObj.bg.fillRoundedRect(bObj.text.x - betBtnW / 2, hudY + 30 - betBtnH / 2, betBtnW, betBtnH, BTN_SECONDARY_RADIUS);
            bObj.bg.lineStyle(1.5, COLOR_GOLD, 1);
            bObj.bg.strokeRoundedRect(bObj.text.x - betBtnW / 2, hudY + 30 - betBtnH / 2, betBtnW, betBtnH, BTN_SECONDARY_RADIUS);
            bObj.text.setColor(STR_GOLD);
          } else {
            bObj.bg.fillStyle(BTN_SECONDARY_BG, 1);
            bObj.bg.fillRoundedRect(bObj.text.x - betBtnW / 2, hudY + 30 - betBtnH / 2, betBtnW, betBtnH, BTN_SECONDARY_RADIUS);
            bObj.bg.lineStyle(1.5, COLOR_BORDER, 1);
            bObj.bg.strokeRoundedRect(bObj.text.x - betBtnW / 2, hudY + 30 - betBtnH / 2, betBtnW, betBtnH, BTN_SECONDARY_RADIUS);
            bObj.text.setColor(STR_MUTED);
          }
        });
        this.betDisplay?.setText(`BET  ${bet.toLocaleString()}`);
        this.state = createMasqueradeState ? createMasqueradeState(bet, LINES_COUNT) : this.state;
      });
      this.betBtnObjects.push(btn);
    });

    // BET label
    this.betDisplay = this.scene.add.text(16, hudY, `BET  ${this.currentBet.toLocaleString()}`, {
      ...TEXT_STYLE_BODY,
      fontSize: FONT_SIZE_BASE,
    });

    // WIN label
    this.winDisplay = this.scene.add.text(width - 16, hudY, 'WIN  —', {
      ...TEXT_STYLE_BODY,
      fontSize: FONT_SIZE_BASE,
    }).setOrigin(1, 0);

    // Free spins counter (centred)
    this.fsDisplay = this.scene.add.text(width / 2, hudY, '', {
      ...TEXT_STYLE_SEMIBOLD,
      fontSize: FONT_SIZE_BASE,
      color: '#cc88ff', // Specific atmospheric color for free spins
    }).setOrigin(0.5, 0);

    // SPIN button
    const btnY = hudY + 110;
    this.spinBtn = drawButton(this.scene, width / 2, btnY, 160, 50, 'SPIN', 'primary');

    this.spinBtn.bg
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.handleSpin());
    // Attach hover effects directly to the graphics object to leverage UITheme drawButton's internal state
    this.spinBtn.bg
      .on('pointerover', () => {
        this.spinBtn?.bg.clear();
        this.spinBtn?.bg.fillStyle(COLOR_GOLD, 0.8); // Slightly darker gold on hover
        this.spinBtn?.bg.fillRoundedRect(width/2 - 80, btnY - 25, 160, 50, BTN_PRIMARY_RADIUS);
      })
      .on('pointerout', () => {
        this.spinBtn?.bg.clear();
        this.spinBtn?.bg.fillStyle(BTN_PRIMARY_BG, 1);
        this.spinBtn?.bg.fillRoundedRect(width/2 - 80, btnY - 25, 160, 50, BTN_PRIMARY_RADIUS);
      });

    this.spinBtnLabel = this.spinBtn.text;

    // HOME
    // Home navigation handled by MasqueradeScene nav bar
  }

  // private drawBtnBg(g: Phaser.GameObjects.Graphics, hover: boolean): void {
  //   // This method is replaced by `drawButton` and its internal hover logic
  //   // Kept for reference if custom hover logic is needed outside `drawButton`
  //   g.clear();
  //   g.fillStyle(hover ? 0xddb83a : GOLD, 1);
  //   g.fillRoundedRect(-80, -25, 160, 50, 12);
  // }

  /** Full-screen flash overlay for win / free-spins announcements */
  private buildFlashOverlay(): void {
    const { width, height } = this.scene.scale;

    const dim = this.scene.add.graphics();
    dim.fillStyle(COLOR_BG, 0.65); // Use theme background color
    dim.fillRect(0, 0, width, height);

    const msg = this.scene.add.text(width / 2, height / 2, '', {
      ...TEXT_STYLE_DISPLAY,
      color:      STR_GOLD,
      stroke:     COLOR_BG.toString(16),
      strokeThickness: 8,
      align:      'center',
    }).setOrigin(0.5);

    const sub = this.scene.add.text(width / 2, height / 2 + 68, '', {
      ...TEXT_STYLE_BODY,
      fontSize:   FONT_SIZE_2XL,
      color:      STR_TEXT,
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
    g.fillStyle(COLOR_SURFACE, 0.75); // Use theme surface color
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
      g.lineStyle(2, COLOR_GOLD, 0.8);
      g.strokeCircle(half, half, half - 3);
    } else if (symbol === 'WILD') {
      g.fillStyle(col, 1);
      g.fillRoundedRect(3, 3, SYM - 6, SYM - 6, 6);
      g.lineStyle(2, COLOR_GOLD, 1);
      g.strokeRoundedRect(3, 3, SYM - 6, SYM - 6, 6);
    } else if (symbol === 'SCATTER') {
      g.fillStyle(col, 1);
      g.lineStyle(2, COLOR_BG, 1); // Dark background for scatter lines
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
      g.lineStyle(1, COLOR_BG, 0.25); // Subtle border
      g.strokeRoundedRect(3, 3, SYM - 6, SYM - 6, 7);
    }

    const isLight = symbol !== 'WILD' && symbol !== 'MASKED';
    const lbl = this.scene.add.text(half, half, SYMBOL_LABEL[symbol], {
      fontFamily: FONT_PRIMARY,
      fontSize:   symbol === 'MASKED' ? FONT_SIZE_2XL : FONT_SIZE_SM,
      color:      isLight ? COLOR_BG.toString(16) : STR_GOLD, // Text color depends on symbol background
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
    this.spinBtn?.bg.disableInteractive(); // Disable button interactive state
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
            this.spinBtn?.bg.setInteractive({ useHandCursor: true }); // Re-enable button
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

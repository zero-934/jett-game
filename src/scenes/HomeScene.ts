/**
 * @file HomeScene.ts
 * @purpose Home screen — crypto casino inspired, clean dark UI, large bold icons,
 *          Fredoka One bubble font, scrolling ticker, touch-scrollable game card list.
 * @author Agent 934
 * @date 2026-04-14
 * @license Proprietary – available for licensing
 */

import * as Phaser from 'phaser';

const GOLD     = 0xc9a84c;
const GOLD_STR = '#c9a84c';
const ICE      = 0x7ec8e3;
const ICE_STR  = '#7ec8e3';

// Header height that stays fixed (logo + tagline area)
const HEADER_H = 190;
// Bottom ticker bar height
const TICKER_H = 36;

interface CardDef {
  key: string;
  title: string;
  subtitle: string;
  accent: number;
  accentStr: string;
  drawIcon: (scene: HomeScene, x: number, y: number) => void;
}

export class HomeScene extends Phaser.Scene {
  // Scroll state
  private scrollY      = 0;
  private dragStartY   = 0;
  private dragScrollY  = 0;
  private isDragging   = false;
  private scrollVel    = 0;
  private maxScrollY   = 0;
  private scrollContainer: Phaser.GameObjects.Container | null = null;

  constructor() { super({ key: 'HomeScene' }); }

  create(): void {
    const { width, height } = this.scale;

    // ── Deep background (fixed) ────────────────────────────────────────────
    this.add.rectangle(width / 2, height / 2, width, height, 0x050508).setScrollFactor(0);

    // Subtle noise grid (fixed)
    const grid = this.add.graphics().setScrollFactor(0);
    grid.lineStyle(0.3, 0x0d0d1a, 1);
    for (let x = 0; x <= width; x += 40) {
      grid.beginPath(); grid.moveTo(x, 0); grid.lineTo(x, height); grid.strokePath();
    }
    for (let y = 0; y <= height; y += 40) {
      grid.beginPath(); grid.moveTo(0, y); grid.lineTo(width, y); grid.strokePath();
    }

    // ── Scrollable content container ──────────────────────────────────────
    this.scrollContainer = this.add.container(0, 0);

    // ── Header (inside scroll container — scrolls with content) ───────────
    this.buildHeader(width);

    // ── Game Cards ─────────────────────────────────────────────────────────
    const cards: CardDef[] = [
      {
        key: 'JettScene',
        title: 'JETT',
        subtitle: 'Dodge asteroids. Go higher.\nCash out before you combust.',
        accent: GOLD,
        accentStr: GOLD_STR,
        drawIcon: (scene, x, y) => scene.drawJetpackCard(x, y),
      },
      {
        key: 'ShatterStepScene',
        title: 'SHATTER STEP',
        subtitle: 'Pick left or right. 50/50.\nCash out before the glass breaks.',
        accent: ICE,
        accentStr: ICE_STR,
        drawIcon: (scene, x, y) => scene.drawGlassTileCard(x, y),
      },
      {
        key: 'FlapFortuneScene',
        title: 'FLAP FORTUNE',
        subtitle: 'Fly the wizard through gates.\nDive down to collect your gold.',
        accent: GOLD,
        accentStr: GOLD_STR,
        drawIcon: (scene, x, y) => scene.drawWizardCard(x, y),
      },
      {
        key: 'DiceScene',
        title: 'DICE',
        subtitle: 'Pick 2×, 5×, or 10× odds.\nRoll and win instantly.',
        accent: 0xff6644,
        accentStr: '#ff6644',
        drawIcon: (scene, x, y) => scene.drawDiceCard(x, y),
      },
      {
        key: 'MinesScene',
        title: 'MINES',
        subtitle: 'Reveal safe tiles on a 5×5 grid.\nOne wrong click ends it all.',
        accent: 0x44ffaa,
        accentStr: '#44ffaa',
        drawIcon: (scene, x, y) => scene.drawMinesCard(x, y),
      },
      {
        key: 'BallDropScene',
        title: 'BALL DROP',
        subtitle: 'Drop & nudge through the pegs.\nEdge slots pay up to ×5!',
        accent: 0xffd200,
        accentStr: '#ffd200',
        drawIcon: (scene, x, y) => scene.drawBallDropCard(x, y),
      },
      {
        key: 'AlchemistScene',
        title: 'THE ALCHEMIST',
        subtitle: '5x3 Reels · 25 Paylines\nTransmute symbols, forge your fortune!',
        accent: 0xb87333,
        accentStr: '#b87333',
        drawIcon: (scene, x, y) => scene.drawAlchemistCard(x, y),
      },
      {
        key: 'MasqueradeScene',
        title: 'MIDNIGHT MASQUERADE',
        subtitle: '5x3 Reels · 25 Paylines\nMasked fortune & free spins!',
        accent: 0x9b59b6,
        accentStr: '#9b59b6',
        drawIcon: (scene, x, y) => scene.drawMasqueradeCard(x, y),
      },
      {
        key: 'InfernoScene',
        title: 'INFERNO',
        subtitle: '3x3 Cluster Pays · Heat Meter\nCascades · Crown Flip!',
        accent: 0xff4500,
        accentStr: '#ff4500',
        drawIcon: (scene, x, y) => scene.drawInfernoCard(x, y),
      },
      {
        key: 'SurgeScene',
        title: 'SURGE',
        subtitle: '3x3 Cluster Pays · Surge Meter\nWild Reel · Crown Flip!',
        accent: 0x0055ff,
        accentStr: '#0055ff',
        drawIcon: (scene, x, y) => scene.drawSurgeCard(x, y),
      },
      {
        key: 'DiceDuelScene',
        title: 'DICE DUEL',
        subtitle: '3 Dice · You vs House\nDouble Down · 2× Win!',
        accent: 0xcc3333,
        accentStr: '#cc3333',
        drawIcon: (scene, x, y) => scene.drawDiceDuelCard(x, y),
      },
    ];

    const cardH      = 108;
    const cardW      = width * 0.9;
    const firstCardY = HEADER_H + 8;
    const gap        = 10;

    cards.forEach((card, i) => {
      this.buildCard(width / 2, firstCardY + i * (cardH + gap) + cardH / 2, cardW, cardH, card);
    });

    // Total scrollable height
    const totalContentH = firstCardY + cards.length * (cardH + gap) + 24;
    this.maxScrollY = Math.max(0, totalContentH - (height - TICKER_H));

    // ── Fixed header overlay (logo + gold bar, always on top) ─────────────
    this.buildFixedHeader(width, height);

    // ── Fixed ticker ───────────────────────────────────────────────────────
    this.buildTicker(width, height);

    // ── Touch / Mouse scroll input ─────────────────────────────────────────
    this.registerScrollInput(width, height);

    // ── Per-frame update for momentum scrolling ────────────────────────────
    this.events.on('update', this.onUpdate, this);
  }

  // ─── Header ───────────────────────────────────────────────────────────────

  private buildHeader(width: number): void {
    const logoY = 80;

    this.drawLargeJetpack(width / 2 - 72, logoY);

    const title = this.add.text(width / 2 - 42, logoY - 18, 'JETT', {
      fontFamily: '"Fredoka One", sans-serif',
      fontSize: '54px',
      color: GOLD_STR,
    }).setOrigin(0, 0);

    const subtitle = this.add.text(width / 2 - 40, logoY + 38, '.GAME', {
      fontFamily: '"Fredoka One", sans-serif',
      fontSize: '20px',
      color: '#cccccc',
    }).setOrigin(0, 0);

    const tagline = this.add.text(width / 2, 158, 'SKILL  ·  STRATEGY  ·  REWARD', {
      fontFamily: '"Fredoka", sans-serif',
      fontSize: '12px',
      color: '#383848',
      letterSpacing: 3,
    }).setOrigin(0.5);

    const divG = this.add.graphics();
    divG.lineStyle(1, 0x16161e, 1);
    divG.beginPath();
    divG.moveTo(width * 0.08, HEADER_H - 2);
    divG.lineTo(width * 0.92, HEADER_H - 2);
    divG.strokePath();

    this.scrollContainer?.add([title, subtitle, tagline, divG]);
  }

  private buildFixedHeader(width: number, _height: number): void {
    // Gold top accent bar — fixed, always on top
    const topBar = this.add.graphics().setDepth(20).setScrollFactor(0);
    topBar.fillStyle(GOLD, 1);
    topBar.fillRect(0, 0, width, 3);
    topBar.fillGradientStyle(GOLD, GOLD, 0x050508, 0x050508, 0.15, 0.15, 0, 0);
    topBar.fillRect(0, 3, width, 28);

    // Fade overlay at bottom of card list (above ticker)
    const fadeBar = this.add.graphics().setDepth(20).setScrollFactor(0);
    const fadeY = _height - TICKER_H - 40;
    fadeBar.fillGradientStyle(0x050508, 0x050508, 0x050508, 0x050508, 0, 0, 0.95, 0.95);
    fadeBar.fillRect(0, fadeY, width, 40);
  }

  // ─── Card builder ─────────────────────────────────────────────────────────

  private buildCard(cx: number, cy: number, w: number, h: number, card: CardDef): void {
    const x = cx - w / 2;
    const y = cy - h / 2;
    const r = 14;

    const bg = this.add.graphics();
    this.paintCard(bg, cx, cy, w, h, card.accent, false);

    // Invisible hit rect — must be in the scene (not container) for pointer events with scroll
    const hit = this.add.rectangle(cx, cy, w, h, 0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => {
        // Only navigate if we weren't dragging
        if (!this.isDragging && Math.abs(this.scrollVel) < 1) {
          this.scene.start(card.key);
        }
      })
      .on('pointerover', () => { if (!this.isDragging) this.paintCard(bg, cx, cy, w, h, card.accent, true); })
      .on('pointerout',  () => this.paintCard(bg, cx, cy, w, h, card.accent, false));

    // Left accent strip
    const strip = this.add.graphics();
    strip.fillStyle(card.accent, 1);
    strip.fillRect(x + 1, y + r, 4, h - r * 2);

    // Icon
    const iconX = cx + w / 2 - 52;
    card.drawIcon(this, iconX, cy);

    // Title
    const titleText = this.add.text(x + 22, cy - 22, card.title, {
      fontFamily: '"Fredoka One", sans-serif',
      fontSize: '20px',
      color: card.accentStr,
    }).setOrigin(0, 0.5);

    // Subtitle
    const subText = this.add.text(x + 22, cy + 14, card.subtitle, {
      fontFamily: '"Fredoka", sans-serif',
      fontSize: '12px',
      color: '#4a4a60',
      lineSpacing: 4,
    }).setOrigin(0, 0.5);

    // Arrow
    const arrow = this.add.text(cx + w / 2 - 16, cy, '›', {
      fontFamily: '"Fredoka One", sans-serif',
      fontSize: '28px',
      color: '#2a2a3a',
    }).setOrigin(0.5);

    this.scrollContainer?.add([bg, hit, strip, titleText, subText, arrow]);
  }

  private paintCard(g: Phaser.GameObjects.Graphics, cx: number, cy: number, w: number, h: number, accent: number, hovered: boolean): void {
    g.clear();
    g.fillStyle(hovered ? 0x0c0c18 : 0x080812, 1);
    g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 14);
    g.lineStyle(1, accent, hovered ? 0.5 : 0.12);
    g.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 14);
    if (hovered) {
      g.fillStyle(accent, 0.04);
      g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h * 0.5, 14);
    }
  }

  // ─── Scroll Input ─────────────────────────────────────────────────────────

  private registerScrollInput(width: number, height: number): void {
    // Touch / mouse drag
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.isDragging   = false;
      this.dragStartY   = p.y;
      this.dragScrollY  = this.scrollY;
      this.scrollVel    = 0;
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown) return;
      const dy = this.dragStartY - p.y;
      if (Math.abs(dy) > 5) this.isDragging = true;
      if (this.isDragging) {
        this.scrollY  = Phaser.Math.Clamp(this.dragScrollY + dy, 0, this.maxScrollY);
        this.scrollVel = p.velocity.y * -0.016; // carry velocity for momentum
      }
    });

    this.input.on('pointerup', () => {
      // Momentum handled in onUpdate
      this.time.delayedCall(50, () => { this.isDragging = false; });
    });

    // Mouse wheel
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _gos: unknown, _dx: number, dy: number) => {
      this.scrollY   = Phaser.Math.Clamp(this.scrollY + dy * 0.5, 0, this.maxScrollY);
      this.scrollVel = 0;
    });

    // Prevent unused var warning
    void width; void height;
  }

  private onUpdate(): void {
    // Momentum scrolling
    if (!this.isDragging && Math.abs(this.scrollVel) > 0.1) {
      this.scrollY   = Phaser.Math.Clamp(this.scrollY + this.scrollVel * 16, 0, this.maxScrollY);
      this.scrollVel *= 0.92; // friction
    } else if (!this.isDragging) {
      this.scrollVel = 0;
    }

    // Apply scroll to container
    if (this.scrollContainer) {
      this.scrollContainer.y = -this.scrollY;
    }
  }

  // ─── Icons ────────────────────────────────────────────────────────────────

  private drawLargeJetpack(cx: number, cy: number): void {
    const g = this.add.graphics();
    this.paintJetpack(g, cx, cy, 1.6);
    this.scrollContainer?.add(g);
  }

  drawJetpackCard(cx: number, cy: number): void {
    const g = this.add.graphics();
    this.paintJetpack(g, cx, cy, 1.1);
    this.scrollContainer?.add(g);
  }

  private paintJetpack(g: Phaser.GameObjects.Graphics, cx: number, cy: number, s: number): void {
    g.fillStyle(0x2a3a6a, 1);
    g.fillRoundedRect(cx - 11 * s, cy - 18 * s, 22 * s, 30 * s, 5 * s);
    g.fillStyle(0x4466aa, 0.6);
    g.fillRoundedRect(cx - 8 * s, cy - 16 * s, 8 * s, 12 * s, 3 * s);
    g.fillStyle(0x1a2a50, 1);
    g.fillRoundedRect(cx - 18 * s, cy - 10 * s, 8 * s, 20 * s, 3 * s);
    g.fillRoundedRect(cx + 10 * s,  cy - 10 * s, 8 * s, 20 * s, 3 * s);
    g.fillStyle(0x8899bb, 1);
    g.fillRect(cx - 17 * s, cy + 10 * s, 6 * s, 4 * s);
    g.fillRect(cx + 11 * s,  cy + 10 * s, 6 * s, 4 * s);
    g.fillRect(cx - 7 * s,  cy + 12 * s, 14 * s, 4 * s);
    g.fillStyle(0xff6600, 0.95);
    g.fillTriangle(cx - 17 * s, cy + 14 * s, cx - 11 * s, cy + 14 * s, cx - 14 * s, cy + 26 * s);
    g.fillStyle(GOLD, 0.9);
    g.fillTriangle(cx - 16 * s, cy + 14 * s, cx - 12 * s, cy + 14 * s, cx - 14 * s, cy + 22 * s);
    g.fillStyle(0xff6600, 0.95);
    g.fillTriangle(cx + 11 * s, cy + 14 * s, cx + 17 * s, cy + 14 * s, cx + 14 * s, cy + 26 * s);
    g.fillStyle(GOLD, 0.9);
    g.fillTriangle(cx + 12 * s, cy + 14 * s, cx + 16 * s, cy + 14 * s, cx + 14 * s, cy + 22 * s);
    g.fillStyle(0xff6600, 0.9);
    g.fillTriangle(cx - 6 * s, cy + 16 * s, cx + 6 * s, cy + 16 * s, cx, cy + 30 * s);
    g.fillStyle(GOLD, 1);
    g.fillTriangle(cx - 3 * s, cy + 16 * s, cx + 3 * s, cy + 16 * s, cx, cy + 24 * s);
    g.fillStyle(GOLD, 0.9);
    g.fillCircle(cx, cy, 5 * s);
    g.fillStyle(0xffffff, 0.6);
    g.fillCircle(cx, cy, 2.5 * s);
    g.lineStyle(1.5 * s, 0x6677aa, 0.7);
    g.beginPath(); g.moveTo(cx - 11 * s, cy - 10 * s); g.lineTo(cx - 18 * s, cy - 10 * s); g.strokePath();
    g.beginPath(); g.moveTo(cx + 11 * s, cy - 10 * s); g.lineTo(cx + 18 * s, cy - 10 * s); g.strokePath();
  }

  drawGlassTileCard(cx: number, cy: number): void {
    const g = this.add.graphics();
    const tw = 52; const th = 44;
    g.fillStyle(ICE, 0.06);
    g.fillRoundedRect(cx - tw / 2 - 4, cy - th / 2 - 4, tw + 8, th + 8, 10);
    g.fillStyle(0xaaddff, 0.10);
    g.fillRoundedRect(cx - tw / 2, cy - th / 2, tw, th, 8);
    g.lineStyle(1.5, ICE, 0.8);
    g.strokeRoundedRect(cx - tw / 2, cy - th / 2, tw, th, 8);
    g.fillStyle(0xffffff, 0.2);
    g.fillRoundedRect(cx - tw / 2 + 4, cy - th / 2 + 3, tw - 8, th * 0.28, 4);
    g.fillStyle(0xffffff, 0.12);
    g.fillCircle(cx + tw / 2 - 7, cy + th / 2 - 6, 5);
    g.lineStyle(1.2, 0xffffff, 0.9);
    g.beginPath(); g.moveTo(cx - 4, cy - th * 0.38); g.lineTo(cx + 8, cy + 2); g.lineTo(cx - 2, cy + th * 0.38); g.strokePath();
    g.lineStyle(0.8, 0xffffff, 0.6);
    g.beginPath(); g.moveTo(cx + 8, cy + 2); g.lineTo(cx + 18, cy - 4); g.strokePath();
    g.beginPath(); g.moveTo(cx + 8, cy + 2); g.lineTo(cx + 14, cy + 12); g.strokePath();
    const fy = cy - th / 2 - 2;
    g.fillStyle(ICE, 1);
    g.fillCircle(cx - 14, fy - 7, 4);
    g.fillRect(cx - 16, fy - 3, 4, 10);
    g.lineStyle(1.5, ICE, 1);
    g.beginPath(); g.moveTo(cx - 14, fy + 7); g.lineTo(cx - 10, fy + 12); g.strokePath();
    g.beginPath(); g.moveTo(cx - 14, fy + 7); g.lineTo(cx - 18, fy + 12); g.strokePath();
    g.fillStyle(GOLD, 1);
    g.fillCircle(cx - 6, fy - 2, 6);
    g.fillRect(cx - 8, fy - 9, 4, 5);
    g.fillStyle(0x0d0d0d, 1);
    g.fillRect(cx - 8, fy - 4, 4, 1);
    g.fillRect(cx - 8, fy - 2, 4, 1);
    g.fillRect(cx - 7, fy - 5, 2, 5);
    g.lineStyle(1.5, ICE, 1);
    g.beginPath(); g.moveTo(cx - 13, fy); g.lineTo(cx - 7, fy - 1); g.strokePath();
    this.scrollContainer?.add(g);
  }

  drawWizardCard(cx: number, cy: number): void {
    const g = this.add.graphics();
    g.fillStyle(0x9b7928, 1);
    g.fillRoundedRect(cx - 26, cy + 8, 52, 6, 3);
    for (let i = 0; i < 6; i++) { g.fillStyle(0xc4982a, 0.8); g.fillRect(cx + 14 + i * 4, cy + 9, 3, 10 + (i % 2) * 4); }
    g.fillStyle(0x5511aa, 1);
    g.fillTriangle(cx - 10, cy + 8, cx + 10, cy + 8, cx + 7, cy - 10);
    g.fillTriangle(cx - 10, cy + 8, cx - 7, cy - 10, cx + 7, cy - 10);
    g.fillStyle(0x7722cc, 0.5);
    g.fillTriangle(cx - 5, cy + 8, cx + 5, cy + 8, cx + 3, cy - 6);
    g.fillStyle(GOLD, 0.8); g.fillRect(cx - 8, cy - 2, 16, 3);
    g.fillStyle(0xf5c08a, 1); g.fillCircle(cx, cy - 16, 9);
    g.fillStyle(0x333333, 1); g.fillCircle(cx - 3, cy - 17, 1.5); g.fillCircle(cx + 3, cy - 17, 1.5);
    g.fillStyle(0xffffff, 0.8); g.fillTriangle(cx - 4, cy - 10, cx + 4, cy - 10, cx, cy - 5);
    g.fillStyle(0x330a66, 1); g.fillTriangle(cx - 11, cy - 24, cx + 11, cy - 24, cx, cy - 48);
    g.fillStyle(0x440d88, 1); g.fillRoundedRect(cx - 13, cy - 26, 26, 6, 3);
    g.fillStyle(GOLD, 0.9); g.fillRect(cx - 10, cy - 25, 20, 3);
    g.fillStyle(GOLD, 1);
    g.fillCircle(cx - 4, cy - 36, 2); g.fillCircle(cx + 5, cy - 32, 1.5); g.fillCircle(cx, cy - 42, 1.5);
    g.fillStyle(0xffffff, 1); g.fillRect(cx - 20, cy - 4, 12, 2);
    g.fillStyle(GOLD, 1); g.fillCircle(cx - 20, cy - 3, 3);
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(cx - 25, cy - 8, 1.5); g.fillCircle(cx - 27, cy - 2, 1); g.fillCircle(cx - 23, cy - 12, 1);
    this.scrollContainer?.add(g);
  }

  drawDiceCard(cx: number, cy: number): void {
    const g = this.add.graphics();
    const s = 0.9;
    const drawDie = (x: number, y: number, val: number) => {
      g.fillStyle(0x1a0808, 1);
      g.fillRoundedRect(x - 14 * s, y - 14 * s, 28 * s, 28 * s, 5 * s);
      g.lineStyle(1.5, 0xff6644, 0.8);
      g.strokeRoundedRect(x - 14 * s, y - 14 * s, 28 * s, 28 * s, 5 * s);
      g.fillStyle(0xff6644, 1);
      const dots: [number, number][] = [];
      if (val >= 1) dots.push([0, 0]);
      if (val >= 2) { dots.push([-6 * s, -6 * s]); dots.push([6 * s, 6 * s]); }
      if (val >= 4) { dots.push([6 * s, -6 * s]); dots.push([-6 * s, 6 * s]); }
      if (val === 6) { dots.push([-6 * s, 0]); dots.push([6 * s, 0]); }
      for (const [dx, dy] of dots) g.fillCircle(x + dx, y + dy, 3 * s);
    };
    drawDie(cx - 22, cy, 6); drawDie(cx, cy - 8, 4); drawDie(cx + 22, cy + 6, 2);
    this.scrollContainer?.add(g);
  }

  drawBallDropCard(cx: number, cy: number): void {
    const g = this.add.graphics();
    const pegPositions: [number, number][] = [
      [cx - 18, cy - 14], [cx, cy - 14], [cx + 18, cy - 14],
      [cx - 9,  cy - 2 ], [cx + 9,  cy - 2 ],
      [cx - 18, cy + 10], [cx,      cy + 10], [cx + 18, cy + 10],
    ];
    g.fillStyle(0x6677aa, 1);
    for (const [px, py] of pegPositions) g.fillCircle(px, py, 3);
    g.fillStyle(0xc0392b, 1); g.fillCircle(cx - 4, cy - 20, 6);
    g.fillStyle(0xf7971e, 1); g.fillCircle(cx - 4, cy - 20, 4);
    g.fillStyle(0xffe066, 1); g.fillCircle(cx - 6, cy - 22, 2);
    const slotColors = [0xe74c3c, 0xffd200, 0xe74c3c];
    for (let i = 0; i < 3; i++) {
      const sx = cx - 20 + i * 20;
      g.fillStyle(slotColors[i], 0.25); g.fillRect(sx - 8, cy + 16, 16, 10);
      g.lineStyle(1, slotColors[i], 0.9); g.strokeRect(sx - 8, cy + 16, 16, 10);
    }
    this.scrollContainer?.add(g);
  }

  drawMinesCard(cx: number, cy: number): void {
    const g = this.add.graphics();
    const s = 0.85;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const tx = cx - 20 * s + c * 20 * s;
        const ty = cy - 20 * s + r * 20 * s;
        const isBomb = r === 1 && c === 1;
        g.fillStyle(isBomb ? 0x1a0808 : 0x080818, 1);
        g.fillRoundedRect(tx - 8 * s, ty - 8 * s, 16 * s, 16 * s, 3 * s);
        g.lineStyle(1, 0x44ffaa, isBomb ? 0.9 : 0.25);
        g.strokeRoundedRect(tx - 8 * s, ty - 8 * s, 16 * s, 16 * s, 3 * s);
        if (isBomb) {
          g.fillStyle(0x44ffaa, 0.8); g.fillCircle(tx, ty, 5 * s);
          g.lineStyle(1.5, 0x44ffaa, 0.9);
          g.beginPath(); g.moveTo(tx, ty - 5 * s); g.lineTo(tx + 4 * s, ty - 9 * s); g.strokePath();
          g.fillCircle(tx + 4 * s, ty - 9 * s, 2 * s);
        }
      }
    }
    this.scrollContainer?.add(g);
  }

  // ─── Fixed ticker ────────────────────────────────────────────────────────

  private buildTicker(width: number, height: number): void {
    const ty   = height - TICKER_H / 2;
    const barH = TICKER_H;
    const msg  = '  ✦  JETT.GAME  ·  SKILL  ·  STRATEGY  ·  REWARD  ✦  COMING SOON  ·  ';

    const bar = this.add.graphics().setScrollFactor(0).setDepth(20);
    bar.fillStyle(0x050508, 1);
    bar.fillRect(0, height - barH, width, barH);
    bar.fillStyle(GOLD, 0.08);
    bar.fillRect(0, height - barH, width, barH);
    bar.lineStyle(1, GOLD, 0.3);
    bar.beginPath(); bar.moveTo(0, height - barH); bar.lineTo(width, height - barH); bar.strokePath();

    const maskShape = this.add.graphics().setScrollFactor(0).setDepth(19);
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(0, height - barH, width, barH);
    const geomMask = maskShape.createGeometryMask();

    const container = this.add.container(0, ty).setScrollFactor(0).setDepth(21).setMask(geomMask);
    const items: Phaser.GameObjects.Text[] = [];
    let totalW = 0;

    while (totalW < width * 2.5) {
      const t = this.add.text(totalW, 0, msg, {
        fontFamily: '"Fredoka One", sans-serif',
        fontSize: '12px',
        color: GOLD_STR,
      }).setOrigin(0, 0.5);
      container.add(t);
      items.push(t);
      totalW += t.width;
    }

    this.time.addEvent({
      delay: 16, loop: true,
      callback: () => {
        for (const item of items) item.x -= 1.3;
        const first = items[0];
        const last  = items[items.length - 1];
        if (first.x + first.width < 0) {
          first.x = last.x + last.width;
          items.push(items.shift()!);
        }
      },
    });
  }

  drawAlchemistCard(cx: number, cy: number): void {
    const g = this.add.graphics();
    const s = 1.0;
    // Cauldron base
    g.fillStyle(0x5c4033, 1);
    g.fillEllipse(cx, cy + 10 * s, 50 * s, 22 * s);
    g.fillRect(cx - 20 * s, cy - 10 * s, 40 * s, 20 * s);
    // Bubbles
    g.fillStyle(0xb87333, 0.8);
    g.fillCircle(cx - 8 * s, cy - 14 * s, 5 * s);
    g.fillCircle(cx + 6 * s, cy - 18 * s, 4 * s);
    g.fillCircle(cx, cy - 22 * s, 6 * s);
    // Gold glow
    g.fillStyle(0xc9a84c, 0.4);
    g.fillCircle(cx, cy, 28 * s);
    // Legs
    g.fillStyle(0x4a3020, 1);
    g.fillRect(cx - 18 * s, cy + 18 * s, 6 * s, 8 * s);
    g.fillRect(cx + 12 * s, cy + 18 * s, 6 * s, 8 * s);
    this.scrollContainer?.add(g);
  }

  drawMasqueradeCard(cx: number, cy: number): void {
    const g = this.add.graphics();
    const s = 1.0;
    // Purple mask shape
    g.fillStyle(0x9b59b6, 1);
    g.fillEllipse(cx, cy, 52 * s, 32 * s);
    // Eye holes
    g.fillStyle(0x1a0033, 1);
    g.fillEllipse(cx - 12 * s, cy, 10 * s, 14 * s);
    g.fillEllipse(cx + 12 * s, cy, 10 * s, 14 * s);
    // Gold trim
    g.lineStyle(2 * s, 0xc9a84c, 1);
    g.strokeEllipse(cx, cy, 52 * s, 32 * s);
    // Feather
    g.fillStyle(0xc9a84c, 1);
    g.fillTriangle(cx + 24 * s, cy - 6 * s, cx + 34 * s, cy - 20 * s, cx + 28 * s, cy - 2 * s);
    this.scrollContainer?.add(g);
  }

  drawInfernoCard(cx: number, cy: number): void {
    const g = this.add.graphics();
    // Flame body
    g.fillStyle(0xff4500, 1);
    g.fillTriangle(cx, cy - 22, cx - 14, cy + 10, cx + 14, cy + 10);
    // Inner flame
    g.fillStyle(0xffaa00, 1);
    g.fillTriangle(cx, cy - 12, cx - 7, cy + 8, cx + 7, cy + 8);
    // Core
    g.fillStyle(0xffff88, 1);
    g.fillCircle(cx, cy + 2, 4);
    // Gold ember sparks
    g.fillStyle(0xc9a84c, 1);
    g.fillCircle(cx - 16, cy - 8, 2);
    g.fillCircle(cx + 18, cy - 4, 2);
    g.fillCircle(cx + 8, cy - 20, 2);
    this.scrollContainer?.add(g);
  }

  drawDiceDuelCard(cx: number, cy: number): void {
    const g = this.add.graphics();
    // Two dice side by side
    const diceSize = 18;
    // Die 1
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(cx - 22, cy - 12, diceSize, diceSize, 3);
    g.lineStyle(1.5, 0xc9a84c, 1);
    g.strokeRoundedRect(cx - 22, cy - 12, diceSize, diceSize, 3);
    g.fillStyle(0x080812, 1);
    g.fillCircle(cx - 16, cy - 6, 2.5);
    g.fillCircle(cx - 10, cy, 2.5);
    g.fillCircle(cx - 16, cy + 2, 2.5);
    // Die 2
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(cx + 4, cy - 12, diceSize, diceSize, 3);
    g.lineStyle(1.5, 0xc9a84c, 1);
    g.strokeRoundedRect(cx + 4, cy - 12, diceSize, diceSize, 3);
    g.fillStyle(0x080812, 1);
    g.fillCircle(cx + 10, cy - 6, 2.5);
    g.fillCircle(cx + 16, cy - 6, 2.5);
    g.fillCircle(cx + 10, cy + 2, 2.5);
    g.fillCircle(cx + 16, cy + 2, 2.5);
    // VS in between
    this.add.text(cx - 3, cy - 3, 'VS', { fontFamily: 'Arial', fontSize: '8px', color: '#cc3333', fontStyle: 'bold' }).setOrigin(0.5);
    this.scrollContainer?.add(g);
  }

  drawSurgeCard(cx: number, cy: number): void {
    const g = this.add.graphics();
    // Lightning bolt
    g.fillStyle(0x0055ff, 1);
    g.fillTriangle(cx - 4, cy - 22, cx + 10, cy - 2, cx + 2, cy - 2);
    g.fillTriangle(cx - 10, cy + 2, cx + 4, cy + 22, cx - 2, cy + 2);
    // Gold highlight
    g.lineStyle(2, 0xc9a84c, 1);
    g.strokeTriangle(cx - 4, cy - 22, cx + 10, cy - 2, cx + 2, cy - 2);
    // Spark dots
    g.fillStyle(0xc9a84c, 1);
    g.fillCircle(cx - 18, cy - 6, 2);
    g.fillCircle(cx + 18, cy + 4, 2);
    g.fillCircle(cx - 6, cy + 20, 2);
    this.scrollContainer?.add(g);
  }

  shutdown(): void {
    this.events.off('update', this.onUpdate, this);
  }
}

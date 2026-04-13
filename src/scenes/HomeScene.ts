/**
 * @file HomeScene.ts
 * @purpose Home screen — bold bubble font, drawn icons (jetpack, glass tile, wizard),
 *          scrolling ticker banner, futuristic clean layout.
 * @author Agent 934
 * @date 2026-04-12
 * @license Proprietary – available for licensing
 */

import * as Phaser from 'phaser';

const GOLD       = 0xc9a84c;
const GOLD_STR   = '#c9a84c';
const ICE_STR    = '#88ccff';
const ICE        = 0x88ccff;
const WHITE_STR  = '#ffffff';
const DIM_STR    = '#444455';
const DARK_BG    = 0x080810;

interface CardDef {
  key: string;
  title: string;
  subtitle: string;
  accentColor: number;
  accentStr: string;
  drawIcon: (g: Phaser.GameObjects.Graphics, cx: number, cy: number) => void;
}

export class HomeScene extends Phaser.Scene {
  private bannerGroup: Phaser.GameObjects.Container | null = null;
  private bannerItems: Phaser.GameObjects.Text[] = [];


  constructor() {
    super({ key: 'HomeScene' });
  }

  create(): void {
    const { width, height } = this.scale;

    // ── Background ──────────────────────────────────────────────────────────
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000);

    // Grid
    const grid = this.add.graphics();
    grid.lineStyle(0.4, 0x111120, 1);
    for (let x = 0; x <= width; x += 44) {
      grid.beginPath(); grid.moveTo(x, 0); grid.lineTo(x, height); grid.strokePath();
    }
    for (let y = 0; y <= height; y += 44) {
      grid.beginPath(); grid.moveTo(0, y); grid.lineTo(width, y); grid.strokePath();
    }

    // Top gold glow bar
    const topBar = this.add.graphics();
    topBar.fillStyle(GOLD, 1);
    topBar.fillRect(0, 0, width, 3);
    topBar.fillStyle(GOLD, 0.07);
    topBar.fillRect(0, 0, width, 30);

    // ── Logo ────────────────────────────────────────────────────────────────
    // Jetpack icon (drawn)
    const logoIcon = this.add.graphics();
    this.drawJetpackIcon(logoIcon, width / 2 - 80, height * 0.09, 38);

    // JETT.GAME wordmark
    this.add.text(width / 2 - 30, height * 0.068, 'JETT', {
      fontFamily: '"Fredoka One", monospace',
      fontSize: '52px',
      color: GOLD_STR,
    }).setOrigin(0, 0.5);

    this.add.text(width / 2 - 30, height * 0.123, '.GAME', {
      fontFamily: '"Fredoka One", monospace',
      fontSize: '22px',
      color: WHITE_STR,
    }).setOrigin(0, 0.5);

    // Tagline
    this.add.text(width / 2, height * 0.175, 'SKILL · STRATEGY · REWARD', {
      fontFamily: '"Fredoka", monospace',
      fontSize: '11px',
      color: DIM_STR,
      letterSpacing: 3,
    }).setOrigin(0.5);

    // Divider
    const div = this.add.graphics();
    div.lineStyle(1, 0x1e1e30, 1);
    div.beginPath();
    div.moveTo(width * 0.1, height * 0.205);
    div.lineTo(width * 0.9, height * 0.205);
    div.strokePath();

    // ── Cards ────────────────────────────────────────────────────────────────
    const cards: CardDef[] = [
      {
        key: 'JettScene',
        title: 'JETT',
        subtitle: 'Dodge asteroids with your jetpack.\nHigher altitude = bigger reward.',
        accentColor: GOLD,
        accentStr: GOLD_STR,
        drawIcon: (g, cx, cy) => this.drawJetpackIcon(g, cx, cy, 22),
      },
      {
        key: 'ShatterStepScene',
        title: 'SHATTER STEP',
        subtitle: 'Pick a tile. 50/50 odds.\nCash out before the glass breaks.',
        accentColor: ICE,
        accentStr: ICE_STR,
        drawIcon: (g, cx, cy) => this.drawShatterIcon(g, cx, cy, 22),
      },
      {
        key: 'FlapFortuneScene',
        title: 'FLAP FORTUNE',
        subtitle: 'Wizard through the gates.\nDive to collect your winnings.',
        accentColor: GOLD,
        accentStr: GOLD_STR,
        drawIcon: (g, cx, cy) => this.drawWizardIcon(g, cx, cy, 22),
      },
    ];

    const cardH      = 132;
    const cardW      = width * 0.9;
    const firstCardY = height * 0.295;
    const spacing    = cardH + 13;

    cards.forEach((card, i) => {
      this.buildCard(width / 2, firstCardY + i * spacing, cardW, cardH, card);
    });

    // ── Scrolling banner ─────────────────────────────────────────────────────
    this.buildScrollingBanner(width, height);

    // ── Footer ───────────────────────────────────────────────────────────────
    this.add.text(width / 2, height * 0.972, 'v0.1  prototype', {
      fontFamily: '"Fredoka", monospace',
      fontSize: '10px',
      color: '#222233',
    }).setOrigin(0.5);
  }

  // ─── Scrolling Banner ────────────────────────────────────────────────────

  private buildScrollingBanner(width: number, height: number): void {
    const bannerY  = height * 0.932;
    const bannerH  = 28;

    // Banner background
    const bannerBg = this.add.graphics();
    bannerBg.fillStyle(GOLD, 0.1);
    bannerBg.fillRect(0, bannerY - bannerH / 2, width, bannerH);
    bannerBg.lineStyle(1, GOLD, 0.35);
    bannerBg.beginPath();
    bannerBg.moveTo(0, bannerY - bannerH / 2);
    bannerBg.lineTo(width, bannerY - bannerH / 2);
    bannerBg.strokePath();
    bannerBg.beginPath();
    bannerBg.moveTo(0, bannerY + bannerH / 2);
    bannerBg.lineTo(width, bannerY + bannerH / 2);
    bannerBg.strokePath();

    // Mask so text clips at edges
    const mask = this.add.graphics();
    mask.fillStyle(0xffffff, 1);
    mask.fillRect(0, bannerY - bannerH / 2, width, bannerH);
    const geomMask = mask.createGeometryMask();

    // Banner text — repeat to fill width
    const message = '  ✦  JETT.GAME  —  WORLD\'S FIRST CRYPTO SKILL GAME  ';
    this.bannerGroup = this.add.container(0, bannerY).setMask(geomMask);

    let totalWidth = 0;
    this.bannerItems = [];

    for (let repeat = 0; repeat < 3; repeat++) {
      const txt = this.add.text(totalWidth, 0, message, {
        fontFamily: '"Fredoka One", monospace',
        fontSize: '13px',
        color: GOLD_STR,
        letterSpacing: 1,
      }).setOrigin(0, 0.5);

      this.bannerGroup.add(txt);
      this.bannerItems.push(txt);
      totalWidth += txt.width;
    }

    // Animate scroll
    this.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        if (!this.bannerGroup || !this.bannerItems.length) return;
        const speed = 1.2;
        for (const item of this.bannerItems) {
          item.x -= speed;
        }
        // Recycle first item when it scrolls off-screen
        const first = this.bannerItems[0];
        const last  = this.bannerItems[this.bannerItems.length - 1];
        if (first.x + first.width < 0) {
          first.x = last.x + last.width;
          this.bannerItems.push(this.bannerItems.shift()!);
        }
      },
    });
  }

  // ─── Card ─────────────────────────────────────────────────────────────────

  private buildCard(
    cx: number, cy: number, w: number, h: number, card: CardDef
  ): void {
    const x = cx - w / 2;
    const y = cy - h / 2;
    const r = 12;

    const bg = this.add.graphics();
    this.drawCardBg(bg, cx, cy, w, h, card.accentColor, false);

    const hit = this.add
      .rectangle(cx, cy, w, h, 0x000000, 0)
      .setInteractive({ useHandCursor: true });

    // Left accent bar
    const bar = this.add.graphics();
    bar.fillStyle(card.accentColor, 1);
    bar.fillRect(x + 1, y + r, 3, h - r * 2);

    // Drawn icon
    const iconG = this.add.graphics();
    card.drawIcon(iconG, x + 36, cy);

    // Title
    this.add.text(x + 62, cy - 24, card.title, {
      fontFamily: '"Fredoka One", monospace',
      fontSize: '20px',
      color: card.accentStr,
    }).setOrigin(0, 0.5);

    // Subtitle
    this.add.text(x + 62, cy + 14, card.subtitle, {
      fontFamily: '"Fredoka", monospace',
      fontSize: '11px',
      color: '#555566',
      lineSpacing: 4,
    }).setOrigin(0, 0.5);

    // Arrow
    this.add.text(cx + w / 2 - 18, cy, '›', {
      fontFamily: '"Fredoka One", monospace',
      fontSize: '26px',
      color: '#333344',
    }).setOrigin(0.5);

    hit.on('pointerover', () => this.drawCardBg(bg, cx, cy, w, h, card.accentColor, true));
    hit.on('pointerout',  () => this.drawCardBg(bg, cx, cy, w, h, card.accentColor, false));
    hit.on('pointerdown', () => this.scene.start(card.key));
  }

  private drawCardBg(
    g: Phaser.GameObjects.Graphics,
    cx: number, cy: number, w: number, h: number,
    accent: number, hovered: boolean
  ): void {
    g.clear();
    const x = cx - w / 2;
    const y = cy - h / 2;
    g.fillStyle(hovered ? 0x0e0e1c : DARK_BG, 1);
    g.fillRoundedRect(x, y, w, h, 12);
    g.lineStyle(1, accent, hovered ? 0.45 : 0.1);
    g.strokeRoundedRect(x, y, w, h, 12);
    if (hovered) {
      g.fillStyle(accent, 0.04);
      g.fillRoundedRect(x, y, w, h * 0.45, 12);
    }
  }

  // ─── Icons ────────────────────────────────────────────────────────────────

  /**
   * Draws a clean jetpack + stick figure icon.
   *
   * @param g - Graphics object to draw on.
   * @param cx - Center X.
   * @param cy - Center Y.
   * @param scale - Base scale unit.
   */
  private drawJetpackIcon(
    g: Phaser.GameObjects.Graphics,
    cx: number, cy: number,
    scale: number = 22
  ): void {
    const s = scale / 22;
    g.clear();

    // Jetpack body (rounded rect behind figure)
    g.fillStyle(0x4455aa, 1);
    g.fillRoundedRect(cx + 4 * s, cy - 12 * s, 10 * s, 20 * s, 3 * s);

    // Jetpack nozzle
    g.fillStyle(0x8899cc, 1);
    g.fillRect(cx + 6 * s, cy + 8 * s, 3 * s, 5 * s);
    g.fillRect(cx + 11 * s, cy + 8 * s, 3 * s, 5 * s);

    // Flame
    g.fillStyle(GOLD, 0.9);
    g.fillTriangle(
      cx + 6 * s,  cy + 13 * s,
      cx + 9 * s,  cy + 13 * s,
      cx + 7.5 * s, cy + 20 * s
    );
    g.fillStyle(0xff6600, 0.8);
    g.fillTriangle(
      cx + 11 * s, cy + 13 * s,
      cx + 14 * s, cy + 13 * s,
      cx + 12.5 * s, cy + 20 * s
    );

    // Stick figure head
    g.fillStyle(GOLD, 1);
    g.fillCircle(cx, cy - 14 * s, 5 * s);

    // Body
    g.fillStyle(GOLD, 1);
    g.fillRect(cx - 2 * s, cy - 9 * s, 4 * s, 14 * s);

    // Arms
    g.lineStyle(2 * s, GOLD, 1);
    g.beginPath(); g.moveTo(cx - 2 * s, cy - 6 * s); g.lineTo(cx - 7 * s, cy - 2 * s); g.strokePath();
    g.beginPath(); g.moveTo(cx + 2 * s, cy - 6 * s); g.lineTo(cx + 4 * s, cy - 2 * s); g.strokePath();

    // Legs
    g.beginPath(); g.moveTo(cx - 1 * s, cy + 5 * s); g.lineTo(cx - 5 * s, cy + 12 * s); g.strokePath();
    g.beginPath(); g.moveTo(cx + 1 * s, cy + 5 * s); g.lineTo(cx + 4 * s, cy + 12 * s); g.strokePath();
  }

  /**
   * Draws a glass tile with crack and stick figure holding a money bag.
   *
   * @param g - Graphics object to draw on.
   * @param cx - Center X.
   * @param cy - Center Y.
   * @param scale - Base scale unit.
   */
  private drawShatterIcon(
    g: Phaser.GameObjects.Graphics,
    cx: number, cy: number,
    scale: number = 22
  ): void {
    const s  = scale / 22;
    const tw = 36 * s;
    const th = 28 * s;
    g.clear();

    // Glass tile
    g.fillStyle(0x88ccee, 0.18);
    g.fillRoundedRect(cx - tw / 2, cy - th / 2, tw, th, 4 * s);
    g.lineStyle(1.5, 0xaaddff, 0.7);
    g.strokeRoundedRect(cx - tw / 2, cy - th / 2, tw, th, 4 * s);

    // Shine
    g.fillStyle(0xffffff, 0.18);
    g.fillRoundedRect(cx - tw / 2 + 3 * s, cy - th / 2 + 2 * s, tw - 6 * s, th * 0.3, 2 * s);

    // Crack
    g.lineStyle(1.2, 0xffffff, 0.85);
    g.beginPath();
    g.moveTo(cx - 2 * s, cy - th * 0.4);
    g.lineTo(cx + 5 * s, cy);
    g.lineTo(cx - 1 * s, cy + th * 0.38);
    g.strokePath();
    g.beginPath();
    g.moveTo(cx + 5 * s, cy);
    g.lineTo(cx + 12 * s, cy - 3 * s);
    g.strokePath();

    // Mini stick figure on tile
    g.fillStyle(ICE, 1);
    g.fillCircle(cx - 10 * s, cy - 8 * s, 3.5 * s);
    g.fillRect(cx - 11.5 * s, cy - 4 * s, 3 * s, 9 * s);

    // Money bag
    g.fillStyle(GOLD, 1);
    g.fillCircle(cx - 3 * s, cy - 2 * s, 4 * s);
    // $ drawn via scene text — skip direct fillText on Graphics
    // Bag neck
    g.fillStyle(GOLD, 1);
    g.fillRect(cx - 4 * s, cy - 7 * s, 2 * s, 3 * s);

    // Arm holding bag
    g.lineStyle(1.5, ICE, 1);
    g.beginPath();
    g.moveTo(cx - 10 * s, cy - 2 * s);
    g.lineTo(cx - 4 * s, cy - 3 * s);
    g.strokePath();
  }

  /**
   * Draws a wizard on a broomstick icon.
   *
   * @param g - Graphics object to draw on.
   * @param cx - Center X.
   * @param cy - Center Y.
   * @param scale - Base scale unit.
   */
  private drawWizardIcon(
    g: Phaser.GameObjects.Graphics,
    cx: number, cy: number,
    scale: number = 22
  ): void {
    const s = scale / 22;
    g.clear();

    // Broomstick
    g.fillStyle(0x8b6914, 1);
    g.fillRect(cx - 18 * s, cy + 6 * s, 36 * s, 4 * s);
    // Bristles
    g.fillStyle(0xaa8833, 0.7);
    for (let i = 0; i < 5; i++) {
      g.fillRect(cx + 10 * s + i * 2.5 * s, cy + 6 * s, 2 * s, 8 * s);
    }

    // Robe / body
    g.fillStyle(0x4a0a8a, 1);
    g.fillTriangle(
      cx - 6 * s, cy - 8 * s,
      cx + 6 * s, cy - 8 * s,
      cx + 4 * s, cy + 6 * s
    );
    g.fillTriangle(
      cx - 6 * s, cy - 8 * s,
      cx - 4 * s, cy + 6 * s,
      cx + 4 * s, cy + 6 * s
    );

    // Head
    g.fillStyle(0xf4c48a, 1);
    g.fillCircle(cx, cy - 12 * s, 5 * s);

    // Hat
    g.fillStyle(0x2a0a5a, 1);
    g.fillTriangle(
      cx - 7 * s, cy - 16 * s,
      cx + 7 * s, cy - 16 * s,
      cx,          cy - 26 * s
    );
    g.fillRect(cx - 8 * s, cy - 18 * s, 16 * s, 3 * s);

    // Stars on hat
    g.fillStyle(GOLD, 1);
    g.fillCircle(cx - 2 * s, cy - 21 * s, 1.5 * s);
    g.fillCircle(cx + 3 * s, cy - 19 * s, 1.2 * s);
  }
}

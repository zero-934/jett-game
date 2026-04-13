/**
 * @file HomeScene.ts
 * @purpose Home screen — crypto casino inspired, clean dark UI, large bold icons,
 *          Fredoka One bubble font, scrolling ticker.
 * @author Agent 934
 * @date 2026-04-12
 * @license Proprietary – available for licensing
 */

import * as Phaser from 'phaser';

const GOLD     = 0xc9a84c;
const GOLD_STR = '#c9a84c';
const ICE      = 0x7ec8e3;
const ICE_STR  = '#7ec8e3';

interface CardDef {
  key: string;
  title: string;
  subtitle: string;
  accent: number;
  accentStr: string;
  drawIcon: (scene: HomeScene, x: number, y: number) => void;
}

export class HomeScene extends Phaser.Scene {
  constructor() { super({ key: 'HomeScene' }); }

  create(): void {
    const { width, height } = this.scale;

    // ── Deep background ────────────────────────────────────────────────────
    this.add.rectangle(width / 2, height / 2, width, height, 0x050508);

    // Subtle noise grid
    const grid = this.add.graphics();
    grid.lineStyle(0.3, 0x0d0d1a, 1);
    for (let x = 0; x <= width; x += 40) {
      grid.beginPath(); grid.moveTo(x, 0); grid.lineTo(x, height); grid.strokePath();
    }
    for (let y = 0; y <= height; y += 40) {
      grid.beginPath(); grid.moveTo(0, y); grid.lineTo(width, y); grid.strokePath();
    }

    // Gold top accent bar
    const topBar = this.add.graphics();
    topBar.fillStyle(GOLD, 1);
    topBar.fillRect(0, 0, width, 3);
    topBar.fillGradientStyle(GOLD, GOLD, 0x050508, 0x050508, 0.15, 0.15, 0, 0);
    topBar.fillRect(0, 3, width, 36);

    // ── Logo ───────────────────────────────────────────────────────────────
    const logoY = height * 0.1;

    // Jetpack glyph left of wordmark
    this.drawLargeJetpack(width / 2 - 72, logoY);

    this.add.text(width / 2 - 42, logoY - 18, 'JETT', {
      fontFamily: '"Fredoka One", sans-serif',
      fontSize: '54px',
      color: GOLD_STR,
    }).setOrigin(0, 0);

    this.add.text(width / 2 - 40, logoY + 38, '.GAME', {
      fontFamily: '"Fredoka One", sans-serif',
      fontSize: '20px',
      color: '#cccccc',
    }).setOrigin(0, 0);

    // Tagline
    this.add.text(width / 2, height * 0.195, 'SKILL  ·  STRATEGY  ·  REWARD', {
      fontFamily: '"Fredoka", sans-serif',
      fontSize: '12px',
      color: '#383848',
      letterSpacing: 3,
    }).setOrigin(0.5);

    // Thin divider
    const div = this.add.graphics();
    div.lineStyle(1, 0x16161e, 1);
    div.beginPath();
    div.moveTo(width * 0.08, height * 0.225);
    div.lineTo(width * 0.92, height * 0.225);
    div.strokePath();

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
    ];

    const cardH      = 130;
    const cardW      = width * 0.9;
    const firstCardY = height * 0.285;
    const gap        = 14;

    cards.forEach((card, i) => {
      this.buildCard(width / 2, firstCardY + i * (cardH + gap), cardW, cardH, card);
    });

    // ── Scrolling ticker ───────────────────────────────────────────────────
    this.buildTicker(width, height);

    // Version
    this.add.text(width / 2, height * 0.975, 'v0.1  prototype', {
      fontFamily: '"Fredoka", sans-serif',
      fontSize: '10px',
      color: '#1c1c28',
    }).setOrigin(0.5);
  }

  // ─── Card builder ─────────────────────────────────────────────────────────

  private buildCard(cx: number, cy: number, w: number, h: number, card: CardDef): void {
    const x = cx - w / 2;
    const y = cy - h / 2;
    const r = 14;

    const bg = this.add.graphics();
    this.paintCard(bg, cx, cy, w, h, card.accent, false);

    this.add.rectangle(cx, cy, w, h, 0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => this.paintCard(bg, cx, cy, w, h, card.accent, true))
      .on('pointerout',  () => this.paintCard(bg, cx, cy, w, h, card.accent, false))
      .on('pointerdown', () => this.scene.start(card.key));

    // Left accent strip
    const strip = this.add.graphics();
    strip.fillStyle(card.accent, 1);
    strip.fillRect(x + 1, y + r, 4, h - r * 2);

    // Icon area — right side, vertically centered
    const iconX = cx + w / 2 - 52;
    card.drawIcon(this, iconX, cy);

    // Title
    this.add.text(x + 22, cy - 26, card.title, {
      fontFamily: '"Fredoka One", sans-serif',
      fontSize: '22px',
      color: card.accentStr,
    }).setOrigin(0, 0.5);

    // Subtitle
    this.add.text(x + 22, cy + 12, card.subtitle, {
      fontFamily: '"Fredoka", sans-serif',
      fontSize: '12px',
      color: '#4a4a60',
      lineSpacing: 5,
    }).setOrigin(0, 0.5);

    // Arrow
    this.add.text(cx + w / 2 - 16, cy, '›', {
      fontFamily: '"Fredoka One", sans-serif',
      fontSize: '28px',
      color: '#2a2a3a',
    }).setOrigin(0.5);
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

  // ─── Icons ────────────────────────────────────────────────────────────────

  /** Large jetpack glyph for the logo */
  private drawLargeJetpack(cx: number, cy: number): void {
    const g = this.add.graphics();
    const s = 1.6;
    this.paintJetpack(g, cx, cy, s);
  }

  /** Jetpack icon for the Jett card */
  drawJetpackCard(cx: number, cy: number): void {
    const g = this.add.graphics();
    this.paintJetpack(g, cx, cy, 1.1);
  }

  private paintJetpack(g: Phaser.GameObjects.Graphics, cx: number, cy: number, s: number): void {
    // Main pack body
    g.fillStyle(0x2a3a6a, 1);
    g.fillRoundedRect(cx - 11 * s, cy - 18 * s, 22 * s, 30 * s, 5 * s);

    // Pack highlight
    g.fillStyle(0x4466aa, 0.6);
    g.fillRoundedRect(cx - 8 * s, cy - 16 * s, 8 * s, 12 * s, 3 * s);

    // Side boosters
    g.fillStyle(0x1a2a50, 1);
    g.fillRoundedRect(cx - 18 * s, cy - 10 * s, 8 * s, 20 * s, 3 * s);
    g.fillRoundedRect(cx + 10 * s,  cy - 10 * s, 8 * s, 20 * s, 3 * s);

    // Booster nozzles
    g.fillStyle(0x8899bb, 1);
    g.fillRect(cx - 17 * s, cy + 10 * s, 6 * s, 4 * s);
    g.fillRect(cx + 11 * s,  cy + 10 * s, 6 * s, 4 * s);
    g.fillRect(cx - 7 * s,  cy + 12 * s, 14 * s, 4 * s);

    // Flames — left booster
    g.fillStyle(0xff6600, 0.95);
    g.fillTriangle(cx - 17 * s, cy + 14 * s, cx - 11 * s, cy + 14 * s, cx - 14 * s, cy + 26 * s);
    g.fillStyle(GOLD, 0.9);
    g.fillTriangle(cx - 16 * s, cy + 14 * s, cx - 12 * s, cy + 14 * s, cx - 14 * s, cy + 22 * s);

    // Flames — right booster
    g.fillStyle(0xff6600, 0.95);
    g.fillTriangle(cx + 11 * s, cy + 14 * s, cx + 17 * s, cy + 14 * s, cx + 14 * s, cy + 26 * s);
    g.fillStyle(GOLD, 0.9);
    g.fillTriangle(cx + 12 * s, cy + 14 * s, cx + 16 * s, cy + 14 * s, cx + 14 * s, cy + 22 * s);

    // Flames — center
    g.fillStyle(0xff6600, 0.9);
    g.fillTriangle(cx - 6 * s, cy + 16 * s, cx + 6 * s, cy + 16 * s, cx, cy + 30 * s);
    g.fillStyle(GOLD, 1);
    g.fillTriangle(cx - 3 * s, cy + 16 * s, cx + 3 * s, cy + 16 * s, cx, cy + 24 * s);

    // Center circle / reactor
    g.fillStyle(GOLD, 0.9);
    g.fillCircle(cx, cy, 5 * s);
    g.fillStyle(0xffffff, 0.6);
    g.fillCircle(cx, cy, 2.5 * s);

    // Strap lines
    g.lineStyle(1.5 * s, 0x6677aa, 0.7);
    g.beginPath(); g.moveTo(cx - 11 * s, cy - 10 * s); g.lineTo(cx - 18 * s, cy - 10 * s); g.strokePath();
    g.beginPath(); g.moveTo(cx + 11 * s, cy - 10 * s); g.lineTo(cx + 18 * s, cy - 10 * s); g.strokePath();
  }

  /** Large clear glass tile with crack + figure holding money bag */
  drawGlassTileCard(cx: number, cy: number): void {
    const g = this.add.graphics();
    const tw = 52;
    const th = 44;

    // Outer glow
    g.fillStyle(ICE, 0.06);
    g.fillRoundedRect(cx - tw / 2 - 4, cy - th / 2 - 4, tw + 8, th + 8, 10);

    // Glass tile body — very transparent
    g.fillStyle(0xaaddff, 0.10);
    g.fillRoundedRect(cx - tw / 2, cy - th / 2, tw, th, 8);

    // Glass border
    g.lineStyle(1.5, ICE, 0.8);
    g.strokeRoundedRect(cx - tw / 2, cy - th / 2, tw, th, 8);

    // Inner shine strip (top third)
    g.fillStyle(0xffffff, 0.2);
    g.fillRoundedRect(cx - tw / 2 + 4, cy - th / 2 + 3, tw - 8, th * 0.28, 4);

    // Secondary shine (bottom-right corner glint)
    g.fillStyle(0xffffff, 0.12);
    g.fillCircle(cx + tw / 2 - 7, cy + th / 2 - 6, 5);

    // Crack lines
    g.lineStyle(1.2, 0xffffff, 0.9);
    g.beginPath();
    g.moveTo(cx - 4, cy - th * 0.38);
    g.lineTo(cx + 8, cy + 2);
    g.lineTo(cx - 2, cy + th * 0.38);
    g.strokePath();
    g.lineStyle(0.8, 0xffffff, 0.6);
    g.beginPath();
    g.moveTo(cx + 8, cy + 2);
    g.lineTo(cx + 18, cy - 4);
    g.strokePath();
    g.beginPath();
    g.moveTo(cx + 8, cy + 2);
    g.lineTo(cx + 14, cy + 12);
    g.strokePath();

    // Stick figure ON the tile (sitting on top edge)
    const fy = cy - th / 2 - 2;
    g.fillStyle(ICE, 1);
    // Head
    g.fillCircle(cx - 14, fy - 7, 4);
    // Body
    g.fillRect(cx - 16, fy - 3, 4, 10);
    // Legs (sitting)
    g.lineStyle(1.5, ICE, 1);
    g.beginPath(); g.moveTo(cx - 14, fy + 7); g.lineTo(cx - 10, fy + 12); g.strokePath();
    g.beginPath(); g.moveTo(cx - 14, fy + 7); g.lineTo(cx - 18, fy + 12); g.strokePath();

    // Money bag
    g.fillStyle(GOLD, 1);
    g.fillCircle(cx - 6, fy - 2, 6);
    g.fillRect(cx - 8, fy - 9, 4, 5);
    // $ symbol (small gold rect)
    g.fillStyle(0x0d0d0d, 1);
    g.fillRect(cx - 8, fy - 4, 4, 1);
    g.fillRect(cx - 8, fy - 2, 4, 1);
    g.fillRect(cx - 7, fy - 5, 2, 5);

    // Arm reaching to bag
    g.lineStyle(1.5, ICE, 1);
    g.beginPath(); g.moveTo(cx - 13, fy); g.lineTo(cx - 7, fy - 1); g.strokePath();
  }

  /** Bold clean wizard on broomstick */
  drawWizardCard(cx: number, cy: number): void {
    const g = this.add.graphics();

    // Broomstick
    g.fillStyle(0x9b7928, 1);
    g.fillRoundedRect(cx - 26, cy + 8, 52, 6, 3);
    // Bristles
    for (let i = 0; i < 6; i++) {
      g.fillStyle(0xc4982a, 0.8);
      g.fillRect(cx + 14 + i * 4, cy + 9, 3, 10 + (i % 2) * 4);
    }

    // Robe — bold triangle shape
    g.fillStyle(0x5511aa, 1);
    g.fillTriangle(cx - 10, cy + 8, cx + 10, cy + 8, cx + 7, cy - 10);
    g.fillTriangle(cx - 10, cy + 8, cx - 7, cy - 10, cx + 7, cy - 10);
    // Robe highlight
    g.fillStyle(0x7722cc, 0.5);
    g.fillTriangle(cx - 5, cy + 8, cx + 5, cy + 8, cx + 3, cy - 6);

    // Belt
    g.fillStyle(GOLD, 0.8);
    g.fillRect(cx - 8, cy - 2, 16, 3);

    // Head
    g.fillStyle(0xf5c08a, 1);
    g.fillCircle(cx, cy - 16, 9);
    // Face — eyes
    g.fillStyle(0x333333, 1);
    g.fillCircle(cx - 3, cy - 17, 1.5);
    g.fillCircle(cx + 3, cy - 17, 1.5);
    // Beard
    g.fillStyle(0xffffff, 0.8);
    g.fillTriangle(cx - 4, cy - 10, cx + 4, cy - 10, cx, cy - 5);

    // Hat — tall and bold
    g.fillStyle(0x330a66, 1);
    g.fillTriangle(cx - 11, cy - 24, cx + 11, cy - 24, cx, cy - 48);
    // Hat brim
    g.fillStyle(0x440d88, 1);
    g.fillRoundedRect(cx - 13, cy - 26, 26, 6, 3);
    // Hat band
    g.fillStyle(GOLD, 0.9);
    g.fillRect(cx - 10, cy - 25, 20, 3);

    // Stars on hat
    g.fillStyle(GOLD, 1);
    g.fillCircle(cx - 4, cy - 36, 2);
    g.fillCircle(cx + 5, cy - 32, 1.5);
    g.fillCircle(cx,     cy - 42, 1.5);

    // Magic wand in hand
    g.fillStyle(0xffffff, 1);
    g.fillRect(cx - 20, cy - 4, 12, 2);
    g.fillStyle(GOLD, 1);
    g.fillCircle(cx - 20, cy - 3, 3);
    // Sparkles
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(cx - 25, cy - 8, 1.5);
    g.fillCircle(cx - 27, cy - 2, 1);
    g.fillCircle(cx - 23, cy - 12, 1);
  }

  // ─── Scrolling ticker ────────────────────────────────────────────────────

  private buildTicker(width: number, height: number): void {
    const ty   = height * 0.927;
    const barH = 30;
    const msg  = '  ✦  JETT.GAME  —  WORLD\'S FIRST CRYPTO SKILL GAME  ·  SKILL  ·  STRATEGY  ·  REWARD  ';

    // Background bar
    const bar = this.add.graphics();
    bar.fillStyle(GOLD, 0.08);
    bar.fillRect(0, ty - barH / 2, width, barH);
    bar.lineStyle(1, GOLD, 0.3);
    bar.beginPath(); bar.moveTo(0, ty - barH / 2); bar.lineTo(width, ty - barH / 2); bar.strokePath();
    bar.beginPath(); bar.moveTo(0, ty + barH / 2); bar.lineTo(width, ty + barH / 2); bar.strokePath();

    // Create clipping mask
    const maskShape = this.add.graphics();
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(0, ty - barH / 2, width, barH);
    const geomMask = maskShape.createGeometryMask();

    // Build enough text copies to fill width × 2
    const container = this.add.container(0, ty).setMask(geomMask);
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

    // Scroll
    this.time.addEvent({
      delay: 16,
      loop: true,
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
}

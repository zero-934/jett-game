/**
 * @file HomeScene.ts
 * @purpose Home screen — clean modern futuristic design, 3 game cards.
 * @author Agent 934
 * @date 2026-04-12
 * @license Proprietary – available for licensing
 */

import * as Phaser from 'phaser';

interface GameCard {
  key: string;
  title: string;
  subtitle: string;
  accentColor: number;
  accentStr: string;
  emoji: string;
}

const CARDS: GameCard[] = [
  {
    key: 'JettScene',
    title: 'JETT',
    subtitle: 'Ascend through the asteroid field.\nHigher altitude = bigger multiplier.',
    accentColor: 0xc9a84c,
    accentStr: '#c9a84c',
    emoji: '🚀',
  },
  {
    key: 'ShatterStepScene',
    title: 'SHATTER STEP',
    subtitle: 'Pick a tile. 50/50 odds.\nCash out before the glass breaks.',
    accentColor: 0x88ccff,
    accentStr: '#88ccff',
    emoji: '🪟',
  },
  {
    key: 'FlapFortuneScene',
    title: 'FLAP FORTUNE',
    subtitle: 'Fly the wizard through the gates.\nDive to the bottom to collect.',
    accentColor: 0xc9a84c,
    accentStr: '#c9a84c',
    emoji: '🧙',
  },
];

export class HomeScene extends Phaser.Scene {
  constructor() {
    super({ key: 'HomeScene' });
  }

  create(): void {
    const { width, height } = this.scale;

    // Background — deep black
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000);

    // Subtle grid
    const grid = this.add.graphics();
    const gridSize = 48;
    grid.lineStyle(0.5, 0x1a1a2e, 1);
    for (let x = 0; x < width; x += gridSize) {
      grid.beginPath(); grid.moveTo(x, 0); grid.lineTo(x, height); grid.strokePath();
    }
    for (let y = 0; y < height; y += gridSize) {
      grid.beginPath(); grid.moveTo(0, y); grid.lineTo(width, y); grid.strokePath();
    }

    // Accent glow line at top
    const topGlow = this.add.graphics();
    topGlow.fillGradientStyle(0xc9a84c, 0xc9a84c, 0x000000, 0x000000, 0.8, 0.8, 0, 0);
    topGlow.fillRect(0, 0, width, 2);
    topGlow.fillStyle(0xc9a84c, 0.08);
    topGlow.fillRect(0, 0, width, 24);

    // Logo area
    this.add.text(width / 2, height * 0.085, 'JETT', {
      fontFamily: 'monospace',
      fontSize: '42px',
      color: '#c9a84c',
      letterSpacing: 18,
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.145, 'GAME', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#444444',
      letterSpacing: 10,
    }).setOrigin(0.5);

    // Thin divider
    const divider = this.add.graphics();
    divider.lineStyle(1, 0x222222, 1);
    divider.beginPath();
    divider.moveTo(width * 0.2, height * 0.19);
    divider.lineTo(width * 0.8, height * 0.19);
    divider.strokePath();

    // Cards
    const cardH       = 138;
    const cardW       = width * 0.88;
    const firstCardY  = height * 0.285;
    const cardSpacing = cardH + 14;

    CARDS.forEach((card, idx) => {
      this.buildCard(width / 2, firstCardY + idx * cardSpacing, cardW, cardH, card);
    });

    // Bottom tag
    this.add.text(width / 2, height * 0.965, 'v0.1  ·  prototype', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#2a2a2a',
      letterSpacing: 2,
    }).setOrigin(0.5);
  }

  private buildCard(
    cx: number, cy: number, w: number, h: number, card: GameCard
  ): void {
    const x = cx - w / 2;
    const y = cy - h / 2;
    const r = 10;

    // Card background
    const bg = this.add.graphics();
    this.drawCardBg(bg, cx, cy, w, h, card.accentColor, false);

    // Hit area
    const hit = this.add
      .rectangle(cx, cy, w, h, 0x000000, 0)
      .setInteractive({ useHandCursor: true });

    // Left accent bar
    const bar = this.add.graphics();
    bar.fillStyle(card.accentColor, 1);
    bar.fillRect(x + 1, y + r, 3, h - r * 2);

    // Emoji
    this.add.text(cx - w / 2 + 30, cy - 4, card.emoji, {
      fontSize: '28px',
    }).setOrigin(0.5);

    // Title
    this.add.text(cx - w / 2 + 58, cy - 22, card.title, {
      fontFamily: 'monospace',
      fontSize: '17px',
      color: card.accentStr,
      letterSpacing: 3,
    }).setOrigin(0, 0.5);

    // Subtitle
    this.add.text(cx - w / 2 + 58, cy + 14, card.subtitle, {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#555555',
      lineSpacing: 5,
    }).setOrigin(0, 0.5);

    // Arrow
    this.add.text(cx + w / 2 - 20, cy, '›', {
      fontFamily: 'monospace',
      fontSize: '22px',
      color: '#333333',
    }).setOrigin(0.5);

    // Hover
    hit.on('pointerover', () => {
      this.drawCardBg(bg, cx, cy, w, h, card.accentColor, true);
    });
    hit.on('pointerout', () => {
      this.drawCardBg(bg, cx, cy, w, h, card.accentColor, false);
    });
    hit.on('pointerdown', () => {
      this.scene.start(card.key);
    });
  }

  private drawCardBg(
    g: Phaser.GameObjects.Graphics,
    cx: number, cy: number, w: number, h: number,
    accentColor: number,
    hovered: boolean
  ): void {
    g.clear();
    const x = cx - w / 2;
    const y = cy - h / 2;
    const r = 10;

    // Fill
    g.fillStyle(hovered ? 0x0d0d14 : 0x080810, 1);
    g.fillRoundedRect(x, y, w, h, r);

    // Border — accent tinted on hover, subtle otherwise
    g.lineStyle(1, accentColor, hovered ? 0.5 : 0.12);
    g.strokeRoundedRect(x, y, w, h, r);

    // Subtle inner glow at top edge on hover
    if (hovered) {
      g.fillStyle(accentColor, 0.04);
      g.fillRoundedRect(x, y, w, h * 0.4, r);
    }
  }
}

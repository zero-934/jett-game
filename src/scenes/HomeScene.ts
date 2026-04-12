/**
 * @file HomeScene.ts
 * @purpose Home screen — displays 3 game cards for Jett, Shatter Step, and Flap Fortune.
 * @author Agent 934
 * @date 2026-04-12
 * @license Proprietary – available for licensing
 */

import * as Phaser from 'phaser';

interface GameCard {
  key: string;
  title: string;
  subtitle: string;
  color: number;
  accentStr: string;
  emoji: string;
}

const CARDS: GameCard[] = [
  {
    key: 'JettScene',
    title: 'JETT',
    subtitle: 'Dodge androids in space.\nAscend forever. Cash out.',
    color: 0x1a1a3a,
    accentStr: '#c9a84c',
    emoji: '🚀',
  },
  {
    key: 'ShatterStepScene',
    title: 'SHATTER STEP',
    subtitle: 'Pick a tile. 50/50.\nOne shatters beneath you.',
    color: 0x0d2233,
    accentStr: '#aaddff',
    emoji: '🪟',
  },
  {
    key: 'FlapFortuneScene',
    title: 'FLAP FORTUNE',
    subtitle: 'Flap through the pipes.\nDistance = multiplier.',
    color: 0x0d1a0d,
    accentStr: '#44cc44',
    emoji: '🐦',
  },
];

export class HomeScene extends Phaser.Scene {
  constructor() {
    super({ key: 'HomeScene' });
  }

  create(): void {
    const { width, height } = this.scale;

    // Background gradient using graphics
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x000000, 0x000000, 0x0d0d1a, 0x0d0d1a, 1);
    bg.fillRect(0, 0, width, height);

    // Stars
    for (let i = 0; i < 80; i++) {
      const sx = Phaser.Math.Between(0, width);
      const sy = Phaser.Math.Between(0, height * 0.5);
      const sr = Math.random() < 0.2 ? 1.5 : 0.8;
      this.add.arc(sx, sy, sr, 0, 360, false, 0xffffff, Math.random() * 0.6 + 0.2);
    }

    // Logo
    this.add.text(width / 2, height * 0.1, 'JETT.GAME', {
      fontFamily: 'monospace',
      fontSize: '32px',
      color: '#c9a84c',
      letterSpacing: 10,
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.17, 'MIDNIGHT LUXURY CASINO', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#555555',
      letterSpacing: 4,
    }).setOrigin(0.5);

    // Game cards
    const cardHeight = 150;
    const cardWidth = width * 0.82;
    const cardX = width / 2;
    const firstCardY = height * 0.30;
    const cardSpacing = cardHeight + 18;

    CARDS.forEach((card, idx) => {
      const cy = firstCardY + idx * cardSpacing;
      this.buildCard(cardX, cy, cardWidth, cardHeight, card);
    });

    // Footer
    this.add.text(width / 2, height * 0.96, 'v0.1 — prototype', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#333333',
    }).setOrigin(0.5);
  }

  private buildCard(
    cx: number, cy: number, w: number, h: number, card: GameCard
  ): void {
    // Card bg
    const bg = this.add.graphics();
    bg.fillStyle(card.color, 1);
    bg.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 12);
    bg.lineStyle(1.5, 0xc9a84c, 0.3);
    bg.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 12);

    // Hit area
    const hit = this.add
      .rectangle(cx, cy, w, h, 0x000000, 0)
      .setInteractive({ useHandCursor: true });

    // Emoji
    this.add.text(cx - w / 2 + 28, cy, card.emoji, {
      fontSize: '36px',
    }).setOrigin(0.5);

    // Title
    this.add.text(cx - w / 2 + 64, cy - 28, card.title, {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: card.accentStr,
      letterSpacing: 4,
    }).setOrigin(0, 0.5);

    // Subtitle
    this.add.text(cx - w / 2 + 64, cy + 14, card.subtitle, {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#888888',
      lineSpacing: 4,
    }).setOrigin(0, 0.5);

    // Arrow
    this.add.text(cx + w / 2 - 24, cy, '›', {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: card.accentStr,
    }).setOrigin(0.5);

    // Hover effect
    hit.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(card.color, 1);
      bg.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 12);
      bg.lineStyle(2, 0xc9a84c, 0.8);
      bg.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 12);
    });
    hit.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(card.color, 1);
      bg.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 12);
      bg.lineStyle(1.5, 0xc9a84c, 0.3);
      bg.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 12);
    });
    hit.on('pointerdown', () => {
      this.scene.start(card.key);
    });
  }
}

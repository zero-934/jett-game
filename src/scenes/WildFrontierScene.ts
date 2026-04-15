/**
 * @file WildFrontierScene.ts
 * @purpose Phaser Scene for Wild Frontier slot — wires WildFrontierUI and WildFrontierLogic.
 * @author C-3PO
 * @date 2026-04-14
 * @license Proprietary – available for licensing
 */

import * as Phaser from 'phaser';
import { WildFrontierUI } from '../games/WildFrontierUI';

const GOLD_STR = '#c9a84c';

export class WildFrontierScene extends Phaser.Scene {
  private wildFrontierUI: WildFrontierUI | null = null;

  constructor() { super({ key: 'WildFrontierScene' }); }

  preload(): void {
    // In a real game, this is where we'd load all our image and audio assets
    // for the Wild Frontier theme (cowboy, indigenous guide, horse, buffalo, etc.).
    // For now, WildFrontierUI draws placeholders, so nothing explicit is loaded here yet.
  }

  create(): void {
    const { width, height } = this.scale;

    // Background (matching UI's background for consistency)
    this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a1a).setOrigin(0.5);

    // Game Title
    this.add.text(width / 2, height * 0.10, 'WILD FRONTIER', {
      fontFamily: '"Fredoka One", sans-serif',
      fontSize: '48px', color: GOLD_STR, letterSpacing: 8,
    }).setOrigin(0.5);

    // Subtitle / Instructions
    this.add.text(width / 2, height * 0.17, '25 PAYLINES · 96% RTP', {
      fontFamily: '"Fredoka One", sans-serif',
      fontSize: '14px', color: '#aaaaaa', letterSpacing: 3,
    }).setOrigin(0.5);

    this.wildFrontierUI = new WildFrontierUI(this, { houseEdge: 0.04 }); // 4% house edge
    this.wildFrontierUI.start();
  }

  shutdown(): void {
    this.wildFrontierUI?.cleanup();
  }
}

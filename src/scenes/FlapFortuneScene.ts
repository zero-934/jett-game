/**
 * @file FlapFortuneScene.ts
 * @purpose Phaser Scene for Flap Fortune — wires FlapFortuneUI and FlapFortuneLogic together,
 *          handles scene lifecycle (create, shutdown).
 * @author Agent 934
 * @date 2026-04-12
 * @license Proprietary – available for licensing
 */

import Phaser from 'phaser';
import { FlapFortuneUI } from '../games/FlapFortuneUI';

const DEFAULT_BET = 10;

/**
 * Phaser Scene that hosts the Flap Fortune game.
 * Register this scene in your Phaser.Game config.
 *
 * @example
 * new Phaser.Game({ scene: [FlapFortuneScene] });
 */
export class FlapFortuneScene extends Phaser.Scene {
  private flapUI: FlapFortuneUI | null = null;

  constructor() {
    super({ key: 'FlapFortuneScene' });
  }

  create(): void {
    const { width, height } = this.scale;

    // Background
    this.add.rectangle(width / 2, height / 2, width, height, 0x0d0d0d);

    // Title
    this.add
      .text(width / 2, height * 0.06, 'FLAP FORTUNE', {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#c9a84c',
        letterSpacing: 4,
      })
      .setOrigin(0.5);

    // Tap hint
    this.add
      .text(width / 2, height * 0.12, 'TAP / SPACE to flap', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#555555',
      })
      .setOrigin(0.5);

    this.flapUI = new FlapFortuneUI(this, {
      worldWidth: width,
      worldHeight: height,
      gravity: 0.5,
      flapStrength: -8,
      pipeSpacing: 220,
      pipeGapHeight: 180,
      scrollSpeed: 3,
      houseEdge: 0.03,
    });

    this.flapUI.start(DEFAULT_BET);

    // Scene switch buttons
    this.addNavButton(width - 16, height - 16, 'JETT', 'JettScene');
    this.addNavButton(16, height - 16, 'SHATTER', 'ShatterStepScene');
  }

  shutdown(): void {
    this.flapUI?.cleanup();
  }

  private addNavButton(x: number, y: number, label: string, sceneKey: string): void {
    this.add
      .text(x, y, `[${label}]`, {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#555555',
      })
      .setOrigin(x < 100 ? 0 : 1, 1)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.flapUI?.cleanup();
        this.scene.start(sceneKey);
      });
  }
}

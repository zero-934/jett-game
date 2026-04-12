/**
 * @file JettScene.ts
 * @purpose Phaser Scene for Jett — wires JettUI and JettLogic together,
 *          handles scene lifecycle (create, shutdown).
 * @author Agent 934
 * @date 2026-04-12
 * @license Proprietary – available for licensing
 */

import Phaser from 'phaser';
import { JettUI } from '../games/JettUI';

const DEFAULT_BET = 10;

/**
 * Phaser Scene that hosts the Jett game.
 * Register this scene in your Phaser.Game config.
 *
 * @example
 * new Phaser.Game({ scene: [JettScene] });
 */
export class JettScene extends Phaser.Scene {
  private jettUI: JettUI | null = null;

  constructor() {
    super({ key: 'JettScene' });
  }

  create(): void {
    const { width, height } = this.scale;

    // Background
    this.add.rectangle(width / 2, height / 2, width, height, 0x0d0d0d);

    // Title
    this.add
      .text(width / 2, height * 0.06, 'JETT', {
        fontFamily: 'monospace',
        fontSize: '28px',
        color: '#c9a84c',
        letterSpacing: 8,
      })
      .setOrigin(0.5);

    this.jettUI = new JettUI(this, {
      worldWidth: width,
      worldHeight: height,
      houseEdge: 0.03,
      obstacleSpacing: 120,
      obstacleGapWidth: 160,
    });

    this.jettUI.start(DEFAULT_BET);

    // Scene switch buttons
    this.addNavButton(width - 16, height - 16, 'SHATTER', 'ShatterStepScene');
    this.addNavButton(16, height - 16, 'FLAP', 'FlapFortuneScene');
  }

  shutdown(): void {
    this.jettUI?.cleanup();
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
        this.jettUI?.cleanup();
        this.scene.start(sceneKey);
      });
  }
}

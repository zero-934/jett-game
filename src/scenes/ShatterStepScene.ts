/**
 * @file ShatterStepScene.ts
 * @purpose Phaser Scene for Shatter Step — wires ShatterStepUI and ShatterStepLogic together,
 *          handles scene lifecycle (create, shutdown).
 * @author Agent 934
 * @date 2026-04-12
 * @license Proprietary – available for licensing
 */

import Phaser from 'phaser';
import { ShatterStepUI } from '../games/ShatterStepUI';

const DEFAULT_BET = 10;

/**
 * Phaser Scene that hosts the Shatter Step game.
 * Register this scene in your Phaser.Game config.
 *
 * @example
 * new Phaser.Game({ scene: [ShatterStepScene] });
 */
export class ShatterStepScene extends Phaser.Scene {
  private shatterUI: ShatterStepUI | null = null;

  constructor() {
    super({ key: 'ShatterStepScene' });
  }

  create(): void {
    const { width, height } = this.scale;

    // Background
    this.add.rectangle(width / 2, height / 2, width, height, 0x0d0d0d);

    // Title
    this.add
      .text(width / 2, height * 0.06, 'SHATTER STEP', {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#c9a84c',
        letterSpacing: 5,
      })
      .setOrigin(0.5);

    this.shatterUI = new ShatterStepUI(this, width, height);
    this.shatterUI.start(DEFAULT_BET);

    // Scene switch buttons
    this.addNavButton(width - 16, height - 16, 'JETT', 'JettScene');
    this.addNavButton(16, height - 16, 'FLAP', 'FlapFortuneScene');
  }

  shutdown(): void {
    this.shatterUI?.cleanup();
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
        this.shatterUI?.cleanup();
        this.scene.start(sceneKey);
      });
  }
}

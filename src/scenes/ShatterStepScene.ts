/**
 * @file ShatterStepScene.ts
 * @purpose Phaser Scene for Shatter Step — wires the pure logic/round controller and the
 *          polish-003 Soft Depth glass-shaft UI. Payout schedule unchanged.
 * @author Agent 934
 * @date 2026-04-12 (polish-003: 2026-11-05)
 * @license Proprietary – available for licensing
 */

import * as Phaser from 'phaser';
import { ShatterStepUI } from '../games/ShatterStepUI';

const DEFAULT_BET = 10;

export class ShatterStepScene extends Phaser.Scene {
  private shatterUI: ShatterStepUI | null = null;

  constructor() {
    super({ key: 'ShatterStepScene' });
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#0d121a');
    this.shatterUI = new ShatterStepUI(this, width, height);
    this.shatterUI.start(DEFAULT_BET);
    // Phaser never calls a Scene method named shutdown(); subscribe explicitly (R-OWN-2).
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.shutdown());
  }

  shutdown(): void {
    this.shatterUI?.cleanup();
    this.shatterUI = null;
  }
}

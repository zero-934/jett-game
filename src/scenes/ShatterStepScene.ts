/**
 * @file ShatterStepScene.ts
 * @purpose Phaser Scene for Shatter Step — wires the pure logic/round controller and the
 *          polish-003 Soft Depth glass-shaft UI. Payout schedule unchanged.
 * @author Agent 934
 * @date 2026-04-12 (polish-003: 2026-11-05)
 * @license Proprietary – available for licensing
 */

import * as Phaser from 'phaser';
import { RenderScaleController } from '../shared/render/RenderScale';
import { LOGICAL_W, LOGICAL_H } from '../shared/render/RenderScalePolicy';
import { getHost } from '../shared/host/DemoHostAdapter';
import { SHATTER_SIM_VERSION } from '../games/ShatterStepLogic';
import { ShatterStepUI } from '../games/ShatterStepUI';

const DEFAULT_BET = 10;

export class ShatterStepScene extends Phaser.Scene {
  private shatterUI: ShatterStepUI | null = null;

  constructor() {
    super({ key: 'ShatterStepScene' });
  }

  create(): void {
    // polish-004: high-density backing store, logical 390×844 coordinates unchanged.
    RenderScaleController.attach(this);
    // Logical world size (NOT this.scale, which is the high-density backing size).
    const width = LOGICAL_W; const height = LOGICAL_H;
    this.cameras.main.setBackgroundColor('#0d121a');
    this.shatterUI = new ShatterStepUI(this, width, height);
    this.shatterUI.start(DEFAULT_BET);
    getHost().gameReady({ sceneKey: 'ShatterStepScene', mathVersion: SHATTER_SIM_VERSION, configId: 'shatter-prod-v1' });
    // Phaser never calls a Scene method named shutdown(); subscribe explicitly (R-OWN-2).
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.shutdown());
  }

  shutdown(): void {
    this.shatterUI?.cleanup();
    this.shatterUI = null;
  }
}

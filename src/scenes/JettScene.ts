/**
 * @file JettScene.ts
 * @purpose Phaser Scene for Jett — wires the pure logic/round controller and the polish-003
 *          Soft Depth UI. Gameplay config values are unchanged.
 * @author Agent 934
 * @date 2026-04-12 (polish-003: 2026-11-05)
 * @license Proprietary – available for licensing
 */

import * as Phaser from 'phaser';
import { RenderScaleController } from '../shared/render/RenderScale';
import { JettUI } from '../games/JettUI';

const DEFAULT_BET = 10;

/** Production gameplay config (unchanged from the pre-polish scene). */
export const JETT_SCENE_CONFIG = {
  worldWidth: 390,
  screenHeight: 844,
  houseEdge: 0.03,
  combustionChancePerTick: 0.0008,  // 1 in 1250 ticks, ~20 s average
} as const;

export class JettScene extends Phaser.Scene {
  private jettUI: JettUI | null = null;

  constructor() {
    super({ key: 'JettScene' });
  }

  preload(): void {
    JettUI.preload(this);
  }

  create(): void {
    // polish-004: high-density backing store, logical 390×844 coordinates unchanged.
    RenderScaleController.attach(this);
    this.cameras.main.setBackgroundColor('#0d121a');
    this.jettUI = new JettUI(this, { ...JETT_SCENE_CONFIG });
    this.jettUI.start(DEFAULT_BET);
    // Phaser never calls a Scene method named shutdown(); subscribe explicitly (R-OWN-2).
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.shutdown());
  }

  shutdown(): void {
    this.jettUI?.cleanup();
    this.jettUI = null;
  }
}

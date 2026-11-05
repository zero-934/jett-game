/**
 * @file FlapFortuneScene.ts
 * @purpose Phaser Scene for Flap Fortune — wires the pure logic/round controller and the
 *          polish-003 Soft Depth UI. Gameplay config values are unchanged.
 * @author Agent 934
 * @date 2026-04-12 (polish-003: 2026-11-05)
 * @license Proprietary – available for licensing
 */

import * as Phaser from 'phaser';
import { FlapFortuneUI } from '../games/FlapFortuneUI';

const DEFAULT_BET = 10;

/** Production gameplay config (unchanged from the pre-polish scene). */
export const FLAP_SCENE_CONFIG = {
  worldWidth: 390,
  worldHeight: 844,
  gravity: 0.45,
  flapStrength: -7.5,
  pipeSpacing: 230,
  pipeGapHeight: 158,
  scrollSpeed: 3,
  houseEdge: 0.03,
  combustionChancePerTick: 0.0003,
} as const;

export class FlapFortuneScene extends Phaser.Scene {
  private flapUI: FlapFortuneUI | null = null;

  constructor() {
    super({ key: 'FlapFortuneScene' });
  }

  preload(): void {
    FlapFortuneUI.preload(this);
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0d121a');
    this.flapUI = new FlapFortuneUI(this, { ...FLAP_SCENE_CONFIG });
    this.flapUI.start(DEFAULT_BET);
    // Phaser never calls a Scene method named shutdown(); subscribe explicitly (R-OWN-2).
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.shutdown());
  }

  shutdown(): void {
    this.flapUI?.cleanup();
    this.flapUI = null;
  }
}

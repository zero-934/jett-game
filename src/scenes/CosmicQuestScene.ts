/**
 * @file CosmicQuestScene.ts
 * @purpose Phaser scene for the Cosmic Quest slot game, wiring Logic and UI.
 * @author Agent 934
 * @date 2026-04-14
 * @license Proprietary – available for licensing
 */

import Phaser from 'phaser';
import { CosmicQuestUI } from '../games/CosmicQuestUI';
import { CosmicQuestConfig } from '../games/CosmicQuestLogic';

/**
 * Scene that integrates the Cosmic Quest game logic with its UI.
 */
export class CosmicQuestScene extends Phaser.Scene {
  public static readonly KEY = 'CosmicQuestScene';
  private cosmicQuestUI?: CosmicQuestUI;

  constructor() {
    super(CosmicQuestScene.KEY);
  }

  preload() {
    // Load any assets specific to Cosmic Quest (e.g., character images, reel symbols)
    // This will be expanded when actual assets are available.
  }

  create() {
    this.cameras.main.setBackgroundColor(0x0d0d0d); // Midnight Luxury background

    // Instantiate the UI, passing in a basic game config
    const gameConfig: CosmicQuestConfig = {
      houseEdge: 0.03, // Use the mandated 97% RTP
    };
    this.cosmicQuestUI = new CosmicQuestUI(this, 1, 25, gameConfig);

    // Add a simple back button for navigation
    const backButton = this.add.text(this.sys.game.canvas.width - 100, 30, 'BACK', {
      fontSize: '24px',
      color: '#c9a84c',
    }).setOrigin(0.5).setInteractive();

    backButton.on('pointerdown', () => {
      this.scene.start('HomeScene');
    });
  }

  update() {
    // UI updates are primarily handled within CosmicQuestUI and its event listeners.
    // This update loop can be used for any continuous scene-level animations or checks if needed.
  }
}

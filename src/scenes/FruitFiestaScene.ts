/**
 * @file FruitFiestaScene.ts
 * @purpose Phaser scene for the Tropical Fruit Fiesta slot game, wiring Logic and UI.
 * @author Agent 934
 * @date 2026-04-14
 * @license Proprietary – available for licensing
 */

import Phaser from 'phaser';
import { FruitFiestaUI } from '../games/FruitFiestaUI';
import { FruitFiestaConfig } from '../games/FruitFiestaLogic';

/**
 * Scene that integrates the Tropical Fruit Fiesta game logic with its UI.
 */
export class FruitFiestaScene extends Phaser.Scene {
  public static readonly KEY = 'FruitFiestaScene';
  private fruitFiestaUI?: FruitFiestaUI;

  constructor() {
    super(FruitFiestaScene.KEY);
  }

  preload() {
    // Load any assets specific to Tropical Fruit Fiesta (e.g., character images, reel symbols)
    // This will be expanded when actual assets are available.
  }

  create() {
    this.cameras.main.setBackgroundColor(0x0d0d0d); // Midnight Luxury background

    // Instantiate the UI, passing in a basic game config
    const gameConfig: FruitFiestaConfig = {
      houseEdge: 0.03, // Use the mandated 97% RTP
    };
    this.fruitFiestaUI = new FruitFiestaUI(this, 1, 25, gameConfig);

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
    // UI updates are primarily handled within FruitFiestaUI and its event listeners.
    // This update loop can be used for any continuous scene-level animations or checks if needed.
  }
}

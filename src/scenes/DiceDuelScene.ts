/**
 * @file DiceDuelScene.ts
 * @purpose Phaser Scene for Dice Duel — wires DiceDuelLogic + DiceDuelUI.
 * @author Agent 934
 * @date 2026-04-16
 * @license Proprietary – available for licensing
 */

import * as Phaser from 'phaser';
import { DiceDuelUI } from '../games/DiceDuelUI';

const SCENE_KEY   = 'DiceDuelScene';
const CANVAS_W    = 390;
const GOLD_STR    = '#c9a84c';
const DARK        = 0x080812;
const DARK_STR    = '#080812';

const BET_OPTIONS  = [1, 5, 10, 25, 50];
const FONT_UI      = 'Arial, sans-serif';

export class DiceDuelScene extends Phaser.Scene {
  private diceUI!: DiceDuelUI;
  private betBtns: Phaser.GameObjects.Text[] = [];
  private currentBet = 10;

  constructor() {
    super({ key: SCENE_KEY });
  }

  create(): void {
    // Nav bar
    const nav = this.add.graphics().setDepth(50);
    nav.fillStyle(DARK, 0.85);
    nav.fillRect(0, 0, CANVAS_W, 36);

    // Back button
    this.add.text(12, 18, '‹ HOME', {
      fontFamily: FONT_UI, fontSize: '16px', color: GOLD_STR,
    }).setOrigin(0, 0.5).setDepth(51)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start('HomeScene'));

    // Bet selector — below title, above dice
    const betSpacing = Math.floor((CANVAS_W - 32) / BET_OPTIONS.length);
    BET_OPTIONS.forEach((bet, i) => {
      const bx = 16 + betSpacing * i + betSpacing / 2;
      const btn = this.add.text(bx, 120, `$${bet}`, {
        fontFamily: FONT_UI, fontSize: '14px',
        color: bet === this.currentBet ? DARK_STR : GOLD_STR,
        backgroundColor: bet === this.currentBet ? GOLD_STR : '#333333',
        padding: { x: 8, y: 4 },
      }).setOrigin(0.5).setDepth(51).setInteractive({ useHandCursor: true });

      btn.on('pointerdown', () => {
        this.currentBet = bet;
        this.betBtns.forEach((b, j) => {
          b.setStyle({
            backgroundColor: j === i ? GOLD_STR : '#333333',
            color:           j === i ? DARK_STR : GOLD_STR,
          });
        });
        this.diceUI.setBet(bet);
      });
      this.betBtns.push(btn);
    });

    // Build UI
    this.diceUI = new DiceDuelUI(this);
    this.diceUI.setBet(this.currentBet);
    this.diceUI.start();
  }
}

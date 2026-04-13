/**
 * @file DiceUI.ts
 * @purpose Phaser rendering for Dice — tier selector, animated dice, result display, HUD.
 * @author Agent 934
 * @date 2026-04-13
 * @license Proprietary – available for licensing
 */

import * as Phaser from 'phaser';
import type { DiceConfig, DiceTier } from './DiceLogic';
import { createDiceState, rollDice, selectTier } from './DiceLogic';

const GOLD     = 0xc9a84c;
const GOLD_STR = '#c9a84c';
const DARK     = 0x080812;

export class DiceUI {
  private scene:  Phaser.Scene;
  private config: DiceConfig;
  private state:  ReturnType<typeof createDiceState> | null = null;

  private tierButtons: Map<DiceTier, { bg: Phaser.GameObjects.Graphics; label: Phaser.GameObjects.Text }> = new Map();
  private diceRects:   Phaser.GameObjects.Rectangle[] = [];
  private diceLabels:  Phaser.GameObjects.Text[]      = [];
  private rollBtn:     Phaser.GameObjects.Rectangle   | null = null;
  private rollLabel:   Phaser.GameObjects.Text        | null = null;
  private resultText:  Phaser.GameObjects.Text        | null = null;
  private multiplierText: Phaser.GameObjects.Text     | null = null;
  private betText:     Phaser.GameObjects.Text        | null = null;
  private winChanceText: Phaser.GameObjects.Text      | null = null;
  private homeButton:  Phaser.GameObjects.Text        | null = null;
  private spinTimer:   Phaser.Time.TimerEvent         | null = null;

  private readonly BET = 10;

  constructor(scene: Phaser.Scene, config: DiceConfig = {}) {
    this.scene  = scene;
    this.config = config;
  }

  public start(): void {
    this.cleanup();
    this.state = createDiceState(this.BET, 2);
    this.buildTierSelector();
    this.buildDice();
    this.buildRollButton();
    this.buildHUD();
  }

  public cleanup(): void {
    this.spinTimer?.remove();
    for (const [, { bg, label }] of this.tierButtons) { bg.destroy(); label.destroy(); }
    this.tierButtons.clear();
    for (const r of this.diceRects) r.destroy();
    for (const l of this.diceLabels) l.destroy();
    this.diceRects  = [];
    this.diceLabels = [];
    this.rollBtn?.destroy();
    this.rollLabel?.destroy();
    this.resultText?.destroy();
    this.multiplierText?.destroy();
    this.betText?.destroy();
    this.winChanceText?.destroy();
    this.homeButton?.destroy();
    this.state = null;
  }

  private buildTierSelector(): void {
    const { width, height } = this.scene.scale;
    const tiers: DiceTier[] = [2, 5, 10];
    const labels = ['2×', '5×', '10×'];
    const btnW = 90, btnH = 60, gap = 14;
    const totalW = tiers.length * btnW + (tiers.length - 1) * gap;
    const startX = (width - totalW) / 2;
    const y = height * 0.30;

    this.scene.add.text(width / 2, y - 44, 'PICK YOUR MULTIPLIER', {
      fontFamily: '"Fredoka One", sans-serif',
      fontSize: '15px', color: '#444455', letterSpacing: 2,
    }).setOrigin(0.5);

    tiers.forEach((tier, i) => {
      const cx = startX + i * (btnW + gap) + btnW / 2;
      const bg = this.scene.add.graphics();
      const label = this.scene.add.text(cx, y, labels[i], {
        fontFamily: '"Fredoka One", sans-serif',
        fontSize: '28px', color: GOLD_STR,
      }).setOrigin(0.5).setDepth(2);

      this.paintTierBtn(bg, cx, y, btnW, btnH, tier === this.state!.selectedTier);
      this.tierButtons.set(tier, { bg, label });

      // win chance shown below in winChanceText

      this.scene.add.rectangle(cx, y, btnW, btnH, 0, 0)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.handleTierSelect(tier))
        .on('pointerover', () => bg.setAlpha(0.8))
        .on('pointerout',  () => bg.setAlpha(1));
    });

    // Win chance display
    this.winChanceText = this.scene.add.text(width / 2, y + 50, '', {
      fontFamily: '"Fredoka One", sans-serif',
      fontSize: '13px', color: '#555566',
    }).setOrigin(0.5);
    this.updateWinChanceText();
  }

  private paintTierBtn(g: Phaser.GameObjects.Graphics, cx: number, cy: number, w: number, h: number, selected: boolean): void {
    g.clear();
    g.fillStyle(selected ? 0x1a1a08 : DARK, 1);
    g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 10);
    g.lineStyle(selected ? 2 : 1, GOLD, selected ? 0.9 : 0.2);
    g.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 10);
  }

  private buildDice(): void {
    const { width, height } = this.scene.scale;
    const diceW = 70, diceH = 70, gap = 16;
    const total = 3 * diceW + 2 * gap;
    const startX = (width - total) / 2;
    const y = height * 0.52;

    for (let i = 0; i < 3; i++) {
      const cx = startX + i * (diceW + gap) + diceW / 2;
      const rect = this.scene.add.rectangle(cx, y, diceW, diceH, 0x111122)
        .setStrokeStyle(1.5, GOLD, 0.4);
      const label = this.scene.add.text(cx, y, '?', {
        fontFamily: '"Fredoka One", sans-serif',
        fontSize: '36px', color: GOLD_STR,
      }).setOrigin(0.5).setDepth(2);
      this.diceRects.push(rect);
      this.diceLabels.push(label);
    }
  }

  private buildRollButton(): void {
    const { width, height } = this.scene.scale;
    const cx = width / 2, cy = height * 0.69;

    this.rollBtn = this.scene.add.rectangle(cx, cy, 180, 56, GOLD)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.handleRoll())
      .on('pointerover', () => this.rollBtn?.setFillStyle(0xddb83a))
      .on('pointerout',  () => this.rollBtn?.setFillStyle(GOLD));

    this.rollLabel = this.scene.add.text(cx, cy, 'ROLL', {
      fontFamily: '"Fredoka One", sans-serif',
      fontSize: '26px', color: '#000000',
    }).setOrigin(0.5).setDepth(2);
  }

  private buildHUD(): void {
    const { width, height } = this.scene.scale;

    this.betText = this.scene.add.text(16, 16, `BET: ${this.BET}`, {
      fontFamily: '"Fredoka One", sans-serif', fontSize: '18px', color: GOLD_STR,
    }).setDepth(10);

    this.resultText = this.scene.add.text(width / 2, height * 0.82, '', {
      fontFamily: '"Fredoka One", sans-serif', fontSize: '28px', color: '#ffffff', align: 'center',
    }).setOrigin(0.5).setDepth(10);

    this.homeButton = this.scene.add.text(width / 2, height - 16, '[ HOME ]', {
      fontFamily: '"Fredoka One", sans-serif', fontSize: '12px', color: '#333344',
    }).setOrigin(0.5).setDepth(10)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => { this.cleanup(); this.scene.scene.start('HomeScene'); });
  }

  private handleTierSelect(tier: DiceTier): void {
    if (!this.state || this.state.won !== null) return;
    selectTier(this.state, tier);
    for (const [t, { label }] of this.tierButtons) {
      void t;
      label.setAlpha(1); // refresh
    }
    // Simpler: just re-tint labels
    for (const [t, { label }] of this.tierButtons) {
      label.setColor(t === tier ? '#ffffff' : GOLD_STR);
      label.setScale(t === tier ? 1.15 : 1);
    }
    this.updateWinChanceText();
  }

  private handleRoll(): void {
    if (!this.state || this.state.isComplete) return;
    this.rollBtn?.disableInteractive();

    // Spin animation
    let ticks = 0;
    this.spinTimer = this.scene.time.addEvent({
      delay: 60,
      repeat: 14,
      callback: () => {
        for (const label of this.diceLabels) {
          label.setText(String(Math.floor(Math.random() * 6) + 1));
        }
        ticks++;
        if (ticks >= 14) {
          rollDice(this.state!, this.config);
          for (let i = 0; i < 3; i++) {
            this.diceLabels[i].setText(String(this.state!.diceValues[i]));
          }
          this.showResult();
        }
      },
    });
  }

  private showResult(): void {
    if (!this.state) return;
    if (this.state.won) {
      this.resultText?.setText(`WIN!\n+${this.state.payout} credits`).setColor('#44ff88');
    } else {
      this.resultText?.setText('BETTER LUCK\nNEXT TIME').setColor('#ff4444');
    }
    this.scene.time.delayedCall(600, () => this.showPlayAgain());
  }

  private showPlayAgain(): void {
    const { width, height } = this.scene.scale;
    const btn = this.scene.add
      .rectangle(width / 2, height * 0.91, 180, 50, GOLD)
      .setInteractive({ useHandCursor: true }).setDepth(20);
    this.scene.add.text(width / 2, height * 0.91, 'PLAY AGAIN', {
      fontFamily: '"Fredoka One", sans-serif', fontSize: '14px', color: '#000000',
    }).setOrigin(0.5).setDepth(21);
    btn.on('pointerdown', () => { this.cleanup(); this.scene.scene.restart(); });
  }

  private updateWinChanceText(): void {
    if (!this.state || !this.winChanceText) return;
    const tier = this.state.selectedTier;
    const pct  = Math.round((1 / tier) * 97);
    this.winChanceText.setText(`Win chance: ~${pct}%  ·  Payout: ${tier}× bet`);
  }
}

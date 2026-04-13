/**
 * @file DiceUI.ts
 * @purpose Phaser rendering for Dice — tier selector, animated dot dice, result display, HUD.
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

  private tierBgs:    Map<DiceTier, Phaser.GameObjects.Graphics> = new Map();
  private tierLabels: Map<DiceTier, Phaser.GameObjects.Text>    = new Map();
  private tierCenters: Map<DiceTier, { cx: number; cy: number }> = new Map();

  private diceGraphics: Phaser.GameObjects.Graphics[] = [];
  private rollBtn:      Phaser.GameObjects.Rectangle  | null = null;
  private rollLabel:    Phaser.GameObjects.Text       | null = null;
  private resultText:   Phaser.GameObjects.Text       | null = null;
  private winChanceText: Phaser.GameObjects.Text      | null = null;
  private homeButton:   Phaser.GameObjects.Text       | null = null;
  private spinTimer:    Phaser.Time.TimerEvent        | null = null;

  private readonly BET = 10;
  private readonly BTN_W = 92;
  private readonly BTN_H = 62;
  private readonly GAP   = 12;

  constructor(scene: Phaser.Scene, config: DiceConfig = {}) {
    this.scene  = scene;
    this.config = config;
  }

  public start(): void {
    this.cleanup();
    this.state = createDiceState(this.BET, 2);
    this.buildInstructions();
    this.buildTierSelector();
    this.buildDice();
    this.buildRollButton();
    this.buildHUD();
  }

  public cleanup(): void {
    this.spinTimer?.remove();
    for (const g of this.tierBgs.values())    g.destroy();
    for (const t of this.tierLabels.values())  t.destroy();
    this.tierBgs.clear();
    this.tierLabels.clear();
    this.tierCenters.clear();
    for (const g of this.diceGraphics) g.destroy();
    this.diceGraphics = [];
    this.rollBtn?.destroy();
    this.rollLabel?.destroy();
    this.resultText?.destroy();
    this.winChanceText?.destroy();
    this.homeButton?.destroy();
    this.state = null;
  }

  // ─── Build ────────────────────────────────────────────────────────────────

  private buildInstructions(): void {
    const { width, height } = this.scene.scale;

    this.scene.add.text(width / 2, height * 0.205, 'HOW TO PLAY', {
      fontFamily: '"Fredoka One", sans-serif',
      fontSize: '13px', color: '#333344', letterSpacing: 3,
    }).setOrigin(0.5);

    this.scene.add.text(width / 2, height * 0.235, 'Pick a multiplier → Roll → Win if lucky!', {
      fontFamily: '"Fredoka", sans-serif',
      fontSize: '12px', color: '#444455',
    }).setOrigin(0.5);
  }

  private buildTierSelector(): void {
    const { width, height } = this.scene.scale;
    const tiers: DiceTier[]  = [2, 5, 10];
    const tierLabels          = ['2×', '5×', '10×'];
    const total               = tiers.length * this.BTN_W + (tiers.length - 1) * this.GAP;
    const startX              = (width - total) / 2;
    const y                   = height * 0.315;

    this.scene.add.text(width / 2, y - 38, 'PICK YOUR MULTIPLIER', {
      fontFamily: '"Fredoka One", sans-serif',
      fontSize: '14px', color: '#444455', letterSpacing: 2,
    }).setOrigin(0.5);

    tiers.forEach((tier, i) => {
      const cx = startX + i * (this.BTN_W + this.GAP) + this.BTN_W / 2;

      const bg = this.scene.add.graphics();
      this.paintTierBtn(bg, cx, y, tier === this.state!.selectedTier);
      this.tierBgs.set(tier, bg);
      this.tierCenters.set(tier, { cx, cy: y });

      const label = this.scene.add.text(cx, y - 6, tierLabels[i], {
        fontFamily: '"Fredoka One", sans-serif',
        fontSize: '28px', color: tier === this.state!.selectedTier ? '#000000' : GOLD_STR,
      }).setOrigin(0.5).setDepth(2);
      this.tierLabels.set(tier, label);

      // Win % sub-label
      const pct = Math.round((1 / tier) * 97);
      this.scene.add.text(cx, y + 16, `${pct}% win`, {
        fontFamily: '"Fredoka", sans-serif',
        fontSize: '11px', color: tier === this.state!.selectedTier ? '#000000' : '#555566',
      }).setOrigin(0.5).setDepth(2);

      // Hit area
      this.scene.add.rectangle(cx, y, this.BTN_W, this.BTN_H, 0, 0)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.handleTierSelect(tier));
    });

    this.winChanceText = this.scene.add.text(width / 2, y + 46, '', {
      fontFamily: '"Fredoka", sans-serif', fontSize: '12px', color: '#555566',
    }).setOrigin(0.5);
    this.updateWinChanceText();
  }

  private paintTierBtn(
    g: Phaser.GameObjects.Graphics,
    cx: number, cy: number,
    selected: boolean
  ): void {
    g.clear();
    g.fillStyle(selected ? GOLD : DARK, 1);
    g.fillRoundedRect(cx - this.BTN_W / 2, cy - this.BTN_H / 2, this.BTN_W, this.BTN_H, 10);
    g.lineStyle(selected ? 0 : 1, GOLD, selected ? 0 : 0.2);
    if (!selected) g.strokeRoundedRect(cx - this.BTN_W / 2, cy - this.BTN_H / 2, this.BTN_W, this.BTN_H, 10);
  }

  private buildDice(): void {
    const { width, height } = this.scene.scale;
    const diceSize = 72;
    const gap = 18;
    const total = 3 * diceSize + 2 * gap;
    const startX = (width - total) / 2;
    const y = height * 0.545;

    for (let i = 0; i < 3; i++) {
      const cx = startX + i * (diceSize + gap) + diceSize / 2;
      const g  = this.scene.add.graphics().setDepth(2);
      this.drawDiceFace(g, cx, y, diceSize, 0); // 0 = blank/question
      this.diceGraphics.push(g);
    }
  }

  /** Draws a dice face with dots. val=0 means show a "?" */
  private drawDiceFace(
    g: Phaser.GameObjects.Graphics,
    cx: number, cy: number,
    size: number,
    val: number
  ): void {
    g.clear();
    const half = size / 2;
    const r    = size * 0.12; // corner radius
    const dot  = size * 0.09; // dot radius

    // Die body
    g.fillStyle(0xf0ece0, 1);
    g.fillRoundedRect(cx - half, cy - half, size, size, r * 2);

    // Border
    g.lineStyle(2, 0xc9a84c, 0.6);
    g.strokeRoundedRect(cx - half, cy - half, size, size, r * 2);

    if (val === 0) {
      // Blank/spinning — just show dim dot in center
      g.fillStyle(0xaaaaaa, 0.5);
      g.fillCircle(cx, cy, dot);
      return;
    }

    // Dot positions per face value
    const o = size * 0.27; // offset from center
    const dotPositions: [number, number][][] = [
      [],                                                         // 0 (unused)
      [[0, 0]],                                                   // 1
      [[-o, -o], [o, o]],                                        // 2
      [[-o, -o], [0, 0], [o, o]],                                // 3
      [[-o, -o], [o, -o], [-o, o], [o, o]],                     // 4
      [[-o, -o], [o, -o], [0, 0], [-o, o], [o, o]],             // 5
      [[-o, -o], [o, -o], [-o, 0], [o, 0], [-o, o], [o, o]],   // 6
    ];

    g.fillStyle(0x1a1a2a, 1);
    for (const [dx, dy] of dotPositions[val]) {
      g.fillCircle(cx + dx, cy + dy, dot);
    }
  }

  private buildRollButton(): void {
    const { width, height } = this.scene.scale;
    const cx = width / 2, cy = height * 0.70;

    this.rollBtn = this.scene.add.rectangle(cx, cy, 180, 56, GOLD)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.handleRoll())
      .on('pointerover', () => this.rollBtn?.setFillStyle(0xddb83a))
      .on('pointerout',  () => this.rollBtn?.setFillStyle(GOLD));

    this.rollLabel = this.scene.add.text(cx, cy, 'ROLL', {
      fontFamily: '"Fredoka One", sans-serif', fontSize: '26px', color: '#000000',
    }).setOrigin(0.5).setDepth(2);
  }

  private buildHUD(): void {
    const { width, height } = this.scene.scale;

    this.scene.add.text(16, 16, `BET: ${this.BET}`, {
      fontFamily: '"Fredoka One", sans-serif', fontSize: '18px', color: GOLD_STR,
    }).setDepth(10);

    this.resultText = this.scene.add.text(width / 2, height * 0.82, '', {
      fontFamily: '"Fredoka One", sans-serif', fontSize: '28px',
      color: '#ffffff', align: 'center',
    }).setOrigin(0.5).setDepth(10);

    this.homeButton = this.scene.add.text(width / 2, height - 16, '[ HOME ]', {
      fontFamily: '"Fredoka One", sans-serif', fontSize: '12px', color: '#333344',
    }).setOrigin(0.5).setDepth(10)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => { this.cleanup(); this.scene.scene.start('HomeScene'); });
  }

  // ─── Interaction ──────────────────────────────────────────────────────────

  private handleTierSelect(tier: DiceTier): void {
    if (!this.state || this.state.won !== null) return;
    selectTier(this.state, tier);

    // Repaint all tier buttons
    for (const [t, bg] of this.tierBgs) {
      const pos    = this.tierCenters.get(t)!;
      const sel    = t === tier;
      this.paintTierBtn(bg, pos.cx, pos.cy, sel);
      const lbl = this.tierLabels.get(t);
      if (lbl) lbl.setColor(sel ? '#000000' : GOLD_STR);
    }
    this.updateWinChanceText();
  }

  private handleRoll(): void {
    if (!this.state || this.state.isComplete) return;
    this.rollBtn?.disableInteractive();
    this.rollLabel?.setText('...');

    // Spin animation — cycle random faces
    let ticks = 0;
    const totalTicks = 18;
    this.spinTimer = this.scene.time.addEvent({
      delay: 55,
      repeat: totalTicks - 1,
      callback: () => {
        ticks++;
        for (let i = 0; i < 3; i++) {
          const { width } = this.scene.scale;
          const diceSize = 72;
          const gap      = 18;
          const total    = 3 * diceSize + 2 * gap;
          const startX   = (width - total) / 2;
          const cx       = startX + i * (diceSize + gap) + diceSize / 2;
          const cy       = this.scene.scale.height * 0.545;
          const randVal  = Math.floor(Math.random() * 6) + 1;
          this.drawDiceFace(this.diceGraphics[i], cx, cy, diceSize, randVal);
        }

        if (ticks >= totalTicks) {
          // Final roll
          rollDice(this.state!, this.config);
          const vals = this.state!.diceValues;
          const { width } = this.scene.scale;
          const diceSize = 72, gap2 = 18;
          const total2 = 3 * diceSize + 2 * gap2;
          const startX2 = (width - total2) / 2;
          for (let i = 0; i < 3; i++) {
            const cx2 = startX2 + i * (diceSize + gap2) + diceSize / 2;
            const cy2 = this.scene.scale.height * 0.545;
            this.drawDiceFace(this.diceGraphics[i], cx2, cy2, diceSize, vals[i]);
          }
          this.rollLabel?.setText('ROLL');
          this.showResult();
        }
      },
    });
  }

  private showResult(): void {
    if (!this.state) return;
    if (this.state.won) {
      this.resultText?.setText(`🎉 WIN!\n+${this.state.payout} credits`).setColor('#44ff88');
    } else {
      this.resultText?.setText('BETTER LUCK\nNEXT TIME').setColor('#ff4444');
    }
    this.scene.time.delayedCall(600, () => this.showPlayAgain());
  }

  private showPlayAgain(): void {
    const { width, height } = this.scene.scale;
    const btn = this.scene.add
      .rectangle(width / 2, height * 0.92, 180, 50, GOLD)
      .setInteractive({ useHandCursor: true }).setDepth(20);
    this.scene.add.text(width / 2, height * 0.92, 'PLAY AGAIN', {
      fontFamily: '"Fredoka One", sans-serif', fontSize: '14px', color: '#000000',
    }).setOrigin(0.5).setDepth(21);
    btn.on('pointerdown', () => { this.cleanup(); this.scene.scene.restart(); });
  }

  private updateWinChanceText(): void {
    if (!this.state || !this.winChanceText) return;
    const tier = this.state.selectedTier;
    const pct  = Math.round((1 / tier) * 97);
    this.winChanceText.setText(`Win ${pct}% of the time  ·  Pays ${tier}× your bet`);
  }
}

import * as Phaser from 'phaser';
import type { DiceConfig, DiceTier } from './DiceLogic';
import { createDiceState, rollDice, selectTier } from './DiceLogic';
import {
  COLOR_SURFACE,
  COLOR_BORDER,
  COLOR_GOLD,
  COLOR_TEXT,
  STR_GOLD,
  STR_DANGER,
  STR_SUCCESS,
  STR_TEXT,
  STR_MUTED,
  FONT_SIZE_XS,
  FONT_SIZE_SM,
  FONT_SIZE_LG,
  FONT_SIZE_XL,
  FONT_SIZE_2XL,
  TEXT_STYLE_LABEL,
  TEXT_STYLE_BODY,
  TEXT_STYLE_SEMIBOLD,
  TEXT_STYLE_GOLD_SEMIBOLD,
  TEXT_STYLE_WIN,
  BTN_PRIMARY_BG,
  BTN_PRIMARY_TEXT,
  BTN_PRIMARY_RADIUS,
  BTN_SECONDARY_BG,
  BTN_SECONDARY_BORDER,
  BTN_SECONDARY_RADIUS,
  TEXT_STYLE_BTN_PRIMARY,
  CANVAS_H,
  SAFE_TOP,
  drawButton
} from '../shared/ui/UITheme';

export class DiceUI {
  private scene: Phaser.Scene;
  private config: DiceConfig;
  private state: ReturnType<typeof createDiceState> | null = null;

  private tierBgs: Map<DiceTier, Phaser.GameObjects.Graphics> = new Map();
  private tierLabels: Map<DiceTier, Phaser.GameObjects.Text> = new Map();
  private tierCenters: Map<DiceTier, { cx: number; cy: number }> = new Map();

  private diceGraphics: Phaser.GameObjects.Graphics[] = [];
  private diceQuestionMarks: Map<Phaser.GameObjects.Graphics, Phaser.GameObjects.Text> = new Map();
  private rollBtnBg: Phaser.GameObjects.Graphics | null = null;
  private rollBtnInteractive: Phaser.GameObjects.Rectangle | null = null;
  private rollLabel: Phaser.GameObjects.Text | null = null;
  private resultText: Phaser.GameObjects.Text | null = null;
  private winChanceText: Phaser.GameObjects.Text | null = null;

  private spinTimer: Phaser.Time.TimerEvent | null = null;

  private readonly BET = 10;
  private readonly BTN_W = 96; // Slightly adjusted for Jett Casino aesthetic
  private readonly BTN_H = 64; // Slightly adjusted for Jett Casino aesthetic
  private readonly GAP = 12;

  constructor(scene: Phaser.Scene, config: DiceConfig = {}) {
    this.scene = scene;
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
    for (const g of this.tierBgs.values()) g.destroy();
    for (const t of this.tierLabels.values()) t.destroy();
    this.tierBgs.clear();
    this.tierLabels.clear();
    this.tierCenters.clear();
    for (const g of this.diceGraphics) {
      this.diceQuestionMarks.get(g)?.destroy();
      g.destroy();
    }
    this.diceGraphics = [];
    this.diceQuestionMarks.clear();
    this.rollBtnBg?.destroy();
    this.rollBtnInteractive?.destroy();
    this.rollLabel?.destroy();
    this.resultText?.destroy();
    this.winChanceText?.destroy();
    this.state = null;
  }

  // ─── Build ────────────────────────────────────────────────────────────────

  private buildInstructions(): void {
    const { width } = this.scene.scale;

    this.scene.add.text(width / 2, CANVAS_H * 0.235, 'PICK A MULTIPLIER → ROLL → WIN IF LUCKY!', {
      ...TEXT_STYLE_SEMIBOLD,
      fontSize: FONT_SIZE_LG,
      color: STR_GOLD,
    }).setOrigin(0.5);
  }

  private buildTierSelector(): void {
    const { width } = this.scene.scale;
    const tiers: DiceTier[] = [2, 5, 10];
    const tierLabels = ['2×', '5×', '10×'];
    const total = tiers.length * this.BTN_W + (tiers.length - 1) * this.GAP;
    const startX = (width - total) / 2;
    const y = CANVAS_H * 0.315;

    tiers.forEach((tier, i) => {
      const cx = startX + i * (this.BTN_W + this.GAP) + this.BTN_W / 2;

      const bg = this.scene.add.graphics();
      this.paintTierBtn(bg, cx, y, tier === this.state!.selectedTier);
      this.tierBgs.set(tier, bg);
      this.tierCenters.set(tier, { cx, cy: y });

      this.scene.add.text(cx, y - 32, '🎲', {
        ...TEXT_STYLE_BODY, // Use body style, then adjust size
        fontSize: FONT_SIZE_XL,
      }).setOrigin(0.5).setDepth(2);

      const label = this.scene.add.text(cx, y - 10, tierLabels[i], {
        ...TEXT_STYLE_GOLD_SEMIBOLD,
        fontSize: FONT_SIZE_2XL,
        color: tier === this.state!.selectedTier ? BTN_PRIMARY_TEXT : STR_GOLD,
      }).setOrigin(0.5).setDepth(2);
      this.tierLabels.set(tier, label);

      // Win % sub-label
      const pct = Math.round((1 / tier) * 96);
      this.scene.add.text(cx, y + 15, `${pct}% WIN`, {
        ...TEXT_STYLE_LABEL,
        color: tier === this.state!.selectedTier ? BTN_PRIMARY_TEXT : STR_MUTED,
        fontSize: FONT_SIZE_XS,
      }).setOrigin(0.5).setDepth(2);

      // Hit area
      this.scene.add.rectangle(cx, y, this.BTN_W, this.BTN_H, 0, 0)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.handleTierSelect(tier));
    });

    this.winChanceText = this.scene.add.text(width / 2, y + 46, '', {
      ...TEXT_STYLE_LABEL,
      fontSize: FONT_SIZE_SM,
    }).setOrigin(0.5);
    this.updateWinChanceText();
  }

  private paintTierBtn(
    g: Phaser.GameObjects.Graphics,
    cx: number, cy: number,
    selected: boolean
  ): void {
    g.clear();
    const cornerRadius = BTN_SECONDARY_RADIUS; // Use shared button radius
    const strokeAlpha = 1;

    if (selected) {
      g.fillStyle(BTN_PRIMARY_BG, 1);
      g.fillRoundedRect(cx - this.BTN_W / 2, cy - this.BTN_H / 2, this.BTN_W, this.BTN_H, cornerRadius);
    } else {
      g.fillStyle(BTN_SECONDARY_BG, 1);
      g.fillRoundedRect(cx - this.BTN_W / 2, cy - this.BTN_H / 2, this.BTN_W, this.BTN_H, cornerRadius);
      g.lineStyle(1.5, BTN_SECONDARY_BORDER, strokeAlpha); // Consistent border
      g.strokeRoundedRect(cx - this.BTN_W / 2, cy - this.BTN_H / 2, this.BTN_W, this.BTN_H, cornerRadius);
    }
  }

  private buildDice(): void {
    const { width } = this.scene.scale;
    const diceSize = 96;
    const gap = 18;
    const total = 3 * diceSize + 2 * gap;
    const startX = (width - total) / 2;
    const y = CANVAS_H * 0.545;

    for (let i = 0; i < 3; i++) {
      const cx = startX + i * (diceSize + gap) + diceSize / 2;
      const g = this.scene.add.graphics().setDepth(2);
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
    const r = size * 0.12; // corner radius
    const dot = size * 0.09; // dot radius

    // Die body
    g.fillStyle(COLOR_SURFACE, 1); // Use surface color for dice face
    g.fillRoundedRect(cx - half, cy - half, size, size, r * 2);

    // Border
    g.lineStyle(2, COLOR_BORDER, 1); // Subtle border
    g.strokeRoundedRect(cx - half, cy - half, size, size, r * 2);

    if (val === 0) {
      // Blank/spinning — show a slightly larger, more stylized '?'
      const questionMarkText = this.scene.add.text(cx, cy, '?', {
        ...TEXT_STYLE_SEMIBOLD, // Use a themed font
        fontSize: `${size * 0.6}px`,
        color: STR_MUTED, // Muted color for the question mark
      }).setOrigin(0.5).setDepth(3);
      this.diceQuestionMarks.set(g, questionMarkText);
      return;
    }

    // Dot positions per face value
    const o = size * 0.27; // offset from center
    const dotPositions: [number, number][][] = [
      [],
      [[0, 0]],
      [[-o, -o], [o, o]],
      [[-o, -o], [0, 0], [o, o]],
      [[-o, -o], [o, -o], [-o, o], [o, o]],
      [[-o, -o], [o, -o], [0, 0], [-o, o], [o, o]],
      [[-o, -o], [o, -o], [-o, 0], [o, 0], [-o, o], [o, o]],
    ];

    g.fillStyle(COLOR_TEXT, 1); // White dots
    for (const [dx, dy] of dotPositions[val]) {
      g.fillCircle(cx + dx, cy + dy, dot);
    }
  }

  private buildRollButton(): void {
    const { width } = this.scene.scale;
    const cx = width / 2, cy = CANVAS_H * 0.70;

    const btnWidth = 220;
    const btnHeight = 66;

    const { bg, text } = drawButton(this.scene, cx, cy, btnWidth, btnHeight, 'ROLL', 'primary');
    this.rollBtnBg = bg;
    this.rollLabel = text;

    this.rollBtnInteractive = this.scene.add.rectangle(cx, cy, btnWidth, btnHeight, 0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.handleRoll())
      .on('pointerover', () => {
        bg.clear();
        bg.fillStyle(COLOR_GOLD * 1.1, 1); // Slightly brighter gold on hover
        bg.fillRoundedRect(cx - btnWidth / 2, cy - btnHeight / 2, btnWidth, btnHeight, BTN_PRIMARY_RADIUS);
      })
      .on('pointerout', () => {
        bg.clear();
        bg.fillStyle(BTN_PRIMARY_BG, 1);
        bg.fillRoundedRect(cx - btnWidth / 2, cy - btnHeight / 2, btnWidth, btnHeight, BTN_PRIMARY_RADIUS);
      });
  }

  private buildHUD(): void {
    const { width } = this.scene.scale;

    this.scene.add.text(16, SAFE_TOP, `BET: ${this.BET}`, {
      ...TEXT_STYLE_SEMIBOLD,
      fontSize: FONT_SIZE_LG,
      color: STR_GOLD,
    }).setOrigin(0, 0.5).setDepth(10);

    this.resultText = this.scene.add.text(width / 2, CANVAS_H * 0.82, '', {
      ...TEXT_STYLE_WIN,
      color: STR_TEXT, // Default to text color, change on win/lose
      align: 'center',
    }).setOrigin(0.5).setDepth(10);
  }

  // ─── Interaction ──────────────────────────────────────────────────────────

  private handleTierSelect(tier: DiceTier): void {
    if (!this.state || this.state.won !== null) return;
    selectTier(this.state, tier);

    for (const [t, bg] of this.tierBgs) {
      const pos = this.tierCenters.get(t)!;
      const sel = t === tier;
      this.paintTierBtn(bg, pos.cx, pos.cy, sel);
      const lbl = this.tierLabels.get(t);
      if (lbl) lbl.setColor(sel ? BTN_PRIMARY_TEXT : STR_GOLD);
    }
    this.updateWinChanceText();
  }

  private handleRoll(): void {
    if (!this.state || this.state.isComplete) return;

    for (const g of this.diceGraphics) {
      this.diceQuestionMarks.get(g)?.destroy();
      this.diceQuestionMarks.delete(g);
    }

    this.rollBtnInteractive?.disableInteractive();
    this.rollLabel?.setText('ROLLING...');
    this.rollLabel?.setStyle({ ...TEXT_STYLE_BTN_PRIMARY, color: BTN_PRIMARY_TEXT });


    let ticks = 0;
    const totalTicks = 24;
    this.spinTimer = this.scene.time.addEvent({
      delay: 55,
      repeat: totalTicks - 1,
      callback: () => {
        ticks++;
        for (let i = 0; i < 3; i++) {
          const { width } = this.scene.scale;
          const diceSize = 96;
          const gap = 18;
          const total = 3 * diceSize + 2 * gap;
          const startX = (width - total) / 2;
          const cx = startX + i * (diceSize + gap) + diceSize / 2;
          const cy = this.scene.scale.height * 0.545;
          const randVal = Math.floor(Math.random() * 6) + 1;
          this.drawDiceFace(this.diceGraphics[i], cx, cy, diceSize, randVal);
        }

        if (ticks >= totalTicks) {
          this.scene.time.delayedCall(100, () => {
            rollDice(this.state!, this.config);
            const vals = this.state!.diceValues;
            const { width } = this.scene.scale;
            const diceSize = 96, gap2 = 18;
            const total2 = 3 * diceSize + 2 * gap2;
            const startX2 = (width - total2) / 2;
            for (let i = 0; i < 3; i++) {
              const cx2 = startX2 + i * (diceSize + gap2) + diceSize / 2;
              const cy2 = this.scene.scale.height * 0.545;
              this.drawDiceFace(this.diceGraphics[i], cx2, cy2, diceSize, vals[i]);
            }
            this.rollLabel?.setText('ROLL');
            this.rollLabel?.setStyle({ ...TEXT_STYLE_BTN_PRIMARY, color: BTN_PRIMARY_TEXT });

            this.showResult();
            this.scene.time.delayedCall(1500, () => this.showPlayAgain());
          });
        }
      },
    });
  }

  private showResult(): void {
    if (!this.state) return;
    if (this.state.won) {
      this.resultText?.setText(`🎉 WIN!\n+${this.state.payout} CREDITS`).setColor(STR_SUCCESS);
    } else {
      this.resultText?.setText('BETTER LUCK\nNEXT TIME').setColor(STR_DANGER);
    }
  }

  private showPlayAgain(): void {
    const { width } = this.scene.scale;
    const btnWidth = 200;
    const btnHeight = 56;
    const cx = width / 2;
    const cy = CANVAS_H * 0.92;

    const { bg, text } = drawButton(this.scene, cx, cy, btnWidth, btnHeight, 'PLAY AGAIN', 'primary');
    bg.setDepth(20);
    text.setDepth(21);

    const interactiveRect = this.scene.add
      .rectangle(cx, cy, btnWidth, btnHeight, 0, 0)
      .setInteractive({ useHandCursor: true }).setDepth(22); // Interactive above graphics and text
    interactiveRect.on('pointerdown', () => { this.cleanup(); this.scene.scene.restart(); });

    // Hover effect for play again button
    interactiveRect.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(COLOR_GOLD * 1.1, 1);
      bg.fillRoundedRect(cx - btnWidth / 2, cy - btnHeight / 2, btnWidth, btnHeight, BTN_PRIMARY_RADIUS);
    });
    interactiveRect.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(BTN_PRIMARY_BG, 1);
      bg.fillRoundedRect(cx - btnWidth / 2, cy - btnHeight / 2, btnWidth, btnHeight, BTN_PRIMARY_RADIUS);
    });
  }

  private updateWinChanceText(): void {
    if (!this.state || !this.winChanceText) return;
    const tier = this.state.selectedTier;
    const pct = Math.round((1 / tier) * 96);
    this.winChanceText.setText(`Win ${pct}% of the time  ·  Pays ${tier}× your bet`);
  }
}

/**
 * @file DiceDuelUI.ts
 * @purpose Phaser rendering for Dice Duel — player vs house dice game UI.
 *          Handles dice drawing, roll animation, double-down button, results.
 * @author Agent 934
 * @date 2026-04-16
 * @license Proprietary – available for licensing
 */

import * as Phaser from 'phaser';
import type { DiceDuelState, DuelOutcome } from './DiceDuelLogic';
import { createDiceDuelState, rollPlayerDice, doubleDown, resolveRound } from './DiceDuelLogic';
import { ProvablyFairRNG } from '../shared/rng/ProvablyFairRNG';

// ─── Constants ────────────────────────────────────────────────────────────────
const CANVAS_W    = 390;
const CANVAS_H    = 844;
const GOLD        = 0xc9a84c;
const GOLD_STR    = '#c9a84c';
const DARK        = 0x080812;
const DARK_STR    = '#080812';
const AMBER       = 0xff8c00;

const DICE_SIZE   = 96;
const DICE_GAP    = 14;
const DICE_TOTAL  = 3 * DICE_SIZE + 2 * DICE_GAP;
const DICE_START_X = (CANVAS_W - DICE_TOTAL) / 2;

const PLAYER_DICE_Y = 240;
const HOUSE_DICE_Y  = 520;

const FONT_TITLE  = '"Fredoka One", sans-serif';
const FONT_UI     = 'Arial, sans-serif';

// ─── DiceDuelUI ───────────────────────────────────────────────────────────────

export class DiceDuelUI {
  private scene: Phaser.Scene;
  private state:  DiceDuelState | null = null;
  private rng:    ProvablyFairRNG;

  // Dice graphics
  private playerDiceGfx: Phaser.GameObjects.Graphics[] = [];
  private houseDiceGfx:  Phaser.GameObjects.Graphics[] = [];
  private playerDiceText: Phaser.GameObjects.Text[] = [];
  private houseDiceText:  Phaser.GameObjects.Text[] = [];

  // HUD
  private playerTotalText: Phaser.GameObjects.Text | null = null;
  private houseTotalText:  Phaser.GameObjects.Text | null = null;
  private resultText:      Phaser.GameObjects.Text | null = null;
  private betText:         Phaser.GameObjects.Text | null = null;
  private balanceText:     Phaser.GameObjects.Text | null = null;

  // Buttons
  private rollBtn:    Phaser.GameObjects.Container | null = null;
  private rollLabel:  Phaser.GameObjects.Text      | null = null;
  private ddBtn:      Phaser.GameObjects.Container | null = null;
  private playAgainBtn: Phaser.GameObjects.Container | null = null;

  // State
  private balance:    number = 1000;
  private currentBet: number = 10;
  private spinning:   boolean = false;

  // Callbacks wired by scene

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.rng   = new ProvablyFairRNG(Date.now());
  }

  /**
   * Sets balance for display.
   * @param balance - Current balance.
   */
  public setBalance(balance: number): void {
    this.balance = balance;
    this.balanceText?.setText(`BAL: $${balance}`);
  }

  /**
   * Sets current bet.
   * @param bet - New bet amount.
   */
  public setBet(bet: number): void {
    this.currentBet = bet;
    this.betText?.setText(`BET: $${bet}`);
    if (this.state) this.state.bet = bet;
  }

  /**
   * Builds all UI elements and initializes the game state.
   */
  public start(): void {
    this.state = createDiceDuelState(this.currentBet);
    this.buildBackground();
    this.buildLabels();
    this.buildDiceRows();
    this.buildButtons();
    this.buildHUD();
  }

  /**
   * Destroys all Phaser objects owned by this UI.
   */
  public cleanup(): void {
    [...this.playerDiceGfx, ...this.houseDiceGfx].forEach(g => g.destroy());
    [...this.playerDiceText, ...this.houseDiceText].forEach(t => t.destroy());
    this.playerDiceGfx = [];
    this.houseDiceGfx  = [];
    this.playerDiceText = [];
    this.houseDiceText  = [];
    this.playerTotalText?.destroy();
    this.houseTotalText?.destroy();
    this.resultText?.destroy();
    this.betText?.destroy();
    this.balanceText?.destroy();
    this.rollBtn?.destroy();
    this.ddBtn?.destroy();
    this.playAgainBtn?.destroy();
    this.state = null;
  }

  // ─── Build helpers ─────────────────────────────────────────────────────────

  private buildBackground(): void {
    // Dark radial feel — two overlapping circles
    const bg = this.scene.add.graphics();
    bg.fillStyle(DARK, 1);
    bg.fillRect(0, 0, CANVAS_W, CANVAS_H);
    bg.fillStyle(0x1a0a00, 0.4);
    bg.fillCircle(CANVAS_W / 2, CANVAS_H * 0.35, 200);
    bg.fillStyle(0x001a0a, 0.3);
    bg.fillCircle(CANVAS_W / 2, CANVAS_H * 0.65, 200);
  }

  private buildLabels(): void {
    // Title
    this.scene.add.text(CANVAS_W / 2, 68, 'DICE DUEL', {
      fontFamily: FONT_TITLE, fontSize: '42px', color: GOLD_STR,
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(10);

    // YOU / HOUSE labels
    this.scene.add.text(CANVAS_W / 2, 170, 'YOU', {
      fontFamily: FONT_TITLE, fontSize: '22px', color: '#88aaff',
    }).setOrigin(0.5).setDepth(10);

    this.scene.add.text(CANVAS_W / 2, 390, 'VS', {
      fontFamily: FONT_TITLE, fontSize: '32px', color: GOLD_STR,
    }).setOrigin(0.5).setDepth(10);

    this.scene.add.text(CANVAS_W / 2, 450, 'HOUSE', {
      fontFamily: FONT_TITLE, fontSize: '22px', color: '#ff8888',
    }).setOrigin(0.5).setDepth(10);

    // Totals
    this.playerTotalText = this.scene.add.text(CANVAS_W / 2, 360, 'YOUR ROLL: —', {
      fontFamily: FONT_UI, fontSize: '16px', color: '#aaaaff',
    }).setOrigin(0.5).setDepth(10);

    this.houseTotalText = this.scene.add.text(CANVAS_W / 2, 640, 'HOUSE ROLL: —', {
      fontFamily: FONT_UI, fontSize: '16px', color: '#ffaaaa',
    }).setOrigin(0.5).setDepth(10);
  }

  private buildDiceRows(): void {
    // Player dice (face-down)
    for (let i = 0; i < 3; i++) {
      const x = DICE_START_X + i * (DICE_SIZE + DICE_GAP);
      const g = this.scene.add.graphics().setDepth(5);
      this.drawDiceFace(g, x, PLAYER_DICE_Y, 0);
      this.playerDiceGfx.push(g);

      const t = this.scene.add.text(x + DICE_SIZE / 2, PLAYER_DICE_Y + DICE_SIZE / 2, '?', {
        fontFamily: FONT_TITLE, fontSize: '40px', color: '#666677',
      }).setOrigin(0.5).setDepth(6);
      this.playerDiceText.push(t);
    }

    // House dice (face-down)
    for (let i = 0; i < 3; i++) {
      const x = DICE_START_X + i * (DICE_SIZE + DICE_GAP);
      const g = this.scene.add.graphics().setDepth(5);
      this.drawDiceFace(g, x, HOUSE_DICE_Y, 0);
      this.houseDiceGfx.push(g);

      const t = this.scene.add.text(x + DICE_SIZE / 2, HOUSE_DICE_Y + DICE_SIZE / 2, '?', {
        fontFamily: FONT_TITLE, fontSize: '40px', color: '#666677',
      }).setOrigin(0.5).setDepth(6);
      this.houseDiceText.push(t);
    }
  }

  private buildButtons(): void {
    // ROLL button
    const rollBg = this.scene.add.graphics();
    rollBg.fillStyle(GOLD, 1);
    rollBg.fillRoundedRect(0, 0, 220, 66, 14);

    const rollLbl = this.scene.add.text(110, 33, 'ROLL DICE', {
      fontFamily: FONT_TITLE, fontSize: '28px', color: DARK_STR,
    }).setOrigin(0.5);
    this.rollLabel = rollLbl;

    this.rollBtn = this.scene.add.container(CANVAS_W / 2 - 110, 700, [rollBg, rollLbl])
      .setSize(220, 66).setDepth(20)
      .setInteractive(new Phaser.Geom.Rectangle(0, 0, 220, 66), Phaser.Geom.Rectangle.Contains)
      .on('pointerdown', () => this.handleRoll())
      .on('pointerover', () => { rollBg.clear(); rollBg.fillStyle(0xddb83a, 1); rollBg.fillRoundedRect(0, 0, 220, 66, 14); })
      .on('pointerout',  () => { rollBg.clear(); rollBg.fillStyle(GOLD, 1); rollBg.fillRoundedRect(0, 0, 220, 66, 14); });

    // Result text
    this.resultText = this.scene.add.text(CANVAS_W / 2, 780, '', {
      fontFamily: FONT_TITLE, fontSize: '40px', color: '#ffffff',
      stroke: '#000000', strokeThickness: 6, align: 'center',
    }).setOrigin(0.5).setDepth(20);
  }

  private buildHUD(): void {
    this.betText = this.scene.add.text(16, 18, `BET: $${this.currentBet}`, {
      fontFamily: FONT_UI, fontSize: '16px', color: GOLD_STR,
    }).setOrigin(0, 0.5).setDepth(30);

    this.balanceText = this.scene.add.text(CANVAS_W - 16, 18, `BAL: $${this.balance}`, {
      fontFamily: FONT_UI, fontSize: '16px', color: GOLD_STR,
    }).setOrigin(1, 0.5).setDepth(30);
  }

  // ─── Dice drawing ─────────────────────────────────────────────────────────

  /**
   * Draws a single die face into a Graphics object.
   * @param g    - Graphics object to draw into.
   * @param x    - Top-left x of the die.
   * @param y    - Top-left y of the die.
   * @param val  - Value 1–6. 0 = face-down (dark with ?).
   */
  private drawDiceFace(g: Phaser.GameObjects.Graphics, x: number, y: number, val: number): void {
    g.clear();
    const r   = 12;
    const dot = DICE_SIZE * 0.09;
    const off = DICE_SIZE * 0.27;

    if (val === 0) {
      // Face down — dark background
      g.fillStyle(0x1a1a2e, 1);
      g.fillRoundedRect(x, y, DICE_SIZE, DICE_SIZE, r);
      g.lineStyle(3, GOLD, 0.5);
      g.strokeRoundedRect(x, y, DICE_SIZE, DICE_SIZE, r);
      return;
    }

    // Face up — white body
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(x, y, DICE_SIZE, DICE_SIZE, r);
    g.lineStyle(3, GOLD, 1);
    g.strokeRoundedRect(x, y, DICE_SIZE, DICE_SIZE, r);

    // Dots
    const cx = x + DICE_SIZE / 2;
    const cy = y + DICE_SIZE / 2;
    const positions: [number, number][][] = [
      [],
      [[0, 0]],
      [[-off, -off], [off, off]],
      [[-off, -off], [0, 0], [off, off]],
      [[-off, -off], [off, -off], [-off, off], [off, off]],
      [[-off, -off], [off, -off], [0, 0], [-off, off], [off, off]],
      [[-off, -off], [off, -off], [-off, 0], [off, 0], [-off, off], [off, off]],
    ];
    g.fillStyle(DARK, 1);
    for (const [dx, dy] of positions[val]) {
      g.fillCircle(cx + dx, cy + dy, dot);
    }
  }

  private updateDiceDisplay(
    gfxArr: Phaser.GameObjects.Graphics[],
    textArr: Phaser.GameObjects.Text[],
    yPos: number,
    values: number[]
  ): void {
    for (let i = 0; i < 3; i++) {
      const x = DICE_START_X + i * (DICE_SIZE + DICE_GAP);
      this.drawDiceFace(gfxArr[i], x, yPos, values[i]);
      textArr[i].setText(values[i] > 0 ? '' : '?');
    }
  }

  // ─── Interaction ──────────────────────────────────────────────────────────

  private handleRoll(): void {
    if (!this.state || this.spinning || this.state.phase !== 'bet') return;
    this.spinning = true;
    this.rollBtn?.disableInteractive();
    this.rollLabel?.setText('ROLLING...');

    // Animate player dice
    let ticks = 0;
    const totalTicks = 18;
    const timer = this.scene.time.addEvent({
      delay: 60,
      repeat: totalTicks - 1,
      callback: () => {
        ticks++;
        for (let i = 0; i < 3; i++) {
          const x = DICE_START_X + i * (DICE_SIZE + DICE_GAP);
          this.drawDiceFace(this.playerDiceGfx[i], x, PLAYER_DICE_Y, Phaser.Math.Between(1, 6));
          this.playerDiceText[i].setText('');
        }
        if (ticks >= totalTicks) {
          this.scene.time.delayedCall(80, () => {
            // Resolve player roll
            this.state = rollPlayerDice(this.state!, { rng: this.rng });
            this.updateDiceDisplay(this.playerDiceGfx, this.playerDiceText, PLAYER_DICE_Y, this.state.playerDice);
            this.playerTotalText?.setText(`YOUR ROLL: ${this.state.playerTotal}`);
            this.rollLabel?.setText('ROLL DICE');
            this.spinning = false;
            this.showDoubleDown();
          });
        }
      },
    });
    void timer;
  }

  private showDoubleDown(): void {
    if (!this.state) return;

    // Double down button
    const ddBg = this.scene.add.graphics();
    ddBg.fillStyle(AMBER, 1);
    ddBg.fillRoundedRect(0, 0, 200, 56, 12);

    const ddLbl = this.scene.add.text(100, 28, 'DOUBLE DOWN', {
      fontFamily: FONT_UI, fontSize: '18px', color: DARK_STR, fontStyle: 'bold',
    }).setOrigin(0.5);

    this.ddBtn = this.scene.add.container(CANVAS_W / 2 - 100, 760, [ddBg, ddLbl])
      .setSize(200, 56).setDepth(20)
      .setInteractive(new Phaser.Geom.Rectangle(0, 0, 200, 56), Phaser.Geom.Rectangle.Contains)
      .on('pointerdown', () => {
        if (!this.state) return;
        this.state = doubleDown(this.state);
        this.betText?.setText(`BET: $${this.state.bet} (DOUBLED!)`);
        this.ddBtn?.destroy();
        this.ddBtn = null;
        this.scene.time.delayedCall(300, () => this.resolveHouse());
      });

    // Auto-resolve after 4 seconds if no action
    this.scene.time.delayedCall(4000, () => {
      if (this.state?.phase === 'player_rolled') {
        this.ddBtn?.destroy();
        this.ddBtn = null;
        this.resolveHouse();
      }
    });
  }

  private resolveHouse(): void {
    if (!this.state) return;
    this.spinning = true;

    // Animate house dice
    let ticks = 0;
    const totalTicks = 18;
    const timer = this.scene.time.addEvent({
      delay: 60,
      repeat: totalTicks - 1,
      callback: () => {
        ticks++;
        for (let i = 0; i < 3; i++) {
          const x = DICE_START_X + i * (DICE_SIZE + DICE_GAP);
          this.drawDiceFace(this.houseDiceGfx[i], x, HOUSE_DICE_Y, Phaser.Math.Between(1, 6));
          this.houseDiceText[i].setText('');
        }
        if (ticks >= totalTicks) {
          this.scene.time.delayedCall(80, () => {
            this.state = resolveRound(this.state!, { rng: this.rng });
            this.updateDiceDisplay(this.houseDiceGfx, this.houseDiceText, HOUSE_DICE_Y, this.state.houseDice);
            this.houseTotalText?.setText(`HOUSE ROLL: ${this.state.houseTotal}`);
            this.spinning = false;
            this.showOutcome(this.state.outcome!);
          });
        }
      },
    });
    void timer;
  }

  private showOutcome(outcome: DuelOutcome): void {
    if (!this.state) return;

    // Update balance
    this.balance += this.state.payout - (this.state.doubledDown ? this.state.bet : this.currentBet * (this.state.doubledDown ? 2 : 1));
    // Simpler: just show win/lose amount
    const profit = this.state.payout - this.state.bet;

    if (!outcome) return;
    const msgs: Record<NonNullable<DuelOutcome>, string> = {
      win:  `🎉 YOU WIN!\n+$${this.state.payout - (this.currentBet * (this.state.doubledDown ? 2 : 1))} CREDITS`,
      lose: `💀 HOUSE WINS`,
      push: `🤝 PUSH\nBET RETURNED`,
    };
    const colors: Record<NonNullable<DuelOutcome>, string> = {
      win:  '#44ff88',
      lose: '#ff4444',
      push: '#ffdd44',
    };

    this.resultText?.setText(msgs[outcome as NonNullable<DuelOutcome>]).setColor(colors[outcome as NonNullable<DuelOutcome>]);
    this.balanceText?.setText(`BAL: $${this.balance}`);

    // Flash dice on outcome
    const targetGfx = outcome === 'win' ? this.playerDiceGfx : this.houseDiceGfx;
    const flashColor = outcome === 'win' ? 0x44ff88 : 0xff4444;
    if (outcome !== 'push') {
      targetGfx.forEach(g => {
        this.scene.tweens.add({
          targets: g, alpha: 0.4, duration: 150, yoyo: true, repeat: 3,
          onComplete: () => g.setAlpha(1),
        });
      });
    }

    // Play Again
    this.scene.time.delayedCall(800, () => this.showPlayAgain());
    void profit;
    void flashColor;
  }

  private showPlayAgain(): void {
    const bg = this.scene.add.graphics().setDepth(25);
    bg.fillStyle(GOLD, 1);
    bg.fillRoundedRect(CANVAS_W / 2 - 100, CANVAS_H - 70, 200, 54, 12);

    this.scene.add.text(CANVAS_W / 2, CANVAS_H - 43, 'PLAY AGAIN', {
      fontFamily: FONT_TITLE, fontSize: '22px', color: DARK_STR,
    }).setOrigin(0.5).setDepth(26)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.scene.restart());
  }
}

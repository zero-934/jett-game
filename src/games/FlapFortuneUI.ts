/**
 * @file FlapFortuneUI.ts
 * @purpose Phaser rendering for Flap Fortune — Mario aesthetic with red pipes,
 *          scrolling landscape background, bird player, combustion FX, HUD.
 * @author Agent 934
 * @date 2026-04-12
 * @license Proprietary – available for licensing
 */

import * as Phaser from 'phaser';
import type { FlapFortuneConfig } from './FlapFortuneLogic';
import { createFlapFortuneState, tickFlapFortune, cashOutFlapFortune } from './FlapFortuneLogic';

const GOLD     = 0xc9a84c;
const GOLD_STR = '#c9a84c';

// Mario palette
const SKY_TOP    = 0x5c94fc; // classic Mario sky blue
const SKY_BOT    = 0x8cb8ff;
const GROUND_COL = 0x8b4513;
const GRASS_COL  = 0x3cb043;
const PIPE_GREEN = 0xcc0000; // RED pipes (not green)
const PIPE_DARK  = 0x880000;
const PIPE_LIGHT = 0xff4444;
const CLOUD_COL  = 0xffffff;
const BIRD_COL   = 0xffdd44;

export class FlapFortuneUI {
  private scene: Phaser.Scene;
  private config: FlapFortuneConfig;
  private state: ReturnType<typeof createFlapFortuneState> | null = null;

  // Background layers
  private bgGraphics: Phaser.GameObjects.Graphics | null = null;
  private clouds: { x: number; y: number; w: number }[] = [];
  private groundScrollX = 0;

  // Player
  private birdBody:  Phaser.GameObjects.Arc       | null = null;
  private birdWing:  Phaser.GameObjects.Ellipse   | null = null;
  private birdEye:   Phaser.GameObjects.Arc       | null = null;

  // Pipes graphics pool
  private pipeGraphics: Phaser.GameObjects.Graphics[] = [];

  // HUD
  private multiplierText: Phaser.GameObjects.Text      | null = null;
  private distanceText:   Phaser.GameObjects.Text      | null = null;
  private statusText:     Phaser.GameObjects.Text      | null = null;
  private cashOutButton:  Phaser.GameObjects.Rectangle | null = null;
  private cashOutLabel:   Phaser.GameObjects.Text      | null = null;
  private homeButton:     Phaser.GameObjects.Text      | null = null;
  private pipesText:      Phaser.GameObjects.Text      | null = null;

  private isFlapping = false;
  private tickTimer: Phaser.Time.TimerEvent | null = null;
  private wingAngle = 0;

  constructor(scene: Phaser.Scene, config: FlapFortuneConfig) {
    this.scene  = scene;
    this.config = config;
  }

  public start(bet: number): void {
    this.cleanup();
    this.state = createFlapFortuneState(bet, this.config);
    this.buildBackground();
    this.buildBird();
    this.buildHUD();
    this.registerInput();
    this.tickTimer = this.scene.time.addEvent({
      delay: 16,
      loop: true,
      callback: this.onTick,
      callbackScope: this,
    });
  }

  public cleanup(): void {
    this.tickTimer?.remove();
    this.tickTimer = null;
    this.bgGraphics?.destroy();
    this.birdBody?.destroy();
    this.birdWing?.destroy();
    this.birdEye?.destroy();
    for (const g of this.pipeGraphics) g.destroy();
    this.pipeGraphics = [];
    this.multiplierText?.destroy();
    this.distanceText?.destroy();
    this.statusText?.destroy();
    this.cashOutButton?.destroy();
    this.cashOutLabel?.destroy();
    this.homeButton?.destroy();
    this.pipesText?.destroy();
    this.state = null;
  }

  // ─── Build ────────────────────────────────────────────────────────────────

  private buildBackground(): void {
    const { worldWidth, worldHeight } = this.config;
    this.bgGraphics = this.scene.add.graphics();

    // Clouds
    this.clouds = [];
    for (let i = 0; i < 6; i++) {
      this.clouds.push({
        x: Math.random() * worldWidth,
        y: 60 + Math.random() * (worldHeight * 0.35),
        w: 50 + Math.random() * 60,
      });
    }
  }

  private buildBird(): void {
    const bx = 80;
    const by = this.config.worldHeight / 2;

    this.birdBody = this.scene.add.arc(bx, by, 14, 0, 360, false, BIRD_COL);
    this.birdWing = this.scene.add.ellipse(bx - 6, by - 4, 16, 10, 0xff8800);
    this.birdEye  = this.scene.add.arc(bx + 6, by - 4, 4, 0, 360, false, 0x000000);
    // Beak
    this.scene.add.triangle(bx + 12, by, 0, -3, 0, 3, 10, 0, 0xff6600);
  }

  private buildHUD(): void {
    const { worldWidth, worldHeight } = this.config;

    this.multiplierText = this.scene.add
      .text(16, 16, 'x1.00', {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: GOLD_STR,
        stroke: '#000000',
        strokeThickness: 3,
      }).setDepth(10);

    this.pipesText = this.scene.add
      .text(16, 46, 'PIPES: 0', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 2,
      }).setDepth(10);

    this.distanceText = this.scene.add
      .text(16, 66, 'DIST: 0', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#cccccc',
        stroke: '#000000',
        strokeThickness: 2,
      }).setDepth(10);

    this.statusText = this.scene.add
      .text(worldWidth / 2, worldHeight * 0.4, '', {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(10);

    this.cashOutButton = this.scene.add
      .rectangle(worldWidth - 70, 30, 124, 44, GOLD)
      .setInteractive({ useHandCursor: true })
      .setDepth(10)
      .on('pointerdown', () => this.handleCashOut());

    this.cashOutLabel = this.scene.add
      .text(worldWidth - 70, 30, 'CASH OUT', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#0d0d0d',
      })
      .setOrigin(0.5)
      .setDepth(10);

    this.homeButton = this.scene.add
      .text(worldWidth / 2, worldHeight - 16, '[ HOME ]', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(10)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.cleanup();
        this.scene.scene.start('HomeScene');
      });
  }

  private registerInput(): void {
    this.scene.input.on('pointerdown', () => { this.isFlapping = true; });
    this.scene.input.on('pointerup',   () => { this.isFlapping = false; });
    this.scene.input.keyboard?.on('keydown-SPACE', () => { this.isFlapping = true; });
    this.scene.input.keyboard?.on('keyup-SPACE',   () => { this.isFlapping = false; });
  }

  // ─── Tick ─────────────────────────────────────────────────────────────────

  private onTick(): void {
    if (!this.state) return;

    if (this.state.isAlive && !this.state.cashedOut) {
      tickFlapFortune(this.state, this.isFlapping, this.config);
      this.isFlapping = false;
      this.groundScrollX = (this.groundScrollX + (this.config.scrollSpeed ?? 3)) % (this.config.worldWidth);
    }

    this.renderBackground();
    this.renderPipes();
    this.renderBird();
    this.updateHUD();

    if (!this.state.isAlive) {
      this.tickTimer?.remove();
      this.tickTimer = null;
      if (this.state.combusted) {
        this.triggerCombustion();
      } else {
        this.statusText?.setText('GAME OVER\nFLAP HARDER!').setColor('#ff4444');
        this.scene.time.delayedCall(600, () => this.showPlayAgain());
      }
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  private renderBackground(): void {
    const { worldWidth, worldHeight } = this.config;
    if (!this.bgGraphics) return;

    this.bgGraphics.clear();

    // Sky gradient
    this.bgGraphics.fillGradientStyle(SKY_TOP, SKY_TOP, SKY_BOT, SKY_BOT, 1);
    this.bgGraphics.fillRect(0, 0, worldWidth, worldHeight * 0.85);

    // Clouds
    for (const cloud of this.clouds) {
      cloud.x -= 0.4;
      if (cloud.x < -cloud.w) cloud.x = worldWidth + cloud.w;
      this.drawCloud(cloud.x, cloud.y, cloud.w);
    }

    // Hills (rolling landscape)
    this.bgGraphics.fillStyle(0x4a8a28, 0.7);
    const hillY = worldHeight * 0.78;
    for (let hx = -this.groundScrollX * 0.3; hx < worldWidth + 120; hx += 160) {
      this.bgGraphics.fillEllipse(hx, hillY, 180, 80);
    }
    for (let hx = -this.groundScrollX * 0.2 + 80; hx < worldWidth + 120; hx += 200) {
      this.bgGraphics.fillEllipse(hx, hillY + 10, 140, 60);
    }

    // Ground strip
    this.bgGraphics.fillStyle(GROUND_COL, 1);
    this.bgGraphics.fillRect(0, worldHeight * 0.85, worldWidth, worldHeight * 0.15);
    this.bgGraphics.fillStyle(GRASS_COL, 1);
    this.bgGraphics.fillRect(0, worldHeight * 0.85, worldWidth, 12);

    // Scrolling ground tiles
    this.bgGraphics.fillStyle(0x6b3410, 1);
    const tileW = 40;
    const tileOffset = this.groundScrollX % tileW;
    for (let gx = -tileOffset; gx < worldWidth; gx += tileW) {
      this.bgGraphics.fillRect(gx, worldHeight * 0.85 + 14, tileW - 2, 20);
    }
  }

  private drawCloud(cx: number, cy: number, w: number): void {
    if (!this.bgGraphics) return;
    this.bgGraphics.fillStyle(CLOUD_COL, 0.9);
    this.bgGraphics.fillEllipse(cx,           cy,      w,       w * 0.5);
    this.bgGraphics.fillEllipse(cx - w * 0.3, cy + 6,  w * 0.7, w * 0.4);
    this.bgGraphics.fillEllipse(cx + w * 0.3, cy + 6,  w * 0.6, w * 0.35);
  }

  private renderPipes(): void {
    if (!this.state) return;
    const { worldHeight } = this.config;
    const pipeW = 30;

    // Ensure enough graphics objects
    while (this.pipeGraphics.length < this.state.pipes.length) {
      this.pipeGraphics.push(this.scene.add.graphics());
    }

    for (let i = 0; i < this.pipeGraphics.length; i++) {
      const g = this.pipeGraphics[i];
      g.clear();
      if (i >= this.state.pipes.length) continue;

      const pipe = this.state.pipes[i];

      // ── Top pipe ──────────────────────────────────────
      // Pipe shaft
      g.fillStyle(PIPE_GREEN, 1);
      g.fillRect(pipe.x, 0, pipeW, pipe.topHeight - 8);
      // Pipe cap
      g.fillStyle(PIPE_DARK, 1);
      g.fillRect(pipe.x - 3, pipe.topHeight - 16, pipeW + 6, 16);
      // Highlight
      g.fillStyle(PIPE_LIGHT, 0.5);
      g.fillRect(pipe.x + 3, 0, 5, pipe.topHeight - 8);

      // ── Bottom pipe ────────────────────────────────────
      const botY = worldHeight - pipe.bottomHeight;
      g.fillStyle(PIPE_GREEN, 1);
      g.fillRect(pipe.x, botY + 8, pipeW, pipe.bottomHeight);
      g.fillStyle(PIPE_DARK, 1);
      g.fillRect(pipe.x - 3, botY, pipeW + 6, 16);
      g.fillStyle(PIPE_LIGHT, 0.5);
      g.fillRect(pipe.x + 3, botY + 8, 5, pipe.bottomHeight);
    }
  }

  private renderBird(): void {
    if (!this.state || !this.birdBody || !this.birdWing || !this.birdEye) return;

    const by = this.state.playerY;
    const tilt = Phaser.Math.Clamp(this.state.playerVelocityY * 3, -30, 45);

    this.birdBody.setPosition(80, by);
    this.birdEye.setPosition(86, by - 4);

    // Animated wing flap
    this.wingAngle = Math.sin(this.scene.time.now / 80) * 20;
    this.birdWing.setPosition(74, by - 4 + Math.sin(this.scene.time.now / 80) * 4);
    this.birdWing.setAngle(this.wingAngle);

    this.birdBody.setAngle(tilt);
    this.birdEye.setAngle(tilt);
  }

  private updateHUD(): void {
    if (!this.state) return;
    this.multiplierText?.setText(`x${this.state.multiplier.toFixed(2)}`);
    this.pipesText?.setText(`PIPES: ${this.state.pipesCleared}`);
    this.distanceText?.setText(`DIST: ${Math.floor(this.state.distanceTravelled)}`);
  }

  // ─── Actions ──────────────────────────────────────────────────────────────

  private handleCashOut(): void {
    if (!this.state) return;
    const payout = cashOutFlapFortune(this.state);
    this.tickTimer?.remove();
    this.tickTimer = null;
    this.statusText?.setText(`PAID OUT\n${payout.toFixed(2)} credits`).setColor(GOLD_STR);
    this.scene.time.delayedCall(600, () => this.showPlayAgain());
  }

  private showPlayAgain(): void {
    const { worldWidth, worldHeight } = this.config;
    const btn = this.scene.add
      .rectangle(worldWidth / 2, worldHeight * 0.55, 180, 50, GOLD)
      .setInteractive({ useHandCursor: true })
      .setDepth(20);
    this.scene.add
      .text(worldWidth / 2, worldHeight * 0.55, 'PLAY AGAIN', {
        fontFamily: 'monospace', fontSize: '14px', color: '#0d0d0d',
      })
      .setOrigin(0.5).setDepth(21);
    btn.on('pointerdown', () => { this.cleanup(); this.scene.scene.restart(); });
  }

  private triggerCombustion(): void {
    const bx = 80;
    const by = this.state?.playerY ?? this.config.worldHeight / 2;

    for (let ring = 0; ring < 3; ring++) {
      const circle = this.scene.add.arc(bx, by, 10, 0, 360, false, 0xff6600, 0.9);
      this.scene.tweens.add({
        targets: circle,
        scaleX: (ring + 1) * 4,
        scaleY: (ring + 1) * 4,
        alpha: 0,
        duration: 450 + ring * 120,
        delay: ring * 80,
        onComplete: () => circle.destroy(),
      });
    }

    if (this.birdBody) this.birdBody.fillColor = 0xff4400;

    this.scene.time.delayedCall(250, () => {
      this.statusText?.setText('COMBUSTION!\nWINGS FAILED').setColor('#ff6600');
      this.scene.time.delayedCall(600, () => this.showPlayAgain());
    });
  }
}

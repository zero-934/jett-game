/**
 * @file JettUI.ts
 * @purpose Phaser rendering for Jett — space background with stars/planets, stick figure
 *          with jetpack, android obstacle sprites, endless vertical camera scroll,
 *          combustion explosion FX, and HUD.
 * @author Agent 934
 * @date 2026-04-12
 * @license Proprietary – available for licensing
 */

import * as Phaser from 'phaser';
import type { JettConfig, JettObstacle } from './JettLogic';
import { createJettState, tickJett, cashOutJett } from './JettLogic';

const GOLD      = 0xc9a84c;
const GOLD_STR  = '#c9a84c';

export class JettUI {
  private scene: Phaser.Scene;
  private config: JettConfig;

  // Player parts
  private playerHead:  Phaser.GameObjects.Arc        | null = null;
  private playerBody:  Phaser.GameObjects.Rectangle  | null = null;
  private playerPack:  Phaser.GameObjects.Rectangle  | null = null;
  private flameGroup:  Phaser.GameObjects.Group      | null = null;
  private playerScreenX = 0;
  private playerScreenY = 0;

  // World / camera
  private cameraOffsetY = 0; // how many world units the camera has scrolled

  // Background layers
  private starGraphics: Phaser.GameObjects.Graphics | null = null;
  private stars: { x: number; y: number; r: number; twinkle: number }[] = [];
  private bgPlanet: Phaser.GameObjects.Arc   | null = null;
  private bgPlanet2: Phaser.GameObjects.Arc  | null = null;

  // Android obstacle graphics pool
  private androidPool: Map<number, Phaser.GameObjects.Graphics> = new Map();

  // HUD
  private multiplierText: Phaser.GameObjects.Text | null = null;
  private altitudeText:   Phaser.GameObjects.Text | null = null;
  private statusText:     Phaser.GameObjects.Text | null = null;
  private cashOutButton:  Phaser.GameObjects.Rectangle | null = null;
  private cashOutLabel:   Phaser.GameObjects.Text | null = null;
  private homeButton:     Phaser.GameObjects.Text | null = null;

  private pointerX   = 0;
  private tickTimer: Phaser.Time.TimerEvent | null = null;
  private state: ReturnType<typeof createJettState> | null = null;

  constructor(scene: Phaser.Scene, config: JettConfig) {
    this.scene  = scene;
    this.config = config;
    this.playerScreenX = config.worldWidth  / 2;
    this.playerScreenY = config.screenHeight * 0.65; // player sits at 65% down screen
    this.pointerX      = config.worldWidth  / 2;
  }

  /** Start a new game with the given bet. */
  public start(bet: number): void {
    this.cleanup();
    this.state         = createJettState(bet, this.config);
    this.cameraOffsetY = 0;
    this.buildBackground();
    this.buildPlayer();
    this.buildHUD();
    this.registerInput();
    this.tickTimer = this.scene.time.addEvent({
      delay: 16,
      loop: true,
      callback: this.onTick,
      callbackScope: this,
    });
  }

  /** Destroy all managed game objects. */
  public cleanup(): void {
    this.tickTimer?.remove();
    this.tickTimer = null;
    this.playerHead?.destroy();
    this.playerBody?.destroy();
    this.playerPack?.destroy();
    this.flameGroup?.destroy(true);
    this.starGraphics?.destroy();
    this.bgPlanet?.destroy();
    this.bgPlanet2?.destroy();
    for (const g of this.androidPool.values()) g.destroy();
    this.androidPool.clear();
    this.multiplierText?.destroy();
    this.altitudeText?.destroy();
    this.statusText?.destroy();
    this.cashOutButton?.destroy();
    this.cashOutLabel?.destroy();
    this.homeButton?.destroy();
    this.state = null;
  }

  // ─── Build ────────────────────────────────────────────────────────────────

  private buildBackground(): void {
    const { worldWidth, screenHeight } = this.config;

    // Static star field (redrawn each frame for parallax)
    this.starGraphics = this.scene.add.graphics();
    this.stars = [];
    for (let i = 0; i < 120; i++) {
      this.stars.push({
        x: Math.random() * worldWidth,
        y: Math.random() * screenHeight,
        r: Math.random() < 0.15 ? 1.5 : 0.7,
        twinkle: Math.random() * Math.PI * 2,
      });
    }

    // Background planets (decorative)
    this.bgPlanet = this.scene.add.arc(
      worldWidth * 0.8, screenHeight * 0.2, 38, 0, 360, false, 0x3355aa, 0.5
    );
    this.bgPlanet2 = this.scene.add.arc(
      worldWidth * 0.15, screenHeight * 0.4, 18, 0, 360, false, 0x883333, 0.4
    );
  }

  private buildPlayer(): void {
    const x = this.playerScreenX;
    const y = this.playerScreenY;

    // Jetpack (behind body)
    this.playerPack = this.scene.add.rectangle(x + 6, y + 2, 10, 20, 0x555577);

    // Body
    this.playerBody = this.scene.add.rectangle(x, y, 8, 20, GOLD);

    // Head
    this.playerHead = this.scene.add.arc(x, y - 16, 7, 0, 360, false, GOLD);

    // Flame group
    this.flameGroup = this.scene.add.group();
  }

  private buildHUD(): void {
    const { worldWidth } = this.config;

    this.multiplierText = this.scene.add
      .text(16, 16, 'x1.00', {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: GOLD_STR,
      })
      .setDepth(10);

    this.altitudeText = this.scene.add
      .text(16, 46, 'ALT: 0m', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#888888',
      })
      .setDepth(10);

    this.statusText = this.scene.add
      .text(worldWidth / 2, this.config.screenHeight * 0.35, '', {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#ffffff',
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
      .text(worldWidth / 2, this.config.screenHeight - 16, '[ HOME ]', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#444444',
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
    this.scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      this.pointerX = p.x;
    });
    this.scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.pointerX = p.x;
    });
  }

  // ─── Tick ─────────────────────────────────────────────────────────────────

  private onTick(): void {
    if (!this.state) return;

    if (this.state.isAlive && !this.state.cashedOut) {
      tickJett(this.state, this.pointerX, this.config);
      // Camera follows player — offset increases with altitude
      this.cameraOffsetY = this.state.altitude;
    }

    this.renderStars();
    this.renderPlanets();
    this.renderAndroidsFromState();
    this.renderPlayer();
    this.renderFlame();
    this.updateHUD();

    if (!this.state.isAlive) {
      this.tickTimer?.remove();
      this.tickTimer = null;
      if (this.state.combusted) {
        this.triggerCombustion();
      } else {
        this.statusText?.setText('COLLISION\nGAME OVER').setColor('#ff4444');
      }
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  private renderStars(): void {
    if (!this.starGraphics) return;
    const { worldWidth, screenHeight } = this.config;
    this.starGraphics.clear();
    const t = this.scene.time.now / 1000;
    for (const star of this.stars) {
      const alpha = 0.4 + 0.4 * Math.sin(star.twinkle + t * 1.2);
      // Slow parallax: stars drift upward slightly as player ascends
      const parallaxY = ((star.y - (this.cameraOffsetY * 0.05)) % screenHeight + screenHeight) % screenHeight;
      this.starGraphics.fillStyle(0xffffff, alpha);
      this.starGraphics.fillCircle(star.x, parallaxY, star.r);
    }
    // Grid lines for space feel
    this.starGraphics.lineStyle(0.5, 0x1a1a3a, 0.4);
    const gridSize = 80;
    const gridOffY = ((this.cameraOffsetY * 0.3) % gridSize);
    for (let gy = -gridOffY; gy < screenHeight + gridSize; gy += gridSize) {
      this.starGraphics.beginPath();
      this.starGraphics.moveTo(0, gy);
      this.starGraphics.lineTo(worldWidth, gy);
      this.starGraphics.strokePath();
    }
    for (let gx = 0; gx < worldWidth + gridSize; gx += gridSize) {
      this.starGraphics.beginPath();
      this.starGraphics.moveTo(gx, 0);
      this.starGraphics.lineTo(gx, screenHeight);
      this.starGraphics.strokePath();
    }
  }

  private renderPlanets(): void {
    if (!this.bgPlanet || !this.bgPlanet2 || !this.state) return;
    // Planets scroll slowly upward (parallax layer)
    this.bgPlanet.y  = (this.config.screenHeight * 0.2 - this.state.altitude * 0.02 % this.config.screenHeight + this.config.screenHeight) % this.config.screenHeight;
    this.bgPlanet2.y = (this.config.screenHeight * 0.4 - this.state.altitude * 0.015 % this.config.screenHeight + this.config.screenHeight) % this.config.screenHeight;
  }

  private renderAndroidsFromState(): void {
    if (!this.state) return;
    const { screenHeight } = this.config;
    const playerAltitude = this.state.altitude;

    // Track which obstacle ids are still active
    const activeIds = new Set(this.state.obstacles.map(o => o.id));

    // Remove obsolete graphics
    for (const [id, g] of this.androidPool) {
      if (!activeIds.has(id)) {
        g.destroy();
        this.androidPool.delete(id);
      }
    }

    // Draw each obstacle as an android figure
    for (const obs of this.state.obstacles) {
      // Convert world Y to screen Y
      // World Y increases upward; screen Y increases downward
      const screenY = this.playerScreenY - (obs.y - playerAltitude);

      // Skip if off screen
      if (screenY < -60 || screenY > screenHeight + 60) continue;

      let g = this.androidPool.get(obs.id);
      if (!g) {
        g = this.scene.add.graphics();
        this.androidPool.set(obs.id, g);
      }

      this.drawAndroidWall(g, obs, screenY);
    }
  }

  private drawAndroidWall(
    g: Phaser.GameObjects.Graphics,
    obs: JettObstacle,
    screenY: number
  ): void {
    g.clear();

    if (obs.width < 2) return;

    const h = obs.height;
    const segW = 32; // width of each android figure
    const count = Math.floor(obs.width / segW);

    for (let i = 0; i < count; i++) {
      const ax = obs.x + i * segW + segW / 2;
      const ay = screenY;

      // Android body (torso rectangle)
      g.fillStyle(0x2244aa, 1);
      g.fillRect(ax - 8, ay - h / 2 + 4, 16, 18);

      // Android head (rounded)
      g.fillStyle(0x3366cc, 1);
      g.fillRoundedRect(ax - 7, ay - h / 2 - 10, 14, 12, 3);

      // Eyes (red LEDs)
      g.fillStyle(0xff2222, 1);
      g.fillRect(ax - 5, ay - h / 2 - 7, 3, 2);
      g.fillRect(ax + 2,  ay - h / 2 - 7, 3, 2);

      // Antenna
      g.lineStyle(1, 0x4488ff, 1);
      g.beginPath();
      g.moveTo(ax, ay - h / 2 - 10);
      g.lineTo(ax, ay - h / 2 - 16);
      g.strokePath();
      g.fillStyle(0x4488ff, 1);
      g.fillCircle(ax, ay - h / 2 - 16, 2);

      // Legs
      g.fillStyle(0x2244aa, 1);
      g.fillRect(ax - 7, ay - h / 2 + 22, 5, 8);
      g.fillRect(ax + 2,  ay - h / 2 + 22, 5, 8);
    }
  }

  private renderPlayer(): void {
    if (!this.state) return;
    const { worldWidth } = this.config;
    const screenX = this.playerScreenX + (this.state.playerX - worldWidth / 2);

    this.playerBody?.setPosition(screenX, this.playerScreenY);
    this.playerHead?.setPosition(screenX, this.playerScreenY - 16);
    this.playerPack?.setPosition(screenX + 8, this.playerScreenY + 2);

    // Tilt head/body slightly toward movement direction
    const tilt = Phaser.Math.Clamp((this.state.playerX - worldWidth / 2) / 80, -12, 12);
    this.playerBody?.setAngle(tilt);
    this.playerHead?.setAngle(tilt);
  }

  private renderFlame(): void {
    if (!this.state || !this.flameGroup) return;
    this.flameGroup.clear(true, true);

    if (!this.state.isAlive) return;

    const { worldWidth } = this.config;
    const screenX = this.playerScreenX + (this.state.playerX - worldWidth / 2);
    const flameY  = this.playerScreenY + 16;
    const t       = this.scene.time.now;

    // Animated flame beneath jetpack
    const flameH = 14 + Math.sin(t / 60) * 6;
    const flameW = 6 + Math.sin(t / 40) * 2;

    const flame = this.scene.add.triangle(
      screenX + 8, flameY,
      -flameW / 2, 0,
      flameW / 2,  0,
      0,           flameH,
      0xff6600
    );
    const innerFlame = this.scene.add.triangle(
      screenX + 8, flameY,
      -flameW / 4, 0,
      flameW / 4,  0,
      0,           flameH * 0.6,
      0xffcc00
    );

    this.flameGroup.add(flame);
    this.flameGroup.add(innerFlame);
  }

  private updateHUD(): void {
    if (!this.state) return;
    this.multiplierText?.setText(`x${this.state.multiplier.toFixed(2)}`);
    this.altitudeText?.setText(`ALT: ${Math.floor(this.state.altitude)}m`);
  }

  // ─── Actions ──────────────────────────────────────────────────────────────

  private handleCashOut(): void {
    if (!this.state) return;
    const payout = cashOutJett(this.state);
    this.tickTimer?.remove();
    this.tickTimer = null;
    this.statusText?.setText(`PAID OUT\n${payout.toFixed(2)} credits`).setColor(GOLD_STR);
  }

  private triggerCombustion(): void {
    if (!this.state) return;
    const { worldWidth } = this.config;
    const screenX = this.playerScreenX + (this.state.playerX - worldWidth / 2);

    // Explosion rings
    for (let ring = 0; ring < 3; ring++) {
      const circle = this.scene.add.arc(
        screenX, this.playerScreenY, 10, 0, 360, false, 0xff6600, 0.8
      );
      this.scene.tweens.add({
        targets: circle,
        scaleX: (ring + 1) * 3,
        scaleY: (ring + 1) * 3,
        alpha: 0,
        duration: 500 + ring * 150,
        delay: ring * 80,
        onComplete: () => circle.destroy(),
      });
    }

    // Particle sparks
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      const spark = this.scene.add.rectangle(screenX, this.playerScreenY, 4, 4, 0xffaa00);
      this.scene.tweens.add({
        targets: spark,
        x: screenX + Math.cos(angle) * Phaser.Math.Between(40, 100),
        y: this.playerScreenY + Math.sin(angle) * Phaser.Math.Between(40, 100),
        alpha: 0,
        duration: Phaser.Math.Between(400, 700),
        onComplete: () => spark.destroy(),
      });
    }

    if (this.playerBody) this.playerBody.fillColor = 0xff4400;
    if (this.playerHead) this.playerHead.fillColor = 0xff4400;

    this.scene.time.delayedCall(300, () => {
      this.statusText?.setText('COMBUSTION!\nJETPACK FAILED').setColor('#ff6600');
    });
  }
}

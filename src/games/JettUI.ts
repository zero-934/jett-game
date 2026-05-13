import * as Phaser from 'phaser';
import type { JettConfig } from './JettLogic';
import { createJettState, tickJett, cashOutJett } from './JettLogic';
import {
  COLOR_BG,
  COLOR_SURFACE,
  COLOR_BORDER,
  COLOR_GOLD,
  STR_DANGER,
  FONT_SIZE_XL,
  FONT_SIZE_2XL,
  TEXT_STYLE_LABEL,
  TEXT_STYLE_SEMIBOLD,
  TEXT_STYLE_GOLD_SEMIBOLD,
  TEXT_STYLE_WIN,
  SAFE_TOP,
  drawButton
} from '../shared/ui/UITheme';

export class JettUI {
  private scene:  Phaser.Scene;
  private config: JettConfig;

  // Player parts (screen-space, fixed Y)
  private playerHead: Phaser.GameObjects.Arc       | null = null;
  private playerBody: Phaser.GameObjects.Rectangle | null = null;
  private playerPack: Phaser.GameObjects.Rectangle | null = null;
  private playerScreenY = 0;

  // Background
  private bgGraphics: Phaser.GameObjects.Graphics | null = null;
  private stars: { x: number; y: number; r: number; phase: number }[] = [];
  private bgPlanet:  Phaser.GameObjects.Arc | null = null;
  private bgPlanet2: Phaser.GameObjects.Arc | null = null;

  // Asteroid graphics pool — keyed by asteroid id
  private asteroidGraphics: Map<number, Phaser.GameObjects.Graphics> = new Map();

  // Coin graphics pool — keyed by coin id
  private coinGraphics: Map<number, Phaser.GameObjects.Graphics> = new Map();

  // Flame
  private flameGraphics: Phaser.GameObjects.Graphics | null = null;

  // HUD
  private multiplierText: Phaser.GameObjects.Text | null = null;
  private altitudeText:   Phaser.GameObjects.Text | null = null;
  private statusText:     Phaser.GameObjects.Text | null = null;
  private debugText:      Phaser.GameObjects.Text | null = null;  // DEBUG
  private cashOutButtonBg: Phaser.GameObjects.Graphics | null = null; // Use Graphics for themed button
  private cashOutLabel:   Phaser.GameObjects.Text | null = null;
  private playAgainButtonBg: Phaser.GameObjects.Graphics | null = null;
  private playAgainLabel: Phaser.GameObjects.Text | null = null;


  private pointerX  = 0;
  private tickTimer: Phaser.Time.TimerEvent | null = null;
  private state: ReturnType<typeof createJettState> | null = null;
  private lastAltitudeFlash = 0;  // Track last altitude milestone flash for UI feedback
  private startScreenObjects: Phaser.GameObjects.GameObject[] = [];  // Objects to clean up before game starts

  constructor(scene: Phaser.Scene, config: JettConfig) {
    this.scene   = scene;
    this.config  = config;
    this.pointerX     = config.worldWidth / 2;
    this.playerScreenY = config.screenHeight * 0.62;
  }

  public start(bet: number): void {
    this.cleanup();
    this.state = createJettState(bet, this.config);
    this.buildBackground();
    this.buildPlayer();
    this.buildHUD();
    this.buildStartScreen();
    this.registerInput();
    // Tick timer starts when player taps "GO" in buildStartScreen()
  }

  public cleanup(): void {
    this.tickTimer?.remove();
    this.tickTimer = null;
    this.playerHead?.destroy();
    this.playerBody?.destroy();
    this.playerPack?.destroy();
    this.bgGraphics?.destroy();
    this.bgPlanet?.destroy();
    this.bgPlanet2?.destroy();
    this.flameGraphics?.destroy();
    for (const g of this.asteroidGraphics.values()) g.destroy();
    this.asteroidGraphics.clear();
    for (const g of this.coinGraphics.values()) g.destroy();
    this.coinGraphics.clear();
    this.multiplierText?.destroy();
    this.altitudeText?.destroy();
    this.statusText?.destroy();
    this.debugText?.destroy();
    this.cashOutButtonBg?.destroy();
    this.cashOutLabel?.destroy();
    this.playAgainButtonBg?.destroy();
    this.playAgainLabel?.destroy();
    for (const obj of this.startScreenObjects) {
      if (obj && !obj.isDestroyed) (obj as any).destroy();
    }
    this.startScreenObjects = [];
    this.state = null;
  }

  // ─── Build ────────────────────────────────────────────────────────────────

  private buildStartScreen(): void {
    const { worldWidth, screenHeight } = this.config;

    // Semi-transparent overlay
    const overlay = this.scene.add.rectangle(
      worldWidth / 2, screenHeight / 2,
      worldWidth, screenHeight,
      0x000000, 0.6
    ).setDepth(100);
    this.startScreenObjects.push(overlay);

    // "TAP TO START" text
    const title = this.scene.add.text(
      worldWidth / 2, screenHeight / 2 - 80,
      'TAP TO START',
      {
        fontFamily: '"Fredoka One", sans-serif',
        fontSize: '32px',
        color: '#c9a84c',
        letterSpacing: 2,
      }
    ).setOrigin(0.5).setDepth(101);
    this.startScreenObjects.push(title);

    // Start button
    const { bg: startBg, text: startLabel } = drawButton(
      this.scene,
      worldWidth / 2,
      screenHeight / 2 + 40,
      180,
      56,
      'GO',
      'primary',
      101
    );
    startBg.setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.handleStartGame());
    this.startScreenObjects.push(startBg, startLabel);
  }

  private handleStartGame(): void {
    // Remove start screen
    for (const obj of this.startScreenObjects) {
      if (obj && !obj.isDestroyed) (obj as any).destroy();
    }
    this.startScreenObjects = [];

    // Start the game tick loop
    this.tickTimer = this.scene.time.addEvent({
      delay: 16,
      loop: true,
      callback: this.onTick,
      callbackScope: this,
    });
  }

  private buildBackground(): void {
    const { worldWidth, screenHeight } = this.config;
    this.bgGraphics = this.scene.add.graphics();

    for (let i = 0; i < 130; i++) {
      this.stars.push({
        x:     Math.random() * worldWidth,
        y:     Math.random() * screenHeight,
        r:     Math.random() < 0.15 ? 1.8 : 0.8,
        phase: Math.random() * Math.PI * 2,
      });
    }

    this.bgPlanet = this.scene.add.arc(
      worldWidth * 0.78, screenHeight * 0.18, 42, 0, 360, false, 0x2244aa, 0.45
    );
    this.bgPlanet2 = this.scene.add.arc(
      worldWidth * 0.14, screenHeight * 0.38, 22, 0, 360, false, 0x773322, 0.4
    );
  }

  private buildPlayer(): void {
    const x = this.config.worldWidth / 2;
    const y = this.playerScreenY;
    this.playerPack = this.scene.add.rectangle(x + 8, y + 2, 10, 22, 0x4455aa).setDepth(5);
    this.playerBody = this.scene.add.rectangle(x, y,      8, 22, COLOR_GOLD).setDepth(5);
    this.playerHead = this.scene.add.arc(x, y - 17, 7, 0, 360, false, COLOR_GOLD).setDepth(5);
    this.flameGraphics = this.scene.add.graphics().setDepth(4);
  }

  private buildHUD(): void {
    const { worldWidth } = this.config;

    this.multiplierText = this.scene.add
      .text(16, SAFE_TOP + 10, 'x1.00', TEXT_STYLE_GOLD_SEMIBOLD)
      .setFontSize(FONT_SIZE_2XL) // Adjust for prominence
      .setDepth(10);

    this.altitudeText = this.scene.add
      .text(16, SAFE_TOP + 45, 'ALT: 0m', TEXT_STYLE_LABEL)
      .setDepth(10);

    this.statusText = this.scene.add
      .text(worldWidth / 2, this.config.screenHeight * 0.35, '', TEXT_STYLE_SEMIBOLD)
      .setOrigin(0.5).setDepth(10)
      .setFontSize(FONT_SIZE_XL);

    // DEBUG: Show coin spawning
    this.debugText = this.scene.add
      .text(worldWidth / 2, 100, 'coins: 0', { fontFamily: 'monospace', fontSize: '12px', color: '#ffd700' })
      .setOrigin(0.5).setDepth(100);

    const btnWidth = 124;
    const btnHeight = 44;
    const { bg, text } = drawButton(this.scene, worldWidth - btnWidth/2 - 10, SAFE_TOP + btnHeight/2, btnWidth, btnHeight, 'CASH OUT', 'primary');
    this.cashOutButtonBg = bg;
    this.cashOutLabel = text;
    this.cashOutButtonBg.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.handleCashOut());
  }

  private registerInput(): void {
    this.scene.input.on('pointermove', (p: Phaser.Input.Pointer) => { this.pointerX = p.x; });
    this.scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => { this.pointerX = p.x; });
  }

  // ─── Tick ─────────────────────────────────────────────────────────────────

  private onTick(): void {
    if (!this.state) return;

    if (this.state.isAlive && !this.state.cashedOut) {
      tickJett(this.state, this.pointerX, this.config);
    }

    // Check for altitude milestone and trigger visual feedback
    if (this.state.lastMilestoneAltitude > this.lastAltitudeFlash) {
      this.lastAltitudeFlash = this.state.lastMilestoneAltitude;
      this.triggerAltitudeMilestoneFlash();
    }

    this.renderBackground();
    this.renderAsteroids();
    this.renderCoins();
    this.renderPlayer();
    this.renderFlame();
    this.updateHUD();

    if (!this.state.isAlive) {
      this.tickTimer?.remove();
      this.tickTimer = null;
      this.state.combusted ? this.triggerCombustion() : this.showCrash();
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  private renderBackground(): void {
    const { worldWidth, screenHeight } = this.config;
    const altitude = this.state?.altitude ?? 0;
    const t = this.scene.time.now / 1000;

    if (!this.bgGraphics) return;
    this.bgGraphics.clear();

    // Deep space gradient
    this.bgGraphics.fillGradientStyle(COLOR_BG, COLOR_BG, COLOR_SURFACE, COLOR_SURFACE, 1);
    this.bgGraphics.fillRect(0, 0, worldWidth, screenHeight);

    // Twinkling stars with parallax
    for (const star of this.stars) {
      const alpha  = 0.35 + 0.45 * Math.sin(star.phase + t * 1.1);
      const parallaxY = ((star.y - altitude * 0.04) % screenHeight + screenHeight) % screenHeight;
      this.bgGraphics.fillStyle(0xffffff, alpha);
      this.bgGraphics.fillCircle(star.x, parallaxY, star.r);
    }

    // Subtle grid
    this.bgGraphics.lineStyle(0.4, COLOR_BORDER, 0.35); // Using theme border color
    const gridSize = 70;
    const gridOff  = (altitude * 0.25) % gridSize;
    for (let gy = -gridOff; gy < screenHeight + gridSize; gy += gridSize) {
      this.bgGraphics.beginPath();
      this.bgGraphics.moveTo(0, gy);
      this.bgGraphics.lineTo(worldWidth, gy);
      this.bgGraphics.strokePath();
    }
    for (let gx = 0; gx < worldWidth + gridSize; gx += gridSize) {
      this.bgGraphics.beginPath();
      this.bgGraphics.moveTo(gx, 0);
      this.bgGraphics.lineTo(gx, screenHeight);
      this.bgGraphics.strokePath();
    }

    // Planets drift slowly upward
    if (this.bgPlanet)  this.bgPlanet.y  = ((screenHeight * 0.18 - altitude * 0.018) % screenHeight + screenHeight) % screenHeight;
    if (this.bgPlanet2) this.bgPlanet2.y = ((screenHeight * 0.38 - altitude * 0.013) % screenHeight + screenHeight) % screenHeight;
  }

  private renderAsteroids(): void {
    if (!this.state) return;
    const altitude     = this.state.altitude;
    const screenHeight = this.config.screenHeight;

    // Remove stale graphics
    const activeIds = new Set(this.state.asteroids.map(a => a.id));
    for (const [id, g] of this.asteroidGraphics) {
      if (!activeIds.has(id)) { g.destroy(); this.asteroidGraphics.delete(id); }
    }

    for (const ast of this.state.asteroids) {
      // World → screen Y: player is at playerScreenY at altitude `altitude`
      const screenY = this.playerScreenY - (ast.worldY - altitude);
      if (screenY < -50 || screenY > screenHeight + 50) continue;

      let g = this.asteroidGraphics.get(ast.id);
      if (!g) {
        g = this.scene.add.graphics().setDepth(3);
        this.asteroidGraphics.set(ast.id, g);
      }

      this.drawAsteroid(g, ast.x, screenY, ast.radius, ast.rotationAngle);
    }
  }

  private drawAsteroid(
    g: Phaser.GameObjects.Graphics,
    cx: number, cy: number,
    radius: number,
    angleDeg: number
  ): void {
    g.clear();
    const angleRad = (angleDeg * Math.PI) / 180;
    const points   = 8;
    const verts: { x: number; y: number }[] = [];

    // Irregular rock polygon
    for (let i = 0; i < points; i++) {
      const a   = angleRad + (i / points) * Math.PI * 2;
      // Vary radius per vertex for rocky look (seeded by i for stable shape)
      const r   = radius * (0.72 + 0.28 * Math.sin(i * 2.3 + angleDeg * 0.01));
      verts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }

    // Shadow / depth fill
    g.fillStyle(0x221100, 1);
    g.beginPath();
    g.moveTo(verts[0].x + 2, verts[0].y + 2);
    for (let i = 1; i < verts.length; i++) g.lineTo(verts[i].x + 2, verts[i].y + 2);
    g.closePath();
    g.fillPath();

    // Main rock fill
    g.fillStyle(0x887755, 1);
    g.beginPath();
    g.moveTo(verts[0].x, verts[0].y);
    for (let i = 1; i < verts.length; i++) g.lineTo(verts[i].x, verts[i].y);
    g.closePath();
    g.fillPath();

    // Highlight face
    g.fillStyle(0xbbaa88, 0.55);
    g.beginPath();
    g.moveTo(verts[0].x, verts[0].y);
    for (let i = 1; i < Math.floor(points / 2); i++) g.lineTo(verts[i].x, verts[i].y);
    g.closePath();
    g.fillPath();

    // Outline
    g.lineStyle(1, 0x554433, 1);
    g.beginPath();
    g.moveTo(verts[0].x, verts[0].y);
    for (let i = 1; i < verts.length; i++) g.lineTo(verts[i].x, verts[i].y);
    g.closePath();
    g.strokePath();

    // Small crater detail
    g.fillStyle(0x554433, 0.7);
    g.fillCircle(cx - radius * 0.25, cy - radius * 0.15, radius * 0.18);
    g.fillCircle(cx + radius * 0.3,  cy + radius * 0.2,  radius * 0.12);
  }

  private renderCoins(): void {
    if (!this.state) return;
    const altitude     = this.state.altitude;
    const screenHeight = this.config.screenHeight;

    // Remove stale graphics
    const activeIds = new Set(this.state.coins.filter(c => !c.collected).map(c => c.id));
    for (const [id, g] of this.coinGraphics) {
      if (!activeIds.has(id)) { g.destroy(); this.coinGraphics.delete(id); }
    }

    for (const coin of this.state.coins) {
      if (coin.collected) continue;

      // World → screen Y
      const screenY = this.playerScreenY - (coin.worldY - altitude);
      if (screenY < -50 || screenY > screenHeight + 50) continue;

      let g = this.coinGraphics.get(coin.id);
      if (!g) {
        g = this.scene.add.graphics().setDepth(4);
        this.coinGraphics.set(coin.id, g);
      }

      this.drawCoin(g, coin.x, screenY, coin.radius, coin.animPhase);
    }
  }

  private drawCoin(
    g: Phaser.GameObjects.Graphics,
    cx: number, cy: number,
    radius: number,
    animPhase: number
  ): void {
    g.clear();
    
    // Pulse effect based on animation phase
    const pulseScale = 0.85 + 0.15 * Math.sin(animPhase * Math.PI * 2);
    const r = radius * pulseScale;
    
    // Gold coin with shine
    g.fillStyle(0xffd700, 1); // Bright gold
    g.fillCircle(cx, cy, r);
    
    // Darker gold edge for depth
    g.lineStyle(2, 0xcc9900, 1);
    g.strokeCircleShape(new Phaser.Geom.Circle(cx, cy, r));
    
    // Shine highlight (top-left)
    g.fillStyle(0xffff99, 0.6);
    g.fillCircle(cx - r * 0.3, cy - r * 0.3, r * 0.3);
  }

  private renderPlayer(): void {
    if (!this.state) return;
    const { worldWidth } = this.config;
    const screenX = this.config.worldWidth / 2 + (this.state.playerX - worldWidth / 2);
    const tilt    = Phaser.Math.Clamp((this.state.playerX - worldWidth / 2) / 80, -15, 15);

    this.playerBody?.setPosition(screenX, this.playerScreenY).setAngle(tilt);
    this.playerHead?.setPosition(screenX, this.playerScreenY - 17).setAngle(tilt);
    this.playerPack?.setPosition(screenX + 8, this.playerScreenY + 2).setAngle(tilt);
  }

  private renderFlame(): void {
    if (!this.state || !this.flameGraphics) return;
    this.flameGraphics.clear();
    if (!this.state.isAlive) return;

    const { worldWidth } = this.config;
    const screenX = this.config.worldWidth / 2 + (this.state.playerX - worldWidth / 2);
    const t       = this.scene.time.now;
    const flameH  = 12 + Math.sin(t / 55) * 6;
    const flameW  = 5  + Math.sin(t / 35) * 2;
    const baseY   = this.playerScreenY + 13;

    // Outer flame
    this.flameGraphics.fillStyle(0xff6600, 0.9);
    this.flameGraphics.fillTriangle(
      screenX + 8 - flameW, baseY,
      screenX + 8 + flameW, baseY,
      screenX + 8,           baseY + flameH
    );
    // Inner flame
    this.flameGraphics.fillStyle(0xffdd00, 0.95);
    this.flameGraphics.fillTriangle(
      screenX + 8 - flameW * 0.5, baseY,
      screenX + 8 + flameW * 0.5, baseY,
      screenX + 8,                  baseY + flameH * 0.55
    );
  }

  private updateHUD(): void {
    if (!this.state) return;
    this.multiplierText?.setText(`x${this.state.multiplier.toFixed(2)}`);
    this.altitudeText?.setText(`ALT: ${Math.floor(this.state.altitude)}m`);
    this.debugText?.setText(`coins: ${this.state.coins.length}|${this.state.coinsCollected}`);
  }

  // ─── Actions ──────────────────────────────────────────────────────────────

  private handleCashOut(): void {
    if (!this.state) return;
    const payout = cashOutJett(this.state);
    this.tickTimer?.remove();
    this.tickTimer = null;
    if (this.statusText) {
      this.statusText.setText(`PAID OUT\n${payout.toFixed(2)} credits`);
      this.statusText.setStyle(TEXT_STYLE_WIN); // Use win style for payout
    }
    this.cashOutButtonBg?.disableInteractive();
    this.scene.time.delayedCall(600, () => this.showPlayAgain());
  }

  private showPlayAgain(): void {
    const { worldWidth, screenHeight } = this.config;
    const btnWidth = 180;
    const btnHeight = 50;

    const { bg, text } = drawButton(this.scene, worldWidth / 2, screenHeight * 0.55, btnWidth, btnHeight, 'PLAY AGAIN', 'primary', 20);
    this.playAgainButtonBg = bg;
    this.playAgainLabel = text;

    this.playAgainButtonBg.setInteractive({ useHandCursor: true }).on('pointerdown', () => { this.cleanup(); this.scene.scene.restart(); });
  }

  private showCrash(): void {
    if (this.statusText) {
      this.statusText.setText('ASTEROID HIT!\nGAME OVER');
      this.statusText.setStyle({ ...TEXT_STYLE_SEMIBOLD, color: STR_DANGER }); // Use danger color
    }
    this.cashOutButtonBg?.disableInteractive();
    this.scene.time.delayedCall(600, () => this.showPlayAgain());
  }

  private triggerAltitudeMilestoneFlash(): void {
    // Altitude text and multiplier pulse when reaching every 100 altitude milestone
    // Creates psychological reward moment for progression (like "ding" in Flap Fortune)
    if (this.altitudeText) {
      this.scene.tweens.add({
        targets: this.altitudeText,
        scaleX: 1.25,
        scaleY: 1.25,
        duration: 150,
        yoyo: true,
        ease: 'Quad.easeInOut',
      });
    }
    
    if (this.multiplierText) {
      this.scene.tweens.add({
        targets: this.multiplierText,
        scaleX: 1.2,
        scaleY: 1.2,
        duration: 150,
        yoyo: true,
        ease: 'Quad.easeInOut',
      });
    }
    
    // Optional: Add a quick "flash" to the background for more impact
    if (this.bgGraphics) {
      this.bgGraphics.fillStyle(0xc9a84c, 0.1);
      this.bgGraphics.fillRect(0, 0, this.config.worldWidth, this.config.screenHeight);
    }
  }

  private triggerCombustion(): void {
    if (!this.state) return;
    const { worldWidth } = this.config;
    const sx = this.config.worldWidth / 2 + (this.state.playerX - worldWidth / 2);
    const sy = this.playerScreenY;

    for (let ring = 0; ring < 3; ring++) {
      const circle = this.scene.add.arc(sx, sy, 10, 0, 360, false, 0xff6600, 0.85).setDepth(8);
      this.scene.tweens.add({
        targets: circle,
        scaleX: (ring + 1) * 3.5,
        scaleY: (ring + 1) * 3.5,
        alpha: 0,
        duration: 500 + ring * 140,
        delay: ring * 75,
        onComplete: () => circle.destroy(),
      });
    }

    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * Math.PI * 2;
      const spark = this.scene.add.rectangle(sx, sy, 4, 4, 0xffaa00).setDepth(8);
      this.scene.tweens.add({
        targets: spark,
        x: sx + Math.cos(angle) * Phaser.Math.Between(40, 110),
        y: sy + Math.sin(angle) * Phaser.Math.Between(40, 110),
        alpha: 0,
        duration: Phaser.Math.Between(400, 750),
        onComplete: () => spark.destroy(),
      });
    }

    if (this.playerBody) this.playerBody.fillColor = 0xff4400;
    if (this.playerHead) this.playerHead.fillColor = 0xff4400;

    this.scene.time.delayedCall(300, () => {
      if (this.statusText) {
        this.statusText.setText('COMBUSTION!\nJETPACK FAILED');
        this.statusText.setStyle({ ...TEXT_STYLE_SEMIBOLD, color: STR_DANGER });
      }
      this.cashOutButtonBg?.disableInteractive();
      this.scene.time.delayedCall(600, () => this.showPlayAgain());
    });
  }
}

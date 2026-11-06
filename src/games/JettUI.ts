/**
 * @file JettUI.ts
 * @purpose Phaser rendering + input for Jett (polish-003 pilot segment, revision 004 "restrained
 *          orbital adventure"): navy sky with a sparse cached star field, one cropped banded
 *          planet, one cosmetic satellite, two low horizon silhouettes with slow parallax, pooled
 *          slate asteroids, gold coins and the unchanged pilot study.
 *          Simulation runs only in the shared fixed-step runner (JettLogic round controller); this
 *          file renders once per frame with interpolation and turns input into tick-stamped
 *          actions. The 390×844 world is fitted uniformly into the stage (no crop, no stretch).
 * @author Agent 934
 * @date 2026-04-12 (polish-003 rewrite: 2026-11-05)
 * @license Proprietary – available for licensing
 */
import * as Phaser from 'phaser';
import type { JettConfig, JettRound, JettSettlement } from './JettLogic';
import { createJettRound, stepJettRound, canCashOutJett, JETT_SIM_VERSION, JETT_PLAYER_HIT_FRACTION, JETT_ASTEROID_HIT_FRACTION } from './JettLogic';
import { FixedStepRunner } from '../shared/sim/FixedStepRunner';
import { getPageLedger, nextRoundId, toHundredths, formatCredits } from '../shared/sim/DemoLedger';
import { createSeedString, RNG_ALGORITHM_V2 } from '../shared/rng/ProvablyFairRNG';
import { SoftDepthShell } from '../shared/ui/SoftDepthShell';
import { getHost } from '../shared/host/DemoHostAdapter';
import type { ShellKey, StagePointer } from '../shared/ui/SoftDepthShell';
import { hexToInt, fitWorld, LAYOUT_IMMERSIVE } from '../shared/ui/SoftDepthTheme';
import { AudioService } from '../shared/audio/AudioService';
import { makeDenseTexture } from '../shared/render/RenderScale';
import { preloadCharacter, characterPlacement, characterAnchor, variantOf } from '../shared/render/CharacterSprites';

// ─── World fit ───────────────────────────────────────────────────────────────
// Immersive shell layout (as Flap): unchanged 390×844 world fitted at k ≈ 0.787 (was 0.645).
const WORLD_W = 390;
const WORLD_H = 844;
const STAGE = LAYOUT_IMMERSIVE.stage;
const FIT = fitWorld(STAGE, WORLD_W, WORLD_H);
const K = FIT.k;
const ORIGIN_X = FIT.originX;
const ORIGIN_Y = FIT.originY;
/** Player's fixed screen row in world units (unchanged from the original UI: 62% of 844). */
const PLAYER_SCREEN_WORLD_Y = WORLD_H * 0.62;

// ─── Art (revision 004) ───────────────────────────────────────────────────────
const SKY_TOP = 0x0f1a33;
const SKY_BOTTOM = 0x1b2b4d;
const PLANET = 0x3f74b6;
const PLANET_BAND = 0x5b8fcf;
const PLANET_SHADE = 0x2d5a92;
const HORIZON_FAR = 0x2a4472;
const HORIZON_NEAR = 0x223a63;
const ROCK_BODY = 0x6f7a8c;
const ROCK_SHADE = 0x4c5566;
const ROCK_RIM = 0xbcc6d6;
const ROCK_CRATER = 0x555f71;
const COIN = 0xf2c14e;
const COIN_RIM = 0xc58b1f;
const COIN_SHINE = 0xfff1b8;
const FLAME_OUTER = 0xff9a3c;
const FLAME_INNER = 0xffe08a;
/** Set by preload: render-scale variant of the polish-004 pilot export. */
let pilotTexture = 'jett-pilot-r3';
const ROCK_KEYS = ['jett-rock-0', 'jett-rock-1', 'jett-rock-2', 'jett-rock-3'];
const COIN_KEY = 'jett-coin';
const STAR_COUNT = 46;
const ROCK_TEX = 96;
const COIN_TEX = 32;
// polish-004: the pilot's on-screen body size/centre come from characterManifest.ts (identical to
// polish-003's PILOT_DISPLAY_WORLD_H = 62 placement); only texture quality changed.
/** Lean: degrees per world px of lateral motion this frame, clamp, and easing per 60 Hz frame. */
const LEAN_PER_PX = 3;
const LEAN_MAX_DEG = 12;
const LEAN_MAX_REDUCED_DEG = 5;
const LEAN_EASE = 0.25;
/** Thruster flame (logical px, at the nozzle anchor). */
const FLAME_W = 4.6;
const FLAME_LEN = [6.5, 8.5, 7.4] as const;
const FLAME_FRAME_MS = 70;
const ASTEROID_VISUAL_SCALE = 0.92; // drawn silhouette mean ≈ 0.85 r hitbox
const STAR_PARALLAX = 0.02;
const HORIZON_FAR_PARALLAX = 0.04;
const HORIZON_NEAR_PARALLAX = 0.1;
const SATELLITE_DRIFT_PER_MS = 0.0015;
const SPARKLE_COUNT = 7;
const SPARKLE_MS = 240;
const BONUS_TEXT_MS = 700;
const CRASH_SHAKE_MS = 140;
const CRASH_SHAKE_INTENSITY = 0.003;
const KEY_STEER_WORLD_PER_FRAME = 5;
const GUTTER_DIM_ALPHA = 0.28;
const DEPTH = { sky: 1, planet: 2, horizon: 3, coins: 5, rocks: 6, flame: 7, pilot: 8, fx: 9, hint: 9, gutter: 10, debug: 30 } as const;

function wx(x: number): number { return ORIGIN_X + x * K; }
/** Screen Y for a world-altitude object, given the camera altitude. */
function sy(worldY: number, altitude: number): number { return ORIGIN_Y + (PLAYER_SCREEN_WORLD_Y - (worldY - altitude)) * K; }

/** Review/QA only: `?seed=abc` fixes round seeds (abc-1, abc-2, …) for reproducible captures. */
let reviewSeedCounter = 0;
function reviewSeed(): string | null {
  if (typeof window === 'undefined') return null;
  const base = new URLSearchParams(window.location.search).get('seed');
  return base ? `${base}-${++reviewSeedCounter}` : null;
}

type UIPhase = 'ready' | 'playing' | 'paused' | 'settled';

/**
 * Jett renderer/controller.
 * @example
 * const ui = new JettUI(scene, config); ui.start(10);
 */
export class JettUI {
  private scene: Phaser.Scene;
  private config: JettConfig;
  private shell: SoftDepthShell | null = null;
  private round: JettRound | null = null;
  private runner: FixedStepRunner | null = null;
  private roundId = '';
  private seed = '';
  private betHundredths = 1000;
  private phase: UIPhase = 'ready';
  private heldDir = 0;
  private keyTargetX = WORLD_W / 2;

  // Interpolation snapshots
  private prevAltitude = 0;
  private prevPlayerX = WORLD_W / 2;
  private prevRockX = new Map<number, number>();
  private lastCoins = 0;

  // Display
  private sky: Phaser.GameObjects.Graphics | null = null;
  /** Two wrapped copies of a vector star field (crisp at any render scale; no large texture). */
  private stars: Phaser.GameObjects.Graphics[] = [];
  private planet: Phaser.GameObjects.Graphics | null = null;
  private satellite: Phaser.GameObjects.Graphics | null = null;
  private horizonFar: Phaser.GameObjects.Graphics | null = null;
  private horizonNear: Phaser.GameObjects.Graphics | null = null;
  private gutters: Phaser.GameObjects.Graphics | null = null;
  private pilot: Phaser.GameObjects.Image | null = null;
  private flame: Phaser.GameObjects.Graphics | null = null;
  private hint: Phaser.GameObjects.Text | null = null;
  private debug: Phaser.GameObjects.Graphics | null = null;
  private rockPool: Phaser.GameObjects.Image[] = [];
  private rockById = new Map<number, Phaser.GameObjects.Image>();
  private coinPool: Phaser.GameObjects.Image[] = [];
  private coinById = new Map<number, Phaser.GameObjects.Image>();
  private sparkles: Phaser.GameObjects.Arc[] = [];
  private bonusText: Phaser.GameObjects.Text | null = null;
  private readonly debugEnabled: boolean;
  private readonly onFrameBound = (_t: number, delta: number) => this.onFrame(delta);
  private started = false;
  /** Eased presentation-only lean (degrees). */
  private lean = 0;

  /**
   * @param scene - Owning scene.
   * @param config - Gameplay config (unchanged production values).
   */
  constructor(scene: Phaser.Scene, config: JettConfig) {
    this.scene = scene;
    this.config = { ...config };
    this.debugEnabled = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1';
  }

  /**
   * Loads the pilot texture (call from Scene.preload).
   * @param scene - Scene.
   * @returns void
   * @example
   * JettUI.preload(this);
   */
  static preload(scene: Phaser.Scene): void {
    pilotTexture = preloadCharacter(scene, 'jett-pilot');
  }

  /**
   * Builds the scene and a fresh ready round.
   * @param bet - Stake in credits.
   * @returns void
   */
  public start(bet: number): void {
    this.cleanup();
    this.betHundredths = toHundredths(bet);
    this.shell = new SoftDepthShell(this.scene, {
      title: 'Jett',
      layout: LAYOUT_IMMERSIVE,
      onBack: () => getHost().requestLobby(), // polish-004: host decides (validated lobby / parent)
      onPrimary: () => this.onPrimary(),
      onStageDown: (p) => this.onSteer(p),
      onStageMove: (p) => this.onSteer(p),
      onKey: (k) => this.onKey(k),
      onSettingsOpen: (open) => { if (open) this.pause('settings'); else if (this.phase === 'paused') this.shell?.setPaused('Paused\nTap or press Space to resume'); },
      onSettingsChanged: () => { this.buildWorld(); this.refreshUi(); },
      onVisibilityLost: (reason) => { this.heldDir = 0; this.pause(reason); },
    });
    this.shell.setBalance(getPageLedger().balanceHundredths);
    this.makeTextures();
    this.buildWorld();
    this.newRound();
    this.scene.events.on(Phaser.Scenes.Events.UPDATE, this.onFrameBound);
    this.started = true;
  }

  /** Releases everything this UI registered. Idempotent. */
  public cleanup(): void {
    if (this.started) this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.onFrameBound);
    this.started = false;
    this.destroyWorld();
    this.shell?.destroy();
    this.shell = null;
    this.round = null;
    this.runner = null;
  }

  private destroyWorld(): void {
    for (const o of [this.sky, ...this.stars, this.planet, this.satellite, this.horizonFar, this.horizonNear, this.gutters, this.pilot, this.flame, this.hint, this.debug, this.bonusText]) o?.destroy();
    for (const o of [...this.rockPool, ...this.coinPool, ...this.sparkles]) o.destroy();
    this.rockPool = []; this.coinPool = []; this.sparkles = [];
    this.rockById.clear(); this.coinById.clear();
    this.sky = this.planet = this.satellite = this.horizonFar = this.horizonNear = this.gutters = this.flame = this.debug = null;
    this.stars = []; this.pilot = null; this.hint = null; this.bonusText = null;
  }

  // ─── Round lifecycle ──────────────────────────────────────────────────────

  private newRound(): void {
    this.seed = reviewSeed() ?? createSeedString();
    this.roundId = nextRoundId('jett');
    this.round = createJettRound(this.seed, this.betHundredths / 100, this.config);
    const round = this.round;
    this.runner = new FixedStepRunner((_tick, actions) => { this.snapshot(); return stepJettRound(round, actions); });
    this.phase = 'ready';
    this.heldDir = 0;
    this.keyTargetX = round.state.playerX;
    this.prevAltitude = 0;
    this.prevPlayerX = round.state.playerX;
    this.prevRockX.clear();
    this.lastCoins = 0;
    this.lean = 0;
    for (const img of this.rockById.values()) { img.setVisible(false); this.rockPool.push(img); }
    for (const img of this.coinById.values()) { img.setVisible(false); this.coinPool.push(img); }
    this.rockById.clear(); this.coinById.clear();
    this.pilot?.clearTint().setVisible(true).setAlpha(1);
    this.shell?.hideResult();
    this.shell?.setPaused(null);
    this.refreshUi();
    this.render(1);
  }

  private snapshot(): void {
    const st = this.round?.state; if (!st) return;
    this.prevAltitude = st.altitude;
    this.prevPlayerX = st.playerX;
    this.prevRockX.clear();
    for (const a of st.asteroids) this.prevRockX.set(a.id, a.x);
  }

  private launch(): void {
    if (this.phase !== 'ready' || !this.runner) return;
    if (!getPageLedger().start(this.roundId, this.betHundredths)) return;
    this.shell?.setBalance(getPageLedger().balanceHundredths);
    this.runner.begin();
    this.phase = 'playing';
    this.shell?.announce(`Launched. Stake ${formatCredits(this.betHundredths)} demo credits. Drag or use arrow keys to steer.`);
    this.refreshUi();
  }

  private onPrimary(): void {
    if (this.phase === 'ready') { this.launch(); return; }
    if (this.phase === 'playing' && this.round && canCashOutJett(this.round)) { this.runner?.queue('cashOut'); return; }
    if (this.phase === 'settled') this.newRound();
  }

  private onSteer(p: StagePointer): void {
    if (this.phase === 'paused') { this.resume(); return; }
    if (this.phase !== 'playing') return;
    const worldX = Math.round((p.x - ORIGIN_X) / K); // logic clamps to the world
    this.keyTargetX = worldX;
    this.runner?.queue('steer', worldX);
  }

  private onKey(k: ShellKey): void {
    const dir = k.code === 'ArrowLeft' ? -1 : k.code === 'ArrowRight' ? 1 : 0;
    if (dir !== 0) {
      if (k.type === 'down') this.heldDir = dir;
      else if (this.heldDir === dir) this.heldDir = 0;
      return;
    }
    if (k.type !== 'down' || k.repeat) return;
    if (k.code === 'Space' || k.code === 'Enter') {
      if (this.phase === 'paused') this.resume();
      else if (this.phase === 'ready') this.launch();
    }
  }

  private pause(reason: 'settings' | 'hidden' | 'blur'): void {
    if (this.phase !== 'playing') return;
    this.runner?.pause(reason);
    this.phase = 'paused';
    this.shell?.setPaused(reason === 'settings' ? null : 'Paused\nTap or press Space to resume');
  }

  private resume(): void {
    if (this.phase !== 'paused' || this.shell?.settingsOpen) return;
    this.runner?.resume();
    this.phase = 'playing';
    this.shell?.setPaused(null);
  }

  private onSettled(s: JettSettlement): void {
    this.phase = 'settled';
    this.runner?.finishSettlement();
    this.heldDir = 0;
    const record = getPageLedger().settle(this.roundId, s.returnHundredths, s.reason);
    this.shell?.setBalance(getPageLedger().balanceHundredths);
    const ret = record?.returnHundredths ?? s.returnHundredths;
    AudioService.settle(ret, this.betHundredths);
    if (s.reason !== 'cashout') this.crashFx(s.reason === 'combust');
    const title = s.reason === 'cashout' ? 'Cashed out' : s.reason === 'combust' ? 'Jetpack failed' : 'Asteroid hit';
    this.shell?.showResult({ title, returnHundredths: ret, stakeHundredths: this.betHundredths, tone: ret > this.betHundredths ? 'success' : ret === 0 ? 'loss' : 'neutral' });
    this.refreshUi();
  }

  // ─── Frame loop ───────────────────────────────────────────────────────────

  private onFrame(_smoothed: number): void {
    const round = this.round; const runner = this.runner;
    if (!round || !runner) return;
    if (this.phase === 'playing') {
      if (this.heldDir !== 0) {
        this.keyTargetX = Phaser.Math.Clamp(this.keyTargetX + this.heldDir * KEY_STEER_WORLD_PER_FRAME, 0, WORLD_W);
        runner.queue('steer', Math.round(this.keyTargetX));
      }
      const ran = runner.advance(this.scene.game.loop.rawDelta);
      if (runner.paused === 'hitch') { this.phase = 'paused'; this.shell?.setPaused('Paused after a long frame\nTap or press Space to resume'); }
      if (round.state.coinsCollected > this.lastCoins) { this.lastCoins = round.state.coinsCollected; this.coinFx(); }
      if (round.settlement && this.phase === 'playing') this.onSettled(round.settlement);
      else if (ran > 0) this.refreshUi();
    }
    this.render(this.phase === 'playing' ? runner.alpha : 1);
  }

  // ─── Textures & world ─────────────────────────────────────────────────────

  private makeTextures(): void {
    const scene = this.scene;
    if (!scene.textures.exists(ROCK_KEYS[0])) {
      ROCK_KEYS.forEach((key, variant) => makeDenseTexture(scene, key, ROCK_TEX, ROCK_TEX, (g) => {
        const c = ROCK_TEX / 2; const r = ROCK_TEX / 2 - 3;
        const pts: Phaser.Math.Vector2[] = [];
        const n = 9 + variant;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          const rr = r * (0.82 + 0.18 * Math.abs(Math.sin(i * (1.7 + variant * 0.6) + variant)));
          pts.push(new Phaser.Math.Vector2(c + Math.cos(a) * rr, c + Math.sin(a) * rr));
        }
        g.fillStyle(ROCK_SHADE, 1).fillPoints(pts.map((p) => new Phaser.Math.Vector2(p.x + 2, p.y + 3)), true);
        g.fillStyle(ROCK_BODY, 1).fillPoints(pts, true);
        g.fillStyle(ROCK_CRATER, 1);
        g.fillCircle(c - r * 0.25, c + r * 0.1, r * 0.17);
        g.fillCircle(c + r * 0.28, c - r * 0.2, r * 0.11);
        g.fillCircle(c + r * 0.05, c + r * 0.42, r * 0.08);
        // One pale upper-left rim.
        g.lineStyle(3, ROCK_RIM, 0.85);
        g.beginPath();
        const start = Math.floor(n * 0.55); const end = Math.floor(n * 0.85);
        g.moveTo(pts[start].x, pts[start].y);
        for (let i = start + 1; i <= end; i++) g.lineTo(pts[i % n].x, pts[i % n].y);
        g.strokePath();
      }));
    }
    makeDenseTexture(scene, COIN_KEY, COIN_TEX, COIN_TEX, (g) => {
      const c = COIN_TEX / 2;
      g.fillStyle(COIN_RIM, 1).fillCircle(c, c, c - 1);
      g.fillStyle(COIN, 1).fillCircle(c, c, c - 4);
      g.lineStyle(2, COIN_RIM, 0.8).strokeCircle(c, c, c - 8);
      g.fillStyle(COIN_SHINE, 0.85).fillCircle(c - 4, c - 5, 3);
    });
  }

  private buildWorld(): void {
    this.destroyWorld();
    const scene = this.scene; const S = STAGE;
    const tokens = this.shell?.tokens;
    const sky = scene.add.graphics().setDepth(DEPTH.sky);
    sky.fillGradientStyle(SKY_TOP, SKY_TOP, SKY_BOTTOM, SKY_BOTTOM, 1).fillRect(S.x, S.y, S.width, S.height);
    this.sky = sky;
    this.stars = [0, 1].map(() => {
      const g = scene.add.graphics().setDepth(DEPTH.sky);
      for (let i = 0; i < STAR_COUNT; i++) {
        const x = (i * 131) % S.width; const y = (i * 197) % S.height;
        g.fillStyle(0xe3ebf7, 0.25 + (i % 5) * 0.1).fillCircle(S.x + x, y, i % 9 === 0 ? 1.3 : 0.8);
      }
      return g;
    });

    // One small cropped planet top-right with broad bands (non-colliding, subdued).
    const pl = scene.add.graphics().setDepth(DEPTH.planet);
    const px = S.x + S.width + 6; const py = S.y + 44; const pr = 78;
    pl.fillStyle(PLANET, 1).fillCircle(px, py, pr);
    pl.fillStyle(PLANET_BAND, 0.6).fillEllipse(px - 8, py - 26, pr * 2.1, 16);
    pl.fillStyle(PLANET_BAND, 0.45).fillEllipse(px - 14, py + 14, pr * 2.1, 12);
    pl.fillStyle(PLANET_SHADE, 0.55).fillCircle(px + 24, py + 18, pr * 0.92);
    this.planet = pl;

    // Satellite silhouette (cosmetic only, slow drift).
    const sat = scene.add.graphics().setDepth(DEPTH.planet);
    sat.fillStyle(0x8fa6c8, 0.9).fillRect(-5, -4, 10, 8);
    sat.fillStyle(0x5f7fb0, 0.9).fillRect(-19, -3, 12, 6).fillRect(7, -3, 12, 6);
    sat.lineStyle(1, 0xb9c8e0, 0.8).lineBetween(-7, 0, -5, 0).lineBetween(5, 0, 7, 0);
    sat.setPosition(S.x + 54, S.y + 64).setAngle(-24);
    this.satellite = sat;

    this.horizonFar = scene.add.graphics().setDepth(DEPTH.horizon);
    this.horizonNear = scene.add.graphics().setDepth(DEPTH.horizon);
    this.drawHorizon(this.horizonFar, HORIZON_FAR, 70, 0.55);
    this.drawHorizon(this.horizonNear, HORIZON_NEAR, 34, 0.38);

    const g = scene.add.graphics().setDepth(DEPTH.gutter);
    g.fillStyle(hexToInt(tokens?.background ?? '#0d121a'), GUTTER_DIM_ALPHA);
    g.fillRect(S.x, S.y, ORIGIN_X - S.x, S.height);
    g.fillRect(wx(WORLD_W), S.y, S.x + S.width - wx(WORLD_W), S.height);
    g.lineStyle(1, 0x8fa3c4, 0.18).lineBetween(ORIGIN_X, S.y, ORIGIN_X, S.y + S.height).lineBetween(wx(WORLD_W), S.y, wx(WORLD_W), S.y + S.height);
    this.gutters = g;

    this.flame = scene.add.graphics().setDepth(DEPTH.flame);
    const place = characterPlacement('jett-pilot', variantOf(pilotTexture));
    this.pilot = scene.add.image(0, 0, pilotTexture).setScale(place.scale).setOrigin(place.originX, place.originY).setDepth(DEPTH.pilot);
    this.hint = scene.add.text(S.x + S.width / 2, S.y + S.height - 26, 'DRAG TO STEER', { fontFamily: '"Inter", system-ui, sans-serif', fontSize: '12px', color: '#e8edf4', fontStyle: 'bold' })
      .setOrigin(0.5).setDepth(DEPTH.hint).setLetterSpacing(1.6);
    this.bonusText = scene.add.text(0, 0, '+0.03×', { fontFamily: '"Inter", system-ui, sans-serif', fontSize: '13px', color: '#f2c14e', fontStyle: 'bold' })
      .setOrigin(0.5).setDepth(DEPTH.fx).setVisible(false);
    this.debug = this.debugEnabled ? scene.add.graphics().setDepth(DEPTH.debug) : null;
  }

  private drawHorizon(g: Phaser.GameObjects.Graphics, color: number, baseH: number, bulge: number): void {
    const S = STAGE; const bottom = S.y + S.height;
    g.fillStyle(color, 1);
    g.beginPath();
    g.moveTo(S.x, bottom);
    for (let i = 0; i <= 24; i++) {
      const x = S.x + (S.width * i) / 24;
      const u = i / 24 - 0.5;
      g.lineTo(x, bottom - baseH - (1 - 4 * u * u) * baseH * bulge);
    }
    g.lineTo(S.x + S.width, bottom);
    g.closePath();
    g.fillPath();
  }

  // ─── Rendering ────────────────────────────────────────────────────────────

  private render(alpha: number): void {
    const round = this.round; if (!round || !this.pilot) return;
    const st = round.state;
    const alt = this.prevAltitude + (st.altitude - this.prevAltitude) * alpha;
    const playerX = this.prevPlayerX + (st.playerX - this.prevPlayerX) * alpha;

    if (this.stars.length) {
      const off = ((alt * STAR_PARALLAX) % STAGE.height + STAGE.height) % STAGE.height;
      this.stars[0].y = STAGE.y + off;
      this.stars[1].y = STAGE.y + off - STAGE.height;
    }
    this.horizonFar?.setY(alt * HORIZON_FAR_PARALLAX);
    this.horizonNear?.setY(alt * HORIZON_NEAR_PARALLAX);
    if (this.satellite) this.satellite.x = STAGE.x + 54 + ((this.scene.time.now * SATELLITE_DRIFT_PER_MS) % 30);

    // Asteroids: pooled images keyed by logic id.
    const live = new Set<number>();
    for (const a of st.asteroids) {
      live.add(a.id);
      let img = this.rockById.get(a.id);
      if (!img) {
        img = this.rockPool.pop() ?? this.scene.add.image(0, 0, ROCK_KEYS[0]).setDepth(DEPTH.rocks);
        img.setTexture(ROCK_KEYS[a.id % ROCK_KEYS.length]).setVisible(true);
        this.rockById.set(a.id, img);
      }
      const ax = (this.prevRockX.get(a.id) ?? a.x) + (a.x - (this.prevRockX.get(a.id) ?? a.x)) * alpha;
      const d = a.radius * 2 * ASTEROID_VISUAL_SCALE * K;
      img.setPosition(wx(ax), sy(a.worldY, alt)).setDisplaySize(d, d).setAngle(a.rotationAngle);
    }
    for (const [id, img] of this.rockById) if (!live.has(id)) { img.setVisible(false); this.rockPool.push(img); this.rockById.delete(id); }
    this.shell?.setHudObstruction([...this.rockById.values()].map((im) => ({ x: im.x - im.displayWidth / 2, y: im.y - im.displayHeight / 2, w: im.displayWidth, h: im.displayHeight })));

    const liveCoins = new Set<number>();
    for (const c of st.coins) {
      if (c.collected) continue;
      liveCoins.add(c.id);
      let img = this.coinById.get(c.id);
      if (!img) { img = this.coinPool.pop() ?? this.scene.add.image(0, 0, COIN_KEY).setDepth(DEPTH.coins); img.setVisible(true); this.coinById.set(c.id, img); }
      const d = c.radius * 2 * K * (0.92 + 0.08 * Math.sin(c.animPhase * Math.PI * 2));
      img.setPosition(wx(c.x), sy(c.worldY, alt)).setDisplaySize(d, d);
    }
    for (const [id, img] of this.coinById) if (!liveCoins.has(id)) { img.setVisible(false); this.coinPool.push(img); this.coinById.delete(id); }

    const px = wx(playerX); const py = ORIGIN_Y + PLAYER_SCREEN_WORLD_Y * K;
    // Restrained lean toward the direction of travel, eased so it never snaps.
    const reduced = !!this.shell?.settings.reducedMotion;
    const maxLean = reduced ? LEAN_MAX_REDUCED_DEG : LEAN_MAX_DEG;
    const targetLean = this.phase === 'playing' ? Phaser.Math.Clamp((st.playerX - playerX) * LEAN_PER_PX, -maxLean, maxLean) : 0;
    this.lean += (targetLean - this.lean) * LEAN_EASE;
    this.pilot.setPosition(px, py - 4).setAngle(this.lean);
    if (this.flame) {
      this.flame.clear();
      if (st.isAlive && this.phase !== 'settled') {
        const n = characterAnchor('jett-pilot', variantOf(pilotTexture), 'nozzle', this.lean);
        const frame = reduced ? 0 : Math.floor(this.scene.time.now / FLAME_FRAME_MS) % FLAME_LEN.length;
        const len = FLAME_LEN[frame] * (this.phase === 'ready' ? 0.75 : 1);
        this.drawFlame(this.flame, px + n.x, py - 4 + n.y, len, this.lean);
      }
    }
    if (this.debug) {
      this.debug.clear().lineStyle(1, 0xff4d6d, 1);
      this.debug.strokeCircle(px, py, st.playerRadius * JETT_PLAYER_HIT_FRACTION * K);
      for (const a of st.asteroids) this.debug.strokeCircle(wx(a.x), sy(a.worldY, alt), a.radius * JETT_ASTEROID_HIT_FRACTION * K);
      this.debug.lineStyle(1, 0x75d6b1, 1);
      for (const c of st.coins) if (!c.collected) this.debug.strokeCircle(wx(c.x), sy(c.worldY, alt), (c.radius + st.playerRadius) * K);
    }
  }

  /** Tapered teardrop flame pointing away from the nozzle (vector: crisp at any render scale). */
  private drawFlame(g: Phaser.GameObjects.Graphics, x: number, y: number, len: number, angleDeg: number): void {
    const r = Phaser.Math.DegToRad(angleDeg);
    const dx = -Math.sin(r); const dy = Math.cos(r); // "down" in the pilot's frame
    const nx = Math.cos(r); const ny = Math.sin(r);
    const shape = (w: number, l: number) => {
      const pts: Phaser.Math.Vector2[] = [];
      for (let i = 0; i <= 10; i++) {
        const t = i / 10; const half = (w / 2) * Math.sin(Math.PI * (0.5 + 0.5 * t)) * (1 - t * 0.15);
        pts.push(new Phaser.Math.Vector2(x + nx * half + dx * l * t, y + ny * half + dy * l * t));
      }
      for (let i = 10; i >= 0; i--) {
        const t = i / 10; const half = (w / 2) * Math.sin(Math.PI * (0.5 + 0.5 * t)) * (1 - t * 0.15);
        pts.push(new Phaser.Math.Vector2(x - nx * half + dx * l * t, y - ny * half + dy * l * t));
      }
      return pts;
    };
    g.fillStyle(FLAME_OUTER, 0.9).fillPoints(shape(FLAME_W, len), true);
    g.fillStyle(FLAME_INNER, 1).fillPoints(shape(FLAME_W * 0.55, len * 0.6), true);
    g.fillStyle(0xffffff, 0.85).fillPoints(shape(FLAME_W * 0.25, len * 0.28), true);
  }

  private coinFx(): void {
    AudioService.cue('coin');
    this.shell?.haptic(15);
    if (!this.pilot || !this.bonusText) return;
    const x = this.pilot.x; const y = this.pilot.y - 24;
    const reduced = this.shell?.settings.reducedMotion;
    this.bonusText.setPosition(x + 22, y).setAlpha(1).setVisible(true);
    this.scene.tweens.add({ targets: this.bonusText, y: y - (reduced ? 0 : 18), alpha: 0, duration: BONUS_TEXT_MS, onComplete: () => this.bonusText?.setVisible(false) });
    if (reduced) return;
    for (let i = 0; i < SPARKLE_COUNT; i++) {
      const s = this.sparkles.find((p) => !p.visible) ?? this.scene.add.arc(0, 0, 1.8, 0, 360, false, COIN_SHINE, 1).setDepth(DEPTH.fx);
      if (!this.sparkles.includes(s)) this.sparkles.push(s);
      const a = (i / SPARKLE_COUNT) * Math.PI * 2;
      s.setPosition(x, y + 10).setAlpha(1).setVisible(true);
      this.scene.tweens.add({ targets: s, x: x + Math.cos(a) * 14, y: y + 10 + Math.sin(a) * 14, alpha: 0, duration: SPARKLE_MS, onComplete: () => s.setVisible(false) });
    }
  }

  private crashFx(combust: boolean): void {
    AudioService.cue('crash');
    this.shell?.haptic(40);
    this.pilot?.setTint(combust ? 0xffb38a : 0xb4bccb);
    if (this.shell?.settings.reducedMotion) return;
    this.scene.cameras.main.shake(CRASH_SHAKE_MS, CRASH_SHAKE_INTENSITY);
  }

  // ─── HUD / footer ─────────────────────────────────────────────────────────

  private refreshUi(): void {
    const shell = this.shell; const round = this.round; if (!shell || !round) return;
    const st = round.state;
    const progress = `${Math.floor(st.altitude)} m altitude · ${st.coinsCollected} ${st.coinsCollected === 1 ? 'coin' : 'coins'}`;
    if (this.phase === 'settled' && round.settlement) {
      const s = round.settlement; const ret = s.returnHundredths;
      shell.setHud({ phaseLabel: ret > 0 ? 'Round complete' : 'Round ended', multiplier: `${s.multiplier.toFixed(2)}×`, progress, tone: ret > this.betHundredths ? 'success' : ret === 0 ? 'loss' : 'muted' });
      shell.setFooter({ stakeHundredths: this.betHundredths, rightLabel: 'Demo mode', rightValue: ret > 0 ? 'Settled once' : 'No return', ctaLabel: `PLAY AGAIN · ${formatCredits(this.betHundredths)}`, ctaEnabled: true });
    } else if (this.phase === 'ready') {
      shell.setHud({ phaseLabel: 'Ready', multiplier: '1.00×', progress: 'Launch, then drag or use ← → to steer', tone: 'muted' });
      shell.setFooter({ stakeHundredths: this.betHundredths, rightLabel: 'Return if cashed out', rightValue: '—', ctaLabel: `LAUNCH · ${formatCredits(this.betHundredths)}`, ctaEnabled: true, ctaAria: `Launch, stake ${formatCredits(this.betHundredths)} demo credits` });
    } else {
      const ret = toHundredths(parseFloat((st.bet * st.multiplier).toFixed(2)));
      shell.setHud({ phaseLabel: 'Current multiplier', multiplier: `${st.multiplier.toFixed(2)}×`, progress, tone: 'accent' });
      shell.setFooter({ stakeHundredths: this.betHundredths, rightLabel: 'Return if cashed out', rightValue: `${formatCredits(ret)} credits`, ctaLabel: 'CASH OUT', ctaEnabled: this.phase === 'playing' && canCashOutJett(round), ctaAria: `Cash out ${formatCredits(ret)} demo credits` });
    }
    this.hint?.setVisible(this.phase !== 'settled' && (this.phase === 'ready' || st.altitude < 120));
    shell.setStageActions([]);
  }

  // ─── Test/diagnostic hooks (read-only) ───────────────────────────────────

  /** @returns Snapshot for browser tests. */
  public debugSnapshot(): Record<string, unknown> {
    const st = this.round?.state;
    return {
      phase: this.phase, roundId: this.roundId, seed: this.seed, simVersion: JETT_SIM_VERSION, rngAlgorithm: RNG_ALGORITHM_V2,
      tick: this.round?.tick ?? 0, settlement: this.round?.settlement ?? null, targetX: this.round?.targetX,
      playerX: st?.playerX, altitude: st?.altitude, multiplier: st?.multiplier, coins: st?.coinsCollected,
      asteroids: st?.asteroids.map((a) => ({ id: a.id, x: a.x, y: a.worldY, r: a.radius })),
      coinList: st?.coins.filter((c) => !c.collected).map((c) => ({ id: c.id, x: c.x, y: c.worldY })),
      balance: getPageLedger().balanceHundredths, runnerPaused: this.runner?.paused ?? null,
      pooled: { rocks: this.rockPool.length + this.rockById.size, coins: this.coinPool.length + this.coinById.size },
    };
  }
}

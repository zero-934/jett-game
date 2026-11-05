/**
 * @file FlapFortuneUI.ts
 * @purpose Phaser rendering + input for Flap Fortune (polish-003 pilot segment).
 *          Refined 2D "moonlit rooftops": layered sky/skyline, straight teal pipes with brass
 *          bands that stay inside the 30 world-px hitbox, the unchanged wizard study.
 *          Simulation runs only in the shared fixed-step runner; this file renders once per frame
 *          with interpolation and turns input into tick-stamped actions. Gameplay geometry is the
 *          unchanged 390×844 world, fitted uniformly into the stage (no crop, no stretch).
 * @author Agent 934
 * @date 2026-04-12 (polish-003 rewrite: 2026-11-05)
 * @license Proprietary – available for licensing
 */

import * as Phaser from 'phaser';
import type { FlapFortuneConfig, FlapRound, FlapSettlement } from './FlapFortuneLogic';
import { createFlapRound, stepFlapRound, canCashOutFlap, FLAP_PLAYER_X, FLAP_PIPE_WIDTH, FLAP_SIM_VERSION } from './FlapFortuneLogic';
import { FixedStepRunner } from '../shared/sim/FixedStepRunner';
import { getPageLedger, nextRoundId, toHundredths, formatCredits } from '../shared/sim/DemoLedger';
import { createSeedString, RNG_ALGORITHM_V2 } from '../shared/rng/ProvablyFairRNG';
import { SoftDepthShell } from '../shared/ui/SoftDepthShell';
import type { ShellKey } from '../shared/ui/SoftDepthShell';
import { hexToInt, fitWorld, LAYOUT_IMMERSIVE } from '../shared/ui/SoftDepthTheme';
import { AudioService } from '../shared/audio/AudioService';

// ─── World fit (docs/polish-003/ART_AND_LAYOUT.md "Preserving Flap and Jett worlds") ──
// polish-003 scale fix: Flap uses the immersive shell layout (stage 374×664 at y 56), so the
// unchanged 390×844 world fits at k ≈ 0.787 instead of 0.645 (+22 %), with ceiling and floor
// still fully visible. World geometry, hitboxes and pipe spacing are unchanged.
const WORLD_W = 390;
const WORLD_H = 844;
const FIT = fitWorld(LAYOUT_IMMERSIVE.stage, WORLD_W, WORLD_H);
const STAGE = LAYOUT_IMMERSIVE.stage;
const K = FIT.k;             // 0.78672…
const ORIGIN_X = FIT.originX; // 41.59…
const ORIGIN_Y = FIT.originY; // 56

// ─── Art (revision 004) ───────────────────────────────────────────────────────
const SKY_TOP = 0x16223d;
const SKY_BOTTOM = 0x23365a;
const MOON = 0xf2d48a;
const MOON_CUT = 0x18253f; // sky colour at the moon's height (gradient sample)
const CLOUD = 0x2c3e64;
const FAR_SKYLINE = 0x1b2947;
const NEAR_SKYLINE = 0x121c32;
const WINDOW_WARM = 0xe9b65c;
const PIPE_BODY = 0x3f8f88;
const PIPE_SHADE = 0x2d6b66;
const PIPE_HIGHLIGHT = 0x7cc6bb;
const PIPE_BAND = 0xc9a24f;
const PIPE_BAND_DARK = 0x8f7234;
const GUTTER_DIM_ALPHA = 0.28;
const PIPE_BAND_WORLD_H = 16;
const WIZARD_DISPLAY_WORLD_H = 60; // +7% vs 56: largest size whose robed body still sits inside the 28×28 hitbox (63 overhangs it) // hat-to-broom; at this size the robed body ≈ the 28×28 collision box (verified with ?debug=1)
const WIZARD_TEXTURE = 'flap-wizard';
const SKYLINE_FAR_KEY = 'flap-skyline-far';
const SKYLINE_NEAR_KEY = 'flap-skyline-near';
const SKYLINE_FAR_PARALLAX = 0.05;
const SKYLINE_NEAR_PARALLAX = 0.11;
const SPECKS_PER_FLAP = 4;
const SPECK_MS = 240;
const HINT_FLAPS_BEFORE_FADE = 3;
const TILT_PER_VELOCITY = 2.2;
const TILT_MIN = -18;
const TILT_MAX = 28;
const DEPTH = { sky: 1, far: 2, near: 3, pipes: 6, wizard: 7, fx: 8, hint: 9, gutter: 10, debug: 30 } as const;

/** World → logical screen. */
function wx(x: number): number { return ORIGIN_X + x * K; }
function wy(y: number): number { return ORIGIN_Y + y * K; }

/** Phase of this UI's round. 'armed' = stake debited, waiting for the first flap. */
/** Review/QA only: `?seed=abc` fixes round seeds (abc-1, abc-2, …) for reproducible captures. */
let reviewSeedCounter = 0;
function reviewSeed(): string | null {
  if (typeof window === 'undefined') return null;
  const base = new URLSearchParams(window.location.search).get('seed');
  return base ? `${base}-${++reviewSeedCounter}` : null;
}

type UIPhase = 'ready' | 'armed' | 'playing' | 'paused' | 'settled';

/**
 * Flap Fortune renderer/controller.
 * @example
 * const ui = new FlapFortuneUI(scene, config); ui.start(10);
 */
export class FlapFortuneUI {
  private scene: Phaser.Scene;
  private config: FlapFortuneConfig;
  private shell: SoftDepthShell | null = null;
  private round: FlapRound | null = null;
  private runner: FixedStepRunner | null = null;
  private roundId = '';
  private seed = '';
  private betHundredths = 1000;
  private phase: UIPhase = 'ready';
  private flapsThisRound = 0;

  // Interpolation snapshots (state at the start of the latest tick)
  private prevPlayerY = WORLD_H / 2;
  private prevVelocity = 0;
  private prevPipeX = new WeakMap<object, number>();
  private distance = 0;

  // Display objects
  private sky: Phaser.GameObjects.Graphics | null = null;
  private farLayer: Phaser.GameObjects.TileSprite | null = null;
  private nearLayer: Phaser.GameObjects.TileSprite | null = null;
  private gutters: Phaser.GameObjects.Graphics | null = null;
  private pipes: Phaser.GameObjects.Graphics | null = null;
  private wizard: Phaser.GameObjects.Image | null = null;
  private hint: Phaser.GameObjects.Text | null = null;
  private exitHint: Phaser.GameObjects.Text | null = null;
  private exitBand: Phaser.GameObjects.Graphics | null = null;
  private debug: Phaser.GameObjects.Graphics | null = null;
  private specks: Phaser.GameObjects.Arc[] = [];
  private readonly debugEnabled: boolean;
  private readonly onFrameBound = (_t: number, delta: number) => this.onFrame(delta);
  private started = false;

  /**
   * @param scene - Owning scene.
   * @param config - Gameplay config (unchanged production values).
   */
  constructor(scene: Phaser.Scene, config: FlapFortuneConfig) {
    this.scene = scene;
    this.config = { ...config };
    this.debugEnabled = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1';
  }

  /**
   * Loads the wizard texture (call from Scene.preload).
   * @param scene - Scene.
   * @returns void
   * @example
   * FlapFortuneUI.preload(this);
   */
  static preload(scene: Phaser.Scene): void {
    if (!scene.textures.exists(WIZARD_TEXTURE)) scene.load.image(WIZARD_TEXTURE, `${import.meta.env.BASE_URL}assets/polish-003/flap-wizard.png`);
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
      title: 'Flap Fortune',
      layout: LAYOUT_IMMERSIVE,
      onBack: () => { window.location.href = 'https://zero-934.github.io/jett-landing/'; },
      onPrimary: () => this.onPrimary(),
      onStageDown: () => this.onPress(),
      onKey: (k) => this.onKey(k),
      onSettingsOpen: (open) => { if (open) this.pause('settings'); },
      onSettingsChanged: () => { this.buildWorld(); this.refreshUi(); },
      onVisibilityLost: (reason) => this.pause(reason),
    });
    this.shell.setBalance(getPageLedger().balanceHundredths);
    this.buildWorld();
    this.newRound();
    this.scene.events.on(Phaser.Scenes.Events.UPDATE, this.onFrameBound);
    this.started = true;
  }

  /** Releases everything this UI registered. Idempotent. */
  public cleanup(): void {
    if (this.started) this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.onFrameBound);
    this.started = false;
    for (const o of [this.sky, this.farLayer, this.nearLayer, this.gutters, this.pipes, this.wizard, this.hint, this.exitHint, this.exitBand, this.debug]) o?.destroy();
    for (const s of this.specks) s.destroy();
    this.specks = [];
    this.sky = this.farLayer = this.nearLayer = null;
    this.gutters = this.pipes = this.exitBand = this.debug = null;
    this.wizard = null; this.hint = this.exitHint = null;
    this.shell?.destroy();
    this.shell = null;
    this.round = null;
    this.runner = null;
  }

  // ─── Round lifecycle ──────────────────────────────────────────────────────

  private newRound(): void {
    this.seed = reviewSeed() ?? createSeedString();
    this.roundId = nextRoundId('flap');
    this.round = createFlapRound(this.seed, this.betHundredths / 100, this.config);
    const round = this.round;
    this.runner = new FixedStepRunner((_tick, actions) => {
      this.snapshot();
      return stepFlapRound(round, actions);
    });
    this.phase = 'ready';
    this.flapsThisRound = 0;
    this.distance = 0;
    this.prevPlayerY = round.state.playerY;
    this.prevVelocity = 0;
    this.shell?.hideResult();
    this.shell?.setPaused(null);
    this.refreshUi();
  }

  private snapshot(): void {
    if (!this.round) return;
    this.prevPlayerY = this.round.state.playerY;
    this.prevVelocity = this.round.state.playerVelocityY;
    for (const p of this.round.state.pipes) this.prevPipeX.set(p, p.x);
  }

  /** Debits once and arms the round. */
  private debit(): boolean {
    if (this.phase !== 'ready') return false;
    if (!getPageLedger().start(this.roundId, this.betHundredths)) return false;
    this.shell?.setBalance(getPageLedger().balanceHundredths);
    this.phase = 'armed';
    this.shell?.announce(`Round started. Stake ${formatCredits(this.betHundredths)} demo credits.`);
    return true;
  }

  private onPrimary(): void {
    if (this.phase === 'ready') { this.debit(); this.refreshUi(); return; }
    if (this.phase === 'playing' && this.round && canCashOutFlap(this.round)) { this.runner?.queue('cashOut'); return; }
    if (this.phase === 'settled') { this.newRound(); }
  }

  /** One accepted press edge (pointer or key). */
  private onPress(): void {
    if (this.phase === 'paused') { this.resume(); return; }
    if (this.phase === 'settled') return;
    if (this.phase === 'ready' && !this.debit()) return;
    if (this.phase === 'armed') { this.runner?.begin(); this.phase = 'playing'; }
    if (this.phase !== 'playing') return;
    if (this.runner?.queue('flap')) {
      this.flapsThisRound++;
      this.spawnSpecks();
      AudioService.cue('tap');
    }
  }

  private onKey(k: ShellKey): void {
    if (k.type !== 'down' || k.repeat) return; // key auto-repeat never adds flaps
    if (k.code === 'Space' || k.code === 'ArrowUp') this.onPress();
  }

  private pause(reason: 'settings' | 'hidden' | 'blur'): void {
    if (this.phase !== 'playing') return;
    this.runner?.pause(reason);
    this.phase = 'paused';
    this.shell?.setPaused(reason === 'settings' ? null : 'Paused\nTap the sky or press Space to resume');
  }

  private resume(): void {
    if (this.phase !== 'paused' || this.shell?.settingsOpen) return;
    this.runner?.resume();
    this.phase = 'playing';
    this.shell?.setPaused(null);
  }

  private onSettled(s: FlapSettlement): void {
    this.phase = 'settled';
    this.runner?.finishSettlement();
    const record = getPageLedger().settle(this.roundId, s.returnHundredths, s.reason);
    this.shell?.setBalance(getPageLedger().balanceHundredths);
    const ret = record?.returnHundredths ?? s.returnHundredths;
    AudioService.settle(ret, this.betHundredths);
    if (ret === 0) { AudioService.cue('crash'); this.shell?.haptic(40); }
    const title = s.reason === 'cashout' ? 'Cashed out' : s.reason === 'dive' ? 'Dived out' : s.reason === 'combust' ? 'Spell backfired' : s.reason === 'ceiling' ? 'Hit the sky limit' : s.reason === 'floor' ? 'Landed too early' : 'Hit a pipe';
    this.shell?.showResult({ title, returnHundredths: ret, stakeHundredths: this.betHundredths, tone: ret > this.betHundredths ? 'success' : ret === 0 ? 'loss' : 'neutral' });
    this.refreshUi();
  }

  // ─── Frame loop ───────────────────────────────────────────────────────────

  private onFrame(_smoothedDelta: number): void {
    if (!this.round || !this.runner) return;
    if (this.phase === 'playing') {
      const ran = this.runner.advance(this.scene.game.loop.rawDelta);
      if (ran > 0) this.distance = this.round.state.distanceTravelled;
      if (this.runner.paused === 'hitch') { this.phase = 'paused'; this.shell?.setPaused('Paused after a long frame\nTap the sky or press Space to resume'); }
      if (this.round.settlement && this.phase === 'playing') this.onSettled(this.round.settlement);
      else if (ran > 0) this.refreshUi();
    }
    this.render(this.phase === 'playing' ? this.runner.alpha : 1);
  }

  // ─── World construction ──────────────────────────────────────────────────

  private buildWorld(): void {
    for (const o of [this.sky, this.farLayer, this.nearLayer, this.gutters, this.pipes, this.wizard, this.hint, this.exitHint, this.exitBand, this.debug]) o?.destroy();
    const scene = this.scene;
    const S = STAGE;
    const tokens = this.shell?.tokens;
    // Sky: gradient + moon + two clouds + sparse stars (static, drawn once).
    const sky = scene.add.graphics().setDepth(DEPTH.sky);
    sky.fillGradientStyle(SKY_TOP, SKY_TOP, SKY_BOTTOM, SKY_BOTTOM, 1).fillRect(S.x, S.y, S.width, S.height);
    for (let i = 0; i < 22; i++) {
      const sx = S.x + ((i * 97) % S.width); const sy = S.y + 8 + ((i * 53) % 240);
      sky.fillStyle(0xdfe7f5, 0.18 + (i % 4) * 0.08).fillCircle(sx, sy, i % 6 === 0 ? 1.2 : 0.8);
    }
    const mx = S.x + S.width * 0.66; const my = S.y + 150;
    sky.fillStyle(MOON, 1).fillCircle(mx, my, 18);
    sky.fillStyle(MOON_CUT, 1).fillCircle(mx + 8, my - 6, 15.5);
    for (const [cx, cy, w] of [[S.x + 66, S.y + 214, 70], [S.x + S.width - 58, S.y + 290, 60]] as const) {
      sky.fillStyle(CLOUD, 1);
      sky.fillRoundedRect(cx - w / 2, cy, w, 14, 7);
      sky.fillCircle(cx - w * 0.12, cy + 2, 11);
      sky.fillCircle(cx + w * 0.14, cy, 9);
    }
    this.sky = sky;

    // Skyline layers: seamless tiles generated once, scrolled cosmetically.
    this.makeSkylineTexture(SKYLINE_FAR_KEY, FAR_SKYLINE, 120, false);
    this.makeSkylineTexture(SKYLINE_NEAR_KEY, NEAR_SKYLINE, 86, true);
    this.farLayer = scene.add.tileSprite(S.x, S.y + S.height - 200, S.width, 170, SKYLINE_FAR_KEY).setScale(1, 200 / 170).setOrigin(0).setDepth(DEPTH.far);
    this.nearLayer = scene.add.tileSprite(S.x, S.y + S.height - 140, S.width, 120, SKYLINE_NEAR_KEY).setScale(1, 140 / 120).setOrigin(0).setDepth(DEPTH.near);

    // Gutters outside the fitted world are dimmed so the lethal playfield reads clearly.
    const g = scene.add.graphics().setDepth(DEPTH.gutter);
    g.fillStyle(hexToInt(tokens?.background ?? '#0d121a'), GUTTER_DIM_ALPHA);
    g.fillRect(S.x, S.y, ORIGIN_X - S.x, S.height);
    g.fillRect(wx(WORLD_W), S.y, S.x + S.width - wx(WORLD_W), S.height);
    g.lineStyle(1, 0x8fa3c4, 0.18);
    g.lineBetween(ORIGIN_X, S.y, ORIGIN_X, S.y + S.height);
    g.lineBetween(wx(WORLD_W), S.y, wx(WORLD_W), S.y + S.height);
    this.gutters = g;

    this.pipes = scene.add.graphics().setDepth(DEPTH.pipes);
    this.exitBand = scene.add.graphics().setDepth(DEPTH.hint);
    this.exitBand.fillStyle(hexToInt(tokens?.accent ?? '#d6b76f'), 0.22).fillRect(ORIGIN_X, wy(WORLD_H) - 8, WORLD_W * K, 8);
    this.exitBand.lineStyle(1, hexToInt(tokens?.accent ?? '#d6b76f'), 0.8).lineBetween(ORIGIN_X, wy(WORLD_H) - 8, wx(WORLD_W), wy(WORLD_H) - 8);
    this.exitBand.setVisible(false);

    const scale = (WIZARD_DISPLAY_WORLD_H * K) / (scene.textures.exists(WIZARD_TEXTURE) ? scene.textures.get(WIZARD_TEXTURE).getSourceImage().height : 164);
    this.wizard = scene.add.image(wx(FLAP_PLAYER_X), wy(WORLD_H / 2), WIZARD_TEXTURE).setScale(scale).setDepth(DEPTH.wizard);
    const hintStyle = { fontFamily: '"Inter", system-ui, sans-serif', fontSize: '14px', color: '#e8edf4', fontStyle: 'bold' };
    this.hint = scene.add.text(S.x + S.width / 2, S.y + S.height - 30, 'TAP THE SKY TO FLAP', hintStyle).setOrigin(0.5).setDepth(DEPTH.hint).setLetterSpacing(1.6);
    this.exitHint = scene.add.text(S.x + S.width / 2, S.y + S.height - 50, 'DIVE TO CASH OUT · AFTER FIRST GATE', { ...hintStyle, fontSize: '12px', color: '#c8d3e2' }).setOrigin(0.5).setDepth(DEPTH.hint).setLetterSpacing(1.2);
    for (const t of [this.hint, this.exitHint]) t.setResolution(Math.min(3, window.devicePixelRatio || 1));
    this.debug = this.debugEnabled ? scene.add.graphics().setDepth(DEPTH.debug) : null;
    this.render(1);
  }

  private makeSkylineTexture(key: string, color: number, height: number, near: boolean): void {
    if (this.scene.textures.exists(key)) return;
    const w = STAGE.width;
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(color, 1);
    // Roofs/chimneys inset from both edges so the tile wraps seamlessly.
    const roofs = near
      ? [[6, 54, 50], [64, 40, 44], [118, 60, 58], [186, 46, 40], [236, 66, 52], [298, 42, 54]]
      : [[0, 70, 44], [46, 92, 40], [96, 64, 50], [156, 80, 38], [204, 58, 46], [260, 76, 42], [308, 66, 50]];
    for (const [x, h, rw] of roofs) {
      g.fillRect(x, height - h, rw, h);
      g.fillTriangle(x - 4, height - h, x + rw + 4, height - h, x + rw / 2, height - h - (near ? 18 : 14));
      if (near) g.fillRect(x + rw * 0.7, height - h - 22, 7, 16); // chimney
    }
    g.fillRect(0, height - 12, w, 12);
    if (!near) {
      // One modest distant clocktower.
      g.fillRect(212, height - 128, 22, 128);
      g.fillTriangle(208, height - 128, 238, height - 128, 223, height - 150);
      g.fillStyle(WINDOW_WARM, 0.55).fillCircle(223, height - 112, 5);
    } else {
      g.fillStyle(WINDOW_WARM, 0.9);
      for (const [x, y] of [[20, 30], [80, 22], [134, 38], [150, 38], [200, 28], [252, 40], [268, 40], [318, 26]]) g.fillRect(x, height - y, 6, 6);
    }
    g.generateTexture(key, w, height);
    g.destroy();
  }

  // ─── Rendering (once per frame) ──────────────────────────────────────────

  private render(alpha: number): void {
    const round = this.round; if (!round || !this.pipes || !this.wizard) return;
    const st = round.state;
    const lerp = (a: number, b: number) => a + (b - a) * alpha;

    // Parallax (cosmetic, from simulation distance only).
    const dist = this.distance;
    if (this.farLayer) this.farLayer.tilePositionX = dist * SKYLINE_FAR_PARALLAX;
    if (this.nearLayer) this.nearLayer.tilePositionX = dist * SKYLINE_NEAR_PARALLAX;

    // Pipes, clipped to the fitted world so nothing lethal appears in the gutters.
    const g = this.pipes;
    g.clear();
    for (const p of st.pipes) {
      const x = lerp(this.prevPipeX.get(p) ?? p.x, p.x);
      this.drawPipe(g, x, 0, p.topHeight, true);
      this.drawPipe(g, x, WORLD_H - p.bottomHeight, p.bottomHeight, false);
    }

    // Wizard
    const y = lerp(this.prevPlayerY, st.playerY);
    const v = lerp(this.prevVelocity, st.playerVelocityY);
    this.wizard.setPosition(wx(FLAP_PLAYER_X), wy(y)).setAngle(Phaser.Math.Clamp(v * TILT_PER_VELOCITY, TILT_MIN, TILT_MAX));
    this.wizard.setTint(this.phase === 'settled' && round.settlement && round.settlement.returnHundredths === 0 ? 0xb8a6a0 : 0xffffff);

    if (this.debug) {
      this.debug.clear().lineStyle(1, 0xff4d6d, 1);
      this.debug.strokeRect(wx(FLAP_PLAYER_X - st.playerWidth / 2), wy(y - st.playerHeight / 2), st.playerWidth * K, st.playerHeight * K);
      for (const p of st.pipes) {
        const x = lerp(this.prevPipeX.get(p) ?? p.x, p.x);
        this.debug.strokeRect(wx(x), wy(0), FLAP_PIPE_WIDTH * K, p.topHeight * K);
        this.debug.strokeRect(wx(x), wy(WORLD_H - p.bottomHeight), FLAP_PIPE_WIDTH * K, p.bottomHeight * K);
      }
    }
  }

  /** Draws one pipe segment in world coords, clipped to world x ∈ [0, 390]. */
  private drawPipe(g: Phaser.GameObjects.Graphics, worldX: number, worldTop: number, worldHeight: number, isTop: boolean): void {
    if (worldHeight <= 0) return;
    const x0 = Math.max(0, worldX); const x1 = Math.min(WORLD_W, worldX + FLAP_PIPE_WIDTH);
    if (x1 <= x0) return;
    const sx = wx(x0); const sw = (x1 - x0) * K; const sy = wy(worldTop); const sh = worldHeight * K;
    const full = (x: number, w: number, color: number, a = 1) => {
      const l = Math.max(x0, worldX + x); const r = Math.min(x1, worldX + x + w);
      if (r > l) g.fillStyle(color, a).fillRect(wx(l), sy, (r - l) * K, sh);
    };
    g.fillStyle(PIPE_BODY, 1).fillRect(sx, sy, sw, sh);
    full(FLAP_PIPE_WIDTH - 7, 7, PIPE_SHADE);          // shadow side
    full(6, 5, PIPE_HIGHLIGHT, 0.85);                   // one broad highlight strip
    // Brass end band at the gap edge, inside the 30 px hitbox.
    const bandTop = isTop ? worldTop + worldHeight - PIPE_BAND_WORLD_H : worldTop;
    const bandY = wy(bandTop); const bandH = PIPE_BAND_WORLD_H * K;
    g.fillStyle(PIPE_BAND, 1).fillRect(sx, bandY, sw, bandH);
    g.fillStyle(PIPE_BAND_DARK, 1).fillRect(sx, isTop ? bandY + bandH - 2 : bandY, sw, 2);
    const hl = Math.max(x0, worldX + 6); const hr = Math.min(x1, worldX + 11);
    if (hr > hl) g.fillStyle(0xf1d48c, 0.8).fillRect(wx(hl), bandY, (hr - hl) * K, bandH);
  }

  private spawnSpecks(): void {
    if (this.shell?.settings.reducedMotion || !this.wizard) return;
    const ox = this.wizard.x - 10; const oy = this.wizard.y + 6;
    for (let i = 0; i < SPECKS_PER_FLAP; i++) {
      const s = this.specks.find((p) => !p.visible) ?? this.scene.add.arc(0, 0, 1.6, 0, 360, false, 0xf1d48c, 1).setDepth(DEPTH.fx);
      if (!this.specks.includes(s)) this.specks.push(s);
      s.setPosition(ox, oy).setAlpha(1).setVisible(true);
      this.scene.tweens.add({ targets: s, x: ox - 8 - i * 5, y: oy + ((i % 2) * 2 - 1) * (3 + i), alpha: 0, duration: SPECK_MS, onComplete: () => s.setVisible(false) });
    }
  }

  // ─── HUD / footer ─────────────────────────────────────────────────────────

  private refreshUi(): void {
    const shell = this.shell; const round = this.round; if (!shell || !round) return;
    const st = round.state;
    const gates = st.pipesCleared;
    const mult = round.settlement ? round.settlement.multiplier : st.multiplier;
    const returnNow = toHundredths(parseFloat((st.bet * st.multiplier).toFixed(2)));
    if (this.phase === 'settled' && round.settlement) {
      const ret = round.settlement.returnHundredths;
      shell.setHud({ phaseLabel: ret > 0 ? 'Round complete' : 'Round ended', multiplier: `${mult.toFixed(2)}×`, progress: `${gates} ${gates === 1 ? 'gate' : 'gates'} cleared`, tone: ret > this.betHundredths ? 'success' : ret === 0 ? 'loss' : 'muted' });
      shell.setFooter({ stakeHundredths: this.betHundredths, rightLabel: 'Demo mode', rightValue: ret > 0 ? 'Settled once' : 'No return', ctaLabel: `PLAY AGAIN · ${formatCredits(this.betHundredths)}`, ctaEnabled: true });
    } else if (this.phase === 'ready' || this.phase === 'armed') {
      shell.setHud({ phaseLabel: this.phase === 'ready' ? 'Ready' : 'Stake placed', multiplier: '1.00×', progress: 'Tap the sky or press Space to fly', tone: 'muted' });
      shell.setFooter({ stakeHundredths: this.betHundredths, rightLabel: 'Return if cashed out', rightValue: 'after first gate', ctaLabel: this.phase === 'ready' ? `START · ${formatCredits(this.betHundredths)}` : 'TAP THE SKY TO FLY', ctaEnabled: this.phase === 'ready', ctaAria: this.phase === 'ready' ? `Start round, stake ${formatCredits(this.betHundredths)} demo credits` : 'Waiting for the first flap' });
    } else {
      const can = canCashOutFlap(round);
      shell.setHud({ phaseLabel: 'Current multiplier', multiplier: `${mult.toFixed(2)}×`, progress: `${gates} ${gates === 1 ? 'gate' : 'gates'} cleared`, tone: 'accent' });
      shell.setFooter({ stakeHundredths: this.betHundredths, rightLabel: 'Return if cashed out', rightValue: can ? `${formatCredits(returnNow)} credits` : 'after first gate', ctaLabel: 'CASH OUT', ctaEnabled: can && this.phase === 'playing', ctaAria: can ? `Cash out ${formatCredits(returnNow)} demo credits` : 'Cash out, available after the first gate' });
    }
    const showHint = this.phase === 'ready' || this.phase === 'armed' || this.flapsThisRound < HINT_FLAPS_BEFORE_FADE;
    this.hint?.setVisible(showHint && this.phase !== 'settled');
    const exitOpen = gates >= 1 && this.phase !== 'settled';
    this.exitBand?.setVisible(exitOpen);
    this.exitHint?.setText(exitOpen ? 'DIVE TO CASH OUT' : 'DIVE TO CASH OUT · AFTER FIRST GATE').setVisible(this.phase !== 'settled' && (exitOpen || showHint));
    shell.setStageActions([{
      id: 'flap', label: this.phase === 'paused' ? 'Resume' : this.phase === 'ready' ? 'Start and flap' : 'Flap',
      rect: STAGE, enabled: this.phase !== 'settled', onActivate: () => this.onPress(),
    }]);
  }

  // ─── Test/diagnostic hooks (read-only) ───────────────────────────────────

  /** @returns Snapshot for browser tests. */
  public debugSnapshot(): Record<string, unknown> {
    return {
      phase: this.phase, roundId: this.roundId, seed: this.seed, simVersion: FLAP_SIM_VERSION, rngAlgorithm: RNG_ALGORITHM_V2,
      tick: this.round?.tick ?? 0, settlement: this.round?.settlement ?? null,
      playerY: this.round?.state.playerY, velocity: this.round?.state.playerVelocityY, pipesCleared: this.round?.state.pipesCleared,
      pipes: this.round?.state.pipes.map((p) => ({ x: p.x, top: p.topHeight, bottom: p.bottomHeight })),
      balance: getPageLedger().balanceHundredths, runnerPaused: this.runner?.paused ?? null, actions: this.runner?.actionLog.length ?? 0,
      worldFit: { k: K, originX: ORIGIN_X, originY: ORIGIN_Y },
    };
  }
}

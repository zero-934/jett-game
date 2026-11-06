/**
 * @file ShatterStepUI.ts
 * @purpose Phaser rendering + input for Shatter Step (polish-003 pilot segment, revision 004
 *          "clean glass shaft"). Transparent bevelled panes baked to textures, a cached shaft
 *          backdrop with a few muted rails, a current-row accent outline plus chevron cue, and the
 *          accepted break choreography: contact → branching cracks → 16 pooled angular shards →
 *          empty broken frame by ~650 ms. Every outcome and every reveal comes from the round's
 *          precommitted board in ShatterStepLogic; this file draws no random outcomes.
 * @author Agent 934
 * @date 2026-04-12 (polish-003 rewrite: 2026-11-05)
 * @license Proprietary – available for licensing
 */
import * as Phaser from 'phaser';
import type { ShatterRound, ShatterStepConfig, TileSide, ShatterSettlement } from './ShatterStepLogic';
import { createShatterRound, pickShatterRound, canCashOutShatter, cashOutShatterRound, revealShatterBoard, computeShatterMultiplier, SHATTER_SIM_VERSION } from './ShatterStepLogic';
import { getPageLedger, nextRoundId, toHundredths, formatCredits } from '../shared/sim/DemoLedger';
import { createSeedString, RNG_ALGORITHM_V2 } from '../shared/rng/ProvablyFairRNG';
import { SoftDepthShell } from '../shared/ui/SoftDepthShell';
import type { ShellKey, StageAction } from '../shared/ui/SoftDepthShell';
import { hexToInt } from '../shared/ui/SoftDepthTheme';
import { AudioService } from '../shared/audio/AudioService';
import { makeDenseTexture, TEXTURE_DENSITY } from '../shared/render/RenderScale';

// ─── Board geometry (docs/polish-003/ART_AND_LAYOUT.md, reference coordinates) ─
const TOTAL_ROWS = 10;
const PANE_W = 148.2;
const PANE_H = 40;
const ROW_PITCH = 48;
const LEFT_X = 38.8;
const RIGHT_X = 203;
const ROW1_CENTER_Y = 628;
const HIT_H = 44;
const BEVEL = 4;
const LABEL_X = 374;
const PLATFORM_Y = 664;
const STAGE = { x: 16, y: 136, width: 358, height: 544 };

// ─── Art ──────────────────────────────────────────────────────────────────────
const SHAFT_TOP = 0x152238;
const SHAFT_BOTTOM = 0x0b1322;
const RAIL = 0x2a3b57;
const RAIL_HI = 0x3b5070;
const GLASS_TINT = 0x9cc8ea;
const GLASS_EDGE = 0xc8ecff;
const GLASS_BEVEL = 0x6fa7cc;
const RUNNER_SKIN = 0xf3ecd9;
const RUNNER_BODY = 0xe0763a;
const RUNNER_INK = 0x0b0f1a;
const PANE_KEY = 'shatter-pane';
const FRAME_KEYS = ['shatter-frame-0', 'shatter-frame-1'];
const SHARD_KEYS = ['shatter-shard-0', 'shatter-shard-1', 'shatter-shard-2', 'shatter-shard-3', 'shatter-shard-4'];
const RUNNER_KEY = 'shatter-runner';
const SHARD_COUNT = 16;
const T_CRACK_MS = 35;
const T_CRACK_FULL_MS = 85;
const T_RESULT_MS = 250;
const T_DONE_MS = 650;
const REDUCED_CROSSFADE_MS = 100;
const RUNNER_STEP_MS = 160;
const RUNNER_FOOT_OFFSET = 12;
/** Generated textures are TEXTURE_DENSITY× their logical size; images are drawn at 1/TD. */
const TD = TEXTURE_DENSITY;
const DEPTH = { shaft: 1, rails: 2, panes: 4, marks: 5, runner: 6, cracks: 7, shards: 8, flash: 9, labels: 9, hits: 39 } as const;

/** Centre Y of a row (0 = bottom row, first pick). */
function rowY(row: number): number { return ROW1_CENTER_Y - row * ROW_PITCH; }
/** Left edge X of a pane. */
function paneX(side: TileSide): number { return side === 'left' ? LEFT_X : RIGHT_X; }

type UIPhase = 'ready' | 'armed' | 'playing' | 'breaking' | 'settled';

/** Review/QA only: `?seed=abc` fixes round seeds for reproducible captures. */
let reviewSeedCounter = 0;
function reviewSeed(): string | null {
  if (typeof window === 'undefined') return null;
  const base = new URLSearchParams(window.location.search).get('seed');
  return base ? `${base}-${++reviewSeedCounter}` : null;
}

interface PaneView { image: Phaser.GameObjects.Image; frame: Phaser.GameObjects.Image; mark: Phaser.GameObjects.Graphics; }

/**
 * Manages Phaser game objects for Shatter Step.
 *
 * @example
 * const ui = new ShatterStepUI(scene, 390, 844);
 * ui.start(10);
 */
export class ShatterStepUI {
  private scene: Phaser.Scene;
  private worldWidth: number;
  private worldHeight: number;
  private config: ShatterStepConfig = {};
  private shell: SoftDepthShell | null = null;
  private round: ShatterRound | null = null;
  private roundId = '';
  private seed = '';
  private betHundredths = 1000;
  private phase: UIPhase = 'ready';
  private token = 0;

  private shaft: Phaser.GameObjects.Graphics | null = null;
  private activeRow: Phaser.GameObjects.Graphics | null = null;
  private cracks: Phaser.GameObjects.Graphics | null = null;
  private flash: Phaser.GameObjects.Arc | null = null;
  private runner: Phaser.GameObjects.Image | null = null;
  private title: Phaser.GameObjects.Text | null = null;
  private labels: Phaser.GameObjects.Text[] = [];
  private panes: Record<TileSide, PaneView>[] = [];
  private hits: Phaser.GameObjects.Rectangle[] = [];
  private shards: Phaser.GameObjects.Image[] = [];
  private shardTweens: Phaser.Tweens.Tween[] = [];

  /**
   * @param scene - Owning scene.
   * @param worldWidth - Logical width (390).
   * @param worldHeight - Logical height (844).
   */
  constructor(scene: Phaser.Scene, worldWidth: number, worldHeight: number) {
    this.scene = scene;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
  }

  /**
   * Starts a new Shatter Step session.
   * @param bet - Credit wager.
   * @returns void
   * @example
   * ui.start(10);
   */
  public start(bet: number): void {
    this.cleanup();
    this.betHundredths = toHundredths(bet);
    this.shell = new SoftDepthShell(this.scene, {
      title: 'Shatter Step',
      onBack: () => { window.location.href = 'https://zero-934.github.io/jett-landing/'; },
      onPrimary: () => this.onPrimary(),
      onKey: (k) => this.onKey(k),
      onSettingsChanged: () => { this.drawShaft(); this.refresh(); },
    });
    this.shell.setBalance(getPageLedger().balanceHundredths);
    this.makeTextures();
    this.buildBoard();
    this.newRound();
  }

  /** Destroys all managed objects and cancels pending callbacks. Idempotent. */
  public cleanup(): void {
    this.token++;
    for (const t of this.shardTweens) t.stop();
    this.shardTweens = [];
    for (const o of [this.shaft, this.activeRow, this.cracks, this.flash, this.runner, this.title]) o?.destroy();
    for (const l of this.labels) l.destroy();
    for (const row of this.panes) for (const v of Object.values(row)) { v.image.destroy(); v.frame.destroy(); v.mark.destroy(); }
    for (const h of this.hits) h.destroy();
    for (const s of this.shards) s.destroy();
    this.labels = []; this.panes = []; this.hits = []; this.shards = [];
    this.shaft = this.activeRow = this.cracks = null; this.flash = null; this.runner = null; this.title = null;
    this.shell?.destroy();
    this.shell = null;
    this.round = null;
  }

  // ─── Textures ─────────────────────────────────────────────────────────────

  private makeTextures(): void {
    const scene = this.scene;
    const w = Math.ceil(PANE_W); const h = PANE_H + BEVEL;
    makeDenseTexture(scene, PANE_KEY, w, h, (g) => {
      g.fillStyle(GLASS_BEVEL, 0.38).fillRoundedRect(1, PANE_H - 3, w - 2, BEVEL + 3, 3); // thin underside bevel (3–4 px below)
      g.fillStyle(GLASS_TINT, 0.13).fillRoundedRect(0, 0, w, PANE_H, 6);               // 10–25 % tint
      g.fillStyle(0xffffff, 0.12).fillRoundedRect(4, 3, w * 0.42, 7, 3);               // upper-left highlight
      g.fillStyle(0xffffff, 0.09).fillTriangle(w * 0.28, PANE_H - 2, w * 0.4, PANE_H - 2, w * 0.58, 2); // one diagonal reflection
      g.fillTriangle(w * 0.58, 2, w * 0.46, 2, w * 0.28, PANE_H - 2);
      g.lineStyle(1, GLASS_EDGE, 0.55).strokeRoundedRect(0.5, 0.5, w - 1, PANE_H - 1, 6); // thin pale-cyan edge
    });
    FRAME_KEYS.forEach((key, v) => makeDenseTexture(scene, key, w, h, (g) => {
      g.lineStyle(1, GLASS_EDGE, 0.35).strokeRoundedRect(0.5, 0.5, w - 1, PANE_H - 1, 6);
      g.fillStyle(GLASS_TINT, 0.22);
      // Jagged remnants clinging to the frame edges.
      const teeth = v === 0 ? [[6, 0, 18, 0, 10, 9], [40, 0, 60, 0, 52, 6], [w - 24, 0, w - 4, 0, w - 10, 11], [0, PANE_H, 16, PANE_H, 6, PANE_H - 10], [w - 40, PANE_H, w - 16, PANE_H, w - 30, PANE_H - 8], [0, 8, 0, 26, 9, 15]]
                            : [[12, 0, 30, 0, 18, 7], [70, 0, 92, 0, 80, 10], [w - 30, 0, w - 8, 0, w - 18, 6], [10, PANE_H, 30, PANE_H, 22, PANE_H - 9], [w - 22, PANE_H, w - 2, PANE_H, w - 8, PANE_H - 12], [w, 10, w, 30, w - 10, 22]];
      for (const t of teeth) g.fillTriangle(t[0], t[1], t[2], t[3], t[4], t[5]);
    }));
    SHARD_KEYS.forEach((key, v) => makeDenseTexture(scene, key, 22, 24, (g) => {
      const shapes = [[0, 12, 9, 0, 18, 15], [0, 0, 16, 5, 6, 18], [2, 16, 10, 0, 14, 14, 6, 20], [0, 6, 20, 0, 12, 12], [4, 0, 12, 4, 10, 22, 0, 16]];
      const pts = shapes[v];
      const vecs: Phaser.Math.Vector2[] = [];
      for (let i = 0; i < pts.length; i += 2) vecs.push(new Phaser.Math.Vector2(pts[i], pts[i + 1]));
      g.fillStyle(GLASS_TINT, 0.55).fillPoints(vecs, true);
      g.lineStyle(1, GLASS_EDGE, 0.8).strokePoints(vecs, true);
    }));
    // The existing simple runner, now softly shaded (head + body), same identity.
    makeDenseTexture(scene, RUNNER_KEY, 18, 31, (g) => {
      g.fillStyle(RUNNER_INK, 1).fillCircle(9, 7, 7).fillRoundedRect(2, 12, 14, 18, 4);
      g.fillStyle(RUNNER_SKIN, 1).fillCircle(9, 7, 5.5);
      g.fillStyle(RUNNER_BODY, 1).fillRoundedRect(3.5, 13.5, 11, 15, 3);
      g.fillStyle(0xffffff, 0.25).fillRoundedRect(5, 15, 3, 9, 1.5);
    });
  }

  // ─── Board construction (static; only changed panes update) ──────────────

  private drawShaft(): void {
    this.shaft?.destroy();
    const g = this.scene.add.graphics().setDepth(DEPTH.shaft);
    const S = STAGE;
    g.fillGradientStyle(SHAFT_TOP, SHAFT_TOP, SHAFT_BOTTOM, SHAFT_BOTTOM, 1).fillRect(S.x, S.y, S.width, S.height);
    // A few straight muted rails, kept clear of the panes and labels.
    for (const x of [24, 195, 356]) {
      g.fillStyle(RAIL, 1).fillRect(x - 2, S.y, 4, S.height);
      g.fillStyle(RAIL_HI, 1).fillRect(x - 2, S.y, 1, S.height);
    }
    for (let row = 0; row < TOTAL_ROWS; row += 3) {
      const y = rowY(row) + PANE_H / 2 + BEVEL + 1;
      g.fillStyle(RAIL, 1).fillRect(18, y, 14, 2).fillRect(348, y, 14, 2);
    }
    g.fillStyle(RAIL_HI, 1).fillRect(LEFT_X, PLATFORM_Y, RIGHT_X + PANE_W - LEFT_X, 4);  // starting platform
    g.fillStyle(RAIL, 1).fillRect(LEFT_X, PLATFORM_Y + 4, RIGHT_X + PANE_W - LEFT_X, 6);
    this.shaft = g;
  }

  private buildBoard(): void {
    this.drawShaft();
    const scene = this.scene;
    this.title = scene.add.text(this.worldWidth / 2, 154, 'CHOOSE ONE GLASS PANE', { fontFamily: '"Inter", system-ui, sans-serif', fontSize: '11px', color: '#c8d3e2', fontStyle: 'bold' })
      .setOrigin(0.5).setDepth(DEPTH.labels).setLetterSpacing(1.6);
    for (let row = 0; row < TOTAL_ROWS; row++) {
      const y = rowY(row);
      const views = {} as Record<TileSide, PaneView>;
      for (const side of ['left', 'right'] as const) {
        const x = paneX(side);
        const image = scene.add.image(x, y - PANE_H / 2, PANE_KEY).setOrigin(0).setScale(1 / TD).setDepth(DEPTH.panes);
        const frame = scene.add.image(x, y - PANE_H / 2, FRAME_KEYS[row % 2]).setOrigin(0).setScale(1 / TD).setDepth(DEPTH.panes).setVisible(false);
        const mark = scene.add.graphics().setDepth(DEPTH.marks);
        views[side] = { image, frame, mark };
        const hit = scene.add.rectangle(x + PANE_W / 2, y, PANE_W, HIT_H, 0, 0).setDepth(DEPTH.hits).setInteractive({ useHandCursor: true });
        hit.on('pointerdown', (p: Phaser.Input.Pointer, lx: number, ly: number, ev: Phaser.Types.Input.EventData) => {
          ev?.stopPropagation?.();
          AudioService.unlock();
          void p;
          this.choose(row, side, { x: x + lx, y: y - HIT_H / 2 + ly });
        });
        hit.disableInteractive();
        this.hits.push(hit);
      }
      this.panes.push(views);
      this.labels.push(scene.add.text(LABEL_X, y, String(row + 1).padStart(2, '0'), { fontFamily: '"Inter", system-ui, sans-serif', fontSize: '11px', color: '#a6b3c4', fontStyle: 'bold' })
        .setOrigin(1, 0.5).setDepth(DEPTH.labels));
    }
    this.activeRow = scene.add.graphics().setDepth(DEPTH.marks);
    this.cracks = scene.add.graphics().setDepth(DEPTH.cracks);
    this.flash = scene.add.arc(0, 0, 10, 0, 360, false, 0xffffff, 0.9).setDepth(DEPTH.flash).setVisible(false);
    this.runner = scene.add.image(this.worldWidth / 2, PLATFORM_Y, RUNNER_KEY).setOrigin(0.5, 1).setScale(1 / TD).setDepth(DEPTH.runner);
    for (let i = 0; i < SHARD_COUNT; i++) this.shards.push(scene.add.image(0, 0, SHARD_KEYS[i % SHARD_KEYS.length]).setDepth(DEPTH.shards).setVisible(false));
  }

  // ─── Round lifecycle ──────────────────────────────────────────────────────

  private newRound(): void {
    this.token++;
    for (const t of this.shardTweens) t.stop();
    this.shardTweens = [];
    this.seed = reviewSeed() ?? createSeedString();
    this.roundId = nextRoundId('shatter');
    this.round = createShatterRound(this.seed, this.betHundredths / 100, this.config);
    this.phase = 'ready';
    for (const row of this.panes) for (const v of Object.values(row)) { v.image.setVisible(true).setAlpha(1); v.frame.setVisible(false); v.mark.clear(); }
    for (const s of this.shards) s.setVisible(false);
    this.cracks?.clear();
    this.flash?.setVisible(false);
    this.runner?.setPosition(this.worldWidth / 2, PLATFORM_Y).setAlpha(1).setScale(1 / TD).setAngle(0).setVisible(true);
    this.shell?.hideResult();
    this.refresh();
  }

  private debit(): boolean {
    if (this.phase !== 'ready') return this.phase === 'armed';
    if (!getPageLedger().start(this.roundId, this.betHundredths)) return false;
    this.shell?.setBalance(getPageLedger().balanceHundredths);
    this.phase = 'armed';
    this.shell?.announce(`Round started. Stake ${formatCredits(this.betHundredths)} demo credits. Choose a pane on row 1.`);
    return true;
  }

  private onPrimary(): void {
    if (this.phase === 'ready') { this.debit(); this.refresh(); return; }
    if (this.phase === 'playing' && this.round && canCashOutShatter(this.round)) {
      const s = cashOutShatterRound(this.round);
      if (s) this.onSettled(s);
      return;
    }
    if (this.phase === 'settled') this.newRound();
  }

  private onKey(k: ShellKey): void {
    if (k.type !== 'down' || k.repeat) return;
    if (k.code === 'ArrowLeft' || k.code === 'ArrowRight') {
      const round = this.round; if (!round) return;
      const side: TileSide = k.code === 'ArrowLeft' ? 'left' : 'right';
      this.choose(round.state.currentRow, side, { x: paneX(side) + PANE_W / 2, y: rowY(round.state.currentRow) });
    }
  }

  /** Accepts one pick on the current row; locks the row immediately. */
  private choose(row: number, side: TileSide, contact: { x: number; y: number }): void {
    const round = this.round; if (!round) return;
    if (this.phase === 'ready' && !this.debit()) return;
    if (this.phase === 'armed') this.phase = 'playing';
    if (this.phase !== 'playing' || row !== round.state.currentRow) return;
    const pick = pickShatterRound(round, side);
    if (!pick) return;
    this.lockHits();
    if (pick.safe) {
      this.markSafe(row, side);
      this.moveRunner(row, side);
      AudioService.cue('tap');
      if (round.settlement) this.onSettled(round.settlement); // top row reached
      else this.refresh();
      this.shell?.announce(`Row ${row + 1} safe. Multiplier ${round.state.multiplier.toFixed(2)}.`);
    } else {
      this.phase = 'breaking';
      this.breakPane(row, side, contact);
      this.refresh();
    }
  }

  private onSettled(s: ShatterSettlement, keepBreaking = false): void {
    this.phase = keepBreaking ? 'breaking' : 'settled';
    this.lockHits();
    const record = getPageLedger().settle(this.roundId, s.returnHundredths, s.reason);
    this.shell?.setBalance(getPageLedger().balanceHundredths);
    const ret = record?.returnHundredths ?? s.returnHundredths;
    AudioService.settle(ret, this.betHundredths);
    const title = s.reason === 'shatter' ? 'Glass broke' : s.reason === 'top' ? 'Reached the top' : 'Cashed out';
    this.shell?.showResult({ title, returnHundredths: ret, stakeHundredths: this.betHundredths, tone: ret > this.betHundredths ? 'success' : ret === 0 ? 'loss' : 'neutral' });
    this.revealTruthfully();
    this.refresh();
  }

  // ─── Visuals ──────────────────────────────────────────────────────────────

  private markSafe(row: number, side: TileSide): void {
    const v = this.panes[row][side];
    const t = this.shell?.tokens;
    const cx = paneX(side) + PANE_W / 2; const cy = rowY(row);
    v.mark.clear().lineStyle(2.5, hexToInt(t?.success ?? '#75d6b1'), 1);
    v.mark.beginPath(); v.mark.moveTo(cx - 7, cy); v.mark.lineTo(cx - 2, cy + 5); v.mark.lineTo(cx + 8, cy - 6); v.mark.strokePath();
  }

  /** After settlement only: shows each row's committed safe side with a muted outline tick. */
  private revealTruthfully(): void {
    const round = this.round; if (!round) return;
    const board = revealShatterBoard(round); if (!board) return;
    const muted = hexToInt(this.shell?.tokens.muted ?? '#a6b3c4');
    const pickedRows = new Set(round.picks.map((p) => p.row));
    board.forEach((safeSide, row) => {
      if (pickedRows.has(row)) return; // played rows already show the actual result
      const v = this.panes[row][safeSide];
      const cx = paneX(safeSide) + PANE_W / 2; const cy = rowY(row);
      v.mark.clear().lineStyle(1.5, muted, 0.8);
      v.mark.beginPath(); v.mark.moveTo(cx - 6, cy); v.mark.lineTo(cx - 2, cy + 4); v.mark.lineTo(cx + 7, cy - 5); v.mark.strokePath();
    });
    // On a loss, the safe counterpart of the broken row is marked from the board too.
    const s = round.settlement;
    if (s?.reason === 'shatter' && s.brokenRow !== undefined) {
      const safeSide = board[s.brokenRow];
      const cx = paneX(safeSide) + PANE_W / 2; const cy = rowY(s.brokenRow);
      this.panes[s.brokenRow][safeSide].mark.clear().lineStyle(1.5, muted, 0.9).beginPath();
      const m = this.panes[s.brokenRow][safeSide].mark;
      m.moveTo(cx - 6, cy); m.lineTo(cx - 2, cy + 4); m.lineTo(cx + 7, cy - 5); m.strokePath();
    }
  }

  private moveRunner(row: number, side: TileSide): void {
    if (!this.runner) return;
    const x = paneX(side) + PANE_W / 2; const y = rowY(row) + RUNNER_FOOT_OFFSET; // stands on the confirmed pane
    if (this.shell?.settings.reducedMotion) { this.runner.setPosition(x, y); return; }
    this.scene.tweens.add({ targets: this.runner, x, y, duration: RUNNER_STEP_MS, ease: 'Quad.easeOut' });
  }

  private breakPane(row: number, side: TileSide, contact: { x: number; y: number }): void {
    const token = this.token;
    const v = this.panes[row][side];
    const reduced = this.shell?.settings.reducedMotion ?? false;
    const later = (ms: number, fn: () => void) => this.scene.time.delayedCall(ms, () => { if (token === this.token) fn(); });
    AudioService.cue('glassCrack');
    this.shell?.haptic(30);
    const settlement = this.round?.settlement;
    if (reduced) {
      this.drawCracks(contact, row, side, 1);
      this.scene.tweens.add({ targets: v.image, alpha: 0, duration: REDUCED_CROSSFADE_MS });
      v.frame.setVisible(true).setAlpha(1);
      later(REDUCED_CROSSFADE_MS, () => { this.cracks?.clear(); v.image.setVisible(false); this.runner?.setVisible(false); if (settlement) this.onSettled(settlement); });
      return;
    }
    // 0–35 ms: local contact flash, runner compresses.
    this.flash?.setPosition(contact.x, contact.y).setScale(0.6).setAlpha(0.9).setVisible(true);
    this.scene.tweens.add({ targets: this.flash, scale: 1.4, alpha: 0, duration: T_CRACK_MS * 2 });
    if (this.runner) this.scene.tweens.add({ targets: this.runner, scaleY: 0.86 / TD, duration: T_CRACK_MS, yoyo: true });
    // 35–85 ms: branching cracks radiate from the contact point.
    later(T_CRACK_MS, () => this.drawCracks(contact, row, side, 0.55));
    later(T_CRACK_FULL_MS - 20, () => this.drawCracks(contact, row, side, 1));
    // 85–650 ms: pane surface disappears; pooled shards spread, fall, rotate, fade.
    later(T_CRACK_FULL_MS, () => {
      v.image.setVisible(false);
      v.frame.setVisible(true).setAlpha(1);
      this.cracks?.clear();
      const x0 = paneX(side); const y0 = rowY(row) - PANE_H / 2;
      this.shards.forEach((s, i) => {
        const fx = x0 + 10 + ((i * 37) % (PANE_W - 20));                  // spread across the pane (deterministic)
        const fy = y0 + 6 + ((i * 13) % (PANE_H - 12));
        const dir = fx < contact.x ? -1 : 1;
        s.setPosition(fx, fy).setAlpha(0.95).setAngle((i * 47) % 360).setScale((0.7 + (i % 3) * 0.15) / TD).setVisible(true);
        this.shardTweens.push(this.scene.tweens.add({
          targets: s, x: fx + dir * (10 + ((i * 11) % 26)), y: fy + 25 + ((i * 17) % 66), angle: s.angle + dir * (90 + (i % 4) * 40), alpha: 0,
          duration: T_DONE_MS - T_CRACK_FULL_MS, ease: 'Quad.easeIn', onComplete: () => s.setVisible(false),
        }));
      });
      if (this.runner) this.scene.tweens.add({ targets: this.runner, y: this.runner.y + 46, alpha: 0, duration: 380, ease: 'Quad.easeIn' });
    });
    later(T_RESULT_MS, () => { if (settlement) this.onSettled(settlement, true); });
    later(T_DONE_MS, () => { for (const s of this.shards) s.setVisible(false); this.phase = 'settled'; this.refresh(); });
  }

  /** Draws 6 branching cracks from the contact point, clipped to the pane rectangle. */
  private drawCracks(contact: { x: number; y: number }, row: number, side: TileSide, extent: number): void {
    const g = this.cracks; if (!g) return;
    const x0 = paneX(side); const y0 = rowY(row) - PANE_H / 2;
    const clampX = (x: number) => Phaser.Math.Clamp(x, x0 + 1, x0 + PANE_W - 1);
    const clampY = (y: number) => Phaser.Math.Clamp(y, y0 + 1, y0 + PANE_H - 1);
    g.clear().lineStyle(1.2, 0xffffff, 0.9);
    const angles = [-2.6, -1.7, -0.6, 0.4, 1.5, 2.5];
    angles.forEach((a, i) => {
      const len = (40 + (i % 3) * 22) * extent;
      const mx = contact.x + Math.cos(a) * len * 0.5; const my = contact.y + Math.sin(a) * len * 0.35;
      const ex = contact.x + Math.cos(a + 0.18) * len; const ey = contact.y + Math.sin(a + 0.18) * len * 0.55;
      g.beginPath(); g.moveTo(clampX(contact.x), clampY(contact.y)); g.lineTo(clampX(mx), clampY(my)); g.lineTo(clampX(ex), clampY(ey)); g.strokePath();
      if (extent >= 1 && i % 2 === 0) { g.beginPath(); g.moveTo(clampX(mx), clampY(my)); g.lineTo(clampX(mx + Math.cos(a - 0.9) * 14), clampY(my + Math.sin(a - 0.9) * 8)); g.strokePath(); }
    });
  }

  private lockHits(): void { for (const h of this.hits) h.disableInteractive(); }

  // ─── HUD / footer / current row ───────────────────────────────────────────

  private refresh(): void {
    const shell = this.shell; const round = this.round; if (!shell || !round) return;
    const st = round.state; const row = st.currentRow;
    const live = this.phase === 'ready' || this.phase === 'armed' || this.phase === 'playing';
    // Only the current row is interactive and highlighted.
    this.lockHits();
    this.activeRow?.clear();
    if (live && row < TOTAL_ROWS) {
      this.hits[row * 2].setInteractive({ useHandCursor: true });
      this.hits[row * 2 + 1].setInteractive({ useHandCursor: true });
      const accent = hexToInt(shell.tokens.accent);
      const y = rowY(row);
      this.activeRow?.lineStyle(1.5, accent, 1);
      for (const side of ['left', 'right'] as const) this.activeRow?.strokeRoundedRect(paneX(side) - 1, y - PANE_H / 2 - 1, PANE_W + 2, PANE_H + 2, 7);
      // Non-colour cue: chevrons pointing at the selectable row.
      this.activeRow?.fillStyle(accent, 1).fillTriangle(31, y - 4, 31, y + 4, 35.5, y).fillTriangle(358, y - 4, 358, y + 4, 353.5, y);
    }
    this.labels.forEach((l, i) => l.setColor(live && i === row ? shell.tokens.accent : shell.tokens.muted));
    const rowsText = `${row} of ${TOTAL_ROWS} rows cleared`;
    if (this.phase === 'settled' || this.phase === 'breaking') {
      const s = round.settlement; const ret = s?.returnHundredths ?? 0;
      shell.setHud({ phaseLabel: ret > 0 ? 'Round complete' : 'Round ended', multiplier: `${(s?.multiplier ?? st.multiplier).toFixed(2)}×`, progress: rowsText, tone: ret > this.betHundredths ? 'success' : ret === 0 ? 'loss' : 'muted' });
      const ready = this.phase === 'settled';
      shell.setFooter({ stakeHundredths: this.betHundredths, rightLabel: 'Demo mode', rightValue: ret > 0 ? 'Settled once' : 'No return', ctaLabel: `PLAY AGAIN · ${formatCredits(this.betHundredths)}`, ctaEnabled: ready });
    } else if (this.phase === 'ready') {
      shell.setHud({ phaseLabel: 'Ready', multiplier: '1.00×', progress: 'Pick a pane on row 1 to start', tone: 'muted' });
      shell.setFooter({ stakeHundredths: this.betHundredths, rightLabel: 'Next safe row pays', rightValue: `${computeShatterMultiplier(1).toFixed(2)}×`, ctaLabel: `START · ${formatCredits(this.betHundredths)}`, ctaEnabled: true, ctaAria: `Start round, stake ${formatCredits(this.betHundredths)} demo credits` });
    } else {
      const can = canCashOutShatter(round);
      const ret = toHundredths(parseFloat((st.bet * st.multiplier).toFixed(2)));
      shell.setHud({ phaseLabel: 'Current multiplier', multiplier: `${st.multiplier.toFixed(2)}×`, progress: rowsText, tone: row > 0 ? 'accent' : 'muted' });
      shell.setFooter({ stakeHundredths: this.betHundredths, rightLabel: 'Return if cashed out', rightValue: can ? `${formatCredits(ret)} credits` : 'after first row', ctaLabel: 'CASH OUT', ctaEnabled: can, ctaAria: can ? `Cash out ${formatCredits(ret)} demo credits` : 'Cash out, available after the first row' });
    }
    const actions: StageAction[] = live && row < TOTAL_ROWS
      ? (['left', 'right'] as const).map((side) => ({
        id: `pane-${side}`, label: `Row ${row + 1}, ${side} pane`, enabled: true, rail: true,
        rect: { x: paneX(side), y: rowY(row) - HIT_H / 2, width: PANE_W, height: HIT_H },
        onActivate: () => this.choose(row, side, { x: paneX(side) + PANE_W / 2, y: rowY(row) }),
      }))
      : [];
    shell.setStageActions(actions);
  }

  // ─── Test/diagnostic hooks (read-only; the board is exposed only after settlement) ──

  /** @returns Snapshot for browser tests. */
  public debugSnapshot(): Record<string, unknown> {
    const r = this.round;
    return {
      phase: this.phase, roundId: this.roundId, seed: this.seed, simVersion: SHATTER_SIM_VERSION, rngAlgorithm: RNG_ALGORITHM_V2,
      row: r?.state.currentRow, multiplier: r?.state.multiplier, picks: r?.picks ?? [], settlement: r?.settlement ?? null,
      revealed: r ? revealShatterBoard(r) : null, balance: getPageLedger().balanceHundredths, logical: [this.worldWidth, this.worldHeight],
      interactiveHits: this.hits.filter((h) => h.input?.enabled).length,
      visibleShards: this.shards.filter((s) => s.visible).length,
      paneVisible: this.panes.map((row) => ({ left: row.left.image.visible, right: row.right.image.visible })),
      frameVisible: this.panes.map((row) => ({ left: row.left.frame.visible, right: row.right.frame.visible })),
    };
  }
}

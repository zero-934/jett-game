/**
 * @file RenderScale.ts
 * @purpose High-density rendering for a scene without changing its logical 390×844 coordinates.
 *          Phaser 4.0.0 has no game-level `resolution` (verified in node_modules/phaser
 *          src/scale/ScaleManager.js: canvas.width = baseSize.width), so the controller enlarges
 *          the game size through the Scale Manager (Phaser keeps ownership of the canvas), zooms
 *          the main camera by the same factor from the top-left, and re-rasterises Text at the
 *          matching resolution. FIT keeps the CSS size unchanged because the aspect is unchanged.
 *          On scene shutdown the game size returns to 390×844 so other scenes are unaffected.
 * @author Agent 934
 * @date 2026-11-06
 * @license Proprietary – available for licensing
 */
import * as Phaser from 'phaser';
import { decideRenderScale, parseRenderQuality, nextQualityTier, LOGICAL_W, LOGICAL_H, GOVERNOR_WINDOW_FRAMES } from './RenderScalePolicy';
import type { RenderQuality, RenderScaleDecision } from './RenderScalePolicy';

/** Diagnostic snapshot (window.__renderScale()). */
export interface RenderScaleInfo extends RenderScaleDecision {
  adaptive: boolean;
  downgrades: Array<{ from: RenderQuality; to: RenderQuality; medianMs: number }>;
  dpr: number;
  quality: RenderQuality;
  cssWidth: number;
  cssHeight: number;
  zoomX: number;
  zoomY: number;
  scene: string;
}

let active: RenderScaleController | null = null;

/**
 * Per-scene controller. Create at the very start of Scene.create().
 * @example
 * create() { RenderScaleController.attach(this); ... }
 */
export class RenderScaleController {
  readonly scene: Phaser.Scene;
  quality: RenderQuality;
  /** Tier changes made by the adaptive governor (diagnostics). */
  readonly downgrades: Array<{ from: RenderQuality; to: RenderQuality; medianMs: number }> = [];
  private readonly adaptive: boolean;
  private frameSamples: number[] = [];
  private windowMedians: number[] = [];
  private readonly onPostRender = (): void => this.sampleFrame();
  /** QA only (`?rs=1`): forced cap for before/after and performance comparisons. */
  private readonly capOverride: number | undefined;
  private decision: RenderScaleDecision;
  private applying = false;
  private detached = false;
  private mql: MediaQueryList | null = null;
  private readonly onResize = (): void => this.refresh();
  private readonly onDprChange = (): void => { this.watchDpr(); this.refresh(); };
  private readonly onAdded = (obj: Phaser.GameObjects.GameObject): void => { if (obj instanceof Phaser.GameObjects.Text) this.syncText(obj); };

  private constructor(scene: Phaser.Scene, quality: RenderQuality) {
    this.scene = scene;
    this.quality = quality;
    const rs = typeof window !== 'undefined' ? Number(new URLSearchParams(window.location.search).get('rs')) : NaN;
    this.capOverride = Number.isFinite(rs) && rs >= 1 ? rs : undefined;
    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    // The governor runs only for the default tier; an explicit ?quality= / ?rs= or ?adaptive=0 fixes it.
    this.adaptive = !!params && params.get('adaptive') !== '0' && !params.get('quality') && this.capOverride === undefined;
    this.decision = decideRenderScale(LOGICAL_W, 1, quality);
  }

  /**
   * Attaches high-density rendering to a scene (idempotent per scene start).
   * @param scene - Scene in its create().
   * @param quality - Optional tier; defaults to `?quality=` or `high`.
   * @returns Controller.
   * @example
   * RenderScaleController.attach(this);
   */
  static attach(scene: Phaser.Scene, quality?: RenderQuality): RenderScaleController {
    active?.detach();
    const q = quality ?? parseRenderQuality(typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('quality') : null);
    const c = new RenderScaleController(scene, q);
    active = c;
    c.apply(true);
    scene.scale.on(Phaser.Scale.Events.RESIZE, c.onResize);
    scene.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, c.onAdded);
    c.watchDpr();
    if (c.adaptive) scene.game.events.on(Phaser.Core.Events.POST_RENDER, c.onPostRender);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => c.detach());
    scene.events.once(Phaser.Scenes.Events.DESTROY, () => c.detach());
    if (typeof window !== 'undefined') (window as unknown as Record<string, unknown>).__renderScale = () => active?.info() ?? null;
    return c;
  }

  /** @returns Current backing px per logical px (≥ 1). */
  get scale(): number { return this.decision.scale; }

  /** @returns Diagnostic snapshot. */
  info(): RenderScaleInfo {
    const cam = this.scene.cameras?.main;
    const css = this.cssSize();
    return { ...this.decision, adaptive: this.adaptive, downgrades: [...this.downgrades], dpr: this.dpr(), quality: this.quality, cssWidth: +css.w.toFixed(2), cssHeight: +css.h.toFixed(2), zoomX: cam?.zoomX ?? 1, zoomY: cam?.zoomY ?? 1, scene: this.scene.sys.settings.key };
  }

  /** Re-evaluates after a resize/DPR change. */
  refresh(): void {
    if (this.applying || this.detached) return;
    this.apply(false);
  }

  /** Restores the 390×844 game size and removes listeners. Idempotent. */
  detach(): void {
    if (this.detached) return;
    this.detached = true;
    this.scene.scale.off(Phaser.Scale.Events.RESIZE, this.onResize);
    this.scene.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, this.onAdded);
    this.mql?.removeEventListener?.('change', this.onDprChange);
    this.mql = null;
    this.scene.game.events.off(Phaser.Core.Events.POST_RENDER, this.onPostRender);
    if (this.scene.scale.width !== LOGICAL_W || this.scene.scale.height !== LOGICAL_H) {
      this.applying = true;
      try { this.scene.scale.setGameSize(LOGICAL_W, LOGICAL_H); } finally { this.applying = false; }
    }
    if (active === this) active = null;
  }

  /** Collects real frame intervals; steps quality down once frames are sustainably slow. */
  private sampleFrame(): void {
    if (this.detached || this.quality === 'low' || !this.scene.game.loop.running) return; // manual stepping (QA) is not measured
    const d = this.scene.game.loop.rawDelta;
    if (!(d > 0) || d > 1000) return; // ignore hitches/background tabs
    this.frameSamples.push(d);
    if (this.frameSamples.length < GOVERNOR_WINDOW_FRAMES) return;
    const sorted = [...this.frameSamples].sort((a, b) => a - b);
    this.windowMedians.push(sorted[Math.floor(sorted.length / 2)]);
    this.frameSamples = [];
    const next = nextQualityTier(this.quality, this.windowMedians);
    if (next !== this.quality) {
      this.downgrades.push({ from: this.quality, to: next, medianMs: +this.windowMedians[this.windowMedians.length - 1].toFixed(1) });
      this.quality = next;
      this.windowMedians = [];
      this.apply(false);
    }
  }

  private dpr(): number { return typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1; }

  private cssSize(): { w: number; h: number } {
    const d = this.scene.scale.displaySize;
    if (d && d.width > 0) return { w: d.width, h: d.height };
    const r = this.scene.game.canvas.getBoundingClientRect();
    return { w: r.width || LOGICAL_W, h: r.height || LOGICAL_H };
  }

  private watchDpr(): void {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    this.mql?.removeEventListener?.('change', this.onDprChange);
    this.mql = window.matchMedia(`(resolution: ${this.dpr()}dppx)`);
    this.mql.addEventListener?.('change', this.onDprChange);
  }

  private apply(force: boolean): void {
    const next = decideRenderScale(this.cssSize().w, this.dpr(), this.quality, this.capOverride);
    const sm = this.scene.scale;
    const changed = force || next.width !== sm.width || next.height !== sm.height;
    this.decision = next;
    if (changed && (sm.width !== next.width || sm.height !== next.height)) {
      this.applying = true;
      try { sm.setGameSize(next.width, next.height); } finally { this.applying = false; }
    }
    const cam = this.scene.cameras.main;
    cam.setSize(sm.width, sm.height);
    cam.setOrigin(0, 0);
    cam.setZoom(sm.width / LOGICAL_W, sm.height / LOGICAL_H);
    cam.setScroll(0, 0);
    if (changed) for (const o of this.scene.children.list) if (o instanceof Phaser.GameObjects.Text) this.syncText(o);
  }

  private syncText(t: Phaser.GameObjects.Text): void {
    const r = Math.max(1, Math.min(3, this.decision.scale));
    if (t.style.resolution !== r) t.setResolution(r);
  }
}

/**
 * Converts a pointer to logical (390×844) coordinates through the scene's main camera, valid at
 * any render scale. Use instead of `pointer.x/y`, which are backing-store pixels.
 * @param scene - Scene.
 * @param p - Pointer.
 * @returns Logical point.
 * @example
 * const { x } = pointerToLogical(this.scene, pointer);
 */
export function pointerToLogical(scene: Phaser.Scene, p: { x: number; y: number }): { x: number; y: number } {
  const w = scene.cameras.main.getWorldPoint(p.x, p.y);
  return { x: w.x, y: w.y };
}

/**
 * Texture density for generated (Graphics → texture) art: textures are drawn at this multiple
 * of their logical size and displayed scaled down, so they stay sharp at render scale 3.
 */
export const TEXTURE_DENSITY = 3;

/**
 * Draws logical-size Graphics art into a texture at TEXTURE_DENSITY× and returns the factor to
 * display it at its logical size (`image.setScale(1 / density)` or setDisplaySize).
 * @param scene - Scene.
 * @param key - Texture key (skipped if it already exists).
 * @param width - Logical width.
 * @param height - Logical height.
 * @param draw - Draws in logical units.
 * @returns The density used.
 * @example
 * makeDenseTexture(scene, 'coin', 32, 32, (g) => g.fillCircle(16, 16, 15));
 */
export function makeDenseTexture(scene: Phaser.Scene, key: string, width: number, height: number, draw: (g: Phaser.GameObjects.Graphics) => void): number {
  if (scene.textures.exists(key)) return TEXTURE_DENSITY;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g);
  g.setScale(TEXTURE_DENSITY);
  g.generateTexture(key, Math.ceil(width * TEXTURE_DENSITY), Math.ceil(height * TEXTURE_DENSITY));
  g.destroy();
  return TEXTURE_DENSITY;
}

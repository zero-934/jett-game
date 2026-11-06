/**
 * @file RenderScalePolicy.ts
 * @purpose Pure (no Phaser) render-density policy for the polish-004 pilots. The game keeps its
 *          390×844 logical coordinates; only the canvas backing store grows so that roughly one
 *          backing pixel lands on each physical display pixel, up to a cap and a pixel budget.
 * @author Agent 934
 * @date 2026-11-06
 * @license Proprietary – available for licensing
 */

/** Logical (world/layout) size shared by every scene. Never changes. */
export const LOGICAL_W = 390;
export const LOGICAL_H = 844;

/** Quality tiers. `high` is the default; `low` is the documented weak-device fallback. */
export type RenderQuality = 'high' | 'balanced' | 'low';

/** Max backing px per logical px per tier. */
export const RENDER_SCALE_CAP: Record<RenderQuality, number> = { high: 3, balanced: 2, low: 1.5 };
/** Max backing pixels per frame (≈ a 1170×2532 phone panel, i.e. DPR3 at 390 CSS px). */
export const RENDER_PIXEL_BUDGET = 1170 * 2532;
/** Scale steps (avoids re-allocating the framebuffer for sub-percent CSS changes). */
export const RENDER_SCALE_STEP = 0.125;

/** Policy decision. */
export interface RenderScaleDecision {
  /** Backing px per logical px actually used. */
  scale: number;
  /** Ideal value: CSS width × DPR ÷ 390. */
  target: number;
  /** Backing store size. */
  width: number;
  height: number;
  /** Why `scale` differs from `target` (if it does). */
  limitedBy: 'none' | 'cap' | 'budget' | 'floor';
  /** Backing px per physical display px (1 = ideal; <1 means the compositor upsamples). */
  backingPerPhysicalPx: number;
}

/**
 * Chooses the render scale for a canvas displayed at `cssWidth` CSS px on a `dpr` display.
 * @param cssWidth - CSS width of the canvas (FIT keeps the 390:844 aspect).
 * @param dpr - window.devicePixelRatio.
 * @param quality - Tier.
 * @param capOverride - QA only: force a lower/higher cap (e.g. `?rs=1` for before/after comparisons).
 * @returns Decision.
 * @example
 * decideRenderScale(390, 3).scale; // 3
 * decideRenderScale(262.45, 2).scale; // 1.375
 */
export function decideRenderScale(cssWidth: number, dpr: number, quality: RenderQuality = 'high', capOverride?: number): RenderScaleDecision {
  const safeDpr = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
  const safeCss = Number.isFinite(cssWidth) && cssWidth > 0 ? cssWidth : LOGICAL_W;
  const target = (safeCss * safeDpr) / LOGICAL_W;
  const cap = capOverride !== undefined && capOverride >= 1 && capOverride <= 4 ? capOverride : (RENDER_SCALE_CAP[quality] ?? RENDER_SCALE_CAP.high);
  const budgetScale = Math.sqrt(RENDER_PIXEL_BUDGET / (LOGICAL_W * LOGICAL_H));
  // Round up to the next step so the compositor downsamples slightly rather than upsampling.
  let scale = Math.ceil(target / RENDER_SCALE_STEP - 1e-9) * RENDER_SCALE_STEP;
  let limitedBy: RenderScaleDecision['limitedBy'] = 'none';
  if (scale > cap) { scale = cap; limitedBy = 'cap'; }
  if (scale > budgetScale) { scale = Math.floor(budgetScale / RENDER_SCALE_STEP) * RENDER_SCALE_STEP; limitedBy = 'budget'; }
  if (scale < 1) { scale = 1; limitedBy = target < 1 ? 'none' : 'floor'; }
  const width = Math.round(LOGICAL_W * scale);
  const height = Math.round(LOGICAL_H * scale);
  return { scale, target: +target.toFixed(4), width, height, limitedBy, backingPerPhysicalPx: +(width / (safeCss * safeDpr)).toFixed(3) };
}

/**
 * Maps a backing-store (game) pixel to logical coordinates.
 * @param gx - Game/backing X.
 * @param gy - Game/backing Y.
 * @param width - Backing width.
 * @param height - Backing height.
 * @returns Logical point.
 * @example
 * backingToLogical(585, 1266, 1170, 2532); // { x: 195, y: 422 }
 */
export function backingToLogical(gx: number, gy: number, width: number, height: number): { x: number; y: number } {
  return { x: (gx * LOGICAL_W) / width, y: (gy * LOGICAL_H) / height };
}

/**
 * Parses a quality override (`?quality=low`) — unknown values fall back to `high`.
 * @param value - Raw string.
 * @returns Tier.
 * @example
 * parseRenderQuality('low'); // 'low'
 */
export function parseRenderQuality(value: string | null | undefined): RenderQuality {
  return value === 'low' || value === 'balanced' || value === 'high' ? value : 'high';
}

/** Adaptive governor: frames per evaluation window, slow threshold and windows needed. */
export const GOVERNOR_WINDOW_FRAMES = 90;
export const GOVERNOR_SLOW_MEDIAN_MS = 25;
export const GOVERNOR_SLOW_WINDOWS = 2;

/**
 * One-way quality governor: after GOVERNOR_SLOW_WINDOWS consecutive windows whose median frame
 * interval exceeds GOVERNOR_SLOW_MEDIAN_MS, step down one tier. Never steps up (no oscillation).
 * @param tier - Current tier.
 * @param windowMedians - Median frame interval of each completed window, oldest first.
 * @returns Next tier (same tier if no change).
 * @example
 * nextQualityTier('high', [30, 31]); // 'balanced'
 */
export function nextQualityTier(tier: RenderQuality, windowMedians: readonly number[]): RenderQuality {
  const recent = windowMedians.slice(-GOVERNOR_SLOW_WINDOWS);
  if (recent.length < GOVERNOR_SLOW_WINDOWS || !recent.every((m) => m > GOVERNOR_SLOW_MEDIAN_MS)) return tier;
  return tier === 'high' ? 'balanced' : 'low';
}

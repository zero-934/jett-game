/**
 * @file RenderScalePolicy.test.ts
 * @purpose polish-004: render-density policy and backing→logical pointer mapping.
 * @author Agent 934
 * @date 2026-11-06
 * @license Proprietary – available for licensing
 */
import { decideRenderScale, backingToLogical, parseRenderQuality, LOGICAL_W, LOGICAL_H, RENDER_PIXEL_BUDGET } from '../shared/render/RenderScalePolicy';

describe('decideRenderScale', () => {
  it('matches one backing px per physical px on a 390-wide DPR 3 phone', () => {
    const d = decideRenderScale(390, 3);
    expect(d.scale).toBe(3);
    expect([d.width, d.height]).toEqual([1170, 2532]);
    expect(d.backingPerPhysicalPx).toBe(1);
  });
  it('caps at 3 on wider DPR 3 phones and reports the limit', () => {
    const d = decideRenderScale(430, 3);
    expect(d.scale).toBe(3);
    expect(d.limitedBy).toBe('cap');
    expect(d.width * d.height).toBeLessThanOrEqual(RENDER_PIXEL_BUDGET);
  });
  it('rounds UP to the next 1/8 step so the compositor never upsamples within the cap', () => {
    const d = decideRenderScale(262.45, 2); // 320×568 viewport, FIT width
    expect(d.scale).toBe(1.375);
    expect(d.backingPerPhysicalPx).toBeGreaterThanOrEqual(1);
  });
  it('never goes below 1 (tiny landscape canvases)', () => {
    expect(decideRenderScale(173.28, 1).scale).toBe(1);
  });
  it('quality tiers lower the cap (documented weak-device fallback)', () => {
    expect(decideRenderScale(390, 3, 'balanced').scale).toBe(2);
    expect(decideRenderScale(390, 3, 'low').scale).toBe(1.5);
  });
  it('tolerates junk inputs', () => {
    expect(decideRenderScale(NaN, 0).scale).toBe(1);
    expect(decideRenderScale(-5, Infinity).scale).toBe(1);
  });
  it('QA override can force scale 1 for before/after comparisons', () => {
    expect(decideRenderScale(390, 3, 'high', 1).scale).toBe(1);
  });
});

describe('backingToLogical (pointer mapping at any render scale)', () => {
  it.each([[1, 390, 844], [1.375, 536, 1161], [2, 780, 1688], [3, 1170, 2532]])('scale %p maps corners and centre exactly', (_s, w, h) => {
    expect(backingToLogical(0, 0, w, h)).toEqual({ x: 0, y: 0 });
    const c = backingToLogical(w / 2, h / 2, w, h);
    expect(c.x).toBeCloseTo(LOGICAL_W / 2, 9);
    expect(c.y).toBeCloseTo(LOGICAL_H / 2, 9);
    const e = backingToLogical(w, h, w, h);
    expect(e.x).toBeCloseTo(LOGICAL_W, 9); expect(e.y).toBeCloseTo(LOGICAL_H, 9);
  });
});

describe('parseRenderQuality', () => {
  it('accepts known tiers only', () => {
    expect(parseRenderQuality('low')).toBe('low');
    expect(parseRenderQuality('ultra')).toBe('high');
    expect(parseRenderQuality(null)).toBe('high');
  });
});

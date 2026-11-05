/**
 * @file SoftDepthTheme.test.ts
 * @purpose Contrast and token-lock tests for the Soft Depth themes; settings persistence.
 * @author Agent 934
 * @date 2026-11-05
 * @license Proprietary – available for licensing
 */
import { resolveTheme, contrastRatio, THEME_NAMES, SHELL, DEMO_CREDITS_LABEL } from '../shared/ui/SoftDepthTheme';
import { loadSettings, saveSettings, defaultSettings, SETTINGS_STORAGE_KEY } from '../shared/ui/DemoSettings';

describe('Soft Depth theme tokens', () => {
  const variants = THEME_NAMES.flatMap((n) => [resolveTheme(n, false), resolveTheme(n, true)]);

  test.each(variants.map((t) => [`${t.name}${t.highContrast ? '+hc' : ''}`, t]))('%s: text pairs meet 4.5:1', (_n, t) => {
    const surfaces = [t.background, t.surface, t.surfaceRaised, t.stage];
    for (const bg of surfaces) {
      expect(contrastRatio(t.text, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(t.muted, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(t.accent, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(t.success, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(t.loss, bg)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrastRatio(t.ctaText, t.cta)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t.focus, t.surface)).toBeGreaterThanOrEqual(3);
  });

  test('branding changes only brand tokens; semantics are locked', () => {
    const [g, e, v] = THEME_NAMES.map((n) => resolveTheme(n));
    for (const k of ['background', 'surface', 'stage', 'text', 'muted', 'success', 'loss'] as const) {
      expect(e[k]).toBe(g[k]); expect(v[k]).toBe(g[k]);
    }
    expect(new Set([g.accent, e.accent, v.accent]).size).toBe(3);
  });

  test('high-contrast borders meet 3:1 for control boundaries', () => {
    const t = resolveTheme('gold', true);
    expect(contrastRatio(t.line, t.surface)).toBeGreaterThanOrEqual(3);
  });

  test('shell geometry matches the art spec', () => {
    expect(SHELL.stage).toMatchObject({ x: 16, y: 136, width: 358, height: 544 });
    expect(SHELL.cta).toEqual({ x: 20, y: 754, width: 350, height: 52 });
    expect(SHELL.iconHit).toBeGreaterThanOrEqual(44);
    expect(Math.min(...Object.values(SHELL.fontPx))).toBeGreaterThanOrEqual(11);
    expect(DEMO_CREDITS_LABEL).toBe('Demo credits have no cash value');
  });
});

describe('DemoSettings', () => {
  const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m }; };

  test('defaults follow reduced-motion preference', () => {
    expect(defaultSettings(true).reducedMotion).toBe(true);
    expect(loadSettings(null, false)).toEqual(defaultSettings(false));
  });

  test('round-trips and rejects corrupt or unknown values', () => {
    const s = mem();
    saveSettings(s, { ...defaultSettings(), theme: 'violet', sound: false });
    expect(loadSettings(s).theme).toBe('violet');
    expect(loadSettings(s).sound).toBe(false);
    s.m.set(SETTINGS_STORAGE_KEY, '{"theme":"neon","sound":"yes"}');
    expect(loadSettings(s)).toMatchObject({ theme: 'gold', sound: true });
    s.m.set(SETTINGS_STORAGE_KEY, 'not json');
    expect(loadSettings(s)).toEqual(defaultSettings());
  });

  test('storage failures are tolerated', () => {
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('quota'); } };
    expect(() => saveSettings(broken, defaultSettings())).not.toThrow();
    expect(loadSettings(broken)).toEqual(defaultSettings());
  });
});

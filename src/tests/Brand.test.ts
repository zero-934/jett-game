/**
 * @file Brand.test.ts
 * @purpose polish-004: operator branding validation (presentation only, locked semantics).
 * @author Agent 934
 * @date 2026-11-06
 * @license Proprietary – available for licensing
 */
import { validateBrand, isSafeLogoUrl, applyBrandTokens, brandLocksAccent, setActiveBrand, getActiveBrand, onBrandChange, DEFAULT_BRAND, EXAMPLE_BRAND_HARBOR, EXAMPLE_BRAND_ORCHID } from '../shared/brand/Brand';
import { resolveTheme } from '../shared/ui/SoftDepthTheme';

describe('brand validation', () => {
  it.each([DEFAULT_BRAND, EXAMPLE_BRAND_HARBOR, EXAMPLE_BRAND_ORCHID])('%#: shipped brands are valid with all three player themes', (b) => {
    for (const t of ['gold', 'emerald', 'violet'] as const) expect(validateBrand(b, t)).toEqual({ ok: true, errors: [] });
  });
  it('rejects low-contrast CTA labels and text', () => {
    expect(validateBrand({ ...EXAMPLE_BRAND_HARBOR, colors: { ...EXAMPLE_BRAND_HARBOR.colors, ctaText: '#5fd0d8' } }).errors).toContain('contrast ctaText/cta');
    expect(validateBrand({ ...EXAMPLE_BRAND_HARBOR, colors: { surface: '#d0d0d0' } }).ok).toBe(false);
  });
  it('rejects markup in wordmarks, bad ids, unknown fonts, non-hex colours', () => {
    expect(validateBrand({ id: 'x-y', wordmark: '<b>hi</b>' }).errors).toContain('wordmark');
    expect(validateBrand({ id: 'Bad Id', wordmark: '' }).errors).toContain('id');
    expect(validateBrand({ id: 'ok-id', wordmark: '', font: 'Comic' }).errors).toContain('font');
    expect(validateBrand({ id: 'ok-id', wordmark: '', colors: { accent: 'red' } }).errors).toContain('colors.accent');
  });
  it('success/loss semantics and demo labelling are not brandable', () => {
    const hostile = { ...EXAMPLE_BRAND_ORCHID, colors: { ...EXAMPLE_BRAND_ORCHID.colors, success: '#ff0000', loss: '#00ff00', text: '#111111' } as never };
    expect(validateBrand(hostile).errors).toEqual(expect.arrayContaining(['colors.success (locked)', 'colors.loss (locked)', 'colors.text (locked)']));
    const t = applyBrandTokens(resolveTheme('gold'), hostile);
    expect([t.success, t.loss, t.text]).toEqual([resolveTheme('gold').success, resolveTheme('gold').loss, resolveTheme('gold').text]);
  });
  it('high contrast keeps its text/muted overrides over a brand', () => {
    const t = applyBrandTokens(resolveTheme('gold', true), EXAMPLE_BRAND_HARBOR);
    expect(t.text).toBe('#ffffff');
    expect(t.accent).toBe(EXAMPLE_BRAND_HARBOR.colors?.accent);
  });
  it('accent-locking brands hide the player theme picker', () => {
    expect(brandLocksAccent(DEFAULT_BRAND)).toBe(false);
    expect(brandLocksAccent(EXAMPLE_BRAND_HARBOR)).toBe(true);
  });
});

describe('logo URL safety', () => {
  it('allows relative app images only by default', () => {
    expect(isSafeLogoUrl('assets/brand/logo.svg')).toBe(true);
    for (const bad of ['javascript:alert(1)', 'data:image/svg+xml,<svg/onload=alert(1)>', '//evil.example/x.png', 'https://evil.example/x.png', '../secret.png', ' assets/x.png', 'blob:abc'])
      expect(isSafeLogoUrl(bad)).toBe(false);
  });
  it('allows https only on allowlisted hosts and never with credentials', () => {
    expect(isSafeLogoUrl('https://cdn.partner.example/l.png', ['cdn.partner.example'])).toBe(true);
    expect(isSafeLogoUrl('https://u:p@cdn.partner.example/l.png', ['cdn.partner.example'])).toBe(false);
    expect(isSafeLogoUrl('https://cdn.partner.example.evil.example/l.png', ['cdn.partner.example'])).toBe(false);
  });
});

describe('active brand switching', () => {
  it('applies valid brands, ignores invalid ones, notifies listeners', () => {
    const seen: string[] = [];
    const off = onBrandChange((b) => seen.push(b.id));
    expect(setActiveBrand(EXAMPLE_BRAND_ORCHID).ok).toBe(true);
    expect(setActiveBrand({ id: 'nope', wordmark: '<x>' }).ok).toBe(false);
    expect(getActiveBrand().id).toBe('example-orchid-club');
    setActiveBrand(DEFAULT_BRAND);
    off();
    setActiveBrand(EXAMPLE_BRAND_HARBOR);
    expect(seen).toEqual(['example-orchid-club', 'jett-default']);
    setActiveBrand(DEFAULT_BRAND);
  });
});

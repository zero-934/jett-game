/**
 * @file SoftDepthShell.ts
 * @purpose Reusable mobile-first game shell for the polish-003 pilots (Jett, Flap Fortune,
 *          Shatter Step): header (back, title, demo balance, settings), round HUD (phase,
 *          multiplier, progress), stage frame with an exclusive gameplay input zone, anchored
 *          footer (stake, authoritative return, one CTA, persistent no-cash-value label),
 *          results card, pause overlay and settings panel.
 *
 *          Accessibility: Phaser draws the visuals; a synchronized DOM layer provides real
 *          <button>s with labels and visible focus for Back/Settings/CTA plus game-supplied
 *          stage actions, an aria-live region and a modal settings dialog. DOM controls do not
 *          take pointer events (pointer input goes to Phaser) so nothing can double-fire.
 *          Keyboard gameplay keys are delivered through `onKey` only when focus is not on a
 *          control, and auto-repeat is flagged so games can ignore it.
 *
 *          Input isolation: gameplay pointers come only from the stage zone. Header/footer
 *          controls are separate interactive objects outside the stage, so a CTA tap can never
 *          steer, flap or pick.
 * @author Agent 934
 * @date 2026-11-05
 * @license Proprietary – available for licensing
 */
import * as Phaser from 'phaser';
import { drawButton } from './UITheme';
import { SHELL, DEMO_CREDITS_LABEL, resolveTheme, hexToInt, THEME_NAMES, LAYOUT_STANDARD } from './SoftDepthTheme';
import type { SoftDepthTokens, ThemeName, ShellLayout } from './SoftDepthTheme';
import { loadSettings, saveSettings } from './DemoSettings';
import type { DemoSettings, SettingsStorage } from './DemoSettings';
import { AudioService } from '../audio/AudioService';
import { formatCredits } from '../sim/DemoLedger';

/** Font stack. Inter is preferred when available; self-hosting it is a follow-up. */
export const SHELL_FONT = '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';

const DEPTH = { stageInput: 38, hudScrim: 4, /* above backdrops, below hazards */ fillet: 40, panel: 41, panelContent: 42, cta: 44, result: 60, pause: 58, settings: 80 } as const;
const RESULT_FADE_MS = 160;
const LETTER_SPACING_CAPS = 1.6;
const ICON_HIT_W = 66;
/** HUD text opacity while a hazard passes beneath it. */
const HUD_DIM_ALPHA = 0.25;
const ICON_HIT_H = 66;
const HEADER_MID = SHELL.headerBottom / 2;
const CTA_HIT_PAD = 8;
/** Below this CSS scale the shell reflows its primary controls into a visible DOM rail. */
const RAIL_SCALE_THRESHOLD = 0.6;
const RAIL_WIDTH_PX = 176;
const STAGE_POINTERS = 2;

/** Pointer data passed to games, in logical (390×844) and stage-local coordinates. */
export interface StagePointer {
  id: number;
  x: number;
  y: number;
  stageX: number;
  stageY: number;
}

/** Key event passed to games when no control has focus. */
export interface ShellKey {
  code: string;
  type: 'down' | 'up';
  repeat: boolean;
}

/** Footer state. */
export interface FooterState {
  stakeHundredths: number;
  rightLabel: string;
  rightValue: string;
  ctaLabel: string;
  ctaEnabled: boolean;
  /** Accessible label for the CTA (defaults to ctaLabel). */
  ctaAria?: string;
}

/** Round HUD state. */
export interface HudState {
  phaseLabel: string;
  multiplier: string;
  progress: string;
  /** 'accent' while playing, 'success' after a net win, 'loss' after a loss, 'muted' otherwise. */
  tone: 'accent' | 'success' | 'loss' | 'muted';
}

/** Result card content. All money in hundredths. */
export interface ResultState {
  title: string;
  returnHundredths: number;
  stakeHundredths: number;
  tone: 'success' | 'loss' | 'neutral';
}

/** Extra focusable stage action exposed to keyboard and screen readers. */
export interface StageAction {
  id: string;
  label: string;
  /** Logical rect (390×844 space) used to place the focus ring. */
  rect: { x: number; y: number; width: number; height: number };
  enabled: boolean;
  onActivate: () => void;
  /** Show as a real, visible button in the landscape control rail (e.g. Shatter panes). */
  rail?: boolean;
}

/** Shell options. */
export interface ShellOptions {
  title: string;
  onBack: () => void;
  onPrimary: () => void;
  onStageDown?: (p: StagePointer) => void;
  onStageMove?: (p: StagePointer) => void;
  onStageUp?: (p: StagePointer) => void;
  onKey?: (key: ShellKey) => void;
  /** Called when the settings panel opens/closes (games pause on open). */
  onSettingsOpen?: (open: boolean) => void;
  /** Called after any settings change (theme, motion, contrast...). */
  onSettingsChanged?: (settings: DemoSettings, tokens: SoftDepthTokens) => void;
  /** Called on blur/hidden so games can pause and clear held input. */
  onVisibilityLost?: (reason: 'hidden' | 'blur') => void;
  /** Override storage (tests). */
  storage?: SettingsStorage | null;
  /** Layout variant. Defaults to the standard art-spec layout. */
  layout?: ShellLayout;
}

function css(hex: string, alpha = 1): string {
  const n = hexToInt(hex);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/**
 * The shared shell. Create in Scene.create(); it destroys itself on scene shutdown.
 * @example
 * const shell = new SoftDepthShell(this, { title: 'FLAP FORTUNE', onBack, onPrimary });
 * shell.setFooter({ stakeHundredths: 1000, rightLabel: 'RETURN IF CASHED OUT', rightValue: '—', ctaLabel: 'START · 10.00', ctaEnabled: true });
 */
export class SoftDepthShell {
  readonly scene: Phaser.Scene;
  readonly layout: ShellLayout;
  readonly stage: ShellLayout['stage'];
  settings: DemoSettings;
  tokens: SoftDepthTokens;

  private readonly opts: ShellOptions;
  private chrome: Phaser.GameObjects.Graphics;
  private hudScrim: Phaser.GameObjects.Graphics | null = null;
  private texts: Record<string, Phaser.GameObjects.Text> = {};
  private cta: { bg: Phaser.GameObjects.Graphics; text: Phaser.GameObjects.Text } | null = null;
  private stageZone: Phaser.GameObjects.Zone;
  private hitZones: Phaser.GameObjects.Rectangle[] = [];
  private resultObjects: Phaser.GameObjects.GameObject[] = [];
  private pauseObjects: Phaser.GameObjects.GameObject[] = [];
  private settingsObjects: Phaser.GameObjects.GameObject[] = [];
  private footer: FooterState | null = null;
  private hud: HudState | null = null;
  private balanceHundredths = 0;
  private settingsOpenValue = false;
  private destroyed = false;
  private stageActions: StageAction[] = [];

  // DOM accessibility layer
  private dom: HTMLDivElement | null = null;
  private domButtons: Record<string, HTMLButtonElement> = {};
  private live: HTMLDivElement | null = null;
  private dialog: HTMLDivElement | null = null;
  private readonly listeners: Array<[EventTarget, string, EventListener]> = [];

  /**
   * @param scene - Owning scene.
   * @param opts - Callbacks and title.
   */
  constructor(scene: Phaser.Scene, opts: ShellOptions) {
    this.scene = scene;
    this.opts = opts;
    this.layout = opts.layout ?? LAYOUT_STANDARD;
    this.stage = this.layout.stage;
    const storage = opts.storage !== undefined ? opts.storage : SoftDepthShell.defaultStorage();
    const prm = typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.settings = loadSettings(storage, prm);
    this.tokens = resolveTheme(this.settings.theme, this.settings.highContrast);
    AudioService.setEnabled(this.settings.sound);

    scene.input.addPointer(STAGE_POINTERS - 1);
    this.chrome = scene.add.graphics().setDepth(DEPTH.panel);
    this.hudScrim = this.layout.hudOverlay ? scene.add.graphics().setDepth(DEPTH.hudScrim) : null;
    this.stageZone = scene.add.zone(this.stage.x, this.stage.y, this.stage.width, this.stage.height).setOrigin(0).setDepth(DEPTH.stageInput).setInteractive();
    this.wireStageZone();
    this.buildStaticText();
    this.buildHitZones();
    this.buildDom();
    this.redrawChrome();

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
    scene.events.once(Phaser.Scenes.Events.DESTROY, () => this.destroy());
  }

  private static defaultStorage(): SettingsStorage | null {
    try { return typeof window !== 'undefined' ? window.localStorage : null; } catch { return null; }
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /** @returns Whether the settings panel is open. */
  get settingsOpen(): boolean { return this.settingsOpenValue; }

  /**
   * Sets the demo balance shown in the header.
   * @param hundredths - Balance in hundredths.
   * @returns void
   */
  setBalance(hundredths: number): void {
    this.balanceHundredths = hundredths;
    this.texts.balance.setText(formatCredits(hundredths));
  }

  /**
   * Updates the round HUD. Only changed text is re-rasterised.
   * @param hud - HUD state.
   * @returns void
   */
  setHud(hud: HudState): void {
    const prev = this.hud;
    this.hud = hud;
    if (!prev || prev.phaseLabel !== hud.phaseLabel) this.texts.phase.setText(hud.phaseLabel.toUpperCase());
    if (!prev || prev.multiplier !== hud.multiplier) this.texts.multiplier.setText(hud.multiplier);
    if (!prev || prev.progress !== hud.progress) this.texts.progress.setText(hud.progress);
    if (!prev || prev.tone !== hud.tone) this.texts.multiplier.setColor(this.toneColor(hud.tone));
  }

  /**
   * Updates the footer. The CTA is rebuilt only when its label/enabled state changes.
   * @param f - Footer state.
   * @returns void
   */
  setFooter(f: FooterState): void {
    const prev = this.footer;
    this.footer = f;
    this.texts.stake.setText(formatCredits(f.stakeHundredths));
    this.texts.rightLabel.setText(f.rightLabel.toUpperCase());
    this.texts.rightValue.setText(f.rightValue);
    if (!prev || prev.ctaLabel !== f.ctaLabel || prev.ctaEnabled !== f.ctaEnabled) this.buildCta();
    const b = this.domButtons.cta;
    if (b) {
      b.textContent = f.ctaLabel;
      b.setAttribute('aria-label', f.ctaAria ?? f.ctaLabel);
      b.disabled = !f.ctaEnabled;
    }
  }

  /**
   * Shows the frozen authoritative result in a card over the stage.
   * @param r - Result content.
   * @returns void
   */
  showResult(r: ResultState): void {
    this.hideResult();
    const s = this.stage;
    const t = this.tokens;
    const w = 300; const h = 168; const x = s.x + (s.width - w) / 2; const y = s.y + s.height * 0.36 - h / 2;
    const g = this.scene.add.graphics().setDepth(DEPTH.result);
    g.fillStyle(hexToInt(t.surfaceRaised), 0.97).fillRoundedRect(x, y, w, h, 14);
    g.lineStyle(1, hexToInt(t.line), 1).strokeRoundedRect(x, y, w, h, 14);
    const color = r.tone === 'success' ? t.success : r.tone === 'loss' ? t.loss : t.text;
    const net = r.returnHundredths - r.stakeHundredths;
    const netText = `Net ${net > 0 ? '+' : net < 0 ? '−' : '±'}${formatCredits(Math.abs(net))} · stake ${formatCredits(r.stakeHundredths)}`;
    const cx = x + w / 2;
    const title = this.text(cx, y + 30, r.title.toUpperCase(), 12, color, 'bold').setOrigin(0.5).setDepth(DEPTH.result + 1).setLetterSpacing(LETTER_SPACING_CAPS);
    const amount = this.text(cx, y + 72, formatCredits(r.returnHundredths), 36, t.text, 'bold').setOrigin(0.5).setDepth(DEPTH.result + 1);
    const caption = this.text(cx, y + 106, 'DEMO CREDITS RETURNED', 11, t.muted).setOrigin(0.5).setDepth(DEPTH.result + 1).setLetterSpacing(LETTER_SPACING_CAPS);
    const netLine = this.text(cx, y + 138, netText, 13, net > 0 ? t.success : t.text).setOrigin(0.5).setDepth(DEPTH.result + 1);
    this.resultObjects = [g, title, amount, caption, netLine];
    if (!this.settings.reducedMotion) {
      for (const o of this.resultObjects) (o as unknown as Phaser.GameObjects.Components.Alpha).setAlpha(0);
      this.scene.tweens.add({ targets: this.resultObjects, alpha: 1, duration: RESULT_FADE_MS, ease: 'Quad.easeOut' });
    }
    this.announce(`${r.title}. ${formatCredits(r.returnHundredths)} demo credits returned. ${netText}.`);
  }

  /** Removes the result card. */
  hideResult(): void {
    for (const o of this.resultObjects) o.destroy();
    this.resultObjects = [];
  }

  /**
   * Shows or hides the paused overlay inside the stage.
   * @param message - Message, or null to hide.
   * @returns void
   */
  setPaused(message: string | null): void {
    for (const o of this.pauseObjects) o.destroy();
    this.pauseObjects = [];
    if (!message) return;
    const s = this.stage;
    const g = this.scene.add.graphics().setDepth(DEPTH.pause);
    g.fillStyle(hexToInt(this.tokens.background), 0.72).fillRect(s.x, s.y, s.width, s.height);
    const t = this.text(s.x + s.width / 2, s.y + s.height / 2, message, 15, this.tokens.text, 'bold').setOrigin(0.5).setDepth(DEPTH.pause + 1).setAlign('center');
    this.pauseObjects = [g, t];
    this.announce(message.replace(/\n/g, ' '));
  }

  /**
   * Registers focusable stage actions (e.g. Shatter panes, Flap "flap").
   * @param actions - Current actions (replaces previous).
   * @returns void
   */
  setStageActions(actions: StageAction[]): void {
    this.stageActions = actions;
    if (!this.dom) return;
    for (const [id, b] of Object.entries(this.domButtons)) if (id.startsWith('stage:')) { b.remove(); delete this.domButtons[id]; }
    for (const a of actions) {
      const b = this.makeDomButton(`stage:${a.id}`, a.label, a.rect, () => a.onActivate());
      b.disabled = !a.enabled;
    }
    this.layoutDom();
  }

  /**
   * Announces a short message to assistive technology.
   * @param message - Text.
   * @returns void
   */
  announce(message: string): void {
    if (!this.live) return;
    this.live.textContent = '';
    this.live.textContent = message;
  }

  /**
   * Fires a short vibration when haptics are enabled.
   * @param ms - Duration.
   * @returns void
   */
  haptic(ms: number): void {
    if (!this.settings.haptics) return;
    const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { vibrate?: (p: number) => boolean }) : null;
    nav?.vibrate?.(ms);
  }

  /**
   * Converts a logical point to stage-local coordinates.
   * @param x - Logical X.
   * @param y - Logical Y.
   * @returns Stage-local point.
   */
  toStage(x: number, y: number): { x: number; y: number } {
    return { x: x - this.stage.x, y: y - this.stage.y };
  }

  /**
   * Hazard-aware HUD (presentation only): when any given hazard rect (logical px) overlaps the
   * overlaid HUD text, the text fades so the hazard stays readable underneath.
   * @param hazards - Screen-space rects of hazards this frame.
   * @returns Whether the HUD is currently dimmed.
   */
  setHudObstruction(hazards: ReadonlyArray<{ x: number; y: number; w: number; h: number }>): boolean {
    if (!this.layout.hudOverlay) return false;
    const names = ['phase', 'multiplier', 'progress'];
    const boxes = names.map((n) => this.texts[n].getBounds());
    const hit = hazards.some((z) => boxes.some((b) => z.x < b.x + b.width && b.x < z.x + z.w && z.y < b.y + b.height && b.y < z.y + z.h));
    const alpha = hit ? HUD_DIM_ALPHA : 1;
    for (const n of names) if (this.texts[n].alpha !== alpha) this.texts[n].setAlpha(alpha);
    return hit;
  }

  /** Destroys DOM and listeners. Idempotent; called automatically on scene shutdown. */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const [target, type, fn] of this.listeners) target.removeEventListener(type, fn);
    this.listeners.length = 0;
    this.scene.scale.off(Phaser.Scale.Events.RESIZE, this.layoutDom, this);
    this.dom?.remove();
    this.dom = null;
    this.domButtons = {};
  }

  // ─── Construction ─────────────────────────────────────────────────────────

  private text(x: number, y: number, value: string, px: number, color: string, weight: 'normal' | 'bold' = 'normal'): Phaser.GameObjects.Text {
    const t = this.scene.add.text(x, y, value, { fontFamily: SHELL_FONT, fontSize: `${px}px`, color, fontStyle: weight });
    t.setResolution(Math.min(3, Math.max(1, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)));
    return t;
  }

  private toneColor(tone: HudState['tone']): string {
    const t = this.tokens;
    return tone === 'accent' ? t.accent : tone === 'success' ? t.success : tone === 'loss' ? t.loss : t.muted;
  }

  private buildStaticText(): void {
    const t = this.tokens; const W = SHELL.width; const f = SHELL.fontPx;
    const d = DEPTH.panelContent;
    this.texts.title = this.text(56, HEADER_MID, this.opts.title.toUpperCase(), f.title, t.text, 'bold').setOrigin(0, 0.5).setDepth(d).setLetterSpacing(0.6);
    this.texts.balanceLabel = this.text(W - 70, HEADER_MID - 9, 'DEMO CREDITS', f.label, t.muted).setOrigin(1, 0.5).setDepth(d).setLetterSpacing(1);
    this.texts.balance = this.text(W - 70, HEADER_MID + 9, '0.00', 15, t.text, 'bold').setOrigin(1, 0.5).setDepth(d);
    const L = this.layout;
    this.texts.phase = this.text(W / 2, L.hudY.phase, '', f.label, t.muted, 'bold').setOrigin(0.5).setDepth(d).setLetterSpacing(LETTER_SPACING_CAPS);
    this.texts.multiplier = this.text(W / 2, L.hudY.multiplier, '', L.multiplierPx, t.accent, 'bold').setOrigin(0.5).setDepth(d);
    this.texts.progress = this.text(W / 2, L.hudY.progress, '', f.progress, t.text).setOrigin(0.5).setDepth(d);
    this.texts.stakeLabel = this.text(22, L.footerLabelY, 'DEMO STAKE', f.label, t.muted, 'bold').setOrigin(0, 0.5).setDepth(d).setLetterSpacing(1);
    this.texts.stake = this.text(22, L.footerValueY, '', f.stake, t.text, 'bold').setOrigin(0, 0.5).setDepth(d);
    this.texts.rightLabel = this.text(W - 22, L.footerLabelY, '', f.label, t.muted, 'bold').setOrigin(1, 0.5).setDepth(d).setLetterSpacing(1);
    this.texts.rightValue = this.text(W - 22, L.footerValueY, '', 16, t.text, 'bold').setOrigin(1, 0.5).setDepth(d);
    this.texts.demo = this.text(W / 2, L.demoLabelY, DEMO_CREDITS_LABEL.toUpperCase(), f.demoLabel, t.muted, 'bold').setOrigin(0.5).setDepth(d).setLetterSpacing(1);
  }

  /** Repaints panels, icons and theme-dependent text colours. */
  private redrawChrome(): void {
    const t = this.tokens; const g = this.chrome; const s = this.stage; const W = SHELL.width; const H = SHELL.height;
    g.clear();
    // Panels above and below the stage (also clip stage overflow).
    g.fillStyle(hexToInt(t.background), 1);
    g.fillRect(0, 0, W, s.y);
    g.fillRect(0, s.y + s.height, W, H - s.y - s.height);
    g.fillRect(0, s.y, s.x, s.height);
    g.fillRect(s.x + s.width, s.y, W - s.x - s.width, s.height);
    g.fillStyle(hexToInt(t.surface), 1).fillRect(0, 0, W, SHELL.headerBottom);
    const ct = this.layout.controlsTop;
    g.fillStyle(hexToInt(t.surface), 1).fillRect(0, ct, W, H - ct);
    g.lineStyle(1, hexToInt(t.line), 1);
    g.lineBetween(0, SHELL.headerBottom, W, SHELL.headerBottom);
    g.lineBetween(0, ct, W, ct);
    if (this.hudScrim) {
      // Legibility scrim behind the overlaid HUD; fades out well above the play area's centre.
      const sc = this.hudScrim; sc.clear();
      const bg = hexToInt(t.background);
      sc.fillGradientStyle(bg, bg, bg, bg, 0.62, 0.62, 0, 0).fillRect(s.x, s.y, s.width, 84);
    }
    // Rounded stage corners: fillets in the background colour over the stage content.
    const r = s.radius;
    g.fillStyle(hexToInt(t.background), 1);
    for (const [cx, cy, sx, sy] of [[s.x, s.y, 1, 1], [s.x + s.width, s.y, -1, 1], [s.x, s.y + s.height, 1, -1], [s.x + s.width, s.y + s.height, -1, -1]] as const) {
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + sx * r, cy);
      for (let i = 0; i <= 8; i++) {
        const a = (Math.PI / 2) * (i / 8);
        g.lineTo(cx + sx * (r - r * Math.sin(a)), cy + sy * (r - r * Math.cos(a)));
      }
      g.closePath();
      g.fillPath();
    }
    g.lineStyle(1, hexToInt(t.line), 1).strokeRoundedRect(s.x, s.y, s.width, s.height, r);
    // Lucide-style icons: chevron-left and settings (gear).
    g.lineStyle(2, hexToInt(t.text), 1);
    g.beginPath(); g.moveTo(30, HEADER_MID - 7); g.lineTo(23, HEADER_MID); g.lineTo(30, HEADER_MID + 7); g.strokePath();
    const gx = W - ICON_HIT_W / 2; const gy = HEADER_MID;
    g.strokeCircle(gx, gy, 3.5);
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.moveTo(gx + Math.cos(a) * 6.5, gy + Math.sin(a) * 6.5);
      g.lineTo(gx + Math.cos(a) * 9, gy + Math.sin(a) * 9);
    }
    g.strokePath();
    g.strokeCircle(gx, gy, 6.5);
    // Theme-dependent text colours.
    this.texts.title.setColor(t.text);
    for (const k of ['balanceLabel', 'phase', 'stakeLabel', 'rightLabel', 'demo']) this.texts[k].setColor(t.muted);
    for (const k of ['balance', 'progress', 'stake', 'rightValue']) this.texts[k].setColor(t.text);
    if (this.hud) this.texts.multiplier.setColor(this.toneColor(this.hud.tone));
    if (this.footer) this.buildCta();
    this.updateDomTheme();
  }

  private buildCta(): void {
    this.cta?.bg.destroy();
    this.cta?.text.destroy();
    const f = this.footer; if (!f) return;
    const c = this.layout.cta; const t = this.tokens;
    const colors = f.ctaEnabled
      ? { fill: hexToInt(t.cta), text: t.ctaText, fontFamily: SHELL_FONT, fontSize: `${SHELL.fontPx.cta}px` }
      : { fill: hexToInt(t.surfaceRaised), text: t.muted, stroke: hexToInt(t.line), fontFamily: SHELL_FONT, fontSize: `${SHELL.fontPx.cta}px` };
    this.cta = drawButton(this.scene, c.x + c.width / 2, c.y + c.height / 2, c.width, c.height, f.ctaLabel, 'primary', DEPTH.cta, colors);
    this.cta.text.setLetterSpacing(1.2).setResolution(this.texts.title.style.resolution || 1);
    this.cta.bg.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev?.stopPropagation?.();
      AudioService.unlock();
      if (this.footer?.ctaEnabled && !this.settingsOpenValue) this.opts.onPrimary();
    });
  }

  private buildHitZones(): void {
    const mk = (x: number, y: number, fn: () => void) => {
      const z = this.scene.add.rectangle(x, y, ICON_HIT_W, ICON_HIT_H, 0, 0).setDepth(DEPTH.cta).setInteractive({ useHandCursor: true });
      z.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => { ev?.stopPropagation?.(); fn(); });
      this.hitZones.push(z);
    };
    mk(ICON_HIT_W / 2, ICON_HIT_H / 2, () => { if (!this.settingsOpenValue) this.opts.onBack(); });
    mk(SHELL.width - ICON_HIT_W / 2, ICON_HIT_H / 2, () => this.toggleSettings());
    // Extra CTA hit band (invisible): +CTA_HIT_PAD above and below the drawn 52 px button, so the
    // CSS target stays >= 44 px on narrow phones. Entirely inside the footer, never over the stage.
    const c = this.layout.cta;
    const band = this.scene.add.rectangle(c.x + c.width / 2, c.y + c.height / 2, c.width, c.height + CTA_HIT_PAD * 2, 0, 0).setDepth(DEPTH.cta - 1).setInteractive({ useHandCursor: true });
    band.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev?.stopPropagation?.();
      AudioService.unlock();
      if (this.footer?.ctaEnabled && !this.settingsOpenValue) this.opts.onPrimary();
    });
    this.hitZones.push(band);
  }

  private wireStageZone(): void {
    const toStagePointer = (p: Phaser.Input.Pointer): StagePointer => ({ id: p.id, x: p.x, y: p.y, stageX: p.x - this.stage.x, stageY: p.y - this.stage.y });
    this.stageZone.on('pointerdown', (p: Phaser.Input.Pointer) => { AudioService.unlock(); if (!this.settingsOpenValue) this.opts.onStageDown?.(toStagePointer(p)); });
    this.stageZone.on('pointermove', (p: Phaser.Input.Pointer) => { if (!this.settingsOpenValue && p.isDown) this.opts.onStageMove?.(toStagePointer(p)); });
    this.stageZone.on('pointerup', (p: Phaser.Input.Pointer) => this.opts.onStageUp?.(toStagePointer(p)));
    this.stageZone.on('pointerout', (p: Phaser.Input.Pointer) => this.opts.onStageUp?.(toStagePointer(p)));
  }

  // ─── Settings panel (Phaser visuals + DOM dialog) ─────────────────────────

  private toggleSettings(): void {
    if (this.settingsOpenValue) this.closeSettings(); else this.openSettings();
  }

  private openSettings(): void {
    if (this.settingsOpenValue) return;
    this.settingsOpenValue = true;
    this.opts.onSettingsOpen?.(true);
    this.drawSettingsPanel();
    this.openDomDialog();
  }

  private closeSettings(): void {
    if (!this.settingsOpenValue) return;
    this.settingsOpenValue = false;
    for (const o of this.settingsObjects) o.destroy();
    this.settingsObjects = [];
    this.closeDomDialog();
    this.opts.onSettingsOpen?.(false);
  }

  private settingRows(): Array<{ key: keyof DemoSettings; label: string }> {
    return [
      { key: 'sound', label: 'Sound effects' },
      { key: 'music', label: 'Music' },
      { key: 'reducedMotion', label: 'Reduced motion' },
      { key: 'highContrast', label: 'High contrast' },
      { key: 'haptics', label: 'Haptics' },
    ];
  }

  private applySetting(next: DemoSettings): void {
    this.settings = next;
    saveSettings(this.opts.storage !== undefined ? this.opts.storage : SoftDepthShell.defaultStorage(), next);
    AudioService.setEnabled(next.sound);
    this.tokens = resolveTheme(next.theme, next.highContrast);
    this.redrawChrome();
    if (this.settingsOpenValue) { for (const o of this.settingsObjects) o.destroy(); this.settingsObjects = []; this.drawSettingsPanel(); this.syncDomDialog(); }
    this.opts.onSettingsChanged?.(next, this.tokens);
  }

  private drawSettingsPanel(): void {
    const t = this.tokens; const x = 28; const y = 150; const w = 334; const rows = this.settingRows();
    const h = 96 + rows.length * 48 + 70;
    const g = this.scene.add.graphics().setDepth(DEPTH.settings);
    g.fillStyle(hexToInt(t.background), 0.6).fillRect(0, 0, SHELL.width, SHELL.height);
    g.fillStyle(hexToInt(t.surfaceRaised), 1).fillRoundedRect(x, y, w, h, 14);
    g.lineStyle(1, hexToInt(t.line), 1).strokeRoundedRect(x, y, w, h, 14);
    const blocker = this.scene.add.rectangle(0, 0, SHELL.width, SHELL.height, 0, 0).setOrigin(0).setDepth(DEPTH.settings).setInteractive();
    blocker.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => ev?.stopPropagation?.());
    const objs: Phaser.GameObjects.GameObject[] = [g, blocker];
    objs.push(this.text(x + 20, y + 30, 'SETTINGS', 12, t.muted, 'bold').setOrigin(0, 0.5).setDepth(DEPTH.settings + 1).setLetterSpacing(LETTER_SPACING_CAPS));
    objs.push(this.text(x + 20, y + 56, 'The round is paused while settings are open.', 12, t.text).setOrigin(0, 0.5).setDepth(DEPTH.settings + 1));
    rows.forEach((row, i) => {
      const ry = y + 96 + i * 48;
      const on = Boolean(this.settings[row.key]);
      objs.push(this.text(x + 20, ry, row.label, 15, t.text).setOrigin(0, 0.5).setDepth(DEPTH.settings + 1));
      const sw = this.scene.add.graphics().setDepth(DEPTH.settings + 1);
      sw.fillStyle(hexToInt(on ? t.accent : t.line), 1).fillRoundedRect(x + w - 66, ry - 12, 44, 24, 12);
      sw.fillStyle(hexToInt(on ? t.ctaText : t.muted), 1).fillCircle(on ? x + w - 34 : x + w - 54, ry, 8);
      objs.push(sw);
      const hit = this.scene.add.rectangle(x + w / 2, ry, w - 16, 44, 0, 0).setDepth(DEPTH.settings + 2).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => { ev?.stopPropagation?.(); this.applySetting({ ...this.settings, [row.key]: !on }); });
      objs.push(hit);
    });
    const ty = y + 96 + rows.length * 48 + 4;
    objs.push(this.text(x + 20, ty, 'Theme', 15, t.text).setOrigin(0, 0.5).setDepth(DEPTH.settings + 1));
    THEME_NAMES.forEach((name, i) => {
      const cx = x + w - 150 + i * 52;
      const swatch = resolveTheme(name).accent;
      const sg = this.scene.add.graphics().setDepth(DEPTH.settings + 1);
      sg.fillStyle(hexToInt(swatch), 1).fillCircle(cx, ty, 11);
      if (this.settings.theme === name) sg.lineStyle(2, hexToInt(t.text), 1).strokeCircle(cx, ty, 15);
      objs.push(sg);
      const hit = this.scene.add.rectangle(cx, ty, 44, 44, 0, 0).setDepth(DEPTH.settings + 2).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => { ev?.stopPropagation?.(); this.applySetting({ ...this.settings, theme: name as ThemeName }); });
      objs.push(hit);
    });
    const { bg, text } = drawButton(this.scene, x + w / 2, y + h - 34, w - 40, 44, 'CLOSE', 'primary', DEPTH.settings + 1, { fill: hexToInt(t.cta), text: t.ctaText, fontFamily: SHELL_FONT, fontSize: '14px' });
    bg.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => { ev?.stopPropagation?.(); this.closeSettings(); });
    objs.push(bg, text);
    this.settingsObjects = objs;
  }

  // ─── DOM accessibility layer ──────────────────────────────────────────────

  private listen(target: EventTarget, type: string, fn: EventListener): void {
    target.addEventListener(type, fn);
    this.listeners.push([target, type, fn]);
  }

  private buildDom(): void {
    if (typeof document === 'undefined') return;
    const root = document.createElement('div');
    root.className = 'sd-a11y';
    root.setAttribute('data-shell', this.opts.title);
    Object.assign(root.style, { position: 'fixed', left: '0', top: '0', width: '0', height: '0', pointerEvents: 'none', zIndex: '10' });
    const style = document.createElement('style');
    style.textContent = `.sd-a11y button{position:absolute;background:transparent;border:0;margin:0;padding:0;color:transparent;font:12px sans-serif;pointer-events:none;border-radius:10px;outline:none}
.sd-a11y button:focus-visible{outline:3px solid var(--sd-focus,#f0d896);outline-offset:2px}
.sd-a11y button:disabled{cursor:not-allowed}
.sd-a11y .sd-live{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.sd-a11y .sd-dialog{position:absolute;pointer-events:auto;opacity:0.001}
.sd-a11y .sd-dialog label{display:block;font:14px sans-serif}
.sd-a11y button.sd-railbtn{pointer-events:auto;color:var(--sd-cta-text);background:var(--sd-cta);font:700 15px/1.2 system-ui,sans-serif;border-radius:10px;padding:0 12px}
.sd-a11y button.sd-railbtn.sd-secondary{background:var(--sd-surface);color:var(--sd-text);border:1px solid var(--sd-line)}
.sd-a11y button.sd-railbtn:disabled{background:var(--sd-surface);color:var(--sd-muted)}
.sd-a11y.sd-settings-open button.sd-railbtn{display:none}
.sd-a11y.sd-rail .sd-dialog{opacity:1;background:var(--sd-surface);color:var(--sd-text);border:1px solid var(--sd-line);border-radius:12px;padding:8px;box-sizing:border-box;overflow:auto;font:15px system-ui,sans-serif}
.sd-a11y.sd-rail .sd-dialog label{display:flex;align-items:center;gap:10px;min-height:44px;font:15px system-ui,sans-serif;color:var(--sd-text)}
.sd-a11y.sd-rail .sd-dialog input{width:22px;height:22px;margin:0 0 0 4px}
.sd-a11y.sd-rail .sd-dialog button{position:static;display:block;width:100%;min-height:48px;margin-top:6px;color:var(--sd-cta-text);background:var(--sd-cta);font:700 15px system-ui,sans-serif;border-radius:10px}`;
    root.appendChild(style);
    this.dom = root;
    document.body.appendChild(root);
    this.makeDomButton('back', 'Back to lobby', { x: 0, y: 0, width: ICON_HIT_W, height: ICON_HIT_H }, () => this.opts.onBack());
    this.makeDomButton('settings', 'Settings', { x: SHELL.width - ICON_HIT_W, y: 0, width: ICON_HIT_W, height: ICON_HIT_H }, () => this.toggleSettings());
    this.makeDomButton('cta', 'Start', { ...this.layout.cta, y: this.layout.cta.y - CTA_HIT_PAD, height: this.layout.cta.height + CTA_HIT_PAD * 2 }, () => { AudioService.unlock(); if (this.footer?.ctaEnabled && !this.settingsOpenValue) this.opts.onPrimary(); });
    const live = document.createElement('div');
    live.className = 'sd-live';
    live.setAttribute('aria-live', 'polite');
    live.setAttribute('role', 'status');
    root.appendChild(live);
    this.live = live;
    this.scene.scale.on(Phaser.Scale.Events.RESIZE, this.layoutDom, this);
    this.listen(window, 'resize', () => this.layoutDom());
    this.listen(window, 'keydown', (e) => this.onWindowKey(e as KeyboardEvent, 'down'));
    this.listen(window, 'keyup', (e) => this.onWindowKey(e as KeyboardEvent, 'up'));
    this.listen(window, 'blur', () => this.opts.onVisibilityLost?.('blur'));
    this.listen(document, 'visibilitychange', () => { if (document.hidden) this.opts.onVisibilityLost?.('hidden'); });
    this.layoutDom();
    this.updateDomTheme();
  }

  private makeDomButton(id: string, label: string, rect: { x: number; y: number; width: number; height: number }, fn: () => void): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.setAttribute('aria-label', label);
    b.dataset.rect = JSON.stringify(rect);
    b.dataset.id = id;
    b.addEventListener('click', (e) => { e.preventDefault(); fn(); });
    b.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') e.stopPropagation(); });
    this.dom?.appendChild(b);
    this.domButtons[id] = b;
    return b;
  }

  private layoutDom(): void {
    if (!this.dom || this.destroyed) return;
    const canvas = this.scene.game.canvas;
    const r = canvas.getBoundingClientRect();
    const k = r.width / SHELL.width;
    Object.assign(this.dom.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    // Short landscape / tiny canvases: reflow primary controls into a real DOM rail beside the
    // canvas instead of shrinking them below usable touch sizes.
    const spaceRight = window.innerWidth - r.right;
    const rail = k < RAIL_SCALE_THRESHOLD && spaceRight >= RAIL_WIDTH_PX + 16;
    this.dom.classList.toggle('sd-rail', rail);
    this.dom.classList.toggle('sd-settings-open', rail && this.settingsOpenValue);
    const railActions = this.stageActions.filter((a) => a.rail).map((a) => `stage:${a.id}`);
    const railOrder = ['cta', ...railActions, 'settings', 'back'];
    const railH = 48; const railGap = 8;
    const railTop = Math.max(8, r.height / 2 - (railH * railOrder.length + railGap * (railOrder.length - 1)) / 2);
    for (const b of Object.values(this.domButtons)) {
      const rect = JSON.parse(b.dataset.rect || '{}') as { x: number; y: number; width: number; height: number };
      const idx = railOrder.indexOf(b.dataset.id || '');
      const inRail = rail && idx >= 0;
      b.classList.toggle('sd-railbtn', inRail);
      b.classList.toggle('sd-secondary', inRail && (b.dataset.id === 'settings' || b.dataset.id === 'back'));
      if (inRail) {
        Object.assign(b.style, { left: `${r.width + 16}px`, top: `${railTop + idx * (railH + railGap)}px`, width: `${RAIL_WIDTH_PX}px`, height: `${railH}px` });
        if (b.dataset.id === 'back') b.textContent = 'Back';
        if (b.dataset.id === 'settings') b.textContent = 'Settings';
        if (b.dataset.id?.startsWith('stage:')) b.textContent = b.getAttribute('aria-label');
      } else {
        Object.assign(b.style, { left: `${rect.x * k}px`, top: `${rect.y * k}px`, width: `${rect.width * k}px`, height: `${rect.height * k}px` });
      }
    }
    if (this.dialog) {
      if (rail) Object.assign(this.dialog.style, { left: `${r.width + 16}px`, top: '8px', width: `${RAIL_WIDTH_PX}px`, maxHeight: `${Math.max(120, window.innerHeight - 16 - r.top)}px` });
      else Object.assign(this.dialog.style, { left: `${28 * k}px`, top: `${150 * k}px`, width: `${334 * k}px`, maxHeight: '' });
    }
  }

  private updateDomTheme(): void {
    const t = this.tokens; const st = this.dom?.style;
    if (!st) return;
    st.setProperty('--sd-focus', t.focus); st.setProperty('--sd-cta', t.cta); st.setProperty('--sd-cta-text', t.ctaText);
    st.setProperty('--sd-surface', t.surfaceRaised); st.setProperty('--sd-text', t.text); st.setProperty('--sd-muted', t.muted); st.setProperty('--sd-line', t.line);
  }

  private onWindowKey(e: KeyboardEvent, type: 'down' | 'up'): void {
    if (type === 'down' && e.key === 'Escape' && this.settingsOpenValue) { this.closeSettings(); this.domButtons.settings?.focus(); return; }
    const target = e.target as HTMLElement | null;
    const onControl = !!target && (target.tagName === 'BUTTON' || target.tagName === 'INPUT' || target.tagName === 'SELECT');
    if (onControl || this.settingsOpenValue) return;
    if (type === 'down') AudioService.unlock();
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    this.opts.onKey?.({ code: e.code, type, repeat: e.repeat });
  }

  private openDomDialog(): void {
    if (!this.dom) return;
    const d = document.createElement('div');
    d.className = 'sd-dialog';
    d.setAttribute('role', 'dialog');
    d.setAttribute('aria-modal', 'true');
    d.setAttribute('aria-label', 'Settings. The round is paused.');
    this.dialog = d;
    this.dom.appendChild(d);
    this.syncDomDialog();
    this.layoutDom();
    (d.querySelector('input') as HTMLInputElement | null)?.focus();
  }

  private syncDomDialog(): void {
    const d = this.dialog; if (!d) return;
    // Rebuilding must not drop keyboard focus: remember which control had it.
    const focusables = [...d.querySelectorAll('input, button')];
    const focusedIndex = focusables.indexOf(document.activeElement as Element);
    d.innerHTML = '';
    for (const row of this.settingRows()) {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = Boolean(this.settings[row.key]);
      input.addEventListener('change', () => this.applySetting({ ...this.settings, [row.key]: input.checked }));
      label.append(input, ` ${row.label}`);
      d.appendChild(label);
    }
    for (const name of THEME_NAMES) {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'radio'; input.name = 'sd-theme'; input.checked = this.settings.theme === name;
      input.addEventListener('change', () => this.applySetting({ ...this.settings, theme: name }));
      label.append(input, ` Theme ${name}`);
      d.appendChild(label);
    }
    const close = document.createElement('button');
    close.type = 'button'; close.textContent = 'Close settings';
    close.style.position = 'static'; close.style.pointerEvents = 'auto';
    close.addEventListener('click', () => { this.closeSettings(); this.domButtons.settings?.focus(); });
    d.appendChild(close);
    if (focusedIndex >= 0) (d.querySelectorAll('input, button')[focusedIndex] as HTMLElement | undefined)?.focus();
  }

  private closeDomDialog(): void {
    this.dialog?.remove();
    this.dialog = null;
    this.layoutDom();
  }

  /** Test/diagnostic hook: the DOM root. */
  get domRoot(): HTMLDivElement | null { return this.dom; }
  /** Test/diagnostic hook: current stage actions. */
  get currentStageActions(): readonly StageAction[] { return this.stageActions; }
  /** Test/diagnostic: balance currently shown. */
  get shownBalance(): number { return this.balanceHundredths; }
}

export { css as tokenToCss };

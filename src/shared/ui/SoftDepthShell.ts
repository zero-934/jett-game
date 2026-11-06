/**
 * @file SoftDepthShell.ts
 * @purpose Reusable mobile-first game shell for the pilots (Jett, Flap Fortune, Shatter Step).
 *
 *          polish-004 hybrid ownership:
 *          - Phaser draws the playfield and the shell's panel surfaces (header/footer fills,
 *            stage frame, HUD scrim) at high density (RenderScaleController).
 *          - Native DOM draws ALL interface text and controls: header (back, title, demo balance,
 *            settings), round HUD, footer (stake, return, CTA, no-cash-value label), result
 *            card, pause message and the settings dialog. Text is laid out by the browser at
 *            the device's native density with the self-hosted Inter face, so it stays crisp at
 *            any canvas scale and supports long values/localisation.
 *          - Each control exists exactly once (a real <button>/<input>); there is no canvas twin.
 *
 *          Input isolation: gameplay pointers come only from the Phaser stage zone. DOM controls
 *          sit outside the stage (header/footer/rail) or over it only while modal (settings),
 *          so a CTA tap can never steer, flap or pick. Stage actions (panes, flap) remain canvas
 *          gameplay input; their DOM buttons are keyboard/screen-reader focus targets that only
 *          take pointer input when moved off-canvas into the landscape rail.
 * @author Agent 934
 * @date 2026-11-05 (polish-004 DOM shell: 2026-11-06)
 * @license Proprietary – available for licensing
 */
import * as Phaser from 'phaser';
import { SHELL, DEMO_CREDITS_LABEL, resolveTheme, hexToInt, THEME_NAMES, LAYOUT_STANDARD } from './SoftDepthTheme';
import type { SoftDepthTokens, ThemeName, ShellLayout } from './SoftDepthTheme';
import { loadSettings, saveSettings } from './DemoSettings';
import type { DemoSettings, SettingsStorage } from './DemoSettings';
import { AudioService } from '../audio/AudioService';
import { formatCredits } from '../sim/DemoLedger';
import { pointerToLogical } from '../render/RenderScale';
import { getActiveBrand, onBrandChange, applyBrandTokens, brandLocksAccent, brandRadius, brandFontStack, isSafeLogoUrl } from '../brand/Brand';
import type { BrandConfig } from '../brand/Brand';
import { getHost } from '../host/DemoHostAdapter';
import type { HostGameTarget } from '../host/DemoHostAdapter';

/** Font stack (Inter is self-hosted, see public/fonts/inter). */
export const SHELL_FONT = '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';

const DEPTH = { stageInput: 38, hudScrim: 4, panel: 41 } as const;
const RESULT_FADE_MS = 160;
const ICON_HIT = 66;
const HUD_DIM_ALPHA = 0.25;
/** Minimum interactive size in CSS px (WCAG 2.5.5 enhanced / platform guidance). */
export const MIN_TARGET_CSS_PX = 44;
/** Below this CSS scale the shell reflows its primary controls into a visible DOM rail. */
const RAIL_SCALE_THRESHOLD = 0.6;
const RAIL_WIDTH_PX = 176;
const STAGE_POINTERS = 2;
/** A click arriving this soon after a pointerdown activation on the same button is its echo. */
const CLICK_ECHO_MS = 700;

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
  /** Short form of rightLabel for the compact (narrow immersive) footer. */
  rightLabelShort?: string;
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
  /** Called after any settings or brand change (theme, motion, contrast...). */
  onSettingsChanged?: (settings: DemoSettings, tokens: SoftDepthTokens) => void;
  /** Called on blur/hidden so games can pause and clear held input. */
  onVisibilityLost?: (reason: 'hidden' | 'blur') => void;
  /** Override storage (tests). */
  storage?: SettingsStorage | null;
  /** Layout variant. Defaults to the standard art-spec layout. */
  layout?: ShellLayout;
}

type Rect = { x: number; y: number; width: number; height: number };

function css(hex: string, alpha = 1): string {
  const n = hexToInt(hex);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

const ICON_BACK = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_GEAR = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></g></svg>';

/** Font sizes: [logical px at k = 1, minimum CSS px]. */
const FONT = {
  title: [14, 12], cap: [11, 11], balance: [15, 13], phase: [11, 11], progress: [12, 11],
  stake: [19, 14], rightValue: [16, 13], cta: [14, 13], demo: [11, 11],
} as const;

const STYLE = `
.sd-shell{position:fixed;left:0;top:0;width:0;height:0;pointer-events:none;z-index:10;font-family:var(--sd-font);color:var(--sd-text);
  -webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:optimizeLegibility;font-kerning:normal;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}
.sd-shell *{box-sizing:border-box}
.sd-shell [data-rect]{position:absolute}
.sd-shell .sd-t{display:flex;align-items:center;white-space:nowrap;line-height:1.1;overflow:visible}
.sd-shell .sd-num{font-variant-numeric:tabular-nums lining-nums;font-feature-settings:"tnum" 1,"lnum" 1}
.sd-shell .sd-cap{font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--sd-muted)}
.sd-shell .sd-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
.sd-shell .sd-title{flex:1 1 auto;min-width:0;white-space:normal;line-height:1.15;font-weight:700;letter-spacing:.06em;text-transform:uppercase;flex-direction:column;align-items:flex-start;justify-content:center;gap:2px;font-size:max(${FONT.title[1]}px,calc(var(--k)*${FONT.title[0]}px))}
.sd-shell .sd-title .sd-wordmark{font-size:max(10px,calc(var(--k)*10px));font-weight:600;letter-spacing:.14em;color:var(--sd-accent)}
.sd-shell .sd-title img{height:max(12px,calc(var(--k)*14px));width:auto}
.sd-shell .sd-balance{flex:none;flex-direction:column;align-items:flex-end;justify-content:center;gap:3px}
.sd-shell .sd-foot{display:flex;justify-content:space-between;align-items:stretch;gap:12px}
.sd-shell .sd-col{display:flex;flex-direction:column;justify-content:space-between;min-width:0}
.sd-shell .sd-col-r{align-items:flex-end;text-align:right}
.sd-shell .sd-col .sd-t{display:block;overflow:hidden;text-overflow:ellipsis}
.sd-shell.sd-compact .sd-cap{letter-spacing:.05em}
.sd-shell.sd-footc .sd-foot .sd-col{flex-direction:row;align-items:baseline;justify-content:flex-start;gap:6px;white-space:nowrap}
.sd-shell.sd-footc .sd-foot .sd-col-r{justify-content:flex-end;flex:1 1 auto}
.sd-shell.sd-footc .sd-foot .sd-col .sd-t:not(.sd-cap){overflow:visible;flex:none}
.sd-shell.sd-footc .sd-foot .sd-col .sd-cap{min-width:0;flex:0 1 auto}
.sd-shell.sd-footc .sd-foot .sd-col:first-child{flex:none}
.sd-shell.sd-footc .sd-foot .sd-stake,.sd-shell.sd-footc .sd-foot .sd-rval{font-size:14px}
.sd-shell.sd-footc .sd-demo{line-height:12px}
.sd-shell.sd-compact .sd-title{letter-spacing:.03em}
.sd-shell .sd-progress span{white-space:normal;text-align:center;max-width:100%}
.sd-shell .sd-infopanel{position:absolute;pointer-events:none;display:flex;flex-direction:column;gap:14px;padding:14px;background:var(--sd-surface);border:1px solid var(--sd-line);border-radius:14px}
.sd-shell .sd-infopanel .sd-info{position:static!important;width:auto!important;height:auto!important}
.sd-shell .sd-infopanel .sd-hud .sd-t{position:static!important;width:auto!important;height:auto!important;justify-content:flex-start;text-shadow:none}
.sd-shell .sd-infopanel .sd-hud{display:flex;flex-direction:column;gap:4px}
.sd-shell .sd-infopanel .sd-mult{font-size:30px}
.sd-shell .sd-infopanel .sd-progress span{text-align:left}
.sd-shell .sd-infopanel .sd-head{flex-direction:column;align-items:flex-start;gap:12px}
.sd-shell .sd-infopanel .sd-balance{align-items:flex-start}
.sd-shell .sd-infopanel .sd-foot{flex-direction:column;gap:12px}
.sd-shell .sd-infopanel .sd-col-r{align-items:flex-start;text-align:left}
.sd-shell .sd-infopanel .sd-demo{justify-content:flex-start;white-space:normal;line-height:1.3}
.sd-shell .sd-infopanel .sd-title{font-size:15px}
.sd-shell .sd-infopanel .sd-stake{font-size:19px}
.sd-shell .sd-infopanel .sd-rval{font-size:16px}
.sd-shell .sd-infopanel .sd-balance .sd-val{font-size:16px}
.sd-shell .sd-balance .sd-cap{font-size:max(${FONT.cap[1]}px,calc(var(--k)*${FONT.cap[0]}px))}
.sd-shell .sd-balance .sd-val{font-weight:700;font-size:max(${FONT.balance[1]}px,calc(var(--k)*${FONT.balance[0]}px))}
.sd-shell .sd-hud{transition:opacity 120ms linear}
.sd-shell .sd-hud .sd-t{justify-content:center;text-shadow:0 1px 2px rgba(0,0,0,.45)}
.sd-shell .sd-phase{font-size:max(${FONT.phase[1]}px,calc(var(--k)*${FONT.phase[0]}px));font-weight:700}
.sd-shell .sd-mult{font-weight:800;letter-spacing:-.01em;font-size:max(22px,calc(var(--k)*var(--sd-mult-px)))}
.sd-shell .sd-progress{font-size:max(${FONT.progress[1]}px,calc(var(--k)*${FONT.progress[0]}px));font-weight:500}
.sd-shell .sd-flabel{font-size:max(${FONT.cap[1]}px,calc(var(--k)*${FONT.cap[0]}px));font-weight:700}
.sd-shell .sd-stake{font-weight:700;font-size:max(${FONT.stake[1]}px,calc(var(--k)*${FONT.stake[0]}px))}
.sd-shell .sd-rval{font-weight:700;font-size:max(${FONT.rightValue[1]}px,calc(var(--k)*${FONT.rightValue[0]}px))}
.sd-shell .sd-right{justify-content:flex-end}
.sd-shell .sd-demo{justify-content:center;font-size:max(${FONT.demo[1]}px,calc(var(--k)*${FONT.demo[0]}px));font-weight:600}
.sd-shell button{font:inherit;color:inherit;margin:0;padding:0;border:0;background:transparent;-webkit-appearance:none;appearance:none;touch-action:manipulation}
.sd-shell button:focus{outline:none}
.sd-shell button:focus-visible,.sd-shell input:focus-visible{outline:3px solid var(--sd-focus);outline-offset:2px}
.sd-shell .sd-icon{pointer-events:auto;display:flex;align-items:center;justify-content:center;color:var(--sd-text);border-radius:12px;cursor:pointer}
.sd-shell .sd-icon:active{background:rgba(255,255,255,.08)}
.sd-shell .sd-cta{pointer-events:auto;display:flex;align-items:center;justify-content:center;background:var(--sd-cta);color:var(--sd-cta-text);border-radius:var(--sd-radius);
  font-weight:700;letter-spacing:.08em;text-transform:uppercase;font-size:max(${FONT.cta[1]}px,calc(var(--k)*${FONT.cta[0]}px));cursor:pointer;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.22),0 1px 2px rgba(0,0,0,.35);transition:transform 60ms ease,filter 60ms ease}
.sd-shell .sd-cta:active:not(:disabled){transform:translateY(1px);filter:brightness(.92);box-shadow:inset 0 1px 2px rgba(0,0,0,.25)}
.sd-shell .sd-cta:disabled{background:var(--sd-surface-raised);color:var(--sd-muted);box-shadow:inset 0 0 0 1px var(--sd-line);cursor:not-allowed}
.sd-shell .sd-stagebtn{pointer-events:none;color:transparent;border-radius:10px;overflow:hidden}
.sd-shell .sd-result{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:max(4px,calc(var(--k)*6px));background:var(--sd-surface-raised-a);
  border:1px solid var(--sd-line);border-radius:14px;box-shadow:0 8px 24px rgba(0,0,0,.35);transition:opacity ${RESULT_FADE_MS}ms ease-out}
.sd-shell .sd-result .r-title{font-weight:700;letter-spacing:.12em;text-transform:uppercase;font-size:max(12px,calc(var(--k)*12px))}
.sd-shell .sd-result .r-amount{font-weight:800;font-size:max(28px,calc(var(--k)*36px));letter-spacing:-.01em;line-height:1}
.sd-shell .sd-result .r-cap{font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--sd-muted);font-size:11px}
.sd-shell .sd-result .r-net{font-size:max(12px,calc(var(--k)*13px));font-weight:500}
.sd-shell .sd-pause{display:flex;align-items:center;justify-content:center;text-align:center;white-space:pre-line;background:var(--sd-bg-a72);font-weight:700;
  font-size:max(14px,calc(var(--k)*15px));line-height:1.4;border-radius:14px}
.sd-shell .sd-live{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.sd-shell [hidden]{display:none!important}
.sd-shell .sd-backdrop{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:auto;background:var(--sd-bg-a60)}
.sd-shell .sd-dialog{position:absolute;pointer-events:auto;background:var(--sd-surface-raised);color:var(--sd-text);border:1px solid var(--sd-line);border-radius:14px;
  padding:14px 16px 16px;overflow:auto;-webkit-overflow-scrolling:touch;box-shadow:0 12px 32px rgba(0,0,0,.45);font-size:15px}
.sd-shell .sd-dialog h2{margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--sd-muted)}
.sd-shell .sd-dialog p{margin:0 0 6px;font-size:13px;line-height:1.35;color:var(--sd-text)}
.sd-shell .sd-dialog label.sd-row{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:${MIN_TARGET_CSS_PX}px;padding:2px 0;cursor:pointer;font-size:15px;font-weight:500}
.sd-shell .sd-dialog input.sd-switch{-webkit-appearance:none;appearance:none;flex:0 0 auto;width:46px;height:28px;border-radius:14px;margin:0;background:var(--sd-line);position:relative;cursor:pointer;transition:background 120ms}
.sd-shell .sd-dialog input.sd-switch::after{content:"";position:absolute;left:4px;top:4px;width:20px;height:20px;border-radius:50%;background:var(--sd-muted);transition:transform 120ms,background 120ms}
.sd-shell .sd-dialog input.sd-switch:checked{background:var(--sd-accent)}
.sd-shell .sd-dialog input.sd-switch:checked::after{transform:translateX(18px);background:var(--sd-cta-text)}
.sd-shell .sd-dialog fieldset{border:0;margin:4px 0 0;padding:0;display:flex;align-items:center;justify-content:space-between;min-height:${MIN_TARGET_CSS_PX}px;flex-wrap:wrap}
.sd-shell .sd-dialog legend{float:left;font-size:15px;font-weight:500;padding:0}
.sd-shell .sd-dialog .sd-swatches{display:flex;gap:4px}
.sd-shell .sd-dialog label.sd-swatch{width:${MIN_TARGET_CSS_PX}px;height:${MIN_TARGET_CSS_PX}px;display:flex;align-items:center;justify-content:center;cursor:pointer;border-radius:50%}
.sd-shell .sd-dialog label.sd-swatch input{-webkit-appearance:none;appearance:none;margin:0;width:24px;height:24px;border-radius:50%;background:var(--sw);cursor:pointer;transition:box-shadow 100ms}
.sd-shell .sd-dialog label.sd-swatch input:checked{box-shadow:0 0 0 3px var(--sd-surface-raised),0 0 0 5px var(--sd-text)}
.sd-shell .sd-dialog .sd-vh{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.sd-shell .sd-dialog button.sd-close{display:flex;align-items:center;justify-content:center;width:100%;min-height:48px;margin-top:10px;background:var(--sd-cta);color:var(--sd-cta-text);
  border-radius:var(--sd-radius);font-weight:700;letter-spacing:.08em;text-transform:uppercase;font-size:14px;cursor:pointer}
.sd-shell .sd-dialog button.sd-close:active{filter:brightness(.92);transform:translateY(1px)}
.sd-shell button.sd-railbtn{pointer-events:auto;display:flex;align-items:center;justify-content:center;color:var(--sd-cta-text);background:var(--sd-cta);font-weight:700;font-size:15px;line-height:1.2;
  border-radius:var(--sd-radius);padding:0 12px;letter-spacing:.04em}
.sd-shell button.sd-railbtn.sd-secondary{background:var(--sd-surface-raised);color:var(--sd-text);box-shadow:inset 0 0 0 1px var(--sd-line)}
.sd-shell button.sd-railbtn:disabled{background:var(--sd-surface-raised);color:var(--sd-muted)}
.sd-shell.sd-settings-open button.sd-railbtn{display:none}
`;

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
  brand: BrandConfig;

  private readonly opts: ShellOptions;
  private chrome: Phaser.GameObjects.Graphics;
  private hudScrim: Phaser.GameObjects.Graphics | null = null;
  private stageZone: Phaser.GameObjects.Zone;
  private footer: FooterState | null = null;
  private hud: HudState | null = null;
  private balanceHundredths = 0;
  private settingsOpenValue = false;
  private destroyed = false;
  private stageActions: StageAction[] = [];
  private stageHandlers = new Map<string, () => void>();
  private hudDimmed = false;
  private hudBoxes: Rect[] | null = null;
  private k = 1;
  private compactFooter = false;
  private lastPointerActivation: { id: string; t: number } | null = null;
  private offBrand: (() => void) | null = null;
  private hostTarget: HostGameTarget | null = null;

  // DOM
  private dom: HTMLDivElement | null = null;
  private el: Record<string, HTMLElement> = {};
  private domButtons: Record<string, HTMLButtonElement> = {};
  private live: HTMLDivElement | null = null;
  private dialog: HTMLDivElement | null = null;
  private backdrop: HTMLDivElement | null = null;
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
    this.brand = getActiveBrand();
    this.tokens = this.resolveTokens();
    AudioService.setEnabled(this.settings.sound);

    scene.input.addPointer(STAGE_POINTERS - 1);
    this.chrome = scene.add.graphics().setDepth(DEPTH.panel);
    this.hudScrim = this.layout.hudOverlay ? scene.add.graphics().setDepth(DEPTH.hudScrim) : null;
    this.stageZone = scene.add.zone(this.stage.x, this.stage.y, this.stage.width, this.stage.height).setOrigin(0).setDepth(DEPTH.stageInput).setInteractive();
    this.wireStageZone();
    this.buildDom();
    this.redrawChrome();
    this.offBrand = onBrandChange((b) => { this.brand = b; this.applyTokens(); });
    // Host lifecycle: pause/settings commands reach the running game through its shell. A host
    // "resume" never auto-resumes a live round: the player taps to continue (no hidden danger).
    this.hostTarget = {
      pause: () => this.opts.onVisibilityLost?.('hidden'),
      resume: () => { /* player-initiated resume only */ },
      openSettings: () => this.openSettings(),
      closeSettings: () => this.closeSettings(),
    };
    getHost().setTarget(this.hostTarget);

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
    this.setText('balance', formatCredits(hundredths));
  }

  /**
   * Updates the round HUD. Only changed nodes are written.
   * @param hud - HUD state.
   * @returns void
   */
  setHud(hud: HudState): void {
    const prev = this.hud;
    this.hud = hud;
    if (!prev || prev.phaseLabel !== hud.phaseLabel) { this.setText('phase', hud.phaseLabel.toUpperCase()); this.hudBoxes = null; }
    if (!prev || prev.multiplier !== hud.multiplier) { this.setText('multiplier', hud.multiplier); this.hudBoxes = null; }
    if (!prev || prev.progress !== hud.progress) { this.setText('progress', hud.progress); this.hudBoxes = null; }
    if (!prev || prev.tone !== hud.tone) { const m = this.el.multiplier; if (m) m.style.color = this.toneColor(hud.tone); }
  }

  /**
   * Updates the footer. Only changed nodes/attributes are written.
   * @param f - Footer state.
   * @returns void
   */
  setFooter(f: FooterState): void {
    this.footer = f;
    this.setText('stake', formatCredits(f.stakeHundredths));
    this.setText('rightLabel', (this.compactFooter && f.rightLabelShort ? f.rightLabelShort : f.rightLabel).toUpperCase());
    // Compact footer: the unit word is implied by the header's DEMO CREDITS; values never truncate.
    this.setText('rightValue', this.compactFooter ? f.rightValue.replace(/ credits$/, '') : f.rightValue);
    this.setText('stakeLabel', this.compactFooter ? 'STAKE' : 'DEMO STAKE');
    const b = this.domButtons.cta;
    if (b) {
      if (b.textContent !== f.ctaLabel) b.textContent = f.ctaLabel;
      const aria = f.ctaAria ?? f.ctaLabel;
      if (b.getAttribute('aria-label') !== aria) b.setAttribute('aria-label', aria);
      if (b.disabled !== !f.ctaEnabled) b.disabled = !f.ctaEnabled;
    }
  }

  /**
   * Shows the frozen authoritative result in a card over the stage.
   * @param r - Result content.
   * @returns void
   */
  showResult(r: ResultState): void {
    const t = this.tokens;
    const net = r.returnHundredths - r.stakeHundredths;
    const netText = `Net ${net > 0 ? '+' : net < 0 ? '−' : '±'}${formatCredits(Math.abs(net))} · stake ${formatCredits(r.stakeHundredths)}`;
    const card = this.el.result;
    if (card) {
      const [title, amount, cap, netLine] = Array.from(card.children) as HTMLElement[];
      title.textContent = r.title.toUpperCase();
      title.style.color = r.tone === 'success' ? t.success : r.tone === 'loss' ? t.loss : t.text;
      amount.textContent = formatCredits(r.returnHundredths);
      cap.textContent = 'Demo credits returned';
      netLine.textContent = netText;
      // Only an actual net win is styled as success (a return below the stake is a net loss).
      netLine.style.color = net > 0 ? t.success : t.text;
      card.hidden = false;
      card.style.opacity = this.settings.reducedMotion ? '1' : '0';
      if (!this.settings.reducedMotion) requestAnimationFrame(() => requestAnimationFrame(() => { if (!card.hidden) card.style.opacity = '1'; }));
    }
    this.announce(`${r.title}. ${formatCredits(r.returnHundredths)} demo credits returned. ${netText}.`);
  }

  /** Removes the result card. */
  hideResult(): void {
    if (this.el.result) this.el.result.hidden = true;
  }

  /** @returns Whether the result card is showing. */
  get resultShown(): boolean { return !!this.el.result && !this.el.result.hidden; }

  /**
   * Shows or hides the paused message over the stage (pointer-transparent: a tap on the
   * stage below resumes, exactly as before).
   * @param message - Message, or null to hide.
   * @returns void
   */
  setPaused(message: string | null): void {
    const p = this.el.pause; if (!p) return;
    if (!message) { p.hidden = true; return; }
    p.textContent = message;
    p.hidden = false;
    this.announce(message.replace(/\n/g, ' '));
  }

  /**
   * Registers focusable stage actions (e.g. Shatter panes, Flap "flap").
   * @param actions - Current actions (replaces previous).
   * @returns void
   */
  setStageActions(actions: StageAction[]): void {
    const same = actions.length === this.stageActions.length && actions.every((a, i) => {
      const b = this.stageActions[i];
      return !!b && a.id === b.id && a.label === b.label && a.enabled === b.enabled && a.rail === b.rail && JSON.stringify(a.rect) === JSON.stringify(b.rect);
    });
    this.stageActions = actions;
    this.stageHandlers = new Map(actions.map((a) => [`stage:${a.id}`, a.onActivate]));
    if (!this.dom || same) return; // unchanged nodes keep their focus
    for (const [id, b] of Object.entries(this.domButtons)) if (id.startsWith('stage:')) { b.remove(); delete this.domButtons[id]; }
    for (const a of actions) {
      const id = `stage:${a.id}`;
      const b = this.makeButton(id, a.label, a.rect, 'sd-stagebtn', () => this.stageHandlers.get(id)?.(), { pointerActivate: true });
      b.textContent = a.label;
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
    const boxes = this.hudTextBoxes();
    const hit = hazards.some((z) => boxes.some((b) => z.x < b.x + b.width && b.x < z.x + z.w && z.y < b.y + b.height && b.y < z.y + z.h));
    if (hit !== this.hudDimmed && this.el.hud) { this.hudDimmed = hit; this.el.hud.style.opacity = hit ? String(HUD_DIM_ALPHA) : '1'; }
    return hit;
  }

  /** @returns Logical bounds of the visible HUD glyph runs (cached until text/layout changes). */
  hudTextBoxes(): Rect[] {
    if (this.hudBoxes) return this.hudBoxes;
    const root = this.dom; const out: Rect[] = [];
    if (root && this.k > 0) {
      const rr = root.getBoundingClientRect();
      for (const n of ['phase', 'multiplier', 'progress']) {
        const span = this.el[n]?.firstElementChild as HTMLElement | null;
        if (!span || !span.textContent) continue;
        const r = span.getBoundingClientRect();
        out.push({ x: (r.left - rr.left) / this.k, y: (r.top - rr.top) / this.k, width: r.width / this.k, height: r.height / this.k });
      }
    }
    this.hudBoxes = out;
    return out;
  }

  /** @returns Whether the HUD is dimmed by an obstruction. */
  get hudIsDimmed(): boolean { return this.hudDimmed; }

  /** Destroys DOM and listeners. Idempotent; called automatically on scene shutdown. */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.offBrand?.(); this.offBrand = null;
    if (this.hostTarget) { getHost().setTarget(null); this.hostTarget = null; }
    for (const [target, type, fn] of this.listeners) target.removeEventListener(type, fn);
    this.listeners.length = 0;
    this.scene.scale.off(Phaser.Scale.Events.RESIZE, this.layoutDom, this);
    this.dom?.remove();
    this.dom = null;
    this.domButtons = {};
    this.el = {};
  }

  // ─── Tokens / chrome ──────────────────────────────────────────────────────

  private resolveTokens(): SoftDepthTokens {
    return applyBrandTokens(resolveTheme(this.settings.theme, this.settings.highContrast), this.brand);
  }

  private applyTokens(): void {
    this.tokens = this.resolveTokens();
    this.redrawChrome();
    this.syncBrandHeader();
    if (this.settingsOpenValue) this.syncDomDialog();
    this.opts.onSettingsChanged?.(this.settings, this.tokens);
  }

  private toneColor(tone: HudState['tone']): string {
    const t = this.tokens;
    return tone === 'accent' ? t.accent : tone === 'success' ? t.success : tone === 'loss' ? t.loss : t.muted;
  }

  /** Repaints Phaser panel surfaces and the DOM colour variables. */
  private redrawChrome(): void {
    const t = this.tokens; const g = this.chrome; const s = this.stage; const W = SHELL.width; const H = SHELL.height;
    g.clear();
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
      const sc = this.hudScrim; sc.clear();
      const bg = hexToInt(t.background);
      sc.fillGradientStyle(bg, bg, bg, bg, 0.62, 0.62, 0, 0).fillRect(s.x, s.y, s.width, 84);
    }
    const r = s.radius;
    g.fillStyle(hexToInt(t.background), 1);
    for (const [cx, cy, sx, sy] of [[s.x, s.y, 1, 1], [s.x + s.width, s.y, -1, 1], [s.x, s.y + s.height, 1, -1], [s.x + s.width, s.y + s.height, -1, -1]] as const) {
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + sx * r, cy);
      for (let i = 0; i <= 12; i++) {
        const a = (Math.PI / 2) * (i / 12);
        g.lineTo(cx + sx * (r - r * Math.sin(a)), cy + sy * (r - r * Math.cos(a)));
      }
      g.closePath();
      g.fillPath();
    }
    g.lineStyle(1, hexToInt(t.line), 1).strokeRoundedRect(s.x, s.y, s.width, s.height, r);
    this.updateDomTheme();
  }

  private wireStageZone(): void {
    const toStagePointer = (p: Phaser.Input.Pointer): StagePointer => {
      // pointer.x/y are backing-store px; map through the camera to logical px.
      const w = pointerToLogical(this.scene, p);
      return { id: p.id, x: w.x, y: w.y, stageX: w.x - this.stage.x, stageY: w.y - this.stage.y };
    };
    this.stageZone.on('pointerdown', (p: Phaser.Input.Pointer) => { AudioService.unlock(); if (!this.settingsOpenValue) this.opts.onStageDown?.(toStagePointer(p)); });
    this.stageZone.on('pointermove', (p: Phaser.Input.Pointer) => { if (!this.settingsOpenValue && p.isDown) this.opts.onStageMove?.(toStagePointer(p)); });
    this.stageZone.on('pointerup', (p: Phaser.Input.Pointer) => this.opts.onStageUp?.(toStagePointer(p)));
    this.stageZone.on('pointerout', (p: Phaser.Input.Pointer) => this.opts.onStageUp?.(toStagePointer(p)));
  }

  // ─── Settings ─────────────────────────────────────────────────────────────

  private toggleSettings(): void {
    if (this.settingsOpenValue) this.closeSettings(); else this.openSettings();
  }

  private openSettings(): void {
    if (this.settingsOpenValue) return;
    this.settingsOpenValue = true;
    this.opts.onSettingsOpen?.(true);
    this.openDomDialog();
    getHost().notify({ type: 'settingsOpened', payload: {} });
  }

  private closeSettings(): void {
    if (!this.settingsOpenValue) return;
    this.settingsOpenValue = false;
    this.closeDomDialog();
    this.opts.onSettingsOpen?.(false);
    getHost().notify({ type: 'settingsClosed', payload: {} });
  }

  /**
   * Opens or closes settings programmatically (host "open settings" callback).
   * @param open - Desired state.
   * @returns void
   */
  setSettingsOpen(open: boolean): void { if (open) this.openSettings(); else this.closeSettings(); }

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
    this.applyTokens();
  }

  // ─── DOM ──────────────────────────────────────────────────────────────────

  private listen(target: EventTarget, type: string, fn: EventListener): void {
    target.addEventListener(type, fn);
    this.listeners.push([target, type, fn]);
  }

  /** A positioned text box whose first child <span> holds the (diffed) text. */
  private node(id: string, cls: string, rect: Rect, parent?: HTMLElement): HTMLDivElement {
    const d = document.createElement('div');
    d.className = `sd-t ${cls}`;
    d.dataset.rect = JSON.stringify(rect);
    d.dataset.uiText = id;
    d.appendChild(document.createElement('span'));
    (parent ?? this.dom)?.appendChild(d);
    this.el[id] = d;
    return d;
  }

  private setText(id: string, value: string): void {
    const host = this.el[id];
    const span = (host?.querySelector('[data-v]') ?? host?.firstElementChild) as HTMLElement | null | undefined;
    if (span && span.textContent !== value) span.textContent = value;
  }

  private buildDom(): void {
    if (typeof document === 'undefined') return;
    const W = SHELL.width; const L = this.layout; const S = this.stage;
    const root = document.createElement('div');
    // `sd-a11y` kept for continuity with polish-003 tests/tools.
    root.className = 'sd-a11y sd-shell';
    root.setAttribute('data-shell', this.opts.title);
    const style = document.createElement('style');
    style.textContent = STYLE;
    root.appendChild(style);
    this.dom = root;
    document.body.appendChild(root);

    // Header: title and balance share one flex row between the two icon buttons, so long
    // titles wrap/ellipsize instead of colliding with the balance on narrow phones.
    const head = document.createElement('div');
    head.className = 'sd-head sd-info'; head.dataset.rect = JSON.stringify({ x: 56, y: 0, width: W - 56 - ICON_HIT, height: SHELL.headerBottom });
    root.appendChild(head);
    const title = this.node('title', 'sd-title', { x: 0, y: 0, width: 0, height: 0 }, head);
    delete title.dataset.rect;
    title.firstElementChild!.textContent = this.opts.title.toUpperCase();
    const wm = document.createElement('span'); wm.className = 'sd-wordmark'; title.insertBefore(wm, title.firstChild); this.el.wordmark = wm;
    const bal = document.createElement('div');
    bal.className = 'sd-t sd-balance';
    bal.dataset.uiText = 'balance';
    const balCap = document.createElement('span'); balCap.className = 'sd-cap'; balCap.textContent = 'Demo credits';
    const balVal = document.createElement('span'); balVal.className = 'sd-val sd-num'; balVal.dataset.v = '1'; balVal.textContent = '0.00';
    bal.append(balCap, balVal); head.appendChild(bal); this.el.balance = bal;
    this.makeButton('back', 'Back to lobby', { x: 0, y: 0, width: ICON_HIT, height: ICON_HIT }, 'sd-icon', () => { if (!this.settingsOpenValue) this.opts.onBack(); }).innerHTML = ICON_BACK;
    this.makeButton('settings', 'Settings', { x: W - ICON_HIT, y: 0, width: ICON_HIT, height: ICON_HIT }, 'sd-icon', () => this.toggleSettings()).innerHTML = ICON_GEAR;
    this.domButtons.settings.setAttribute('aria-haspopup', 'dialog');

    // HUD (over or above the stage)
    const hud = document.createElement('div');
    hud.className = 'sd-hud sd-info'; root.appendChild(hud); this.el.hud = hud;
    root.style.setProperty('--sd-mult-px', `${L.multiplierPx}px`);
    this.node('phase', 'sd-phase sd-cap', { x: S.x, y: L.hudY.phase - 10, width: S.width, height: 20 }, hud);
    this.node('multiplier', 'sd-mult sd-num', { x: S.x, y: L.hudY.multiplier - L.multiplierPx * 0.62, width: S.width, height: L.multiplierPx * 1.24 }, hud);
    this.node('progress', 'sd-progress', { x: S.x, y: L.hudY.progress - 10, width: S.width, height: 20 }, hud);

    // Footer: two flex columns (stake | return) so labels never overlap on narrow phones.
    const foot = document.createElement('div');
    foot.className = 'sd-foot sd-info'; foot.dataset.rect = JSON.stringify({ x: 22, y: L.footerLabelY - 9, width: W - 44, height: L.footerValueY + 12 - (L.footerLabelY - 9) });
    root.appendChild(foot);
    const colL = document.createElement('div'); colL.className = 'sd-col';
    const colR = document.createElement('div'); colR.className = 'sd-col sd-col-r';
    foot.append(colL, colR);
    const unrect = (d: HTMLElement) => { delete d.dataset.rect; return d; };
    unrect(this.node('stakeLabel', 'sd-flabel sd-cap', { x: 0, y: 0, width: 0, height: 0 }, colL)).firstElementChild!.textContent = 'Demo stake';
    unrect(this.node('stake', 'sd-stake sd-num', { x: 0, y: 0, width: 0, height: 0 }, colL));
    unrect(this.node('rightLabel', 'sd-flabel sd-cap sd-right', { x: 0, y: 0, width: 0, height: 0 }, colR));
    unrect(this.node('rightValue', 'sd-rval sd-num sd-right', { x: 0, y: 0, width: 0, height: 0 }, colR));
    const demo = this.node('demo', 'sd-demo sd-cap sd-info', { x: 0, y: L.demoLabelY - 8, width: W, height: 16 });
    demo.firstElementChild!.textContent = DEMO_CREDITS_LABEL;
    // Landscape rail: the info blocks move (not copy) into a panel left of the canvas.
    const info = document.createElement('div'); info.className = 'sd-infopanel'; info.hidden = true; root.appendChild(info); this.el.infopanel = info;
    this.makeButton('cta', 'Start', L.cta, 'sd-cta', () => { AudioService.unlock(); if (this.footer?.ctaEnabled && !this.settingsOpenValue) this.opts.onPrimary(); }, { pointerActivate: true });

    // Result card and pause message (pointer-transparent)
    const card = document.createElement('div');
    card.className = 'sd-result'; card.hidden = true;
    card.dataset.rect = JSON.stringify({ x: S.x + (S.width - 300) / 2, y: S.y + S.height * 0.36 - 84, width: 300, height: 168 });
    for (const c of ['r-title', 'r-amount sd-num', 'r-cap', 'r-net sd-num']) { const d = document.createElement('div'); d.className = c; card.appendChild(d); }
    root.appendChild(card); this.el.result = card;
    const pause = document.createElement('div');
    pause.className = 'sd-pause'; pause.hidden = true; pause.dataset.rect = JSON.stringify({ x: S.x, y: S.y, width: S.width, height: S.height });
    root.appendChild(pause); this.el.pause = pause;

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
    this.listen(window, 'blur', () => { this.opts.onVisibilityLost?.('blur'); getHost().notify({ type: 'paused', payload: { reason: 'blur' } }); });
    this.listen(document, 'visibilitychange', () => { if (document.hidden) { this.opts.onVisibilityLost?.('hidden'); getHost().notify({ type: 'paused', payload: { reason: 'hidden' } }); } });
    if (document.fonts) this.listen(document.fonts, 'loadingdone', () => { this.hudBoxes = null; });
    this.syncBrandHeader();
    this.layoutDom();
    this.updateDomTheme();
  }

  private syncBrandHeader(): void {
    const wm = this.el.wordmark; if (!wm) return;
    wm.textContent = '';
    const b = this.brand;
    if (b.logoUrl && isSafeLogoUrl(b.logoUrl)) {
      const img = document.createElement('img');
      img.alt = b.wordmark; img.decoding = 'async'; img.referrerPolicy = 'no-referrer';
      img.src = b.logoUrl;
      wm.appendChild(img);
    } else {
      wm.textContent = b.wordmark;
    }
    wm.hidden = !b.wordmark && !b.logoUrl;
  }

  /**
   * Creates one authoritative DOM control. Pointer activation (CTA, rail picks) fires on
   * pointerdown for responsiveness and its trailing click echo is ignored; keyboard/AT
   * activation arrives as a click with no preceding pointerdown.
   */
  private makeButton(id: string, label: string, rect: Rect, cls: string, fn: () => void, o: { pointerActivate?: boolean } = {}): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = cls;
    b.setAttribute('aria-label', label);
    b.dataset.rect = JSON.stringify(rect);
    b.dataset.id = id;
    if (o.pointerActivate) {
      b.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || b.disabled) return;
        if (b.classList.contains('sd-stagebtn') && !b.classList.contains('sd-railbtn')) return; // focus target only
        e.preventDefault();
        this.lastPointerActivation = { id, t: performance.now() };
        fn();
      });
    }
    b.addEventListener('click', (e) => {
      e.preventDefault();
      const lp = this.lastPointerActivation;
      if (lp && lp.id === id && performance.now() - lp.t < CLICK_ECHO_MS) { this.lastPointerActivation = null; return; }
      fn();
    });
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
    this.k = k;
    this.hudBoxes = null;
    Object.assign(this.dom.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    this.dom.style.setProperty('--k', String(k));
    const spaceRight = window.innerWidth - r.right;
    const rail = k < RAIL_SCALE_THRESHOLD && spaceRight >= RAIL_WIDTH_PX + 16 && r.left >= RAIL_WIDTH_PX + 16;
    this.dom.classList.toggle('sd-rail', rail);
    this.dom.classList.toggle('sd-compact', k < 0.8);
    // Narrow immersive layout: the footer band is too short for label rows + a 44 px CTA, so
    // labels go inline with their values (and use short labels) — sizes never drop below minimums.
    const compactFooter = k < 0.8 && this.layout.hudOverlay && !rail;
    if (compactFooter !== this.compactFooter) { this.compactFooter = compactFooter; if (this.footer) this.setFooter(this.footer); }
    this.dom.classList.toggle('sd-footc', compactFooter);
    const panel = this.el.infopanel;
    if (panel) {
      const infos = Array.from(this.dom.querySelectorAll<HTMLElement>('.sd-info'));
      const order = ['sd-head', 'sd-hud', 'sd-foot', 'sd-demo'];
      infos.sort((a, b) => order.findIndex((c) => a.classList.contains(c)) - order.findIndex((c) => b.classList.contains(c)));
      for (const n of infos) {
        if (rail && n.parentElement !== panel) panel.appendChild(n);
        if (!rail && n.parentElement === panel) this.dom.insertBefore(n, panel);
      }
      panel.hidden = !rail;
      if (rail) Object.assign(panel.style, { left: `${-RAIL_WIDTH_PX - 16}px`, top: '8px', width: `${RAIL_WIDTH_PX}px`, maxHeight: `${r.height - 16}px` });
    }
    this.dom.classList.toggle('sd-settings-open', rail && this.settingsOpenValue);
    const railActions = this.stageActions.filter((a) => a.rail).map((a) => `stage:${a.id}`);
    const railOrder = ['cta', ...railActions, 'settings', 'back'];
    const railH = 48; const railGap = 8;
    const railTop = Math.max(8, r.height / 2 - (railH * railOrder.length + railGap * (railOrder.length - 1)) / 2);
    for (const el of Array.from(this.dom.querySelectorAll<HTMLElement>('[data-rect]'))) {
      const rect = JSON.parse(el.dataset.rect || '{}') as Rect;
      const id = el.dataset.id || '';
      const idx = el instanceof HTMLButtonElement ? railOrder.indexOf(id) : -1;
      const inRail = rail && idx >= 0;
      if (el instanceof HTMLButtonElement) {
        el.classList.toggle('sd-railbtn', inRail);
        el.classList.toggle('sd-secondary', inRail && (id === 'settings' || id === 'back'));
        if (id === 'back' || id === 'settings') {
          // Icon in the header; labelled text in the rail.
          const wantText = inRail ? (id === 'back' ? 'Back' : 'Settings') : null;
          if (wantText && el.textContent !== wantText) el.textContent = wantText;
          if (!wantText && !el.querySelector('svg')) el.innerHTML = id === 'back' ? ICON_BACK : ICON_GEAR;
        }
      }
      if (panel && panel.contains(el)) continue;
      if (inRail) {
        Object.assign(el.style, { left: `${r.width + 16}px`, top: `${railTop + idx * (railH + railGap)}px`, width: `${RAIL_WIDTH_PX}px`, height: `${railH}px` });
        continue;
      }
      let top = rect.y * k; let height = rect.height * k;
      if (el.classList.contains('sd-cta') && height < MIN_TARGET_CSS_PX) { top -= (MIN_TARGET_CSS_PX - height) / 2; height = MIN_TARGET_CSS_PX; }
      Object.assign(el.style, { left: `${rect.x * k}px`, top: `${top}px`, width: `${rect.width * k}px`, height: `${height}px` });
    }
    if (this.compactFooter) {
      const foot = this.dom.querySelector<HTMLElement>('.sd-foot'); const cta = this.domButtons.cta; const demo = this.el.demo;
      const demoH = 12; const ctaH = MIN_TARGET_CSS_PX; const rowH = 18;
      const demoTop = r.height - demoH - 1; const ctaTop = demoTop - 1 - ctaH; const rowTop = ctaTop - 2 - rowH;
      if (demo) Object.assign(demo.style, { top: `${demoTop}px`, height: `${demoH}px` });
      if (cta) Object.assign(cta.style, { top: `${ctaTop}px`, height: `${ctaH}px` });
      if (foot) Object.assign(foot.style, { top: `${rowTop}px`, height: `${rowH}px` });
    }
    if (this.dialog) {
      if (rail) Object.assign(this.dialog.style, { left: `${r.width + 16}px`, top: '8px', width: `${RAIL_WIDTH_PX}px`, maxHeight: `${Math.max(120, window.innerHeight - 16 - r.top)}px` });
      else {
        const side = Math.max(12, 28 * k);
        const top = Math.max(12, Math.min(150 * k, r.height * 0.16));
        Object.assign(this.dialog.style, { left: `${side}px`, top: `${top}px`, width: `${r.width - side * 2}px`, maxHeight: `${r.height - top - 12}px` });
      }
    }
  }

  private updateDomTheme(): void {
    const t = this.tokens; const st = this.dom?.style;
    if (!st) return;
    const set = (k: string, v: string) => st.setProperty(k, v);
    set('--sd-focus', t.focus); set('--sd-cta', t.cta); set('--sd-cta-text', t.ctaText); set('--sd-accent', t.accent);
    set('--sd-surface', t.surface); set('--sd-surface-raised', t.surfaceRaised); set('--sd-surface-raised-a', css(t.surfaceRaised, 0.97));
    set('--sd-text', t.text); set('--sd-muted', t.muted); set('--sd-line', t.line);
    set('--sd-bg-a72', css(t.background, 0.72)); set('--sd-bg-a60', css(t.background, 0.6));
    set('--sd-radius', `calc(var(--k) * ${brandRadius(this.brand)}px)`);
    set('--sd-font', brandFontStack(this.brand));
    if (this.hud && this.el.multiplier) this.el.multiplier.style.color = this.toneColor(this.hud.tone);
  }

  private onWindowKey(e: KeyboardEvent, type: 'down' | 'up'): void {
    if (type === 'down' && e.key === 'Escape' && this.settingsOpenValue) { this.closeSettings(); this.domButtons.settings?.focus(); return; }
    if (type === 'down' && e.key === 'Tab' && this.settingsOpenValue && this.dialog) { this.trapFocus(e); return; }
    const target = e.target as HTMLElement | null;
    const onControl = !!target && (target.tagName === 'BUTTON' || target.tagName === 'INPUT' || target.tagName === 'SELECT');
    if (onControl || this.settingsOpenValue) return;
    if (type === 'down') AudioService.unlock();
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    this.opts.onKey?.({ code: e.code, type, repeat: e.repeat });
  }

  private trapFocus(e: KeyboardEvent): void {
    const f = Array.from(this.dialog?.querySelectorAll<HTMLElement>('input, button') ?? []);
    if (!f.length) return;
    const i = f.indexOf(document.activeElement as HTMLElement);
    const next = e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : (i < 0 || i >= f.length - 1 ? 0 : i + 1);
    e.preventDefault();
    f[next].focus();
  }

  private openDomDialog(): void {
    if (!this.dom) return;
    const bd = document.createElement('div');
    bd.className = 'sd-backdrop';
    // The backdrop swallows pointers so nothing reaches the canvas while settings are open.
    bd.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); });
    this.backdrop = bd;
    this.dom.appendChild(bd);
    const d = document.createElement('div');
    d.className = 'sd-dialog';
    d.setAttribute('role', 'dialog');
    d.setAttribute('aria-modal', 'true');
    d.setAttribute('aria-label', 'Settings. The round is paused.');
    this.dialog = d;
    this.dom.appendChild(d);
    this.syncDomDialog();
    this.layoutDom();
    (d.querySelector('input') as HTMLInputElement | null)?.focus({ preventScroll: true });
  }

  private syncDomDialog(): void {
    const d = this.dialog; if (!d) return;
    const focusables = [...d.querySelectorAll('input, button')];
    const focusedIndex = focusables.indexOf(document.activeElement as Element);
    const scroll = d.scrollTop;
    d.textContent = '';
    const h = document.createElement('h2'); h.textContent = 'Settings';
    const p = document.createElement('p'); p.textContent = 'The round is paused while settings are open.';
    d.append(h, p);
    for (const row of this.settingRows()) {
      const label = document.createElement('label');
      label.className = 'sd-row';
      const text = document.createElement('span'); text.textContent = row.label;
      const input = document.createElement('input');
      input.type = 'checkbox'; input.className = 'sd-switch'; input.setAttribute('role', 'switch');
      input.checked = Boolean(this.settings[row.key]);
      input.addEventListener('change', () => this.applySetting({ ...this.settings, [row.key]: input.checked }));
      label.append(text, input);
      d.appendChild(label);
    }
    if (!brandLocksAccent(this.brand)) {
      const fs = document.createElement('fieldset');
      const lg = document.createElement('legend'); lg.textContent = 'Theme';
      const sw = document.createElement('div'); sw.className = 'sd-swatches';
      for (const name of THEME_NAMES) {
        const label = document.createElement('label');
        label.className = 'sd-swatch';
        const input = document.createElement('input');
        input.type = 'radio'; input.name = 'sd-theme'; input.checked = this.settings.theme === name;
        input.style.setProperty('--sw', resolveTheme(name).accent);
        input.addEventListener('change', () => this.applySetting({ ...this.settings, theme: name as ThemeName }));
        const vh = document.createElement('span'); vh.className = 'sd-vh'; vh.textContent = `Theme ${name}`;
        label.append(input, vh);
        sw.appendChild(label);
      }
      fs.append(lg, sw);
      d.appendChild(fs);
    }
    const close = document.createElement('button');
    close.type = 'button'; close.className = 'sd-close'; close.textContent = 'Close';
    close.setAttribute('aria-label', 'Close settings');
    close.addEventListener('click', () => { this.closeSettings(); this.domButtons.settings?.focus({ preventScroll: true }); });
    d.appendChild(close);
    d.scrollTop = scroll;
    if (focusedIndex >= 0) (d.querySelectorAll('input, button')[focusedIndex] as HTMLElement | undefined)?.focus({ preventScroll: true });
  }

  private closeDomDialog(): void {
    this.dialog?.remove();
    this.dialog = null;
    this.backdrop?.remove();
    this.backdrop = null;
    this.layoutDom();
  }

  /** Test/diagnostic hook: the DOM root. */
  get domRoot(): HTMLDivElement | null { return this.dom; }
  /** Test/diagnostic hook: current stage actions. */
  get currentStageActions(): readonly StageAction[] { return this.stageActions; }
  /** Test/diagnostic: balance currently shown. */
  get shownBalance(): number { return this.balanceHundredths; }
  /** Test/diagnostic: current CSS px per logical px. */
  get cssScale(): number { return this.k; }
}

export { css as tokenToCss };

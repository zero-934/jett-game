/**
 * @file InfernoScene.ts
 * @purpose Wires InfernoLogic (authoritative outcomes + session ledger) to InfernoUI (presentation)
 *          and the Inferno soundboard. Owns RNG lifetime, input routing, settings persistence and
 *          scene lifecycle cleanup. Contains no game maths.
 * @author Agent 934
 * @date 2026-04-16 (rewritten for inferno-polish-001 on 2026-11-05)
 * @license Proprietary – available for licensing
 */

import * as Phaser from 'phaser';
import {
  createInfernoSession, beginInfernoSpin, finishInfernoPresentation, crownFlipAction, crownCollectAction,
  setInfernoStake, isNextSpinFree, selectInfernoOutcomeCue, toMilliCredits, formatCredits,
} from '../games/InfernoLogic';
import type { InfernoSession, InfernoSettlement, InfernoSymbol, InfernoConfig, InfernoSpinScript } from '../games/InfernoLogic';
import { InfernoUI, INFERNO_TIMING } from '../games/InfernoUI';
import type { InfernoSettings, InfernoPresentationHooks } from '../games/InfernoUI';
import { ProvablyFairRNG, createRNG } from '../shared/rng/ProvablyFairRNG';
import { INFERNO_ASSETS } from '../shared/assetConfig';

// --- Constants ---
const SCENE_KEY = 'InfernoScene';
const INITIAL_BALANCE = 1000;
const DEFAULT_BET = 10;
const BET_OPTIONS = [1, 5, 10, 25, 50];
const SETTINGS_STORAGE_KEY = 'jett.inferno.settings.v1';
const LOBBY_URL = 'https://zero-934.github.io/jett-landing/';
const SESSION_SEED_BYTES = 8;
/** Display-only idle board (never evaluated, contains no 3-cluster). */
const IDLE_BOARD: InfernoSymbol[][] = [
  ['FLAME', 'COAL', 'EMBER'],
  ['SMOKE', 'WILD', 'ASH'],
  ['COAL', 'SCATTER', 'FLAME'],
];
const DEFAULT_SETTINGS: InfernoSettings = { music: 1, sfx: 2, reducedMotion: false, quickSpin: false };
const MUSIC_VOLUME = [0, 0.18, 0.32, 0.5];
const SFX_VOLUME = [0, 0.3, 0.55, 0.85];
const MAX_SFX_VOICES = 6;
const DUCK_LEVEL = 0.35;
const DUCK_MS = 900;
const DUCK_FADE_MS = 160;

type CueKey = 'click' | 'reel-stop-1' | 'reel-stop-2' | 'reel-stop-3' | 'cluster-pop' | 'cascade-land' | 'heat-tick'
  | 'feature-granted' | 'crown-flip' | 'crown-win' | 'crown-loss' | 'result-profit' | 'result-neutral';

/**
 * Inferno soundboard: uses Phaser's single sound manager (no extra AudioContext), caps polyphony,
 * ducks music under the profit motif, and starts music only after Phaser's gesture unlock.
 */
class InfernoSoundboard {
  private readonly scene: Phaser.Scene;
  private music: Phaser.Sound.BaseSound | null = null;
  private voices: Phaser.Sound.BaseSound[] = [];
  private musicLevel = 0;
  private sfxLevel = 0;
  private destroyed = false;
  private duckTimer: Phaser.Time.TimerEvent | null = null;
  private readonly onUnlocked = (): void => this.syncMusic();

  constructor(scene: Phaser.Scene, settings: InfernoSettings) {
    this.scene = scene;
    this.musicLevel = settings.music;
    this.sfxLevel = settings.sfx;
    if (scene.cache.audio.exists('inferno-forge-loop')) {
      this.music = scene.sound.add('inferno-forge-loop', { loop: true, volume: MUSIC_VOLUME[this.musicLevel] ?? 0 });
    }
    if (scene.sound.locked) scene.sound.once(Phaser.Sound.Events.UNLOCKED, this.onUnlocked);
    else this.syncMusic();
  }

  setLevels(music: number, sfx: number): void {
    this.musicLevel = music;
    this.sfxLevel = sfx;
    this.syncMusic();
  }

  private musicVolume(): number { return MUSIC_VOLUME[this.musicLevel] ?? 0; }

  private syncMusic(): void {
    if (this.destroyed || !this.music) return;
    const vol = this.musicVolume();
    const sound = this.music as Phaser.Sound.WebAudioSound;
    if (typeof sound.setVolume === 'function') sound.setVolume(vol);
    if (vol <= 0) { if (this.music.isPlaying) this.music.pause(); return; }
    if (this.scene.sound.locked) return; // waits for the first valid gesture
    if (this.music.isPaused) this.music.resume();
    else if (!this.music.isPlaying) this.music.play();
  }

  play(cue: CueKey): void {
    if (this.destroyed || this.sfxLevel <= 0) return;
    const key = `inferno-${cue}`;
    if (!this.scene.cache.audio.exists(key) || this.scene.sound.locked) return;
    while (this.voices.length >= MAX_SFX_VOICES) { const old = this.voices.shift(); old?.stop(); old?.destroy(); }
    const voice = this.scene.sound.add(key, { volume: SFX_VOLUME[this.sfxLevel] ?? 0 });
    voice.once(Phaser.Sound.Events.COMPLETE, () => { this.voices = this.voices.filter((v) => v !== voice); voice.destroy(); });
    this.voices.push(voice);
    voice.play();
    if (cue === 'result-profit') this.duck();
  }

  private duck(): void {
    if (!this.music || this.musicVolume() <= 0) return;
    const sound = this.music as Phaser.Sound.WebAudioSound;
    this.scene.tweens.add({ targets: sound, volume: this.musicVolume() * DUCK_LEVEL, duration: DUCK_FADE_MS });
    this.duckTimer?.remove(false);
    this.duckTimer = this.scene.time.delayedCall(DUCK_MS, () => {
      if (!this.destroyed) this.scene.tweens.add({ targets: sound, volume: this.musicVolume(), duration: DUCK_FADE_MS * 2 });
    });
  }

  /** Active SFX voices (harness diagnostics). */
  voiceCount(): number { return this.voices.length; }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scene.sound.off(Phaser.Sound.Events.UNLOCKED, this.onUnlocked);
    this.duckTimer?.remove(false);
    this.voices.forEach((v) => { v.stop(); v.destroy(); });
    this.voices = [];
    this.music?.stop();
    this.music?.destroy();
    this.music = null;
  }
}

export class InfernoScene extends Phaser.Scene {
  protected session!: InfernoSession;
  protected ui!: InfernoUI;
  protected sound_!: InfernoSoundboard;
  protected settings: InfernoSettings = { ...DEFAULT_SETTINGS };
  protected sessionSeed = '';
  protected roundRng: ProvablyFairRNG | null = null;
  protected sceneDestroyed = false;
  private freeSpinTimer: Phaser.Time.TimerEvent | null = null;
  /** True while a Crown flip reveal is animating; further Crown actions are ignored until it ends. */
  private crownBusy = false;
  private readonly onSpaceKey = (event: KeyboardEvent): void => {
    if (event.repeat) return; // held Space never queues extra spins
    this.handleSpinPress();
  };

  /**
   * Constructor for InfernoScene.
   * @example
   * new InfernoScene();
   */
  constructor(key: string = SCENE_KEY) {
    super({ key });
  }

  /**
   * Loads Inferno audio (paths from the shared asset registry).
   * @example
   * // Called automatically by Phaser.
   */
  preload(): void {
    this.load.setPath(import.meta.env.BASE_URL);
    Object.entries(INFERNO_ASSETS.audio).forEach(([key, urls]) => {
      if (!this.cache.audio.exists(key)) this.load.audio(key, [...urls]);
    });
  }

  /**
   * Phaser's create lifecycle method. Builds session, UI, audio and input.
   * @example
   * // Called automatically by Phaser when the scene starts.
   */
  create(): void {
    this.sceneDestroyed = false;
    this.crownBusy = false;
    this.freeSpinTimer = null;
    this.roundRng = null;
    this.settings = this.loadSettings();
    this.sessionSeed = this.createSessionSeed();
    this.session = createInfernoSession(INITIAL_BALANCE, DEFAULT_BET);

    this.ui = new InfernoUI(this, {
      onSpin: () => this.handleSpinPress(),
      onStake: (stake) => this.handleStake(stake),
      onCollect: (roundId) => this.handleCollect(roundId),
      onFlip: (roundId) => this.handleFlip(roundId),
      onSettingsChanged: (s) => this.handleSettings(s),
      onResetCredits: () => this.handleResetCredits(),
      onHome: () => this.goHome(),
    }, this.settings);
    this.ui.build(IDLE_BOARD, BET_OPTIONS, DEFAULT_BET);
    this.ui.setBalance(this.session.balanceMilli);
    this.ui.setHeat(this.session.state.heatMeter, false);
    this.ui.setReadout('ROUND RETURN', 0, null);
    this.ui.setSpinButton('SPIN', true);
    this.sound_ = new InfernoSoundboard(this, this.settings);

    this.input.keyboard?.on('keydown-SPACE', this.onSpaceKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdownScene, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.shutdownScene, this);
  }

  // ─── Overridable hooks (developer harness subclasses these; production never does) ─────

  /**
   * Session seed for per-round RNG streams. Uses the browser CSPRNG for seeding only; gameplay
   * randomness still comes from ProvablyFairRNG. Not a server-verifiable fairness protocol.
   * @returns Hex seed string.
   */
  protected createSessionSeed(): string {
    const bytes = new Uint8Array(SESSION_SEED_BYTES);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Gameplay config for a round. One fresh RNG per round (`<sessionSeed>:r<roundId>`), used for the
   * spin and any Crown flips of that round. Bounded RNG lifetime also avoids the shared generator's
   * unmasked state growth over long sessions.
   * @param roundId Round about to start.
   * @returns Config passed to InfernoLogic.
   */
  protected createRoundConfig(roundId: number): InfernoConfig {
    this.roundRng = createRNG(`${this.sessionSeed}:r${roundId}`);
    return { rng: this.roundRng };
  }

  /**
   * Starts a round through the ledger. The harness may override to inject developer fixtures.
   * @returns Ledger result.
   */
  protected beginRound(): ReturnType<typeof beginInfernoSpin> {
    return beginInfernoSpin(this.session, this.createRoundConfig(this.session.roundId + 1));
  }

  // ─── Round flow ──────────────────────────────────────────────────────────────────────

  private handleSpinPress(): void {
    if (this.sceneDestroyed || this.ui.isModalOpen()) return;
    if (this.session.phase === 'presenting') { this.ui.requestSkip(); return; }
    if (this.session.phase !== 'ready') return;
    this.freeSpinTimer?.remove(false);
    this.freeSpinTimer = null;
    const free = isNextSpinFree(this.session);
    const res = this.beginRound();
    if (res.rejected === 'INSUFFICIENT_BALANCE') {
      this.ui.setStatus('Not enough demo credits for this stake. Choose a lower stake or reset credits in Settings.', 'neutral');
      return;
    }
    if (res.rejected || !res.script) return;
    this.session = res.session;
    this.startPresentation(res.script, free);
  }

  private startPresentation(script: InfernoSpinScript, free: boolean): void {
    const roundId = this.session.roundId;
    const cycle = this.session.cycle;
    this.sound_.play('click');
    this.ui.lockControls(true);
    this.ui.setStake(cycle?.stake ?? this.session.selectedStake, true);
    this.ui.setBalance(this.session.balanceMilli);
    this.ui.setSpinButton(free ? 'FREE SPIN · TAP TO SPEED UP' : 'TAP TO SPEED UP', true);
    this.ui.setReadout(free ? 'RETURN SO FAR' : 'ROUND RETURN', cycle?.returnedMilli ?? 0, null);
    if (!script.isInfernoSpin) this.ui.setStatus(free ? `Free spin · stake ${formatCredits(toMilliCredits(script.stake))} (no charge)` : 'Spinning…', 'neutral');
    const base = cycle?.returnedMilli ?? 0;
    const hooks: InfernoPresentationHooks = {
      onReelStop: (col) => this.sound_.play((['reel-stop-1', 'reel-stop-2', 'reel-stop-3'] as const)[col] ?? 'reel-stop-1'),
      onClusters: () => undefined,
      onRemove: (step) => {
        this.sound_.play('cluster-pop');
        // provisional: not settled yet (Crown / free spins may follow)
        this.ui.setReadout(free ? 'RETURN SO FAR' : 'ROUND RETURN', base + toMilliCredits(step.totalWinAfter), null, false);
      },
      onLand: () => this.sound_.play('cascade-land'),
      onHeat: (level, previous) => { if (level > previous) this.sound_.play('heat-tick'); },
      onFeature: (kind, amount) => {
        this.sound_.play('feature-granted');
        if (kind === 'free-spins') this.ui.setStatus(`3 SCATTER · ${amount} free spins awarded at this stake`, 'heat');
      },
    };
    this.ui.playScript(script, hooks, () => this.onPresentationDone(roundId, script));
  }

  private onPresentationDone(roundId: number, script: InfernoSpinScript): void {
    if (this.sceneDestroyed || roundId !== this.session.roundId) return;
    const res = finishInfernoPresentation(this.session, roundId, true);
    if (res.rejected) return;
    this.session = res.session;
    this.ui.endPresentationSpeed();
    if (this.session.phase === 'decision') {
      const atRisk = toMilliCredits(this.session.state.crownFlipWin);
      this.ui.setReadout('AT RISK', atRisk, null);
      this.ui.setStatus('Optional Crown Flip — collect to keep it', 'neutral');
      this.ui.setSpinButton('DECIDE ABOVE', false);
      this.ui.showCrown(roundId, atRisk, this.session.state.crownFlipChain);
      return;
    }
    if (res.settlement) this.applySettlement(res.settlement, script.isInfernoSpin && script.totalWin === 0 ? 'All-WILD board: no paying cluster' : undefined);
  }

  private handleFlip(roundId: number): void {
    if (this.sceneDestroyed || this.crownBusy) return;
    const res = crownFlipAction(this.session, roundId, { rng: this.roundRng ?? undefined });
    if (res.rejected) return;
    this.session = res.session;
    this.crownBusy = true;
    this.sound_.play('crown-flip');
    const won = !res.settlement;
    const amount = won ? toMilliCredits(this.session.state.crownFlipWin) : 0;
    this.ui.revealCrownFlip(won, amount, () => this.sound_.play(won ? 'crown-win' : 'crown-loss'), () => {
      this.crownBusy = false;
      if (this.sceneDestroyed || roundId !== this.session.roundId) return;
      if (won && this.session.phase === 'decision') {
        this.ui.setReadout('AT RISK', amount, null);
        this.ui.showCrown(roundId, amount, this.session.state.crownFlipChain);
      } else if (!won) {
        this.ui.hideCrown();
        if (res.settlement) this.applySettlement(res.settlement, 'Crown lost · this spin returns 0');
      }
    });
  }

  private handleCollect(roundId: number): void {
    if (this.sceneDestroyed || this.crownBusy) return;
    const res = crownCollectAction(this.session, roundId);
    if (res.rejected || !res.settlement) return;
    this.session = res.session;
    this.ui.hideCrown();
    this.applySettlement(res.settlement);
  }

  private applySettlement(st: InfernoSettlement, note?: string): void {
    this.ui.setBalance(this.session.balanceMilli);
    const cue = selectInfernoOutcomeCue(st);
    if (cue === 'profit') this.sound_.play('result-profit');
    else if (cue === 'neutral' && st.cycleReturnedMilli > 0) this.sound_.play('result-neutral');

    if (!st.cycleComplete) {
      const left = this.session.state.freeSpinsRemaining;
      this.ui.setReadout('RETURN SO FAR', st.cycleReturnedMilli, null);
      this.ui.setStatus(`${note ? `${note} · ` : ''}${left} free spin${left === 1 ? '' : 's'} left · no charge`, 'heat');
      this.ui.setSpinButton(`FREE SPIN · ${left} LEFT`, true);
      this.ui.lockControls(true);
      const roundId = this.session.roundId;
      this.freeSpinTimer = this.time.delayedCall(INFERNO_TIMING.freeSpinGap, () => {
        this.freeSpinTimer = null;
        if (!this.sceneDestroyed && this.session.roundId === roundId && this.session.phase === 'ready') this.handleSpinPress();
      });
      return;
    }
    const net = st.cycleReturnedMilli - st.cyclePaidMilli;
    this.ui.setReadout('ROUND RETURN', st.cycleReturnedMilli, net, false);
    const ret = formatCredits(st.cycleReturnedMilli);
    const paid = formatCredits(st.cyclePaidMilli);
    const text = st.cycleOutcome === 'profit' ? `Returned ${ret} for a ${paid} stake`
      : st.cycleOutcome === 'break-even' ? `Returned ${ret} — equal to the stake`
      : st.cycleOutcome === 'partial' ? `Returned ${ret} of a ${paid} stake`
      : 'No return this round';
    this.ui.setStatus(note ? `${note} · ${text}` : text, st.cycleOutcome === 'profit' ? 'positive' : 'neutral');
    this.ui.lockControls(false);
    this.ui.setStake(this.session.selectedStake, false);
    this.ui.setSpinButton(this.session.state.heatMeter >= 5 ? 'SPIN · INFERNO SPIN' : 'SPIN', true);
  }

  // ─── Controls ────────────────────────────────────────────────────────────────────────

  private handleStake(stake: number): void {
    const res = setInfernoStake(this.session, stake);
    if (res.rejected) return;
    this.session = res.session;
    this.ui.setStake(stake, false);
  }

  private handleResetCredits(): void {
    if (this.session.phase !== 'ready' || this.session.cycle) return;
    this.session = createInfernoSession(INITIAL_BALANCE, this.session.selectedStake);
    this.ui.setBalance(this.session.balanceMilli);
    this.ui.setHeat(0, false);
    this.ui.setReadout('ROUND RETURN', 0, null);
    this.ui.setStatus('Demo credits reset', 'neutral');
    this.ui.closeSettings();
  }

  private handleSettings(settings: InfernoSettings): void {
    this.settings = settings;
    this.sound_.setLevels(settings.music, settings.sfx);
    try { globalThis.localStorage?.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings)); } catch { /* storage unavailable */ }
  }

  private loadSettings(): InfernoSettings {
    let reduced = DEFAULT_SETTINGS.reducedMotion;
    try { reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? reduced; } catch { /* no matchMedia */ }
    const fallback = { ...DEFAULT_SETTINGS, reducedMotion: reduced };
    try {
      const raw = globalThis.localStorage?.getItem(SETTINGS_STORAGE_KEY);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw) as Partial<InfernoSettings>;
      const level = (v: unknown, d: number) => (typeof v === 'number' && v >= 0 && v <= 3 ? Math.floor(v) : d);
      return {
        music: level(parsed.music, fallback.music),
        sfx: level(parsed.sfx, fallback.sfx),
        reducedMotion: typeof parsed.reducedMotion === 'boolean' ? parsed.reducedMotion : fallback.reducedMotion,
        quickSpin: typeof parsed.quickSpin === 'boolean' ? parsed.quickSpin : fallback.quickSpin,
      };
    } catch {
      return fallback;
    }
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────────────

  private shutdownScene(): void {
    if (this.sceneDestroyed) return;
    this.sceneDestroyed = true;
    this.freeSpinTimer?.remove(false);
    this.freeSpinTimer = null;
    this.input.keyboard?.off('keydown-SPACE', this.onSpaceKey);
    this.events.off(Phaser.Scenes.Events.SHUTDOWN, this.shutdownScene, this);
    this.events.off(Phaser.Scenes.Events.DESTROY, this.shutdownScene, this);
    this.ui?.destroy();
    this.sound_?.destroy();
    this.roundRng = null;
  }

  /**
   * Navigates back to the lobby.
   * @example
   * this.goHome(); // Called when the back button is pressed.
   */
  private goHome(): void {
    window.location.href = LOBBY_URL;
  }
}

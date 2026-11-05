/**
 * @file harness-main.ts
 * @purpose RESEARCH HARNESS ONLY — never imported by production. Boots the production InfernoScene
 *          through a thin subclass that can (a) fix the session seed, (b) inject clearly labelled
 *          developer fixtures through a fixture RNG (the production Logic path still runs), and
 *          (c) expose counters (AudioContexts, tweens, timers, particles, listeners, frame times).
 *          Query: ?seed=abc&fixture=cascade,crown&fps=60&timeout=1&renderer=canvas&reduced=1&quick=1
 * @author Agent 934
 * @date 2026-11-05
 * @license Proprietary – available for licensing
 */
import * as Phaser from 'phaser';
import { InfernoScene } from '../../../src/scenes/InfernoScene';
import { ProvablyFairRNG } from '../../../src/shared/rng/ProvablyFairRNG';
import type { InfernoConfig, InfernoSymbol } from '../../../src/games/InfernoLogic';

type Counters = { audioContextsCreated: number; audioContextsClosed: number };
const counters: Counters = { audioContextsCreated: 0, audioContextsClosed: 0 };
const NativeAC = window.AudioContext;
if (NativeAC) {
  class CountingAC extends NativeAC {
    constructor(opts?: AudioContextOptions) { super(opts); counters.audioContextsCreated++; }
    close(): Promise<void> { counters.audioContextsClosed++; return super.close(); }
  }
  (window as unknown as Record<string, unknown>).AudioContext = CountingAC;
}

const params = new URLSearchParams(window.location.search);
const fixedSeed = params.get('seed');
const skipFlag = params.get('skip') === '1'; void skipFlag;
const fixtureQueue = (params.get('fixture') ?? '').split(',').filter(Boolean);
if (params.get('reduced') || params.get('quick') || params.get('music') || params.get('sfx')) {
  try {
    localStorage.setItem('jett.inferno.settings.v1', JSON.stringify({
      music: Number(params.get('music') ?? 1), sfx: Number(params.get('sfx') ?? 2),
      reducedMotion: params.get('reduced') === '1', quickSpin: params.get('quick') === '1',
    }));
  } catch { /* ignore */ }
}

/** Fixture RNG: serves queued symbols / random values first, then a seeded stream. DEV ONLY. */
class FixtureRNG extends ProvablyFairRNG {
  private symbols: InfernoSymbol[];
  private randoms: number[];
  constructor(seed: string, symbols: InfernoSymbol[], randoms: number[]) { super(seed); this.symbols = symbols.slice(); this.randoms = randoms.slice(); }
  public weightedChoice<T>(items: { value: T; weight: number }[]): T {
    if (this.symbols.length) return this.symbols.shift() as unknown as T;
    const total = items.reduce((a, i) => a + i.weight, 0);
    let r = ProvablyFairRNG.prototype.random.call(this) * total;
    for (const it of items) { if (r < it.weight) return it.value; r -= it.weight; }
    return items[items.length - 1].value;
  }
  public random(): number { return this.randoms.length ? (this.randoms.shift() as number) : super.random(); }
}

/** Developer fixtures: landed board (row-major) + refill symbols + crown random values. */
const FIXTURES: Record<string, { heat?: number; symbols: InfernoSymbol[]; randoms?: number[]; note: string }> = {
  // 4-EMBER L-cluster → refill builds a 3-FLAME cluster → second cascade → no further cluster
  cascade: { note: 'cascade chain', symbols: [
    'EMBER', 'EMBER', 'SMOKE',
    'EMBER', 'COAL', 'FLAME',
    'EMBER', 'ASH', 'FLAME',
    // refill 1 (cascadeInferno order: col0 top→bottom, then col1)
    'FLAME', 'FLAME', 'COAL', 'FLAME',
    // refill 2
    'SMOKE', 'ASH', 'EMBER'] },
  // 3 scatters + a paying cluster (legacy rule: award after the cascade)
  scatter: { note: 'scatter award', symbols: [
    'SCATTER', 'COAL', 'SCATTER',
    'ASH', 'COAL', 'SMOKE',
    'FLAME', 'COAL', 'SCATTER',
    'SMOKE', 'ASH', 'FLAME' ] },
  // single win then Crown decision; first flip wins (0.1), second loses (0.9)
  crown: { note: 'crown decision', randoms: [0.1, 0.9], symbols: [
    'FLAME', 'FLAME', 'FLAME',
    'SMOKE', 'COAL', 'ASH',
    'ASH', 'SMOKE', 'COAL',
    'COAL', 'ASH', 'SMOKE' ] },
  // heat 4 + one cascade → heat full (next spin is the natural all-WILD Inferno Spin)
  heat: { note: 'heat to full', heat: 4, symbols: [
    'ASH', 'ASH', 'ASH',
    'SMOKE', 'COAL', 'FLAME',
    'COAL', 'SMOKE', 'EMBER',
    'FLAME', 'SMOKE', 'COAL' ] },
  // no cluster at all
  loss: { note: 'no cluster', symbols: ['FLAME', 'COAL', 'EMBER', 'SMOKE', 'ASH', 'FLAME', 'COAL', 'SCATTER', 'SMOKE'] },
  // three scatters, no cluster (documents the unresolved legacy rule: no award)
  'scatter-no-cluster': { note: 'scatter without cluster', symbols: ['SCATTER', 'EMBER', 'FLAME', 'ASH', 'SCATTER', 'COAL', 'FLAME', 'SMOKE', 'SCATTER'] },
};

class HarnessInfernoScene extends InfernoScene {
  public fixtureLabel: Phaser.GameObjects.Text | null = null;
  public lastFixture = '';
  constructor() { super('InfernoScene'); }
  create(): void { this.fixtureLabel = null; super.create(); }
  protected createSessionSeed(): string { return fixedSeed ?? super.createSessionSeed(); }
  protected createRoundConfig(roundId: number): InfernoConfig {
    const name = fixtureQueue.length ? fixtureQueue.shift() as string : '';
    const fx = name ? FIXTURES[name] : undefined;
    this.lastFixture = fx ? name : '';
    if (fx) {
      if (fx.heat !== undefined) this.session = { ...this.session, state: { ...this.session.state, heatMeter: fx.heat } };
      this.roundRng = new FixtureRNG(`${this.sessionSeed}:fixture:${roundId}`, fx.symbols, fx.randoms ?? []);
      this.showFixtureLabel(`DEV FIXTURE · ${fx.note}`);
      return { rng: this.roundRng };
    }
    this.showFixtureLabel('');
    return super.createRoundConfig(roundId);
  }
  private showFixtureLabel(text: string): void {
    if (!this.fixtureLabel) this.fixtureLabel = this.add.text(195, 69, '', { fontFamily: 'monospace', fontSize: '10px', color: '#ff5c5c', backgroundColor: '#000000' }).setOrigin(0.5, 0).setDepth(1000);
    this.fixtureLabel.setText(text).setVisible(text.length > 0);
  }
  public debug(): Record<string, unknown> {
    const ui = this.ui as unknown as { getResourceCounts(): Record<string, number>; getPhase(): string };
    return {
      phase: this.session.phase, uiPhase: ui.getPhase(), roundId: this.session.roundId, balanceMilli: this.session.balanceMilli,
      heat: this.session.state.heatMeter, freeSpins: this.session.state.freeSpinsRemaining, debits: this.session.debitCount, credits: this.session.creditCount,
      cycle: this.session.cycle, lastCycle: this.session.lastCycle, ledger: this.session.ledger.slice(-6), grid: this.session.state.grid.map((r) => r.map((c) => c.symbol)),
      resources: ui.getResourceCounts(), displayList: this.children.length, timeEvents: (this.time as unknown as { _active: unknown[] })._active?.length ?? null,
      voices: (this.sound_ as unknown as { voiceCount(): number }).voiceCount(), soundCount: (this.sound as unknown as { sounds: unknown[] }).sounds.length,
      keyboardListeners: this.input.keyboard?.listenerCount('keydown-SPACE') ?? 0, soundLocked: this.sound.locked,
      audioState: (this.sound as unknown as { context?: AudioContext }).context?.state ?? 'n/a', fixture: this.lastFixture, settings: this.settings,
    };
  }
}

const fpsTarget = Number(params.get('fps') ?? '0');
const config: Phaser.Types.Core.GameConfig = {
  type: params.get('renderer') === 'canvas' ? Phaser.CANVAS : Phaser.AUTO,
  width: 390,
  height: 844,
  backgroundColor: '#000000',
  scene: [HarnessInfernoScene],
  parent: 'app',
  fps: fpsTarget > 0 ? { target: fpsTarget, forceSetTimeOut: params.get('timeout') === '1', limit: params.get('timeout') === '1' ? 0 : fpsTarget } : undefined,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
};

// frame-time sampler (rAF deltas)
const frames: number[] = [];
let last = performance.now();
const tick = (t: number) => { frames.push(t - last); last = t; if (frames.length > 20000) frames.shift(); requestAnimationFrame(tick); };
requestAnimationFrame(tick);

const game = new Phaser.Game(config);
const api = {
  game, Phaser, counters, frames,
  scene: () => game.scene.getScene('InfernoScene') as unknown as HarnessInfernoScene,
  debug: () => (game.scene.getScene('InfernoScene') as unknown as HarnessInfernoScene).debug(),
  queueFixture: (name: string) => fixtureQueue.push(name),
  resetFrames: () => { frames.length = 0; },
};
(window as unknown as Record<string, unknown>).__inferno = api;

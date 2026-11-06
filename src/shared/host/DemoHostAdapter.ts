/**
 * @file DemoHostAdapter.ts
 * @purpose Local demo implementation of GameHostAdapter. Standalone: notifications go to a
 *          bounded in-page trace (QA) and Back navigates to a validated lobby URL. Embedded in
 *          an allowlisted parent: notifications are posted to the EXACT parent origin and only
 *          schema-valid commands from that origin AND that window are accepted.
 *          Round notifications are derived from the existing DemoLedger (observer) — there is no
 *          second balance, and nothing a host sends can debit, credit or decide an outcome.
 * @author Agent 934
 * @date 2026-11-06
 * @license Proprietary – available for licensing
 */
import type { GameHostAdapter, HostCommand, HostEvent, LaunchContext, GameId } from './GameHostAdapter';
import { parseLaunch, InboundGate, envelope, isSafeOutbound, ROUND_PREFIX_TO_GAME } from './HostProtocol';
import { getPageLedger } from '../sim/DemoLedger';
import { BRANDS, setActiveBrand } from '../brand/Brand';

/** Default lobby when nothing valid is supplied (the existing production landing page). */
export const DEFAULT_LOBBY_URL = 'https://zero-934.github.io/jett-landing/';
/** External lobby origins a launch URL may name. */
export const LOBBY_ORIGIN_ALLOWLIST: readonly string[] = ['https://zero-934.github.io'];
/** Max trace entries kept for QA. */
const TRACE_LIMIT = 200;
/** Client build label. */
export const GAME_BUILD = 'polish-004';

/** What a running game exposes to host commands (registered by the shell). */
export interface HostGameTarget {
  pause(): void;
  resume(): void;
  openSettings(): void;
  closeSettings(): void;
}

/** Game details supplied by the scene when it is ready. */
export interface GameReadyInfo {
  sceneKey: LaunchContext['sceneKey'];
  mathVersion: number;
  configId: string;
}

/**
 * Demo host adapter. One per page (see {@link getHost}).
 * @example
 * const host = getHost(); host.gameReady({ sceneKey: 'JettScene', mathVersion: 2, configId: 'jett-prod-v1' });
 */
export class DemoHostAdapter implements GameHostAdapter {
  context: LaunchContext;
  /** Rejected launch parameter names (diagnostics only). */
  rejectedParams: string[] = [];
  private readonly win: Window;
  private seq = 0;
  private gate: InboundGate | null = null;
  private target: HostGameTarget | null = null;
  private readonly listeners = new Set<(c: HostCommand) => void>();
  private readonly trace: Array<{ dir: 'out' | 'in'; type: string; t: number }> = [];
  private readonly offLedger: () => void;
  private readonly onMessage = (ev: MessageEvent): void => this.receive(ev);
  private disposed = false;

  /**
   * @param win - Window (injected for tests).
   * @param hostAllowlist - Origins allowed to embed/command (exact). Defaults to same-origin only.
   */
  constructor(win: Window = window, hostAllowlist?: readonly string[]) {
    this.win = win;
    const allow = hostAllowlist ?? [win.location.origin];
    const framed = win.parent !== win;
    const parsed = parseLaunch(win.location.search, {
      sceneKey: sceneFromSearch(win.location.search), gameVersion: GAME_BUILD, mathVersion: 0, configId: 'unknown',
      ownOrigin: win.location.origin, hostAllowlist: allow, lobbyAllowlist: LOBBY_ORIGIN_ALLOWLIST, framed,
    });
    this.context = parsed.context;
    this.rejectedParams = parsed.rejected;
    if (this.context.brandId !== 'jett-default') setActiveBrand(BRANDS[this.context.brandId]);
    if (this.context.embedded && this.context.hostOrigin) {
      this.gate = new InboundGate(this.context.hostOrigin, win.parent);
      win.addEventListener('message', this.onMessage);
    }
    this.offLedger = getPageLedger().observe((e) => {
      const roundId = e.type === 'start' ? e.roundId : e.record.roundId;
      const gameId = ROUND_PREFIX_TO_GAME[roundId.split('-')[0]] as GameId | undefined;
      if (!gameId) return;
      if (e.type === 'start') this.notify({ type: 'roundStarted', payload: { roundId, gameId, stakeMinor: e.stakeHundredths } });
      else this.notify({ type: 'roundSettled', payload: { roundId, gameId, stakeMinor: e.record.stakeHundredths, returnMinor: e.record.returnHundredths, netMinor: e.record.netHundredths, reason: e.record.reason, resultRef: `demo-ledger:${roundId}`, balanceMinor: e.balanceHundredths } });
    });
  }

  /**
   * Called by a game scene once it is interactive.
   * @param info - Scene key, math version, config id.
   * @returns void
   */
  gameReady(info: GameReadyInfo): void {
    this.context = { ...this.context, sceneKey: info.sceneKey, gameId: sceneToGame(info.sceneKey), mathVersion: info.mathVersion, configId: info.configId };
    this.notify({ type: 'ready', payload: { gameId: this.context.gameId, gameVersion: this.context.gameVersion, mathVersion: info.mathVersion, protocolVersion: this.context.protocolVersion } });
  }

  /**
   * Registers the running game's command target (the shell does this).
   * @param t - Target, or null to clear.
   * @returns void
   */
  setTarget(t: HostGameTarget | null): void { this.target = t; }

  /** @inheritdoc */
  notify(event: HostEvent): void {
    if (this.disposed) return;
    if (!isSafeOutbound(event)) return; // defence in depth: never leak seeds/boards/tokens
    this.seq += 1;
    this.pushTrace('out', event.type);
    if (this.context.embedded && this.context.hostOrigin) this.win.parent.postMessage(envelope(this.seq, event), this.context.hostOrigin);
  }

  /** @inheritdoc */
  onCommand(fn: (cmd: HostCommand) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** @inheritdoc */
  requestLobby(): void {
    this.notify({ type: 'lobbyRequested', payload: {} });
    if (this.context.embedded) return; // the host decides navigation
    this.win.location.href = this.context.lobbyUrl ?? DEFAULT_LOBBY_URL;
  }

  /** @inheritdoc */
  dispose(): void {
    this.disposed = true;
    this.offLedger();
    this.win.removeEventListener('message', this.onMessage);
    this.listeners.clear();
  }

  /** @returns Bounded QA trace (types only — never payloads, tokens or session refs). */
  getTrace(): ReadonlyArray<{ dir: 'out' | 'in'; type: string; t: number }> { return this.trace; }

  /** @returns Rejection counters of the inbound gate. */
  getRejections(): Record<string, number> { return { ...(this.gate?.rejected ?? {}) }; }

  private receive(ev: MessageEvent): void {
    const cmd = this.gate?.accept({ origin: ev.origin, source: ev.source, data: ev.data }) ?? null;
    if (!cmd) return;
    this.pushTrace('in', cmd.type);
    this.dispatch(cmd);
  }

  /**
   * Applies a validated command (also used by tests/standalone QA).
   * @param cmd - Command.
   * @returns void
   */
  dispatch(cmd: HostCommand): void {
    const t = this.target;
    if (cmd.type === 'pause') t?.pause();
    else if (cmd.type === 'resume') t?.resume();
    else if (cmd.type === 'openSettings') t?.openSettings();
    else if (cmd.type === 'closeSettings') t?.closeSettings();
    else if (cmd.type === 'setBrand' && BRANDS[cmd.brandId]) setActiveBrand(BRANDS[cmd.brandId]);
    for (const fn of [...this.listeners]) fn(cmd);
  }

  private pushTrace(dir: 'out' | 'in', type: string): void {
    this.trace.push({ dir, type, t: Math.round(performance.now()) });
    if (this.trace.length > TRACE_LIMIT) this.trace.shift();
  }
}

function sceneFromSearch(search: string): LaunchContext['sceneKey'] {
  const s = new URLSearchParams(search).get('scene');
  return s === 'FlapFortuneScene' || s === 'ShatterStepScene' ? s : 'JettScene';
}

function sceneToGame(k: LaunchContext['sceneKey']): GameId {
  return k === 'FlapFortuneScene' ? 'flap-fortune' : k === 'ShatterStepScene' ? 'shatter-step' : 'jett';
}

let pageHost: DemoHostAdapter | null = null;

/**
 * The page's host adapter (created on first use from window.location).
 * @returns Adapter.
 * @example
 * getHost().requestLobby();
 */
export function getHost(): DemoHostAdapter {
  if (!pageHost) {
    pageHost = new DemoHostAdapter();
    (window as unknown as Record<string, unknown>).__host = pageHost;
  }
  return pageHost;
}

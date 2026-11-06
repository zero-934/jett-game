/**
 * @file GameHostAdapter.ts
 * @purpose Types only: the PRESENTATION-layer contract between a game page and whatever hosts it
 *          (a local demo page, or in future an operator/aggregator wrapper). It covers launch
 *          context, lifecycle, settings/lobby callbacks and round notifications.
 *
 *          It is NOT a provider/RGS contract: no wallet, debit/credit, signing, session tokens,
 *          transaction idempotency or reconciliation is modelled here. In a real-money
 *          integration those live server-side (provider backend/RGS ↔ operator/aggregator
 *          wallet APIs), and the browser only displays results the server already decided.
 *          See docs/polish-004/CASINO_INTEGRATION_READINESS.md.
 * @author Agent 934
 * @date 2026-11-06
 * @license Proprietary – available for licensing
 */

/** Protocol version of this message contract. */
export const HOST_PROTOCOL_VERSION = 1 as const;
/** Channel tag on every postMessage envelope (lets both sides ignore unrelated messages). */
export const HOST_CHANNEL = 'jett.host' as const;

/** Game identifiers (stable, independent of JS class names or scene keys). */
export type GameId = 'jett' | 'flap-fortune' | 'shatter-step';

/** Money semantics for display. Demo mode only: credits have no cash value. */
export interface CurrencyInfo {
  /** 'DEMO' for demo credits. Real ISO-4217 / crypto codes are a future server concern. */
  code: 'DEMO';
  /** Minor-unit exponent (demo credits use hundredths). Never assume 2 for real currencies. */
  exponent: 2;
}

/** Validated launch context (from URL parameters and/or the host handshake). */
export interface LaunchContext {
  protocolVersion: typeof HOST_PROTOCOL_VERSION;
  gameId: GameId;
  /** Phaser scene key that renders the game (routing never relies on class names). */
  sceneKey: 'JettScene' | 'FlapFortuneScene' | 'ShatterStepScene';
  /** Build identifier of the client. */
  gameVersion: string;
  /** Simulation/math version of the pure Logic module (e.g. JETT_SIM_VERSION). */
  mathVersion: number;
  /** Configuration identifier (production config of the scene). */
  configId: string;
  mode: 'demo';
  /** Opaque, host-chosen session label for correlation only (never a credential; never logged). */
  sessionRef: string | null;
  /** BCP-47 locale tag (only 'en' strings exist today). */
  locale: string;
  currency: CurrencyInfo;
  /** Brand id from the local registry (validated). */
  brandId: string;
  /** Embedded in a parent frame with a verified host origin. */
  embedded: boolean;
  /** Exact parent origin when embedded (allowlisted), else null. */
  hostOrigin: string | null;
  /** Validated lobby URL for standalone play, else null (host decides navigation when embedded). */
  lobbyUrl: string | null;
}

/** Round notification payload. Contains no hidden outcome, board, seed or RNG state. */
export interface RoundStartedPayload { roundId: string; gameId: GameId; stakeMinor: number }
export interface RoundSettledPayload {
  roundId: string;
  gameId: GameId;
  stakeMinor: number;
  returnMinor: number;
  netMinor: number;
  /** Settlement reason as recorded by the local demo ledger. */
  reason: string;
  /** Immutable reference to the local settlement record (diagnostics/replay lookup key). */
  resultRef: string;
  /** Demo balance after settlement (minor units). */
  balanceMinor: number;
}

/** Notifications from game to host. */
export type HostEvent =
  | { type: 'loading'; payload: { gameId: GameId } }
  | { type: 'ready'; payload: { gameId: GameId; gameVersion: string; mathVersion: number; protocolVersion: number } }
  | { type: 'error'; payload: { code: 'launch_invalid' | 'asset_failed' | 'internal'; message: string } }
  | { type: 'paused'; payload: { reason: 'host' | 'settings' | 'hidden' | 'blur' } }
  | { type: 'resumed'; payload: Record<string, never> }
  | { type: 'settingsOpened'; payload: Record<string, never> }
  | { type: 'settingsClosed'; payload: Record<string, never> }
  | { type: 'lobbyRequested'; payload: Record<string, never> }
  | { type: 'roundStarted'; payload: RoundStartedPayload }
  | { type: 'roundSettled'; payload: RoundSettledPayload };

/** Commands from host to game. Deliberately tiny; none can move money or choose outcomes. */
export type HostCommand =
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'openSettings' }
  | { type: 'closeSettings' }
  | { type: 'setBrand'; brandId: string };

/** Envelope used on the wire (postMessage). */
export interface HostEnvelope<T> {
  channel: typeof HOST_CHANNEL;
  v: typeof HOST_PROTOCOL_VERSION;
  /** Monotonic per-sender sequence number (duplicates/out-of-order are detectable). */
  seq: number;
  msg: T;
}

/** What a game needs from its host (implemented by DemoHostAdapter; future partner adapters). */
export interface GameHostAdapter {
  /** @returns The validated launch context. */
  readonly context: LaunchContext;
  /** Sends a notification to the host (no-op if there is no host). */
  notify(event: HostEvent): void;
  /** Subscribes to validated host commands; returns an unsubscribe function. */
  onCommand(fn: (cmd: HostCommand) => void): () => void;
  /** The player asked to leave (Back). The adapter decides how (host message or navigation). */
  requestLobby(): void;
  /** Removes listeners. */
  dispose(): void;
}

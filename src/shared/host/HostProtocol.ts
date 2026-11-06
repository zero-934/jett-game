/**
 * @file HostProtocol.ts
 * @purpose Pure (no Phaser, no DOM globals) validation for the demo host contract:
 *          launch-parameter parsing, exact origin allowlisting, inbound message validation
 *          (origin + source window + channel/version + schema + size + sequence) and outbound
 *          envelopes. Everything from the URL or another window is treated as untrusted.
 * @author Agent 934
 * @date 2026-11-06
 * @license Proprietary – available for licensing
 */
import { HOST_CHANNEL, HOST_PROTOCOL_VERSION } from './GameHostAdapter';
import type { HostCommand, HostEnvelope, HostEvent, LaunchContext, GameId } from './GameHostAdapter';
import { BRANDS, DEFAULT_BRAND } from '../brand/Brand';

/** Max serialized size of an inbound message (bytes, UTF-16 code units). */
export const MAX_INBOUND_CHARS = 1024;
const LOCALE = /^[a-z]{2,3}(-[A-Z]{2})?$/;
const SESSION_REF = /^[A-Za-z0-9_-]{1,64}$/;
const BRAND_ID = /^[a-z0-9-]{2,32}$/;
const COMMANDS = new Set(['pause', 'resume', 'openSettings', 'closeSettings', 'setBrand']);

/** Scene key ↔ game id (routing never depends on JS class names). */
export const SCENE_TO_GAME: Record<LaunchContext['sceneKey'], GameId> = {
  JettScene: 'jett', FlapFortuneScene: 'flap-fortune', ShatterStepScene: 'shatter-step',
};
/** Round-id prefix (DemoLedger nextRoundId) ↔ game id. */
export const ROUND_PREFIX_TO_GAME: Record<string, GameId> = { jett: 'jett', flap: 'flap-fortune', shatter: 'shatter-step' };

/**
 * Normalises an origin string; returns null unless it is exactly scheme://host[:port].
 * @param value - Candidate.
 * @returns Canonical origin or null.
 * @example
 * normaliseOrigin('https://casino.example'); // 'https://casino.example'
 * normaliseOrigin('*'); // null
 */
export function normaliseOrigin(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 200 || value === '*' || value === 'null') return null;
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    if (u.username || u.password || (u.pathname !== '/' && u.pathname !== '') || u.search || u.hash) return null;
    if (value.replace(/\/$/, '') !== u.origin) return null;
    return u.origin;
  } catch { return null; }
}

/**
 * Exact-match origin check (no wildcards, no suffix matching).
 * @param origin - Origin to test.
 * @param allowlist - Allowed origins.
 * @returns Whether allowed.
 * @example
 * isAllowedOrigin('https://a.example', ['https://a.example']); // true
 * isAllowedOrigin('https://evil.a.example', ['https://a.example']); // false
 */
export function isAllowedOrigin(origin: unknown, allowlist: readonly string[]): boolean {
  const o = normaliseOrigin(origin);
  return !!o && allowlist.includes(o);
}

/** Options for {@link parseLaunch}. */
export interface ParseLaunchOptions {
  sceneKey: LaunchContext['sceneKey'];
  gameVersion: string;
  mathVersion: number;
  configId: string;
  /** This page's own origin. */
  ownOrigin: string;
  /** Origins permitted to embed and command the game (exact). */
  hostAllowlist: readonly string[];
  /** Origins permitted as lobby destinations (exact); same-origin paths are always allowed. */
  lobbyAllowlist: readonly string[];
  /** Whether the page is framed (window.parent !== window). */
  framed: boolean;
}

/**
 * Parses and validates launch parameters. Invalid values are dropped (safe defaults) and
 * reported; nothing from the URL is reflected into HTML.
 * @param search - location.search.
 * @param o - Options.
 * @returns Context and the list of rejected parameters.
 * @example
 * parseLaunch('?brand=example-harbor-lights&locale=en', opts).context.brandId;
 */
export function parseLaunch(search: string, o: ParseLaunchOptions): { context: LaunchContext; rejected: string[] } {
  const p = new URLSearchParams(search);
  const rejected: string[] = [];
  const brandRaw = p.get('brand');
  let brandId = DEFAULT_BRAND.id;
  if (brandRaw !== null) { if (BRAND_ID.test(brandRaw) && BRANDS[brandRaw]) brandId = brandRaw; else rejected.push('brand'); }
  const localeRaw = p.get('locale');
  let locale = 'en';
  if (localeRaw !== null) { if (LOCALE.test(localeRaw)) locale = localeRaw; else rejected.push('locale'); }
  const sessionRaw = p.get('session');
  let sessionRef: string | null = null;
  if (sessionRaw !== null) { if (SESSION_REF.test(sessionRaw)) sessionRef = sessionRaw; else rejected.push('session'); }
  const hostRaw = p.get('hostOrigin');
  let hostOrigin: string | null = null;
  if (hostRaw !== null) { if (o.framed && isAllowedOrigin(hostRaw, o.hostAllowlist)) hostOrigin = normaliseOrigin(hostRaw); else rejected.push('hostOrigin'); }
  const lobbyRaw = p.get('lobby');
  let lobbyUrl: string | null = null;
  if (lobbyRaw !== null) { const l = validateLobbyUrl(lobbyRaw, o.ownOrigin, o.lobbyAllowlist); if (l) lobbyUrl = l; else rejected.push('lobby'); }
  return {
    rejected,
    context: {
      protocolVersion: HOST_PROTOCOL_VERSION, gameId: SCENE_TO_GAME[o.sceneKey], sceneKey: o.sceneKey,
      gameVersion: o.gameVersion, mathVersion: o.mathVersion, configId: o.configId, mode: 'demo',
      sessionRef, locale, currency: { code: 'DEMO', exponent: 2 }, brandId,
      embedded: o.framed && hostOrigin !== null, hostOrigin, lobbyUrl,
    },
  };
}

/**
 * Validates a lobby URL: same-origin path, or https on an allowlisted origin. Rejects
 * javascript:/data:/blob:, protocol-relative and credential URLs.
 * @param raw - Untrusted URL.
 * @param ownOrigin - This page's origin.
 * @param allowlist - Allowed external origins.
 * @returns Absolute URL string or null.
 * @example
 * validateLobbyUrl('/jett-game/', 'https://x.example', []); // 'https://x.example/jett-game/'
 */
export function validateLobbyUrl(raw: unknown, ownOrigin: string, allowlist: readonly string[]): string | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 300 || raw.startsWith('//') || /[\u0000-\u001f\\\s]/.test(raw)) return null;
  try {
    const u = new URL(raw, ownOrigin);
    if (u.username || u.password) return null;
    if (u.origin === ownOrigin && (u.protocol === 'https:' || u.protocol === 'http:')) return u.href;
    if (u.protocol === 'https:' && allowlist.includes(u.origin)) return u.href;
    return null;
  } catch { return null; }
}

/**
 * Validates an inbound command envelope's shape (no origin/source check here).
 * @param data - Untrusted message data.
 * @returns Envelope with a typed command, or null.
 * @example
 * validateCommandEnvelope({ channel: 'jett.host', v: 1, seq: 1, msg: { type: 'pause' } });
 */
export function validateCommandEnvelope(data: unknown): HostEnvelope<HostCommand> | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  let size = 0;
  try { size = JSON.stringify(data).length; } catch { return null; }
  if (size > MAX_INBOUND_CHARS) return null;
  const e = data as Record<string, unknown>;
  const keys = Object.keys(e);
  if (keys.length !== 4 || !['channel', 'v', 'seq', 'msg'].every((k) => keys.includes(k))) return null;
  if (e.channel !== HOST_CHANNEL || e.v !== HOST_PROTOCOL_VERSION) return null;
  if (typeof e.seq !== 'number' || !Number.isSafeInteger(e.seq) || e.seq < 0) return null;
  const m = e.msg as Record<string, unknown>;
  if (!m || typeof m !== 'object' || Array.isArray(m) || typeof m.type !== 'string' || !COMMANDS.has(m.type)) return null;
  const mk = Object.keys(m);
  if (m.type === 'setBrand') {
    if (mk.length !== 2 || typeof m.brandId !== 'string' || !BRAND_ID.test(m.brandId)) return null;
    return { channel: HOST_CHANNEL, v: HOST_PROTOCOL_VERSION, seq: e.seq, msg: { type: 'setBrand', brandId: m.brandId } };
  }
  if (mk.length !== 1) return null;
  return { channel: HOST_CHANNEL, v: HOST_PROTOCOL_VERSION, seq: e.seq, msg: { type: m.type as Exclude<HostCommand['type'], 'setBrand'> } as HostCommand };
}

/** Stateful inbound gate: exact origin, exact source window, schema, strictly increasing seq. */
export class InboundGate {
  private lastSeq = -1;
  /** Rejection counters by reason (diagnostics; never includes message contents). */
  readonly rejected: Record<string, number> = {};

  /**
   * @param expectedOrigin - Exact host origin.
   * @param expectedSource - The host window object (e.g. window.parent).
   */
  private readonly expectedOrigin: string;
  private readonly expectedSource: unknown;

  constructor(expectedOrigin: string, expectedSource: unknown) {
    this.expectedOrigin = expectedOrigin;
    this.expectedSource = expectedSource;
  }

  /**
   * Accepts or rejects a MessageEvent-like object.
   * @param ev - { origin, source, data }.
   * @returns The command, or null if rejected.
   * @example
   * gate.accept(event); // HostCommand | null
   */
  accept(ev: { origin: unknown; source: unknown; data: unknown }): HostCommand | null {
    const no = (why: string) => { this.rejected[why] = (this.rejected[why] ?? 0) + 1; return null; };
    if (ev.origin !== this.expectedOrigin) return no('origin');
    if (ev.source !== this.expectedSource) return no('source');
    const env = validateCommandEnvelope(ev.data);
    if (!env) return no('schema');
    if (env.seq <= this.lastSeq) return no('seq');
    this.lastSeq = env.seq;
    return env.msg;
  }
}

/**
 * Builds an outbound envelope.
 * @param seq - Sequence number.
 * @param event - Event.
 * @returns Envelope (plain data, structured-clone safe).
 * @example
 * envelope(1, { type: 'resumed', payload: {} });
 */
export function envelope(seq: number, event: HostEvent): HostEnvelope<HostEvent> {
  return { channel: HOST_CHANNEL, v: HOST_PROTOCOL_VERSION, seq, msg: event };
}

/** Keys that must never appear in any outbound payload (defence in depth). */
export const FORBIDDEN_PAYLOAD_KEYS = ['seed', 'board', 'serverSeed', 'clientSeed', 'nonce', 'rngState', 'token', 'sessionToken', 'revealed'] as const;

/**
 * Checks recursively that an outbound event carries none of the forbidden keys.
 * @param value - Event.
 * @returns Whether it is safe to send.
 * @example
 * isSafeOutbound({ type: 'ready', payload: {} }); // true
 */
export function isSafeOutbound(value: unknown, depth = 0): boolean {
  if (depth > 6) return false;
  if (!value || typeof value !== 'object') return true;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if ((FORBIDDEN_PAYLOAD_KEYS as readonly string[]).includes(k)) return false;
    if (!isSafeOutbound(v, depth + 1)) return false;
  }
  return true;
}

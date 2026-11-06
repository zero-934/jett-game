/**
 * @file HostProtocol.test.ts
 * @purpose polish-004: demo host contract validation — launch params, exact origins, source
 *          window, schema, size, sequence (duplicates/out-of-order), outbound redaction, and
 *          ledger-derived round notifications that cannot double-settle.
 * @author Agent 934
 * @date 2026-11-06
 * @license Proprietary – available for licensing
 */
import { parseLaunch, isAllowedOrigin, normaliseOrigin, validateLobbyUrl, validateCommandEnvelope, InboundGate, envelope, isSafeOutbound, MAX_INBOUND_CHARS } from '../shared/host/HostProtocol';
import type { ParseLaunchOptions } from '../shared/host/HostProtocol';
import { HOST_CHANNEL } from '../shared/host/GameHostAdapter';
import { DemoLedger } from '../shared/sim/DemoLedger';
import type { LedgerEvent } from '../shared/sim/DemoLedger';

const OWN = 'https://zero-934.github.io';
const opts = (o: Partial<ParseLaunchOptions> = {}): ParseLaunchOptions => ({ sceneKey: 'JettScene', gameVersion: 't', mathVersion: 2, configId: 'c', ownOrigin: OWN, hostAllowlist: [OWN], lobbyAllowlist: [], framed: true, ...o });
const env = (seq: number, msg: unknown) => ({ channel: HOST_CHANNEL, v: 1, seq, msg });

describe('origins', () => {
  it('exact match only — no wildcard, suffix, path or credential tricks', () => {
    expect(isAllowedOrigin(OWN, [OWN])).toBe(true);
    for (const bad of ['*', 'null', `${OWN}.evil.example`, 'https://evil.example', `${OWN}/path`, 'https://u:p@zero-934.github.io', 'javascript:alert(1)', 42, undefined])
      expect(isAllowedOrigin(bad, [OWN])).toBe(false);
    expect(normaliseOrigin(`${OWN}/`)).toBe(OWN);
  });
});

describe('parseLaunch', () => {
  it('accepts valid params', () => {
    const { context, rejected } = parseLaunch(`?brand=example-harbor-lights&locale=en-GB&session=abc_123&hostOrigin=${encodeURIComponent(OWN)}&lobby=/jett-game/`, opts());
    expect(rejected).toEqual([]);
    expect(context).toMatchObject({ gameId: 'jett', sceneKey: 'JettScene', mode: 'demo', brandId: 'example-harbor-lights', locale: 'en-GB', sessionRef: 'abc_123', embedded: true, hostOrigin: OWN, lobbyUrl: `${OWN}/jett-game/`, currency: { code: 'DEMO', exponent: 2 } });
  });
  it('drops hostile params to safe defaults and reports them', () => {
    const q = '?brand=<script>&locale=en;DROP&session=' + 'x'.repeat(80) + '&hostOrigin=*&lobby=javascript:alert(1)';
    const { context, rejected } = parseLaunch(q, opts());
    expect(rejected.sort()).toEqual(['brand', 'hostOrigin', 'lobby', 'locale', 'session']);
    expect(context).toMatchObject({ brandId: 'jett-default', locale: 'en', sessionRef: null, embedded: false, hostOrigin: null, lobbyUrl: null });
  });
  it('an allowlisted hostOrigin is ignored when the page is not framed', () => {
    const { context, rejected } = parseLaunch(`?hostOrigin=${encodeURIComponent(OWN)}`, opts({ framed: false }));
    expect(context.embedded).toBe(false); expect(rejected).toContain('hostOrigin');
  });
  it('routes by scene key, never by class name', () => {
    expect(parseLaunch('', opts({ sceneKey: 'ShatterStepScene' })).context.gameId).toBe('shatter-step');
    expect(parseLaunch('', opts({ sceneKey: 'FlapFortuneScene' })).context.gameId).toBe('flap-fortune');
  });
});

describe('validateLobbyUrl', () => {
  it('same-origin paths and allowlisted https only', () => {
    expect(validateLobbyUrl('/jett-game/', OWN, [])).toBe(`${OWN}/jett-game/`);
    expect(validateLobbyUrl('https://lobby.partner.example/x', OWN, ['https://lobby.partner.example'])).toBe('https://lobby.partner.example/x');
    for (const bad of ['javascript:alert(1)', 'data:text/html,x', '//evil.example', 'https://evil.example/', 'http://lobby.partner.example/', ' /x', 'https://u:p@zero-934.github.io/'])
      expect(validateLobbyUrl(bad, OWN, ['https://lobby.partner.example'])).toBeNull();
  });
});

describe('inbound command validation', () => {
  it('accepts the five commands with exact shapes', () => {
    for (const m of [{ type: 'pause' }, { type: 'resume' }, { type: 'openSettings' }, { type: 'closeSettings' }, { type: 'setBrand', brandId: 'example-orchid-club' }])
      expect(validateCommandEnvelope(env(1, m))?.msg).toEqual(m);
  });
  it('rejects unknown commands, extra keys, wrong channel/version, bad seq, oversize, non-objects', () => {
    const bad: unknown[] = [
      env(1, { type: 'settle', returnMinor: 999 }), env(1, { type: 'pause', extra: 1 }), env(1, { type: 'setBrand', brandId: '<x>' }),
      { ...env(1, { type: 'pause' }), channel: 'other' }, { ...env(1, { type: 'pause' }), v: 2 }, env(-1, { type: 'pause' }), env(1.5, { type: 'pause' }),
      { ...env(1, { type: 'pause' }), extra: true }, env(1, { type: 'setBrand', brandId: 'x'.repeat(MAX_INBOUND_CHARS) }), null, 'pause', [], 42,
    ];
    for (const b of bad) expect(validateCommandEnvelope(b)).toBeNull();
  });
  it('gate checks exact origin, exact source window and strictly increasing seq', () => {
    const parent = {}; const other = {};
    const g = new InboundGate(OWN, parent);
    expect(g.accept({ origin: OWN, source: parent, data: env(1, { type: 'pause' }) })).toEqual({ type: 'pause' });
    expect(g.accept({ origin: OWN, source: parent, data: env(1, { type: 'pause' }) })).toBeNull(); // duplicate
    expect(g.accept({ origin: OWN, source: parent, data: env(0, { type: 'resume' }) })).toBeNull(); // out of order
    expect(g.accept({ origin: 'https://evil.example', source: parent, data: env(5, { type: 'pause' }) })).toBeNull();
    expect(g.accept({ origin: OWN, source: other, data: env(6, { type: 'pause' }) })).toBeNull();
    expect(g.accept({ origin: OWN, source: parent, data: env(7, { type: 'openSettings' }) })).toEqual({ type: 'openSettings' });
    expect(g.rejected).toEqual({ seq: 2, origin: 1, source: 1 });
  });
});

describe('outbound safety', () => {
  it('envelopes carry channel/version/seq', () => {
    expect(envelope(3, { type: 'resumed', payload: {} })).toEqual({ channel: HOST_CHANNEL, v: 1, seq: 3, msg: { type: 'resumed', payload: {} } });
  });
  it('refuses payloads containing seeds, boards, RNG state or tokens (any depth)', () => {
    expect(isSafeOutbound({ type: 'roundSettled', payload: { roundId: 'r', returnMinor: 0 } })).toBe(true);
    for (const k of ['seed', 'board', 'rngState', 'token', 'revealed']) expect(isSafeOutbound({ type: 'x', payload: { a: { [k]: 1 } } })).toBe(false);
  });
});

describe('ledger notifications (reuse the existing demo ledger)', () => {
  it('fire once per real debit/settle; duplicate or unknown settles are silent and do not re-credit', () => {
    const l = new DemoLedger(10000); const seen: LedgerEvent[] = [];
    l.observe((e) => seen.push(e));
    expect(l.start('jett-1', 1000)).toBe(true);
    expect(l.start('jett-1', 1000)).toBe(false);
    l.settle('jett-1', 2500, 'cashout');
    l.settle('jett-1', 2500, 'cashout');
    l.settle('jett-1', 99999, 'cashout');
    l.settle('ghost', 5000, 'cashout');
    expect(seen.map((e) => e.type)).toEqual(['start', 'settle']);
    expect(l.balanceHundredths).toBe(10000 - 1000 + 2500);
  });
  it('a throwing observer cannot break settlement', () => {
    const l = new DemoLedger(5000);
    l.observe(() => { throw new Error('host bug'); });
    expect(l.start('flap-1', 1000)).toBe(true);
    expect(l.settle('flap-1', 0, 'crash')?.netHundredths).toBe(-1000);
    expect(l.balanceHundredths).toBe(4000);
  });
});

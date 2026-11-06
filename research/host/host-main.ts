/**
 * @file host-main.ts
 * @purpose RESEARCH/QA ONLY — a local fake host page that embeds a game in an iframe and talks
 *          to it over the demo host protocol. Exact target origin (this page's origin, which is
 *          also the game's), exact source-window check, channel/version check. No credentials.
 * @author Agent 934
 * @date 2026-11-06
 * @license Proprietary – available for licensing
 */
import { HOST_CHANNEL, HOST_PROTOCOL_VERSION } from '../../src/shared/host/GameHostAdapter';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const frame = $<HTMLIFrameElement>('game');
const log = $<HTMLDivElement>('log');
const ORIGIN = window.location.origin;
let seq = 0;
let lastSent: unknown = null;
const received: Array<{ type: string; seq: number }> = [];
(window as unknown as Record<string, unknown>).__hostLog = received;

function line(text: string): void {
  const d = document.createElement('div');
  d.textContent = `${new Date().toISOString().slice(11, 23)} ${text}`;
  log.prepend(d);
}

function launch(): void {
  const scene = $<HTMLSelectElement>('scene').value;
  const brand = $<HTMLSelectElement>('brand').value;
  const entry = $<HTMLSelectElement>('entry').value;
  const base = entry === 'release' ? '../../index.html' : '../harness/index.html';
  const q = new URLSearchParams({ scene, brand, hostOrigin: ORIGIN, session: `demo-${Math.random().toString(36).slice(2, 10)}`, locale: 'en', seed: 'host-demo' });
  if (entry === 'release') sessionStorage.setItem('jg_auth', 'ok'); // demo gate only (not security)
  seq = 0; received.length = 0;
  frame.src = `${base}?${q.toString()}`;
  line(`launch ${scene} brand=${brand} (${entry})`);
}

function send(msg: unknown, raw?: unknown): void {
  const target = frame.contentWindow; if (!target) return;
  const env = raw ?? { channel: HOST_CHANNEL, v: HOST_PROTOCOL_VERSION, seq: ++seq, msg };
  lastSent = env;
  target.postMessage(env, ORIGIN); // exact target origin, never '*'
  line(`→ ${JSON.stringify(env).slice(0, 120)}`);
}

window.addEventListener('message', (ev) => {
  // Accept only our iframe's window, from the exact expected origin, on our channel.
  if (ev.source !== frame.contentWindow || ev.origin !== ORIGIN) return;
  const d = ev.data as { channel?: string; v?: number; seq?: number; msg?: { type?: string; payload?: unknown } };
  if (!d || d.channel !== HOST_CHANNEL || d.v !== HOST_PROTOCOL_VERSION || typeof d.msg?.type !== 'string') return;
  received.push({ type: d.msg.type, seq: d.seq ?? -1 });
  line(`← #${d.seq} ${d.msg.type} ${JSON.stringify(d.msg.payload ?? {}).slice(0, 160)}`);
  if (d.msg.type === 'lobbyRequested') line('   host: would navigate to its lobby here');
});

$('launch').addEventListener('click', launch);
document.querySelectorAll<HTMLButtonElement>('[data-cmd]').forEach((b) => b.addEventListener('click', () => send({ type: b.dataset.cmd })));
document.querySelectorAll<HTMLButtonElement>('[data-brand]').forEach((b) => b.addEventListener('click', () => send({ type: 'setBrand', brandId: b.dataset.brand })));
$('dup').addEventListener('click', () => { if (lastSent) send(null, lastSent); });
$('bad').addEventListener('click', () => send(null, { channel: HOST_CHANNEL, v: HOST_PROTOCOL_VERSION, seq: ++seq, msg: { type: 'pause', extra: '<img src=x onerror=alert(1)>' } }));
$('big').addEventListener('click', () => send(null, { channel: HOST_CHANNEL, v: HOST_PROTOCOL_VERSION, seq: ++seq, msg: { type: 'setBrand', brandId: 'x'.repeat(5000) } }));
$('wild').addEventListener('click', () => send({ type: 'settle', returnMinor: 999999 }));
(window as unknown as Record<string, unknown>).__hostSend = send;
(window as unknown as Record<string, unknown>).__hostLaunch = launch;
launch();

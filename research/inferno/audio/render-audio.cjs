/**
 * @file render-audio.cjs
 * @purpose Deterministic, original procedural generator for Inferno's music loop and SFX cues.
 *          Pure JavaScript DSP (sines, simple FM, Karplus–Strong plucks, seeded noise, one-pole
 *          filters). No samples, no third-party audio. Writes 48 kHz float→16-bit WAV masters to
 *          --out (default research/inferno/audio/out), which encode-audio.sh turns into game assets.
 *          Cosmetic noise uses a local LCG seed — it never touches gameplay RNG.
 * Usage: node research/inferno/audio/render-audio.cjs [--out dir]
 * @author Agent 934
 * @date 2026-11-05
 * @license Proprietary – available for licensing
 */
const fs = require('node:fs');
const path = require('node:path');

const SR = 48000;
const BPM = 90;
const BEAT = 60 / BPM;
const LOOP_BARS = 6;                       // 6 bars × 4 beats × 0.6667 s = 16.0 s
const LOOP_SECONDS = LOOP_BARS * 4 * BEAT;
const args = process.argv.slice(2);
const outDir = path.resolve(args[args.indexOf('--out') + 1] && args.includes('--out') ? args[args.indexOf('--out') + 1] : path.join(__dirname, 'out'));

// ── helpers ────────────────────────────────────────────────────────────────
const buf = (seconds) => new Float32Array(Math.ceil(seconds * SR));
const midi = (n) => 440 * 2 ** ((n - 69) / 12);
const dbToGain = (db) => 10 ** (db / 20);
function lcg(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296 * 2 - 1; }; }
function onePoleLP(x, cutoff) { const a = Math.exp(-2 * Math.PI * cutoff / SR); let y = 0; for (let i = 0; i < x.length; i++) { y = (1 - a) * x[i] + a * y; x[i] = y; } return x; }
function onePoleHP(x, cutoff) { const a = Math.exp(-2 * Math.PI * cutoff / SR); let y = 0, px = 0; for (let i = 0; i < x.length; i++) { y = a * (y + x[i] - px); px = x[i]; x[i] = y; } return x; }
function mixInto(dst, src, at, gain = 1, wrap = false) {
  const o = Math.round(at * SR);
  for (let i = 0; i < src.length; i++) {
    let j = o + i;
    if (wrap) j %= dst.length; else if (j >= dst.length) break;
    dst[j] += src[i] * gain;
  }
}
/** Exponential-decay envelope with short linear attack (no clicks). */
function env(n, attack, decay) {
  const e = new Float32Array(n); const a = Math.max(1, Math.round(attack * SR));
  for (let i = 0; i < n; i++) e[i] = (i < a ? i / a : 1) * Math.exp(-(i - Math.min(i, a)) / (decay * SR));
  const fade = Math.min(n, Math.round(0.004 * SR)); for (let i = 0; i < fade; i++) e[n - 1 - i] *= i / fade;
  return e;
}
function tone(freq, seconds, { attack = 0.004, decay = 0.2, harmonics = [1], fm = 0, fmRatio = 1, glideTo = null } = {}) {
  const x = buf(seconds); const e = env(x.length, attack, decay); let ph = 0, mph = 0;
  for (let i = 0; i < x.length; i++) {
    const t = i / x.length; const f = glideTo ? freq * (glideTo / freq) ** t : freq;
    mph += 2 * Math.PI * f * fmRatio / SR; ph += 2 * Math.PI * f / SR;
    const mod = fm * Math.sin(mph) * e[i];
    let v = 0; harmonics.forEach((h, k) => { v += h * Math.sin((k + 1) * (ph + mod)); });
    x[i] = v * e[i];
  }
  return x;
}
function noise(seconds, seed, { attack = 0.001, decay = 0.02, lp = 6000, hp = 200 } = {}) {
  const r = lcg(seed); const x = buf(seconds); const e = env(x.length, attack, decay);
  for (let i = 0; i < x.length; i++) x[i] = r();
  onePoleLP(x, lp); onePoleHP(x, hp); for (let i = 0; i < x.length; i++) x[i] *= e[i];
  return x;
}
/** Karplus–Strong plucked string (soft, short). */
function pluck(freq, seconds, seed, damping = 0.996, bright = 0.5) {
  const r = lcg(seed); const n = Math.max(2, Math.round(SR / freq)); const ring = new Float32Array(n);
  for (let i = 0; i < n; i++) ring[i] = r() * 0.5; onePoleLP(ring, 800 + bright * 4000);
  const x = buf(seconds); let idx = 0;
  for (let i = 0; i < x.length; i++) { const a = ring[idx], b = ring[(idx + 1) % n]; const v = damping * 0.5 * (a + b); ring[idx] = v; x[i] = a; idx = (idx + 1) % n; }
  const fade = Math.round(0.03 * SR); for (let i = 0; i < fade; i++) x[x.length - 1 - i] *= i / fade;
  const att = Math.round(0.002 * SR); for (let i = 0; i < att; i++) x[i] *= i / att;
  return x;
}
function kick(seconds = 0.35) {
  const x = buf(seconds); let ph = 0;
  for (let i = 0; i < x.length; i++) { const t = i / SR; const f = 45 + 35 * Math.exp(-t / 0.04); ph += 2 * Math.PI * f / SR; x[i] = Math.sin(ph) * Math.exp(-t / 0.12) * Math.min(1, i / (0.003 * SR)); }
  return x;
}
function peak(x) { let p = 0; for (let i = 0; i < x.length; i++) p = Math.max(p, Math.abs(x[i])); return p; }
function normalize(x, peakDb) { const p = peak(x) || 1; const g = dbToGain(peakDb) / p; for (let i = 0; i < x.length; i++) x[i] *= g; return x; }
function concat(...parts) { const n = parts.reduce((a, p) => a + p.length, 0); const x = new Float32Array(n); let o = 0; parts.forEach((p) => { x.set(p, o); o += p.length; }); return x; }
function silence(seconds) { return buf(seconds); }
function writeWav(file, x, sampleRate = SR) {
  const data = Buffer.alloc(x.length * 2);
  for (let i = 0; i < x.length; i++) { const v = Math.max(-1, Math.min(1, x[i])); data.writeInt16LE(Math.round(v * 32767), i * 2); }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(sampleRate, 24); h.writeUInt32LE(sampleRate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, data]));
}

// ── cues (peak targets leave headroom; true peak is measured afterwards with ffmpeg) ─────────
const cues = {};
cues.click = normalize((() => { const x = noise(0.05, 11, { decay: 0.006, lp: 5000, hp: 900 }); mixInto(x, tone(1800, 0.05, { decay: 0.008 }), 0, 0.4); return x; })(), -14);
[[52, 'reel-stop-1'], [55, 'reel-stop-2'], [57, 'reel-stop-3']].forEach(([n, name], k) => {
  const x = tone(midi(n), 0.16, { decay: 0.045, harmonics: [1, 0.25, 0.08] });
  mixInto(x, noise(0.05, 20 + k, { decay: 0.008, lp: 2500, hp: 150 }), 0, 0.35);
  cues[name] = normalize(onePoleLP(x, 3000), -15);
});
cues['cluster-pop'] = normalize((() => {
  const x = buf(0.22); const r = lcg(31);
  for (let k = 0; k < 7; k++) mixInto(x, noise(0.03, 40 + k, { decay: 0.004 + 0.003 * Math.abs(r()), lp: 7000, hp: 1200 }), 0.012 * k + 0.01 * Math.abs(r()), 0.6 + 0.4 * Math.abs(r()));
  mixInto(x, tone(110, 0.12, { decay: 0.035, harmonics: [1, 0.3] }), 0, 0.7);
  return x;
})(), -13);
cues['cascade-land'] = normalize((() => { const x = buf(0.22); mixInto(x, tone(midi(62), 0.12, { decay: 0.03, harmonics: [1, 0.2] }), 0); mixInto(x, tone(midi(59), 0.12, { decay: 0.035, harmonics: [1, 0.2] }), 0.07, 0.8); return onePoleLP(x, 2500); })(), -17);
cues['heat-tick'] = normalize(tone(midi(72), 0.14, { decay: 0.04, harmonics: [1, 0.35, 0.1] }), -19);
cues['feature-granted'] = normalize((() => { const x = buf(0.6); mixInto(x, tone(midi(76), 0.4, { decay: 0.14, fm: 1.2, fmRatio: 3.5 }), 0); mixInto(x, tone(midi(83), 0.45, { decay: 0.16, fm: 1.0, fmRatio: 3.5 }), 0.14, 0.9); return x; })(), -13);
cues['crown-flip'] = normalize((() => { const x = noise(0.32, 77, { attack: 0.08, decay: 0.09, lp: 3500, hp: 600 }); return x; })(), -18);
cues['crown-win'] = normalize((() => { const x = buf(0.34); mixInto(x, pluck(midi(67), 0.3, 5, 0.994, 0.6), 0); mixInto(x, pluck(midi(74), 0.3, 6, 0.994, 0.6), 0.09); return x; })(), -15);
cues['crown-loss'] = normalize(tone(midi(57), 0.34, { decay: 0.12, harmonics: [1, 0.15], glideTo: midi(53) }), -21);
cues['result-profit'] = normalize((() => { const x = buf(0.75); [69, 73, 76].forEach((n, k) => mixInto(x, pluck(midi(n), 0.55, 60 + k, 0.995, 0.55), k * 0.11, 0.85)); return x; })(), -13);
cues['result-neutral'] = normalize(onePoleLP(pluck(midi(57), 0.3, 90, 0.992, 0.3), 1800), -22);

// ── music loop: quiet warm forge pulse, A minor, 90 BPM, 16 s, seamless (tail wrapped) ─────────
function renderLoop() {
  const x = buf(LOOP_SECONDS);
  // drone: A1 + E2 with slow breathing, lowpassed
  const drone = buf(LOOP_SECONDS); let p1 = 0, p2 = 0;
  for (let i = 0; i < drone.length; i++) {
    const t = i / SR; const breath = 0.75 + 0.25 * Math.sin(2 * Math.PI * t / (LOOP_SECONDS / 2)); // 2 cycles per loop → seamless
    p1 += 2 * Math.PI * midi(33) / SR; p2 += 2 * Math.PI * midi(40) / SR;
    drone[i] = breath * (0.6 * Math.sin(p1) + 0.18 * Math.sin(2 * p1) + 0.35 * Math.sin(p2));
  }
  onePoleLP(drone, 500); mixInto(x, drone, 0, 0.22, true);
  // soft kick on beats 1 and 3, very low "furnace pulse"
  for (let bar = 0; bar < LOOP_BARS; bar++) for (const b of [0, 2]) mixInto(x, kick(), (bar * 4 + b) * BEAT, 0.42, true);
  // brushed noise on off-beats (quiet)
  for (let beat = 0; beat < LOOP_BARS * 4; beat++) mixInto(x, noise(0.08, 300 + beat, { decay: 0.02, lp: 6000, hp: 2500 }), (beat + 0.5) * BEAT, 0.05, true);
  // sparse plucks: A minor pentatonic phrase, one note every 2 beats with small variations
  const phrase = [57, 60, 64, 62, 60, 57, 55, 57, 60, 64, 67, 64];
  phrase.forEach((n, k) => mixInto(x, onePoleLP(pluck(midi(n), 1.6, 500 + k, 0.997, 0.35), 2200), k * 2 * BEAT, 0.3, true));
  // anvil ping every 2 bars on beat 4 (quiet, metallic FM)
  for (let bar = 1; bar < LOOP_BARS; bar += 2) mixInto(x, tone(midi(81), 0.9, { decay: 0.25, fm: 2.4, fmRatio: 2.76, harmonics: [1] }), (bar * 4 + 3) * BEAT, 0.05, true);
  // gentle fade-free seam: tails were wrapped circularly above, so sample 0 follows the last sample.
  return normalize(x, -12);
}
const loop = renderLoop();

// ── audition reel: loop (8 s excerpt) then each cue separated by silence ─────────────────────
const order = ['click', 'reel-stop-1', 'reel-stop-2', 'reel-stop-3', 'cluster-pop', 'cascade-land', 'heat-tick', 'feature-granted', 'crown-flip', 'crown-win', 'crown-loss', 'result-profit', 'result-neutral'];
const reel = concat(loop.slice(0, 8 * SR), silence(0.6), ...order.flatMap((k) => [cues[k], silence(0.45)]));

fs.mkdirSync(outDir, { recursive: true });
writeWav(path.join(outDir, 'inferno-forge-loop.wav'), loop);
order.forEach((k) => writeWav(path.join(outDir, `${k}.wav`), cues[k]));
writeWav(path.join(outDir, 'audition-reel.wav'), reel);
// seam check: discontinuity at the loop point vs the typical sample-to-sample step
let maxStep = 0; for (let i = 1; i < loop.length; i++) maxStep = Math.max(maxStep, Math.abs(loop[i] - loop[i - 1]));
const manifest = {
  generator: 'research/inferno/audio/render-audio.cjs', sampleRate: SR, bpm: BPM, loopSeconds: LOOP_SECONDS, loopBars: LOOP_BARS,
  seam: { firstMinusLast: Math.abs(loop[0] - loop[loop.length - 1]), maxAdjacentStepInLoop: maxStep },
  files: Object.fromEntries(['inferno-forge-loop', ...order].map((k) => [k, { seconds: (k === 'inferno-forge-loop' ? loop : cues[k]).length / SR, samplePeakDbfs: 20 * Math.log10(peak(k === 'inferno-forge-loop' ? loop : cues[k])) }])),
  order,
};
fs.writeFileSync(path.join(outDir, 'render-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest.seam), 'written to', outDir);

/**
 * @file harness-main.ts
 * @purpose RESEARCH HARNESS ONLY — never imported by production. Boots the unmodified production
 *          scenes with the same game config as src/main.ts, skips LockScene, and exposes the
 *          Phaser.Game plus resource counters on window for Playwright probes.
 * @author Agent 934 (research branch)
 * @date 2026-11-05
 * @license Proprietary – available for licensing
 */
import * as Phaser from 'phaser';
import { JettScene } from '../../src/scenes/JettScene';
import { ShatterStepScene } from '../../src/scenes/ShatterStepScene';
import { FlapFortuneScene } from '../../src/scenes/FlapFortuneScene';

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
const target = params.get('scene') ?? 'JettScene';
const limit = Number(params.get('fpsLimit') ?? '0');

const config = {
  type: params.get('renderer') === 'canvas' ? Phaser.CANVAS : Phaser.AUTO,
  width: 390,
  height: 844,
  backgroundColor: '#000000',
  resolution: window.devicePixelRatio || 2, // mirrors src/main.ts (ignored by Phaser 4)
  scene: [JettScene, ShatterStepScene, FlapFortuneScene].filter((s) => s.name === target)
    .concat([JettScene, ShatterStepScene, FlapFortuneScene].filter((s) => s.name !== target)),
  parent: 'app',
  fps: limit > 0 ? { limit } : undefined,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  dom: { createContainer: true },
} as Phaser.Types.Core.GameConfig;

const game = new Phaser.Game(config);
(window as unknown as Record<string, unknown>).__game = game;
(window as unknown as Record<string, unknown>).__counters = counters;
(window as unknown as Record<string, unknown>).__Phaser = Phaser;

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
import { loadShellFonts } from '../../src/shared/render/FontLoader';

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

const SCENES_BY_KEY: Array<[string, typeof Phaser.Scene]> = [['JettScene', JettScene], ['ShatterStepScene', ShatterStepScene], ['FlapFortuneScene', FlapFortuneScene]];
const ordered = SCENES_BY_KEY.filter(([k]) => k === target).concat(SCENES_BY_KEY.filter(([k]) => k !== target)).map(([, s]) => s);

const config = {
  type: params.get('renderer') === 'canvas' ? Phaser.CANVAS : Phaser.AUTO,
  width: 390,
  height: 844,
  backgroundColor: '#000000',
  // polish-004: route by the Phaser scene KEY, not JS class.name (minification renames classes).
  scene: ordered,
  parent: 'app',
  fps: limit > 0 ? { limit } : undefined,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  dom: { createContainer: true },
} as Phaser.Types.Core.GameConfig;

await loadShellFonts(import.meta.env.BASE_URL);
const game = new Phaser.Game(config);
(window as unknown as Record<string, unknown>).__game = game;
(window as unknown as Record<string, unknown>).__counters = counters;
(window as unknown as Record<string, unknown>).__Phaser = Phaser;

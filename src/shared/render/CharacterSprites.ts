/**
 * @file CharacterSprites.ts
 * @purpose Loads and places the polish-004 character exports. Picks the render-scale variant
 *          (r2/r3) for the current display, and positions the image so the visible body has
 *          EXACTLY the polish-003 on-screen size and centre (from characterManifest.ts), so
 *          gameplay footprint, hitbox alignment and pivots are unchanged.
 * @author Agent 934
 * @date 2026-11-06
 * @license Proprietary – available for licensing
 */
import * as Phaser from 'phaser';
import { CHARACTER_MANIFEST } from './characterManifest';
import { decideRenderScale } from './RenderScalePolicy';

export type CharacterKey = keyof typeof CHARACTER_MANIFEST;
export type CharacterVariant = 'r2' | 'r3';

/** Render scale above which the r3 export is used. */
const R3_THRESHOLD = 2.25;

/**
 * Chooses the variant for the scene's current CSS size and DPR.
 * @param scene - Scene (game already booted).
 * @returns Variant id.
 * @example
 * pickCharacterVariant(this); // 'r3' on a DPR 3 phone
 */
export function pickCharacterVariant(scene: Phaser.Scene): CharacterVariant {
  const css = scene.scale.displaySize?.width || scene.game.canvas.getBoundingClientRect().width || 390;
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  return decideRenderScale(css, dpr).scale > R3_THRESHOLD ? 'r3' : 'r2';
}

/**
 * Texture key for a character variant.
 * @param key - Character.
 * @param variant - Variant.
 * @returns Phaser texture key.
 * @example
 * characterTextureKey('jett-pilot', 'r3'); // 'jett-pilot-r3'
 */
export function characterTextureKey(key: CharacterKey, variant: CharacterVariant): string { return `${key}-${variant}`; }

/**
 * Queues the variant for loading (Scene.preload) and returns its texture key.
 * @param scene - Scene in preload.
 * @param key - Character.
 * @returns Texture key that will be available in create().
 * @example
 * this.pilotKey = preloadCharacter(this, 'jett-pilot');
 */
export function preloadCharacter(scene: Phaser.Scene, key: CharacterKey): string {
  const variant = pickCharacterVariant(scene);
  const tex = characterTextureKey(key, variant);
  if (!scene.textures.exists(tex)) scene.load.image(tex, `${import.meta.env.BASE_URL}assets/polish-004/${key}-${variant}.png`);
  return tex;
}

/** Placement for an image of a character variant. */
export interface CharacterPlacement {
  scale: number;
  originX: number;
  originY: number;
  /** Texture size in px. */
  width: number;
  height: number;
}

/**
 * Computes scale and origin so the visible body matches the approved on-screen body.
 * @param key - Character.
 * @param variant - Variant.
 * @returns Placement.
 * @example
 * const p = characterPlacement('jett-pilot', 'r3'); img.setScale(p.scale).setOrigin(p.originX, p.originY);
 */
export function characterPlacement(key: CharacterKey, variant: CharacterVariant): CharacterPlacement {
  const c = CHARACTER_MANIFEST[key];
  const v = c.variants[variant];
  const [w, h] = v.size;
  const [x0, y0, x1, y1] = v.bodyBox;
  const scale = c.displayBody.heightLogical / (y1 - y0);
  const [dx, dy] = c.displayBody.centerOffsetLogical;
  return { scale, originX: ((x0 + x1) / 2 - dx / scale) / w, originY: ((y0 + y1) / 2 - dy / scale) / h, width: w, height: h };
}

/**
 * Variant id from a loaded texture key.
 * @param tex - Texture key.
 * @returns Variant.
 * @example
 * variantOf('jett-pilot-r2'); // 'r2'
 */
export function variantOf(tex: string): CharacterVariant { return tex.endsWith('-r2') ? 'r2' : 'r3'; }

/**
 * Logical offset of a named anchor from the image position, after rotation.
 * @param key - Character.
 * @param variant - Variant.
 * @param anchor - Anchor name from the manifest.
 * @param angleDeg - Image angle.
 * @returns Offset in logical px.
 * @example
 * const n = characterAnchor('jett-pilot', 'r3', 'nozzle', pilot.angle);
 */
export function characterAnchor(key: CharacterKey, variant: CharacterVariant, anchor: string, angleDeg = 0): { x: number; y: number } {
  const p = characterPlacement(key, variant);
  const anchors = CHARACTER_MANIFEST[key].variants[variant].anchors as Record<string, { u: number; v: number }>;
  const a = anchors[anchor];
  if (!a) return { x: 0, y: 0 };
  const lx = (a.u - p.originX) * p.width * p.scale;
  const ly = (a.v - p.originY) * p.height * p.scale;
  const r = Phaser.Math.DegToRad(angleDeg);
  return { x: lx * Math.cos(r) - ly * Math.sin(r), y: lx * Math.sin(r) + ly * Math.cos(r) };
}

"""
@file export_characters.py
@purpose polish-004 reproducible runtime export of the approved character masters.
         Source → runtime steps (no generative tools, no upscaling, no new poses):
           1. Measure the master's alpha bounds (alpha > ALPHA_FLOOR) BEFORE any edit, so the
              crop, aspect and pivot are identical to polish-003 (gameplay footprint unchanged).
           2. Pilot only: erase the baked-in jet flame under the nozzle (the game draws an
              animated flame there; polish-003 showed two flames).
           3. Clear faint alpha noise (alpha <= ALPHA_FLOOR → 0) that produced soft ghost halos.
           4. Downsample with premultiplied alpha + Lanczos (prevents dark/colour fringes).
           5. Add a restrained dark contact outline (silhouette separation on navy/rock).
           6. Pad with transparent pixels (no bleeding; linear filtering safe).
         Variants are sized for render scale 2 and 3 so texel density stays ≈1–1.35 per
         physical pixel (oversized textures alias under LINEAR filtering without mipmaps).
@author Agent 934
@date 2026-11-06
@license Proprietary – available for licensing

Usage: python3 -I research/art/export_characters.py   (from the repo root; needs Pillow + numpy)
"""
import json
import os
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.getcwd()
OUT_DIR = os.path.join(ROOT, 'public', 'assets', 'polish-004')
ALPHA_FLOOR = 8
PAD = 4
OUTLINE_RGB = (10, 16, 32)

# Display sizes in logical px (from the UIs; unchanged): pilot 62 world × k 0.7867, wizard 60 × 0.7867.
# Texture heights per render-scale variant (full texture height incl. padding).
CHARACTERS = {
    'jett-pilot': {
        'src': 'docs/polish-003/assets/jett-pilot-study.png',
        'display_logical_h': 62 * 0.786729857819905,
        'erase_flame': {'box': (636, 904, 760, 1070)},
        # Anchors in master pixel coordinates (measured on the master).
        'anchors': {'nozzle': (695, 906)},
        'outline_px': 2.2, 'outline_alpha': 0.55,
        'reference': 'public/assets/polish-003/jett-pilot.png',
    },
    'flap-wizard': {
        'src': 'docs/polish-003/assets/flap-wizard-study.png',
        'display_logical_h': 60 * 0.786729857819905,
        'anchors': {'bristles': (196, 838), 'hat_tip': (440, 300)},
        'outline_px': 2.2, 'outline_alpha': 0.5,
        'reference': 'public/assets/polish-003/flap-wizard.png',
    },
}
VARIANTS = {'r2': 2.0, 'r3': 3.0}
DENSITY = 1.25  # texels per physical px at the variant's render scale


def alpha_bounds(a: np.ndarray):
    ys, xs = np.where(a > ALPHA_FLOOR)
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def erase_flame(rgba: np.ndarray, box):
    x0, y0, x1, y1 = box
    region = rgba[y0:y1, x0:x1].astype(np.float32)
    r, g, b, a = region[..., 0], region[..., 1], region[..., 2], region[..., 3]
    # Flame/glow: warm, saturated, brighter than the grey nozzle (which has r≈g≈b).
    warm = (r > 150) & (r - b > 60)
    glow = (a < 250) & (r - b > 25)
    kill = warm | glow
    region[..., 3] = np.where(kill, 0, a)
    rgba[y0:y1, x0:x1] = region.astype(np.uint8)
    return int(kill.sum())


def premultiplied_resize(img: Image.Image, size):
    arr = np.asarray(img).astype(np.float32) / 255.0
    rgb = arr[..., :3] * arr[..., 3:4]
    pm = np.concatenate([rgb, arr[..., 3:4]], axis=-1)
    chans = [Image.fromarray((pm[..., i] * 255).astype(np.float32), mode='F').resize(size, Image.LANCZOS) for i in range(4)]
    out = np.stack([np.asarray(c) for c in chans], axis=-1) / 255.0
    out = np.clip(out, 0, 1)
    a = out[..., 3:4]
    rgb = np.where(a > 1e-4, out[..., :3] / np.maximum(a, 1e-4), 0)
    res = np.concatenate([np.clip(rgb, 0, 1), a], axis=-1)
    res = (res * 255 + 0.5).astype(np.uint8)
    res[..., 3] = np.where(res[..., 3] <= 2, 0, res[..., 3])
    return Image.fromarray(res, 'RGBA')


def add_outline(img: Image.Image, px: float, alpha: float):
    a = img.getchannel('A')
    grown = a.filter(ImageFilter.MaxFilter(int(round(px)) * 2 + 1)).filter(ImageFilter.GaussianBlur(0.6))
    g = np.asarray(grown).astype(np.float32) * alpha
    under = np.zeros((img.height, img.width, 4), np.float32)
    under[..., 0], under[..., 1], under[..., 2] = OUTLINE_RGB
    under[..., 3] = g
    base = Image.fromarray(under.astype(np.uint8), 'RGBA')
    return Image.alpha_composite(base, img)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    manifest = {'generatedBy': 'research/art/export_characters.py', 'alphaFloor': ALPHA_FLOOR, 'pad': PAD, 'density': DENSITY, 'characters': {}}
    for key, c in CHARACTERS.items():
        src = Image.open(os.path.join(ROOT, c['src'])).convert('RGBA')
        rgba = np.array(src)
        bounds = alpha_bounds(rgba[..., 3])  # measured BEFORE edits → pivot/aspect unchanged
        erased = erase_flame(rgba, c['erase_flame']['box']) if 'erase_flame' in c else 0
        rgba[..., 3] = np.where(rgba[..., 3] <= ALPHA_FLOOR, 0, rgba[..., 3])
        crop = Image.fromarray(rgba, 'RGBA').crop(bounds)
        # Reference: the polish-003 runtime texture, displayed at display_logical_h / its height
        # with origin 0.5. Its visible body (alpha > floor) sets the on-screen size and centre
        # that the new export must reproduce exactly (no enlargement, no pivot drift).
        ref = Image.open(os.path.join(ROOT, c['reference'])).convert('RGBA')
        rb = alpha_bounds(np.asarray(ref)[..., 3])
        ref_scale = c['display_logical_h'] / ref.height
        display_body = {
            'heightLogical': round((rb[3] - rb[1]) * ref_scale, 3),
            'centerOffsetLogical': [round(((rb[0] + rb[2]) / 2 - ref.width / 2) * ref_scale, 3), round(((rb[1] + rb[3]) / 2 - ref.height / 2) * ref_scale, 3)],
            'referenceTexture': c['reference'], 'referenceBodyBox': list(rb),
        }
        entry = {'displayBody': display_body, 'source': c['src'], 'sourceSize': list(src.size), 'cropBounds': list(bounds), 'flamePixelsErased': erased, 'variants': {}}
        for vname, scale in VARIANTS.items():
            # Size from the on-screen BODY height so texel density is DENSITY per physical px.
            body_h = int(round(display_body['heightLogical'] * scale * DENSITY))
            s = body_h / crop.height
            body_w = int(round(crop.width * s))
            small = premultiplied_resize(crop, (body_w, body_h))
            canvas = Image.new('RGBA', (body_w + 2 * PAD, body_h + 2 * PAD), (0, 0, 0, 0))
            canvas.paste(small, (PAD, PAD))
            body_box = [PAD, PAD, PAD + body_w, PAD + body_h]  # pre-outline visible body
            canvas = add_outline(canvas, c['outline_px'] * scale / 3, c['outline_alpha'])
            name = f'{key}-{vname}.png'
            canvas.save(os.path.join(OUT_DIR, name), optimize=True)
            anchors = {}
            for an, (mx, my) in c['anchors'].items():
                tx = PAD + (mx - bounds[0]) * s
                ty = PAD + (my - bounds[1]) * s
                anchors[an] = {'u': round(tx / canvas.width, 4), 'v': round(ty / canvas.height, 4)}
            entry['variants'][vname] = {'file': f'public/assets/polish-004/{name}', 'size': [canvas.width, canvas.height], 'bytes': os.path.getsize(os.path.join(OUT_DIR, name)),
                                        'gpuBytes': canvas.width * canvas.height * 4, 'bodyBox': body_box, 'texelsPerPhysicalPx': DENSITY, 'anchors': anchors}
        manifest['characters'][key] = entry
    with open(os.path.join(OUT_DIR, 'manifest.json'), 'w') as f:
        json.dump(manifest, f, indent=1)
    ts = os.path.join(ROOT, 'src', 'shared', 'render', 'characterManifest.ts')
    with open(ts, 'w') as f:
        f.write('/**\n * @file characterManifest.ts\n * @purpose GENERATED by research/art/export_characters.py — do not edit by hand. Runtime\n *          character variants, visible-body boxes, on-screen body size/centre and anchors.\n * @author Agent 934\n * @date 2026-11-06\n * @license Proprietary – available for licensing\n */\n')
        f.write('/* eslint-disable */\nexport const CHARACTER_MANIFEST = ' + json.dumps(manifest['characters'], indent=1) + ' as const;\n')
    print(json.dumps(manifest, indent=1))


if __name__ == '__main__':
    main()

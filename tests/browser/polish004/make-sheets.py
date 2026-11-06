"""Builds polish-004 comparison sheets from docs/polish-004/evidence/release/{before,after}.
Native crops are pasted 1:1 (no resampling); overview sheets are explicitly labelled as downscaled.
Usage: python3 -I tests/browser/polish004/make-sheets.py"""
import os
from PIL import Image, ImageDraw
E = 'docs/polish-004/evidence'; R = f'{E}/release'; C = f'{E}/crops'
os.makedirs(C, exist_ok=True)
SC = {'jett': 'JettScene', 'flap': 'FlapFortuneScene', 'shatter': 'ShatterStepScene'}

def stack(out, items, gap=22, horizontal=False):
    ims = [(l, Image.open(p).convert('RGB') if isinstance(p, str) else p) for l, p in items]
    if horizontal:
        W = sum(i.width for _, i in ims) + 8 * (len(ims) - 1); H = max(i.height for _, i in ims) + gap
        s = Image.new('RGB', (W, H), (0, 0, 0)); d = ImageDraw.Draw(s); x = 0
        for l, i in ims: d.text((x + 3, 4), l, fill=(255, 255, 255)); s.paste(i, (x, gap)); x += i.width + 8
    else:
        W = max(i.width for _, i in ims); H = sum(i.height + gap for _, i in ims)
        s = Image.new('RGB', (W, H), (0, 0, 0)); d = ImageDraw.Draw(s); y = 0
        for l, i in ims: d.text((3, y + 4), l, fill=(255, 255, 255)); y += gap; s.paste(i, (0, y)); y += i.height
    s.save(out); return s.size

def crop(label, scene, state, vp, dpr, box):
    p = f'{R}/{label}/{scene}-{state}-{vp}@{dpr}x.png'
    return Image.open(p).crop(tuple(int(round(v * dpr)) for v in box))

made = []
# 1. Text/control regions at DPR 1, 2, 3 (390×844 ready, native pixels).
for g, scene in SC.items():
    for name, box in {'header': (0, 0, 390, 66), 'hud': (0, 66, 390, 140) if g != 'shatter' else (0, 66, 390, 136), 'footer': (0, 690, 390, 844)}.items():
        for dpr in (1, 2, 3):
            out = f'{C}/{g}-{name}-before-after@{dpr}x.png'
            made.append((out, stack(out, [(f'BEFORE {scene} {name} 390x844 @{dpr}x (native px)', crop('before', scene, 'ready', '390x844', dpr, box)),
                                          (f'AFTER  {scene} {name} 390x844 @{dpr}x (native px)', crop('after', scene, 'ready', '390x844', dpr, box))])))
# 2. Characters at actual gameplay size (ready state), DPR 1/2/3, native px.
for g, scene, box in [('jett', 'JettScene', (165, 445, 225, 510)), ('flap', 'FlapFortuneScene', (70, 378, 140, 432))]:
    row = []
    for dpr in (1, 2, 3):
        row.append((f'before @{dpr}x', crop('before', scene, 'ready', '390x844', dpr, box)))
        row.append((f'after @{dpr}x', crop('after', scene, 'ready', '390x844', dpr, box)))
    out = f'{C}/{g}-character-actual-size-dpr123.png'
    made.append((out, stack(out, row, horizontal=True)))
# 3. Active/result states (native @3x) for each game.
for g, scene in SC.items():
    for state in ['active', 'result']:
        out = f'{C}/{g}-{state}-before-after@3x-full.png'
        a = Image.open(f'{R}/before/{scene}-{state}-390x844@3x.png'); b = Image.open(f'{R}/after/{scene}-{state}-390x844@3x.png')
        made.append((out, stack(out, [('before (native 1170x2532 screenshot of a 390x844 backing)', a), ('after (native 1170x2532)', b)], horizontal=True)))
# 4. Overviews (DOWNSCALED — layout only, not a sharpness proof).
for vp, dpr in [('320x568', 2), ('844x390', 3), ('667x375', 2), ('430x932', 3)]:
    items = []
    for g, scene in SC.items():
        for label in ('before', 'after'):
            im = Image.open(f'{R}/{label}/{scene}-ready-{vp}@{dpr}x.png'); w, h = im.size
            items.append((f'{label} {g}', im.resize((w // dpr, h // dpr), Image.LANCZOS)))
    out = f'{C}/overview-{vp}-DOWNSCALED.png'
    made.append((out, stack(out, items, horizontal=True)))
for o, s in made: print(o, s)

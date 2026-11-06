"""Native-resolution crop comparisons (no resampling): same region of each capture, stacked.
Usage: python3 -I tests/browser/polish004/make-crops.py <out.png> <label=png> ... --box x0,y0,x1,y1 (CSS px; scaled by DPR from filename)"""
import sys, re
from PIL import Image, ImageDraw
args = sys.argv[1:]; out = args[0]; box = None; items = []
i = 1
while i < len(args):
    if args[i] == '--box': box = [float(v) for v in args[i + 1].split(',')]; i += 2; continue
    lab, path = args[i].rsplit('=', 1); items.append((lab, path)); i += 1
crops = []
for lab, path in items:
    im = Image.open(path).convert('RGB')
    dpr = float(re.search(r'@(\d+(?:\.\d+)?)x', path).group(1))
    b = tuple(int(round(v * dpr)) for v in box)
    crops.append((lab, im.crop(b)))
W = max(c.width for _, c in crops); H = sum(c.height + 22 for _, c in crops)
sheet = Image.new('RGB', (W, H), (0, 0, 0)); d = ImageDraw.Draw(sheet); y = 0
for lab, c in crops:
    d.text((4, y + 4), lab, fill=(255, 255, 255)); y += 22; sheet.paste(c, (0, y)); y += c.height
sheet.save(out); print(out, sheet.size)

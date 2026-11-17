"""Draw the app icons (the favicon design: a clipped dark plate with three green bars).

Usage (from the repo root): python3 scripts/make_icons.py
Writes icons/icon-192.png, icons/icon-512.png and icons/icon-maskable-512.png.
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
BG = (10, 12, 11)        # --bg
PLATE = (18, 22, 20)     # --plate
GREEN = (67, 224, 127)   # --doom


def draw(size, safe):
    """safe: fraction of the canvas the design may use (maskable icons need padding)."""
    img = Image.new("RGB", (size, size), BG)
    d = ImageDraw.Draw(img)
    pad = size * (1 - safe) / 2
    u = size * safe / 32  # the favicon is drawn on a 32-unit grid

    def pt(x, y):
        return (pad + x * u, pad + y * u)

    d.polygon([pt(0, 0), pt(26, 0), pt(32, 6), pt(32, 32), pt(6, 32), pt(0, 26)], fill=PLATE)
    for x0, y0, x1, y1 in [(9, 9, 23, 13), (9, 15, 23, 19), (9, 21, 18, 25)]:
        d.rectangle([pt(x0, y0), pt(x1, y1)], fill=GREEN)
    return img


out = ROOT / "icons"
out.mkdir(exist_ok=True)
draw(192, 1.0).save(out / "icon-192.png")
draw(512, 1.0).save(out / "icon-512.png")
draw(512, 0.72).save(out / "icon-maskable-512.png")
print("wrote", ", ".join(sorted(p.name for p in out.glob("*.png"))))

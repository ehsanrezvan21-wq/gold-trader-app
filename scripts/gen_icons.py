#!/usr/bin/env python3
"""Generate GoldBot PWA icons: gold coin with robot face + upward candle."""
from PIL import Image, ImageDraw

GOLD_LIGHT = (247, 215, 126)
GOLD = (245, 181, 42)
GOLD_DARK = (217, 147, 15)
DARK = (23, 19, 16)
BG = (12, 10, 9)


def make_icon(size: int, maskable: bool = False) -> Image.Image:
    img = Image.new('RGB', (size, size), BG)
    d = ImageDraw.Draw(img)
    s = size
    if maskable:
        # safe zone: content within inner 80%
        d.rounded_rectangle([0, 0, s, s], radius=0, fill=(28, 23, 18))
        d.ellipse([s*0.05, s*0.05, s*0.95, s*0.95], fill=(28, 23, 18))

    cx, cy = s * 0.5, s * 0.46
    r = s * (0.34 if maskable else 0.38)

    # outer coin ring
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=GOLD_DARK)
    ring_inset = s * 0.025
    d.ellipse([cx - r + ring_inset, cy - r + ring_inset, cx + r - ring_inset, cy + r - ring_inset], fill=GOLD)

    # inner dark face plate
    inner = s * 0.055
    d.ellipse([cx - r + inner, cy - r + inner, cx + r - inner, cy + r - inner], fill=DARK)

    # robot eyes
    ey = cy - s * 0.045
    ex = s * 0.075
    ew = s * 0.055
    eh = s * 0.075
    d.rounded_rectangle([cx - ex - ew, ey - eh, cx - ex, ey + eh], radius=ew // 3, fill=GOLD_LIGHT)
    d.rounded_rectangle([cx + ex, ey - eh, cx + ex + ew, ey + eh], radius=ew // 3, fill=GOLD_LIGHT)

    # mouth: small rising candle (bullish)
    bx, bw = cx - s * 0.012, s * 0.024
    body_top, body_bot = cy + s * 0.02, cy + s * 0.115
    d.rounded_rectangle([bx, body_top, bx + bw, body_bot], radius=bw // 3, fill=GOLD_LIGHT)
    # wick
    d.line([bx + bw / 2, body_top - s * 0.03, bx + bw / 2, body_top], fill=GOLD_LIGHT, width=max(2, s // 100))
    d.line([bx + bw / 2, body_bot, bx + bw / 2, body_bot + s * 0.015], fill=GOLD_LIGHT, width=max(2, s // 100))

    # antenna
    d.line([cx, cy - r + s * 0.01, cx, cy - r - s * 0.04], fill=GOLD_LIGHT, width=max(2, s // 90))
    d.ellipse([cx - s * 0.018, cy - r - s * 0.055, cx + s * 0.018, cy - r - s * 0.02], fill=GOLD_LIGHT)

    return img


base = '/home/z/my-project/public/icons'
make_icon(192).save(f'{base}/icon-192.png')
make_icon(512).save(f'{base}/icon-512.png')
make_icon(512, maskable=True).save(f'{base}/icon-512-maskable.png')
# favicon
make_icon(64).save('/home/z/my-project/public/icons/icon-64.png')
print('icons generated')

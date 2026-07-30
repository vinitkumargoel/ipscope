#!/usr/bin/env python3
"""
Generates IPScope's favicon set and Open Graph card.

Rendered deterministically with PIL rather than by an image model: the OG card is
mostly text, and text is exactly what generative image models get wrong. Re-run
after changing the brand colours.

    python3 scripts/gen-brand-assets.py
"""
from __future__ import annotations

import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
PUBLIC = os.path.join(ROOT, "public")
OG_DIR = os.path.join(PUBLIC, "og")

# Matches the hero gradient in public/css/bento.css
C_DARK = (30, 64, 175)    # #1e40af
C_MID = (37, 99, 235)     # #2563eb
C_LIGHT = (59, 130, 246)  # #3b82f6
WHITE = (255, 255, 255)

FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
FONT_REG = "/System/Library/Fonts/Supplemental/Arial.ttf"


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


def diagonal_gradient(size: tuple[int, int]) -> Image.Image:
    """135-degree three-stop gradient, matching the site hero."""
    w, h = size
    img = Image.new("RGB", (w, h))
    px = img.load()
    for y in range(h):
        for x in range(w):
            # Normalised position along the diagonal.
            t = (x / max(w - 1, 1) + y / max(h - 1, 1)) / 2
            if t < 0.5:
                k = t / 0.5
                a, b = C_DARK, C_MID
            else:
                k = (t - 0.5) / 0.5
                a, b = C_MID, C_LIGHT
            px[x, y] = (
                int(a[0] + (b[0] - a[0]) * k),
                int(a[1] + (b[1] - a[1]) * k),
                int(a[2] + (b[2] - a[2]) * k),
            )
    return img


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([(0, 0), (size[0] - 1, size[1] - 1)], radius=radius, fill=255)
    return mask


def make_icon(px: int) -> Image.Image:
    """Rounded-square app icon carrying a bold 'IP' wordmark."""
    scale = 4 if px < 128 else 2
    big = px * scale
    grad = diagonal_gradient((big, big))
    icon = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    icon.paste(grad, (0, 0), rounded_mask((big, big), int(big * 0.22)))

    draw = ImageDraw.Draw(icon)
    # Size the wordmark to fill ~78% of the tile width.
    target = big * 0.78
    size = int(big * 0.5)
    f = font(FONT_BOLD, size)
    while draw.textlength("IP", font=f) > target and size > 8:
        size -= max(1, size // 20)
        f = font(FONT_BOLD, size)

    box = draw.textbbox((0, 0), "IP", font=f)
    draw.text(
        ((big - (box[2] - box[0])) / 2 - box[0], (big - (box[3] - box[1])) / 2 - box[1]),
        "IP",
        font=f,
        fill=WHITE,
    )
    return icon.resize((px, px), Image.LANCZOS)


def make_og() -> Image.Image:
    """1200x630 Open Graph card."""
    W, H = 1200, 630
    img = diagonal_gradient((W, H)).convert("RGBA")

    # Translucent furniture goes on its own layer: ImageDraw writes RGBA values
    # directly rather than blending them, so drawing it inline would paint solid
    # white instead of a faint wash.
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)

    # Faint grid so the card does not read as a flat block of colour.
    for x in range(0, W, 60):
        od.line([(x, 0), (x, H)], fill=(255, 255, 255, 20), width=1)
    for y in range(0, H, 60):
        od.line([(0, y), (W, y)], fill=(255, 255, 255, 20), width=1)

    # Chip plates, also translucent.
    chips = ["No API keys", "Offline MMDB", "IPv4 + IPv6", "Open source"]
    f_chip = font(FONT_BOLD, 24)
    chip_y = 496
    chip_boxes = []
    x = 72
    for chip in chips:
        w = od.textlength(chip, font=f_chip)
        pad = 20
        od.rounded_rectangle(
            [(x, chip_y), (x + w + pad * 2, chip_y + 52)],
            radius=26,
            fill=(255, 255, 255, 46),
            outline=(255, 255, 255, 110),
            width=2,
        )
        chip_boxes.append((x + pad, chip, w))
        x += w + pad * 2 + 14

    img = Image.alpha_composite(img, overlay)
    draw = ImageDraw.Draw(img)

    # Chip labels drawn opaque, on top of the composited plates.
    for tx, chip, _w in chip_boxes:
        draw.text((tx, chip_y + 13), chip, font=f_chip, fill=WHITE)

    icon = make_icon(96)
    img.paste(icon, (72, 64), icon)

    draw.text((188, 84), "IPScope", font=font(FONT_BOLD, 52), fill=WHITE)
    draw.text((190, 146), "ip.vinitk.dev", font=font(FONT_REG, 26), fill=(219, 234, 254))

    draw.text((72, 248), "What is my IP?", font=font(FONT_BOLD, 92), fill=WHITE)
    draw.text(
        (72, 356),
        "Free IPv4 & IPv6 geolocation — city, ISP,",
        font=font(FONT_REG, 38),
        fill=(219, 234, 254),
    )
    draw.text((72, 404), "ASN, timezone and map.", font=font(FONT_REG, 38), fill=(219, 234, 254))

    return img.convert("RGB")


def main() -> None:
    os.makedirs(OG_DIR, exist_ok=True)

    # Multi-resolution .ico so /favicon.ico stops 404ing for crawlers and browsers
    # that still request it by convention.
    base = make_icon(256)
    ico_path = os.path.join(PUBLIC, "favicon.ico")
    base.save(ico_path, format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
    print(f"favicon.ico            {os.path.getsize(ico_path):>8,} bytes")

    for name, px in (("favicon-32.png", 32), ("favicon-192.png", 192), ("apple-touch-icon.png", 180)):
        p = os.path.join(PUBLIC, name)
        make_icon(px).save(p, format="PNG", optimize=True)
        print(f"{name:<22} {os.path.getsize(p):>8,} bytes")

    og_path = os.path.join(OG_DIR, "default.png")
    make_og().save(og_path, format="PNG", optimize=True)
    print(f"og/default.png         {os.path.getsize(og_path):>8,} bytes")


if __name__ == "__main__":
    main()

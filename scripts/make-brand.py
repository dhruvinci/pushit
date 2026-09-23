#!/usr/bin/env python3
"""Generates icons and link-preview (Open Graph) images into public/.

Run after adding an episode or band:  .venv/bin/python scripts/make-brand.py
Needs Pillow (pip install pillow) and node_modules (for the site's fonts).
"""
import json
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
FONTS = ROOT / "node_modules/@fontsource"

BG = (11, 11, 10)
FG = (236, 235, 230)
DIM = (151, 148, 139)
RED = (242, 55, 31)

SERIES = {
    "rehearsal-tapes": "Rehearsal Tapes",
    "scenes": "Scenes From The Scene",
    "portraits": "Portraits",
    "bts": "Behind The Scenes",
    "specials": "Specials",
}


def font(name, size):
    paths = {
        "display": FONTS / "anton/files/anton-latin-400-normal.woff2",
        "mono": FONTS / "ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2",
        "serif": FONTS / "newsreader/files/newsreader-latin-400-italic.woff2",
        "logo": FONTS / "montserrat/files/montserrat-latin-800-normal.woff2",
    }
    return ImageFont.truetype(str(paths[name]), size)


def latin(text):
    """Web fonts here are latin-only; drop text that would render as boxes."""
    return all(ord(c) < 0x2500 for c in text)


def fit(draw, text, name, max_width, start, minimum):
    size = start
    while size > minimum and draw.textlength(text, font=font(name, size)) > max_width:
        size -= 4
    return font(name, size)


def grain(img, amount=18):
    noise = Image.effect_noise(img.size, amount).convert("L")
    return Image.blend(img, Image.merge("RGB", (noise, noise, noise)), 0.06)


def dome(draw, cx, top, r, fg=FG, bg=BG):
    """CCTV dome with an eye — the Pushit mark. Flat edge at `top`, radius r."""
    draw.pieslice((cx - r, top - r, cx + r, top + r), 0, 180, fill=fg)
    ey, k = top + r * 0.46, r / 28  # eye centre, scale from the 64x30 SVG
    for rad, col, dx in ((8, bg, 0), (5, fg, 0), (3.1, bg, 1.4)):
        draw.ellipse((cx + dx * k - rad * k, ey + dx * 0.86 * k - rad * k, cx + dx * k + rad * k, ey + dx * 0.86 * k + rad * k), fill=col)


def logo(draw, x, y, size=34):
    """Boxed PUSHIT.TV wordmark over the dome, top-left at (x, y)."""
    f = font("logo", size)
    w = draw.textlength("PUSHIT.TV", font=f)
    px, py = size * 0.35, size * 0.22
    draw.rounded_rectangle((x, y, x + w + 2 * px, y + size + 2 * py), radius=size * 0.18, fill=FG)
    draw.text((x + px, y + py + size * 0.86), "PUSHIT.TV", font=f, fill=BG, anchor="ls")
    dome(draw, x + px + w / 2, y + size + 2 * py + size * 0.12, size * 1.2)


def rec(draw, x, y, label):
    f = font("mono", 22)
    draw.ellipse((x, y + 6, x + 14, y + 20), fill=RED)
    draw.text((x + 26, y), label.upper(), font=f, fill=FG)


# ---------------------------------------------------------------- icons


def icon(size, padding=0.0):
    """The dome alone — legible down to 16 px."""
    scale = 4  # draw big, downsample for smooth edges
    S = size * scale
    img = Image.new("RGB", (S, S), BG)
    d = ImageDraw.Draw(img)
    inner = S * (1 - 2 * padding)
    r = inner * 0.46
    dome(d, S / 2, S / 2 - r * 0.5, r)
    return img.resize((size, size), Image.LANCZOS)


def make_icons():
    icon(180, 0.08).save(PUBLIC / "apple-touch-icon.png")
    icon(192).save(PUBLIC / "icon-192.png")
    icon(512).save(PUBLIC / "icon-512.png")
    icon(512, 0.12).save(PUBLIC / "icon-maskable-512.png")  # safe zone for Android masks
    icon(256).save(PUBLIC / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])


# ---------------------------------------------------------------- open graph

W, H = 1200, 630


def backdrop(path):
    img = Image.open(path).convert("RGB")
    img = ImageOps.fit(img, (W, H), Image.LANCZOS)
    img = ImageOps.grayscale(img).convert("RGB")
    img = ImageEnhance.Contrast(img).enhance(1.25)
    img = ImageEnhance.Brightness(img).enhance(0.55)
    # darken the bottom-left where the type sits
    shade = Image.new("L", (W, H))
    sd = ImageDraw.Draw(shade)
    for y in range(H):
        sd.line([(0, y), (W, y)], fill=int(235 * (y / H) ** 1.4))
    return Image.composite(Image.new("RGB", (W, H), BG), img, shade)


def card(out, title, kicker, headline=None, stamp=None, image=None):
    img = backdrop(image) if image else Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    pad = 64
    logo(d, pad, 44)
    if stamp:
        f = font("mono", 26)
        d.text((W - pad, 58), stamp, font=f, fill=RED, anchor="ra")

    y = H - pad
    if headline and latin(headline):
        f = fit(d, headline, "serif", W - 2 * pad, 40, 26)
        d.text((pad, y), headline, font=f, fill=FG, anchor="ls")
        y -= 64
    big = fit(d, title.upper(), "display", W - 2 * pad, 150, 64)
    d.text((pad, y), title.upper(), font=big, fill=FG, anchor="ls")
    y -= big.size + 18
    rec(d, pad, y - 22, kicker)
    d.rectangle((0, H - 10, W, H), fill=RED)
    out.parent.mkdir(parents=True, exist_ok=True)
    grain(img).save(out, quality=86)


def frontmatter(path):
    text = path.read_text()
    block = text.split("---", 2)[1]
    get = lambda key: (re.search(rf"^{key}:\s*(.+)$", block, re.M) or [None, ""])[1].strip().strip("\"'“”")
    return {k: get(k) for k in ("subject", "title", "series", "date", "cover")}


def cover_path(ref):
    return PUBLIC / ref.lstrip("/") if ref.startswith("/") else PUBLIC / "media/ig" / f"{ref}.jpg"


def stamp(iso):
    y, m, d = iso.split("-")
    return f"({d}.{m}.{y[2:]})"


def make_og():
    og = PUBLIC / "og"
    hero = PUBLIC / "media/ig/DaVcpQwj-3d/07.jpg"  # Incantation, Bangalore Death Fest
    card(og / "default.jpg", "Documenting the sick and the disturbed.", "Pushit TV", image=hero)
    card(og / "log.jpg", "The tape log", "Archive", "Every rehearsal tape, scene diary and portrait.", image=PUBLIC / "media/ig/DYfEd_pjyA5/03.jpg")
    card(og / "spotted.jpg", "Spotted", "Mom, I'm on TV", "Everyone who's been caught on a Pushit tape.", image=PUBLIC / "media/ig/DYT8l99DolN/05.jpg")
    card(og / "work.jpg", "We make music videos", "Commissions open", "Godless. Maneating Orchid. Whoever's next.", image=PUBLIC / "media/yt/pnaWZvTfwAM.jpg")
    card(og / "about.jpg", "About Pushit TV", "About", "Documenting the sick and the disturbed.", image=PUBLIC / "media/ig/DXn00PVD-no/00.jpg")

    for md in sorted((ROOT / "src/content/episodes").glob("*.md")):
        fm = frontmatter(md)
        card(
            og / "tapes" / f"{md.stem}.jpg",
            fm["subject"],
            SERIES.get(fm["series"], ""),
            fm["title"],
            stamp(fm["date"]),
            cover_path(fm["cover"]),
        )

    for entry in json.loads((ROOT / "src/data/spotted.json").read_text()):
        kind = {"band": "Band", "artist": "Artist", "venue": "Venue", "promoter": "Promoter", "label": "Label"}[entry["kind"]]
        meta = " · ".join(x for x in (entry.get("city"), entry.get("genre")) if x)
        card(og / "spotted" / f"{entry['id']}.jpg", entry["name"], f"Spotted · {kind}", meta or None)


if __name__ == "__main__":
    make_icons()
    make_og()
    print("icons + og images written to public/")

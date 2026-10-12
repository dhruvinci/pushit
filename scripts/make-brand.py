#!/usr/bin/env python3
"""Generates icons and link-preview (Open Graph) images into public/.

Run after adding an episode or band:  .venv/bin/python scripts/make-brand.py
Needs Pillow (pip install pillow) and node_modules (the site's fonts, and sharp to draw the logo).
"""
import functools
import io
import json
import re
import subprocess
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


LOGO_SVG = (ROOT / "scripts/brand/pushit-logo.svg").read_text()
LOGO_PATHS = re.findall(r'<path class="cls-1" d="([^"]*)"', LOGO_SVG)  # wordmark bar is the last


def render_svg(svg, width):
    """Rasterise SVG with sharp (node_modules), since Pillow can't."""
    js = "let b=[];process.stdin.on('data',c=>b.push(c)).on('end',async()=>process.stdout.write(await require('sharp')(Buffer.concat(b),{density:300}).resize({width:+process.argv[1]}).png().toBuffer()))"
    out = subprocess.run(["node", "-e", js, str(round(width))], input=svg.encode(), capture_output=True, check=True, cwd=ROOT)
    return Image.open(io.BytesIO(out.stdout)).convert("RGBA")


def mark(paths, view_box, width, color=FG):
    d = "".join(f'<path d="{p}"/>' for p in paths)
    hexcol = "#%02x%02x%02x" % color
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view_box}"><g fill="{hexcol}">{d}</g></svg>'
    return render_svg(svg, width)


@functools.cache
def full_mark(width):
    return mark(LOGO_PATHS, "0 33.5 1000 525", width)


def logo(img, x, y, width=210):
    """The full mark (wordmark over the dome), top-left at (x, y)."""
    m = full_mark(width)
    img.paste(m, (x, y), m)


def rec(draw, x, y, label):
    f = font("mono", 22)
    draw.ellipse((x, y + 6, x + 14, y + 20), fill=RED)
    draw.text((x + 26, y), label.upper(), font=f, fill=FG)


# ---------------------------------------------------------------- icons


def icon(size, padding=0.0):
    """The dome alone, legible down to 16 px."""
    scale = 4  # draw big, downsample for smooth edges
    S = size * scale
    img = Image.new("RGB", (S, S), BG)
    w = round(S * (1 - 2 * padding) * 0.86)
    dome = mark(LOGO_PATHS[:2], "132 210 736 349", w)
    img.paste(dome, ((S - dome.width) // 2, (S - dome.height) // 2), dome)
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
    logo(img, pad, 44)
    if stamp:
        f = font("mono", 26)
        d.text((W - pad, 58), stamp, font=f, fill=RED, anchor="ra")

    y = H - pad
    if headline and latin(headline):
        f = fit(d, headline, "mono", W - 2 * pad, 32, 22)
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
    card(og / "default.jpg", "Scenes from the Scene.", "Pushit TV", image=hero)
    card(og / "log.jpg", "All videos", "Archive", "Every rehearsal tape, scene diary and portrait.", image=PUBLIC / "media/ig/DYfEd_pjyA5/03.jpg")
    card(og / "spotted.jpg", "Spotted", "Mom, I'm on TV", "Everyone who's been caught on a Pushit tape.", image=PUBLIC / "media/ig/DYT8l99DolN/05.jpg")
    card(og / "work.jpg", "We make music videos", "Commissions open", "Godless. Maneating Orchid. Whoever's next.", image=PUBLIC / "media/yt/pnaWZvTfwAM.jpg")
    card(og / "about.jpg", "About Pushit TV", "About", "Recorded evidence of India's underground music community.", image=PUBLIC / "media/ig/DXn00PVD-no/00.jpg")

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

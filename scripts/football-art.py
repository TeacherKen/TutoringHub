# Prepares the Football Times Tables pictures (run again only when the artwork changes):
#   python3 scripts/football-art.py <folder with stadium/keeper-*/kicker-* PNGs> public/games/football
# Trims each cut-out, softens its edge, resizes it, and recolours the kicker's white shirt and
# socks into each team colour (one picture per kit). Prints the sizes used in Stadium.tsx.
# Needs: pip install pillow numpy
import json, sys
from PIL import Image, ImageFilter, ImageChops
import numpy as np

SRC = sys.argv[1]; OUT = sys.argv[2]
KITS = {"red": (214, 40, 57), "blue": (31, 95, 214), "yellow": (247, 200, 21), "purple": (109, 63, 209), "orange": (242, 107, 29), "sky": (76, 181, 245), "white": None}
info = {}

def clean(name):
    im = Image.open(f"{SRC}/{name}.png").convert("RGBA")
    a = np.array(im).astype(np.float32)
    alpha = a[..., 3]
    alpha[alpha < 28] = 0                     # drop faint glow
    a[..., 3] = alpha
    im = Image.fromarray(a.clip(0, 255).astype(np.uint8), "RGBA")
    # soften the outermost pixel ring a little so edges don't look cut with scissors
    al = im.getchannel("A").filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    al = ImageChops.lighter(ImageChops.multiply(im.getchannel("A"), Image.new("L", im.size, 0)), al)
    im.putalpha(al)
    return im.crop(im.getchannel("A").point(lambda v: 255 if v > 40 else 0).getbbox())

def fit(im, h=None, w=None):
    if h: return im.resize((round(im.width * h / im.height), h), Image.LANCZOS)
    return im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)

def cloth_mask(im):
    a = np.array(im).astype(np.float32)
    rgb = a[..., :3]; mx = rgb.max(-1); mn = rgb.min(-1)
    sat = mx - mn; lum = rgb.mean(-1)
    m = np.clip((48 - sat) / 24, 0, 1) * np.clip((lum - 120) / 50, 0, 1) * (a[..., 3] / 255)
    return m, lum

def tint(im, rgb):
    m, lum = cloth_mask(im)
    a = np.array(im).astype(np.float32)
    shade = np.clip(lum / 232, 0, 1.15)[..., None]
    kit = np.array(rgb, np.float32)[None, None, :]
    coloured = np.clip(kit * shade + np.clip(shade - 1, 0, None) * 255, 0, 255)
    a[..., :3] = a[..., :3] * (1 - m[..., None]) + coloured * m[..., None]
    return Image.fromarray(a.clip(0, 255).astype(np.uint8), "RGBA")

def save(im, name, q=82):
    im.save(f"{OUT}/{name}.webp", "WEBP", quality=q, method=6)
    info[name] = {"w": im.width, "h": im.height}

for n, size in [("keeper-ready", dict(h=420)), ("keeper-high", dict(w=640)), ("keeper-low", dict(w=640))]:
    save(fit(clean(n), **size), n)

for n in ["kicker-ready", "kicker-shoot"]:
    base = fit(clean(n), h=720)
    m, _ = cloth_mask(base)
    # shirt = cloth in the top 55% of the figure; its middle is where the name and number go
    top = m.copy(); top[int(base.height * 0.55):, :] = 0
    ys, xs = np.nonzero(top > 0.5)
    info[n + "-shirt"] = {"cx": float(xs.mean()), "cy": float(ys.mean()), "x0": int(xs.min()), "x1": int(xs.max()), "y0": int(ys.min()), "y1": int(ys.max())}
    for kit, rgb in KITS.items():
        save(tint(base, rgb) if rgb else base, f"{n}-{kit}", q=80)

st = Image.open(f"{SRC}/stadium.png").convert("RGB")
st.save(f"{OUT}/stadium.webp", "WEBP", quality=80, method=6)
info["stadium"] = {"w": st.width, "h": st.height}
print(json.dumps(info, indent=1))

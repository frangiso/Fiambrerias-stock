from PIL import Image, ImageDraw, ImageFont
import os

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'icons')
os.makedirs(OUT, exist_ok=True)

BG = (45, 106, 79, 255)   # --primary
FG = (250, 247, 240, 255) # cream

def font(size):
    candidates = [
        r"C:\Windows\Fonts\segoeuib.ttf",
        r"C:\Windows\Fonts\arialbd.ttf",
        r"C:\Windows\Fonts\arial.ttf",
    ]
    for c in candidates:
        if os.path.exists(c):
            return ImageFont.truetype(c, size)
    return ImageFont.load_default()

def make_icon(size, path, rounded=True, text_ratio=0.42, full_bleed=False):
    img = Image.new('RGBA', (size, size), (0,0,0,0))
    draw = ImageDraw.Draw(img)
    if full_bleed:
        box = [0, 0, size, size]
        draw.rectangle(box, fill=BG)
    else:
        pad = int(size * 0.06)
        box = [pad, pad, size - pad, size - pad]
        radius = int((box[2]-box[0]) * 0.22)
        draw.rounded_rectangle(box, radius=radius, fill=BG)

    text = "LP"
    fsize = int(size * text_ratio)
    f = font(fsize)
    bbox = draw.textbbox((0,0), text, font=f)
    tw, th = bbox[2]-bbox[0], bbox[3]-bbox[1]
    cx, cy = size/2, size/2
    draw.text((cx - tw/2 - bbox[0], cy - th/2 - bbox[1]), text, font=f, fill=FG)
    img.save(path)

# Standard icons ("any" purpose) — rounded square with padding
make_icon(192, os.path.join(OUT, 'icon-192.png'))
make_icon(512, os.path.join(OUT, 'icon-512.png'))
# Maskable icons: full-bleed background + text kept within the ~80% safe zone
make_icon(192, os.path.join(OUT, 'icon-192-maskable.png'), full_bleed=True, text_ratio=0.34)
make_icon(512, os.path.join(OUT, 'icon-512-maskable.png'), full_bleed=True, text_ratio=0.34)
# Apple touch icon (no transparency, square, no external padding)
make_icon(180, os.path.join(OUT, 'apple-touch-icon.png'), full_bleed=True, text_ratio=0.4)
# Favicon-ish
make_icon(32, os.path.join(OUT, 'favicon-32.png'), full_bleed=True, text_ratio=0.5)

print("done")

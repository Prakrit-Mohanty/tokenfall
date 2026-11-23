"""Packs the road textures into js/models/road-tex.js: the asphalt from the american-road-intersection pack (Asphalt04, a tiling photo texture) for every
road surface, and the two-lane street strip from road--avenue--street (asphalt between white edge lines, a dashed centre line) for the side streets.
Both are graded into the game's look: lifted out of photo-black to a soft warm grey, a touch less contrast and colour, so a road reads as a road without
breaking the pastel world. Embedded as WebP so they load from file://. Run: python3 tools/roads-pack.py"""
import base64
import io
import os

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TINT = np.array([1.0, .985, 1.02])   # the faint mauve the game's greys carry


def grade(img, mean=.43, contrast=.7):
    a = np.asarray(img.convert('RGB'), dtype=np.float32) / 255
    lum = a.mean(axis=2, keepdims=True)
    a = lum + (a - lum) * .6                              # less colour
    a = (a - a.mean()) * contrast + mean                  # lifted and softened
    a = np.clip(a * TINT, 0, 1)
    return Image.fromarray((a * 255).astype(np.uint8))


def webp(img, q=82):
    b = io.BytesIO()
    img.save(b, 'WEBP', quality=q)
    return 'data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode()


asphalt = Image.open(os.path.join(ROOT, 'american-road-intersection/textures/Asphalt04.jpeg')).resize((512, 512), Image.LANCZOS)
asphalt = grade(asphalt)
# the strip: the asphalt between the kerbs (x 180-1240 of 2048), white edge lines and dashed centre line kept, one tile along the road
street = Image.open(os.path.join(ROOT, 'road--avenue--street/textures/road_Polygon_1_BaseColor.png')).convert('RGB').crop((180, 0, 1240, 2048)).resize((256, 512), Image.LANCZOS)
street = np.asarray(street, dtype=np.float32)
paint = street.min(axis=2) > 170                     # keep the white lines white: grade only the asphalt
g = np.asarray(grade(Image.fromarray(street.astype(np.uint8))), dtype=np.float32)
g[paint] = [236, 232, 226]
street = Image.fromarray(g.astype(np.uint8))

path = os.path.join(ROOT, 'js/models/road-tex.js')
with open(path, 'w') as f:
    f.write('// road textures: the asphalt tile and the two-lane street strip, graded into the game\'s palette and embedded. Built by tools/roads-pack.py\n')
    f.write(f'window.ROAD_TEX = {{ asphalt: "{webp(asphalt)}", street: "{webp(street)}" }};\n')
print(os.path.getsize(path) // 1024, 'KB')

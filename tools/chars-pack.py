"""Packs the 3D chibi characters into the atlases the game loads: js/sprites/chars-sheet.js (one WebP per character, embedded so WebGL works from file://)
and js/sprites/chars-data.js (an animation table per character for SpriteCharacter, plus where each frame sits in its atlas).

The source frames are 250x230 cells (feet at 125,222, standing height 172 px) and are the best art there is: nothing in the repo is bigger. So each frame is
upscaled SCALE times (Lanczos in premultiplied space, alpha edge re-sharpened, colour bled out under the edge, a mild unsharp), trimmed to its own figure and
shelf-packed. A frame's `box` says where the trimmed figure sat in the 250x230 cell, so the game draws it at the same size and spot as before.
Each atlas also gets a small volume map (a fake normal, a height and a cavity per frame, derived from the frame's alpha and luminance) that characters.js lights and depth-tests with. Only the animations the game plays are packed. Run: python3 tools/chars-pack.py"""
import base64
import io
import json
import os

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CELL, ANCHOR, STAND = (250, 230), (125, 222), 172
DIRS = ['down', 'up', 'left', 'right']
ROW8 = {'down': 0, 'up': 4, 'left': 6, 'right': 2}   # the 8-direction rows of tokenfall-characters (0, 45 ... 315 degrees) that are the game's four facings
SCALE = 2.5     # 172 px standing -> 430 px: ~220 texels per metre at the game's size, what the paving has (190-470) and what the default camera draws (~215 px/m)
PAD = 2         # source px of empty margin kept round each figure (room for the outline and the resample)
GUTTER = 4      # output px between frames in an atlas, so mip levels do not mix neighbours
ATLAS_W = 4096
# id: (name, source atlas, {anim: (first row in the source, frames, ms per frame, loops)}, jump lift px, jump air frames)
CHARS = {
    'aditya': ('Aditya Verma', 'aditya-3d/sprites/aditya3d.webp',
               {'idle': (0, 1, 160, True), 'walk': (4, 11, 83, True), 'run': (8, 11, 56, True), 'jump': (12, 12, 80, False)}, 56, (4, 8)),
    'sudhanshu': ('Sudhanshu', 'sudhanshu-3d-extras/sudhanshu3d.png',   # the lossless copy of sudhanshu-3d/sprites/sudhanshu3d.webp
                  {'idle': (0, 11, 160, True), 'walk': (4, 11, 83, True), 'run': (8, 10, 60, True), 'jump': (12, 11, 80, False)}, 34, (3, 7)),
    # the tokenfall-characters roster as lobby NPCs: idle (one still frame, the game's own sway and breathing do the rest) and walk, from the 8-direction rows
    'saanvi': ('Saanvi', 'tokenfall-characters-extras/saanvi.png', {'idle': ({d: ROW8[d] for d in DIRS}, 1, 200, True), 'walk': ({d: 8 + ROW8[d] for d in DIRS}, 8, 100, True)}, 0, (0, 0)),
    'mehta': ('Mr. Mehta', 'tokenfall-characters-extras/mehta.png', {'idle': ({d: ROW8[d] for d in DIRS}, 1, 200, True), 'walk': ({d: 8 + ROW8[d] for d in DIRS}, 8, 100, True)}, 0, (0, 0)),
    'aarav': ('Aarav', 'tokenfall-characters-extras/aarav.png', {'idle': ({d: ROW8[d] for d in DIRS}, 1, 200, True), 'walk': ({d: 8 + ROW8[d] for d in DIRS}, 12, 71, True)}, 0, (0, 0)),
    'riya': ('Riya', 'tokenfall-characters-extras/riya.png', {'idle': ({d: ROW8[d] for d in DIRS}, 1, 200, True), 'walk': ({d: 8 + ROW8[d] for d in DIRS}, 12, 71, True)}, 0, (0, 0)),
    # Prakrit on his Yamaha, the Pune bike taxi's rider: the bike pack's own 8 still poses (named by angle: 0 faces the camera, 90 faces right) and its leaned-in riding frame (last of the 4) for right and left
    'prakrit': ('Prakrit', 'prakrit-extras/prakrit-bike.png',
                {'idle': ({str(a): i for i, a in enumerate(range(0, 360, 45))}, 1, 200, True), 'ride': ({'right': (8, 3), 'left': (9, 3)}, 1, 200, True)}, 0, (0, 0)),
    # the same bike with the player (Aditya) riding pillion, for the ride itself: right and left only, still and leaned in (built by pillion_sheet below)
    'prakrit_ride': ('Prakrit', 'pillion', {'idle': ({'right': 0, 'left': 1}, 1, 200, True), 'ride': ({'right': 2, 'left': 3}, 1, 200, True)}, 0, (0, 0)),
    'gaurav': ('Gaurav', 'gaurav-npc-extras/gaurav.png',   # an NPC: idle and walk only (the lossless copy of gaurav-npc/sprites/gaurav.webp)
               {'idle': (0, 11, 200, True), 'walk': (4, 10, 95, True)}, 0, (0, 0)),
}


def box_blur(a, r):
    """Separable box blur of an HxW(xC) float array, edges clamped."""
    for ax in (0, 1):
        pad = [(0, 0)] * a.ndim
        pad[ax] = (r + 1, r)
        c = np.cumsum(np.pad(a, pad, mode='edge'), axis=ax)
        n = a.shape[ax]
        hi = np.take(c, range(2 * r + 1, 2 * r + 1 + n), axis=ax)
        lo = np.take(c, range(0, n), axis=ax)
        a = (hi - lo) / (2 * r + 1)
    return a


def blur(a, sigma):
    r = max(1, int(round(sigma * 0.8)))   # three box passes ~ a gaussian
    for _ in range(3):
        a = box_blur(a, r)
    return a


def upscale(frame, box, k):
    """frame: the 250x230 RGBA cell; box: x0, y0, x1, y1 to keep. Returns an RGBA uint8 array: straight colour (bled under the edge), a crisp-edged alpha."""
    crop = frame.crop(box)
    w, h = round(crop.width * k), round(crop.height * k)
    big = np.asarray(crop.convert('RGBa').resize((w, h), Image.LANCZOS).convert('RGBA'), dtype=np.float32) / 255.0   # resampled premultiplied: no halo from the transparent texels
    rgb, a = big[..., :3], big[..., 3]
    # colour: where the figure is solid keep it, everywhere else (the soft edge, the empty margin) bleed it outward, so filtering never pulls in a stray or black colour
    solid = (a >= 0.9).astype(np.float32)
    fill = rgb * solid[..., None]
    for sigma in (2.0, 5.0, 12.0):
        num, den = blur(fill, sigma), blur(solid, sigma)
        got = den > 1e-3
        fill = np.where((solid[..., None] > 0), fill, np.where(got[..., None], num / np.maximum(den, 1e-3)[..., None], fill))
        solid = np.maximum(solid, got.astype(np.float32))
    sharp = fill + 0.55 * (fill - blur(fill, 1.1))   # a mild unsharp mask restores some of the crispness the resample took
    sharp = np.clip(sharp, 0.0, 1.0)
    alpha = np.clip((a - 0.5) * 2.4 + 0.5, 0.0, 1.0)   # the edge ramp: ~2.5 px after the upscale, back to ~1 px
    alpha[a < 0.02] = 0.0
    return (np.dstack([sharp, alpha]) * 255.0).round().astype(np.uint8)


# The bike pack's cells are 418x385 (ground point 209,381) and Prakrit sits ~1.32x bigger on it than he stands on foot (hair 82 px vs 62 px across, the same 172 px foot frames as the roster), so it
# is drawn at 0.755 (`fit`, read as sizeK) and upscaled by 2.5 * 0.755 to keep the roster's texel density: his head then matches Aditya's.
BIKES = ('prakrit', 'prakrit_ride')
CELLS = {b: ((418, 385), (209, 381)) for b in BIKES}
BIKE_FIT = 0.755
SCALES = {b: SCALE * BIKE_FIT for b in BIKES}


# The passenger: the bike has only a small tail cowl, so Aditya's profile sprite is scaled to the bike's world size (1 / BIKE_FIT), his hips set on the tail behind Prakrit, his legs cut off just
# below them, and the bike and its rider drawn over him: the cowl hides the cut and the driver's back hides his side, so he reads as seated, a head and shoulders behind Prakrit.
# Per frame: bike (column, row), the hero's row (3 = facing right, 2 = left), and where his hips go (x, y in the 418x385 cell; the left frames mirror x).
PILLION_HIP = 0.78   # Aditya's hips, as a fraction of his figure's height from its top (a big head: the legs are short)
PILLION = [(0, 2, 3, 128, 226, False), (0, 6, 2, 128, 226, True), (3, 8, 3, 128, 246, False), (3, 9, 2, 128, 246, True)]


def pillion_sheet():
    bike = Image.open(os.path.join(ROOT, 'prakrit-extras/prakrit-bike.png')).convert('RGBA')
    hero = Image.open(os.path.join(ROOT, CHARS['aditya'][1])).convert('RGBA')
    bw, bh = CELLS['prakrit'][0]
    sheet = Image.new('RGBA', (bw, bh * len(PILLION)), (0, 0, 0, 0))
    k = 1 / BIKE_FIT
    for i, (bc, br, hr, hx, hy, mirror) in enumerate(PILLION):
        h = hero.crop((0, hr * CELL[1], CELL[0], (hr + 1) * CELL[1]))
        alpha = np.asarray(h)[..., 3]
        ys = np.where(alpha > 8)[0]
        hip = ys.min() + PILLION_HIP * (ys.max() - ys.min() + 1)
        cols = np.where(alpha[int(hip)] > 8)[0]
        if mirror:
            hx = bw - hx
        big = h.convert('RGBa').resize((round(CELL[0] * k), round(CELL[1] * k)), Image.LANCZOS).convert('RGBA')
        px, py = round(hx - (cols.min() + cols.max()) / 2 * k), round(hy - hip * k)
        layer = Image.new('RGBA', (bw, bh), (0, 0, 0, 0))
        layer.alpha_composite(big, (max(px, 0), max(py, 0)), (max(-px, 0), max(-py, 0), big.width, big.height))
        arr = np.asarray(layer).copy()
        arr[hy + 6:, :, 3] = 0
        cell = Image.fromarray(arr, 'RGBA')
        cell.alpha_composite(bike.crop((bc * bw, br * bh, (bc + 1) * bw, (br + 1) * bh)))
        sheet.alpha_composite(cell, (0, i * bh))
    return sheet


FIT = {'saanvi', 'mehta', 'aarav', 'riya'}   # their figures are drawn 1-5% shorter than the first three's 172 px: `fit` (written to chars-data.js, read by characters.js as sizeK) scales them to match

AUXDIV = 5   # the volume maps are drawn at 1/5 of the upscaled frames (0.5x the source): they are smooth, so the sampler fills in the rest


def pool(a, k):
    """Mean-pools an HxW(xC) array by k, padding with zeros to a multiple."""
    h, w = a.shape[:2]
    H, W = -(-h // k) * k, -(-w // k) * k
    p = np.pad(a, [(0, H - h), (0, W - w)] + [(0, 0)] * (a.ndim - 2))
    return p.reshape(H // k, k, W // k, k, *a.shape[2:]).mean(axis=(1, 3))


def volume_maps(tile):
    """A frame's fake volume, from its alpha and luminance, at 1/AUXDIV of its size. RGBA uint8:
    R, G = the surface normal's x and y (0.5 = flat; the z is implied), B = height (a soft dome from the silhouette: how far the pixel bulges toward the viewer),
    A = cavity (1 = open, down to 0.5 in creases: under the chin and hair, between arm and body). Outside the figure: flat, no height, open."""
    alpha = pool(tile[..., 3].astype(np.float32) / 255.0, AUXDIV)
    rgb = pool(tile[..., :3].astype(np.float32) / 255.0, AUXDIV)
    lum = rgb @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    m = (alpha > 0.5).astype(np.float32)
    dome = 0.3 * blur(m, 2.0) + 0.4 * blur(m, 4.5) + 0.3 * blur(m, 9.0)   # three scales: a pillow across the whole body, not only at its rim
    inside = np.clip(blur(m, 1.0) * 1.6 - 0.3, 0.0, 1.0)
    detail = (blur(lum, 0.8) - blur(lum, 2.6)) * m   # curls, folds and seams: brighter reads as raised
    h = dome + 0.9 * detail
    gy, gx = np.gradient(h)
    nx, ny = -9.0 * gx * inside, 9.0 * gy * inside
    mag = np.maximum(1.0, np.sqrt(nx * nx + ny * ny) / 0.95)
    nx, ny = nx / mag, ny / mag
    base = blur(lum, 3.5)
    cav = np.clip((base - lum) / (base + 0.06), 0.0, 0.5) * inside
    out = np.dstack([nx * 0.5 + 0.5, ny * 0.5 + 0.5, dome * inside, 1.0 - cav])
    return (np.clip(out, 0.0, 1.0) * 255.0).round().astype(np.uint8)


def dirs_of(r0):
    return list(r0) if isinstance(r0, dict) and set(r0) != set(DIRS) else DIRS   # a dict keyed by its own facings (the bike's angles), else the game's four


def pack(cid, img, anims):
    """Upscales and shelf-packs one character's frames. Returns the atlas image and, per frame, [atlas x, y, w, h, box x, y, w, h]."""
    tiles = []   # (key, array, box)
    cw, ch = CELLS.get(cid, (CELL, ANCHOR))[0]
    for anim, (r0, frames, ms, loop) in anims.items():
        for i, d in enumerate(dirs_of(r0)):
            for f in range(frames):
                row, col0 = (lambda v: v if isinstance(v, tuple) else (v, 0))(r0[d] if isinstance(r0, dict) else r0 + i)   # r0: the first of four rows (down, up, left, right), or a row (or row, first column) per facing
                cell = img.crop(((f + col0) * cw, row * ch, (f + col0 + 1) * cw, (row + 1) * ch))
                ys, xs = np.where(np.asarray(cell)[..., 3] > 8)
                x0, x1, y0, y1 = (int(v) for v in (max(0, xs.min() - PAD), min(cw, xs.max() + 1 + PAD), max(0, ys.min() - PAD), min(ch, ys.max() + 1 + PAD)))
                tiles.append(((anim, d, f), upscale(cell, (x0, y0, x1, y1), SCALES.get(cid, SCALE)), (x0, y0, x1 - x0, y1 - y0)))
    order = sorted(range(len(tiles)), key=lambda t: -tiles[t][1].shape[0])
    pos, x, y, rowh = {}, GUTTER, GUTTER, 0
    for t in order:
        th, tw = tiles[t][1].shape[:2]
        if x + tw + GUTTER > ATLAS_W:
            x, y, rowh = GUTTER, y + rowh + GUTTER, 0
        pos[t] = (x, y)
        x += tw + GUTTER
        rowh = max(rowh, th)
    height = y + rowh + GUTTER
    atlas = np.zeros((height, ATLAS_W, 4), np.uint8)
    aux = np.zeros((round(height / AUXDIV), round(ATLAS_W / AUXDIV), 4), np.uint8)
    aux[...] = (128, 128, 0, 255)   # flat, no height, open
    for t, (px, py) in pos.items():
        a = tiles[t][1]
        atlas[py:py + a.shape[0], px:px + a.shape[1]] = a
        v = volume_maps(a)
        ax, ay = px // AUXDIV, py // AUXDIV
        v = v[:aux.shape[0] - ay, :aux.shape[1] - ax]
        aux[ay:ay + v.shape[0], ax:ax + v.shape[1]] = v
    return Image.fromarray(atlas, 'RGBA'), Image.fromarray(aux, 'RGBA'), {tiles[t][0]: [*pos[t], tiles[t][1].shape[1], tiles[t][1].shape[0], *tiles[t][2]] for t in pos}


data, sheets, auxes, total = {}, {}, {}, 0
for cid, (name, src, anims, lift, air) in CHARS.items():
    img = pillion_sheet() if src == 'pillion' else Image.open(os.path.join(ROOT, src)).convert('RGBA')
    atlas, aux, rects = pack(cid, img, anims)
    table, order, air_ms = {}, [], None
    for anim, (r0, frames, ms, loop) in anims.items():
        for d in dirs_of(r0):
            table[f'{anim}_{d}'] = {'start': len(order), 'frames': frames, 'durations': [ms] * frames, 'loop': loop}
            order += [rects[(anim, d, f)] for f in range(frames)]
        if anim == 'jump': air_ms = [air[0] * ms, (air[1] + 1) * ms]
    buf = io.BytesIO()
    atlas.save(buf, 'WEBP', quality=90, alpha_quality=100, method=4)
    sheets[cid] = base64.b64encode(buf.getvalue()).decode()
    abuf = io.BytesIO()
    aux.save(abuf, 'WEBP', lossless=True, exact=True)   # lossless and exact: the channels are data, and a transparent-looking pixel must keep its values
    auxes[cid] = base64.b64encode(abuf.getvalue()).decode()
    cell, anchor = CELLS.get(cid, (CELL, ANCHOR))
    data[cid] = {'name': name, 'id': cid, 'cell': {'w': cell[0], 'h': cell[1]}, 'anchor': {'x': anchor[0], 'y': anchor[1]}, 'standHeight': STAND,
                 'fit': BIKE_FIT if cid in BIKES else round(STAND / (sum(rects[('idle', d, 0)][7] - 2 * PAD for d in DIRS) / 4), 4) if cid in FIT else 1,
                 'jumpHeight': lift, 'jumpAir': air_ms, 'actions': [a for a in ('jump', 'run') if a in anims], 'animations': table,
                 'atlas': {'w': atlas.width, 'h': atlas.height, 'scale': SCALES.get(cid, SCALE)}, 'rects': order}
    total += atlas.width * atlas.height
    print(cid, atlas.size, 'aux', aux.size, len(order), 'frames', len(buf.getvalue()) // 1024, 'KB +', len(abuf.getvalue()) // 1024, 'KB volume maps')

out = os.path.join(ROOT, 'js/sprites')
with open(os.path.join(out, 'chars-sheet.js'), 'w') as f:
    f.write(f'// one WebP atlas per character, {SCALE}x the source frames, trimmed and shelf-packed (rects in chars-data.js), embedded so WebGL can use them from file://. Built by tools/chars-pack.py\n')
    f.write('window.CHAR_SHEETS = {' + ','.join(f'"{c}":"data:image/webp;base64,{b}"' for c, b in sheets.items()) + '};\n')
    f.write('// the volume maps, one per atlas on the same uv rects (R,G normal x,y; B height; A cavity: see volume_maps in tools/chars-pack.py)\n')
    f.write('window.CHAR_AUX = {' + ','.join(f'"{c}":"data:image/webp;base64,{b}"' for c, b in auxes.items()) + '};\n')
with open(os.path.join(out, 'chars-data.js'), 'w') as f:
    f.write('// Animation tables and atlas rects for the atlases in chars-sheet.js, one per character. Built by tools/chars-pack.py\n')
    f.write('// rects[i] = [atlas x, y, w, h, box x, y, w, h]: the frame in the atlas (px, y from the top) and where its figure sat in the 250x230 cell. An animation plays rects[start + frame].\n')
    f.write(f'window.CHARS = {json.dumps(data, separators=(",", ":"))};\n')
print('atlas total', round(total / 1e6, 1), 'MP =', round(total * 4 / 1e6), 'MB RGBA (+33% mips)')

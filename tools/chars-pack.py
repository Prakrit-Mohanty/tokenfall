"""Packs the 3D chibi characters into the one sheet the game loads: js/sprites/chars-sheet.js (embedded, so WebGL works from file://) and
js/sprites/chars-data.js (an animation table per character for SpriteCharacter). Both atlases share one cell layout (250x230, feet at 125,222,
standing height 172 px), so they come out the same size in the world. Only the animations the game plays are packed, at full resolution.
Run: python3 tools/chars-pack.py"""
import base64
import io
import json
import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CELL, ANCHOR, STAND = (250, 230), (125, 222), 172
DIRS = ['down', 'up', 'left', 'right']
# id: (name, source atlas, {anim: (first row in the source, frames, ms per frame, loops)}, jump lift px, jump air frames)
CHARS = {
    'aditya': ('Aditya Verma', 'aditya-3d/sprites/aditya3d.webp',
               {'idle': (0, 8, 160, True), 'walk': (4, 11, 83, True), 'run': (8, 11, 56, True), 'jump': (12, 12, 80, False)}, 56, (4, 8)),
    'sudhanshu': ('Sudhanshu', 'sudhanshu-3d-extras/sudhanshu3d.png',   # the lossless copy of sudhanshu-3d/sprites/sudhanshu3d.webp
                  {'idle': (0, 11, 160, True), 'walk': (4, 11, 83, True), 'run': (8, 10, 60, True), 'jump': (12, 11, 80, False)}, 34, (3, 7)),
    'gaurav': ('Gaurav', 'gaurav-npc-extras/gaurav.png',   # an NPC: idle and walk only (the lossless copy of gaurav-npc/sprites/gaurav.webp)
               {'idle': (0, 11, 200, True), 'walk': (4, 10, 95, True)}, 0, (0, 0)),
}

cols = max(f for c in CHARS.values() for (_, f, _, _) in c[2].values())
rows = sum(len(c[2]) * 4 for c in CHARS.values())
sheet = Image.new('RGBA', (cols * CELL[0], rows * CELL[1]))
data, row = {}, 0
for cid, (name, src, anims, lift, air) in CHARS.items():
    img = Image.open(os.path.join(ROOT, src)).convert('RGBA')
    table, air_ms = {}, None
    for anim, (r0, frames, ms, loop) in anims.items():
        jump = anim == 'jump'
        for i, d in enumerate(DIRS):
            strip = img.crop((0, (r0 + i) * CELL[1], frames * CELL[0], (r0 + i + 1) * CELL[1]))
            sheet.paste(strip, (0, row * CELL[1]))
            table[f'{anim}_{d}'] = {'row': row, 'frames': frames, 'durations': [ms] * frames, 'loop': loop}
            row += 1
        if jump: air_ms = [air[0] * ms, (air[1] + 1) * ms]
    data[cid] = {'name': name, 'id': cid, 'cell': {'w': CELL[0], 'h': CELL[1]}, 'anchor': {'x': ANCHOR[0], 'y': ANCHOR[1]}, 'standHeight': STAND,
                 'jumpHeight': lift, 'jumpAir': air_ms, 'actions': [a for a in ('jump', 'run') if a in anims], 'animations': table}

buf = io.BytesIO(); sheet.save(buf, 'WEBP', quality=90, method=6)
out = os.path.join(ROOT, 'js/sprites')
with open(os.path.join(out, 'chars-sheet.js'), 'w') as f:
    f.write(f'// the character sheet ({sheet.width}x{sheet.height}, {CELL[0]}x{CELL[1]} cells: {", ".join(CHARS)}), embedded so WebGL can use it from file://. Built by tools/chars-pack.py\n')
    f.write('window.CHAR_SHEET = "data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode() + '";\n')
with open(os.path.join(out, 'chars-data.js'), 'w') as f:
    f.write('// Animation tables for the sheet in chars-sheet.js, one per character. Built by tools/chars-pack.py\n')
    f.write(f'window.CHARS = {json.dumps(data)};\nwindow.CHAR_SHEET_SIZE = [{sheet.width}, {sheet.height}];\n')
print(sheet.size, len(buf.getvalue()) // 1024, 'KB')

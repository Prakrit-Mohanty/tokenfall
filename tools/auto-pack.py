"""Packs the low-poly autorickshaw (low-poly-autorickshaw-aka-tuktuk, a free royalty-free model) into js/models/autorickshaw.js: one indexed mesh
per material (body, cloth, glass, tyre) and its texture atlas as an embedded WebP, so it loads from file:// like the character sheet.
Positions are in the model's own metres (front at +z, wheels on y=0); city.js scales it to the game's auto size. Run: python3 tools/auto-pack.py"""
import base64
import io
import json
import os
import zipfile

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'low-poly-autorickshaw-aka-tuktuk')
TEX_SIZE = 1024   # the 2048 atlas is far more than an auto ~2.6 m long ever shows on screen

with zipfile.ZipFile(os.path.join(SRC, 'source/autorickshaw.zip')) as z:
    obj = z.read('auto Rickshaw.obj').decode()

v, vt, vn, parts, mat = [], [], [], {}, 'body'
for line in obj.splitlines():
    t = line.split()
    if not t:
        continue
    if t[0] == 'v':
        v.append([float(x) for x in t[1:4]])
    elif t[0] == 'vt':
        vt.append([float(x) for x in t[1:3]])
    elif t[0] == 'vn':
        vn.append([float(x) for x in t[1:4]])
    elif t[0] == 'usemtl':
        mat = t[1]
    elif t[0] == 'f':
        p = parts.setdefault(mat, {'keys': {}, 'p': [], 'uv': [], 'n': [], 'i': []})
        idx = []
        for c in t[1:]:
            a = c.split('/')
            key = tuple(int(x) if x else 0 for x in a)
            if key not in p['keys']:
                p['keys'][key] = len(p['keys'])
                p['p'] += [round(x, 4) for x in v[key[0] - 1]]
                p['uv'] += [round(x, 4) for x in vt[key[1] - 1]] if key[1] else [0, 0]
                p['n'] += [round(x, 3) for x in vn[key[2] - 1]] if len(key) > 2 and key[2] else [0, 1, 0]
            idx.append(p['keys'][key])
        for k in range(1, len(idx) - 1):   # fan-triangulate the quads and n-gons
            p['i'] += [idx[0], idx[k], idx[k + 1]]

out = {m: {k: p[k] for k in ('p', 'uv', 'n', 'i')} for m, p in parts.items()}
img = Image.open(os.path.join(SRC, 'textures/Material.001-Colour_copy_2.png')).convert('RGBA').resize((TEX_SIZE, TEX_SIZE), Image.LANCZOS)
buf = io.BytesIO()
img.save(buf, 'WEBP', quality=88)
tex = 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode()

os.makedirs(os.path.join(ROOT, 'js/models'), exist_ok=True)
with open(os.path.join(ROOT, 'js/models/autorickshaw.js'), 'w') as f:
    f.write('// the low-poly autorickshaw: indexed meshes per material and the texture atlas, embedded so WebGL can use it from file://. Built by tools/auto-pack.py\n')
    f.write('window.AUTO_MODEL = ' + json.dumps(out, separators=(',', ':')) + ';\n')
    f.write('window.AUTO_TEX = "' + tex + '";\n')
for m, p in out.items():
    print(m, len(p['p']) // 3, 'verts', len(p['i']) // 3, 'tris')
print(os.path.getsize(os.path.join(ROOT, 'js/models/autorickshaw.js')) // 1024, 'KB')

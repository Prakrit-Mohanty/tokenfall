"""Packs the street-and-city-props pack (street-and-city-props-dumpster-traffic-light, free royalty-free models) into js/models/street-props.js:
one indexed mesh per prop, in its own metres (base on y=0), and the shared base-colour atlas as an embedded WebP, so it loads from file:// like
the character sheet. city.js / props.js / buildings.js build the props from it. Run: python3 tools/props-pack.py"""
import base64
import io
import json
import os
import struct
import zipfile

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'street-and-city-props-dumpster-traffic-light')
TEX_SIZE = 1024
# the glb's nodes (unnamed in the file) by what they are; only the ones the game places are packed. The rest, US-style or spare:
# 0 mast-arm signal, 1 dumpster, 5 yellow hydrant, 6 stop sign, 9 street-name sign
NAMES = {2: 'trashCan', 3: 'litterBin', 4: 'hydrant', 7: 'signal', 8: 'lamp'}
CT = {5126: np.float32, 5123: np.uint16, 5125: np.uint32, 5121: np.uint8}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}

with zipfile.ZipFile(os.path.join(SRC, 'source/street_city_props.zip')) as z:
    b = z.read('street_city_props/glb/street_city_props.glb')
n = struct.unpack('<I', b[12:16])[0]
g = json.loads(b[20:20 + n])
binary = b[20 + n + 8:]


def acc(i):
    a = g['accessors'][i]
    v = g['bufferViews'][a['bufferView']]
    c, dt = NC[a['type']], np.dtype(CT[a['componentType']])
    stride = v.get('byteStride', 0) or dt.itemsize * c
    start = v.get('byteOffset', 0) + a.get('byteOffset', 0)
    rows = [np.frombuffer(binary, dtype=dt, count=c, offset=start + k * stride) for k in range(a['count'])] if stride != dt.itemsize * c else None
    return np.array(rows) if rows is not None else np.frombuffer(binary, dtype=dt, count=c * a['count'], offset=start).reshape(-1, c)


out = {}
for k, name in NAMES.items():
    p = g['meshes'][g['nodes'][k]['mesh']]['primitives'][0]
    at = p['attributes']
    out[name] = {'p': np.round(acc(at['POSITION']), 4).ravel().tolist(), 'uv': np.round(acc(at['TEXCOORD_0']), 4).ravel().tolist(),
                 'n': np.round(acc(at['NORMAL']), 3).ravel().tolist(), 'i': acc(p['indices']).ravel().astype(int).tolist()}

src = g['images'][g['textures'][g['materials'][0]['pbrMetallicRoughness']['baseColorTexture']['index']]['source']]
v = g['bufferViews'][src['bufferView']]
img = Image.open(io.BytesIO(binary[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']])).convert('RGB').resize((TEX_SIZE, TEX_SIZE), Image.LANCZOS)
buf = io.BytesIO()
img.save(buf, 'WEBP', quality=88)

os.makedirs(os.path.join(ROOT, 'js/models'), exist_ok=True)
path = os.path.join(ROOT, 'js/models/street-props.js')
with open(path, 'w') as f:
    f.write('// street props (lamp, traffic signal, bins, hydrants, dumpster, signs): indexed meshes and the shared atlas, embedded so WebGL can use it from file://. Built by tools/props-pack.py\n')
    f.write('window.STREET_PROPS = ' + json.dumps(out, separators=(',', ':')) + ';\n')
    f.write('window.STREET_PROPS_TEX = "data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode() + '";\n')
for name, p in out.items():
    P = np.array(p['p']).reshape(-1, 3)
    print(name, len(p['i']) // 3, 'tris', 'min', P.min(0).round(2), 'max', P.max(0).round(2))
print(os.path.getsize(path) // 1024, 'KB')

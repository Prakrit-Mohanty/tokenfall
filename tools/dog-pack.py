"""Packs the robot dog (robo-dog, one posed mesh with its own textures, no rig) into js/models/robodog.js for the lobby's roaming dog: scaled to the
game's ~1.1 m dog, standing on y=0, its head towards +x (the way village-ai.js steers it), textures shrunk to 1024, embedded as a base64 GLB so it
loads from file://. village-ai.js parses it with GLTFLoader. Run with Blender: /Applications/Blender.app/Contents/MacOS/Blender -b --python tools/dog-pack.py"""
import base64
import math
import os
import tempfile

import bpy
import mathutils

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LENGTH = 1.1
HEAD_AT = -1   # the model's head is at -x in Blender: turned round so it leads along +x

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT, 'robo-dog/source/Robo-dog.glb'))
o = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
w = o.matrix_world.copy(); o.parent = None; o.matrix_world = w
for x in [x for x in bpy.context.scene.objects if x is not o]:
    bpy.data.objects.remove(x)
bpy.context.view_layer.objects.active = o; o.select_set(True)
if HEAD_AT < 0:
    o.rotation_euler.z = math.pi
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
# Blender +x stays glTF +x; so the head ends up at +x, which is the dog's forward in the game
bb = [o.matrix_world @ mathutils.Vector(c) for c in o.bound_box]
lo = [min(b[k] for b in bb) for k in range(3)]; hi = [max(b[k] for b in bb) for k in range(3)]
s = LENGTH / (hi[0] - lo[0])
o.location = (-(lo[0] + hi[0]) / 2 * s, -(lo[1] + hi[1]) / 2 * s, -lo[2] * s); o.scale = (s, s, s)
bpy.ops.object.transform_apply(location=True, scale=True)
for img in bpy.data.images:
    if max(img.size) > 1024:
        k = 1024 / max(img.size); img.scale(int(img.size[0] * k), int(img.size[1] * k))
    img.pack()
path = os.path.join(tempfile.mkdtemp(), 'dog.glb')
bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_yup=True, export_apply=True, export_image_format='JPEG', export_jpeg_quality=85)
data = base64.b64encode(open(path, 'rb').read()).decode()
with open(os.path.join(ROOT, 'js/models/robodog.js'), 'w') as f:
    f.write('// the lobby robot dog (robo-dog) as a GLB, embedded so it loads from file://. Built by tools/dog-pack.py (run with Blender)\n')
    f.write(f'window.ROBODOG_MODEL = "{data}";\n')
print('packed dog', len(o.data.polygons), 'faces', os.path.getsize(path) // 1024, 'KB', 'size', [round(h - l, 2) for l, h in zip(lo, hi)])

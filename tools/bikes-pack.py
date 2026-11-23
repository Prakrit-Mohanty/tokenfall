"""Packs the motorbikes into js/models/bikes.js for the game: the Bajaj Avenger 180 (bajaj_avenger_180cc_redux.glb), the Suzuki GSX-R 750
(2010_suzuki_gsx-r_750.glb) and Evel Knievel on his Triumph Rocket (evel-knievel-triumph-rocket-1028s.zip, an FBX with its textures). Each is
decimated, scaled to its real length, turned to face +z, stood upright with its wheels on y=0, and exported as a GLB with small textures, embedded
as base64 so it loads from file://. The game has no environment map, so everything is made non-metallic, and near-black parts are lifted so they
do not read as holes. Run with Blender: /Applications/Blender.app/Contents/MacOS/Blender -b --python tools/bikes-pack.py"""
import base64
import math
import os
import tempfile

import bmesh
import bpy
import mathutils

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEX_MAX = 512


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def joined():
    """All meshes joined into one object, transforms applied."""
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    for o in meshes:   # bake each part's parent transforms in before the helper empties go (the FBX hangs wheels and doors off them)
        w = o.matrix_world.copy()
        o.parent = None
        o.matrix_world = w
    for o in list(bpy.context.scene.objects):
        if o.type != 'MESH':
            bpy.data.objects.remove(o)
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.rotation_mode = 'XYZ'   # the glTF importer leaves quaternions, which would ignore the rotation_euler turns below
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return o


def drop_faces(o, keep, far=None):
    """Deletes the faces keep(face, material name) rejects, and (with far, in the model's own units) any face reaching that far out: the M3's broken vertices.
    Not a default: the M4 is modelled ~22 units long, and a fixed cut-off took its nose and tail off."""
    bm = bmesh.new()
    bm.from_mesh(o.data)
    names = [m.name if m else '' for m in o.data.materials]
    bad = [f for f in bm.faces if not keep(f, names[f.material_index] if names else '') or (far is not None and any(abs(c) > far for v in f.verts for c in v.co))]
    bmesh.ops.delete(bm, geom=bad, context='FACES')
    loose = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=loose, context='VERTS')
    bm.to_mesh(o.data)
    bm.free()


def decimate(o, tris):
    have = sum(len(p.vertices) - 2 for p in o.data.polygons)
    if have > tris:
        m = o.modifiers.new('dec', 'DECIMATE')
        m.ratio = tris / have
        bpy.ops.object.modifier_apply(modifier='dec')


def place(o, front_y, length):
    """Front to -y (glTF +z after the Y-up export), the long side to length, centred, wheels on the ground."""
    if front_y > 0:
        o.rotation_euler.z = math.pi
        bpy.ops.object.transform_apply(rotation=True)
    bb = [o.matrix_world @ mathutils.Vector(c) for c in o.bound_box]
    lo = [min(b[k] for b in bb) for k in range(3)]
    hi = [max(b[k] for b in bb) for k in range(3)]
    s = length / (hi[1] - lo[1])
    o.location = (-(lo[0] + hi[0]) / 2 * s, -(lo[1] + hi[1]) / 2 * s, -lo[2] * s)
    o.scale = (s, s, s)
    bpy.ops.object.transform_apply(location=True, scale=True)


def material(m, color=None, rough=.5, metal=0., alpha=1., emit=None):
    m.use_nodes = True
    b = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if b is None:   # a material with no shader (the Cybertruck's): give it a plain one wired to the output
        b = m.node_tree.nodes.new('ShaderNodeBsdfPrincipled')
        out = next((n for n in m.node_tree.nodes if n.type == 'OUTPUT_MATERIAL'), None) or m.node_tree.nodes.new('ShaderNodeOutputMaterial')
        m.node_tree.links.new(b.outputs['BSDF'], out.inputs['Surface'])
    if color is not None:
        for n in [n for n in m.node_tree.nodes if n.type == 'TEX_IMAGE']:
            m.node_tree.nodes.remove(n)
        b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
        m.blend_method = 'BLEND'
    if emit:
        b.inputs['Emission Color' if 'Emission Color' in b.inputs else 'Emission'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = 1.0


def small_images(tex_max=TEX_MAX):
    for img in bpy.data.images:
        if img.size[0] > tex_max or img.size[1] > tex_max:
            k = tex_max / max(img.size)
            img.scale(max(1, int(img.size[0] * k)), max(1, int(img.size[1] * k)))
        img.pack()


def solid(o, glass=False):
    """Every material not deliberately see-through (glass, lights: alpha below 1) is made opaque, with any texture alpha unwired: imported models
    (the M3's FBX, the M4's GLB) wire texture alpha in, which exports the whole body see-through with dark seams where the cabin shows.
    glass=True makes the glass solid too (dark and glossy): for every car whose cabin was dropped, see-through glass only shows an empty shell."""
    for m in [m for m in o.data.materials if m and m.use_nodes]:
        b = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if b is None or (not glass and not b.inputs['Alpha'].links and b.inputs['Alpha'].default_value < 1):
            continue
        for link in list(b.inputs['Alpha'].links):
            m.node_tree.links.remove(link)
        b.inputs['Alpha'].default_value = 1
        m.blend_method = 'OPAQUE'


def export(see_through=False):
    solid(next(o for o in bpy.context.scene.objects if o.type == 'MESH'), glass=not see_through)
    path = os.path.join(tempfile.mkdtemp(), 'bike.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_yup=True, export_apply=True, export_image_format='JPEG', export_jpeg_quality=85)
    o = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
    print('packed', sum(len(p.vertices) - 2 for p in o.data.polygons), 'tris', os.path.getsize(path) // 1024, 'KB')
    return base64.b64encode(open(path, 'rb').read()).decode()


def turn(o, deg):
    """Turns the model about the vertical axis (for a model modelled along x: place() wants it along y)."""
    o.rotation_euler.z = math.radians(deg)
    bpy.ops.object.transform_apply(rotation=True)
    bpy.context.view_layer.update()   # or place() reads the stale, unturned bound box


def matte(o, tyres=(), floor=.12):
    """No metal anywhere (no env map to reflect: metal renders black), tyres a rubber grey, and any untextured near-black colour lifted to floor."""
    for m in [m for m in o.data.materials if m]:
        if m.name in tyres:
            material(m, (.16, .16, .17), rough=.85)
            continue
        material(m, rough=.5)
        b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        for link in list(b.inputs['Metallic'].links):
            m.node_tree.links.remove(link)
        if not b.inputs['Base Color'].links:
            c = list(b.inputs['Base Color'].default_value)
            if max(c[:3]) < floor:
                k = floor / max(max(c[:3]), 1e-3)
                b.inputs['Base Color'].default_value = (*[min(1, max(floor, x * k)) for x in c[:3]], c[3])


def weld(o, dist=1e-4):
    """Merges coincident vertices: the GSX-R's parts are unwelded triangle soup, which the decimator collapsed into spikes metres long."""
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=dist)
    bm.to_mesh(o.data)
    bm.free()


def lift(img, floor):
    """Raises a texture's darks to floor (its blacks read as holes in the game's soft light), keeping the highlights: p -> floor + (1 - floor) p."""
    import numpy as np
    px = np.empty(len(img.pixels), dtype=np.float32)
    img.pixels.foreach_get(px)
    px = px.reshape(-1, 4)
    px[:, :3] = floor + (1 - floor) * px[:, :3]
    img.pixels.foreach_set(px.ravel())
    img.update()


def avenger():
    """Bajaj Avenger 180 (bajaj_avenger_180cc_redux.glb): ~515 k triangles in ~2900 parts, modelled along y with its headlight at +y."""
    reset()
    bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT, 'bajaj_avenger_180cc_redux.glb'))
    o = joined()
    matte(o, tyres=('tyre',))
    decimate(o, 20000)
    place(o, 1, 2.2)   # its headlight is at +y
    small_images()
    return export(see_through=True)


def gsxr():
    """Suzuki GSX-R 750 2010 (2010_suzuki_gsx-r_750.glb): modelled along x with its headlight at +x (its red tail light at -x); Roue: the tyres."""
    reset()
    bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT, '2010_suzuki_gsx-r_750.glb'))
    o = joined()
    turn(o, 90)   # +x to +y
    matte(o, tyres=('Roue',))
    weld(o)
    decimate(o, 20000)
    place(o, 1, 2.05)
    small_images()
    return export(see_through=True)


def evel():
    """Evel Knievel on a Triumph Rocket 3 (evel-knievel-triumph-rocket-1028s.zip): an FBX of two ~1.5 M-triangle meshes, 'material.001' the bike
    and 'Assembly-4' the rider; its image paths point at the author's machine, so they are relinked to the zip's textures/ by file name. The normal
    maps go (the game's look is soft and flat, and they would double the file); the bike's front is at -y."""
    reset()
    import zipfile
    tmp = tempfile.mkdtemp()
    zipfile.ZipFile(os.path.join(ROOT, 'evel-knievel-triumph-rocket-1028s.zip')).extractall(tmp)
    src = next(os.path.join(d, f) for d, _, fs in os.walk(tmp) for f in fs if f.lower().endswith('.fbx'))
    tex = {f.lower(): os.path.join(d, f) for d, _, fs in os.walk(tmp) for f in fs if f.lower().endswith('.png')}
    bpy.ops.import_scene.fbx(filepath=src)
    for img in bpy.data.images:
        f = tex.get(os.path.basename(img.filepath).lower())
        if f:
            img.filepath = f
            img.reload()
    for m in bpy.data.materials:
        if m.use_nodes:
            b = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
            for n in [n for n in m.node_tree.nodes if n.type in ('NORMAL_MAP', 'TEX_IMAGE') and not any(l.to_node == b and l.to_socket.name == 'Base Color' for l in n.outputs[0].links)]:
                m.node_tree.nodes.remove(n)
    o = joined()
    matte(o)
    decimate(o, 30000)
    place(o, -1, 2.4)
    small_images(1024)
    for img in bpy.data.images:   # both textures are near-black (the bike's is black paint and chrome, 90% of it under .26): lifted so they read
        lift(img, .2 if 'Tevel' not in img.filepath else .1)
        img.pack()
    return export(see_through=True)


bikes = {'avenger': avenger(), 'evel': evel(), 'gsxr': gsxr()}
os.makedirs(os.path.join(ROOT, 'js/models'), exist_ok=True)
with open(os.path.join(ROOT, 'js/models/bikes.js'), 'w') as f:
    f.write('// the motorbikes as GLB files, embedded so they load from file://. Built by tools/bikes-pack.py (run with Blender)\n')
    f.write('window.BIKE_MODELS = {\n')
    for k, b in bikes.items():
        f.write(f'  {k}: "{b}",\n')
    f.write('};\n')
print('bikes.js', os.path.getsize(os.path.join(ROOT, 'js/models/bikes.js')) // 1024, 'KB')

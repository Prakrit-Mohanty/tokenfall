"""Packs the two sports cars into js/models/cars.js for the game: the BMW M3 GTR (bmw-m3-gtr-nfs-mw, an FBX with its textures) and the 2019
Koenigsegg Jesko (2019-koenigsegg-jesko, an OBJ without its MTL, so its parts are coloured here by material name). Each car is cleaned up
(no engine bay, dashboard or cabin, which the game's camera never sees), decimated, scaled to the game's 4.4 m car, turned to face +z with its
wheels on y=0, and exported as a GLB with small textures, embedded as base64 so it loads from file://. buildings.js parses them with GLTFLoader.
Run with Blender: /Applications/Blender.app/Contents/MacOS/Blender -b --python tools/cars-pack.py"""
import base64
import math
import os
import tempfile

import bmesh
import bpy
import mathutils

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LENGTH = 4.4      # the game's car length (the traffic lanes space cars by it)
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


def place(o, front_y, length=LENGTH):
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


def small_images():
    for img in bpy.data.images:
        if img.size[0] > TEX_MAX or img.size[1] > TEX_MAX:
            k = TEX_MAX / max(img.size)
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
    path = os.path.join(tempfile.mkdtemp(), 'car.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_yup=True, export_apply=True, export_image_format='JPEG', export_jpeg_quality=85)
    o = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
    print('packed', sum(len(p.vertices) - 2 for p in o.data.polygons), 'tris', os.path.getsize(path) // 1024, 'KB')
    return base64.b64encode(open(path, 'rb').read()).decode()


def bmw():
    reset()
    bpy.ops.import_scene.fbx(filepath=os.path.join(ROOT, 'bmw-m3-gtr-nfs-mw/source/m3 gtr.fbx'))
    tex = {f.lower(): os.path.join(ROOT, 'bmw-m3-gtr-nfs-mw/textures', f) for f in os.listdir(os.path.join(ROOT, 'bmw-m3-gtr-nfs-mw/textures'))}
    for img in bpy.data.images:   # the FBX points at a missing "m3 gtr.fbm" folder: the same files are in textures/
        f = tex.get(os.path.basename(img.filepath).lower())
        if f:
            img.filepath = f
            img.reload()
    for o in [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.name.split('.')[0] in ('dash', 'radiator')]:
        bpy.data.objects.remove(o)
    o = joined()
    drop_faces(o, lambda f, m: True, far=10)
    while o.data.color_attributes:   # the FBX's vertex colours are black and would darken every texture
        o.data.color_attributes.remove(o.data.color_attributes[0])
    for m in o.data.materials:
        if m.name in ('Car windshield glass', 'salon.2'):
            material(m, (.08, .1, .12), rough=.05, metal=.2, alpha=.55)
        elif m.use_nodes:   # the FBX wires every texture's alpha in, which exports the whole car see-through: everything but the glass is solid
            b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
            for link in list(b.inputs['Alpha'].links):
                m.node_tree.links.remove(link)
            b.inputs['Alpha'].default_value = 1
            m.blend_method = 'OPAQUE'
            b.inputs['Roughness'].default_value = .35
    decimate(o, 14000)
    place(o, front_y=1)   # its front bumper is at +y
    small_images()
    return export(see_through=True)   # it keeps its cabin, so its glass can stay see-through


# the Jesko's materials (no MTL): faces of these are dropped, the rest get a colour
JESKO_DROP = ('alca', 'alca_steer', 'eng_chrome', 'eng_misc', 'engine', 'engine_o', 'int_center', 'int_steer', 'interior', 'interior_o', 'InteriorTilling',
              'lcd', 'lcd2', 'lcd_cifra', 'steer_center', 'white_leather', 'win_int', 'radiator', 'Carbon1M')
PAINT = (.86, .32, .06)   # the Jesko's orange


def jesko():
    reset()
    import zipfile
    tmp = tempfile.mkdtemp()
    zipfile.ZipFile(os.path.join(ROOT, '2019-koenigsegg-jesko/source/rtm_koenigsegg_jesko.zip')).extractall(tmp)
    bpy.ops.wm.obj_import(filepath=os.path.join(tmp, 'rtm_koenigsegg_jesko.obj'))
    o = joined()
    drop_faces(o, lambda f, m: m not in JESKO_DROP)
    # the rear is where the red tail-light glass is
    red = [i for i, m in enumerate(o.data.materials) if m and m.name == 'GlassRedMtl']
    ys = [p.center.y for p in o.data.polygons if p.material_index in red]
    front_y = -1 if ys and sum(ys) / len(ys) > 0 else 1
    for m in o.data.materials:
        n = m.name
        if n.startswith('body') or n in ('Coloured', 'paint1Mtlgreen', 'MultiMat_5_Slot_#1'):
            material(m, PAINT, rough=.3, metal=.3)
        elif n.startswith('Carbon') or n in ('Base', 'black', 'Material_#3', 'wiper', 'mirrors', 'SpecularTintA') or n.startswith('Grille'):
            material(m, (.05, .05, .06), rough=.45, metal=.2)
        elif n == 'GlassMtl':
            material(m, (.06, .08, .1), rough=.05, metal=.2, alpha=.55)
        elif n == 'GlassRedMtl':
            material(m, (.7, .04, .03), rough=.1, alpha=.85, emit=(.35, 0, 0))
        elif n in ('Lights', 'light_ref'):
            material(m, (.85, .87, .9), rough=.1, metal=.6, emit=(.25, .25, .22))
        elif n == 'EXT_WHEEL':
            material(m, (.04, .04, .04), rough=.9)
        elif n in ('rim', 'rim1', 'rim_chrome', 'ex_chrome', 'EXT_Disc'):
            material(m, (.55, .56, .58), rough=.25, metal=.9)
        elif n == 'rim_gold':
            material(m, (.75, .55, .2), rough=.3, metal=.9)
        else:
            material(m, (.12, .12, .13), rough=.5)
    decimate(o, 24000)
    place(o, front_y)
    return export()


def rear_is(o, names):
    """Which way the front points along y (+1 or -1): away from the faces of the named (red tail-light) materials."""
    idx = [i for i, m in enumerate(o.data.materials) if m and m.name in names]
    ys = [p.center.y for p in o.data.polygons if p.material_index in idx]
    return -1 if ys and sum(ys) / len(ys) > 0 else 1


def creta():
    """Hyundai Creta 2015 (hyundai-creta new): a high-poly OBJ in a RAR (unpacked with macOS's bsdtar), ~1.8 M triangles of flat-coloured parts; its
    studio floor disc and the whole cabin go, and it is painted the white Creta of Indian roads. (The older hyundai-creta-2016 model is no longer used.)"""
    reset()
    import subprocess
    tmp = tempfile.mkdtemp()
    subprocess.run(['bsdtar', '-xf', os.path.join(ROOT, 'hyundai-creta new/source/Hyundai Creta 2015 - 3D Model FAB.rar'), '-C', tmp], check=True)
    bpy.ops.wm.obj_import(filepath=os.path.join(tmp, 'hundai+creta+high+poly+blender.obj'))
    for o in [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.name == 'Circle']:
        bpy.data.objects.remove(o)   # the studio floor
    o = joined()
    cabin = ('dashboard', 'display', 'dushboard', 'door_button', 'door_buttons', 'button', 'seat', 'steering', 'stering', 'transmission', 'central_tonel', 'multimedia',
             'uphostery', 'sun_vizors', 'interior', 'voltage', 'skin', 'rooof_part', 'light_control', 'support', 'cooper', 'holes', 'Material')
    drop_faces(o, lambda f, m: not any(k in m for k in cabin) or m in ('black_skin',))
    front = rear_is(o, ('light_red_glass',))
    for m in [m for m in o.data.materials if m]:
        n = m.name
        if n == 'car_paint':
            material(m, (.88, .88, .86), rough=.35)
        elif n.startswith('glass') and 'lamp' not in n and 'light' not in n:
            material(m, (.06, .08, .1), rough=.05, alpha=.6)
        elif n == 'light_red_glass':
            material(m, (.7, .05, .04), rough=.2, emit=(.35, 0, 0))
        elif n in ('glass._lamp.', 'glass._light.', 'running_lights', 'rear_white_glass', 'Chrome_for_light'):
            material(m, (.86, .88, .9), rough=.1, emit=(.22, .22, .2))
        elif n in ('glass._lamp_yellow', 'turn_reflector'):
            material(m, (.9, .45, .08), rough=.2, emit=(.2, .08, 0))
        elif n in ('tyre', 'black_matte_plastic', 'black_skin', 'clossy_plastic', 'rough__plastic', 'latice_front_panel', 'mat_Plastic', 'matte_gray_plastic', 'trunk_reflector', '_car_text', 'trunk_text'):
            material(m, (.07, .07, .08), rough=.6)
        elif n in ('rim', 'Aluminium', 'Chrome', 'chrome_lattice', 'matte_chrome', 'door_handle', 'brake_disk', 'mirror'):
            material(m, (.62, .63, .65), rough=.3)
        else:
            material(m, (.2, .2, .21), rough=.5)
    decimate(o, 24000)
    place(o, front, 4.3)
    return export()

def m4():
    """BMW M4 widebody (bmw-m4-modified-widebody): a GLB with its own textures; the cabin and engine go."""
    reset()
    bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT, 'bmw-m4-modified-widebody/source/bmw_m4_modified_widebody_knitro_builds.glb'))
    o = joined()
    drop_faces(o, lambda f, m: 'InteriorA' not in m)   # the cabin goes; EngineA stays: the front bumper and grille share it
    front = rear_is(o, ('red_glass', 'wmit_red'))
    # its glass is one shell over the whole cabin, roof included, with the roof's metal only as the (dropped) headliner under it: the glass that
    # faces nearly straight up is the roof, given the paint
    names = [m.name if m else '' for m in o.data.materials]
    glass, paint = names.index('glasswindshiled'), next(i for i, n in enumerate(names) if 'PaintTNR' in n)
    for p in o.data.polygons:
        if p.material_index == glass and abs(p.normal.z) > .95:
            p.material_index = paint
    for m in [m for m in o.data.materials if m]:
        if m.name in ('glass', 'glasswindshiled'):
            material(m, (.06, .08, .1), rough=.05, alpha=.6)
        elif 'PaintTNR' in m.name:   # its paint is a near-black teal that reads as a hole in the game's soft light: the same teal, lifted
            material(m, (.07, .4, .43), rough=.3)
    decimate(o, 40000)   # at 16000 the body tore open in dark seams
    place(o, front)
    small_images()
    return export()


def cybertruck():
    """Tesla Cybertruck (tesla-cybertruck): a small low-poly .blend whose materials are all near-black; given its stainless steel here."""
    reset()
    bpy.ops.wm.open_mainfile(filepath=os.path.join(ROOT, 'tesla-cybertruck/source/cybertruck.blend'))
    o = joined()
    # (found by rendering it coloured per material) Material: the steel shell, .001: windows, .002: window frames, .003: the dark lower cladding,
    # .004: the light bar across the nose, .005: the tail lights, .006 / .007: tyres / wheels
    looks = {'Material': ((.72, .73, .75), .35, 1, None), 'Material.001': ((.06, .08, .1), .05, .65, None), 'Material.002': ((.1, .1, .11), .5, 1, None),
             'Material.003': ((.16, .16, .17), .7, 1, None), 'Material.004': ((.95, .95, .92), .1, 1, (.6, .6, .55)), 'Material.005': ((.7, .05, .04), .2, 1, (.4, 0, 0)),
             'Material.006': ((.05, .05, .05), .9, 1, None), 'Material.007': ((.35, .36, .38), .4, 1, None)}
    for m in [m for m in o.data.materials if m and m.name in looks]:
        c, r, al, em = looks[m.name]
        material(m, c, rough=r, alpha=al, emit=em)
    place(o, -1, 5.7)   # its nose (the light bar) is at -y; the real truck's 5.7 m, bigger than the game's 4.4 m cars
    return export()


def scorpio():
    """Mahindra Scorpio-N 2022 (2022-mahindra-scorpio-n): an FBX of ~1.4 M triangles whose textures are one-colour swatches, so its parts are
    coloured here; its material names are the FBX's muddled slot names (wheel_rf.2 is the black trim all over the car), told apart by those
    swatches. A deep red Scorpio, lifted so it reads in the game's soft light."""
    reset()
    import zipfile
    tmp = tempfile.mkdtemp()
    zipfile.ZipFile(os.path.join(ROOT, '2022-mahindra-scorpio-n/source/scorpio_n.zip')).extractall(tmp)
    bpy.ops.import_scene.fbx(filepath=os.path.join(tmp, 'scorpio_n/scorpio_n.fbx'))
    for o in [o for o in bpy.context.scene.objects if o.type == 'MESH' and (o.name.startswith(('scorpio_n_int', 'int_', 'movsteer')) or o.name in ('speedo_lights', 'scorpion_screen_glass'))]:
        bpy.data.objects.remove(o)   # the cabin: seats, dashboard, door cards, headliner
    o = joined()
    drop_faces(o, lambda f, m: True)
    front = rear_is(o, ('glass.003', 'breaklight r', 'breaklight l'))
    looks = {'primary': ((.62, .07, .07), .35, 1, None), 'wheel_rf.2': ((.06, .06, .07), .6, 1, None), 'foglight_m.0': ((.06, .06, .07), .6, 1, None),
             'wheel_rf.0': ((.6, .61, .63), .3, 1, None), 'headlight_f.2': ((.6, .61, .63), .3, 1, None), 'wheel_rf.1': ((.3, .3, .32), .5, 1, None),
             'wheel_rf.3': ((.7, .05, .04), .4, 1, None), 'glass': ((.06, .08, .1), .05, .6, None), 'sunroof_m.1': ((.06, .06, .07), .5, 1, None),
             'scorpio_n_ext_chassis.3': ((.06, .06, .07), .6, 1, None), 'scorpio_n_ext_1.2': ((.6, .61, .63), .3, 1, None)}
    for m in [m for m in o.data.materials if m]:
        n = m.name
        if n in looks:
            c, r, al, em = looks[n]
            material(m, c, rough=r, alpha=al, emit=em)
        elif n in ('indicator lf', 'indicator rf', 'indicator lm', 'indicator rm'):
            material(m, (.9, .45, .08), rough=.2, emit=(.3, .15, 0))
        elif n.startswith(('glass.00', 'breaklight', 'indicator', 'revlight', 'right rear')) or n in ('taillight_r.5', 'boot.5'):
            material(m, (.7, .05, .04), rough=.2, emit=(.3, 0, 0))   # the tail lights and the red bar across the tailgate
        elif n.startswith(('right front', 'foglight', 'headlight', 'taillight')):
            material(m, (.85, .87, .9), rough=.1, emit=(.2, .2, .18))
        else:
            material(m, (.2, .2, .21), rough=.5)
    decimate(o, 60000)   # at 20000 its wheels went polygonal
    place(o, front, 4.7)
    return export()


def eeco():
    """Maruti Suzuki Eeco 2024 (2024-maruti-suzuki-eeco): an FBX in a RAR (unpacked with macOS's bsdtar), flat-coloured parts; the white Eeco
    of Indian streets. Its origin is at the axles, which place() puts on the ground with the rest."""
    reset()
    import subprocess
    tmp = tempfile.mkdtemp()
    subprocess.run(['bsdtar', '-xf', os.path.join(ROOT, '2024-maruti-suzuki-eeco/source/eeco.rar'), '-C', tmp], check=True)
    bpy.ops.import_scene.fbx(filepath=os.path.join(tmp, 'eeco/eeco.fbx'))
    for o in [o for o in bpy.context.scene.objects if o.type == 'MESH' and (o.name.startswith('EECO_IN_') or o.name in ('polySurface1', 'polySurface2', 'hinge', 'hinge1'))]:
        bpy.data.objects.remove(o)   # the cabin, and the grab handles inside the roof
    o = joined()
    drop_faces(o, lambda f, m: m not in ('interior', 'seatouter', 'seatinnerchecks', 'seatbelt', 'whiteint'))
    front = rear_is(o, ('realightglass', 'redbulb'))
    for m in [m for m in o.data.materials if m]:
        n = m.name
        if n in ('body', 'AutoMat_0023'):
            material(m, (.9, .9, .88), rough=.35)
        elif n == 'clearglass':
            material(m, (.06, .08, .1), rough=.05, alpha=.6)
        elif n in ('realightglass', 'redbulb', 'red'):
            material(m, (.7, .05, .04), rough=.2, emit=(.3, 0, 0))
        elif n in ('orange', 'indicator'):
            material(m, (.9, .45, .08), rough=.2, emit=(.3, .15, 0))
        elif n in ('AutoMat_0079', 'AutoMat_0090', 'mirror'):
            material(m, (.85, .87, .9), rough=.1, emit=(.2, .2, .18))
        elif n in ('rim', 'chrome') or n in ('AutoMat_0000', 'AutoMat_0003', 'AutoMat_0024', 'AutoMat_0027', 'AutoMat_0033', 'AutoMat_0036'):
            material(m, (.6, .61, .63), rough=.3)
        elif n in ('tyre', 'blackplastic', 'bottomblack', 'decals', 'reardecal'):
            material(m, (.06, .06, .07), rough=.7)
        else:
            material(m, (.3, .3, .32), rough=.5)
    decimate(o, 16000)
    place(o, front, 3.7)
    return export()


def omni():
    """Maruti Omni (small-van): a small low-poly .blend coloured from a palette texture (Material-Colour.png); its paint is made the pale blue
    of the old Omnis here, its glass see-through, the rest keeps the palette."""
    reset()
    import zipfile
    tmp = tempfile.mkdtemp()
    zipfile.ZipFile(os.path.join(ROOT, 'small-van/source/Omni.zip')).extractall(tmp)
    bpy.ops.wm.open_mainfile(filepath=os.path.join(tmp, 'Omni.blend'))
    o = joined()
    drop_faces(o, lambda f, m: True)
    for m in [m for m in o.data.materials if m]:
        if m.name == 'body':
            material(m, (.62, .78, .9), rough=.35)
        elif m.name == 'glass':
            material(m, (.06, .08, .1), rough=.05, alpha=.6)
    place(o, 1, 3.4)
    small_images()
    return export()


cars = {'bmw': bmw(), 'jesko': jesko(), 'creta': creta(), 'm4': m4(), 'cybertruck': cybertruck(), 'scorpio': scorpio(), 'eeco': eeco(), 'omni': omni()}
os.makedirs(os.path.join(ROOT, 'js/models'), exist_ok=True)
with open(os.path.join(ROOT, 'js/models/cars.js'), 'w') as f:
    f.write('// the traffic cars as GLB files, embedded so they load from file://. Built by tools/cars-pack.py (run with Blender)\n')
    f.write('window.CAR_MODELS = {\n')
    for k, b in cars.items():
        f.write(f'  {k}: "{b}",\n')
    f.write('};\n')
print('cars.js', os.path.getsize(os.path.join(ROOT, 'js/models/cars.js')) // 1024, 'KB')

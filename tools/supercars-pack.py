"""Packs the supercars for the Crescent Bay parking into js/models/supercars.js (added to window.CAR_MODELS, so sportsCar() takes them like the
traffic cars): the Ferrari 458 Italia (ferrari-458-italia, the three.js example GLB, Draco-compressed, its parts named by material) and the
Khronos Car Concept (car-concept, a GLB with clearcoat and variant paints). The concept loses its cabin (the Ferrari, a Spider, keeps its own); each is decimated, scaled, turned to face +z with
its wheels on y=0, and its body paint is one material named 'paint' so the game can respray a copy (sportsCar's o.paint).
Run with Blender: /Applications/Blender.app/Contents/MacOS/Blender -b --python tools/supercars-pack.py"""
import os

# the helpers (reset, joined, drop_faces, decimate, place, material, small_images, rear_is, export) are cars-pack.py's: run its definitions only
_src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cars-pack.py')).read()
exec(_src[:_src.index('\ncars = {')])

import bpy  # noqa: E402
import math  # noqa: E402


def long_on_y(o):
    """place() wants the car's length along y (some GLBs lie along x). Also puts the object back on Euler rotation: the glTF importer leaves it on
    quaternions, where place()'s rotation_euler turn does nothing (the Ferrari stayed nose-out until this)."""
    o.rotation_mode = 'XYZ'
    bb = [o.matrix_world @ mathutils.Vector(c) for c in o.bound_box]
    if max(b[0] for b in bb) - min(b[0] for b in bb) > max(b[1] for b in bb) - min(b[1] for b in bb):
        o.rotation_euler.z = math.pi / 2
        bpy.ops.object.transform_apply(rotation=True)


def ferrari():
    reset()
    bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT, 'ferrari-458-italia/source/ferrari.glb'))
    # it is the 458 Spider, roof down: the cabin is in plain view, so it keeps its seats, dash and steering wheel
    o = joined()
    drop_faces(o, lambda f, m: True)
    long_on_y(o)
    front = rear_is(o, ('Taillight_Glass',))
    for m in [m for m in o.data.materials if m]:
        n = m.name
        if n == 'Body_Color':
            material(m, (.72, .03, .03), rough=.25, metal=.3); m.name = 'paint'
        elif n == 'metal_gray':
            material(m, (.52, .53, .55), rough=.3, metal=.6)
        elif n == 'metal_chrome':
            material(m, (.78, .79, .8), rough=.15, metal=.9)
        elif n in ('Carbon_Fiber', 'plastic_gray'):
            material(m, (.07, .07, .08), rough=.45)
        elif n == 'Glass_Gray':
            material(m, (.06, .08, .1), rough=.05, alpha=.55)
        elif n == 'Taillight_Glass':
            material(m, (.7, .04, .03), rough=.1, emit=(.35, 0, 0))
        elif n == 'Projector_Glass':
            material(m, (.86, .88, .9), rough=.1, emit=(.25, .25, .22))
        elif n == 'Turn_Signal_LED':
            material(m, (.9, .45, .08), rough=.2, emit=(.2, .08, 0))
        elif n == 'Tires':
            material(m, (.06, .06, .06), rough=.9)
        elif n == 'Ferrari_Yellow':
            material(m, (.92, .76, .1), rough=.3)
        elif n == '_0098_DodgerBlue':
            material(m, (.1, .35, .8), rough=.3)
        elif n in ('Leather', 'Interior_light'):
            material(m, (.78, .66, .5), rough=.6)   # tan leather
        elif n in ('Interior_dark', 'Carpet'):
            material(m, (.09, .09, .1), rough=.7)
        elif n == 'Leather_red':
            material(m, (.6, .05, .04), rough=.6)
    decimate(o, 64000)
    place(o, front, 4.5)
    return export()


def concept():
    reset()
    bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT, 'car-concept/source/CarConcept.glb'))
    for o in [o for o in bpy.context.scene.objects if o.type == 'MESH' and (o.name.startswith(('Interior', 'Engine', 'License')))]:
        bpy.data.objects.remove(o)
    o = joined()
    drop_faces(o, lambda f, m: not m.startswith(('Interior', 'Floormat', 'Dashboard', 'License')))
    long_on_y(o)
    front = rear_is(o, ('Brakelight',))
    for m in [m for m in o.data.materials if m]:
        n = m.name
        if n.startswith('Paint 1'):
            material(m, (.86, .87, .88), rough=.25, metal=.3); m.name = 'paint'
        elif n.startswith('Paint 2'):
            material(m, (.08, .08, .09), rough=.35)
        elif n in ('Glass', 'Mirror'):
            material(m, (.06, .08, .1), rough=.05, alpha=.55)
        elif n == 'Brakelight':
            material(m, (.7, .04, .03), rough=.1, emit=(.4, 0, 0))
        elif n in ('Headlight',):
            material(m, (.86, .88, .9), rough=.1, emit=(.3, .3, .28))
        elif n == 'Signallight':
            material(m, (.9, .45, .08), rough=.2, emit=(.2, .08, 0))
        elif n in ('Tireside', 'Tiretread'):
            material(m, (.06, .06, .06), rough=.9)
        elif n in ('Rim1', 'Rim2', 'Disc', 'Hardware'):
            material(m, (.55, .56, .58), rough=.25, metal=.8)
        elif n == 'Brake':
            material(m, (.75, .1, .08), rough=.4)
    decimate(o, 48000)
    place(o, front, 4.6)
    small_images()
    return export()


cars = {'ferrari': ferrari(), 'concept': concept()}
with open(os.path.join(ROOT, 'js/models/supercars.js'), 'w') as f:
    f.write('// the supercars of the Crescent Bay parking as GLB files, embedded so they load from file://. Built by tools/supercars-pack.py (run with Blender).\n')
    f.write('// Ferrari 458 Italia by vicent091036 (CC BY 4.0, via the three.js examples); Car Concept by Khronos (CC BY 4.0, glTF sample models)\n')
    f.write('window.CAR_MODELS = Object.assign(window.CAR_MODELS || {}, {\n')
    for k, b in cars.items():
        f.write(f'  {k}: "{b}",\n')
    f.write('});\n')
print('supercars.js', os.path.getsize(os.path.join(ROOT, 'js/models/supercars.js')) // 1024, 'KB')

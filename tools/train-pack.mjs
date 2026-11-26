#!/usr/bin/env node
// The station's locomotive: hogwarts_express_-_locomotive.glb (Nathaniel Onandia on Sketchfab, CC BY 4.0: see README credits) made small enough
// for the lobby: its 114 meshes joined into one per material (114 draws -> about thirty), welded, simplified to well under half its triangles
// (where no one can see the difference at the game's distances), vertex order optimised, positions, normals
// and UVs quantised, meshopt-compressed (decoded in the browser by js/libs/meshopt-decoder.js), and the 21 PNG textures (8 MB) shrunk to at most
// 1024 px and stored as WebP. Writes assets/models/train-loco.glb, and js/models/train.js (the same bytes as base64, for file:// where the page
// cannot fetch it: js/model-files.js loads that instead).   node tools/train-pack.mjs
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, flatten, join, prune, quantize, reorder, simplify, textureCompress, weld } from '@gltf-transform/functions';
import sharp from 'sharp';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';

const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const at = (...p) => path.join(ROOT, ...p);
await MeshoptEncoder.ready; await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const src = at('hogwarts_express_-_locomotive.glb'), doc = await io.read(src);
await doc.transform(
  dedup(), flatten(), join(), weld(), prune(),
  simplify({ simplifier: MeshoptSimplifier, ratio: .4, error: .0008 }),   // about 136k triangles to a third: the lobby draws it twice a frame (and once more for its shadow)
  reorder({ encoder: MeshoptEncoder, target: 'size' }),
  quantize({ quantizePosition: 16, quantizeNormal: 10, quantizeTexcoord: 14 }),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 86, effort: 80 }),
);
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
const out = await io.writeBinary(doc);
fs.writeFileSync(at('assets/models/train-loco.glb'), out);
fs.writeFileSync(at('js/models/train.js'), `// The station's locomotive, for file:// (tools/train-pack.mjs writes it; over http the page fetches assets/models/train-loco.glb instead)\nwindow.TRAIN_MODEL = '${Buffer.from(out).toString('base64')}';\n`);
const meshes = doc.getRoot().listMeshes(), prims = meshes.reduce((n, m) => n + m.listPrimitives().length, 0);
console.log(`train-loco.glb: ${(fs.statSync(src).size / 1e6).toFixed(1)} MB -> ${(out.length / 1e6).toFixed(2)} MB, ${meshes.length} meshes, ${prims} primitives, ${doc.getRoot().listTextures().length} textures`);

#!/usr/bin/env node
// Compares two folders of same-named screenshots (perf-probe --shots): changed-pixel share per image, and a diff image for each.
//   node tools/shot-diff.mjs perf/shots/baseline perf/shots/after [outDir]
// pixelmatch threshold .1 (YIQ distance) ignores sub-visible noise; anything above ~0.5% changed pixels is worth looking at.
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
const [a, b, out = path.join(b, '..', path.basename(b) + '-diff')] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
for (const f of fs.readdirSync(a).filter((f) => f.endsWith('.png'))) {
  if (!fs.existsSync(path.join(b, f))) { console.log(f.padEnd(22), 'missing in', b); continue; }
  const A = PNG.sync.read(fs.readFileSync(path.join(a, f))), B = PNG.sync.read(fs.readFileSync(path.join(b, f)));
  if (A.width !== B.width || A.height !== B.height) { console.log(f.padEnd(22), 'size differs'); continue; }
  const D = new PNG({ width: A.width, height: A.height });
  const n = pixelmatch(A.data, B.data, D.data, A.width, A.height, { threshold: 0.1 });
  fs.writeFileSync(path.join(out, f), PNG.sync.write(D));
  console.log(f.padEnd(22), (100 * n / (A.width * A.height)).toFixed(2).padStart(6) + '% pixels differ');
}

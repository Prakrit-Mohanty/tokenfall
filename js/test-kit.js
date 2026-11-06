// Small helpers for the plain-node self-tests (used by jenga-tests.js; the older test files keep their own inline copies).
//   const { test, uniform, addRank, mean, words, done } = require('./test-kit.js');
const assert = require('assert');
let checks = 0;
const test = (name, fn) => { fn(); checks++; console.log('ok', name); };
const done = () => console.log(`\n${checks} checks passed`);
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const words = (s) => s.trim().split(/\s+/).length;
// where a value falls among its siblings (0 = smallest); a tie shares its rank fractionally
function addRank(counts, vals, i) {
  const lo = vals.filter((v) => v < vals[i]).length, ties = vals.filter((v, j) => j !== i && v === vals[i]).length;
  for (let k = 0; k <= ties; k++) counts[lo + k] += 1 / (ties + 1);
}
function uniform(label, counts, tol = 0.08) {
  const tot = counts.reduce((a, b) => a + b, 0);
  console.log(`   ${label}: ${counts.map((c) => (100 * c / tot).toFixed(1) + '%').join(' ')}`);
  for (const c of counts) assert(Math.abs(c / tot - 1 / counts.length) < tol, `${label} is not uniform within ${tol * 100}%`);
}
module.exports = { test, done, mean, words, addRank, uniform };

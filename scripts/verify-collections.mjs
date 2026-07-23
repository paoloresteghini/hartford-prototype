// scripts/verify-collections.mjs — run after any build; asserts expected counts
import { buildCatalog } from '../src/lib/hubdb/build-catalog.js';
const c = buildCatalog(new URL('../.hubdb-cache', import.meta.url).pathname);
if (!c) { console.log('no mirror — fallback mode, skipping'); process.exit(0); }
const expect = { products: 333, categories: 59, locationPages: 7502, states: 51, cities: 191, eventPages: 6 };
let fail = false;
for (const [k, n] of Object.entries(expect)) {
  const got = c[k].length;
  if (got !== n) { console.error(`FAIL ${k}: expected ${n}, got ${got}`); fail = true; }
  else console.log(`ok ${k}: ${n}`);
}
if (c.issues.unmatchedAliases.length) { console.error('FAIL unmatched aliases:', c.issues.unmatchedAliases); fail = true; }
process.exit(fail ? 1 : 0);

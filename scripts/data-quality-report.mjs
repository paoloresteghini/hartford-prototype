import fs from 'node:fs';
import { buildCatalog } from '../src/lib/hubdb/build-catalog.js';

const c = buildCatalog(new URL('../.hubdb-cache', import.meta.url).pathname);
if (!c) { console.error('no mirror'); process.exit(1); }

const report = {
  generated: new Date().toISOString(),
  counts: Object.fromEntries(['products','categories','locationPages','states','cities','eventPages'].map(k => [k, c[k].length])),
  issues: c.issues,
  knownClientBugs: [
    'location: Alabama row named "…in Florida" (copy-paste error)',
    'location_country.category_location_catg: 3,181 stale refs to a rebuilt table — city→category linkage dead',
    'location.location_dropdown: 2 dangling refs (Nebraska, New Hampshire)',
    'location_country: 342 empty-path stub rows (city names only)',
  ],
};
fs.writeFileSync('data-quality-report.json', JSON.stringify(report, null, 2));
console.log('wrote data-quality-report.json');

import fs from 'node:fs';
import { buildCatalog } from '../src/lib/hubdb/build-catalog.js';

const c = buildCatalog(new URL('../.hubdb-cache', import.meta.url).pathname);
const ours = new Set([
  ...c.products.map((p) => p.url),
  ...c.categories.map((x) => x.url),
  ...c.locationPages.map((x) => x.url),
  ...c.states.map((x) => x.url),
  ...c.cities.map((x) => x.url),
  ...c.eventPages.map((x) => x.url),
]);
const norm = (u) => u.replace('https://hartfordrents.com', '').replace(/\/?$/, '/');
const live = [
  ...fs.readFileSync('scripts/data/wp-live-pages.txt', 'utf8').trim().split('\n'),
  ...fs.readFileSync('scripts/data/wp-live-products.txt', 'utf8').trim().split('\n'),
].map(norm);
const exact = live.filter((u) => ours.has(u));
const missing = live.filter((u) => !ours.has(u));
const extra = [...ours].filter((u) => !live.includes(u));
const md = `# Migration coverage — HubDB build vs live hartfordrents.com
Generated ${new Date().toISOString()}

| Metric | Count |
|---|---|
| Live WP URLs | ${live.length} |
| New-build URLs | ${ours.size} |
| Exact URL matches (zero-redirect) | ${exact.length} |
| Live URLs needing redirect/mapping | ${missing.length} |
| New URLs not on live site (net-new SEO surface) | ${extra.length} |

## Live URLs with no exact new-build match (first 100)
${missing.slice(0, 100).map((u) => `- ${u}`).join('\n')}
`;
fs.writeFileSync('migration-coverage.md', md);
console.log(`exact ${exact.length} / live ${live.length}; new-only ${extra.length}`);

// Read-only HubDB mirror: pulls all published tables + rows into .hubdb-cache/
// GET-only by construction. Run: node scripts/fetch-hubdb.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(
  readFileSync(join(root, '.env'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);
const TOKEN = env.HUBSPOT_TOKEN;
if (!TOKEN) throw new Error('HUBSPOT_TOKEN missing from .env');

const get = async (path) => {
  const res = await fetch(`https://api.hubapi.com${path}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}: ${await res.text()}`);
  return res.json();
};

const fetchAllRows = async (table) => {
  const rows = [];
  let after;
  do {
    const page = await get(
      `/cms/v3/hubdb/tables/${table}/rows?limit=1000${after ? `&after=${after}` : ''}`
    );
    rows.push(...page.results);
    after = page.paging?.next?.after;
  } while (after);
  return rows;
};

const outDir = join(root, '.hubdb-cache');
mkdirSync(outDir, { recursive: true });

const { results: tables } = await get('/cms/v3/hubdb/tables?limit=100');
writeFileSync(join(outDir, '_tables.json'), JSON.stringify(tables, null, 2));

for (const t of tables) {
  const rows = await fetchAllRows(t.name);
  writeFileSync(join(outDir, `${t.name}.json`), JSON.stringify({ table: t.name, columns: t.columns, rows }, null, 2));
  console.log(`${t.name}: ${rows.length} rows`);
}
console.log(`\nMirrored ${tables.length} tables to .hubdb-cache/`);

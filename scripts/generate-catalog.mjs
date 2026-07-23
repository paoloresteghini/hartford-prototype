#!/usr/bin/env node
// Generate src/data/hubdb.generated.json from the local HubDB mirror (.hubdb-cache/).
// READ-ONLY: consumes cached JSON only, never touches the HubSpot API.
// Output contains client data — gitignored, never commit.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cacheDir = path.join(root, '.hubdb-cache');
const outFile = path.join(root, 'src/data/hubdb.generated.json');

if (!fs.existsSync(cacheDir)) {
  console.error('No .hubdb-cache/ mirror found. Run scripts/fetch-hubdb.mjs first.');
  process.exit(1);
}

const load = (name) => {
  const j = JSON.parse(fs.readFileSync(path.join(cacheDir, `${name}.json`)));
  return j.results || j.rows || j;
};

const strip = (html) =>
  (html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;|&rsquo;/g, '’')
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

const img = (v) => (v && v.url ? v.url : null);
const fkIds = (v) => (Array.isArray(v) ? v.map((x) => String(x.id)) : []);

// ---------- load tables ----------
const avProducts = load('audio_visual_rental_'); // 204 products
const avMid = load('audio_rentals_catg'); // 33 mid-level categories
const avTop = load('audio_visiual_rental_catg'); // 10 top-level categories
const cProducts = load('computing_rentals_sub_catg'); // 132 products
const cMid = load('computing_rentals_catg'); // 16 mid-level categories
const cTop = load('computing_rentals'); // 8 top-level categories
const matrix = load('location_category_pages'); // 7,502 state/city × category rows
const states = load('location'); // 51 states

// ---------- categories ----------
const mkCat = (r, level, division, nameKey = 'name') => ({
  id: String(r.id),
  slug: r.path,
  name: strip(r.values[nameKey] || r.name),
  level, // 'top' | 'mid'
  division,
  image: img(r.values.feature_image) || img(r.values.img) || img(r.values.image),
  metaDescription: r.values.meta_description || '',
  description: r.values.description_1 || r.values.description || '',
  topId: null, // filled below for mid cats
  productIds: [], // filled below
});

const cats = new Map();
for (const r of avTop) cats.set(String(r.id), mkCat(r, 'top', 'av'));
for (const r of avMid) cats.set(String(r.id), mkCat(r, 'mid', 'av'));
for (const r of cTop) cats.set(String(r.id), mkCat(r, 'top', 'computing'));
for (const r of cMid) cats.set(String(r.id), mkCat(r, 'mid', 'computing', 'title'));

// mid → top wiring (nav_slug points at the top-level row)
for (const r of avMid) {
  const t = fkIds(r.values.nav_slug)[0];
  if (t && cats.has(t)) cats.get(String(r.id)).topId = t;
}
for (const r of cMid) {
  const t = fkIds(r.values.nav_slug)[0];
  if (t && cats.has(t)) cats.get(String(r.id)).topId = t;
}

// ---------- products ----------
const mkProduct = (r, division) => ({
  id: String(r.id),
  slug: r.path,
  name: strip(r.values.name || r.name),
  blurb: strip(r.values.description).slice(0, 180),
  metaDescription: r.values.meta_description || '',
  contentHtml: r.values.content || r.values.description || '',
  image: img(r.values.feature_image),
  imageAlt: r.values.image_alt_text || strip(r.values.name || r.name),
  division,
  categoryIds: [],
});

const products = new Map();
for (const r of avProducts) {
  if (!r.path || !(r.values.name || r.name)) continue; // skip unnamed stub rows
  const p = mkProduct(r, 'av');
  for (const id of [...fkIds(r.values.nav_slug_cat), ...fkIds(r.values.nav_slug)])
    if (cats.has(id)) p.categoryIds.push(id);
  products.set(p.id, p);
}
for (const r of cProducts) {
  if (!r.path || !(r.values.name || r.name)) continue;
  const p = mkProduct(r, 'computing');
  for (const id of [...fkIds(r.values.nav_slug_cat), ...fkIds(r.values.nav_slug_)])
    if (cats.has(id)) p.categoryIds.push(id);
  products.set(p.id, p);
}

// reverse direction: category.sub_cat / sub_catg / accesories → products
const linkCatProducts = (rows, cols) => {
  for (const r of rows) {
    const cat = cats.get(String(r.id));
    if (!cat) continue;
    for (const col of cols)
      for (const pid of fkIds(r.values[col]))
        if (products.has(pid)) {
          if (!products.get(pid).categoryIds.includes(String(r.id)))
            products.get(pid).categoryIds.push(String(r.id));
        }
  }
};
linkCatProducts(avMid, ['sub_cat']);
linkCatProducts(avTop, ['sub_catg']);
linkCatProducts(cMid, ['sub_cat']);
linkCatProducts(cTop, ['sub_cat', 'accesories']);

// fill category.productIds
for (const p of products.values())
  for (const cid of p.categoryIds) cats.get(cid).productIds.push(p.id);
// products under a mid cat also belong to its top cat
for (const c of cats.values())
  if (c.level === 'mid' && c.topId)
    for (const pid of c.productIds)
      if (!cats.get(c.topId).productIds.includes(pid)) cats.get(c.topId).productIds.push(pid);

// ---------- nav tree ----------
const nav = ['av', 'computing'].map((division) => ({
  id: division,
  label: division === 'av' ? 'Audio Visual' : 'Computing',
  categories: [...cats.values()]
    .filter((c) => c.division === division && c.level === 'top')
    .map((top) => ({
      name: top.name,
      slug: `/rent/${top.slug}/`,
      img: top.image,
      blurb: strip(top.metaDescription).slice(0, 90),
      subs: [...cats.values()]
        .filter((c) => c.level === 'mid' && c.topId === top.id)
        .map((m) => ({ name: m.name, slug: `/rent/${m.slug}/` })),
    })),
}));

// ---------- location matrix (Florida sample set: state page + all its city pages) ----------
const catBySlug = new Map([...cats.values()].map((c) => [c.slug, c]));
const sampleRows = matrix.filter((r) => r.values.state_slug === 'florida');
const locationSamples = sampleRows.map((r) => ({
  path: r.path,
  pageName: r.name,
  state: r.values.state,
  stateSlug: r.values.state_slug,
  category: r.values.category,
  categorySlug: r.values.category_slug,
  h1: r.values.h1,
  metaDescription: r.values.meta_description,
  introHtml: r.values.intro,
  isStateLevel: r.path.endsWith(r.values.state_slug),
  // category_url (e.g. "/computing/computer-rental") names the real PLP —
  // matrix slugs like "laptop-rental" are SEO aliases, not category paths.
  matchedCategoryId:
    catBySlug.get(r.values.category_slug)?.id ||
    catBySlug.get((r.values.category_url || '').split('/').filter(Boolean).pop())?.id ||
    null,
}));

// matrix stats for the proof
const allStates = new Set(matrix.map((r) => r.values.state_slug));
const allCats = new Set(matrix.map((r) => r.values.category_slug));

const out = {
  generatedAt: new Date().toISOString(),
  stats: {
    products: products.size,
    categories: cats.size,
    matrixRows: matrix.length,
    matrixStates: allStates.size,
    matrixCategories: allCats.size,
    states: states.length,
  },
  nav,
  categories: [...cats.values()],
  products: [...products.values()],
  locationSamples,
};

fs.writeFileSync(outFile, JSON.stringify(out, null, 1));
const orphans = [...products.values()].filter((p) => !p.categoryIds.length).length;
console.log(
  `Wrote ${outFile}\n  products: ${products.size} (${orphans} uncategorised)\n  categories: ${cats.size}\n  nav divisions: ${nav.length}\n  location samples (Florida): ${locationSamples.length}`
);

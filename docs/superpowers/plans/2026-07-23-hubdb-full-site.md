# Full HubDB Site Build Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Regenerate Hartford Technology Rentals' entire ~8,100-page inventory from the local HubDB mirror via the Astro 5 Content Layer, at the client's intended new-site URLs, with CI deploy and a migration-coverage report.

**Architecture:** `.hubdb-cache/` mirror (already fetched, gitignored) → pure transform functions in `src/lib/hubdb/` → typed content collections in `src/content.config.ts` → dynamic routes. HubSpot API is NEVER called at build time; CI refreshes the mirror with the existing GET-only `scripts/fetch-hubdb.mjs` before building.

**Tech Stack:** Astro 5 (already installed, static output), Tailwind v4, `astro:content` + `astro/zod`, vitest (new dev dependency), Node ≥ 20.

## Global Constraints

- **HubSpot is READ ONLY.** Only `scripts/fetch-hubdb.mjs` / `scripts/hubdb.sh` touch the API, with GET only. Nothing in this plan may add another API call path. No `-X POST/PUT/PATCH/DELETE`, `--data*`, `-d`, `-F`, `--json`, `--form` against `hubapi.com`/`hubspot.com` ever.
- `.hubdb-cache/` and `src/data/hubdb.generated.json` stay gitignored — client data never committed.
- Long-form SEO copy and JSON-LD are hard client requirements — every template keeps them.
- Canonicals and schema.org URLs point at `https://hartfordrents.com`; internal links go through the base-aware `u()` helper from `src/data/catalog.js` (GitHub Pages subpath).
- URL authority: HubDB row `path` fields + matrix `category_url`. Prefixes: products `/product/<path>/`, all location content `/locations/<path>/`, categories at their `category_url` (else `/<division-prefix>/<path>/` where division-prefix is `audio` or `computing`).
- Expected counts (build fails if off): products 333, categories 59 (after twin-merge), matrix pages 7,502, states 51, cities 191, event pages 6.
- Existing design system components (`Base.astro`, `Header.astro`, `Footer.astro`, `ProductCard.astro`, `QuoteDrawer.astro`) are reused, not redesigned.
- Interim proof code gets deleted only in the task that replaces it (Tasks 5–6), never earlier.

## Data shapes (used by every task)

```js
// Category
{ id: '211069836362', slug: 'camcorder-rental', url: '/audio/camcorder-rental/',
  name: 'Camcorder Rentals', level: 'top'|'mid', division: 'av'|'computing',
  topId: '243…'|null, image: 'https://…'|null, metaDescription: '',
  descriptionHtml: '', description2Html: '', productLineupHtml: '',
  columns: [{ heading, image, description }],   // rich 4-col landing content, may be []
  productIds: ['240…', …] }

// Product
{ id: '240083724001', slug: 'pansonic-ag-cx350-4k-camcorder-rental',
  url: '/product/pansonic-ag-cx350-4k-camcorder-rental/', name: 'Panasonic AG-CX350 4K Camcorder Rental',
  blurb: '', metaDescription: '', contentHtml: '', image: 'https://…'|null,
  imageAlt: '', division: 'av'|'computing', categoryIds: [] }

// LocationPage (matrix row)
{ id: '216825634900', path: 'laptop-rental-orlando-fl', url: '/locations/laptop-rental-orlando-fl/',
  pageName: 'Laptop Rentals Orlando', state: 'Florida', stateSlug: 'florida',
  category: 'Laptop Rentals', categorySlug: 'laptop-rental', categoryUrl: '/computing/computer-rental',
  h1: '', metaDescription: '', introHtml: '', isStateLevel: false, categoryId: '235…'|null }

// State
{ id: '267…', path: 'florida', url: '/locations/florida/', name: 'Florida',
  image: null|'https://…', contentHtml: '', cityIds: [] }

// City
{ id: '271…', path: 'orlando-fl-audio-visual-equipment-rental',
  url: '/locations/orlando-fl-audio-visual-equipment-rental/', name: 'Orlando',
  cityToken: 'orlando-fl', metaDescription: '', image: null, image2: null,
  contentHtml: '', descriptionHtml: '', iframeHtml: '' }

// EventPage
{ id: '358…', path: 'av-equipment-rentals-for-your-event-venue',
  url: '/av-equipment-rentals-for-your-event-venue/', h1: '', title: '',
  metaDescription: '', introHtml: '', bodyHtml: '' }

// Issues (data-quality accumulator, returned by buildCatalog)
{ skippedProducts: [{table, id, reason}], orphanProducts: [id…],
  unmatchedAliases: [categorySlug…], mergedTwins: [slug…] }
```

`state.name`: strip the `Audio Visual and Technology Rentals in ` prefix from the row name. `city.cityToken`: path minus the trailing `-audio-visual-equipment-rental` / `-audio-visual-rental` suffix (e.g. `orlando-fl`). Matrix city pages relate to a City via `path` ending with `-<cityToken>`.

---

### Task 1: Vitest + pure transform functions

**Files:**
- Create: `src/lib/hubdb/transforms.js`
- Create: `test/transforms.test.js`
- Modify: `package.json` (add vitest devDependency + `"test": "vitest run"` script)

**Interfaces:**
- Produces: `stripHtml(html) → string`; `imageUrl(v) → string|null`; `fkIds(v) → string[]`; `resolveCategoryUrl(categorySlug, categoryUrl, catByAliasSlug) → categoryId|null`; `categoryHref(cat) → '/audio/<slug>/'|'/computing/<slug>/'|categoryUrl-based`; `stateNameFromRow(name) → string`; `cityToken(path) → string`
- Consumes: nothing (pure functions over plain values)

- [ ] **Step 1: Install vitest**

```bash
npm install -D vitest
```
Add to `package.json` scripts: `"test": "vitest run"`.

- [ ] **Step 2: Write failing tests**

```js
// test/transforms.test.js
import { describe, it, expect } from 'vitest';
import {
  stripHtml, imageUrl, fkIds, resolveCategoryUrl, categoryHref,
  stateNameFromRow, cityToken,
} from '../src/lib/hubdb/transforms.js';

describe('stripHtml', () => {
  it('strips tags and decodes common entities', () => {
    expect(stripHtml('<p>1&quot; MOS &amp; 20x</p>')).toBe('1" MOS & 20x');
  });
  it('handles null', () => expect(stripHtml(null)).toBe(''));
});

describe('imageUrl / fkIds', () => {
  it('extracts url or null', () => {
    expect(imageUrl({ url: 'https://x/y.jpg' })).toBe('https://x/y.jpg');
    expect(imageUrl(null)).toBe(null);
  });
  it('extracts fk id strings', () => {
    expect(fkIds([{ id: 123, name: 'x' }])).toEqual(['123']);
    expect(fkIds(undefined)).toEqual([]);
  });
});

describe('resolveCategoryUrl', () => {
  const byAlias = new Map([
    ['computer-rental', { id: 'C1' }],
    ['camera-rental', { id: 'C2' }],
  ]);
  it('matches direct slug first', () => {
    expect(resolveCategoryUrl('camera-rental', '/audio/camera-rental', byAlias)).toBe('C2');
  });
  it('falls back to category_url last segment (SEO alias)', () => {
    expect(resolveCategoryUrl('laptop-rental', '/computing/computer-rental', byAlias)).toBe('C1');
  });
  it('returns null for division landing alias', () => {
    expect(resolveCategoryUrl('av-equipment-rentals-for-your-event-venue', '/audio-rentals', byAlias)).toBe(null);
  });
});

describe('categoryHref', () => {
  it('uses division prefix', () => {
    expect(categoryHref({ slug: 'camcorder-rental', division: 'av' })).toBe('/audio/camcorder-rental/');
    expect(categoryHref({ slug: 'ipad-rental', division: 'computing' })).toBe('/computing/ipad-rental/');
  });
});

describe('location helpers', () => {
  it('strips state name prefix', () => {
    expect(stateNameFromRow('Audio Visual and Technology Rentals in Florida')).toBe('Florida');
    expect(stateNameFromRow('Florida')).toBe('Florida');
  });
  it('derives city token from path', () => {
    expect(cityToken('orlando-fl-audio-visual-equipment-rental')).toBe('orlando-fl');
    expect(cityToken('washington-dc-audio-visual-rental')).toBe('washington-dc');
  });
});
```

- [ ] **Step 3: Run tests, verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `../src/lib/hubdb/transforms.js`.

- [ ] **Step 4: Implement transforms.js**

```js
// src/lib/hubdb/transforms.js
export const stripHtml = (html) =>
  (html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;|&rsquo;/g, '’')
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

export const imageUrl = (v) => (v && v.url ? v.url : null);

export const fkIds = (v) => (Array.isArray(v) ? v.map((x) => String(x.id)) : []);

// Matrix category_slug values are SEO aliases; category_url names the real PLP.
export const resolveCategoryUrl = (categorySlug, categoryUrl, catByAliasSlug) => {
  const direct = catByAliasSlug.get(categorySlug);
  if (direct) return direct.id;
  const seg = (categoryUrl || '').split('/').filter(Boolean).pop();
  return catByAliasSlug.get(seg)?.id ?? null;
};

export const categoryHref = (cat) =>
  `/${cat.division === 'av' ? 'audio' : 'computing'}/${cat.slug}/`;

export const stateNameFromRow = (name) =>
  (name || '').replace(/^Audio Visual and Technology Rentals in /i, '').trim();

export const cityToken = (path) =>
  (path || '').replace(/-audio-visual(-equipment)?-rental$/i, '');
```

- [ ] **Step 5: Run tests, verify pass**

Run: `npm test` — Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/hubdb/transforms.js test/transforms.test.js
git commit -m "feat: add vitest and pure HubDB transform functions"
```

---

### Task 2: Catalog builder (`buildCatalog`) over the mirror

**Files:**
- Create: `src/lib/hubdb/build-catalog.js`
- Create: `test/build-catalog.test.js`
- Create: `test/fixtures/mini-cache/` (six tiny JSON files, shapes below)

**Interfaces:**
- Consumes: `transforms.js` (all functions above)
- Produces: `buildCatalog(cacheDir) → { products, categories, locationPages, states, cities, eventPages, issues }` — arrays of the exact Data Shapes; returns `null` if `cacheDir` missing (deploy fallback). Table loading: each cache file is `{ results: [...] }` or a bare array; rows are HubDB rows (`id`, `path`, `name`, `values`).

**Twin merge rule:** when an AV top-level and mid-level category share `slug`, emit ONE category: top-level `id`/metadata/rich content, union of both rows' product links, `level: 'top'`, record slug in `issues.mergedTwins`.

**Product linking (both directions, matching audit findings):** product → `nav_slug_cat` + `nav_slug` (AV) / `nav_slug_cat` + `nav_slug_` (computing); category → `sub_cat`, `sub_catg`, `accesories`. Mid-cat products propagate to their top cat. Skip products with no `path` or no name (count in `issues.skippedProducts`).

- [ ] **Step 1: Create fixture mini-cache**

Create `test/fixtures/mini-cache/` with the 11 table files the loader reads (`_tables.json` not needed). Minimal contents — 2 AV products, 1 computing product, 1 AV top + 1 AV mid sharing slug `audio-rental` (twin), 1 computing top + 1 mid, 2 matrix rows (one state-level, one city-level using an alias slug), 1 state, 1 city with path + 1 empty-path stub, 1 event page. Example (`audio_visual_rental_.json`):

```json
{ "results": [
  { "id": 1001, "path": "cam-a-rental", "name": "Cam A Rental",
    "values": { "name": "Cam A Rental", "description": "<p>Test cam</p>",
      "meta_description": "m", "content": "<p>c</p>",
      "feature_image": { "url": "https://img/cam-a.jpg" },
      "nav_slug_cat": [ { "id": 2001, "name": "audio-rental" } ] } },
  { "id": 1002, "path": null, "name": null, "values": { "name": null } }
] }
```

Build the other files analogously so every Data Shape field and the twin/alias/stub rules are exercised. Give the AV top row id 3001 + slug `audio-rental`, the AV mid row id 2001 + slug `audio-rental` with `nav_slug` → 3001 and `sub_cat` → [1001]. Matrix city row: `path: "laptop-rental-test-fl"`, `category_slug: "laptop-rental"`, `category_url: "/computing/computer-rental"`; computing mid row slug `computer-rental`.

- [ ] **Step 2: Write failing tests**

```js
// test/build-catalog.test.js
import { describe, it, expect } from 'vitest';
import { buildCatalog } from '../src/lib/hubdb/build-catalog.js';
import path from 'node:path';

const cache = path.resolve('test/fixtures/mini-cache');
const cat = buildCatalog(cache);

describe('buildCatalog', () => {
  it('returns null for missing dir', () => {
    expect(buildCatalog('/nope')).toBe(null);
  });
  it('skips pathless/unnamed products and counts them', () => {
    expect(cat.products.map((p) => p.id)).toContain('1001');
    expect(cat.products.find((p) => p.id === '1002')).toBeUndefined();
    expect(cat.issues.skippedProducts.length).toBe(1);
  });
  it('merges same-slug top/mid twins into one category', () => {
    const twins = cat.categories.filter((c) => c.slug === 'audio-rental');
    expect(twins.length).toBe(1);
    expect(twins[0].level).toBe('top');
    expect(twins[0].productIds).toContain('1001');
    expect(cat.issues.mergedTwins).toContain('audio-rental');
  });
  it('resolves matrix alias slugs via category_url', () => {
    const city = cat.locationPages.find((r) => r.path === 'laptop-rental-test-fl');
    expect(city.categoryId).not.toBe(null);
    expect(city.isStateLevel).toBe(false);
    expect(city.url).toBe('/locations/laptop-rental-test-fl/');
  });
  it('excludes empty-path city stubs from cities', () => {
    expect(cat.cities.every((c) => c.path)).toBe(true);
  });
  it('product url uses /product/ prefix', () => {
    expect(cat.products[0].url).toBe('/product/cam-a-rental/');
  });
});
```

- [ ] **Step 3: Run tests, verify fail** — `npm test`, FAIL on missing module.

- [ ] **Step 4: Implement build-catalog.js**

Port the proven logic from `scripts/generate-catalog.mjs` (keep that file untouched for now) into this module, restructured around the Data Shapes and twin-merge/alias rules, reading with:

```js
import fs from 'node:fs';
import path from 'node:path';
import { stripHtml, imageUrl, fkIds, resolveCategoryUrl, categoryHref, stateNameFromRow, cityToken } from './transforms.js';

const load = (dir, name) => {
  const f = path.join(dir, `${name}.json`);
  if (!fs.existsSync(f)) return [];
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  return j.results || j.rows || (Array.isArray(j) ? j : []);
};

export function buildCatalog(cacheDir) {
  if (!cacheDir || !fs.existsSync(cacheDir)) return null;
  // 1. load 11 tables via load()
  // 2. build categories (mkCat per row; AV top/mid, computing top/mid; wire topId via nav_slug fk)
  // 3. twin merge: group AV cats by slug; if a slug has top+mid, merge per Twin merge rule
  // 4. build products (skip !path || !name → issues.skippedProducts), link both directions,
  //    propagate mid→top, record orphans in issues.orphanProducts
  // 5. matrix rows → LocationPage shape; categoryId = resolveCategoryUrl(...); unmatched
  //    non-null aliases → issues.unmatchedAliases (dedup; '/audio-rentals' division landing → null, NOT an issue)
  // 6. states (name via stateNameFromRow, cityIds via location_dropdown fks that exist),
  //    cities (rows with path only; cityToken), eventPages (path from row.path)
  return { products, categories, locationPages, states, cities, eventPages, issues };
}
```

The `// 1..6` comments above are the required structure; write the full implementation (≈150 lines) following `scripts/generate-catalog.mjs` for the linking mechanics — same fk column names, same skip rules — with the new shapes and rules.

- [ ] **Step 5: Run tests, verify pass** — `npm test`.

- [ ] **Step 6: Run against the REAL mirror as a smoke check**

```bash
node -e "
const { buildCatalog } = await import('./src/lib/hubdb/build-catalog.js');
const c = buildCatalog('.hubdb-cache');
console.log(c.products.length, c.categories.length, c.locationPages.length, c.states.length, c.cities.length, c.eventPages.length);
console.log('issues:', JSON.stringify({ skipped: c.issues.skippedProducts.length, orphans: c.issues.orphanProducts.length, aliases: c.issues.unmatchedAliases, twins: c.issues.mergedTwins.length }));
" --input-type=module
```
Expected: `333 59 7502 51 191 6`, twins 8, aliases `[]`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/hubdb/build-catalog.js test/build-catalog.test.js test/fixtures/
git commit -m "feat: buildCatalog assembles typed catalog from HubDB mirror"
```

---

### Task 3: Content collections

**Files:**
- Create: `src/content.config.ts`
- Create: `scripts/verify-collections.mjs`

**Interfaces:**
- Consumes: `buildCatalog('.hubdb-cache')`
- Produces: collections `products`, `categories`, `locationPages`, `states`, `cities`, `eventPages` queryable via `getCollection('<name>')` in routes; each entry `{ id, data }` where `data` is the Data Shape. Empty collections when mirror absent (deploy fallback).

- [ ] **Step 1: Write content.config.ts**

```ts
// src/content.config.ts
import { defineCollection, z } from 'astro:content';
import { buildCatalog } from './lib/hubdb/build-catalog.js';

const catalog = buildCatalog(new URL('../.hubdb-cache', import.meta.url).pathname);

const fromArray = (rows: any[] | undefined, schema: z.ZodTypeAny) =>
  defineCollection({
    loader: () => (rows ?? []).map((r) => ({ ...r, id: String(r.id) })),
    schema,
  });

const categorySchema = z.object({
  id: z.string(), slug: z.string(), url: z.string(), name: z.string(),
  level: z.enum(['top', 'mid']), division: z.enum(['av', 'computing']),
  topId: z.string().nullable(), image: z.string().nullable(),
  metaDescription: z.string(), descriptionHtml: z.string(), description2Html: z.string(),
  productLineupHtml: z.string(),
  columns: z.array(z.object({ heading: z.string(), image: z.string().nullable(), description: z.string() })),
  productIds: z.array(z.string()),
});
// …analogous zod schemas for the other five shapes, exactly mirroring Data Shapes…

export const collections = {
  products: fromArray(catalog?.products, productSchema),
  categories: fromArray(catalog?.categories, categorySchema),
  locationPages: fromArray(catalog?.locationPages, locationPageSchema),
  states: fromArray(catalog?.states, stateSchema),
  cities: fromArray(catalog?.cities, citySchema),
  eventPages: fromArray(catalog?.eventPages, eventPageSchema),
};
```

Write all six schemas in full — every field from Data Shapes, no `z.any()`.

- [ ] **Step 2: Write verify script**

```js
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
```

- [ ] **Step 3: Run `astro sync` + verify script**

```bash
npx astro sync && node scripts/verify-collections.mjs
```
Expected: sync succeeds (zod validates all rows), all `ok` lines, exit 0. A zod failure here = real schema drift; fix the schema or the transform, not the data.

- [ ] **Step 4: Commit**

```bash
git add src/content.config.ts scripts/verify-collections.mjs
git commit -m "feat: typed content collections over HubDB catalog"
```

---

### Task 4: Product routes (333 PDPs at `/product/<slug>/`)

**Files:**
- Create: `src/pages/product/[slug].astro`
- Delete: `src/pages/product/panasonic-ak-uc4000-4k-camera-rental.astro` (bespoke POC PDP — replaced; its slug exists in HubDB so the URL survives)
- Delete: `src/pages/p/[slug].astro` (interim route)

**Interfaces:**
- Consumes: `getCollection('products')`, `getCollection('categories')`; `u()`, `SITE` from `src/data/catalog.js`
- Produces: 333 static pages at `/product/<slug>/`

- [ ] **Step 1: Write the route**

Port `src/pages/p/[slug].astro` (already working, same design) with these changes: `getStaticPaths` from `getCollection('products')`; category lookup from `getCollection('categories')`; category links point at `cat.url`; breadcrumb + Product/LeaseOut + BreadcrumbList schema use `https://hartfordrents.com/product/<slug>/`. Keep the QC/shipping bullet list and CTA sections verbatim from the interim route.

```astro
---
import { getCollection } from 'astro:content';
import Base from '../../layouts/Base.astro';
import { SITE, u } from '../../data/catalog.js';

export async function getStaticPaths() {
  const products = await getCollection('products');
  return products.map((p) => ({ params: { slug: p.data.slug }, props: { product: p.data } }));
}
const { product } = Astro.props;
const categories = await getCollection('categories');
const cat = product.categoryIds.map((id) => categories.find((c) => c.id === id)?.data).find(Boolean) ?? null;
/* …schema objects and template as in the interim /p/[slug].astro, with cat.url hrefs… */
---
```

- [ ] **Step 2: Delete replaced files**

```bash
git rm src/pages/p/[slug].astro src/pages/product/panasonic-ak-uc4000-4k-camera-rental.astro
```

- [ ] **Step 3: Build + assert**

```bash
npm run build && ls dist/product | wc -l
```
Expected: build succeeds; `334` (333 product dirs + nothing else — if 334 includes an index, inspect; the assertion is: `ls dist/product | wc -l` equals product count).
Also: `grep -l "LeaseOut" dist/product/pansonic-ag-cx350-4k-camcorder-rental/index.html` returns the file.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: 333 product pages at /product/ from HubDB collection"
```

---

### Task 5: Category routes + real mega menu

**Files:**
- Create: `src/pages/audio/[slug].astro`, `src/pages/computing/[slug].astro`
- Create: `src/components/CategoryPage.astro` (shared PLP template)
- Modify: `src/components/Header.astro` (nav from collections, computing images)
- Modify: `src/data/catalog.js` (remove `HUBDB` glue added for the interim build; keep `NAV_STATIC` export as fallback, keep `u`, `SITE`, `CAMERA_PRODUCTS`)
- Delete: `src/pages/rent/[slug].astro`, `src/pages/camera-rental/index.astro`, `scripts/generate-catalog.mjs`, `src/data/hubdb.generated.json`

**Interfaces:**
- Consumes: `categories`, `products` collections
- Produces: 59 PLPs at `/audio/<slug>/` + `/computing/<slug>/`; `buildNavFromCategories(categories) → NAV` exported from `src/lib/hubdb/nav.js` (same shape Header already consumes: `[{label, id, categories: [{name, slug, img, blurb, subs: [{name, slug}]}]}]`)

- [ ] **Step 1: Create `src/lib/hubdb/nav.js`**

```js
// src/lib/hubdb/nav.js
import { stripHtml } from './transforms.js';

export function buildNavFromCategories(cats) {
  const divisions = [
    { id: 'av', label: 'Audio Visual' },
    { id: 'computing', label: 'Computing' },
  ];
  return divisions.map((d) => ({
    ...d,
    categories: cats
      .filter((c) => c.division === d.id && c.level === 'top')
      .map((top) => ({
        name: top.name,
        slug: top.url,
        img: top.image,
        blurb: stripHtml(top.metaDescription).slice(0, 90),
        subs: cats
          .filter((c) => c.level === 'mid' && c.topId === top.id)
          .map((m) => ({ name: m.name, slug: m.url })),
      })),
  }));
}
```

- [ ] **Step 2: CategoryPage.astro shared template**

One component receiving `{ cat, items, subs, parent }` props. Port the interim `/rent/[slug].astro` template and extend with the rich landing content the spec requires: render `descriptionHtml`, `description2Html`, the `columns` 4-col grid (heading/image/description each), and `productLineupHtml` — each section wrapped in the existing `prose-seo` / `reveal` classes and only rendered when non-empty (long-form SEO copy requirement). Keep CollectionPage+ItemList+BreadcrumbList JSON-LD, filter chips → child categories, product grid via `ProductCard`, dark CTA band.

- [ ] **Step 3: Division routes**

```astro
---
// src/pages/audio/[slug].astro  (computing/[slug].astro identical with division==='computing')
import { getCollection } from 'astro:content';
import CategoryPage from '../../components/CategoryPage.astro';

export async function getStaticPaths() {
  const cats = await getCollection('categories');
  return cats
    .filter((c) => c.data.division === 'av')
    .map((c) => ({ params: { slug: c.data.slug }, props: { cat: c.data } }));
}
const { cat } = Astro.props;
const [cats, products] = await Promise.all([getCollection('categories'), getCollection('products')]);
const byId = new Map(products.map((p) => [p.id, p.data]));
const items = cat.productIds.map((id) => byId.get(id)).filter(Boolean);
const subs = cats.filter((c) => c.data.level === 'mid' && c.data.topId === cat.id).map((c) => c.data);
const parent = cat.topId ? cats.find((c) => c.id === cat.topId)?.data ?? null : null;
---
<CategoryPage {cat} {items} {subs} {parent} />
```

- [ ] **Step 4: Header nav from collections**

In `Header.astro` frontmatter replace `NAV` import with:

```astro
---
import { getCollection } from 'astro:content';
import { NAV_STATIC, SITE, CAMERA_PRODUCTS, u } from '../data/catalog.js';
import { buildNavFromCategories } from '../lib/hubdb/nav.js';
const cats = (await getCollection('categories')).map((c) => c.data);
const NAV = cats.length ? buildNavFromCategories(cats) : NAV_STATIC;
---
```

In `catalog.js`: delete the `import.meta.glob`/`HUBDB` block and the derived `NAV` export; rename the static array export to `NAV_STATIC`.

- [ ] **Step 5: Delete replaced files**

```bash
git rm src/pages/rent/[slug].astro src/pages/camera-rental/index.astro scripts/generate-catalog.mjs
rm -f src/data/hubdb.generated.json
```
Check nothing still imports removed exports: `grep -rn "CAMERA_SUBCATS\|hubdb.generated\|from '../data/catalog" src/ | grep -v NAV_STATIC` — fix any hits (homepage may import `CAMERA_PRODUCTS`, which stays).

- [ ] **Step 6: Build + assert**

```bash
npm run build && ls dist/audio | wc -l && ls dist/computing | wc -l
```
Expected: the two counts sum to 59. Mega menu check: `grep -o '/audio/camcorder-rental/' dist/index.html | head -1` matches; computing division images present: `grep -c 'hubspotusercontent' dist/index.html` ≥ 2.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: real category PLPs under /audio and /computing; mega menu from HubDB"
```

---

### Task 6: Location routes — matrix, states, cities (7,744 pages)

**Files:**
- Create: `src/pages/locations/[slug].astro` (replaces interim file — one route, three kinds)
- Create: `src/components/LocationMatrixPage.astro`, `src/components/StatePage.astro`, `src/components/CityPage.astro`

**Interfaces:**
- Consumes: `locationPages`, `states`, `cities`, `categories`, `products` collections
- Produces: 7,502 + 51 + 191 = 7,744 pages under `/locations/`

- [ ] **Step 1: Route with kind switch**

```astro
---
// src/pages/locations/[slug].astro
import { getCollection } from 'astro:content';
import LocationMatrixPage from '../../components/LocationMatrixPage.astro';
import StatePage from '../../components/StatePage.astro';
import CityPage from '../../components/CityPage.astro';

export async function getStaticPaths() {
  const [matrix, states, cities] = await Promise.all([
    getCollection('locationPages'), getCollection('states'), getCollection('cities'),
  ]);
  return [
    ...matrix.map((r) => ({ params: { slug: r.data.path }, props: { kind: 'matrix', row: r.data } })),
    ...states.map((r) => ({ params: { slug: r.data.path }, props: { kind: 'state', row: r.data } })),
    ...cities.map((r) => ({ params: { slug: r.data.path }, props: { kind: 'city', row: r.data } })),
  ];
}
const { kind, row } = Astro.props;
---
{kind === 'matrix' && <LocationMatrixPage row={row} />}
{kind === 'state' && <StatePage row={row} />}
{kind === 'city' && <CityPage row={row} />}
```

- [ ] **Step 2: LocationMatrixPage**

Port the proven interim matrix template. Changes: product grid via `categories`/`products` collections using `row.categoryId` (cap 8, link "View all" to `cat.url`); sibling links = other `locationPages` with same `categorySlug` AND same `stateSlug`; add a "More rentals in <city/state>" block linking the same location's other categories (same path suffix for city pages / same `stateSlug` state-level rows for state pages, cap 12). BreadcrumbList schema with canonical `https://hartfordrents.com/locations/<path>/`.

- [ ] **Step 3: StatePage**

Sections: breadcrumb; h1 `{row.name}` + `contentHtml` (prose-seo); city grid — cities whose matrix pages share `stateSlug` (resolve via `locationPages` rows for this state's `stateSlug`, city-level only, dedupe by city token → link each to `/locations/<cityPath>/` using the `cities` collection matched on `cityToken`); category index — the 31 state-level matrix rows for this state linked by `h1`; CTA band. BreadcrumbList schema.

- [ ] **Step 4: CityPage**

Sections: breadcrumb; h1 from `name` (`<City> Audio Visual & Technology Rentals` if the row name is the generic prefix form — use `stateNameFromRow`-style cleanup); `image`/`image2` split hero; `contentHtml` + `descriptionHtml` prose; map `iframeHtml` rendered with `set:html` inside a bordered container; links to this city's 31 matrix pages (match `locationPages` whose path ends `-${row.cityToken}`); CTA. BreadcrumbList schema.

- [ ] **Step 5: Build + assert**

```bash
npm run build && ls dist/locations | wc -l
```
Expected: `7744`. Spot checks:
```bash
grep -o "<h1[^>]*>[^<]*" dist/locations/laptop-rental-orlando-fl/index.html
grep -c "/locations/laptop-rental-orlando-fl/" dist/locations/orlando-fl-audio-visual-equipment-rental/index.html
grep -c "/locations/" dist/locations/florida/index.html
```
Expected: Orlando h1; city page links its matrix pages (≥1); state page has many location links (≥30).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: 7,744 location pages (matrix, states, cities) from HubDB"
```

---

### Task 7: Event pages + homepage city links

**Files:**
- Create: `src/pages/[slug].astro` (root-level event-service pages, 6)
- Modify: `src/pages/index.astro` (replace `#` city/location links with real `/locations/` URLs)

**Interfaces:**
- Consumes: `eventPages`, `states` collections
- Produces: 6 root-level pages; homepage links resolve

- [ ] **Step 1: Event route**

```astro
---
// src/pages/[slug].astro
import { getCollection } from 'astro:content';
import Base from '../layouts/Base.astro';
import { SITE, u } from '../data/catalog.js';

export async function getStaticPaths() {
  const pages = await getCollection('eventPages');
  return pages.map((p) => ({ params: { slug: p.data.path }, props: { page: p.data } }));
}
const { page } = Astro.props;
---
<Base title={page.title || page.h1} description={page.metaDescription}>
  <section class="mx-auto max-w-[1440px] px-5 pt-10 lg:px-10">
    <h1 class="display max-w-4xl text-[clamp(2rem,5vw,3.75rem)]">{page.h1}</h1>
    <div class="prose-seo mt-6 max-w-[70ch] text-[0.9375rem] leading-relaxed text-ink-2" set:html={page.introHtml} />
  </section>
  <section class="mx-auto max-w-[1440px] px-5 py-12 lg:px-10">
    <div class="prose-seo max-w-[74ch] text-[0.9375rem] leading-relaxed text-ink-2" set:html={page.bodyHtml} />
  </section>
</Base>
```
Root-level `[slug].astro` is lowest priority in Astro routing — static pages like `index.astro` win; verify no path collision with existing static routes (`grep` event paths against `src/pages/`).

- [ ] **Step 2: Homepage city links**

In `src/pages/index.astro`, find the location links currently pointing at `#` (Las Vegas / Chicago / Orlando references) and point them at the matching city pages: look up the three cities in the `cities` collection by `cityToken` (`las-vegas-nv`, `chicago-il`, `orlando-fl`) in frontmatter and use `u(city.url)`; keep `#` fallback when collections are empty.

- [ ] **Step 3: Build + assert**

```bash
npm run build && ls dist/av-equipment-rentals-for-your-event-venue/index.html && grep -c 'href="#"' dist/index.html
```
Expected: event page exists; homepage `#` count lower than before the change (check before/after).

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: event-service pages and real homepage city links"
```

---

### Task 8: Search index over full catalog

**Files:**
- Create: `src/pages/search-index.json.js` (build-time endpoint)
- Modify: `public/js/site.js` (autocomplete fetches index lazily instead of inline catalog data)

**Interfaces:**
- Consumes: `products`, `categories`, `cities`, `states` collections
- Produces: `GET /search-index.json` → `{ entries: [{ t: 'p'|'c'|'l', name, url, img? , extra? }] }`; site.js consumes it

- [ ] **Step 1: Endpoint**

```js
// src/pages/search-index.json.js
import { getCollection } from 'astro:content';

export async function GET() {
  const [products, categories, cities, states] = await Promise.all([
    getCollection('products'), getCollection('categories'),
    getCollection('cities'), getCollection('states'),
  ]);
  const entries = [
    ...products.map((p) => ({ t: 'p', name: p.data.name, url: p.data.url, img: p.data.image })),
    ...categories.map((c) => ({ t: 'c', name: c.data.name, url: c.data.url })),
    ...states.map((s) => ({ t: 'l', name: `${s.data.name} rentals`, url: s.data.url })),
    ...cities.map((c) => ({ t: 'l', name: `${c.data.name} rentals`, url: c.data.url })),
  ];
  return new Response(JSON.stringify({ entries }), { headers: { 'Content-Type': 'application/json' } });
}
```

- [ ] **Step 2: site.js integration**

Locate the existing autocomplete data source in `public/js/site.js` (currently an inline product array). Replace with: on first search-input focus, `fetch(document.documentElement.dataset.base + 'search-index.json')` once, cache in module scope, feed the existing scoring/synonym/typo pipeline; type badges from `t` (`p`→"Product", `c`→"Category", `l`→"Location"). Add `data-base` attribute to `<html>` in `Base.astro` set to the `BASE` export (base-aware fetch). Keep all existing ranking logic intact.

- [ ] **Step 3: Build + assert + manual check**

```bash
npm run build && node -e "const j=require('./dist/search-index.json'); console.log(j.entries.length)"
```
Expected: 333+59+51+191 = 634. Manual: serve dist, type "laptop orlando" and "ptz" in the search box — results appear with badges.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: full-catalog search index endpoint + lazy autocomplete"
```

---

### Task 9: noindex guard + data-quality report

**Files:**
- Modify: `src/layouts/Base.astro` (conditional robots meta)
- Create: `src/pages/robots.txt.js`
- Create: `scripts/data-quality-report.mjs`

**Interfaces:**
- Consumes: `buildCatalog`, `import.meta.env.GITHUB_PAGES` / `process.env.GITHUB_PAGES`
- Produces: preview builds carry `noindex`; `data-quality-report.json` artifact at repo root (gitignored)

- [ ] **Step 1: Robots meta in Base.astro**

In `Base.astro` head, after the description meta:

```astro
{import.meta.env.GITHUB_PAGES === 'true' && <meta name="robots" content="noindex, nofollow" />}
```

- [ ] **Step 2: robots.txt endpoint**

```js
// src/pages/robots.txt.js
export function GET() {
  const preview = import.meta.env.GITHUB_PAGES === 'true';
  const body = preview
    ? 'User-agent: *\nDisallow: /\n'
    : 'User-agent: *\nAllow: /\nSitemap: https://hartfordrents.com/sitemap.xml\n';
  return new Response(body, { headers: { 'Content-Type': 'text/plain' } });
}
```

- [ ] **Step 3: Data-quality report script**

```js
// scripts/data-quality-report.mjs
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
```
Add `data-quality-report.json` to `.gitignore`.

- [ ] **Step 4: Verify**

```bash
GITHUB_PAGES=true npm run build && grep -c "noindex" dist/index.html && cat dist/robots.txt
npm run build && grep -c "noindex" dist/index.html || true
node scripts/data-quality-report.mjs && node -e "console.log(Object.keys(require('./data-quality-report.json')))"
```
Expected: preview build has noindex + Disallow; normal build has zero noindex; report writes.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: preview noindex guard and data-quality report"
```

---

### Task 10: Migration-coverage (sitemap parity) report

**Files:**
- Create: `scripts/migration-coverage.mjs`
- Already committed: `scripts/data/wp-live-pages.txt`, `scripts/data/wp-live-products.txt` (live WP sitemap URL lists, fetched 2026-07-23 — public data)

**Interfaces:**
- Consumes: `buildCatalog` URL sets + the two txt fixtures
- Produces: `migration-coverage.md` (gitignored artifact) — the client-facing proof table

- [ ] **Step 1: Write the script**

```js
// scripts/migration-coverage.mjs
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
```
Add `migration-coverage.md` to `.gitignore`.

- [ ] **Step 2: Run + sanity-check**

```bash
node scripts/migration-coverage.mjs && head -20 migration-coverage.md
```
Expected: product URLs match near-100% (slugs identical); `/locations/` slugs mostly differ (WP city-first vs HubDB category-first — that is the client's own new structure, the report quantifies it). Numbers are the deliverable, no target to hit.

- [ ] **Step 3: Commit**

```bash
git add scripts/migration-coverage.mjs scripts/data/wp-live-pages.txt scripts/data/wp-live-products.txt .gitignore
git commit -m "feat: migration-coverage report vs live WordPress sitemap"
```

---

### Task 11: CI — fetch mirror in Actions, deploy full site

**Files:**
- Modify: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: repo secret `HUBSPOT_TOKEN` (Paolo adds it in GitHub → Settings → Secrets → Actions)
- Produces: Pages deploy of the full ~8,100-page site, noindexed

- [ ] **Step 1: Add fetch step**

In `deploy.yml`, before the build step:

```yaml
      - name: Fetch HubDB mirror (read-only)
        if: ${{ env.HUBSPOT_TOKEN != '' }}
        run: node scripts/fetch-hubdb.mjs
        env:
          HUBSPOT_TOKEN: ${{ secrets.HUBSPOT_TOKEN }}
```
(Match the workflow's existing env/step style; the `if` guard keeps deploys green before the secret exists — build falls back to POC-only pages.)
Verify `scripts/fetch-hubdb.mjs` reads the token from `process.env.HUBSPOT_TOKEN` before falling back to `.env` — patch it if not.

- [ ] **Step 2: Verify fetch script env handling locally**

```bash
env -i PATH="$PATH" HOME="$HOME" HUBSPOT_TOKEN="$(grep HUBSPOT_TOKEN .env | cut -d= -f2)" node scripts/fetch-hubdb.mjs --dry-run 2>/dev/null || echo "check script flags"
```
If the script has no dry-run, skip live verification (mirror is fresh) — read the script and confirm the env path instead. Do NOT add write capability while editing.

- [ ] **Step 3: Full local production-preview build**

```bash
GITHUB_PAGES=true npm run build 2>&1 | tail -3
```
Expected: ~8,100+ pages, no errors. Record the page count.

- [ ] **Step 4: Commit + push + watch deploy**

```bash
git add .github/workflows/deploy.yml && git commit -m "ci: fetch HubDB mirror before build using repo secret"
git push
gh run watch --exit-status || gh run view --log-failed
```
Ask Paolo to add the `HUBSPOT_TOKEN` secret before this push, or push and let the guard skip the fetch until the secret exists.

- [ ] **Step 5: Post-deploy smoke**

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://paoloresteghini.github.io/hartford-prototype/locations/laptop-rental-orlando-fl/
curl -s https://paoloresteghini.github.io/hartford-prototype/robots.txt
```
Expected: 200 (once secret present) and `Disallow: /`.

---

### Task 12: Final verification sweep

**Files:** none new — runs everything.

- [ ] **Step 1: Full test + build + reports**

```bash
npm test && npm run build && node scripts/verify-collections.mjs && node scripts/data-quality-report.mjs && node scripts/migration-coverage.mjs
```
Expected: all green, counts exact.

- [ ] **Step 2: Browser smoke — one page per template**

Serve `dist/` on :4322 and check in browser: homepage (mega menu real tree + images), `/audio/camera-rental/`, `/computing/ipad-rental/`, one PDP, `/locations/florida/`, one city page (map iframe renders), `/locations/laptop-rental-orlando-fl/`, one event page, search box ("laptop orlando"), quote drawer add-from-PDP.

- [ ] **Step 3: Update docs + memory**

Update `README`/vault notes: new URL structure, scripts, CI flow. Log the final page count + coverage numbers.

- [ ] **Step 4: Final commit**

```bash
git add -A && git commit -m "chore: full HubDB site build verification artifacts"
```

// Assembles a typed catalog (products, categories, location pages, states,
// cities, event pages) from a local HubDB mirror directory (see fetch-hubdb.mjs).
// READ-ONLY: consumes cached JSON only, never touches the HubSpot API.
import fs from 'node:fs';
import path from 'node:path';
import {
  stripHtml,
  imageUrl,
  fkIds,
  resolveCategoryUrl,
  categoryHref,
  stateNameFromRow,
  cityToken,
} from './transforms.js';

const load = (dir, name) => {
  const f = path.join(dir, `${name}.json`);
  if (!fs.existsSync(f)) return [];
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  return j.results || j.rows || (Array.isArray(j) ? j : []);
};

// Matrix category_url rows that name a division landing page (no specific
// category attached) resolve to null by design — not a data-quality issue.
const isDivisionLanding = (categoryUrl) => {
  const seg = (categoryUrl || '').split('/').filter(Boolean).pop();
  return seg === 'audio-rentals' || seg === 'computing-rentals';
};

// A location_country row whose values.name still carries the full
// "Audio Visual and Technology Rentals in X" state title is a state/country
// duplicate that leaked into this table, not a real city page.
const looksLikeStatePage = (row) =>
  stateNameFromRow(row.values.name || '') !== (row.values.name || '').trim();

export function buildCatalog(cacheDir) {
  if (!cacheDir || !fs.existsSync(cacheDir)) return null;

  // ---------- 1. load tables ----------
  const avProducts = load(cacheDir, 'audio_visual_rental_');
  const avMid = load(cacheDir, 'audio_rentals_catg');
  const avTop = load(cacheDir, 'audio_visiual_rental_catg');
  const cProducts = load(cacheDir, 'computing_rentals_sub_catg');
  const cMid = load(cacheDir, 'computing_rentals_catg');
  const cTop = load(cacheDir, 'computing_rentals');
  const matrix = load(cacheDir, 'location_category_pages');
  const stateRows = load(cacheDir, 'location');
  const cityRows = load(cacheDir, 'location_country');
  const eventRows = load(cacheDir, 'event_service_pages');

  const issues = {
    skippedProducts: [],
    orphanProducts: [],
    unmatchedAliases: [],
    mergedTwins: [],
  };

  // ---------- 2. categories ----------
  const mkCat = (r, level, division, nameKey = 'name') => ({
    id: String(r.id),
    slug: r.path,
    url: categoryHref({ slug: r.path, division }),
    name: stripHtml(r.values[nameKey] || r.name),
    level, // 'top' | 'mid'
    division,
    image: imageUrl(r.values.feature_image) || imageUrl(r.values.img) || imageUrl(r.values.image),
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

  // mid -> top wiring (nav_slug points at the top-level row)
  for (const r of [...avMid, ...cMid]) {
    const t = fkIds(r.values.nav_slug)[0];
    if (t && cats.has(t)) cats.get(String(r.id)).topId = t;
  }

  // ---------- 3. twin merge (AV division only, matching audit findings) ----------
  const avBySlug = new Map();
  for (const c of cats.values()) {
    if (c.division !== 'av') continue;
    if (!avBySlug.has(c.slug)) avBySlug.set(c.slug, []);
    avBySlug.get(c.slug).push(c);
  }
  // slug -> id of the surviving (top) category, for redirecting product links below
  const mergedMidToTop = new Map();
  for (const [slug, group] of avBySlug) {
    const top = group.find((c) => c.level === 'top');
    const mid = group.find((c) => c.level === 'mid');
    if (!top || !mid) continue; // only merge genuine top+mid twins
    mergedMidToTop.set(mid.id, top.id);
    cats.delete(mid.id);
    issues.mergedTwins.push(slug);
  }

  // ---------- 4. products ----------
  const mkProduct = (r, division) => ({
    id: String(r.id),
    slug: r.path,
    url: `/product/${r.path}/`,
    name: stripHtml(r.values.name || r.name),
    blurb: stripHtml(r.values.description).slice(0, 180),
    metaDescription: r.values.meta_description || '',
    contentHtml: r.values.content || r.values.description || '',
    image: imageUrl(r.values.feature_image),
    imageAlt: r.values.image_alt_text || stripHtml(r.values.name || r.name),
    division,
    categoryIds: [],
  });

  const remapCategoryId = (id) => mergedMidToTop.get(id) || id;

  const products = new Map();
  for (const r of avProducts) {
    if (!r.path || !(r.values.name || r.name)) {
      issues.skippedProducts.push(String(r.id));
      continue;
    }
    const p = mkProduct(r, 'av');
    for (const rawId of [...fkIds(r.values.nav_slug_cat), ...fkIds(r.values.nav_slug)]) {
      const id = remapCategoryId(rawId);
      if (cats.has(id) && !p.categoryIds.includes(id)) p.categoryIds.push(id);
    }
    products.set(p.id, p);
  }
  for (const r of cProducts) {
    if (!r.path || !(r.values.name || r.name)) {
      issues.skippedProducts.push(String(r.id));
      continue;
    }
    const p = mkProduct(r, 'computing');
    for (const rawId of [...fkIds(r.values.nav_slug_cat), ...fkIds(r.values.nav_slug_)]) {
      const id = remapCategoryId(rawId);
      if (cats.has(id) && !p.categoryIds.includes(id)) p.categoryIds.push(id);
    }
    products.set(p.id, p);
  }

  // reverse direction: category.sub_cat / sub_catg / accesories -> products
  const linkCatProducts = (rows, cols) => {
    for (const r of rows) {
      const catId = remapCategoryId(String(r.id));
      const cat = cats.get(catId);
      if (!cat) continue;
      for (const col of cols)
        for (const pid of fkIds(r.values[col]))
          if (products.has(pid) && !products.get(pid).categoryIds.includes(catId))
            products.get(pid).categoryIds.push(catId);
    }
  };
  linkCatProducts(avMid, ['sub_cat']);
  linkCatProducts(avTop, ['sub_catg']);
  linkCatProducts(cMid, ['sub_cat']);
  linkCatProducts(cTop, ['sub_cat', 'accesories']);

  // fill category.productIds
  for (const p of products.values()) {
    if (!p.categoryIds.length) issues.orphanProducts.push(p.id);
    for (const cid of p.categoryIds) cats.get(cid).productIds.push(p.id);
  }
  // products under a mid cat also belong to its top cat
  for (const c of cats.values())
    if (c.level === 'mid' && c.topId)
      for (const pid of c.productIds)
        if (!cats.get(c.topId).productIds.includes(pid)) cats.get(c.topId).productIds.push(pid);

  // ---------- 5. matrix rows -> LocationPage shape ----------
  const catBySlug = new Map([...cats.values()].map((c) => [c.slug, c]));
  const seenUnmatched = new Set();
  const locationPages = matrix.map((r) => {
    const categoryId = resolveCategoryUrl(r.values.category_slug, r.values.category_url, catBySlug);
    if (
      categoryId === null &&
      (r.values.category_slug || r.values.category_url) &&
      !isDivisionLanding(r.values.category_url)
    ) {
      const alias = r.values.category_slug || r.values.category_url;
      if (!seenUnmatched.has(alias)) {
        seenUnmatched.add(alias);
        issues.unmatchedAliases.push(alias);
      }
    }
    return {
      path: r.path,
      url: `/locations/${r.path}/`,
      pageName: r.name,
      state: r.values.state,
      stateSlug: r.values.state_slug,
      category: r.values.category,
      categorySlug: r.values.category_slug,
      categoryId,
      h1: r.values.h1,
      metaDescription: r.values.meta_description || '',
      introHtml: r.values.intro || '',
      isStateLevel: r.path.endsWith(r.values.state_slug),
    };
  });

  // ---------- 6. states, cities, event pages ----------
  const cities = cityRows
    .filter((r) => r.path && !looksLikeStatePage(r))
    .map((r) => ({
      id: String(r.id),
      path: r.path,
      token: cityToken(r.path),
      name: stripHtml(r.values.name || r.name),
      metaDescription: r.values.meta_description || '',
      image: imageUrl(r.values.image) || imageUrl(r.values.img),
      contentHtml: r.values.content || '',
    }));
  const cityIdSet = new Set(cities.map((c) => c.id));

  const states = stateRows.map((r) => ({
    id: String(r.id),
    slug: r.path,
    name: stateNameFromRow(r.name),
    image: imageUrl(r.values.image),
    contentHtml: r.values.content || '',
    cityIds: fkIds(r.values.location_dropdown).filter((id) => cityIdSet.has(id)),
  }));

  const eventPages = eventRows.map((r) => ({
    id: String(r.id),
    path: r.path,
    url: `/services/${r.path}/`,
    name: r.name,
    title: r.values.title || r.name,
    h1: r.values.h1,
    metaDescription: r.values.meta_description || '',
    introHtml: r.values.intro || '',
    bodyHtml: r.values.body || '',
  }));

  return {
    products: [...products.values()],
    categories: [...cats.values()],
    locationPages,
    states,
    cities,
    eventPages,
    issues,
  };
}

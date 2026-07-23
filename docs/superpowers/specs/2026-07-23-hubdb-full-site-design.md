# Full HubDB Site Build — Design

**Date:** 2026-07-23
**Status:** Approved (brainstorm complete)
**Phase:** 2 — HubDB recreation, taken from Florida-sample proof to full site

## Goal

Regenerate Hartford Technology Rentals' entire page inventory (~8,400 pages) from the HubDB mirror alone, at their real URLs, deployed via CI — proving "update a product once in HubDB, the whole site follows" at full scale. This build is also the foundation for the Phase 3 pipeline (webhook → rebuild).

## Decisions (from brainstorm)

1. **Scope:** everything in HubDB — 7,502 matrix pages, 51 states, 191 cities, all PLPs/PDPs, 6 event-service pages.
2. **URLs:** mirror hartfordrents.com's real paths, verified against their live sitemap.
3. **Hosting:** CI fetches HubDB at build (token as GitHub secret), deploys to existing GitHub Pages URL with noindex. Client data never committed.
4. **Architecture:** Astro 5 Content Layer with a custom HubDB loader — replaces the interim `generate-catalog.mjs` → JSON approach.

## Non-negotiable constraints

- **HubSpot is READ ONLY.** Only `scripts/fetch-hubdb.mjs` / `scripts/hubdb.sh` (GET-only) touch the API. The Astro build never calls HubSpot — it reads the local mirror only.
- `.hubdb-cache/` and any generated data files stay gitignored (client data).
- Long-form SEO copy patterns are a hard client requirement — templates keep them.
- Canonicals and schema.org URLs always point at `https://hartfordrents.com`.

## 1. Data layer

```
scripts/fetch-hubdb.mjs (GET-only)   ← only component that talks to HubSpot
        ↓
.hubdb-cache/*.json (gitignored mirror)
        ↓
src/lib/hubdb-loader.ts (custom Content Layer loader)
        ↓
typed content collections (zod)
        ↓
routes + derived nav tree + search index
```

**Collections** (defined in `src/content.config.ts`):

| Collection | Rows | Source tables |
|---|---|---|
| `products` | 333 | `audio_visual_rental_` (204) + `computing_rentals_sub_catg` (132), minus unnamed/pathless stubs; `division` field |
| `categories` | ~59 | both category trees merged; the 8 same-slug top/mid AV twins merged into one entry each (union productIds, keep top-level metadata + rich landing content) |
| `locationPages` | 7,502 | `location_category_pages` (the matrix) |
| `states` | 51 | `location` |
| `cities` | 191 | `location_country` rows with paths; the 342 empty-path stubs are excluded as pages but retained as dropdown data |
| `eventPages` | 6 | `event_service_pages` |

**All transforms centralized in the loader:** HTML-entity stripping, `category_url` alias resolution (matrix `category_slug` values like `laptop-rental` are SEO aliases; the real category is the last segment of `category_url`, e.g. `/computing/computer-rental` → `computer-rental`), mid→top wiring via `nav_slug`, bidirectional product↔category linking (`nav_slug_cat`/`nav_slug_`/`sub_cat`/`sub_catg`/`accesories`), twins merge.

Zod schemas per collection: build fails loudly, naming table/column, if HubDB shape drifts.

## 2. URLs & routes

**Post-brainstorm discovery (2026-07-23):** live hartfordrents.com is still the **old WordPress site** (3,509 city-first `/locations/` pages, WooCommerce `/product/` slugs identical to HubDB's, Yoast sitemaps). HubDB holds the **new** site's intended structure. So URL authority = HubDB `path` + `category_url` with live-site prefixes (`/product/`, `/locations/`), and "sitemap parity" becomes a **migration-coverage report**: live WP URLs vs new-build URLs — exact matches (products ≈ 100%), changed slugs needing redirects (locations), net-new pages. Live URL lists saved as fixtures in `scripts/data/wp-live-*.txt`.

| Content | Route | Source of truth |
|---|---|---|
| Category PLPs | `/audio/[slug]/`, `/computing/[slug]/` | `category_url` values |
| Division landings | `/audio-rentals/`, `/computing-rentals/` (verify) | matrix `category_url` |
| Matrix pages (7,502) | root `/[path]/`, e.g. `/laptop-rental-orlando-fl/` (verify) | matrix `path` |
| Products (333) | verify from sitemap; fallback `/p/[slug]/` | product `path` |
| States (51) | `/locations/[path]/` | `location.path` |
| Cities (191) | `/locations/[path]/` (verify) | `location_country.path` |
| Event pages (6) | verify | `event_service_pages.path` |

- **Sitemap parity report** (script): our generated URL set vs live sitemap → matched / missing / extra. Headline client artifact.
- Parity script also asserts no internal path collisions.
- Interim sample routes (`/rent/[slug]`, `/p/[slug]` at old paths, `/locations/[matrix-slug]` Florida sample) are replaced by the real structure. POC homepage stays. Bespoke `/camera-rental/` and `/product/panasonic…/` pages retire; their design polish (FAQ blocks, long-form SEO sections, filter chips) ports into the generated templates.
- `u()` base-aware URL helper everywhere (GitHub Pages subpath).

## 3. Templates, mega menu, search

All templates reuse the existing design system (`Base.astro`, `ProductCard`, `Header`, `Footer`, `QuoteDrawer`).

- **Category PLP:** upgraded current template — rich HubDB landing content where present (`description_1/2`, 4-column heading/image/description blocks, `product_lineup`), filter chips from child categories, JSON-LD (CollectionPage + ItemList + BreadcrumbList), long-form SEO sections fed from HubDB content.
- **PDP:** current template + `content` rich HTML details, Product/LeaseOut + BreadcrumbList schema, related products from the same category.
- **Matrix location page:** proven template — h1/meta/intro from the row, product grid via resolved category, sibling city links.
- **State page:** hero + city grid (images from `location_country`), category links into the matrix, `content` rich text.
- **City landing page:** image, map iframe, content, links to that city's 31 matrix pages. Closes the "city links point to #" gap site-wide.
- **Event service pages:** simple rich-text template.
- **Mega menu:** real category tree, computing division images from real `img`/`feature_image` fields, links to mirrored URLs.
- **Search:** build-time index JSON — all products + categories + locations, with type badges. Existing autocomplete (synonyms, typo correction, ranked scoring) consumes it; lazy-loaded on first focus (~100KB guard).

## 4. CI/deploy, data quality, testing

**CI (`.github/workflows/deploy.yml` extended):**
1. `node scripts/fetch-hubdb.mjs` with `HUBSPOT_TOKEN` from GitHub Actions secrets
2. Astro build (`GITHUB_PAGES=true`)
3. Deploy to existing Pages URL

**Security (accepted risk, flagged):** the secret is the write-capable Service Key (HubSpot offered no read-only scope). Mitigations: fetch script is GET-only by construction, secret masked in logs, no other workflow touches it. Revisit if HubSpot ships scoped read-only keys.

**noindex (preview only):** `<meta name="robots" content="noindex, nofollow">` + `robots.txt Disallow: /` when `GITHUB_PAGES=true`. Production builds omit both.

**Data quality:**
- Explicit loader skip rules (no path / no name → excluded, counted).
- Build emits `data-quality-report.json`: skipped rows, orphan products, unmatched aliases, stale FK counts. Client-facing cleanup artifact, regenerated every build.
- Known client data bugs (for the report): Alabama state row named "…in Florida"; 3,181 stale `category_location_catg` refs; 2 dangling state dropdown refs (NE, NH); 342 empty-path city stubs; 6 uncategorized products (3 unnamed).

**Testing/verification:**
- Build assertions on exact counts (7,502 / 333 / 51 / 191 / 6) — fail loud.
- Sitemap parity report.
- Manual browser smoke: one page per template type.

## Out of scope (later phases)

- HubDB webhook → GitHub Actions rebuild trigger (Phase 3; this build makes it trivial).
- HubSpot inbound API actions (quote → deal with line items, timeline events, abandoned-quote workflows, no-result search logging) — sandbox portal first, explicit sign-off required.
- Production hosting on the real domain.

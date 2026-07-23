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

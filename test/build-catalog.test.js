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
  it('records skippedProducts as objects with table/id/reason', () => {
    expect(cat.issues.skippedProducts).toContainEqual({
      table: 'audio_visual_rental_',
      id: '1002',
      reason: 'missing path',
    });
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
  it('locationPage exposes id and categoryUrl', () => {
    const page = cat.locationPages.find((r) => r.path === 'laptop-rental-test-fl');
    expect(page.id).toBe('10002');
    expect(page.categoryUrl).toBe('/computing/computer-rental');
  });
  it('cleans garbled state paths via the location_detail fk', () => {
    const florida = cat.states.find((s) => s.id === '7002');
    expect(florida.path).toBe('florida');
    expect(florida.url).toBe('/locations/florida/');
  });
  it('falls back to the raw path when no fk is present', () => {
    const teststate = cat.states.find((s) => s.id === '7001');
    expect(teststate.path).toBe('teststate');
    expect(teststate.url).toBe('/locations/teststate/');
  });
  it('exposes city cityToken, url and content fields', () => {
    const city = cat.cities.find((c) => c.id === '8001');
    expect(city.cityToken).toBe('testcity-fl');
    expect(city.url).toBe('/locations/testcity-fl-audio-visual-equipment-rental/');
    expect(city.descriptionHtml).toBe('<p>city description</p>');
    expect(city.iframeHtml).toBe('<iframe src="https://maps/testcity"></iframe>');
    expect(city.image2).toBe('https://img/testcity2.jpg');
  });
  it('eventPage url is root-level, not under /services/, and has no name field', () => {
    const event = cat.eventPages.find((e) => e.path === 'test-event');
    expect(event.url).toBe('/test-event/');
    expect(event).not.toHaveProperty('name');
  });
  it('category exposes descriptionHtml/description2Html/productLineupHtml/columns', () => {
    const top = cat.categories.find((c) => c.slug === 'audio-rental' && c.level === 'top');
    expect(top.descriptionHtml).toBe('<p>Top rich content</p>');
    expect(top.description2Html).toBe('<p>Top secondary content</p>');
    expect(top.columns).toEqual([
      { heading: 'Column One', image: 'https://img/col1.jpg', description: 'Column one description' },
      { heading: 'Column Two', image: null, description: 'Column two description' },
    ]);
    const mid = cat.categories.find((c) => c.slug === 'computer-rental');
    expect(mid.productLineupHtml).toBe('<p>Computing mid product lineup</p>');
  });
});

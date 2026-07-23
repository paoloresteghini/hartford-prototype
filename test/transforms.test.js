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
  it('strips state name prefix with leading/trailing whitespace', () => {
    expect(stateNameFromRow('  Audio Visual and Technology Rentals in Connecticut')).toBe('Connecticut');
  });
  it('derives city token from path', () => {
    expect(cityToken('orlando-fl-audio-visual-equipment-rental')).toBe('orlando-fl');
    expect(cityToken('washington-dc-audio-visual-rental')).toBe('washington-dc');
  });
});

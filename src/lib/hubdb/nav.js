// Builds the mega-menu nav tree straight from the categories collection —
// no HubDB glue, no build script. Same shape Header/Footer/homepage already
// consume: [{ label, id, categories: [{ name, slug, img, blurb, subs: [{ name, slug }] }] }]
import { stripHtml } from './transforms.js';
import { u } from '../../data/catalog.js';

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
        slug: u(top.url),
        img: u(top.image),
        blurb: stripHtml(top.metaDescription).slice(0, 90),
        subs: cats
          .filter((c) => c.level === 'mid' && c.topId === top.id)
          .map((m) => ({ name: m.name, slug: u(m.url) })),
      })),
  }));
}

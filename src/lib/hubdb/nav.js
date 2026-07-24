// Builds the mega-menu nav tree straight from the categories collection —
// no HubDB glue, no build script. Same shape Header/Footer/homepage already
// consume: [{ label, id, categories: [{ name, slug, img, blurb, tagline, subs: [{ name, slug }] }] }]
import { stripHtml } from './transforms.js';
import { u } from '../../data/catalog.js';

// products is optional — only the Header passes it, to fill sparse panes
// (subs < 4) with "Popular rentals" product links and a category count.
export function buildNavFromCategories(cats, products = []) {
  const divisions = [
    { id: 'av', label: 'Audio Visual' },
    { id: 'computing', label: 'Computing' },
  ];
  return divisions.map((d) => ({
    ...d,
    categories: cats
      .filter((c) => c.division === d.id && c.level === 'top')
      .map((top) => {
        const mids = cats.filter((c) => c.level === 'mid' && c.topId === top.id);
        const subs = mids.map((m) => ({ name: m.name, slug: u(m.url) }));
        const catIds = new Set([top.id, ...mids.map((m) => m.id)]);
        const catProducts = products.filter((p) => p.categoryIds?.some((id) => catIds.has(id)));
        return {
          name: top.name,
          slug: u(top.url),
          img: u(top.image),
          blurb: stripHtml(top.metaDescription).slice(0, 90),
          tagline:
            subs.length >= 2
              ? `${subs[0].name} & ${subs[1].name} at your fingertips!`
              : `${top.name} at your fingertips!`,
          subs,
          productCount: catProducts.length,
          topProducts:
            subs.length < 4
              ? catProducts.slice(0, 8).map((p) => ({ name: p.name, slug: u(p.url) }))
              : [],
        };
      }),
  }));
}

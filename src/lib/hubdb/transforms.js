export const stripHtml = (html) =>
  (html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;|&rsquo;/g, "'")
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
  (name || '').replace(/^\s*Audio Visual and Technology Rentals in\s*/i, '').trim();

export const cityToken = (path) =>
  (path || '').replace(/-audio-visual(-equipment)?-rental$/i, '');

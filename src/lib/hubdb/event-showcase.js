// Flagship event-page treatment: per-path config mapping the page's h2
// sections to venue zones + live catalog categories. Pages without an entry
// fall back to the simple prose template in src/pages/[slug].astro.

export const EVENT_SHOWCASE = {
  'best-event-equipment-rentals': {
    // Local curated hero — the migrated CDN banner has baked-in text and
    // crops badly in a portrait panel.
    heroImage: '/img/event-solutions.jpg',
    heroAlt: 'Keynote presentation on a large projection screen above a full audience, stage truss and lighting overhead',
    zones: [
      {
        match: /registration|check-?in/i,
        label: 'Zone · Check-in',
        cats: ['badge-printer-rental', 'id-card-printer-rental', 'ipad-rental', 'microsoft-surface-rental'],
      },
      {
        match: /presentation|display/i,
        label: 'Zone · Main stage',
        cats: ['projector-rental', 'led-video-wall-rental', 'tv-and-display-rental', 'presentation-equipment-rental'],
      },
      {
        match: /hybrid|breakout/i,
        label: 'Zone · Breakout rooms',
        cats: ['conferencing-equipment-rental', 'virtual-meeting-kit-rental', 'camera-rental', 'audio-rental'],
      },
      {
        match: /exhibit|trade\s?show/i,
        label: 'Zone · Expo floor',
        cats: ['lighting-equipment-rental', 'event-printer-rental', 'cell-phone-charging-kiosk-rental', 'gaming-pc-rental'],
      },
    ],
  },
};

// Split HubDB body HTML into sections at <h2> boundaries.
// Returns [{ heading, html }] — heading is plain text, html is the section
// body without its heading.
export function parseEventBody(bodyHtml) {
  return (bodyHtml || '')
    .split(/<h2>/i)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const m = chunk.match(/^(.*?)<\/h2>([\s\S]*)$/i);
      if (!m) return { heading: '', html: chunk };
      return {
        heading: m[1].replace(/<[^>]+>/g, '').trim(),
        html: m[2].trim(),
      };
    });
}

// Parse "Title: description" list items (the "What Sets Hartford Apart"
// pillars) out of a section's html. Returns [{ title, text }].
export function parsePillars(sectionHtml) {
  const items = [...(sectionHtml || '').matchAll(/<li>([\s\S]*?)<\/li>/gi)].map((m) =>
    m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  );
  return items
    .map((t) => {
      const i = t.indexOf(':');
      return i > 0
        ? { title: t.slice(0, i).trim(), text: t.slice(i + 1).trim() }
        : { title: '', text: t };
    })
    .filter((p) => p.text);
}

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

// src/content.config.ts
import { defineCollection, z } from 'astro:content';
import { buildCatalog } from './lib/hubdb/build-catalog.js';

const catalog = buildCatalog(new URL('../.hubdb-cache', import.meta.url).pathname);

const fromArray = (rows: any[] | undefined, schema: z.ZodTypeAny) =>
  defineCollection({
    loader: () => (rows ?? []).map((r) => ({ ...r, id: String(r.id) })),
    schema,
  });

const categorySchema = z.object({
  id: z.string(),
  slug: z.string(),
  url: z.string(),
  name: z.string(),
  level: z.enum(['top', 'mid']),
  division: z.enum(['av', 'computing']),
  topId: z.string().nullable(),
  image: z.string().nullable(),
  metaDescription: z.string(),
  descriptionHtml: z.string(),
  description2Html: z.string(),
  productLineupHtml: z.string(),
  columns: z.array(
    z.object({
      heading: z.string(),
      image: z.string().nullable(),
      description: z.string(),
    })
  ),
  productIds: z.array(z.string()),
});

const productSchema = z.object({
  id: z.string(),
  slug: z.string(),
  url: z.string(),
  name: z.string(),
  blurb: z.string(),
  metaDescription: z.string(),
  contentHtml: z.string(),
  image: z.string().nullable(),
  imageAlt: z.string(),
  division: z.enum(['av', 'computing']),
  categoryIds: z.array(z.string()),
});

const locationPageSchema = z.object({
  id: z.string(),
  path: z.string(),
  url: z.string(),
  pageName: z.string(),
  state: z.string(),
  stateSlug: z.string(),
  category: z.string(),
  categorySlug: z.string(),
  categoryUrl: z.string(),
  h1: z.string(),
  metaDescription: z.string(),
  introHtml: z.string(),
  isStateLevel: z.boolean(),
  categoryId: z.string().nullable(),
});

const stateSchema = z.object({
  id: z.string(),
  path: z.string(),
  url: z.string(),
  name: z.string(),
  image: z.string().nullable(),
  contentHtml: z.string(),
  cityIds: z.array(z.string()),
});

const citySchema = z.object({
  id: z.string(),
  path: z.string(),
  url: z.string(),
  name: z.string(),
  cityToken: z.string(),
  metaDescription: z.string(),
  image: z.string().nullable(),
  image2: z.string().nullable(),
  contentHtml: z.string(),
  descriptionHtml: z.string(),
  iframeHtml: z.string(),
});

const eventPageSchema = z.object({
  id: z.string(),
  path: z.string(),
  url: z.string(),
  h1: z.string(),
  title: z.string(),
  metaDescription: z.string(),
  introHtml: z.string(),
  bodyHtml: z.string(),
});

export const collections = {
  products: fromArray(catalog?.products, productSchema),
  categories: fromArray(catalog?.categories, categorySchema),
  locationPages: fromArray(catalog?.locationPages, locationPageSchema),
  states: fromArray(catalog?.states, stateSchema),
  cities: fromArray(catalog?.cities, citySchema),
  eventPages: fromArray(catalog?.eventPages, eventPageSchema),
};

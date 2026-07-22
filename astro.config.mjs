// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// GitHub Pages preview build (subpath deploy) vs. canonical client domain
const ghPages = process.env.GITHUB_PAGES === 'true';

export default defineConfig({
  site: ghPages ? 'https://paoloresteghini.github.io' : 'https://hartfordrents.com',
  base: ghPages ? '/hartford-prototype' : undefined,
  devToolbar: { enabled: false },
  vite: {
    plugins: [tailwindcss()],
  },
});

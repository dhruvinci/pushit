import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import sitemap from '@astrojs/sitemap';
import remarkClip from './src/lib/remark-clip.mjs';

// Canonical URLs and link-preview images need an absolute origin. Use SITE_URL if set, else the
// Vercel production domain (so *.vercel.app previews work before pushit.tv is connected).
const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
const site = process.env.SITE_URL ?? (vercel ? `https://${vercel}` : 'https://pushit.tv');

export default defineConfig({
  site,
  trailingSlash: 'always',
  integrations: [sitemap({ filter: (page) => !page.endsWith('/404/') })],
  markdown: {
    processor: unified({ remarkPlugins: [remarkClip] }),
  },
});

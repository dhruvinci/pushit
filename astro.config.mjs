import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import sitemap from '@astrojs/sitemap';
import remarkClip from './src/lib/remark-clip.mjs';

// Canonical URLs and link-preview images need an absolute origin that matches where the page
// actually lives — WhatsApp won't show a preview otherwise. Production is www.pushit.tv (Vercel
// redirects the apex there); Vercel preview builds use their own deployment URL.
const PRODUCTION = 'https://www.pushit.tv';
const { SITE_URL, VERCEL_ENV, VERCEL_URL } = process.env;
const site = SITE_URL ?? (VERCEL_ENV === 'preview' && VERCEL_URL ? `https://${VERCEL_URL}` : PRODUCTION);

export default defineConfig({
  site,
  trailingSlash: 'always',
  integrations: [sitemap({ filter: (page) => !page.endsWith('/404/') })],
  markdown: {
    processor: unified({ remarkPlugins: [remarkClip] }),
  },
});

import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import sitemap from '@astrojs/sitemap';
import remarkClip from './src/lib/remark-clip.mjs';

export default defineConfig({
  site: 'https://pushit.tv',
  trailingSlash: 'always',
  integrations: [sitemap({ filter: (page) => !page.endsWith('/404/') })],
  markdown: {
    processor: unified({ remarkPlugins: [remarkClip] }),
  },
});

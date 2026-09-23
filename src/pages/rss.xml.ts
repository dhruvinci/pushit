import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getEpisodes, SERIES, stamp } from '../lib/episodes';
import { SITE } from '../site';

export async function GET(context: APIContext) {
  const episodes = await getEpisodes();
  return rss({
    title: SITE.name,
    description: SITE.tagline,
    site: context.site!,
    items: episodes
      .sort((a, b) => b.data.published.valueOf() - a.data.published.valueOf())
      .map((ep) => ({
        title: `${stamp(ep.data.date)} ${ep.data.subject} — ${ep.data.title}`,
        description: ep.data.summary,
        pubDate: ep.data.published,
        link: `/tapes/${ep.id}/`,
        categories: [SERIES[ep.data.series].label],
      })),
    customData: '<language>en-in</language>',
  });
}

import { getCollection, type CollectionEntry } from 'astro:content';
import { resolveClip, mediaUrl } from './media.mjs';

export type Episode = CollectionEntry<'episodes'>;
export type Series = Episode['data']['series'];

export const SERIES: Record<Series, { label: string; code: string; blurb: string }> = {
  'rehearsal-tapes': {
    label: 'Rehearsal Tapes',
    code: 'RT',
    blurb: 'Full sets filmed in the jam room, days before the show.',
  },
  scenes: {
    label: 'Scenes From The Scene',
    code: 'SFS',
    blurb: 'Gig diaries. What happened, who was there, who got hit.',
  },
  portraits: { label: 'Portraits', code: 'PT', blurb: 'The minds behind the noise, in their own words.' },
  bts: { label: 'Behind The Scenes', code: 'BTS', blurb: 'Outtakes from the videos we make with bands.' },
  specials: { label: 'Specials', code: 'SP', blurb: 'We interrupt your regular programming.' },
};

const pad = (n: number) => String(n).padStart(2, '0');

/** The house date stamp: (26.06.26) */
export const stamp = (d: Date) => `(${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${String(d.getUTCFullYear()).slice(2)})`;

export const longDate = (d: Date) =>
  d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export const clock = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
};

/** "4:24" / "1:02:03" → seconds */
export const seconds = (t: string) => t.split(':').reduce((acc, part) => acc * 60 + Number(part), 0);

const CLIP_LINE = /^::clip\s+(\S+)/gm;

export function clipCount(ep: Episode) {
  return (ep.body?.match(CLIP_LINE)?.length ?? 0) + ep.data.gallery.length;
}

/** Runtime of the YouTube tapes, or the number of clips for Instagram-only diaries. */
export function runtime(ep: Episode) {
  const total = ep.data.youtube.reduce((sum, v) => sum + (v.duration ?? 0), 0);
  if (total) return clock(total);
  const clips = clipCount(ep);
  return clips ? `${clips} clips` : '—';
}

/** A cover is a clip ref ("Code/NN") or a path under public/media ("/media/yt/…"). */
export function coverSrc(cover: string) {
  if (cover.startsWith('/media/')) return mediaUrl(cover.slice('/media/'.length));
  return resolveClip(cover).still;
}

/** All episodes, newest first, each with a tape number (PTV-001 is the oldest). */
export async function getEpisodes() {
  const all = await getCollection('episodes');
  const chronological = [...all].sort((a, b) => a.data.date.valueOf() - b.data.date.valueOf());
  const numbers = new Map(chronological.map((ep, i) => [ep.id, `PTV-${String(i + 1).padStart(3, '0')}`]));
  return chronological.reverse().map((ep) => Object.assign(ep, { tape: numbers.get(ep.id)! }));
}

export type NumberedEpisode = Awaited<ReturnType<typeof getEpisodes>>[number];

export const ytThumb = (id: string) => mediaUrl(`yt/${id}.jpg`);

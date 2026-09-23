import { defineCollection, reference } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { z } from 'astro/zod';

export const SERIES = ['rehearsal-tapes', 'scenes', 'portraits', 'bts', 'specials'] as const;

const youtube = z.object({
  id: z.string(),
  title: z.string(),
  duration: z.number().optional(), // seconds
  // "mm:ss" or "h:mm:ss" chapter marks, shown as a clickable setlist
  chapters: z.array(z.object({ t: z.string(), label: z.string() })).default([]),
});

const episodes = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/episodes' }),
  schema: z.object({
    subject: z.string(), // the big display name: band, event or person
    title: z.string(), // headline
    series: z.enum(SERIES),
    date: z.coerce.date(), // when it was filmed
    published: z.coerce.date(),
    city: z.string().optional(),
    venue: z.string().optional(),
    summary: z.string(),
    cover: z.string(), // clip ref ("Code/NN") or absolute path under public/
    heroClip: z.string().optional(), // clip ref for the looping header video
    youtube: z.array(youtube).default([]),
    instagram: z.array(z.string()).default([]), // post shortcodes
    spotted: z.array(reference('spotted')).default([]),
    lineup: z.array(z.string()).default([]),
    nextShow: z
      .object({ date: z.coerce.date(), venue: z.string(), city: z.string(), note: z.string().optional() })
      .optional(),
    gallery: z.array(z.string()).default([]), // extra clip refs shown after the text
  }),
});

const spotted = defineCollection({
  loader: file('./src/data/spotted.json'),
  schema: z.object({
    name: z.string(),
    kind: z.enum(['band', 'artist', 'venue', 'promoter', 'label']),
    city: z.string().optional(),
    genre: z.string().optional(),
    instagram: z.string().optional(),
  }),
});

const work = defineCollection({
  loader: file('./src/data/work.json'),
  schema: z.object({
    title: z.string(),
    artist: reference('spotted'),
    kind: z.string(), // "Music video", "Visualiser"
    year: z.number(),
    youtube: z.string(),
    credits: z.array(z.object({ role: z.string(), names: z.string() })),
    note: z.string().optional(),
    bts: reference('episodes').optional(),
  }),
});

export const collections = { episodes, spotted, work };

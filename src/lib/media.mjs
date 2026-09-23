// Self-hosted media, described by src/data/media.json (written by scripts/import-media.sh).
// Pages build from the manifest alone, so the files themselves can live in public/ or on a
// bucket: set PUBLIC_MEDIA_BASE (e.g. https://media.pushit.tv) to serve media/… from there.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const manifest = JSON.parse(readFileSync(join(process.cwd(), 'src/data/media.json'), 'utf8'));
const BASE = (import.meta.env?.PUBLIC_MEDIA_BASE ?? process.env.PUBLIC_MEDIA_BASE ?? '').replace(/\/$/, '');

/** URL for a file under public/media, e.g. mediaUrl('yt/abc.jpg') */
export const mediaUrl = (path) => `${BASE}/media/${path}`;

/**
 * A ref is "<instagram shortcode>/<carousel index>", e.g. "DaVcpQwj-3d/03".
 * Every ref has a still; refs used as header loops also have a short silent video.
 */
export function resolveClip(ref) {
  const clip = manifest.clips[ref];
  if (!clip) throw new Error(`Media "${ref}" is not in src/data/media.json — run npm run import-media`);
  const [code] = ref.split('/');
  const loop = manifest.loops[ref];
  return {
    still: mediaUrl(`ig/${ref}.jpg`),
    loop: loop ? mediaUrl(`loops/${ref}.mp4`) : null,
    w: clip.w,
    h: clip.h,
    fromVideo: clip.video,
    instagram: `https://www.instagram.com/p/${code}/`,
    orientation: clip.h > clip.w ? 'portrait' : 'landscape',
  };
}

const escapeAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// Inline footage in the diaries: a still. Frames from videos link to the post so people watch
// the real thing on Instagram rather than a copy we host.
export function clipHtml(ref, caption = '') {
  const clip = resolveClip(ref);
  const img = `<img class="clip-media" src="${clip.still}" width="${clip.w}" height="${clip.h}" alt="${escapeAttr(caption)}" loading="lazy" decoding="async">`;
  const media = clip.fromVideo
    ? `<a class="clip-link" href="${clip.instagram}" rel="noopener">${img}<span class="clip-watch">▶ Watch on Instagram</span></a>`
    : img;
  const cap = caption ? `<figcaption>${escapeAttr(caption)}</figcaption>` : '';
  return `<figure class="clip clip--${clip.orientation}">${media}${cap}</figure>`;
}

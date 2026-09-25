# Pushit TV

Website for [Pushit TV](https://www.instagram.com/pushit.tv/) — documenting the sick and the disturbed.
A static [Astro](https://astro.build) site: every tape is a Markdown file, footage is self-hosted, full sets are YouTube embeds.

```sh
npm install
npm run dev       # http://localhost:4321
npm run build     # static site in dist/
```

> If `npm install` hangs with `ETIMEDOUT`, prefix it with `NODE_OPTIONS=--dns-result-order=ipv4first`.

## Adding a tape

1. Create `src/content/episodes/<slug>.md`. Copy an existing one — the frontmatter schema lives in `src/content.config.ts`.
   - `series`: `rehearsal-tapes`, `scenes`, `portraits`, `bts` or `specials`
   - `date` is when it was filmed; the house stamp `(DD.MM.YY)` is generated from it.
   - `spotted`: ids from `src/data/spotted.json` (add new bands/venues there).
   - `youtube`: full videos, with optional `chapters` that become a clickable setlist.
2. Drop footage between paragraphs:

   ```md
   ::clip DaVcpQwj-3d/03
   ::clip DaVcpQwj-3d/03 "Optional caption"
   ```

   A clip ref is `<instagram shortcode>/<carousel index>` and points at `public/media/ig/<ref>.mp4|.jpg`.
3. Regenerate the link-preview images: `.venv/bin/python scripts/make-brand.py`

## Automatic updates

Every day at noon IST, `.github/workflows/daily-tapes.yml` checks for new posts on Instagram and YouTube
(via Apify). If there are any, Claude writes the tapes following `automation/tape-bot.md` (picking the
cover and the homepage loop) and pushes to `main`, and Vercel deploys. Run it by hand from the repo's
Actions tab. Posts it has handled or skipped are listed in `automation/seen.json`. If you add a tape by
hand, add its post there too. Needs repo secrets `APIFY_TOKEN` and `ANTHROPIC_API_KEY`.

## Media — host as little as possible

Full videos are **YouTube embeds** (poster-first: nothing loads from YouTube until someone presses play).
Instagram footage appears as **stills that link to the post**. The only video the site hosts is a
~10 s loop per page header (`heroClip`), muted until someone taps for sound. Total self-hosted media is a few MB.

- `scripts/import-media.sh` builds `public/media` from a scraped Instagram export (`research/ig/posts.json`,
  not committed) and writes `src/data/media.json`, the manifest pages build from. Needs `ffmpeg`, `jq`, `curl`.
  Header loops start at 1 s unless `scripts/loop-starts.txt` says otherwise.
- To serve media from a bucket (e.g. Cloudflare R2), upload `public/media/` as `media/` and build with
  `PUBLIC_MEDIA_BASE=https://your-bucket-domain`. Pages only read the manifest, so `public/media` can then go.
- `scripts/make-brand.py` builds the favicon set, app icons and a 1200×630 link-preview image for every page
  (`public/og/`). Needs Pillow and `node_modules` (fonts). Re-run it after adding a tape or a band.

> Changed `src/lib/remark-clip.mjs`? Delete `.astro/` and `node_modules/.astro/` before building —
> Astro caches rendered Markdown.

## Brand

The logo (boxed PUSHIT.TV wordmark over a CCTV-dome eye, "All-India Propaganda") is redrawn in
`src/components/Logo.astro` and `scripts/make-brand.py` from the Instagram avatar. Replace with the
original vector artwork when available.

## Hosting

Any static host works (`npm run build` → `dist/`). Cloudflare Pages is the suggested default: free for
commercial use, and R2 sits on the same account if media ever outgrows the repo.

## What's where

| Path | |
|---|---|
| `src/content/episodes/` | One Markdown file per tape |
| `src/data/spotted.json` | Bands, artists, venues, promoters |
| `src/data/work.json` | Music videos for the Work page |
| `src/site.ts` | Site name, social links, contact email |
| `src/lib/remark-clip.mjs` | The `::clip` Markdown shorthand |
| `src/styles/global.css` | Design tokens and shared styles |

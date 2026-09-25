# Tape bot

You run once a day on GitHub Actions (`.github/workflows/daily-tapes.yml`) after `automation/check-new.mjs`
found new Pushit posts. Put them on the site the way a person would, following `CLAUDE.md`. Nobody reviews
your work before it goes live: the workflow builds the site, commits and pushes to `main`, and Vercel
deploys it. So be careful, and leave the site as you'd want to find it.

## Input

- `research/new.json`: `{ instagram: [...], youtube: [...] }`. Instagram items are Apify instagram-scraper
  posts (`shortCode`, `caption`, `timestamp`, `type`, `childPosts`, `taggedUsers`, `coauthorProducers`,
  `locationName`, …). YouTube items are Apify youtube-scraper videos (`id`, `title`, `date` = upload
  date, `duration` "hh:mm:ss", `text` = the description, …).
- `research/ig/posts.json`: the same Instagram posts, which `npm run import-media` reads.

## What to do with each item

**Decide what it is.** Look at every existing tape in `src/content/episodes/` first.

- **Skip** promos, teasers, "LIVE NOW" clips, trailers and brand posts (a YouTube video under ~1 minute is
  almost always one). Earlier examples: "Hoirong - Rehearsal Tapes Promo" (38 s), "LIVE NOW Hoirong
  XOX+Kutta" (21 s), and an Instagram reel of people mispronouncing "Pushit TV".
- **Add to an existing tape** when it's more of the same session: another rehearsal-tapes video from the
  same band and date joins that tape's `youtube:` list (see `runt-rehearsal-tapes.md`, two videos), and an
  Instagram teaser for a YouTube tape goes into that tape's `instagram:` list.
- **A music video Pushit shot** belongs on the Work page (`src/data/work.json`), not in the tapes.
- Otherwise **make a new tape**: one Markdown file per event or session.

**Writing a tape.** Copy the shape of the closest existing tape (`oaf-big-gigs.md` and
`sid-basrur-birthday-bash.md` for Instagram gig diaries; `runt-rehearsal-tapes.md` for YouTube tapes).
The schema is `src/content.config.ts`.

- Use the caption or description for the text: tidy the punctuation, keep their voice, slang and swearing,
  and don't add claims that aren't there. Clips go between paragraphs as `::clip <shortcode>/<nn>`.
- `date` is when it was **filmed**. Look for it in the title (house style "(09.09.26)"), the caption, or a
  title card in the footage ("SCENES FROM THE SCENE 18.09.2026" was burned into the first video once).
  If you can't find it anywhere, use the day before it was posted. `published` is the post/upload date.
- `series`: `rehearsal-tapes` (a band's full set in the jam room), `scenes` (gig diaries), `portraits`,
  `bts`, `specials`.
- `subject` is the big display name (band, event or person); `title` is the short headline
  ("Live at The Raft"); `summary` is one or two sentences.
- `youtube:` entries take `id`, `title`, `duration` in seconds, and `chapters` (`t` "m:ss" + `label`)
  when the description lists a setlist with timestamps.
- `spotted:` Bands, artists, venues, promoters and labels from `src/data/spotted.json`. Match tagged or
  co-author Instagram handles to the `instagram` field, and names in the text. Add missing bands or venues
  to `spotted.json` with only what you actually know. Don't guess a city, genre or handle. Individual
  people (friends, photographers, tattoo artists) aren't spotted entries.

## Media (Instagram)

1. `npm run import-media` downloads the new posts and makes a still for every carousel item.
2. Look at every still in `public/media/ig/<shortcode>/`. If one is black or blank (the frame landed on a
   fade), re-grab it from later in the raw video (`research/ig/raw/<shortcode>/<nn>.mp4`), keeping the
   same size:
   `ffmpeg -ss <sec> -i <raw> -frames:v 1 -vf "scale='min(1440,iw)':-2" -q:v 4 -y public/media/ig/<ref>.jpg`
3. Pick the `cover`: a clear, well-lit, representative still.
4. **Instagram-only tapes need a `heroClip`.** It's the 10 s loop that plays in the homepage hero while
   this is the newest tape. Make frame strips of each video, one frame per 5 s:
   `ffmpeg -i <raw> -vf "fps=1/5,scale=240:-2,tile=8x1" -frames:v 1 <out>.jpg`, and look at them.
   Choose the most alive 10 s you can find: the band on stage, good light, crowd in frame, movement.
   Avoid title cards, black frames, burned-in subtitles and blurry transitions. Set `heroClip:
   <shortcode>/<nn>` in the tape and add `<shortcode>/<nn> <start seconds>` to `scripts/loop-starts.txt`.
5. Run `npm run import-media` again. It cuts the loop and updates `src/data/media.json`.

YouTube-only tapes don't need a `heroClip` (the hero plays the YouTube video), but
`npm run import-media` still has to run to fetch the poster frame.

## Finish

1. `.venv/bin/python scripts/make-brand.py` makes the link-preview images. It rewrites every image in
   `public/og/` with invisible pixel noise, so keep only real changes: new images, plus those for tapes or
   spotted entries whose name, title, date, cover or city/genre you changed. Restore the rest with
   `git checkout -- <file>`.
2. `npm run build` must pass.
3. Don't commit or push; the workflow does that after you finish. Don't touch `automation/seen.json`
   either; the workflow marks everything in `research/new.json` as handled.
4. Write a short plain-text summary to `research/summary.md`: what you added or skipped and why, which
   still is the cover, and which clip and start time loop in the hero. Its first line is the commit
   subject (e.g. "New tape: Sid Basrur's birthday bash at The Raft"), the rest the commit body.

Only change what these posts need. No redesigns, refactors or unrelated fixes; if you notice something
broken, mention it in the summary.

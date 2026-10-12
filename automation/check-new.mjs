// Daily check for new Pushit posts: the latest Instagram posts and YouTube uploads, via Apify.
// Anything not in automation/seen.json is new. Writes:
//   research/ig/posts.json   the new Instagram posts, in the shape scripts/import-media.sh reads
//   research/new.json        { instagram: [...], youtube: [...] } for the tape bot
// and sets the GitHub Actions output `found=true|false`.
//
// It also syncs the homepage TV with Josh's "Landing Page Loop" playlist: src/data/tv.json (plus a
// poster for any video new to the site), the TV commit message in research/tv.md, and the output
// `tv=true|false`. That part needs no Claude: whatever's on the playlist is on air.
//
// usage: APIFY_TOKEN=… node automation/check-new.mjs
// `node automation/check-new.mjs --mark-seen` adds everything in research/new.json to seen.json.
import { readFileSync, writeFileSync, mkdirSync, appendFileSync, existsSync } from 'node:fs';

const SEEN = 'automation/seen.json';
const TV = 'src/data/tv.json';
const TV_PLAYLIST = 'https://www.youtube.com/playlist?list=PLD_IjtNNdGSQ';
const NEW = 'research/new.json';
const seen = JSON.parse(readFileSync(SEEN, 'utf8'));

if (process.argv.includes('--mark-seen')) {
  const found = JSON.parse(readFileSync(NEW, 'utf8'));
  seen.instagram = [...new Set([...seen.instagram, ...found.instagram.map((p) => p.shortCode)])].sort();
  seen.youtube = [...new Set([...seen.youtube, ...found.youtube.map((v) => v.id)])].sort();
  writeFileSync(SEEN, JSON.stringify(seen, null, 2) + '\n');
  process.exit(0);
}

const token = process.env.APIFY_TOKEN;
if (!token) throw new Error('APIFY_TOKEN is not set');

async function actor(name, input) {
  const url = `https://api.apify.com/v2/acts/${name}/run-sync-get-dataset-items?token=${token}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(300_000),
  });
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status} ${await res.text()}`);
  return res.json();
}

const youtube = (url, maxResults) =>
  actor('streamers~youtube-scraper', { startUrls: [{ url }], maxResults, maxResultsShorts: 0, maxResultStreams: 0 });

const [posts, videos, playlist] = await Promise.all([
  actor('apify~instagram-scraper', {
    directUrls: ['https://www.instagram.com/pushit.tv/'],
    resultsType: 'posts',
    resultsLimit: 6,
  }),
  youtube('https://www.youtube.com/@pushit.television/videos', 6),
  youtube(TV_PLAYLIST, 200).catch((e) => (console.log(`TV: ${e.message}`), [])), // never block the tapes
]);

// Pinned posts can be old; only what we haven't handled counts.
const newPosts = posts.filter((p) => p.shortCode && !seen.instagram.includes(p.shortCode));
const newVideos = videos.filter((v) => v.id && !seen.youtube.includes(v.id));

mkdirSync('research/ig', { recursive: true });
writeFileSync('research/ig/posts.json', JSON.stringify(newPosts, null, 2));
writeFileSync(NEW, JSON.stringify({ instagram: newPosts, youtube: newVideos }, null, 2));

const found = newPosts.length + newVideos.length > 0;
console.log(`Instagram: ${newPosts.map((p) => p.shortCode).join(', ') || 'nothing new'}`);
console.log(`YouTube: ${newVideos.map((v) => `${v.id} (${v.title})`).join(', ') || 'nothing new'}`);

// --- the homepage TV: tv.json mirrors the playlist. Titles already in tv.json are kept (they may have
// been tidied by hand; the TV shows a tape's own titles anyway); durations follow YouTube.
const seconds = (t) => String(t).split(':').reduce((acc, part) => acc * 60 + Number(part), 0);
const before = JSON.parse(readFileSync(TV, 'utf8'));
const old = new Map(before.map((v) => [v.id, v]));
const onAir = playlist.filter((v) => v.id && seconds(v.duration) > 0);
let tv = false;
if (!onAir.length) {
  console.log('TV: the playlist came back empty; leaving tv.json alone'); // a scraper hiccup, not an empty playlist
} else {
  const after = [...new Map(onAir.map((v) => [v.id, { id: v.id, title: old.get(v.id)?.title ?? v.title, duration: seconds(v.duration) }])).values()]
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  const added = after.filter((v) => !old.has(v.id));
  const dropped = before.filter((v) => !after.some((a) => a.id === v.id));
  tv = JSON.stringify(after) !== JSON.stringify(before);
  if (tv) {
    writeFileSync(TV, JSON.stringify(after, null, 2) + '\n');
    // The TV shows each show's poster from public/media/yt; tape videos have one, a video only on the playlist doesn't yet.
    for (const { id } of after) {
      const file = `public/media/yt/${id}.jpg`;
      if (existsSync(file)) continue;
      for (const size of ['maxresdefault', 'hqdefault']) {
        const res = await fetch(`https://i.ytimg.com/vi/${id}/${size}.jpg`);
        if (res.ok) { writeFileSync(file, Buffer.from(await res.arrayBuffer())); break; }
      }
    }
    const list = (vs) => vs.map((v) => `- ${v.title} (${v.id})`).join('\n');
    writeFileSync(
      'research/tv.md',
      [
        'Homepage TV: sync the Landing Page Loop playlist',
        added.length ? `On air:\n${list(added)}` : '',
        dropped.length ? `Off air:\n${list(dropped)}` : '',
        !added.length && !dropped.length ? 'Durations changed.' : '',
      ].filter(Boolean).join('\n\n') + '\n',
    );
  }
  console.log(`TV: ${tv ? `${added.length} on, ${dropped.length} off` : 'no change'} (${after.length} videos)`);
}

if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `found=${found}\ntv=${tv}\n`);

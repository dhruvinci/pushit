// Daily check for new Pushit posts: the latest Instagram posts and YouTube uploads, via Apify.
// Anything not in automation/seen.json is new. Writes:
//   research/ig/posts.json   the new Instagram posts, in the shape scripts/import-media.sh reads
//   research/new.json        { instagram: [...], youtube: [...] } for the tape bot
// and sets the GitHub Actions output `found=true|false`.
//
// usage: APIFY_TOKEN=… node automation/check-new.mjs
// `node automation/check-new.mjs --mark-seen` adds everything in research/new.json to seen.json.
import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs';

const SEEN = 'automation/seen.json';
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

const [posts, videos] = await Promise.all([
  actor('apify~instagram-scraper', {
    directUrls: ['https://www.instagram.com/pushit.tv/'],
    resultsType: 'posts',
    resultsLimit: 6,
  }),
  actor('streamers~youtube-scraper', {
    startUrls: [{ url: 'https://www.youtube.com/@pushit.television/videos' }],
    maxResults: 6,
    maxResultsShorts: 0,
    maxResultStreams: 0,
  }),
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
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `found=${found}\n`);

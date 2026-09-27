// The homepage TV's broadcast schedule. Pure (no Astro imports) so the build and the browser share it.
//
// Every YouTube video on the site airs once per loop. The loops run back to back from EPOCH, each in its
// own shuffled order, seeded by the loop number, so every visitor sees the same show at the same moment
// with no server involved. Adding a video changes the loop length and so reshuffles the schedule from
// then on, which is fine: nobody can tell.

export interface Show {
  id: string; // YouTube video id
  duration: number; // seconds
  subject: string; // band, event or person
  title: string;
  label: string; // series or kind, e.g. "Rehearsal Tapes", "Music video"
  href: string; // where it lives on the site
  tape?: string; // PTV-012
}

export interface Slot {
  show: Show;
  start: number; // unix seconds the show began (or begins)
  end: number;
  offset: number; // seconds into the show at the time asked
}

/** Midnight IST, 1 September 2026: loop zero. */
const EPOCH = Date.UTC(2026, 7, 31, 18, 30) / 1000;

// mulberry32: small, fast, good enough to shuffle a playlist
const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const hash = (s: string) => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261);

export function schedule(roster: Show[]) {
  // Sort first so the schedule depends on what's in the roster, not the order the build found it in.
  const shows = [...roster].sort((a, b) => (a.id < b.id ? -1 : 1));
  const n = shows.length;
  const loop = shows.reduce((sum, s) => sum + s.duration, 0);
  const salt = hash(shows.map((s) => s.id).join());

  const shuffled = (k: number) => {
    const r = rng(salt ^ Math.imul(k, 2654435761));
    const a = shows.map((_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const orders = new Map<number, number[]>();
  /** Loop k's running order. Never opens with the show that closed loop k-1. */
  const order = (k: number) => {
    let a = orders.get(k);
    if (!a) {
      a = shuffled(k);
      if (n > 2 && a[0] === shuffled(k - 1)[n - 1]) [a[0], a[1]] = [a[1], a[0]];
      orders.set(k, a);
    }
    return a;
  };

  /** The show on air at unix time `t` (seconds), followed by the next `count` shows. */
  function at(t: number, count = 0): Slot[] {
    const k = Math.floor((t - EPOCH) / loop);
    let start = EPOCH + k * loop;
    let loopN = k, i = 0;
    const next = () => {
      const show = shows[order(loopN)[i]];
      const slot = { show, start, end: start + show.duration, offset: t - start };
      start = slot.end;
      if (++i === n) (i = 0), loopN++;
      return slot;
    };
    let slot = next();
    while (slot.end <= t) slot = next();
    const slots = [slot];
    while (slots.length <= count) slots.push(next());
    return slots;
  }

  return { at, loop, count: n };
}

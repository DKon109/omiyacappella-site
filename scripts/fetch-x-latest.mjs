/**
 * Collects the newest posts from the group's X account and writes them, with
 * their media, into the site.
 *
 *   node scripts/fetch-x-latest.mjs
 *
 * Two steps, because neither alone is enough:
 *
 *   1. The logged-out profile is rendered by JavaScript, so a headless browser
 *      reads it — but only to harvest status ids.
 *   2. Each id then goes to X's public syndication endpoint, which returns the
 *      text and media as JSON without a browser or an API key.
 *
 * Sorting by the timestamp that step 2 returns drops the pinned post out of the
 * top three on its own, so there is no need to recognise the pin in the markup.
 *
 * Nothing is written unless a full set of posts was gathered: a bad scrape
 * leaves the previous file in place rather than emptying the section.
 */

import { chromium } from 'playwright';
import { mkdir, readFile, writeFile, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';

const HANDLE = 'OMIYAacappella';

/* At most three cards, but the section is worth showing with fewer. */
const WANTED = 3;
const MIN_POSTS = 1;

/* Ids listed here are skipped. Empty: the section shows whatever the account
   posted most recently, minus the pin. */
const EXCLUDE_IDS = new Set([]);
const OUT_JSON = 'assets/data/x-latest.json';
const MEDIA_DIR = 'assets/data/x-media';

/* X serves video only to requests without a Referer, and a 25MB ceiling keeps
   one long clip from landing in the repository. */
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/* X serves a logged-out profile inconsistently: sometimes the timeline, often a
   rate-limit notice or a login wall, and which one you get varies by request
   rather than by anything we control. One attempt is therefore not evidence of
   anything, so this retries before giving up — and when it does give up, it
   reports what the page actually said, so the next failure can be told apart
   from this one without re-running anything. */
const ATTEMPTS = 3;

async function openTimeline(page) {
  let lastSeen = '';

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    await page.goto(`https://x.com/${HANDLE}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    try {
      await page.waitForSelector('article', { timeout: 45000 });
      if (attempt > 1) console.log(`timeline appeared on attempt ${attempt}`);
      return;
    } catch {
      lastSeen = (await page.evaluate(() => document.body.innerText)
        .catch(() => '')).replace(/\s+/g, ' ').trim().slice(0, 300);
      console.warn(`attempt ${attempt}/${ATTEMPTS}: no posts rendered. Page said: ${lastSeen || '(nothing)'}`);
      if (attempt < ATTEMPTS) await page.waitForTimeout(attempt * 15000);
    }
  }

  throw new Error(
    `x.com/${HANDLE} rendered no posts after ${ATTEMPTS} attempts. ` +
    `Last page text: ${lastSeen || '(empty)'}`
  );
}

/* Headless is refused outright: x.com answers a headless Chromium with 403 and a
   39-byte document, while the same machine gets 200 and a full timeline from a
   browser with a window. So the browser runs headed — offscreen, so it does not
   steal focus when this runs on someone's desktop, and under a virtual display
   when it runs in CI. */
const LAUNCH = {
  headless: false,
  args: ['--window-position=-2400,-2400', '--window-size=1280,2000']
};

async function collectStatusIds() {
  const browser = await chromium.launch(LAUNCH);
  const page = await browser.newPage({ userAgent: UA, locale: 'ja-JP' });

  try {
    await openTimeline(page);

    // The logged-out view stops after a handful of posts; a few scrolls is all
    // it takes to reach the end of what it will show.
    for (let i = 0; i < 6; i++) {
      await page.mouse.wheel(0, 3000);
      await page.waitForTimeout(1200);
    }

    /* Returns the pinned post separately. Sorting by date is not enough on its
       own: the logged-out timeline is inconsistent about how many posts it
       renders, and on a thin run the pin can float into the top three. */
    const seen = await page.evaluate((handle) => {
      const pattern = new RegExp('^/' + handle + '/status/(\\d+)$');
      const out = [];

      document.querySelectorAll('article').forEach((article) => {
        let id = null;
        article.querySelectorAll('a[href*="/status/"]').forEach((a) => {
          const m = (a.getAttribute('href') || '').match(pattern);
          if (m && !id) id = m[1];
        });
        if (!id) return;

        /* X marks the pin by opening the article with 固定 / Pinned; there is
           no stable test id for it. */
        const lead = (article.innerText || '').trimStart().slice(0, 8);
        out.push({ id, pinned: /^(固定|Pinned)/.test(lead) });
      });

      return out;
    }, HANDLE);

    const pinned = new Set(seen.filter((s) => s.pinned).map((s) => s.id));
    const ids = [...new Set(seen.map((s) => s.id))]
      .filter((id) => !pinned.has(id) && !EXCLUDE_IDS.has(id));

    return ids;
  } finally {
    await browser.close();
  }
}

/* The syndication endpoint throttles bursts with a 404, so each id gets a few
   attempts before it is written off. */
async function fetchPost(id, attempts = 3) {
  const url =
    `https://cdn.syndication.twimg.com/tweet-result?id=${id}&lang=ja&token=a`;

  let res;
  for (let i = 0; i < attempts; i++) {
    if (i) await new Promise((r) => setTimeout(r, 1500 * i));
    res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.ok) break;
  }
  if (!res.ok) throw new Error(`syndication ${res.status} for ${id}`);
  const d = await res.json();

  return {
    id,
    at: d.created_at,
    text: clean(d.text),
    photos: (d.photos || []).map((p) => p.url),
    video: d.video || null,
    quote: d.quoted_tweet
      ? { id: d.quoted_tweet.id_str, text: clean(d.quoted_tweet.text) }
      : null
  };
}

/* The syndication payload is HTML-escaped and keeps its t.co shorteners. */
function clean(text) {
  return (text || '')
    .replace(/https:\/\/t\.co\/\w+/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

/** Downloaded without a Referer header — X rejects the request with one. */
async function download(url, file) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`download ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(file, buf);
  return buf.length;
}

function bestMp4(video) {
  const mp4s = (video.variants || []).filter((v) => v.type === 'video/mp4');
  return mp4s
    .map((v) => ({ src: v.src, px: Number((v.src.match(/\/(\d+)x\d+\//) || [])[1] || 0) }))
    .sort((a, b) => b.px - a.px)[0];
}

function jpDate(iso) {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}

async function main() {
  const ids = await collectStatusIds();
  console.log(`eligible status ids on the profile: ${ids.length}`);
  if (ids.length < MIN_POSTS) {
    throw new Error(`profile yielded ${ids.length} ids`);
  }

  const posts = [];
  for (const id of ids) {
    try {
      posts.push(await fetchPost(id));
    } catch (err) {
      console.warn(`skipped ${id}: ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  const latest = posts
    .filter((p) => p.at)
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, WANTED);

  if (latest.length < MIN_POSTS) {
    throw new Error(`only ${latest.length} posts resolved`);
  }

  await mkdir(MEDIA_DIR, { recursive: true });
  const keep = new Set();
  const entries = [];

  for (const post of latest) {
    const entry = { id: post.id, date: jpDate(post.at), text: post.text };
    if (post.quote) entry.quote = { id: post.quote.id, text: post.quote.text };

    if (post.photos.length) {
      const name = `${post.id}.jpg`;
      await download(post.photos[0], path.join(MEDIA_DIR, name));
      keep.add(name);
      entry.image = `./${MEDIA_DIR}/${name}`;
    }

    if (post.video) {
      const posterName = `${post.id}-poster.jpg`;
      await download(post.video.poster, path.join(MEDIA_DIR, posterName));
      keep.add(posterName);
      entry.poster = `./${MEDIA_DIR}/${posterName}`;

      const mp4 = bestMp4(post.video);
      if (mp4) {
        const head = await fetch(mp4.src, { method: 'HEAD', headers: { 'User-Agent': UA } });
        const size = Number(head.headers.get('content-length') || 0);
        if (size && size <= MAX_VIDEO_BYTES) {
          const vidName = `${post.id}.mp4`;
          await download(mp4.src, path.join(MEDIA_DIR, vidName));
          keep.add(vidName);
          entry.video = `./${MEDIA_DIR}/${vidName}`;
        } else {
          // Too large to carry: the card falls back to poster + link to X.
          console.log(`video for ${post.id} skipped (${size} bytes)`);
        }
      }
    }

    entries.push(entry);
  }

  // Only the three current posts keep their media; everything else goes.
  for (const file of await readdir(MEDIA_DIR)) {
    if (!keep.has(file)) {
      await unlink(path.join(MEDIA_DIR, file));
      console.log(`pruned ${file}`);
    }
  }

  const payload = {
    handle: HANDLE,
    updated: new Date().toISOString(),
    entries
  };
  const next = JSON.stringify(payload, null, 2) + '\n';

  const previous = await readFile(OUT_JSON, 'utf8').catch(() => '');
  const sameEntries =
    previous &&
    JSON.stringify(JSON.parse(previous).entries) === JSON.stringify(entries);

  if (sameEntries) {
    console.log('no change');
    return;
  }

  await mkdir(path.dirname(OUT_JSON), { recursive: true });
  await writeFile(OUT_JSON, next);
  console.log(`wrote ${OUT_JSON}: ${entries.map((e) => e.date).join(', ')}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

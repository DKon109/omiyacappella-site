/**
 * OMIYAcappella — LINE webhook → 企画募集 feed
 *
 * A Cloudflare Worker that listens to the group's LINE bot, keeps the posts
 * that were explicitly marked for publication, and serves them to the site as
 * JSON.
 *
 *   POST /            LINE webhook (signature-verified)
 *   GET  /projects.json  the published entries, newest first
 *
 * Deliberately narrow by design:
 *   - only messages beginning with one of MARKERS are stored; everything else
 *     is dropped without ever being written down,
 *   - only the configured group is accepted,
 *   - the sender is never recorded. The bot does not call the profile API, and
 *     userId is not persisted.
 *
 * Bindings (see wrangler.toml):
 *   PROJECTS              KV namespace
 *   LINE_CHANNEL_SECRET   secret
 *   LINE_ACCESS_TOKEN     secret
 *   LINE_GROUP_ID         secret (the group the bot may listen to)
 *   ALLOWED_ORIGIN        var    (the site's origin, for CORS)
 */

const MARKERS = {
  '#募集': { kind: '企画募集', status: '募集中' },
  '#イベント': { kind: 'イベント', status: '募集中' },
  '#実施': { kind: '実施', status: '成立' },
  '#お知らせ': { kind: 'お知らせ', status: '' }
};

const STORE_KEY = 'projects';
const MAX_ENTRIES = 40;

/* Field aliases, so a post can say 曲 or 曲名 and still parse. */
const FIELDS = {
  song: ['曲', '曲名'],
  artist: ['アーティスト', '歌手', '原曲'],
  parts: ['パート', '募集パート'],
  deadline: ['締切', '〆切', '締め切り'],
  date: ['日時', '練習日', '本番'],
  place: ['場所', '練習場所'],
  status: ['状態', 'ステータス'],
  body: ['本文', '詳細', 'コメント']
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/projects.json') {
      return serveFeed(env);
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(env) });
    }

    if (request.method === 'POST' && url.pathname === '/') {
      return handleWebhook(request, env);
    }

    return new Response('Not found', { status: 404 });
  }
};

/* -------------------------------------------------------------- webhook */

async function handleWebhook(request, env) {
  const raw = await request.text();
  const signature = request.headers.get('x-line-signature') || '';

  if (!(await verify(raw, signature, env.LINE_CHANNEL_SECRET))) {
    return new Response('Bad signature', { status: 401 });
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }

  for (const event of payload.events || []) {
    try {
      await handleEvent(event, env);
    } catch (err) {
      // One bad event must not cost us the rest of the batch, and LINE retries
      // anything we answer with a non-200.
      console.error('event failed', err);
    }
  }

  // LINE only needs to know the delivery landed.
  return new Response('OK');
}

async function handleEvent(event, env) {
  if (event.type !== 'message' || event.message.type !== 'text') return;
  if (event.source.type !== 'group') return;
  if (event.source.groupId !== env.LINE_GROUP_ID) return;

  const text = event.message.text.trim();

  if (text.startsWith('#削除')) {
    const id = text.slice('#削除'.length).trim();
    const removed = await removeEntry(env, id);
    await reply(env, event.replyToken, removed
      ? `サイトから削除しました（${id}）`
      : `該当する投稿が見つかりませんでした（${id}）`);
    return;
  }

  const marker = Object.keys(MARKERS).find((m) => text.startsWith(m));
  if (!marker) return; // Ordinary chatter: ignored, never stored.

  const entry = parseEntry(text, marker, event.message.id, event.timestamp);
  await addEntry(env, entry);

  await reply(env, event.replyToken,
    `サイトに反映しました。\n取り消す場合はこのIDを送ってください：\n#削除 ${entry.id}`);
}

/* ---------------------------------------------------------------- parse */

function parseEntry(text, marker, messageId, timestamp) {
  const preset = MARKERS[marker];
  const lines = text.slice(marker.length).split('\n');
  const fields = {};
  const loose = [];

  for (const line of lines) {
    const match = line.match(/^\s*([^:：]{1,10})\s*[:：]\s*(.+)$/);
    if (!match) {
      if (line.trim()) loose.push(line.trim());
      continue;
    }

    const label = match[1].trim();
    const value = match[2].trim();
    const key = Object.keys(FIELDS).find((k) => FIELDS[k].includes(label));

    if (key) fields[key] = value;
    else loose.push(line.trim());
  }

  // 「曲: サボテンの花 / チューリップ」 also fills in the artist.
  if (fields.song && !fields.artist && fields.song.includes('/')) {
    const [song, artist] = fields.song.split('/');
    fields.song = song.trim();
    fields.artist = artist.trim();
  }

  return {
    id: messageId,
    at: new Date(timestamp).toISOString(),
    kind: preset.kind,
    status: fields.status || preset.status,
    song: fields.song || loose.shift() || '（無題の企画）',
    artist: fields.artist || '',
    parts: fields.parts || '',
    deadline: fields.deadline || '',
    date: fields.date || '',
    place: fields.place || '',
    body: fields.body || loose.join('\n')
  };
}

/* ---------------------------------------------------------------- store */

async function readEntries(env) {
  const stored = await env.PROJECTS.get(STORE_KEY, 'json');
  return Array.isArray(stored) ? stored : [];
}

async function addEntry(env, entry) {
  const entries = await readEntries(env);
  const next = [entry, ...entries.filter((e) => e.id !== entry.id)];
  await env.PROJECTS.put(STORE_KEY, JSON.stringify(next.slice(0, MAX_ENTRIES)));
}

async function removeEntry(env, id) {
  const entries = await readEntries(env);
  const next = entries.filter((e) => e.id !== id);
  if (next.length === entries.length) return false;
  await env.PROJECTS.put(STORE_KEY, JSON.stringify(next));
  return true;
}

async function serveFeed(env) {
  const entries = await readEntries(env);
  return new Response(JSON.stringify({ entries }), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      ...corsHeaders(env)
    }
  });
}

/* ----------------------------------------------------------------- LINE */

/** Reply messages are outside LINE's monthly send quota, so this is free. */
async function reply(env, replyToken, text) {
  if (!replyToken) return;
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.LINE_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ replyToken, messages: [{ type: 'text', text }] })
  });
}

async function verify(body, signature, secret) {
  if (!signature) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  let expected;
  try {
    expected = Uint8Array.from(atob(signature), (c) => c.charCodeAt(0));
  } catch {
    return false;
  }

  return crypto.subtle.verify('HMAC', key, expected, encoder.encode(body));
}

function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

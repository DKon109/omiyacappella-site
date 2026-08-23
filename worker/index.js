/**
 * OMIYAcappella — the deployed site.
 *
 * Cloudflare serves the files in dist/ through the ASSETS binding; this Worker
 * sits in front only to answer the contact form, whose destination address is
 * held in a secret rather than shipped in the page's JavaScript.
 *
 * Bindings (see wrangler.toml):
 *   ASSETS             the built site
 *   CONTACT_ENDPOINT   secret — where the form is forwarded
 */

const FIELDS = ['name', 'email', 'type', 'history', 'message'];
const MAX_LEN = 4000;

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });

async function handleContact(request, env) {
  if (!env.CONTACT_ENDPOINT) {
    return json(503, { error: 'contact endpoint is not configured' });
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return json(400, { error: 'expected form data' });
  }

  // Bots fill the honeypot; humans never see it. Answer 200 so they learn
  // nothing from the response.
  if ((form.get('_honey') || '').toString().trim()) {
    return json(200, { success: 'true' });
  }

  const values = {};
  for (const field of FIELDS) {
    values[field] = (form.get(field) || '').toString().slice(0, MAX_LEN).trim();
  }

  if (!values.name || !values.message) {
    return json(400, { error: 'name and message are required' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    return json(400, { error: 'invalid email' });
  }

  const payload = new FormData();
  payload.append('お名前', values.name);
  payload.append('メールアドレス', values.email);
  payload.append('お問い合わせ種別', values.type);
  if (values.history) payload.append('アカペラ歴', values.history);
  payload.append('お問い合わせ内容', values.message);
  payload.append('_subject', `【OMIYAcappella】サイトからのお問い合わせ：${values.type}`);
  payload.append('_template', 'table');
  payload.append('_captcha', 'false');
  // So a reply goes back to the person who wrote in.
  payload.append('_replyto', values.email);

  let upstream;
  try {
    upstream = await fetch(env.CONTACT_ENDPOINT, {
      method: 'POST',
      body: payload,
      headers: { Accept: 'application/json' }
    });
  } catch {
    return json(502, { error: 'could not reach the mail service' });
  }

  if (!upstream.ok) {
    return json(502, { error: `mail service returned ${upstream.status}` });
  }

  return json(200, { success: 'true' });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/contact') {
      return request.method === 'POST'
        ? handleContact(request, env)
        : new Response('Method not allowed', { status: 405 });
    }

    return env.ASSETS.fetch(request);
  }
};

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
 *   CONTACT_CC         secret, optional — a second address copied on every
 *                      enquiry, so both organisers see it without forwarding.
 *
 * Neither address appears in this repository: it is public, and they belong to
 * real people. If CONTACT_CC is unset the copy is simply not sent, so check it
 * after any change that redeploys the Worker.
 */

const FIELDS = ['name', 'email', 'type', 'gender', 'age', 'area', 'circle', 'history', 'sns', 'message'];
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
  // Only present on a membership enquiry.
  if (values.gender) payload.append('性別', values.gender);
  if (values.age) payload.append('年齢', values.age);
  if (values.area) payload.append('居住地', values.area);
  if (values.circle) payload.append('所属サークル名', values.circle);
  if (values.history) payload.append('アカペラ歴', values.history);

  const parts = form.getAll('parts').map((p) => p.toString()).filter(Boolean);
  if (parts.length) payload.append('可能パート', parts.join(' / '));

  if (values.sns) payload.append('SNSアカウント名', values.sns);
  payload.append('お問い合わせ内容', values.message);
  // Shows in the recipients' Cc header, so both organisers see who else got it.
  const cc = (env.CONTACT_CC || '').trim();
  if (cc) payload.append('_cc', cc);
  payload.append('_subject', `【OMIYAcappella】サイトからのお問い合わせ：${values.type}`);
  payload.append('_template', 'table');
  payload.append('_captcha', 'false');
  // So a reply goes back to the person who wrote in.
  payload.append('_replyto', values.email);

  let upstream;
  try {
    // FormSubmit refuses a request with no Origin — it reads a bare one as a
    // page opened from the filesystem and answers "open this through a web
    // server" instead of sending. A browser sets these; a Worker forwarding
    // server-side has to say where the submission came from itself.
    const origin = new URL(request.url).origin;
    upstream = await fetch(env.CONTACT_ENDPOINT, {
      method: 'POST',
      body: payload,
      headers: {
        Accept: 'application/json',
        Origin: origin,
        Referer: `${origin}/contact`
      }
    });
  } catch {
    return json(502, { error: 'could not reach the mail service' });
  }

  if (!upstream.ok) {
    return json(502, { error: `mail service returned ${upstream.status}` });
  }

  // A refusal comes back as 200 with success:"false" — an unactivated form, or
  // a rejected origin — so the status code alone would report a delivery that
  // never happened.
  const result = await upstream.json().catch(() => ({}));
  if (result && result.success === 'false') {
    return json(502, { error: result.message || 'mail service refused the message' });
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

/**
 * Contact form relay — a Cloudflare Pages Function.
 *
 * The form posts here rather than straight to the mail service, so the
 * destination address lives in a Cloudflare secret instead of in the
 * JavaScript every visitor downloads. Removing the address from the page was
 * the point; publishing it in a script would have undone that.
 *
 * Set in the Pages project (Settings → Variables and Secrets):
 *
 *   CONTACT_ENDPOINT   https://formsubmit.co/ajax/<the address>
 *                      or FormSubmit's alias URL once activated
 *
 * Without it the endpoint answers 503 and the form says nothing was sent, so a
 * missing secret is visible rather than silent.
 */

const FIELDS = ['name', 'email', 'type', 'history', 'message'];
const MAX_LEN = 4000;

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });

export async function onRequestPost({ request, env }) {
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

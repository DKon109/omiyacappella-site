/**
 * OMIYAcappella — the deployed site.
 *
 * Cloudflare serves the files in dist/ through the ASSETS binding; this Worker
 * sits in front only to answer the contact form.
 *
 * Mail goes out through Cloudflare's own Email Sending binding rather than a
 * third-party form relay. The relay we used first (FormSubmit) answers 429 to
 * every request from Cloudflare's egress addresses while accepting the same
 * request from a home connection, so no enquiry could ever be delivered.
 *
 * Bindings (see wrangler.toml):
 *   ASSETS       the built site
 *   EMAIL        Cloudflare Email Sending
 *   CONTACT_TO   secret — the organiser the form is addressed to
 *   CONTACT_CC   secret, optional — a second organiser copied on every enquiry
 *
 * Neither address is in this repository: it is public, and they belong to real
 * people. An unset CONTACT_CC simply sends no copy, so check it after any
 * change that redeploys the Worker.
 */

const FIELDS = ['name', 'email', 'type', 'gender', 'age', 'area', 'circle', 'history', 'sns', 'message'];
const MAX_LEN = 4000;

// The from address must sit on a domain onboarded to Email Sending. It is not
// a mailbox anyone reads — replies go to the enquirer via Reply-To.
const MAIL_FROM = 'form@omiyacappella.com';

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });

const escapeHtml = (s) =>
  s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

/** The enquiry as label/value pairs, in the order the form asks for them. */
function rows(values, parts) {
  const out = [
    ['お名前', values.name],
    ['メールアドレス', values.email],
    ['お問い合わせ種別', values.type]
  ];
  // Only present on a membership enquiry.
  if (values.gender) out.push(['性別', values.gender]);
  if (values.age) out.push(['年齢', values.age]);
  if (values.area) out.push(['居住地', values.area]);
  if (values.circle) out.push(['所属サークル名', values.circle]);
  if (values.history) out.push(['アカペラ歴', values.history]);
  if (parts.length) out.push(['可能パート', parts.join(' / ')]);
  if (values.sns) out.push(['SNSアカウント名', values.sns]);
  out.push(['お問い合わせ内容', values.message]);
  return out;
}

async function handleContact(request, env) {
  if (!env.EMAIL || !env.CONTACT_TO) {
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
  const parts = form.getAll('parts').map((p) => p.toString().trim()).filter(Boolean);

  if (!values.name || !values.message) {
    return json(400, { error: 'name and message are required' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    return json(400, { error: 'invalid email' });
  }

  const pairs = rows(values, parts);
  const text = pairs.map(([k, v]) => `${k}\n${v}`).join('\n\n');
  const html =
    '<table cellpadding="8" style="border-collapse:collapse;font-family:sans-serif;font-size:14px">'
    + pairs.map(([k, v]) =>
      `<tr><th align="left" valign="top" style="background:#f5f1e8;white-space:nowrap">${escapeHtml(k)}</th>`
      + `<td style="border-bottom:1px solid #e4e0d8">${escapeHtml(v).replace(/\n/g, '<br>')}</td></tr>`
    ).join('')
    + '</table>';

  const to = [env.CONTACT_TO];
  const cc = (env.CONTACT_CC || '').trim();
  if (cc) to.push(cc);

  try {
    await env.EMAIL.send({
      to,
      from: { email: MAIL_FROM, name: 'OMIYAcappella サイト' },
      // So a reply goes back to the person who wrote in, not to a dead address.
      replyTo: values.email,
      subject: `【OMIYAcappella】サイトからのお問い合わせ：${values.type || 'その他'}`,
      text,
      html
    });
  } catch (err) {
    return json(502, { error: `could not send the message: ${err.message}` });
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

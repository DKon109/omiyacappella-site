/**
 * OMIYAcappella — the deployed site.
 *
 * Cloudflare serves the files in dist/ through the ASSETS binding; this Worker
 * sits in front only to answer the contact form.
 *
 * Mail goes out through Resend's API. Two alternatives were tried first:
 * FormSubmit answers 429 to every request from Cloudflare's egress addresses
 * while accepting the same request from a home connection, and Cloudflare's own
 * Email Sending binding requires the Workers Paid plan. Resend authenticates by
 * API key rather than by source address, which is what makes it work here, and
 * its free tier is far above what a contact form uses.
 *
 * Bindings (see wrangler.toml):
 *   ASSETS           the built site
 *   RESEND_API_KEY   secret — Resend API key
 *   CONTACT_TO       secret — the organiser the form is addressed to
 *   CONTACT_CC       secret, optional — a second organiser copied on every enquiry
 *
 * Neither address is in this repository: it is public, and they belong to real
 * people. An unset CONTACT_CC simply sends no copy, so check it after any
 * change that redeploys the Worker.
 */

const FIELDS = ['name', 'email', 'type', 'gender', 'age', 'area', 'circle', 'history', 'sns', 'message'];
const MAX_LEN = 4000;

// The from address must sit on a domain verified in Resend. It is not a mailbox
// anyone reads — replies go to the enquirer via Reply-To.
const MAIL_FROM = 'OMIYAcappella <form@omiyacappella.com>';
const RESEND_ENDPOINT = 'https://api.resend.com/emails';

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
  if (!env.RESEND_API_KEY || !env.CONTACT_TO) {
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

  const cc = (env.CONTACT_CC || '').trim();

  let upstream;
  try {
    upstream = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: MAIL_FROM,
        to: [env.CONTACT_TO],
        ...(cc ? { cc: [cc] } : {}),
        // So a reply goes back to the person who wrote in, not to a dead address.
        reply_to: values.email,
        subject: `【OMIYAcappella】サイトからのお問い合わせ：${values.type || 'その他'}`,
        text,
        html
      })
    });
  } catch {
    return json(502, { error: 'could not reach the mail service' });
  }

  if (!upstream.ok) {
    // Resend explains itself in the body; passing that through beats a bare
    // status code when the next failure is a DNS record nobody added.
    const detail = await upstream.text().catch(() => '');
    return json(502, { error: `mail service returned ${upstream.status}`, detail: detail.slice(0, 300) });
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

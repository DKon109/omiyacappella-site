/**
 * OMIYAcappella — the deployed site.
 *
 * Cloudflare serves the files in dist/ through the ASSETS binding. That is the
 * whole job: the contact form posts straight from the browser to its relay.
 *
 * It did not always. The form used to post here so that the destination address
 * could live in a secret instead of the page. That failed for a reason worth
 * recording: the relay accepts a submission sent from a visitor's own
 * connection and answers 429 to the identical request made from Cloudflare's
 * addresses. Sending server-side is what broke it, so the browser sends
 * directly and the address is hidden behind the relay's alias url instead.
 *
 * Bindings (see wrangler.toml):
 *   ASSETS   the built site
 */

export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  }
};

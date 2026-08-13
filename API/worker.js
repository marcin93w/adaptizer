/**
 * Adaptizer songs catalog API.
 *
 * A single Cloudflare Worker that serves the song catalog read by the
 * Player mobile app. The catalog lives in the `adaptizer` D1 database,
 * bound as `db` (see wrangler.toml); the audio itself is not served here
 * at all - it is served straight off the public `adaptizer` R2 bucket, so
 * this Worker only ever hands out the `storage_location` that the client
 * turns into a manifest URL.
 *
 * Wire format (see ../Player/docs/adaptive-audio.md section 6):
 *   [{ id, author, album, name, storage_location }]
 *
 * Deploy with `npm run deploy`.
 */

/**
 * The only route. The client requests exactly this path - the React Native
 * app via `SONGS_PATH` in Player/mobile/src/data/songsApi.ts - so anything
 * else is a caller error rather than a path worth serving.
 */
const SONGS_PATH = '/';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json;charset=UTF-8' },
  });
}

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);

    if (pathname !== SONGS_PATH) {
      return json({ error: 'Not found' }, 404);
    }

    // HEAD must be allowed through explicitly. The runtime discards the body
    // of a HEAD response for us, but it does not synthesize HEAD from GET, so
    // rejecting it here would make HEAD / a 405.
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: {
          'Content-Type': 'application/json;charset=UTF-8',
          Allow: 'GET, HEAD',
        },
      });
    }

    const { results } = await env.db.prepare('SELECT * FROM songs').all();
    return json(results);
  },
};

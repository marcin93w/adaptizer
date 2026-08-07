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

export default {
  async fetch(request, env, ctx) {
    const { results } = await env.db.prepare("SELECT * FROM songs").all();
    return new Response(JSON.stringify(results));
  },
};

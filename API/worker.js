/**
 * Adaptizer songs catalog API.
 *
 * A single Cloudflare Worker that serves the song catalog read by the
 * Player mobile app. The catalog lives in the `adaptizer` D1 database,
 * bound as `db` (see wrangler.toml). On the read path the audio is not served
 * here at all - it is streamed straight off the public `adaptizer` R2 bucket,
 * so `GET /` only ever hands out the `storage_location` that the client turns
 * into a manifest URL.
 *
 * The one write path breaks that asymmetry on purpose (see ADR-0002): an
 * authenticated `POST /` proxies a song's export *through* the Worker into the
 * `adaptizer` R2 bucket (bound as `bucket`) and then upserts the catalog row,
 * so no bucket-write credential ever reaches the producer's machine.
 *
 * Read wire format (see ../Player/docs/adaptive-audio.md section 6):
 *   [{ id, author, album, name, storage_location, dimension }]
 *
 * Deploy with `npm run deploy`. The publish path also needs the
 * `PUBLISH_API_KEY` secret set once (see README.md).
 */

/**
 * The only route. The client requests exactly this path - the React Native
 * app via `SONGS_PATH` in Player/mobile/src/data/songsApi.ts - so anything
 * else is a caller error rather than a path worth serving.
 */
const SONGS_PATH = '/';

// A publish carries one manifest plus ten audio variants (dimension values
// 0..9). The form part `audioN` is stored under the object name the manifest
// references, `audioN_dash.webm` (see Instrument's dash-converter.ps1).
const VARIANT_COUNT = 10;

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json;charset=UTF-8', ...headers },
  });
}

/** The URL-safe R2 prefix a song's objects live under, derived from its name. */
function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** The token from an `Authorization: Bearer <token>` header, or null. */
function bearerToken(header) {
  const match = /^Bearer (.+)$/.exec(header ?? '');
  return match ? match[1] : null;
}

/**
 * Constant-time string compare. workerd's `timingSafeEqual` requires equal
 * lengths, so we compare fixed-length SHA-256 digests rather than the raw
 * strings - that also keeps the key's length from leaking through timing.
 */
async function secretsEqual(a, b) {
  const enc = new TextEncoder();
  const [ah, bh] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  return crypto.subtle.timingSafeEqual(ah, bh);
}

/**
 * The publish write path. Authenticates the bearer key, validates the shape of
 * the multipart body, writes the audio to R2, then upserts the catalog row.
 * The row insert is the commit point: audio is written first, so the catalog
 * is never left pointing at missing audio. A failure after the R2 writes
 * leaves orphan objects that no row references; no cleanup is done, by design
 * (ADR-0002).
 */
async function publish(request, env) {
  const provided = bearerToken(request.headers.get('Authorization'));
  if (provided === null || !(await secretsEqual(provided, env.PUBLISH_API_KEY ?? ''))) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ error: 'Expected a multipart/form-data body' }, 400);
  }

  // Shape-only validation: required metadata non-empty. `dimension` is required
  // but stored opaque - no enum check, so naming a new dimension needs no
  // redeploy (ADR-0001).
  const meta = {};
  for (const field of ['author', 'album', 'name', 'dimension']) {
    const value = form.get(field);
    if (typeof value !== 'string' || value.trim() === '') {
      return json({ error: `Missing or empty field: ${field}` }, 400);
    }
    meta[field] = value;
  }

  const storageLocation = slugify(meta.name);
  if (storageLocation === '') {
    return json({ error: 'name must contain at least one URL-safe character' }, 400);
  }

  // All eleven file parts must be present: manifest.mpd plus audio0..9. Hold the
  // parts, not their bytes - each is read into memory only at put time below, so
  // a shape rejection never buffers the whole export.
  const objects = [
    { field: 'manifest.mpd', name: 'manifest.mpd', contentType: 'application/dash+xml' },
  ];
  for (let i = 0; i < VARIANT_COUNT; i++) {
    objects.push({ field: `audio${i}`, name: `audio${i}_dash.webm`, contentType: 'audio/webm' });
  }
  for (const object of objects) {
    const part = form.get(object.field);
    if (!part || typeof part === 'string' || typeof part.arrayBuffer !== 'function') {
      return json({ error: `Missing file part: ${object.field}` }, 400);
    }
    object.part = part;
  }

  // Write audio first. Republish overwrites the same prefix in place, matching
  // the row's upsert below.
  for (const object of objects) {
    await env.bucket.put(`${storageLocation}/${object.name}`, await object.part.arrayBuffer(), {
      httpMetadata: { contentType: object.contentType },
    });
  }

  // The commit point. Upsert on UNIQUE(storage_location) so re-posting the same
  // name updates the row rather than duplicating it.
  const row = await env.db
    .prepare(
      `INSERT INTO songs (author, album, name, storage_location, dimension)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(storage_location) DO UPDATE SET
         author = excluded.author,
         album = excluded.album,
         name = excluded.name,
         dimension = excluded.dimension
       RETURNING *`,
    )
    .bind(meta.author, meta.album, meta.name, storageLocation, meta.dimension)
    .first();

  return json(row, 201);
}

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);

    if (pathname !== SONGS_PATH) {
      return json({ error: 'Not found' }, 404);
    }

    if (request.method === 'POST') {
      return publish(request, env);
    }

    // HEAD must be allowed through explicitly. The runtime discards the body
    // of a HEAD response for us, but it does not synthesize HEAD from GET, so
    // rejecting it here would make HEAD / a 405.
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return json({ error: 'Method not allowed' }, 405, { Allow: 'GET, HEAD, POST' });
    }

    const { results } = await env.db.prepare('SELECT * FROM songs').all();
    return json(results);
  },
};

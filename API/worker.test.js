import {
  env,
  createExecutionContext,
  waitOnExecutionContext,
} from 'cloudflare:test';
import { beforeEach, describe, it, expect } from 'vitest';
import worker from './worker.js';

const KEY = 'test-key'; // matches miniflare.bindings.PUBLISH_API_KEY in vitest.config.mjs

// A one-line mirror of schema.sql's table, including the UNIQUE(storage_location)
// the publish path upserts on. Rebuilt per test so R2 and D1 start empty.
const CREATE_SONGS =
  'CREATE TABLE songs ("id" integer PRIMARY KEY, "author" text, "album" text, ' +
  '"name" text, "storage_location" text, "dimension" text NOT NULL DEFAULT ' +
  "'intensity', UNIQUE(\"storage_location\"))";

beforeEach(async () => {
  await env.db.exec('DROP TABLE IF EXISTS songs');
  await env.db.exec(CREATE_SONGS);
  const { objects } = await env.bucket.list();
  for (const o of objects) await env.bucket.delete(o.key);
});

function defaultFiles() {
  const files = {
    'manifest.mpd': new Blob(['<MPD/>'], { type: 'application/dash+xml' }),
  };
  for (let i = 0; i < 10; i++) {
    files['audio' + i] = new Blob(['audio-' + i], { type: 'audio/webm' });
  }
  return files;
}

function publishBody({ fields = {}, files } = {}) {
  const fd = new FormData();
  const meta = {
    author: 'Wednesday Habits',
    album: 'Demo',
    name: 'My Song',
    dimension: 'intensity',
    ...fields,
  };
  for (const [k, v] of Object.entries(meta)) {
    if (v !== undefined) fd.append(k, v);
  }
  const parts = files === undefined ? defaultFiles() : files;
  for (const [k, blob] of Object.entries(parts)) fd.append(k, blob, k);
  return fd;
}

function post({ key = KEY, ...body } = {}) {
  const headers = {};
  if (key !== null) headers.Authorization = 'Bearer ' + key;
  return new Request('https://api.test/', {
    method: 'POST',
    headers,
    body: publishBody(body),
  });
}

async function call(request) {
  const ctx = createExecutionContext();
  const res = await worker.fetch(request, env, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

async function catalog() {
  const res = await call(new Request('https://api.test/'));
  return res.json();
}

describe('GET / (read path, unchanged)', () => {
  it('returns the catalog rows as JSON', async () => {
    await env.db
      .prepare(
        "INSERT INTO songs (author, album, name, storage_location, dimension) VALUES ('A', 'B', 'C', 'c', 'volume')",
      )
      .run();
    const res = await call(new Request('https://api.test/'));
    expect(res.status).toBe(200);
    const rows = await res.json();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: 'C', storage_location: 'c', dimension: 'volume' });
  });

  it('leaves HEAD / working', async () => {
    const res = await call(new Request('https://api.test/', { method: 'HEAD' }));
    expect(res.status).toBe(200);
  });
});

describe('POST / auth', () => {
  it('401s with no Authorization header', async () => {
    const res = await call(post({ key: null }));
    expect(res.status).toBe(401);
    expect(await res.json()).toHaveProperty('error');
  });

  it('401s with a wrong key', async () => {
    const res = await call(post({ key: 'not-the-key' }));
    expect(res.status).toBe(401);
    expect(await res.json()).toHaveProperty('error');
    // Nothing was written.
    expect((await env.bucket.list()).objects).toHaveLength(0);
    expect(await catalog()).toHaveLength(0);
  });
});

describe('POST / shape validation', () => {
  it('400s when a required metadata field is empty', async () => {
    const res = await call(post({ fields: { name: '' } }));
    expect(res.status).toBe(400);
    expect(await res.json()).toHaveProperty('error');
    expect((await env.bucket.list()).objects).toHaveLength(0);
  });

  it('400s when dimension is missing', async () => {
    const res = await call(post({ fields: { dimension: undefined } }));
    expect(res.status).toBe(400);
  });

  it('400s when one of the eleven file parts is missing', async () => {
    const files = defaultFiles();
    delete files.audio5;
    const res = await call(post({ files }));
    expect(res.status).toBe(400);
    expect((await env.bucket.list()).objects).toHaveLength(0);
    expect(await catalog()).toHaveLength(0);
  });
});

describe('POST / publish', () => {
  it('writes eleven objects under a name-derived slug and upserts the row', async () => {
    const res = await call(post({ fields: { name: 'My New Song!' } }));
    expect(res.status).toBe(201);

    const keys = (await env.bucket.list()).objects.map((o) => o.key).sort();
    expect(keys).toEqual(
      [
        'my-new-song/manifest.mpd',
        ...Array.from({ length: 10 }, (_, i) => `my-new-song/audio${i}_dash.webm`),
      ].sort(),
    );

    const rows = await catalog();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      author: 'Wednesday Habits',
      album: 'Demo',
      name: 'My New Song!',
      storage_location: 'my-new-song',
      dimension: 'intensity',
    });
  });

  it('stores dimension opaquely, without an enum check', async () => {
    const res = await call(post({ fields: { name: 'Opaque', dimension: 'brandNewAxis' } }));
    expect(res.status).toBe(201);
    const rows = await catalog();
    expect(rows[0].dimension).toBe('brandNewAxis');
  });

  it('overwrites in place on republish - no duplicate row', async () => {
    await call(post({ fields: { name: 'Same Name', author: 'First' } }));
    await call(
      post({
        fields: { name: 'Same Name', author: 'Second' },
        files: { ...defaultFiles(), 'manifest.mpd': new Blob(['<MPD v2/>']) },
      }),
    );

    const rows = await catalog();
    expect(rows).toHaveLength(1);
    expect(rows[0].author).toBe('Second');

    const manifest = await env.bucket.get('same-name/manifest.mpd');
    expect(await manifest.text()).toBe('<MPD v2/>');
  });
});

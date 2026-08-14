# Adaptizer API

The songs catalog API behind the Player mobile app, deployed as a Cloudflare
Worker at `https://adaptizer.marcin93w.workers.dev`.

`GET /` returns the full catalog as a JSON array:

```json
[{ "id": 1, "author": "Wednesday Habits", "album": "Demo", "name": "Adaptizer Sample", "storage_location": "Sample", "dimension": "intensity" }]
```

`dimension` is the adaptation axis the song was authored against, one of the
four contract names `volume`, `heartRate`, `movementSpeed`, `intensity` (see
[CONTEXT.md](CONTEXT.md)). The Worker serves it as an opaque string — it does
not validate it against the four or re-case it. The client narrows anything it
does not recognise to `intensity` rather than rejecting the song
(`Player/mobile/src/domain/dimension.ts`), so naming a new dimension in a
catalog row is a non-breaking change for apps already in the field.

`GET /`, `HEAD /` and `POST /` are the accepted requests. `POST /` is the
authenticated [publish](#publishing-a-song) write path; the read path stays
open to everyone. Any other path is a `404` and any other method a `405` with
an `Allow: GET, HEAD, POST` header. Errors respond with a JSON
`{ "error": ... }` body.

The client contract is documented in
[`../Player/docs/adaptive-audio.md`](../Player/docs/adaptive-audio.md)
section 6 and consumed by `Player/mobile/src/data/songsApi.ts`. The base URL is
pinned in `Player/mobile/src/config/index.ts`.

## Architecture

| Piece | Where |
| --- | --- |
| Worker | `adaptizer`, source in [`worker.js`](worker.js) |
| Catalog database | D1 `adaptizer` (`833c14d9-eefb-4e9f-b005-b037f601bc32`), bound as `db` |
| Audio storage | R2 bucket `adaptizer`, public at `https://pub-fb297744d1fd4584a256f702d29363a8.r2.dev` |

On the read path the Worker serves **only** the catalog. Audio is served
directly off the public R2 bucket: the client builds
`{mediaBaseUrl}/{storage_location}/manifest.mpd` itself
(`Player/mobile/src/data/dashUrl.ts`) and fetches it without touching this
Worker. Each `storage_location` prefix in the bucket holds a `manifest.mpd`
plus the ten `audioN_dash.webm` representations produced by
[`Instrument/src/main/scripts/dash-converter.ps1`](../Instrument/src/main/scripts/dash-converter.ps1).

The `adaptizer` R2 bucket is bound here as `bucket` solely for the publish
write path, which proxies audio *through* the Worker into R2 (see ADR-0002);
the read path uses no R2 binding.

## Development

```sh
npm install
npm run dev      # local dev server, uses a local D1 replica
npm run test     # worker tests, run in a real workerd with D1 + R2 bindings
npm run deploy   # deploy to Cloudflare
```

Seed a local database first with `npm run db:schema:local`. To inspect the live
catalog, `npm run db:songs`. To exercise `POST /` against `npm run dev`, put a
key in a gitignored `.dev.vars` file:

```
PUBLISH_API_KEY = "some-local-key"
```

## Publishing a song

Publishing is one authenticated `POST /` (see
[ADR-0002](../docs/adr/0002-publishing-proxies-audio-through-the-worker.md)): a
`multipart/form-data` body carries the row metadata (`author`, `album`, `name`,
`dimension`) plus the eleven export files (`manifest.mpd` and `audio0`..`audio9`,
the DASH output of `e <outputPath> <bpm>`). The Worker writes the audio into the
`adaptizer` bucket under a slug derived from `name`, then upserts the catalog
row. Instrument's Publish button drives this; it is also runnable by hand.

`dimension` is stored opaque — send the name the song was authored against, one
of `volume`, `heartRate`, `movementSpeed`, `intensity`, spelled byte-identically
(the Worker does not validate it against the four).

### The publish key

`POST /` is gated by the `PUBLISH_API_KEY` secret, sent as a bearer token and
compared constant-time. Provision it once (it is never committed):

```sh
npx wrangler secret put PUBLISH_API_KEY
```

Missing or wrong key → `401`. `GET`/`HEAD /` need no key.

### By hand

```sh
curl -X POST https://adaptizer.marcin93w.workers.dev/ \
  -H "Authorization: Bearer $PUBLISH_API_KEY" \
  -F "author=Wednesday Habits" -F "album=Demo" \
  -F "name=My Song" -F "dimension=intensity" \
  -F "manifest.mpd=@out/manifest.mpd" \
  -F "audio0=@out/audio0_dash.webm" \
  -F "audio1=@out/audio1_dash.webm" \
  -F "audio2=@out/audio2_dash.webm" \
  -F "audio3=@out/audio3_dash.webm" \
  -F "audio4=@out/audio4_dash.webm" \
  -F "audio5=@out/audio5_dash.webm" \
  -F "audio6=@out/audio6_dash.webm" \
  -F "audio7=@out/audio7_dash.webm" \
  -F "audio8=@out/audio8_dash.webm" \
  -F "audio9=@out/audio9_dash.webm"
```

Republishing the same `name` overwrites the objects and the row in place — no
duplicate. A publish that fails partway leaves orphan objects in R2 that no row
references (hence invisible to the Player); the row insert is the commit point,
so audio is always written before the catalog can point at it, and no cleanup
of orphans is done (by design, per ADR-0002).

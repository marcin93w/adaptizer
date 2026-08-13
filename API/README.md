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

`GET /` and `HEAD /` are the only accepted requests. Any other path is a `404`
and any other method a `405` with an `Allow: GET, HEAD` header; both respond
with a JSON `{ "error": ... }` body.

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

The Worker serves **only** the catalog. Audio is served directly off the public
R2 bucket, which is why no R2 binding appears in `wrangler.toml`: the client
builds `{mediaBaseUrl}/{storage_location}/manifest.mpd` itself
(`Player/mobile/src/data/dashUrl.ts`) and fetches it without touching this
Worker. Each `storage_location` prefix in the bucket holds a
`manifest.mpd` plus the ten `audioN_dash.webm` representations produced by
[`Instrument/dash-converter.ps1`](../Instrument/dash-converter.ps1).

## Development

```sh
npm install
npm run dev      # local dev server, uses a local D1 replica
npm run deploy   # deploy to Cloudflare
```

Seed a local database first with `npm run db:schema:local`. To inspect the live
catalog, `npm run db:songs`.

## Adding a song

1. Export the song from your DAW with `e <outputPath> <bpm>` (see the root
   [readme](../readme.md)) to produce the DASH output.
2. Upload the output directory to the `adaptizer` R2 bucket under a new prefix.
3. Insert the catalog row, using that prefix as `storage_location` and the
   dimension the song was authored against as `dimension` — one of `volume`,
   `heartRate`, `movementSpeed`, `intensity`, spelled byte-identically. Omit
   `dimension` to take the column default, `intensity`.

   ```sh
   npx wrangler d1 execute adaptizer --remote --command="INSERT INTO songs (author, album, name, storage_location, dimension) VALUES ('Author', 'Album', 'Name', 'Prefix', 'intensity')"
   ```

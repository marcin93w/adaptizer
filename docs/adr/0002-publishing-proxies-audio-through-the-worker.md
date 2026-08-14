# Publishing proxies audio through the Worker behind one API key

Publishing a song was two manual steps — upload the DASH output to the
`adaptizer` R2 bucket by hand, then type the catalog row in by hand — each
authenticated by the producer's own Cloudflare login. Automating it as a
**Publish** button in Instrument turns those steps into a network surface that
must be gated, or the write path would be as open as the public `GET /`. We
decided Instrument sends the whole export to the Worker in **one authenticated
`multipart/form-data` `POST /`** — the `Authorization: Bearer` publish key,
the row's metadata, and the eleven files (`manifest.mpd` plus `audio0..9`) —
and the Worker, now holding an R2 binding, writes the audio to R2 and then
upserts the row. Audio therefore passes **through** the Worker on the write
path, and every Cloudflare write-credential stays server-side behind a single
secret.

## This reverses the read-path invariant, on purpose

The read path's rule is absolute and stays so: *audio never passes through the
API* — the Player streams straight off public R2, which is why no R2 binding
existed here before. The write path breaks that rule. We accept the asymmetry
because the alternative keeps a bucket-write credential on the client (below),
and one boundary is worth more than a purist invariant. The `GET`/`HEAD` read
path is untouched and stays open to everyone.

## Considered options

**Instrument uploads to R2 directly, then calls the API for the row.** Rejected.
It puts two secrets on a desktop client, one of them an R2 token that is full
write access to the bucket — precisely the credential the proxy keeps off the
client. Pre-signed R2 upload URLs are the same trade wearing a disguise: the
client still wields bucket-write authority, just time-boxed.

**A stronger auth scheme.** Rejected as premature. There is one producer. A
single shared key, stored as a Worker secret and read on the client from a
gitignored env — never compiled into the packaged app — is the WIP-appropriate
boundary. Per-producer identity is a redesign for when there is more than one.

## Consequences

- The Worker gains an R2 binding in `wrangler.toml` and a `PUBLISH_API_KEY`
  secret. The read path needs neither.
- A publishable song is bounded by the Worker request-body limit. Eleven short
  variants are a few MB today, well inside it; a song large enough to approach
  the limit would force a rethink of the proxy.
- Validation on the write path is shape-only — required fields present, all
  eleven parts present — and `dimension` stays an opaque non-empty string, not
  an enum check. This preserves [ADR-0001](./0001-songs-declare-their-adaptation-dimension-by-name.md)'s
  property that naming a new dimension needs no Worker redeploy.
- Re-publishing a song overwrites it in place: the R2 prefix is a slug derived
  from the name, and the row upserts on a `UNIQUE(storage_location)`. Two
  distinct songs sharing a name would collide — tolerable at one producer.
- A failed publish leaves orphan objects in R2 that no row references, hence
  invisible to the Player. No cleanup is done; the row insert is the commit
  point, so audio is written first and the catalog is never left pointing at
  missing audio.

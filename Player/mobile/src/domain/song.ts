/**
 * Domain model for a catalog song.
 *
 * Mirrors the legacy wire model documented in
 * `Player/docs/adaptive-audio.md` section 6 (originally
 * `app/src/main/java/com/adaptizerplayer/SongsRepository.kt`), with the
 * wire field `storage_location` mapped to camelCase `storageLocation`.
 *
 * This module is intentionally free of any networking/`fetch` details so
 * it can be depended on by both the data layer and, later, UI/native code
 * without pulling in an HTTP implementation.
 */
import type { Dimension } from './dimension';

export interface Song {
  readonly id: number;
  readonly author: string;
  readonly album: string;
  readonly name: string;
  readonly storageLocation: string;
  /** Narrowed to a contract name on the way in (see `data/songsApi.ts`). */
  readonly dimension: Dimension;
}

/**
 * Abstraction over "fetch the song catalog" so that consumers (UI, other
 * repositories) can depend on this interface rather than a concrete
 * networking implementation. This makes it possible to inject a fake
 * implementation in tests without touching real network code.
 */
export interface SongsRepository {
  /**
   * Resolves with the full song catalog. An empty catalog resolves with an
   * empty array — that is a successful, distinct outcome from any failure.
   *
   * Rejects with a typed error (see `src/data/songsApi.ts`) on network
   * failure, a non-2xx response, or a malformed/invalid payload. Rejects
   * with a distinct cancellation error if `signal` is aborted before the
   * fetch completes.
   */
  fetchSongs(signal?: AbortSignal): Promise<Song[]>;
}

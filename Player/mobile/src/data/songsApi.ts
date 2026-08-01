import {config} from '../config';
import type {Song, SongsRepository} from '../domain/song';

/**
 * Stable error codes for the songs API. Deliberately aligned with the
 * overlapping subset of the native-module error taxonomy documented in
 * `Player/docs/migration/bridge-contract.md` ("network", "unknown") so
 * that a future unified error-presentation layer can treat both
 * vocabularies consistently. This module has no native-module errors
 * (`manifest`, `unsupported_track`, `decoder`, `lifecycle`,
 * `not_initialized`), so only the overlapping codes are reused here.
 */
export type SongsApiErrorCode = 'network' | 'unknown';

/**
 * Typed error thrown by the songs API for every failure mode *except*
 * cancellation (see `SongsFetchCancelledError`). Carries a stable `code`
 * or `status` from `Player/docs/migration/bridge-contract.md`, and never
 * degrades a failure into an empty array — this is what fixes the legacy
 * defect recorded in `Player/docs/migration/M00-baseline.md` section 6.5,
 * where `SongsRepository.fetchSongs()` swallowed every exception and
 * returned `emptyList()`, making a network failure indistinguishable from
 * a genuinely empty catalog.
 */
export class SongsApiError extends Error {
  readonly code: SongsApiErrorCode;
  /** HTTP status code, present only when `code === 'network'` and a response was received. */
  readonly status?: number;
  readonly cause?: unknown;

  constructor(
    code: SongsApiErrorCode,
    message: string,
    options?: {status?: number; cause?: unknown},
  ) {
    super(message);
    this.name = 'SongsApiError';
    this.code = code;
    this.status = options?.status;
    this.cause = options?.cause;
  }
}

/**
 * Thrown instead of `SongsApiError` when the fetch was cancelled via the
 * caller-supplied `AbortSignal`. Kept as a distinct type (rather than a
 * `SongsApiError` with some code) so callers can unambiguously tell
 * "the caller cancelled this" apart from "the network/server/payload
 * failed" without inspecting a string code.
 */
export class SongsFetchCancelledError extends Error {
  constructor() {
    super('Songs fetch was cancelled');
    this.name = 'SongsFetchCancelledError';
  }
}

const SONGS_PATH = '/';

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as {name?: unknown}).name === 'AbortError'
  );
}

/**
 * Validates that a raw JSON value has the shape of the wire-format Song
 * record documented in `Player/docs/migration/M00-baseline.md` section 5:
 * `{ id: number, author: string, album: string, name: string, storage_location: string }`.
 * Returns the parsed domain `Song` (with `storageLocation` camelCased) or
 * `null` if the value does not match. Deliberately does not use a blind
 * `as Song` cast — every field's presence and primitive type is checked
 * explicitly.
 */
function parseSong(value: unknown): Song | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (
    typeof record.id === 'number' &&
    typeof record.author === 'string' &&
    typeof record.album === 'string' &&
    typeof record.name === 'string' &&
    typeof record.storage_location === 'string'
  ) {
    return {
      id: record.id,
      author: record.author,
      album: record.album,
      name: record.name,
      storageLocation: record.storage_location,
    };
  }

  return null;
}

/**
 * Fetch-based implementation of `SongsRepository` against the songs
 * catalog API (`Player/docs/migration/M00-baseline.md` section 5,
 * `GET /` returning a JSON array).
 */
export class HttpSongsRepository implements SongsRepository {
  private readonly baseUrl: string;

  constructor(baseUrl: string = config.songsApiBaseUrl) {
    this.baseUrl = baseUrl;
  }

  async fetchSongs(signal?: AbortSignal): Promise<Song[]> {
    if (signal?.aborted) {
      throw new SongsFetchCancelledError();
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${SONGS_PATH}`, {signal});
    } catch (error) {
      if (isAbortError(error) || signal?.aborted) {
        throw new SongsFetchCancelledError();
      }
      throw new SongsApiError('network', 'Failed to reach the songs API', {
        cause: error,
      });
    }

    if (!response.ok) {
      throw new SongsApiError(
        'network',
        `Songs API responded with status ${response.status}`,
        {status: response.status},
      );
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      if (isAbortError(error) || signal?.aborted) {
        throw new SongsFetchCancelledError();
      }
      throw new SongsApiError('unknown', 'Songs API response was not valid JSON', {
        cause: error,
      });
    }

    if (!Array.isArray(body)) {
      throw new SongsApiError(
        'unknown',
        'Songs API response was not a JSON array',
      );
    }

    const songs: Song[] = [];
    for (const item of body) {
      const song = parseSong(item);
      if (song === null) {
        throw new SongsApiError(
          'unknown',
          'Songs API response contained an item with an invalid shape',
        );
      }
      songs.push(song);
    }

    // An empty array here is a legitimate, successful result — this must
    // stay distinguishable from every error path above.
    return songs;
  }
}

/** Default songs repository instance, configured from `src/config`. */
export const songsApi: SongsRepository = new HttpSongsRepository();

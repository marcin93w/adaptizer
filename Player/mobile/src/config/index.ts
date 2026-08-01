/**
 * Centralized configuration for network base URLs.
 *
 * These values mirror the legacy Android app's hard-coded endpoints
 * (see `Player/docs/migration/M00-baseline.md`, section 5:
 * `app/src/main/java/com/adaptizerplayer/SongsRepository.kt` for the
 * songs API base URL and `MainActivity.kt` for the media base URL).
 * Nothing outside this module should hard-code either URL.
 */

export interface AppConfig {
  /**
   * Base URL of the songs catalog API. `GET /` returns the full song list.
   */
  readonly songsApiBaseUrl: string;

  /**
   * Base URL of the media storage bucket that DASH manifests are served
   * from. Building the per-song manifest URL (`{mediaBaseUrl}/{storageLocation}/manifest.mpd`)
   * is the responsibility of a later migration step (C03); this module
   * only exposes the base URL.
   */
  readonly mediaBaseUrl: string;
}

export const config: AppConfig = {
  songsApiBaseUrl: 'https://adaptizer.marcin93w.workers.dev',
  mediaBaseUrl: 'https://pub-fb297744d1fd4584a256f702d29363a8.r2.dev',
};

import { config } from '../config';

/**
 * Builds the DASH manifest URL for a catalog song.
 *
 * Keeping this at the data boundary means the catalog screen deals in the
 * domain value (`storageLocation`) while the player always receives the
 * complete manifest URL expected by the native bridge.
 */
export function buildDashManifestUrl(
  storageLocation: string,
  mediaBaseUrl: string = config.mediaBaseUrl,
): string {
  const normalizedBaseUrl = mediaBaseUrl.replace(/\/+$/, '');
  const normalizedStorageLocation = storageLocation
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');

  if (normalizedStorageLocation.length === 0) {
    throw new Error(
      'A song storage location is required to build its DASH URL',
    );
  }

  return `${normalizedBaseUrl}/${normalizedStorageLocation}/manifest.mpd`;
}

/** Short alias for callers that do not need to mention the manifest suffix. */
export const buildDashUrl = buildDashManifestUrl;

import { config } from '../../config';
import { buildDashManifestUrl, buildDashUrl } from '../dashUrl';

describe('buildDashManifestUrl', () => {
  it('builds the manifest URL from the configured media base and storage location', () => {
    expect(buildDashManifestUrl('songs/one')).toBe(
      `${config.mediaBaseUrl}/songs/one/manifest.mpd`,
    );
  });

  it('normalizes slashes when callers provide path-like values', () => {
    expect(buildDashUrl('/songs/one/')).toBe(
      `${config.mediaBaseUrl}/songs/one/manifest.mpd`,
    );
    expect(
      buildDashManifestUrl('/songs/one/', 'https://media.example.test/'),
    ).toBe('https://media.example.test/songs/one/manifest.mpd');
  });

  it('rejects an empty storage location instead of producing an invalid manifest URL', () => {
    expect(() => buildDashManifestUrl('')).toThrow(
      'A song storage location is required',
    );
  });
});

import { AdaptiveAudioUnavailableError, adaptiveAudio } from '../AdaptiveAudio';

/**
 * The real, TurboModule-backed facade in a Jest environment where
 * `NativeAdaptiveAudio` is never registered (no device, no native package
 * in the JS-only test environment). Importing `../AdaptiveAudio` must not throw - that is the
 * whole point of resolving the module via `TurboModuleRegistry.get`
 * rather than the Codegen spec's own `getEnforcing` default export - and
 * every caller gets a typed `isAvailable: false` plus a typed error
 * instead of a crash.
 */
describe('adaptiveAudio (real facade, module unavailable in tests)', () => {
  it('reports isAvailable as false without throwing', () => {
    expect(adaptiveAudio.isAvailable).toBe(false);
  });

  it('throws a typed AdaptiveAudioUnavailableError from every command', () => {
    expect(() => adaptiveAudio.play()).toThrow(AdaptiveAudioUnavailableError);
    expect(() => adaptiveAudio.pause()).toThrow(AdaptiveAudioUnavailableError);
    expect(() => adaptiveAudio.seekTo(0)).toThrow(
      AdaptiveAudioUnavailableError,
    );
    expect(() => adaptiveAudio.release()).toThrow(
      AdaptiveAudioUnavailableError,
    );
    expect(() =>
      adaptiveAudio.prepare('uri', { id: '1', title: 't', artist: 'a' }),
    ).toThrow(AdaptiveAudioUnavailableError);
  });

  it('throws from every listener registration method too', () => {
    expect(() => adaptiveAudio.addPlaybackStateListener(() => {})).toThrow(
      AdaptiveAudioUnavailableError,
    );
    expect(() => adaptiveAudio.addProgressListener(() => {})).toThrow(
      AdaptiveAudioUnavailableError,
    );
    expect(() => adaptiveAudio.addIntensityChangedListener(() => {})).toThrow(
      AdaptiveAudioUnavailableError,
    );
    expect(() => adaptiveAudio.addTrackChangedListener(() => {})).toThrow(
      AdaptiveAudioUnavailableError,
    );
    expect(() => adaptiveAudio.addPlayerErrorListener(() => {})).toThrow(
      AdaptiveAudioUnavailableError,
    );
  });
});

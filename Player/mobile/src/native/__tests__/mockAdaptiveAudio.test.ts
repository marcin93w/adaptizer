import { AdaptiveAudioUnavailableError } from '../AdaptiveAudio';
import { createMockAdaptiveAudio } from '../mockAdaptiveAudio';
import {
  ADAPTIVE_AUDIO_ERROR_CODES,
  PLAYBACK_STATES,
  type AdaptiveAudioErrorCode,
  type PlaybackState,
} from '../types';

describe('createMockAdaptiveAudio', () => {
  it('is available by default and requires no native module or device', () => {
    const mock = createMockAdaptiveAudio();

    expect(mock.isAvailable).toBe(true);
  });

  it('drives every one of the six documented PlaybackState values', () => {
    const mock = createMockAdaptiveAudio();
    const seen: PlaybackState[] = [];
    mock.addPlaybackStateListener(event => seen.push(event.state));

    for (const state of PLAYBACK_STATES) {
      mock.emitPlaybackState({ state, sourceId: 'song-1' });
    }

    expect(seen).toEqual(PLAYBACK_STATES);
    // Sanity: this really did cover all six - not a subset that happens
    // to satisfy `toEqual` some other way.
    expect(seen).toHaveLength(6);
  });

  it('drives every one of the seven documented AdaptiveAudioErrorCode values', () => {
    const mock = createMockAdaptiveAudio();
    const seen: AdaptiveAudioErrorCode[] = [];
    mock.addPlayerErrorListener(event => seen.push(event.code));

    for (const code of ADAPTIVE_AUDIO_ERROR_CODES) {
      mock.emitPlayerError({
        code,
        message: `synthetic ${code} error`,
        recoverable: code === 'network',
      });
    }

    expect(seen).toEqual(ADAPTIVE_AUDIO_ERROR_CODES);
    expect(seen).toHaveLength(7);
  });

  it('drives progress, intensity and track-change events explicitly, with no hidden timers', () => {
    const mock = createMockAdaptiveAudio();
    const progress: number[] = [];
    const intensity: number[] = [];
    const trackChanges: Array<{ requested: number; selected: number }> = [];

    mock.addProgressListener(event => progress.push(event.positionMs));
    mock.addIntensityChangedListener(event => intensity.push(event.intensity));
    mock.addTrackChangedListener(event =>
      trackChanges.push({
        requested: event.requestedIndex,
        selected: event.selectedIndex,
      }),
    );

    // Nothing fires until the test explicitly drives it - no jest fake
    // timers or `jest.advanceTimersByTime` required anywhere in this file.
    expect(progress).toEqual([]);

    mock.emitProgress({ positionMs: 0, durationMs: 120_000, bufferedMs: 0 });
    mock.emitProgress({
      positionMs: 5_000,
      durationMs: 120_000,
      bufferedMs: 8_000,
    });
    mock.emitIntensityChanged({ intensity: 3, volume: 3, acceleration: 0 });
    mock.emitIntensityChanged({ intensity: 9, volume: 9, acceleration: 9 });
    mock.emitTrackChanged({
      requestedIndex: 9,
      selectedIndex: 4,
      availableCount: 5,
    });

    expect(progress).toEqual([0, 5_000]);
    expect(intensity).toEqual([3, 9]);
    expect(trackChanges).toEqual([{ requested: 9, selected: 4 }]);
  });

  it('records prepare/play/pause/seekTo/release calls for assertions', () => {
    const mock = createMockAdaptiveAudio();

    mock.prepare('https://example.test/manifest.mpd', {
      id: '42',
      title: 'Title',
      artist: 'Artist',
    });
    mock.play();
    mock.pause();
    mock.seekTo(1_500);
    mock.seekTo(0);
    mock.release();

    expect(mock.prepareCalls).toEqual([
      {
        sourceUri: 'https://example.test/manifest.mpd',
        metadata: { id: '42', title: 'Title', artist: 'Artist' },
      },
    ]);
    expect(mock.playCallCount).toBe(1);
    expect(mock.pauseCallCount).toBe(1);
    expect(mock.seekToCalls).toEqual([1_500, 0]);
    expect(mock.releaseCallCount).toBe(1);
  });

  it('throws AdaptiveAudioUnavailableError for commands once set unavailable', () => {
    const mock = createMockAdaptiveAudio();
    mock.setAvailable(false);

    expect(mock.isAvailable).toBe(false);
    expect(() => mock.play()).toThrow(AdaptiveAudioUnavailableError);
    expect(() =>
      mock.prepare('uri', { id: '1', title: 't', artist: 'a' }),
    ).toThrow(AdaptiveAudioUnavailableError);
  });

  it('removes a listener via its Unsubscribe handle', () => {
    const mock = createMockAdaptiveAudio();
    const seen: PlaybackState[] = [];
    const subscription = mock.addPlaybackStateListener(event =>
      seen.push(event.state),
    );

    mock.emitPlaybackState({ state: 'buffering', sourceId: null });
    subscription.remove();
    mock.emitPlaybackState({ state: 'ready', sourceId: null });

    expect(seen).toEqual(['buffering']);
    expect(mock.listenerCounts.playbackState).toBe(0);
  });
});

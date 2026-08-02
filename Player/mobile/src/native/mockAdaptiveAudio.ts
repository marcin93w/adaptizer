/**
 * Deterministic, dependency-free mock of `AdaptiveAudioFacade`
 * (`src/native/AdaptiveAudio.ts`).
 *
 * This drives the catalog screen through loading, playing, paused,
 * buffering and error states without a device, and is what component
 * tests substitute for the real facade. It implements the exact same
 * `AdaptiveAudioFacade` interface as the TurboModule-backed facade, so
 * consuming code never needs to know which one it was given — injection
 * happens by passing/constructing this instead of `adaptiveAudio`, never
 * by patching a global or module registry.
 *
 * Design constraints:
 *  - Requires no native module and no device: it never touches
 *    `TurboModuleRegistry` or any React Native native API.
 *  - Deterministic: it starts NO timers of its own. Every event
 *    (`onPlaybackState`, `onProgress`, `onIntensityChanged`,
 *    `onTrackChanged`, `onPlayerError`) is only emitted when a test
 *    explicitly calls the corresponding `emit*` driving method — there is
 *    no hidden `setInterval` a test would need to fake/advance.
 *  - Can drive every state in the closed sets: all six `PlaybackState`
 *    values and all seven `AdaptiveAudioErrorCode` values are reachable
 *    via `emitPlaybackState`/`emitPlayerError` with any value from
 *    `src/native/types.ts`'s `PLAYBACK_STATES` / `ADAPTIVE_AUDIO_ERROR_CODES`.
 */
import { AdaptiveAudioUnavailableError } from './AdaptiveAudio';
import type { AdaptiveAudioFacade } from './AdaptiveAudio';
import type {
  IntensityChangedEvent,
  PlaybackStateEvent,
  PlayerErrorEvent,
  PrepareMetadata,
  ProgressEvent,
  TrackChangedEvent,
  Unsubscribe,
} from './types';

type Listener<T> = (event: T) => void;

/** Minimal internal pub/sub list; each `add` returns its own `Unsubscribe`. */
class ListenerSet<T> {
  private readonly listeners = new Set<Listener<T>>();

  add(listener: Listener<T>): Unsubscribe {
    this.listeners.add(listener);
    return {
      remove: () => {
        this.listeners.delete(listener);
      },
    };
  }

  emit(event: T): void {
    // Snapshot before iterating so a listener removing itself (or another
    // listener) mid-emit can't corrupt iteration.
    for (const listener of Array.from(this.listeners)) {
      listener(event);
    }
  }

  get size(): number {
    return this.listeners.size;
  }
}

/** One recorded `prepare()` call, for assertions in component tests. */
export interface PrepareCall {
  readonly sourceUri: string;
  readonly metadata: PrepareMetadata;
}

/**
 * The mock's full surface: `AdaptiveAudioFacade` (what production code
 * depends on) plus the driving/inspection API tests use to control it.
 */
export interface MockAdaptiveAudio extends AdaptiveAudioFacade {
  // --- Driving API: simulate events Kotlin would emit --------------------
  emitPlaybackState(event: PlaybackStateEvent): void;
  emitProgress(event: ProgressEvent): void;
  emitIntensityChanged(event: IntensityChangedEvent): void;
  emitTrackChanged(event: TrackChangedEvent): void;
  emitPlayerError(event: PlayerErrorEvent): void;

  // --- Test control --------------------------------------------------------
  /**
   * Toggles `isAvailable`. Defaults to `true`. Set to `false` to exercise
   * the "module unavailable" path without a real iOS build or an Android
   * tree that has not registered the package.
   */
  setAvailable(available: boolean): void;

  // --- Inspection: assert what the facade under test issued ---------------
  readonly prepareCalls: readonly PrepareCall[];
  readonly playCallCount: number;
  readonly pauseCallCount: number;
  readonly seekToCalls: readonly number[];
  readonly releaseCallCount: number;

  /** Current listener counts, useful for asserting listeners were removed. */
  readonly listenerCounts: {
    playbackState: number;
    progress: number;
    intensityChanged: number;
    trackChanged: number;
    playerError: number;
  };
}

export function createMockAdaptiveAudio(): MockAdaptiveAudio {
  let available = true;

  const prepareCalls: PrepareCall[] = [];
  let playCallCount = 0;
  let pauseCallCount = 0;
  const seekToCalls: number[] = [];
  let releaseCallCount = 0;

  const playbackStateListeners = new ListenerSet<PlaybackStateEvent>();
  const progressListeners = new ListenerSet<ProgressEvent>();
  const intensityChangedListeners = new ListenerSet<IntensityChangedEvent>();
  const trackChangedListeners = new ListenerSet<TrackChangedEvent>();
  const playerErrorListeners = new ListenerSet<PlayerErrorEvent>();

  function requireAvailable(): void {
    if (!available) {
      throw new AdaptiveAudioUnavailableError();
    }
  }

  return {
    get isAvailable() {
      return available;
    },

    prepare(sourceUri: string, metadata: PrepareMetadata): void {
      requireAvailable();
      prepareCalls.push({ sourceUri, metadata });
    },
    play(): void {
      requireAvailable();
      playCallCount += 1;
    },
    pause(): void {
      requireAvailable();
      pauseCallCount += 1;
    },
    seekTo(positionMs: number): void {
      requireAvailable();
      seekToCalls.push(positionMs);
    },
    release(): void {
      requireAvailable();
      releaseCallCount += 1;
    },

    addPlaybackStateListener(listener) {
      return playbackStateListeners.add(listener);
    },
    addProgressListener(listener) {
      return progressListeners.add(listener);
    },
    addIntensityChangedListener(listener) {
      return intensityChangedListeners.add(listener);
    },
    addTrackChangedListener(listener) {
      return trackChangedListeners.add(listener);
    },
    addPlayerErrorListener(listener) {
      return playerErrorListeners.add(listener);
    },

    emitPlaybackState(event: PlaybackStateEvent): void {
      playbackStateListeners.emit(event);
    },
    emitProgress(event: ProgressEvent): void {
      progressListeners.emit(event);
    },
    emitIntensityChanged(event: IntensityChangedEvent): void {
      intensityChangedListeners.emit(event);
    },
    emitTrackChanged(event: TrackChangedEvent): void {
      trackChangedListeners.emit(event);
    },
    emitPlayerError(event: PlayerErrorEvent): void {
      playerErrorListeners.emit(event);
    },

    setAvailable(nextAvailable: boolean): void {
      available = nextAvailable;
    },

    get prepareCalls() {
      return prepareCalls;
    },
    get playCallCount() {
      return playCallCount;
    },
    get pauseCallCount() {
      return pauseCallCount;
    },
    get seekToCalls() {
      return seekToCalls;
    },
    get releaseCallCount() {
      return releaseCallCount;
    },
    get listenerCounts() {
      return {
        playbackState: playbackStateListeners.size,
        progress: progressListeners.size,
        intensityChanged: intensityChangedListeners.size,
        trackChanged: trackChangedListeners.size,
        playerError: playerErrorListeners.size,
      };
    },
  };
}

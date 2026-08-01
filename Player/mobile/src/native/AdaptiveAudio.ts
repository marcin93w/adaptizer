/**
 * Typed, injectable facade over the `NativeAdaptiveAudio` TurboModule.
 *
 * This is the ONLY place application code should reach for native
 * playback. It exists for two reasons:
 *
 * 1. Availability. `NativeAdaptiveAudio` is Android-only and is not
 *    registered at all until migration step A03 lands (A04 connects the
 *    real engine). `TurboModuleRegistry.getEnforcing` — which the raw
 *    Codegen spec's default export uses — throws synchronously at import
 *    time if the module isn't registered. This facade never imports that
 *    default export; it resolves the module lazily via the non-throwing
 *    `TurboModuleRegistry.get`, so importing this file is always safe (on
 *    iOS, in tests, and before A03/A04 land), and callers get a typed
 *    `isAvailable` flag instead of a crash.
 * 2. Injectability. C02 and C04 must be able to substitute
 *    `src/native/mockAdaptiveAudio.ts` for this facade without patching
 *    any global or module registry. Both export the same
 *    `AdaptiveAudioFacade` interface; consumers should depend on that
 *    interface (accepted as a parameter/prop/context value), not on this
 *    concrete class.
 *
 * Narrowing: the Codegen spec necessarily represents `PlaybackState` and
 * error codes as wire-level `string` (see
 * `src/specs/NativeAdaptiveAudio.ts`). This facade is the single place
 * that narrows every incoming event payload into the closed union types
 * declared in `src/native/types.ts` before handing it to a listener.
 */
import { TurboModuleRegistry } from 'react-native';
import type { Spec } from '../specs/NativeAdaptiveAudio';
import type {
  AdaptiveAudioErrorCode,
  IntensityChangedEvent,
  PlaybackState,
  PlaybackStateEvent,
  PlayerErrorEvent,
  PrepareMetadata,
  ProgressEvent,
  TrackChangedEvent,
  Unsubscribe,
} from './types';
import { ADAPTIVE_AUDIO_ERROR_CODES, PLAYBACK_STATES } from './types';

const NATIVE_MODULE_NAME = 'NativeAdaptiveAudio';

/**
 * Thrown when a command is issued on a facade whose native module is not
 * available (`isAvailable === false`) — wrong platform (iOS), or this
 * repo state predates A03/A04. Callers should check `isAvailable` and
 * present a typed "unavailable" state (per the migration plan's C04 step)
 * rather than let this propagate as an unhandled error.
 */
export class AdaptiveAudioUnavailableError extends Error {
  constructor() {
    super(
      `${NATIVE_MODULE_NAME} is not available. It is Android-only and is ` +
        'not registered on this build until migration steps A03/A04 land. ' +
        'Check `isAvailable` before issuing commands.',
    );
    this.name = 'AdaptiveAudioUnavailableError';
  }
}

/**
 * The contract every adaptive-audio implementation must satisfy: the real
 * TurboModule-backed facade (this file's `adaptiveAudio` export) and the
 * deterministic JS mock (`src/native/mockAdaptiveAudio.ts`). Consumers
 * depend on this interface, never on `NativeAdaptiveAudioFacade` or the
 * raw Codegen `Spec`.
 */
export interface AdaptiveAudioFacade {
  /**
   * `true` once the native module is registered and resolvable. `false`
   * on iOS, and on Android before migration steps A03/A04 land. Never
   * throws.
   */
  readonly isAvailable: boolean;

  prepare(sourceUri: string, metadata: PrepareMetadata): void;
  play(): void;
  pause(): void;
  seekTo(positionMs: number): void;
  release(): void;

  addPlaybackStateListener(
    listener: (event: PlaybackStateEvent) => void,
  ): Unsubscribe;
  addProgressListener(listener: (event: ProgressEvent) => void): Unsubscribe;
  addIntensityChangedListener(
    listener: (event: IntensityChangedEvent) => void,
  ): Unsubscribe;
  addTrackChangedListener(
    listener: (event: TrackChangedEvent) => void,
  ): Unsubscribe;
  addPlayerErrorListener(
    listener: (event: PlayerErrorEvent) => void,
  ): Unsubscribe;
}

function narrowPlaybackState(value: string): PlaybackState {
  if ((PLAYBACK_STATES as readonly string[]).includes(value)) {
    return value as PlaybackState;
  }
  if (__DEV__) {
    console.warn(
      `[AdaptiveAudio] Received unknown playback state "${value}" from ` +
        'native; the wire contract promises one of ' +
        `${PLAYBACK_STATES.join(', ')}. Treating as "idle".`,
    );
  }
  return 'idle';
}

function narrowErrorCode(value: string): AdaptiveAudioErrorCode {
  if ((ADAPTIVE_AUDIO_ERROR_CODES as readonly string[]).includes(value)) {
    return value as AdaptiveAudioErrorCode;
  }
  if (__DEV__) {
    console.warn(
      `[AdaptiveAudio] Received unknown error code "${value}" from ` +
        'native; the wire contract promises one of ' +
        `${ADAPTIVE_AUDIO_ERROR_CODES.join(', ')}. Treating as "unknown".`,
    );
  }
  return 'unknown';
}

class NativeAdaptiveAudioFacade implements AdaptiveAudioFacade {
  private readonly native: Spec | null;

  constructor() {
    // `TurboModuleRegistry.get` (unlike the spec's own `getEnforcing`
    // default export) resolves to `null` instead of throwing when the
    // module isn't registered — exactly what makes this constructor safe
    // to run unconditionally, on any platform, at any point in the
    // migration.
    this.native = TurboModuleRegistry.get<Spec>(NATIVE_MODULE_NAME);
  }

  get isAvailable(): boolean {
    return this.native != null;
  }

  private requireNative(): Spec {
    if (this.native == null) {
      throw new AdaptiveAudioUnavailableError();
    }
    return this.native;
  }

  prepare(sourceUri: string, metadata: PrepareMetadata): void {
    this.requireNative().prepare(sourceUri, metadata);
  }

  play(): void {
    this.requireNative().play();
  }

  pause(): void {
    this.requireNative().pause();
  }

  seekTo(positionMs: number): void {
    this.requireNative().seekTo(positionMs);
  }

  release(): void {
    this.requireNative().release();
  }

  addPlaybackStateListener(
    listener: (event: PlaybackStateEvent) => void,
  ): Unsubscribe {
    const subscription = this.requireNative().onPlaybackState(event => {
      listener({
        state: narrowPlaybackState(event.state),
        sourceId: event.sourceId,
      });
    });
    return { remove: () => subscription.remove() };
  }

  addProgressListener(listener: (event: ProgressEvent) => void): Unsubscribe {
    const subscription = this.requireNative().onProgress(event => {
      listener(event);
    });
    return { remove: () => subscription.remove() };
  }

  addIntensityChangedListener(
    listener: (event: IntensityChangedEvent) => void,
  ): Unsubscribe {
    const subscription = this.requireNative().onIntensityChanged(event => {
      listener(event);
    });
    return { remove: () => subscription.remove() };
  }

  addTrackChangedListener(
    listener: (event: TrackChangedEvent) => void,
  ): Unsubscribe {
    const subscription = this.requireNative().onTrackChanged(event => {
      listener(event);
    });
    return { remove: () => subscription.remove() };
  }

  addPlayerErrorListener(
    listener: (event: PlayerErrorEvent) => void,
  ): Unsubscribe {
    const subscription = this.requireNative().onPlayerError(event => {
      listener({
        code: narrowErrorCode(event.code),
        message: event.message,
        recoverable: event.recoverable,
      });
    });
    return { remove: () => subscription.remove() };
  }
}

/**
 * The real, TurboModule-backed facade. Application code (C04) should
 * inject this by default and substitute
 * `src/native/mockAdaptiveAudio.ts`'s `createMockAdaptiveAudio()` in
 * tests/Storybook (C02) — never import `NativeAdaptiveAudio` from
 * `src/specs` directly.
 */
export const adaptiveAudio: AdaptiveAudioFacade =
  new NativeAdaptiveAudioFacade();

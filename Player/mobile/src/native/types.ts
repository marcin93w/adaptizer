/**
 * Hand-written, narrowed TypeScript types for the `NativeAdaptiveAudio`
 * bridge described in `Player/docs/native-bridge-contract.md`.
 *
 * The Codegen spec (`src/specs/NativeAdaptiveAudio.ts`) necessarily
 * represents the two closed string sets below (`PlaybackState` and
 * `AdaptiveAudioErrorCode`) as plain wire-level `string` — see the
 * comment at the top of that file for why. This module defines the real,
 * exhaustive closed-union types the contract actually promises, and
 * `src/native/AdaptiveAudio.ts` is the single place that narrows every
 * incoming wire string into one of these types before it reaches typed
 * application code — screens never see a bare `string`.
 */
import type { Dimension } from '../domain/dimension';

/**
 * Closed set of playback states.
 * `docs/native-bridge-contract.md` "Playback states".
 *
 * Transitions are reported via `onPlaybackState`; no state is skipped
 * silently (e.g. `idle` -> `playing` passes through `buffering` and/or
 * `ready` first).
 */
export type PlaybackState =
  | 'idle'
  | 'buffering'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'ended';

/** Every `PlaybackState` value, in the order documented in the contract. */
export const PLAYBACK_STATES: readonly PlaybackState[] = [
  'idle',
  'buffering',
  'ready',
  'playing',
  'paused',
  'ended',
];

/**
 * Stable error taxonomy. `docs/native-bridge-contract.md`
 * "Error taxonomy". `message` on `PlayerErrorEvent` is explicitly not
 * part of the stable contract; only `code` is stable and safe to branch
 * on.
 */
export type AdaptiveAudioErrorCode =
  | 'network'
  | 'manifest'
  | 'unsupported_track'
  | 'decoder'
  | 'lifecycle'
  | 'not_initialized'
  | 'unknown';

/** Every `AdaptiveAudioErrorCode` value, in the order documented in the contract. */
export const ADAPTIVE_AUDIO_ERROR_CODES: readonly AdaptiveAudioErrorCode[] = [
  'network',
  'manifest',
  'unsupported_track',
  'decoder',
  'lifecycle',
  'not_initialized',
  'unknown',
];

/**
 * A subscription handle returned by every `AdaptiveAudioFacade` listener
 * method. Deliberately NOT React Native's own `EventSubscription` type
 * (importable from `'react-native'`): in the installed react-native@0.86.2
 * typings, that type requires `eventType`, `key` and `subscriber` fields
 * plus a construct signature (see
 * `node_modules/react-native/Libraries/vendor/emitter/EventEmitter.d.ts`)
 * — a legacy shape that is awkward and unnecessary to replicate in a
 * plain JS mock. Every facade implementation (the real one and the mock)
 * returns this minimal shape instead; the real facade wraps the native
 * `EventSubscription` it receives from the TurboModule into this shape.
 */
export interface Unsubscribe {
  remove(): void;
}

/** `prepare()`'s second argument. */
export interface PrepareMetadata {
  readonly id: string;
  readonly title: string;
  readonly artist: string;
  /**
   * The song's dimension, already narrowed to a contract name on the catalog
   * side (see `data/songsApi.ts`). Carried byte-identical to the native
   * module, which compares it against `Dimensions` to resolve track
   * selection.
   */
  readonly dimension: Dimension;
}

/** `onPlaybackState` payload, narrowed. */
export interface PlaybackStateEvent {
  readonly state: PlaybackState;
  readonly sourceId: string | null;
}

/** `onProgress` payload. `durationMs` is `-1` if not yet known. */
export interface ProgressEvent {
  readonly positionMs: number;
  readonly durationMs: number;
  readonly bufferedMs: number;
}

/**
 * The per-input diagnostic readings carried by a `DimensionChangedEvent`,
 * narrowed from the wire's `-1`-sentinel integers to `number | null`, where
 * `null` means that input was unavailable when the snapshot was taken.
 * Diagnostics only: `DimensionChangedEvent.value` is what drives selection.
 *
 * One field per input the resolver reasons about. `movementSpeed` is `null`
 * without the required permissions, a moving activity, or foreground updates.
 * `heartRate` is `null` when Bluetooth permission, BLE hardware, or a
 * bonded/connected strap is unavailable — all deliberately the same state at
 * this boundary.
 */
export interface DimensionReadings {
  readonly volume: number | null;
  readonly movementSpeed: number | null;
  readonly heartRate: number | null;
}

/**
 * `onDimensionChanged` payload, narrowed. `dimension` is the resolved
 * dimension the native module used (the current song's), `value` the
 * resolved value 0-9 that actually drives track selection, and `readings`
 * the per-input diagnostics behind it. Fired on every input reading change
 * and every availability flip, so a signal appearing mid-song starts
 * driving the meter without a restart.
 */
export interface DimensionChangedEvent {
  readonly dimension: Dimension;
  readonly value: number;
  readonly readings: DimensionReadings;
}

/** `onTrackChanged` payload. Diagnostics/UI only, never decision input. */
export interface TrackChangedEvent {
  readonly requestedIndex: number;
  readonly selectedIndex: number;
  readonly availableCount: number;
}

/** `onPlayerError` payload, narrowed. */
export interface PlayerErrorEvent {
  readonly code: AdaptiveAudioErrorCode;
  readonly message: string;
  readonly recoverable: boolean;
}

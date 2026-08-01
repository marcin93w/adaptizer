/**
 * Codegen TurboModule specification for `NativeAdaptiveAudio`.
 *
 * This is the machine-readable half of the frozen bridge contract in
 * `Player/docs/migration/bridge-contract.md` (migration step D01, Lane D,
 * approved under M01). It defines the exact commands and events; it does
 * not implement them. A03 scaffolded the Android package/registration
 * and A04 connects the real `AdaptiveAudioEngine`; B05/C04 will add
 * adaptation and product integration. Looking this module up at runtime
 * (`TurboModuleRegistry.getEnforcing`, which this file uses, as Codegen
 * specs conventionally do) throws — application code must never import
 * this file's default export directly. Use the availability-checked
 * facade in `src/native/AdaptiveAudio.ts` instead, which resolves the
 * module lazily via `TurboModuleRegistry.get` (non-throwing) and exposes
 * a typed `isAvailable` flag.
 *
 * Codegen type restrictions (verified against the installed
 * react-native@0.86.2 / @react-native/codegen TypeScript module parser at
 * node_modules/@react-native/codegen/lib/parsers/typescript/modules/index.js
 * and node_modules/@react-native/codegen/lib/parsers/error-utils.js):
 *  - Event-emitter properties (`readonly onX: EventEmitter<T>`) may not be
 *    nullable/optional and the payload type `T` may not be nullable
 *    (`throwIfEventEmitterTypeIsUnsupported` /
 *    `throwIfEventEmitterEventTypeIsUnsupported` in error-utils.js).
 *  - Every command parameter and return type, and every event payload
 *    field, must be a concrete, non-optional-with-default shape. There is
 *    no supported way to express "optional field with an implied
 *    default" the way a hand-written TS type can with `field?: T`.
 *  - This file deliberately does not model a union of object types
 *    anywhere, and does not declare a TypeScript `enum`. Both are
 *    avoided by design here (see below), not because Codegen categorically
 *    rejects every such shape in this version — the goal is to keep the
 *    generated native surface (Kotlin/ObjC++) simple and to avoid
 *    depending on codegen behavior for shapes this contract doesn't need.
 *
 * Closed-set fields, modeled as `string` here on purpose:
 * The contract defines two closed string sets — `PlaybackState` (6
 * values) and the error-code taxonomy (7 values), see
 * `docs/migration/bridge-contract.md`. Both are represented as plain
 * `string` in this Codegen spec, NOT as a TypeScript union of string
 * literals, even though they are logically closed sets. This is a
 * deliberate simplification for the frozen wire contract: it keeps the
 * generated native signatures simple (a Kotlin `String`, not a generated
 * per-platform enum type) and keeps this spec from depending on
 * string-literal-union support in NativeModule event payloads, which is
 * unnecessary complexity for values that JavaScript only ever observes.
 * The real, exhaustive, closed union types — `PlaybackState` and
 * `AdaptiveAudioErrorCode` — live in `src/native/types.ts`, and
 * `src/native/AdaptiveAudio.ts` is the single place that narrows/validates
 * every incoming wire string into one of those types before it reaches
 * typed application code. See that file for the narrowing logic.
 */
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';
import type { EventEmitter } from 'react-native/Libraries/Types/CodegenTypesNamespace';

/** `prepare()`'s second argument. Field types per the frozen contract. */
export type PrepareMetadata = {
  id: string;
  title: string;
  artist: string;
};

/**
 * `onPlaybackState` payload. `state` is wire-level `string`; see the
 * module-level comment above for why it is not a union type here.
 */
export type PlaybackStateEvent = {
  state: string;
  sourceId: string | null;
};

/** `onProgress` payload. `durationMs` is `-1` if not yet known. */
export type ProgressEvent = {
  positionMs: number;
  durationMs: number;
  bufferedMs: number;
};

/** `onIntensityChanged` payload. All three fields are integers 0-9. */
export type IntensityChangedEvent = {
  intensity: number;
  volume: number;
  acceleration: number;
};

/** `onTrackChanged` payload. Diagnostics/UI only, never decision input. */
export type TrackChangedEvent = {
  requestedIndex: number;
  selectedIndex: number;
  availableCount: number;
};

/**
 * `onPlayerError` payload. `code` is wire-level `string`; see the
 * module-level comment above for why it is not a union type here.
 * `message` is explicitly NOT part of the stable contract (wording may
 * change) — only `code` is stable; do not pattern-match on `message`.
 */
export type PlayerErrorEvent = {
  code: string;
  message: string;
  recoverable: boolean;
};

export interface Spec extends TurboModule {
  // --- Commands: JS to Kotlin --------------------------------------------
  // Creates and prepares the DASH media source for `sourceUri`. Does not
  // start playback. Calling `prepare` while a previous source is prepared
  // replaces it.
  prepare(sourceUri: string, metadata: PrepareMetadata): void;
  // Starts/resumes playback of the currently prepared source. No-op (or a
  // `not_initialized` `onPlayerError`) if nothing has been prepared.
  play(): void;
  // Pauses playback. No-op if already paused or nothing is prepared.
  pause(): void;
  // Seeks to `positionMs` from the start of the media. Out-of-range values
  // are clamped to the valid duration by the Kotlin implementation.
  seekTo(positionMs: number): void;
  // Releases the player and any Kotlin-owned native inputs. After
  // `release`, every other command must resolve as `not_initialized`
  // rather than throwing or being silently ignored.
  release(): void;

  // Deliberately NOT defined here, and load-bearing: there is no
  // `setIntensity` command and no `selectTrack` command, and none is
  // planned. Per `Player/docs/migration/bridge-contract.md` ("API
  // constraint") and the migration plan's core guardrail, every
  // adaptation decision (which DASH representation plays, and when) is
  // made entirely inside Kotlin (`adaptive-audio/`), driven by
  // `VolumeInput`/`AccelerometerInput` and the
  // `Adaptizer`/`AdaptizerTrackSelector` pipeline. React Native only ever
  // *observes* adaptation outcomes through `onIntensityChanged` and
  // `onTrackChanged` below; it never *requests* a specific intensity or
  // track. Do not add either command to this spec — doing so would
  // silently reopen an architecture decision that was already closed at
  // M01. (Debug-only input overrides, if ever added, must stay out of
  // this release Codegen spec entirely — see the contract's API
  // constraint section.)

  // --- Events: Kotlin to JS -----------------------------------------------
  // Fired whenever the player's playback state changes.
  readonly onPlaybackState: EventEmitter<PlaybackStateEvent>;
  // Fired periodically during playback, and at minimum once immediately
  // after a successful seek.
  readonly onProgress: EventEmitter<ProgressEvent>;
  // Fired whenever Kotlin recomputes intensity. Presentation only.
  readonly onIntensityChanged: EventEmitter<IntensityChangedEvent>;
  // Fired whenever the Kotlin track selector processes a track-change
  // request. Diagnostics/UI only.
  readonly onTrackChanged: EventEmitter<TrackChangedEvent>;
  // Fired on any player, manifest, network, decoder or lifecycle error.
  readonly onPlayerError: EventEmitter<PlayerErrorEvent>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('NativeAdaptiveAudio');

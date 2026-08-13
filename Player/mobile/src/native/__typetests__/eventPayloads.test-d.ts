/**
 * Type-level tests for the narrowed event/payload types in
 * `src/native/types.ts`. These assert nothing at runtime - the file has
 * no `describe`/`it` blocks - and is deliberately named so Jest's default
 * `testMatch` does not try to execute it as a test suite (it lives
 * outside any `__tests__` directory, and its filename does not end in
 * `.test.ts`/`.spec.ts`). The real gate is `npm run typecheck`
 * (`tsc --noEmit`), run as part of `npm run verify`.
 *
 * Every `@ts-expect-error` below asserts that TypeScript rejects one
 * specific invalid shape. This mechanism is only a real test because
 * `@ts-expect-error` is bidirectional: if the very next line stops being
 * a type error (for example because a narrowed union type was
 * accidentally widened back to `string`), TypeScript reports
 * `TS2578: Unused '@ts-expect-error' directive` at that line, and
 * `tsc --noEmit` fails. This was verified directly: temporarily widening
 * `PlaybackState` in `src/native/types.ts` to `string` and re-running
 * `npx tsc --noEmit -p tsconfig.json` produced `TS2578` errors at every
 * `PlaybackState`-related assertion below; reverting made typecheck clean
 * again.
 */
import type {
  AdaptiveAudioErrorCode,
  DimensionChangedEvent,
  PlaybackState,
  PlaybackStateEvent,
  PlayerErrorEvent,
  PrepareMetadata,
  TrackChangedEvent,
} from '../types';

// --- PlaybackState: closed 6-value union, not a bare `string` --------------

export const validStates: PlaybackState[] = [
  'idle',
  'buffering',
  'ready',
  'playing',
  'paused',
  'ended',
];
// @ts-expect-error - "stopped" is not one of the six documented PlaybackState values.
export const invalidState: PlaybackState = 'stopped';

function acceptsPlaybackState(_state: PlaybackState): void {}
declare const unnarrowedWireString: string;
// @ts-expect-error - an unnarrowed wire-level `string` must not satisfy the closed PlaybackState union.
acceptsPlaybackState(unnarrowedWireString);

// --- AdaptiveAudioErrorCode: closed 7-value union, not a bare `string` -----

export const validCodes: AdaptiveAudioErrorCode[] = [
  'network',
  'manifest',
  'unsupported_track',
  'decoder',
  'lifecycle',
  'not_initialized',
  'unknown',
];
// @ts-expect-error - "timeout" is not one of the seven documented error codes.
export const invalidCode: AdaptiveAudioErrorCode = 'timeout';

// --- PlaybackStateEvent: exact required shape, per the contract -----------

// @ts-expect-error - missing the required `sourceId` field.
export const missingSourceId: PlaybackStateEvent = { state: 'idle' };

export const wrongSourceIdType: PlaybackStateEvent = {
  state: 'idle',
  // @ts-expect-error - `sourceId` must be `string | null`, not a number.
  sourceId: 42,
};

// --- PlayerErrorEvent: `recoverable` boolean, `code` closed set ------------

export const wrongRecoverableType: PlayerErrorEvent = {
  code: 'network',
  message: 'x',
  // @ts-expect-error - `recoverable` must be a boolean, not a string.
  recoverable: 'true',
};
export const wrongCodeValue: PlayerErrorEvent = {
  // @ts-expect-error - `code` must be one of the seven documented error codes.
  code: 'oops',
  message: 'x',
  recoverable: true,
};
// --- TrackChangedEvent: all three fields are required numbers --------------

// @ts-expect-error - missing the required `availableCount` field.
export const missingAvailableCount: TrackChangedEvent = {
  requestedIndex: 0,
  selectedIndex: 0,
};
// --- DimensionChangedEvent: closed dimension + nested readings -------------

export const extraField: DimensionChangedEvent = {
  dimension: 'intensity',
  value: 5,
  readings: { volume: 5, movementSpeed: null, heartRate: null },
  // @ts-expect-error - excess-property check rejects a field the contract does not define.
  unexpected: true,
};
export const wrongEventDimension: DimensionChangedEvent = {
  // @ts-expect-error - `dimension` must be one of the four contract names, not a bare string.
  dimension: 'loudness',
  value: 5,
  readings: { volume: 5, movementSpeed: null, heartRate: null },
};
export const wrongReadingType: DimensionChangedEvent = {
  dimension: 'volume',
  value: 5,
  readings: {
    // @ts-expect-error - a reading is `number | null`; `-1` sentinels are narrowed away before this layer.
    volume: '5',
    movementSpeed: null,
    heartRate: null,
  },
};
// --- PrepareMetadata: field types are exact, per the contract --------------

export const wrongIdType: PrepareMetadata = {
  // @ts-expect-error - `id` must be the stringified legacy Song.id (`string`), not a number.
  id: 1,
  title: 'Title',
  artist: 'Artist',
  dimension: 'intensity',
};
// @ts-expect-error - `dimension` is required on prepare metadata.
export const missingDimension: PrepareMetadata = {
  id: '1',
  title: 'Title',
  artist: 'Artist',
};

/**
 * The Player's copy of the four dimension names — the identical-string contract
 * spelled out again at this layer (no shared package). See `Player/CONTEXT.md`
 * and `docs/adr/0001-songs-declare-their-adaptation-dimension-by-name.md`.
 */
export const DIMENSIONS = [
  'volume',
  'heartRate',
  'movementSpeed',
  'intensity',
] as const;

export type Dimension = (typeof DIMENSIONS)[number];

const DEFAULT_DIMENSION: Dimension = 'intensity';

/**
 * Narrows an arbitrary wire value to a known `Dimension`: a byte-identical
 * contract name passes through unchanged, anything else narrows to `intensity`
 * and is logged (the narrowing rule; see `Player/CONTEXT.md`).
 *
 * The log deliberately fires in production too, not only under `__DEV__` (unlike
 * the native `narrow*` helpers): the mismatch originates from a hand-typed
 * catalog row on the producer side, so it genuinely happens to a correct field
 * build hitting a newer catalog. It runs once per song at fetch, not a hot path.
 */
export function narrowDimension(value: unknown): Dimension {
  if (
    typeof value === 'string' &&
    (DIMENSIONS as readonly string[]).includes(value)
  ) {
    return value as Dimension;
  }
  console.warn(
    `[dimension] Catalog song carries an unrecognised dimension ` +
      `${JSON.stringify(value)}; the contract promises one of ` +
      `${DIMENSIONS.join(', ')}. Narrowing to "${DEFAULT_DIMENSION}".`,
  );
  return DEFAULT_DIMENSION;
}

/**
 * The single uniform collapsed card footprint.
 *
 * Every collapsed card occupies the same fixed box regardless of its degree or
 * kind, so collision / packing has one predictable footprint to pack against.
 * This supersedes the degree-based `nodeSize`, which gave each node a different
 * diameter.
 */

/** The fixed width and height of a collapsed card, in pixels. */
export const cardFootprint = {
  width: 160,
  height: 96,
} as const;

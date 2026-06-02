// ---------------------------------------------------------------------------
// FE-762 — Petrinaut JSON export of the compiled NetBlueprint.
//
// Serializes a (refactored, Petri-net-faithful) blueprint into Petrinaut's
// expected JSON format so cook runs can write `<runDir>/net.json` for the
// Petrinaut team to render and pressure-test.
//
// Pure function: no filesystem side effects. The cook entry point writes
// the result to disk; tests consume the value directly.
//
// Open coordination items (tracked on FE-762):
//   - exact JSON envelope per Petrinaut's loader (pending team)
//   - string vs uuid discrete type for semantic IDs (pending H-6518/H-6519)
//   - place naming convention (full internal IDs vs short labels) — for v1
//     both are emitted (`id` is the internal ID, `label` strips the
//     `slice:<id>:` / `epic:<id>:` prefix for a short visual label)
// ---------------------------------------------------------------------------

import { randomUUID } from 'node:crypto';

import { enumerateCandidateOutputs } from './net-blueprint.js';
import type { NetBlueprint, TokenSeed } from './net-blueprint.js';
import { placeName } from './petri-net.js';

/**
 * Schema version of Brunch's exported net JSON. Bump on any breaking Brunch
 * shape change so Petrinaut loaders can refuse incompatible runs early. This is
 * separate from Petrinaut's SDCPN file-format `version`.
 */
export const PETRINAUT_NET_SCHEMA_VERSION = '0.1.0';

/**
 * Per-instance Petrinaut token. Cross-team-agreed shape (2026-05-26):
 * `{ id: <UUID>, ...payload }` where `id` is the per-instance visual
 * identity and the rest are semantic payload fields from the orchestrator's
 * internal Token. UUIDs are generated at serialization time; the question
 * of whether they persist across consume→emit (token lineage tracing) is a
 * FE-763 open coordination item.
 */
export type PetrinautToken = {
  id: string;
  sliceId?: string;
  epicId?: string;
  retryCount?: number;
  reworkCount?: number;
};

export type PetrinautPlace = {
  /** Internal place ID (e.g. `slice:slice-1:spec-ready`). */
  id: string;
  /** Short visual label with the `slice:<id>:` / `epic:<id>:` prefix stripped. */
  label: string;
};

export type PetrinautTransition = {
  /** Internal transition ID (e.g. `slice-1:evaluate:dispatch`). */
  id: string;
  /** Same as id for v1 — Petrinaut may want a short label later. */
  label: string;
  /** Subnet lane (`mechanical` | `semantic` | `epic`). */
  lane?: string;
  /** Transition classification (`mechanical` | `semantic` | `structural`). */
  kind: string;
  /** What entity fires this transition (when meaningful). */
  actor?: string;
  /** Human-readable guard description. */
  guard?: string;
  /** Input arcs: places this transition consumes from. */
  inputs: string[];
  /** Output arcs: places this transition may emit to (full reachable set). */
  outputs: string[];
};

export type PetrinautMarking = {
  place: string;
  tokens: PetrinautToken[];
};

export type PetrinautNet = {
  schemaVersion: string;
  runId: string;
  places: PetrinautPlace[];
  transitions: PetrinautTransition[];
  initialMarking: PetrinautMarking[];
};

export type SerializeBlueprintOpts = {
  runId: string;
  /** Override the per-token UUID generator (tests use a deterministic stub). */
  tokenIdFn?: () => string;
};

/**
 * Serialize a compiled NetBlueprint into Petrinaut JSON shape.
 *
 * Topology (places + transitions + arcs) comes directly from the blueprint;
 * the candidate output set for each transition is computed via
 * `enumerateCandidateOutputs`. Initial marking is grouped by place and each
 * token gets a fresh UUID.
 *
 * The downstream SDCPN import projection is intentionally lossy for v1: it keeps
 * topology and initial counts but does not encode Brunch guard semantics or
 * token payloads into executable SDCPN colour/kernel logic.
 */
export function serializeBlueprint(blueprint: NetBlueprint, opts: SerializeBlueprintOpts): PetrinautNet {
  const tokenId = opts.tokenIdFn ?? randomUUID;

  const places: PetrinautPlace[] = blueprint.places.map((id) => ({
    id,
    label: placeName(id),
  }));

  const transitions: PetrinautTransition[] = blueprint.transitions.map((t) => {
    const outs = enumerateCandidateOutputs(t);
    return {
      id: t.id,
      label: t.id,
      kind: t.contract.kind,
      ...(t.contract.lane !== undefined ? { lane: t.contract.lane } : {}),
      ...(t.contract.actor !== undefined ? { actor: t.contract.actor } : {}),
      ...(t.contract.guard !== undefined ? { guard: t.contract.guard } : {}),
      inputs: [...t.inputs],
      outputs: [...outs].sort(),
    };
  });

  // Group initial tokens by place, preserving declaration order within each place.
  const byPlace = new Map<string, TokenSeed[]>();
  for (const { place, token } of blueprint.initialTokens) {
    const list = byPlace.get(place) ?? [];
    list.push(token);
    byPlace.set(place, list);
  }

  const initialMarking: PetrinautMarking[] = Array.from(byPlace.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([place, tokens]) => ({
      place,
      tokens: tokens.map((seed) => seedToToken(seed, tokenId())),
    }));

  return {
    schemaVersion: PETRINAUT_NET_SCHEMA_VERSION,
    runId: opts.runId,
    places,
    transitions,
    initialMarking,
  };
}

function seedToToken(seed: TokenSeed, id: string): PetrinautToken {
  return {
    id,
    ...(hasScopedId(seed.sliceId) ? { sliceId: seed.sliceId } : {}),
    ...(hasScopedId(seed.epicId) ? { epicId: seed.epicId } : {}),
    ...(seed.retryCount !== undefined ? { retryCount: seed.retryCount } : {}),
    ...(seed.reworkCount !== undefined ? { reworkCount: seed.reworkCount } : {}),
  };
}

function hasScopedId(value: string): boolean {
  return value !== '';
}

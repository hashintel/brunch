// ---------------------------------------------------------------------------
// FE-784 — Colour-fold helpers for the Petrinaut export projection.
//
// The compiled net (NetBlueprint) emits one concrete subnet per slice
// (`slice:<sid>:*` places, `<sid>:*` / `slice-ready:<sid>` transitions).
// Petrinaut's canvas is flat — no hierarchy, subnets, or grouping — so the
// only way to keep the imported net legible at scale is to collapse the N
// structurally-identical slice subnets into ONE, carrying slice identity on
// the token colour instead of in the node id.
//
// This module owns the pure id-folding rules shared by the static export
// (`petrinaut-export.ts`) and the live event adapter (`petrinaut-events.ts`)
// so both fold concrete ids the same way.
//
// Fidelity: this is a projection only. The runtime net (`petri-net.ts` /
// `net-compiler.ts`) is untouched; it still fires concrete per-slice
// transitions. The adapter maps those concrete firings onto the folded net.
// ---------------------------------------------------------------------------

import { enumerateCandidateOutputs } from './net-blueprint.js';
import type { TransitionSkeleton } from './net-blueprint.js';

// ---------------------------------------------------------------------------
// Token colour type — the slice identity that folding pushes onto the token.
// Emitted in net.json (`tokenTypes`); folded slice places reference it via
// `typeId`. SDCPN export stays count-fold (uncoloured) until Petrinaut
// supports discrete string token dimensions (H-6518/H-6519).
// ---------------------------------------------------------------------------

export type PetrinautTokenType = {
  id: string;
  name: string;
  dimensions: { name: string; kind: 'discrete' | 'number' }[];
};

export const SLICE_COLOUR_TYPE_ID = 'slice-colour';

export const SLICE_COLOUR_TYPE: PetrinautTokenType = {
  id: SLICE_COLOUR_TYPE_ID,
  name: 'SliceColour',
  dimensions: [
    { name: 'sliceId', kind: 'discrete' },
    { name: 'epicId', kind: 'discrete' },
    { name: 'retryCount', kind: 'number' },
    { name: 'reworkCount', kind: 'number' },
  ],
};

// ---------------------------------------------------------------------------
// Pure id folding
// ---------------------------------------------------------------------------

/** Collect the distinct slice ids from `slice:<sid>:…` place ids. */
export function collectSliceIds(placeIds: Iterable<string>): Set<string> {
  const ids = new Set<string>();
  for (const id of placeIds) {
    const m = id.match(/^slice:([^:]+):/);
    if (m) ids.add(m[1]!);
  }
  return ids;
}

/**
 * Fold a place id to its slice-independent role by stripping the
 * `slice:<sid>:` prefix. Per-edge `dep-signal:<dependent>` places keep the
 * dependent id (they are genuinely per-edge, so they fold to a unique role).
 * Epic, pool, and bare places are returned unchanged.
 */
export function foldPlaceId(placeId: string): string {
  const m = placeId.match(/^slice:[^:]+:(.+)$/);
  return m ? m[1]! : placeId;
}

/**
 * Fold a transition id to its slice-independent role by removing the owning
 * slice-id segment wherever it appears (sid-prefixed transitions like
 * `slice-1:evaluate:dispatch`, and the sid-suffixed readiness gate
 * `slice-ready:slice-1`). A transition id references only its own slice, so
 * removing any slice-id segment is safe. Epic transitions carry no slice-id
 * segment and are returned unchanged.
 */
export function foldTransitionId(transitionId: string, sliceIds: ReadonlySet<string>): string {
  const segments = transitionId.split(':').filter((seg) => !sliceIds.has(seg));
  return segments.join(':');
}

// ---------------------------------------------------------------------------
// Transition fold map — decides, per concrete transition, the id it folds to
// in the projection. Members of a folded group whose folded SHAPE (folded
// arcs + contract metadata) is identical collapse to one folded node; a group
// whose members diverge (e.g. dep-gated `slice-ready`, dep-signalling
// `return-done`) keeps each member at its concrete id so the projection never
// misrepresents the dependency wiring.
// ---------------------------------------------------------------------------

function foldedShapeSignature(t: TransitionSkeleton, sliceIds: ReadonlySet<string>): string {
  const inputs = [...new Set(t.inputs.map(foldPlaceId))].sort();
  const outputs = [...new Set([...enumerateCandidateOutputs(t)].map(foldPlaceId))].sort();
  const c = t.contract;
  return JSON.stringify({ inputs, outputs, kind: c.kind, lane: c.lane ?? null, actor: c.actor ?? null });
}

/**
 * Build a map from each concrete transition id to the id it is exported as.
 * Uniform folded groups map every member to the shared folded id; divergent
 * groups map each member to its own concrete id.
 */
export function buildTransitionFoldMap(
  transitions: readonly TransitionSkeleton[],
  sliceIds: ReadonlySet<string>,
): Map<string, string> {
  const groups = new Map<string, { id: string; sig: string }[]>();
  for (const t of transitions) {
    const folded = foldTransitionId(t.id, sliceIds);
    const list = groups.get(folded) ?? [];
    list.push({ id: t.id, sig: foldedShapeSignature(t, sliceIds) });
    groups.set(folded, list);
  }

  const map = new Map<string, string>();
  for (const [folded, members] of groups) {
    const uniform = members.every((m) => m.sig === members[0]!.sig);
    for (const m of members) map.set(m.id, uniform ? folded : m.id);
  }
  return map;
}

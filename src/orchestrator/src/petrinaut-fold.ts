// ---------------------------------------------------------------------------
// FE-784 — Color-fold of a compiled NetBlueprint for the Petrinaut projection.
//
// The compiled net emits one concrete subnet per slice (`slice:<sid>:*` places,
// `<sid>:*` / `slice-ready:<sid>` transitions). Petrinaut's canvas is flat — no
// hierarchy, subnets, or grouping — so the only way to keep the imported net
// legible at scale is to collapse the N structurally-identical slice subnets
// into ONE, carrying slice identity on the token color instead of in the node
// id.
//
// `NetFolding` owns the entire concrete→folded mapping of one blueprint: the
// folded place set, the folded transition set, the per-place marking fold, and
// the color-type classification. Both consumers — the static `net.json` export
// (`serializeBlueprint`) and the live event adapter (`createPetrinautEventStream`)
// — go through one folding so the static net and the live event stream fold
// identically. The id-rule primitives below are private implementation detail.
//
// Fidelity: this is a projection only. The runtime net (`petri-net.ts` /
// `net-compiler.ts`) is untouched; it still fires concrete per-slice
// transitions. The adapter maps those firings onto the folded net.
// ---------------------------------------------------------------------------

import { enumerateCandidateOutputs } from './net-blueprint.js';
import type { NetBlueprint, TransitionSkeleton } from './net-blueprint.js';
import type { TransitionContract } from './petri-net.js';

// ---------------------------------------------------------------------------
// Token color type — the slice identity that folding pushes onto the token.
// Emitted in net.json (`tokenTypes`); folded slice places reference it via
// `typeId`. SDCPN export stays count-fold (uncolored) until Petrinaut
// supports discrete string token dimensions (H-6518/H-6519).
// ---------------------------------------------------------------------------

export type PetrinautTokenType = {
  id: string;
  name: string;
  dimensions: { name: string; kind: 'discrete' | 'number' }[];
};

export const SLICE_COLOR_TYPE_ID = 'slice-color';

export const SLICE_COLOR_TYPE: PetrinautTokenType = {
  id: SLICE_COLOR_TYPE_ID,
  name: 'SliceColor',
  dimensions: [
    { name: 'sliceId', kind: 'discrete' },
    { name: 'epicId', kind: 'discrete' },
    { name: 'retryCount', kind: 'number' },
    { name: 'reworkCount', kind: 'number' },
  ],
};

// ---------------------------------------------------------------------------
// Folded node value shapes (public; the id maps stay private to the object).
// ---------------------------------------------------------------------------

/** A place in the folded projection. `id` is the slice-independent role. */
export type FoldedPlace = {
  id: string;
  /** Color type id when this folded place holds slice-colored tokens. */
  typeId?: string;
};

/** A transition in the folded projection. Arcs are already folded. */
export type FoldedTransition = {
  /** Exported id: shared folded id for uniform groups, concrete id for divergent members. */
  id: string;
  inputs: readonly string[];
  outputs: readonly string[];
  contract: TransitionContract;
};

/**
 * The color-fold of one compiled NetBlueprint. Built once via
 * `createNetFolding`; immutable thereafter and safe to share between the
 * static export and the live event stream. Callers never touch the underlying
 * id maps — they only ask the folding to fold things.
 */
export type NetFolding = {
  /** Folded places, deduped, in first-occurrence order. Slice places carry `typeId`. */
  foldedPlaces(): readonly FoldedPlace[];
  /** Folded transitions, deduped to their exported id, in first-occurrence order. */
  foldedTransitions(): readonly FoldedTransition[];
  /** Exported id for one concrete transition id (folded, or concrete when divergent). */
  foldTransition(transitionId: string): string;
  /**
   * Fold a sequence of (concrete place, tokens) entries into a map keyed by
   * folded place, merging token lists for places that fold together and
   * preserving empty-list keys. Pure; does not mutate inputs.
   */
  foldedMarking<T>(entries: Iterable<readonly [place: string, tokens: readonly T[]]>): Map<string, T[]>;
  /** Color token types referenced by `foldedPlaces()` — `[SLICE_COLOR_TYPE]` or `[]`. */
  tokenTypes(): readonly PetrinautTokenType[];
};

/**
 * Build the folding for a compiled blueprint. Pure and deterministic: computes
 * the slice-id set and transition fold map once, O(places + transitions). The
 * returned folding is only meaningful for ids originating from this blueprint.
 */
export function createNetFolding(blueprint: NetBlueprint): NetFolding {
  const sliceIds = collectSliceIds(blueprint.places);
  const transitionFoldMap = buildTransitionFoldMap(blueprint.transitions, sliceIds);

  // Folded places — dedupe by folded id; a folded slice place carries the
  // slice color type.
  const placeById = new Map<string, FoldedPlace>();
  for (const id of blueprint.places) {
    const folded = foldPlaceId(id);
    if (placeById.has(folded)) continue;
    placeById.set(folded, {
      id: folded,
      ...(id.startsWith('slice:') ? { typeId: SLICE_COLOR_TYPE_ID } : {}),
    });
  }
  const places = [...placeById.values()];

  // Folded transitions — one entry per exported id; uniform members collapse,
  // divergent members keep their concrete id.
  const transitionById = new Map<string, FoldedTransition>();
  for (const t of blueprint.transitions) {
    const exportedId = transitionFoldMap.get(t.id)!;
    if (transitionById.has(exportedId)) continue;
    transitionById.set(exportedId, {
      id: exportedId,
      inputs: [...new Set(t.inputs.map(foldPlaceId))],
      outputs: [...new Set([...enumerateCandidateOutputs(t)].map(foldPlaceId))].sort(),
      contract: t.contract,
    });
  }
  const transitions = [...transitionById.values()];

  const hasSliceColor = places.some((p) => p.typeId === SLICE_COLOR_TYPE_ID);

  return {
    foldedPlaces: () => places,
    foldedTransitions: () => transitions,
    foldTransition: (transitionId) =>
      transitionFoldMap.get(transitionId) ?? foldTransitionId(transitionId, sliceIds),
    foldedMarking<T>(entries: Iterable<readonly [place: string, tokens: readonly T[]]>): Map<string, T[]> {
      const out = new Map<string, T[]>();
      for (const [place, tokens] of entries) {
        const folded = foldPlaceId(place);
        const list = out.get(folded) ?? [];
        for (const t of tokens) list.push(t);
        out.set(folded, list);
      }
      return out;
    },
    tokenTypes: () => (hasSliceColor ? [SLICE_COLOR_TYPE] : []),
  };
}

// ---------------------------------------------------------------------------
// Private id-folding primitives — the implementation of createNetFolding.
// Not exported: the only public fold surface is NetFolding, so there is no
// parallel API that could drift from the folded net.
// ---------------------------------------------------------------------------

/** Collect the distinct slice ids from `slice:<sid>:…` place ids. */
function collectSliceIds(placeIds: Iterable<string>): Set<string> {
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
function foldPlaceId(placeId: string): string {
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
function foldTransitionId(transitionId: string, sliceIds: ReadonlySet<string>): string {
  return transitionId
    .split(':')
    .filter((seg) => !sliceIds.has(seg))
    .join(':');
}

/**
 * The folded shape that decides fold identity: a transition's folded arcs plus
 * its contract metadata. Members of a folded group sharing this signature
 * collapse to one node; a group whose members differ (e.g. dep-gated
 * `slice-ready`, dep-signalling `return-done`) keeps each member concrete.
 * `guard` is excluded deliberately — it is role-derived, never the thing that
 * distinguishes two slices' copies of the same transition.
 */
function foldedShapeSignature(t: TransitionSkeleton): string {
  const inputs = [...new Set(t.inputs.map(foldPlaceId))].sort();
  const outputs = [...new Set([...enumerateCandidateOutputs(t)].map(foldPlaceId))].sort();
  const c = t.contract;
  return JSON.stringify({ inputs, outputs, kind: c.kind, lane: c.lane ?? null, actor: c.actor ?? null });
}

/**
 * Map each concrete transition id to the id it is exported as. Uniform folded
 * groups map every member to the shared folded id; divergent groups map each
 * member to its own concrete id.
 */
function buildTransitionFoldMap(
  transitions: readonly TransitionSkeleton[],
  sliceIds: ReadonlySet<string>,
): Map<string, string> {
  const groups = new Map<string, { id: string; sig: string }[]>();
  for (const t of transitions) {
    const folded = foldTransitionId(t.id, sliceIds);
    const list = groups.get(folded) ?? [];
    list.push({ id: t.id, sig: foldedShapeSignature(t) });
    groups.set(folded, list);
  }

  const map = new Map<string, string>();
  for (const [folded, members] of groups) {
    const uniform = members.every((m) => m.sig === members[0]!.sig);
    for (const m of members) map.set(m.id, uniform ? folded : m.id);
  }
  return map;
}

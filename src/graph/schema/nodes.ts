/**
 * Graph node type definitions.
 *
 * Canonical reference: docs/design/GRAPH_MODEL.md
 *
 * Phase 2 lock-and-materialize: type definitions only.
 * Drizzle table definitions, structural validators, and the
 * agent-facing node command surface land with subsequent slices.
 */

import type { Lsn, NodeId } from '../atoms.js';
import { DESIGN_KINDS, INTENT_KINDS, NODE_BASES, NODE_PLANES, ORACLE_KINDS, PLAN_KINDS } from './kinds.js';

// ---------------------------------------------------------------------------
// Planes & basis
// ---------------------------------------------------------------------------

/**
 * The four conceptual planes that partition the node space.
 *
 * Each plane groups node kinds that share a common concern:
 *  - `intent`  what and why
 *  - `oracle`  how we know
 *  - `design`  how it's shaped
 *  - `plan`    how it's sequenced
 */
export type NodePlane = (typeof NODE_PLANES)[number];

/**
 * Whether this exact graph item was approved (`explicit`) or materialized from
 * an approved concept without per-item review (`implicit`).
 *
 * Derived from `graph/schema/kinds.ts` — same semantics as EdgeBasis.
 */
export type NodeBasis = (typeof NODE_BASES)[number];

// ---------------------------------------------------------------------------
// Kind taxonomy — derived from graph/schema/kinds.ts const arrays
// ---------------------------------------------------------------------------

/**
 * Intent-plane kinds, spanning three derived categories:
 *  - basic:      `goal`, `thesis`, `term`, `context`
 *  - structural: `requirement`, `assumption`, `constraint`, `invariant`
 *  - reasoning:  `decision`, `criterion`, `example`
 */
type IntentKind = (typeof INTENT_KINDS)[number];

/** Oracle-plane kinds. */
type OracleKind = (typeof ORACLE_KINDS)[number];

/** Design-plane kinds. */
type DesignKind = (typeof DESIGN_KINDS)[number];

/** Plan-plane kinds. */
type PlanKind = (typeof PLAN_KINDS)[number];

/** Union of every node kind across all planes. */
export type NodeKind = IntentKind | OracleKind | DesignKind | PlanKind;

// ---------------------------------------------------------------------------
// Intent kind categories (derived, not stored)
// ---------------------------------------------------------------------------

/**
 * Derived grouping over {@link IntentKind}.
 *
 * Never persisted — computed via {@link intentKindCategory}.
 */
type IntentKindCategory = 'basic' | 'structural' | 'reasoning';

export type ReadinessBand = 'grounding' | 'elicitation' | 'commitment';

export interface NodeKindMetadata {
  readonly label: string;
  readonly readinessBands: readonly ReadinessBand[];
}

type NodeKindMetadataByKind = {
  readonly [Kind in NodeKind]: NodeKindMetadata;
};

export const NODE_KIND_METADATA = {
  goal: { label: 'G', readinessBands: ['grounding'] },
  thesis: { label: 'TH', readinessBands: ['grounding'] },
  term: { label: 'T', readinessBands: ['grounding'] },
  context: { label: 'CTX', readinessBands: ['grounding'] },
  requirement: { label: 'REQ', readinessBands: ['commitment'] },
  assumption: { label: 'A', readinessBands: ['elicitation'] },
  constraint: { label: 'CON', readinessBands: ['grounding', 'elicitation'] },
  invariant: { label: 'INV', readinessBands: ['elicitation'] },
  decision: { label: 'D', readinessBands: ['elicitation'] },
  criterion: { label: 'AC', readinessBands: ['commitment'] },
  example: { label: 'EX', readinessBands: ['elicitation'] },
  check: { label: 'CH', readinessBands: ['commitment'] },
  validation_method: { label: 'VV', readinessBands: ['elicitation'] },
  evidence: { label: 'E', readinessBands: ['commitment'] },
  obligation: { label: 'O', readinessBands: ['elicitation'] },
  module: { label: 'MOD', readinessBands: ['elicitation'] },
  interface: { label: 'API', readinessBands: ['elicitation'] },
  milestone: { label: 'M', readinessBands: ['commitment'] },
  frontier: { label: 'F', readinessBands: ['commitment'] },
  slice: { label: 'S', readinessBands: ['commitment'] },
} as const satisfies NodeKindMetadataByKind;

export type GraphNodeKindCode = (typeof NODE_KIND_METADATA)[NodeKind]['label'];

export interface ParsedGraphNodeCode {
  readonly kind: NodeKind;
  readonly kindOrdinal: number;
}

const NODE_KIND_BY_LABEL: ReadonlyMap<GraphNodeKindCode, NodeKind> = new Map(
  Object.entries(NODE_KIND_METADATA).map(([kind, metadata]) => [metadata.label, kind as NodeKind]),
);

const MAX_NODE_KIND_CODE_LENGTH = Math.max(
  ...Object.values(NODE_KIND_METADATA).map((metadata) => metadata.label.length),
);

export function formatGraphNodeCode(kind: NodeKind, kindOrdinal: number): string {
  return `${NODE_KIND_METADATA[kind].label}${kindOrdinal}`;
}

export function parseGraphNodeCode(code: string): ParsedGraphNodeCode | undefined {
  const normalized = code.trim().toUpperCase();
  for (
    let prefixLength = Math.min(MAX_NODE_KIND_CODE_LENGTH, normalized.length - 1);
    prefixLength > 0;
    prefixLength--
  ) {
    const label = normalized.slice(0, prefixLength);
    const kind = NODE_KIND_BY_LABEL.get(label as GraphNodeKindCode);
    if (!kind) continue;
    const ordinalText = normalized.slice(prefixLength);
    if (!/^[1-9]\d*$/.test(ordinalText)) return undefined;
    return { kind, kindOrdinal: Number(ordinalText) };
  }
  return undefined;
}

/** Pure derivation: intent kind → category. */
export function intentKindCategory(kind: IntentKind): IntentKindCategory {
  switch (kind) {
    case 'goal':
    case 'thesis':
    case 'term':
    case 'context':
      return 'basic';
    case 'requirement':
    case 'assumption':
    case 'constraint':
    case 'invariant':
      return 'structural';
    case 'decision':
    case 'criterion':
    case 'example':
      return 'reasoning';
  }
}

// ---------------------------------------------------------------------------
// Per-kind detail schemas
// ---------------------------------------------------------------------------

/** Detail payload for `decision` nodes. */
interface DecisionDetail {
  readonly chosen_option: string;
  readonly rejected: readonly string[];
  readonly rationale: string;
}

/** Detail payload for `term` nodes. */
interface TermDetail {
  readonly definition: string;
  readonly aliases?: readonly string[];
}

/** Discriminated union of all per-kind detail payloads. */
export type NodeDetail = DecisionDetail | TermDetail;

// ---------------------------------------------------------------------------
// Main node interface
// ---------------------------------------------------------------------------

/**
 * A typed node in the Brunch graph.
 *
 * Immutability after acceptance:
 *  - `plane`, `kind`, `id` are immutable.
 *  - `title`, `body`, `detail`, `source` may be updated (advances `updatedAtLsn`).
 *  - To change kind: delete and recreate.
 *
 * No `status` field: accepted graph nodes are present-or-absent.
 * Stale nodes surface as `ReconciliationNeed` records.
 */
export interface GraphNode {
  readonly id: NodeId;
  readonly specId: number;
  readonly plane: NodePlane;
  readonly kind: NodeKind;
  readonly kindOrdinal: number;
  readonly title: string;
  readonly body?: string;
  readonly basis: NodeBasis;
  readonly source?: string;
  readonly detail?: NodeDetail;
  readonly createdAtLsn: Lsn;
  readonly updatedAtLsn: Lsn;
}

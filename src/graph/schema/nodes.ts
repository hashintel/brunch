/**
 * Graph node type definitions.
 *
 * Canonical reference: memory/SPEC.md D54-L (node shape), D56-L (intent kinds), D62-L (projected codes), D94-L (derived readiness bands)
 *
 * Phase 2 lock-and-materialize: type definitions only.
 * Drizzle table definitions, structural validators, and the
 * agent-facing node command surface land with subsequent slices.
 */

import type { Lsn, NodeId } from '../atoms.js';
import {
  DESIGN_KINDS,
  INTENT_KINDS,
  NODE_BASES,
  NODE_PLANES,
  ORACLE_KINDS,
  PLAN_KINDS,
  READINESS_BANDS,
} from './kinds.js';

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
 *  - elicitation: `story`, `unknown`
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

export type ReadinessBand = (typeof READINESS_BANDS)[number];

export interface NodeKindMetadata {
  readonly label: string;
}

type NodeKindMetadataByKind = {
  readonly [Kind in NodeKind]: NodeKindMetadata;
};

export const NODE_KIND_METADATA = {
  goal: { label: 'G' },
  thesis: { label: 'TH' },
  term: { label: 'T' },
  context: { label: 'CTX' },
  story: { label: 'ST' },
  unknown: { label: 'UNK' },
  requirement: { label: 'REQ' },
  assumption: { label: 'A' },
  constraint: { label: 'CON' },
  invariant: { label: 'INV' },
  decision: { label: 'D' },
  criterion: { label: 'AC' },
  example: { label: 'EX' },
  check: { label: 'CH' },
  vv_method: { label: 'VV' },
  evidence: { label: 'E' },
  vv_obligation: { label: 'O' },
  module: { label: 'MOD' },
  interface: { label: 'API' },
  entity: { label: 'ENT' },
  sketch: { label: 'SKT' },
  milestone: { label: 'M' },
  frontier: { label: 'F' },
  slice: { label: 'S' },
} as const satisfies NodeKindMetadataByKind;

const INTENT_KIND_BANDS = {
  goal: ['grounding'],
  thesis: ['grounding'],
  term: [],
  context: ['grounding', 'elicitation'],
  story: ['elicitation'],
  unknown: ['elicitation'],
  requirement: ['commitment'],
  assumption: ['elicitation'],
  constraint: ['grounding', 'elicitation'],
  invariant: ['elicitation'],
  decision: ['elicitation'],
  criterion: ['commitment'],
  example: [],
} as const satisfies Readonly<Record<IntentKind, readonly ReadinessBand[]>>;

const BAND_LESS_KINDS = new Set<NodeKind>(['example', 'sketch', 'term']);

export function bandsForKind(kind: NodeKind): readonly ReadinessBand[] {
  if (BAND_LESS_KINDS.has(kind)) return [];
  if (isIntentKind(kind)) return INTENT_KIND_BANDS[kind];
  if (isDesignKind(kind) || isOracleKind(kind)) {
    return ['projection'];
  }
  if (isPlanKind(kind)) {
    return ['commitment'];
  }

  const exhaustive: never = kind;
  return exhaustive;
}

function isIntentKind(kind: NodeKind): kind is IntentKind {
  return (INTENT_KINDS as readonly NodeKind[]).includes(kind);
}

function isOracleKind(kind: NodeKind): kind is OracleKind {
  return (ORACLE_KINDS as readonly NodeKind[]).includes(kind);
}

function isDesignKind(kind: NodeKind): kind is DesignKind {
  return (DESIGN_KINDS as readonly NodeKind[]).includes(kind);
}

function isPlanKind(kind: NodeKind): kind is PlanKind {
  return (PLAN_KINDS as readonly NodeKind[]).includes(kind);
}

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

// ---------------------------------------------------------------------------
// Per-kind detail schemas
// ---------------------------------------------------------------------------

type JsonSchema = Readonly<Record<string, unknown>>;

/** Detail payload for `decision` nodes. */
export interface DecisionDetail {
  readonly chosen_option: string;
  readonly rejected: readonly string[];
  readonly rationale: string;
}

/** Detail payload for `term` nodes. */
export interface TermDetail {
  readonly definition: string;
  readonly aliases?: readonly string[];
}

export const NODE_DETAIL_JSON_SCHEMAS = {
  decision: {
    type: 'object',
    additionalProperties: false,
    required: ['chosen_option', 'rejected', 'rationale'],
    properties: {
      chosen_option: { type: 'string', description: 'The selected option or position.' },
      rejected: {
        type: 'array',
        minItems: 1,
        items: { type: 'string' },
        description: 'Rejected alternatives considered by this decision.',
      },
      rationale: { type: 'string', description: 'Why the chosen option won.' },
    },
    description: 'Detail required for decision nodes.',
  },
  term: {
    type: 'object',
    additionalProperties: false,
    required: ['definition'],
    properties: {
      definition: { type: 'string', description: 'Canonical definition for the term.' },
      aliases: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional alternate names for the same concept.',
      },
    },
    description: 'Detail required for term nodes.',
  },
} as const satisfies Readonly<Record<string, JsonSchema>>;

export type NodeKindRequiringDetail = keyof typeof NODE_DETAIL_JSON_SCHEMAS;

export const NODE_KINDS_REQUIRING_DETAIL = Object.keys(
  NODE_DETAIL_JSON_SCHEMAS,
) as readonly NodeKindRequiringDetail[];

export function nodeDetailKnownFields(kind: NodeKindRequiringDetail): readonly string[] {
  return Object.keys(NODE_DETAIL_JSON_SCHEMAS[kind].properties);
}

// ---------------------------------------------------------------------------
// Claim-kind detail.form union (D88-L)
//
// `detail` extends to the claim kinds (requirement / criterion / invariant) and
// to `context` as a shared `form`-discriminated union. The load-bearing rule:
// `kind` drives behavior (readiness band D94-L, edge legality D51-L, the
// elicitor source-question D56-L); `form` is inert payload plus a renderer hook.
// One shared discriminant vocabulary lets a lens query all `formal`-form nodes
// across kinds to round-trip a LEAN/Dafny file.
// ---------------------------------------------------------------------------

/** Plain claim — the default, no structured method payload. */
export interface PlainFormDetail {
  readonly form: 'plain';
}

/** Gherkin Given/When/Then payload. */
export interface GherkinFormDetail {
  readonly form: 'gherkin';
  readonly given?: readonly string[];
  readonly when?: readonly string[];
  readonly then: readonly string[];
}

/** Formal verification payload (LEAN/Dafny round-trip). */
export interface FormalFormDetail {
  readonly form: 'formal';
  readonly language: string;
  readonly statement: string;
}

/** Axiom/given payload riding a `context` node (D88-L / protocol §6.6). */
export interface GivenFormDetail {
  readonly form: 'given';
  readonly statement: string;
}

export const CLAIM_FORM_JSON_SCHEMAS = {
  plain: {
    type: 'object',
    additionalProperties: false,
    required: ['form'],
    properties: {
      form: { const: 'plain', description: 'Plain claim — no structured method payload.' },
    },
    description: 'Plain claim form.',
  },
  gherkin: {
    type: 'object',
    additionalProperties: false,
    required: ['form', 'then'],
    properties: {
      form: { const: 'gherkin' },
      given: { type: 'array', items: { type: 'string' }, description: 'Given preconditions.' },
      when: { type: 'array', items: { type: 'string' }, description: 'When actions.' },
      then: {
        type: 'array',
        minItems: 1,
        items: { type: 'string' },
        description: 'Then outcomes — at least one.',
      },
    },
    description: 'Gherkin Given/When/Then payload.',
  },
  formal: {
    type: 'object',
    additionalProperties: false,
    required: ['form', 'language', 'statement'],
    properties: {
      form: { const: 'formal' },
      language: { type: 'string', description: 'Target prover/solver, e.g. lean or dafny.' },
      statement: { type: 'string', description: 'Formal statement text for round-trip.' },
    },
    description: 'Formal verification payload.',
  },
  given: {
    type: 'object',
    additionalProperties: false,
    required: ['form', 'statement'],
    properties: {
      form: { const: 'given' },
      statement: { type: 'string', description: 'Stipulated axiom/given statement.' },
    },
    description: 'Axiom/given payload on a context node.',
  },
} as const satisfies Readonly<Record<string, JsonSchema>>;

export type ClaimFormDiscriminant = keyof typeof CLAIM_FORM_JSON_SCHEMAS;

/**
 * Allowed `detail.form` discriminants per node kind. Claim kinds carry the
 * inert method-payload forms; `context` carries only `given`. Kinds absent
 * from this map prohibit `detail` (unless they require it — decision/term).
 */
export const NODE_DETAIL_FORMS = {
  requirement: ['plain', 'gherkin', 'formal'],
  criterion: ['plain', 'gherkin', 'formal'],
  invariant: ['plain', 'gherkin', 'formal'],
  context: ['given'],
} as const satisfies Partial<Record<NodeKind, readonly ClaimFormDiscriminant[]>>;

export type NodeKindWithFormDetail = keyof typeof NODE_DETAIL_FORMS;

export const NODE_KINDS_WITH_FORM_DETAIL = Object.keys(
  NODE_DETAIL_FORMS,
) as readonly NodeKindWithFormDetail[];

export function nodeDetailForms(kind: NodeKindWithFormDetail): readonly ClaimFormDiscriminant[] {
  return NODE_DETAIL_FORMS[kind];
}

export function claimFormKnownFields(form: ClaimFormDiscriminant): readonly string[] {
  return Object.keys(CLAIM_FORM_JSON_SCHEMAS[form].properties);
}

/** Form-discriminated detail legal on claim kinds. */
export type ClaimFormDetail = PlainFormDetail | GherkinFormDetail | FormalFormDetail | GivenFormDetail;

/** Discriminated union of all per-kind detail payloads. */
export type NodeDetail = DecisionDetail | TermDetail | ClaimFormDetail;

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

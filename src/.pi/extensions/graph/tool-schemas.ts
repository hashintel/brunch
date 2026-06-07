/**
 * Pi-tool-facing graph parameter schemas.
 *
 * This is the adapter-boundary schema layer for agent tools. It derives enum
 * literals from graph/index.ts, but it deliberately does not import db/ or
 * Drizzle row schemas: commit_graph accepts a product command shape, not raw
 * SQLite rows.
 */

import { StringEnum, Type, type Static } from '@earendil-works/pi-ai';

import {
  DESIGN_KINDS,
  EDGE_CATEGORIES,
  EDGE_STANCES,
  INTENT_KINDS,
  ORACLE_KINDS,
  PLAN_KINDS,
  type GraphProjection,
  type RelatedDirection,
} from '../../../graph/index.js';

const ALL_KINDS = [...INTENT_KINDS, ...ORACLE_KINDS, ...DESIGN_KINDS, ...PLAN_KINDS] as const;

export const CommitNodeSchema = Type.Object(
  {
    ref: Type.String({
      description: "Temporary batch reference id (e.g. 'n1', 'n2')",
    }),
    plane: StringEnum(['intent', 'oracle', 'design', 'plan'] as const),
    kind: StringEnum([...ALL_KINDS]),
    title: Type.String({ description: 'Node title — must be non-empty' }),
    body: Type.Optional(Type.String({ description: 'Extended description' })),
    source: Type.Optional(
      Type.String({
        description: "Epistemic attribution (e.g. 'stakeholder', 'derived')",
      }),
    ),
    detail: Type.Optional(
      Type.Unknown({
        description:
          'Per-kind detail: decision requires {chosen_option, rejected, rationale}; term requires {definition, aliases?}',
      }),
    ),
  },
  { additionalProperties: false },
);

export const EdgeRefSchema = Type.Union([
  Type.String({ description: "Intra-batch ref (e.g. 'n1')" }),
  Type.Object(
    {
      existingCode: Type.String({
        description: 'Projected code of an existing node in the selected spec, e.g. G1 or CON2',
      }),
    },
    { additionalProperties: false },
  ),
]);

export const CommitEdgeSchema = Type.Object(
  {
    category: StringEnum([...EDGE_CATEGORIES]),
    source: EdgeRefSchema,
    target: EdgeRefSchema,
    stance: Type.Optional(StringEnum([...EDGE_STANCES])),
    rationale: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export const CommitGraphParams = Type.Object(
  {
    nodes: Type.Array(CommitNodeSchema, {
      description: 'Nodes to create in this batch',
    }),
    edges: Type.Array(CommitEdgeSchema, {
      description: 'Edges to create, referencing batch refs or existing node codes',
    }),
  },
  { additionalProperties: false },
);

export const ReadGraphParams = {
  type: 'object',
  additionalProperties: false,
  required: ['mode'],
  properties: {
    mode: { enum: ['overview', 'neighborhood', 'list_by_kind', 'list_by_band', 'related', 'gaps'] },
    projection: {
      enum: ['active_context', 'graph_truth'] satisfies readonly GraphProjection[],
      description: 'Graph projection to read (default: active_context)',
    },
    nodeCode: {
      type: 'string',
      description: 'Projected code of the anchor node in the selected spec, e.g. G1 or CON2',
    },
    hops: { type: 'number', description: 'Neighborhood traversal depth (default: 1)' },
    kinds: {
      type: 'array',
      items: { type: 'string' },
      description: 'One or more node kinds for list_by_kind mode; unknown kinds produce an empty slice',
    },
    readinessBands: {
      type: 'array',
      items: { type: 'string' },
      description:
        'One or more readiness bands for list_by_band mode (grounding, elicitation, commitment); unknown bands produce an empty slice',
    },
    anchorCodes: {
      type: 'array',
      items: { type: 'string' },
      description: 'Projected codes of anchor nodes in the selected spec for related mode',
    },
    edgeCategory: {
      enum: [...EDGE_CATEGORIES],
      description: 'Edge category to follow in related mode',
    },
    direction: {
      enum: ['outgoing', 'incoming', 'both'] satisfies readonly RelatedDirection[],
      description: 'Traversal direction for related or gaps mode (default: both)',
    },
    absentEdgeCategory: {
      enum: [...EDGE_CATEGORIES],
      description: 'Edge category whose absence defines a gaps query',
    },
  },
  description:
    'Read a graph overview, selected-spec node neighborhood, projection-aware flat graph slice, related nodes, or graph gaps. Neighborhood mode requires nodeCode. List modes accept kind or readiness-band filters and return an empty slice for empty or unknown filters. Gaps mode requires a base filter (kinds and/or readinessBands) plus absentEdgeCategory.',
} as const;

export type ToolCommitNode = Static<typeof CommitNodeSchema>;
export type ToolCommitEdge = Static<typeof CommitEdgeSchema>;
export type ToolCommitGraphParams = Static<typeof CommitGraphParams>;
export type ToolReadGraphParams =
  | { readonly mode: 'overview'; readonly projection?: GraphProjection }
  | {
      readonly mode: 'neighborhood';
      readonly nodeCode: string;
      readonly hops?: number;
      readonly projection?: GraphProjection;
    }
  | {
      readonly mode: 'list_by_kind';
      readonly kinds: readonly string[];
      readonly projection?: GraphProjection;
    }
  | {
      readonly mode: 'list_by_band';
      readonly readinessBands: readonly string[];
      readonly projection?: GraphProjection;
    }
  | {
      readonly mode: 'related';
      readonly anchorCodes: readonly string[];
      readonly edgeCategory: (typeof EDGE_CATEGORIES)[number];
      readonly direction?: RelatedDirection;
      readonly hops?: number;
      readonly projection?: GraphProjection;
    }
  | {
      readonly mode: 'gaps';
      readonly kinds?: readonly string[];
      readonly readinessBands?: readonly string[];
      readonly absentEdgeCategory: (typeof EDGE_CATEGORIES)[number];
      readonly direction?: RelatedDirection;
      readonly projection?: GraphProjection;
    };

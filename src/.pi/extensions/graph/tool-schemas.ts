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

const ReadGraphOverviewParams = Type.Object(
  {
    mode: Type.Literal('overview'),
  },
  { additionalProperties: false },
);

const ReadGraphNeighborhoodParams = Type.Object(
  {
    mode: Type.Literal('neighborhood'),
    nodeCode: Type.String({
      description: 'Projected code of the anchor node in the selected spec, e.g. G1 or CON2',
    }),
    hops: Type.Optional(Type.Number({ description: 'Neighborhood traversal depth (default: 1)' })),
  },
  { additionalProperties: false },
);

export const ReadGraphParams = Type.Union([ReadGraphOverviewParams, ReadGraphNeighborhoodParams]);

export type ToolCommitNode = Static<typeof CommitNodeSchema>;
export type ToolCommitEdge = Static<typeof CommitEdgeSchema>;
export type ToolCommitGraphParams = Static<typeof CommitGraphParams>;
export type ToolReadGraphParams = Static<typeof ReadGraphParams>;

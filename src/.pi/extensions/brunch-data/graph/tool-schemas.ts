/**
 * Pi-tool-facing graph parameter schemas.
 *
 * This is the adapter-boundary schema layer for agent tools. It derives enum
 * literals from graph/index.ts, but it deliberately does not import db/ or
 * Drizzle row schemas: mutate_graph accepts a product command shape, not raw
 * SQLite rows.
 */

import { StringEnum, Type, type Static } from '@earendil-works/pi-ai';

import {
  authoredEdgeEndpointFields,
  CLAIM_FORM_JSON_SCHEMAS,
  DESIGN_KINDS,
  EDGE_CATEGORIES,
  EDGE_CATEGORY_METADATA,
  EDGE_STANCES,
  INTENT_KINDS,
  ORACLE_KINDS,
  NODE_DETAIL_FORMS,
  NODE_DETAIL_JSON_SCHEMAS,
  NODE_KINDS_REQUIRING_DETAIL,
  NODE_KINDS_WITH_FORM_DETAIL,
  PLAN_KINDS,
  READINESS_BANDS,
  type EdgeCategory,
  type EdgeDirection,
  type GraphVisibility,
  type NodeKindWithFormDetail,
  type RoleNamedEdgeDraftOf,
} from '../../../../graph/index.js';

const ALL_KINDS = [...INTENT_KINDS, ...ORACLE_KINDS, ...DESIGN_KINDS, ...PLAN_KINDS] as const;
const DETAIL_KINDS = new Set<string>(NODE_KINDS_REQUIRING_DETAIL);
const FORM_DETAIL_KINDS = new Set<string>(NODE_KINDS_WITH_FORM_DETAIL);
const KINDS_WITHOUT_DETAIL = ALL_KINDS.filter(
  (kind) => !DETAIL_KINDS.has(kind) && !FORM_DETAIL_KINDS.has(kind),
);

function claimFormDetailSchema(kind: NodeKindWithFormDetail) {
  return Type.Union(NODE_DETAIL_FORMS[kind].map((form) => Type.Unsafe(CLAIM_FORM_JSON_SCHEMAS[form])));
}

export type ToolEdgeRef = string | { readonly existingCode: string };
export type ToolMutateCreateNodeOp = {
  readonly op: 'create_node';
  readonly ref: string;
  readonly plane: 'intent' | 'oracle' | 'design' | 'plan';
  readonly kind: (typeof ALL_KINDS)[number];
  readonly title: string;
  readonly body?: string | undefined;
  readonly source?: string | undefined;
  readonly detail?: unknown;
};
export type ToolMutateCreateEdgeOp = {
  readonly op: 'create_edge';
} & RoleNamedEdgeDraftOf<ToolEdgeRef>;
export type ToolMutateGraphOp = ToolMutateCreateNodeOp | ToolMutateCreateEdgeOp;
export interface ToolMutateGraphParams {
  readonly createBasis?: 'explicit' | 'implicit' | undefined;
  readonly createSettlement?: 'advisory' | 'settled' | undefined;
  readonly ops: readonly ToolMutateGraphOp[];
}

export const MutateNodeSchema = Type.Object(
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
      Type.Union(
        [
          Type.Unsafe(NODE_DETAIL_JSON_SCHEMAS.decision),
          Type.Unsafe(NODE_DETAIL_JSON_SCHEMAS.term),
          Type.Unsafe(CLAIM_FORM_JSON_SCHEMAS.plain),
          Type.Unsafe(CLAIM_FORM_JSON_SCHEMAS.gherkin),
          Type.Unsafe(CLAIM_FORM_JSON_SCHEMAS.formal),
          Type.Unsafe(CLAIM_FORM_JSON_SCHEMAS.given),
        ],
        {
          description:
            'Per-kind detail: decision requires {chosen_option, rejected, rationale}; term requires {definition, aliases?}; requirement/criterion/invariant accept an optional {form: plain|gherkin|formal} payload; context accepts an optional {form: given} payload; omit for all other kinds.',
        },
      ),
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

function roleNamedCreateEdgeSchema(category: EdgeCategory) {
  const [sourceField, targetField] = authoredEdgeEndpointFields(category);
  return Type.Object(
    {
      op: Type.Literal('create_edge'),
      category: Type.Literal(category),
      [sourceField]: EdgeRefSchema,
      [targetField]: EdgeRefSchema,
      ...(EDGE_CATEGORY_METADATA[category].stanceRequired ? { stance: StringEnum([...EDGE_STANCES]) } : {}),
      rationale: Type.Optional(Type.String()),
    },
    { additionalProperties: false },
  );
}

const MutateCreateNodeBaseProperties = {
  op: Type.Literal('create_node'),
  ref: MutateNodeSchema.properties.ref,
  title: MutateNodeSchema.properties.title,
  body: MutateNodeSchema.properties.body,
  source: MutateNodeSchema.properties.source,
} as const;

const MutateCreateNodeOpSchema = Type.Union([
  Type.Object(
    {
      ...MutateCreateNodeBaseProperties,
      plane: Type.Literal('intent'),
      kind: Type.Literal('decision'),
      detail: Type.Unsafe(NODE_DETAIL_JSON_SCHEMAS.decision),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      ...MutateCreateNodeBaseProperties,
      plane: Type.Literal('intent'),
      kind: Type.Literal('term'),
      detail: Type.Unsafe(NODE_DETAIL_JSON_SCHEMAS.term),
    },
    { additionalProperties: false },
  ),
  ...NODE_KINDS_WITH_FORM_DETAIL.map((kind) =>
    Type.Object(
      {
        ...MutateCreateNodeBaseProperties,
        plane: Type.Literal('intent'),
        kind: Type.Literal(kind),
        detail: Type.Optional(claimFormDetailSchema(kind)),
      },
      { additionalProperties: false },
    ),
  ),
  Type.Object(
    {
      ...MutateCreateNodeBaseProperties,
      plane: MutateNodeSchema.properties.plane,
      kind: StringEnum([...KINDS_WITHOUT_DETAIL]),
    },
    { additionalProperties: false },
  ),
]);

export const MutateCreateEdgeSchema = Type.Union(
  EDGE_CATEGORIES.map((category) => roleNamedCreateEdgeSchema(category)),
);

export const MutateGraphParams = Type.Object(
  {
    createBasis: Type.Optional(
      StringEnum(['explicit', 'implicit'] as const, {
        description: 'Basis for newly created nodes and edges in this batch',
      }),
    ),
    createSettlement: Type.Optional(
      StringEnum(['advisory', 'settled'] as const, {
        description:
          'Settlement for newly created nodes and edges in this batch (default: settled). Use ' +
          '"advisory" only for reviewed, source-derived bulk-acquisition material that has not yet ' +
          'been harmonized against inner-band concerns (D99-L) — never for directly-stated user facts.',
      }),
    ),
    ops: Type.Array(Type.Union([MutateCreateNodeOpSchema, MutateCreateEdgeSchema]), {
      description:
        'Create-only graph mutation operations. Edges use role-named endpoints and may reference batch refs or existing node codes.',
    }),
  },
  { additionalProperties: false },
);

const READ_GRAPH_MODES = ['overview', 'neighborhood', 'list_by_kind', 'list_by_band', 'related'] as const;

export const ReadGraphParams = {
  type: 'object',
  additionalProperties: false,
  required: ['mode'],
  properties: {
    mode: { enum: [...READ_GRAPH_MODES] },
    show: {
      enum: ['active', 'all'] satisfies readonly GraphVisibility[],
      description: 'Graph visibility to read (default: active)',
    },
    nodeCode: {
      type: 'string',
      minLength: 1,
      description: 'neighborhood: projected code of the anchor node in the selected spec, e.g. G1 or CON2',
    },
    hops: { type: 'number', description: 'Neighborhood traversal depth (default: 1)' },
    kinds: {
      type: 'array',
      items: { type: 'string' },
      description:
        'list_by_kind: optional node-kind filter. Omit or pass [] for an unfiltered slice; unknown kinds produce an empty slice.',
    },
    readinessBands: {
      type: 'array',
      items: { enum: [...READINESS_BANDS] },
      description:
        'list_by_band: optional readiness-band filter. Omit or pass [] for an unfiltered slice; unknown bands produce an empty slice.',
    },
    anchorCodes: {
      type: 'array',
      minItems: 1,
      items: { type: 'string', minLength: 1 },
      description: 'related: one or more projected codes of anchor nodes in the selected spec',
    },
    edgeCategory: {
      enum: [...EDGE_CATEGORIES],
      description: 'related: edge category to follow',
    },
    direction: {
      enum: ['outgoing', 'incoming', 'both'] satisfies readonly EdgeDirection[],
      description: 'related: traversal direction (default: both)',
    },
  },
  oneOf: [
    { required: ['mode'], properties: { mode: { const: 'overview' } } },
    { required: ['mode', 'nodeCode'], properties: { mode: { const: 'neighborhood' } } },
    { required: ['mode'], properties: { mode: { const: 'list_by_kind' } } },
    { required: ['mode'], properties: { mode: { const: 'list_by_band' } } },
    { required: ['mode', 'anchorCodes', 'edgeCategory'], properties: { mode: { const: 'related' } } },
  ],
  description:
    'Read a graph overview, selected-spec node neighborhood, projection-aware flat graph slice, or related nodes. Mode-specific companions are enforced at the parameter schema boundary and mirrored by loud adapter diagnostics: neighborhood requires nodeCode; related requires anchorCodes plus edgeCategory. List modes intentionally treat omitted/empty filters as unfiltered slices; unknown filters produce an empty slice.',
} as const;

export type ToolMutateGraphParamsSchema = Static<typeof MutateGraphParams>;

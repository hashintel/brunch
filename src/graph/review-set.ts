import { and, eq } from 'drizzle-orm';
import * as z from 'zod';

import type { BrunchDb } from '../db/connection.js';
import * as schema from '../db/schema.js';
import type {
  CreateGraphNodeInput,
  Diagnostic,
  GraphMutationNodeRef,
  MutateGraphInput,
  StructuralIllegal,
} from './command-executor/graph-mutation-types.js';
import {
  roleNamedEdgeDraftEndpoints,
  type RoleNamedEdgeDraftOf,
} from './command-executor/role-named-edge-draft.js';
import { EDGE_CATEGORY_METADATA } from './policy/category-policy.js';
import { EDGE_CATEGORIES, EDGE_STANCES, NODE_KINDS, NODE_PLANES } from './schema/kinds.js';
import type { NodeKind, NodePlane } from './schema/nodes.js';
import { formatGraphNodeCode, parseGraphNodeCode } from './schema/nodes.js';

type ReviewSetLens = 'intent' | 'design' | 'oracle' | 'plan';
type ReviewSetEpistemicStatus = 'inferred' | 'assumed' | 'asserted' | 'observed';

interface ReviewSetProposalGrounding {
  readonly summary: string;
  readonly support: readonly string[];
}

interface ReviewSetProposalPitch {
  readonly title: string;
  readonly narrative: string;
}

interface ReviewSetEntityDraft {
  readonly draftId: string;
  readonly plane: NodePlane;
  readonly kind: string;
  readonly proposedCode: string;
  readonly title: string;
  readonly body?: string | undefined;
  readonly detail?: unknown;
}

type ReviewSetEndpointRef = { readonly draftId: string } | { readonly existingCode: string };

type ReviewSetEdgeDraft = RoleNamedEdgeDraftOf<ReviewSetEndpointRef>;

export interface ReviewSetProposalPayload {
  readonly schemaVersion: 1;
  readonly lens: ReviewSetLens;
  readonly epistemicStatus: ReviewSetEpistemicStatus;
  readonly grounding: ReviewSetProposalGrounding;
  readonly pitch: ReviewSetProposalPitch;
  readonly entityDrafts: readonly ReviewSetEntityDraft[];
  readonly edgeDrafts: readonly ReviewSetEdgeDraft[];
  readonly proposalVersion?: number | undefined;
  readonly supersedes?: string | undefined;
}

interface ReviewSetTranslationSuccess {
  readonly status: 'success';
  readonly payload: ReviewSetProposalPayload;
  readonly command: MutateGraphInput;
}

export type ReviewSetTranslationResult = ReviewSetTranslationSuccess | StructuralIllegal;

const VALID_LENSES = ['intent', 'design', 'oracle', 'plan'] as const;
const VALID_EPISTEMIC_STATUSES = ['inferred', 'assumed', 'asserted', 'observed'] as const;
const VALID_PLANES = NODE_PLANES;
const VALID_NODE_KINDS = NODE_KINDS as unknown as readonly string[];
const VALID_CATEGORIES = EDGE_CATEGORIES as unknown as readonly string[];
const VALID_STANCES = EDGE_STANCES as unknown as readonly string[];

const zReviewSetEndpointRefForBoundary = z
  .union([
    z.object({ draftId: z.string().min(1).describe('Review-set-local draft id.') }).strict(),
    z
      .object({ existingCode: z.string().min(1).describe('Projected graph node code from read_graph.') })
      .strict(),
  ])
  .describe('Endpoint reference: exactly one of draftId or existingCode.');

const zReviewSetEdgeDraftForBoundary = z
  .union([
    z
      .object({
        category: z.literal('dependency'),
        dependency: zReviewSetEndpointRefForBoundary,
        dependent: zReviewSetEndpointRefForBoundary,
        rationale: z.string().optional(),
      })
      .strict(),
    z
      .object({
        category: z.literal('witness'),
        oracle: zReviewSetEndpointRefForBoundary,
        claim: zReviewSetEndpointRefForBoundary,
        stance: z.enum(['for', 'against']),
        rationale: z.string().optional(),
      })
      .strict(),
    z
      .object({
        category: z.literal('rationale'),
        support: zReviewSetEndpointRefForBoundary,
        claim: zReviewSetEndpointRefForBoundary,
        stance: z.enum(['for', 'against']),
        rationale: z.string().optional(),
      })
      .strict(),
    z
      .object({
        category: z.literal('realization'),
        abstract: zReviewSetEndpointRefForBoundary,
        concrete: zReviewSetEndpointRefForBoundary,
        rationale: z.string().optional(),
      })
      .strict(),
    z
      .object({
        category: z.literal('refinement'),
        abstract: zReviewSetEndpointRefForBoundary,
        concrete: zReviewSetEndpointRefForBoundary,
        rationale: z.string().optional(),
      })
      .strict(),
    z
      .object({
        category: z.literal('exclusion'),
        boundary: zReviewSetEndpointRefForBoundary,
        subject: zReviewSetEndpointRefForBoundary,
        rationale: z.string().optional(),
      })
      .strict(),
    z
      .object({
        category: z.literal('composition'),
        whole: zReviewSetEndpointRefForBoundary,
        part: zReviewSetEndpointRefForBoundary,
        rationale: z.string().optional(),
      })
      .strict(),
    z
      .object({
        category: z.literal('cross_reference'),
        a: zReviewSetEndpointRefForBoundary,
        b: zReviewSetEndpointRefForBoundary,
        rationale: z.string().optional(),
      })
      .strict(),
    z
      .object({
        category: z.literal('supersession'),
        successor: zReviewSetEndpointRefForBoundary,
        predecessor: zReviewSetEndpointRefForBoundary,
        rationale: z.string().optional(),
      })
      .strict(),
  ])
  .describe('Role-named edge draft; companion endpoint fields are determined by category.');

/**
 * Agent-facing review-set payload shape for boundary teaching.
 *
 * `validateReviewSetPayloadShape` below remains the loud diagnostic authority:
 * this schema is intentionally permissive on requiredness so malformed proposals
 * can still return field-level STRUCTURAL_ILLEGAL diagnostics from the graph
 * validator after the tool boundary has taught the nested companion shape.
 */
export const zReviewSetProposalPayloadForBoundary = z
  .looseObject({
    schemaVersion: z.literal(1),
    lens: z.enum(VALID_LENSES).optional(),
    epistemicStatus: z.enum(VALID_EPISTEMIC_STATUSES).optional(),
    grounding: z
      .object({
        summary: z.string().min(1).describe('Short grounding summary for the proposal.'),
        support: z.array(z.string().min(1)).min(1).describe('Concrete support/evidence strings.'),
      })
      .strict()
      .optional(),
    pitch: z
      .object({
        title: z.string().min(1).describe('Review-set title.'),
        narrative: z.string().min(1).describe('Why this batch should be reviewed together.'),
      })
      .strict()
      .optional(),
    entityDrafts: z
      .array(
        z
          .object({
            draftId: z.string().min(1),
            plane: z.enum(NODE_PLANES),
            kind: z.string().min(1),
            proposedCode: z.string().min(1).optional(),
            title: z.string().min(1),
            body: z.string().optional(),
            detail: z.unknown().optional(),
          })
          .strict(),
      )
      .min(1)
      .optional(),
    edgeDrafts: z.array(zReviewSetEdgeDraftForBoundary).optional(),
    proposalVersion: z.number().int().positive().optional(),
    supersedes: z.string().min(1).optional(),
  })
  .describe(
    'Review-set proposal payload. Required by the graph validator: schemaVersion, lens, epistemicStatus, grounding {summary, support[]}, pitch {title, narrative}, entityDrafts[], edgeDrafts[].',
  );

export function translateReviewSetPayloadToMutateGraph(options: {
  readonly db: Pick<BrunchDb, 'select'>;
  readonly specId: number;
  readonly payload: unknown;
}): ReviewSetTranslationResult {
  const diagnostics = validateReviewSetPayloadShape(options.payload);
  if (diagnostics.length > 0) return { status: 'structural_illegal', diagnostics };

  const payload = options.payload as ReviewSetProposalPayload;
  const ops: Array<MutateGraphInput['ops'][number]> = payload.entityDrafts.map((draft) => ({
    op: 'create_node',
    ...toCreateGraphNodeInput(draft),
  }));
  for (let index = 0; index < payload.edgeDrafts.length; index++) {
    const edge = payload.edgeDrafts[index]!;
    const { source: sourceRef, target: targetRef } = roleNamedEdgeDraftEndpoints(edge);
    const source = resolveReviewSetEndpoint(
      options.db,
      options.specId,
      sourceRef,
      endpointFieldPath(edge, index, 'source'),
    );
    const target = resolveReviewSetEndpoint(
      options.db,
      options.specId,
      targetRef,
      endpointFieldPath(edge, index, 'target'),
    );
    if (source.status === 'structural_illegal') diagnostics.push(...source.diagnostics);
    if (target.status === 'structural_illegal') diagnostics.push(...target.diagnostics);
    if (source.status === 'success' && target.status === 'success') {
      ops.push({
        op: 'create_edge',
        ...replaceRoleNamedEndpoints(edge, source.ref, target.ref),
      });
    }
  }

  if (diagnostics.length > 0) return { status: 'structural_illegal', diagnostics };

  return {
    status: 'success',
    payload,
    command: {
      specId: options.specId,
      createBasis: 'explicit',
      ops,
    },
  };
}

export function assignProposedReviewSetCodes(options: {
  readonly db: Pick<BrunchDb, 'select'>;
  readonly specId: number;
  readonly payload: unknown;
}): ReviewSetProposalPayload | StructuralIllegal {
  const diagnostics = validateReviewSetPayloadShape(options.payload, { requireProposedCode: false });
  if (diagnostics.length > 0) return { status: 'structural_illegal', diagnostics };

  const payload = options.payload as Omit<ReviewSetProposalPayload, 'entityDrafts'> & {
    readonly entityDrafts: readonly Omit<ReviewSetEntityDraft, 'proposedCode'>[];
  };
  const proposed = proposeCodesForDrafts(options.db, options.specId, payload.entityDrafts);
  if (proposed.status === 'structural_illegal') return proposed;

  return {
    ...payload,
    entityDrafts: payload.entityDrafts.map((draft, index) => ({
      ...draft,
      proposedCode: proposed.codes[index]!,
    })),
  };
}

export function proposedReviewSetCodeDiagnostics(options: {
  readonly db: Pick<BrunchDb, 'select'>;
  readonly specId: number;
  readonly payload: ReviewSetProposalPayload;
}): Diagnostic[] {
  const proposed = proposeCodesForDrafts(options.db, options.specId, options.payload.entityDrafts);
  if (proposed.status === 'structural_illegal') return [...proposed.diagnostics];
  return options.payload.entityDrafts.flatMap((draft, index) =>
    draft.proposedCode === proposed.codes[index]
      ? []
      : [
          {
            field: `entityDrafts[${index}].proposedCode`,
            message: `proposed code "${draft.proposedCode}" is stale; expected "${proposed.codes[index]}"`,
          },
        ],
  );
}

function toCreateGraphNodeInput(draft: ReviewSetEntityDraft): CreateGraphNodeInput {
  return {
    ref: draft.draftId,
    plane: draft.plane,
    kind: draft.kind,
    title: draft.title,
    ...(draft.body !== undefined ? { body: draft.body } : {}),
    ...(draft.detail !== undefined ? { detail: draft.detail } : {}),
  };
}

function validateReviewSetPayloadShape(
  value: unknown,
  options: { readonly requireProposedCode: boolean } = { requireProposedCode: true },
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  if (!isRecord(value)) return [{ field: 'payload', message: 'review-set payload must be an object' }];

  if ('basis' in value)
    diagnostics.push({ field: 'basis', message: 'review-set payload basis is always explicit' });
  if (value.schemaVersion !== 1)
    diagnostics.push({ field: 'schemaVersion', message: 'schemaVersion must be 1' });
  if (!isOneOf(value.lens, VALID_LENSES)) {
    diagnostics.push({ field: 'lens', message: 'lens must be intent, design, oracle, or plan' });
  }
  if (!isOneOf(value.epistemicStatus, VALID_EPISTEMIC_STATUSES)) {
    diagnostics.push({ field: 'epistemicStatus', message: 'epistemicStatus is required' });
  }

  validateGrounding(value.grounding, diagnostics);
  validatePitch(value.pitch, diagnostics);
  validateEntityDrafts(value.entityDrafts, diagnostics, options);
  validateEdgeDrafts(value.edgeDrafts, diagnostics);
  return diagnostics;
}

function validateGrounding(value: unknown, diagnostics: Diagnostic[]): void {
  if (!isRecord(value)) {
    diagnostics.push({ field: 'grounding', message: 'grounding is required' });
    return;
  }
  if (typeof value.summary !== 'string' || value.summary.trim().length === 0) {
    diagnostics.push({ field: 'grounding.summary', message: 'summary must be non-empty' });
  }
  if (!isNonEmptyStringArray(value.support)) {
    diagnostics.push({ field: 'grounding.support', message: 'support must be a non-empty string array' });
  }
}

function validatePitch(value: unknown, diagnostics: Diagnostic[]): void {
  if (!isRecord(value)) {
    diagnostics.push({ field: 'pitch', message: 'pitch is required' });
    return;
  }
  if (typeof value.title !== 'string' || value.title.trim().length === 0) {
    diagnostics.push({ field: 'pitch.title', message: 'title must be non-empty' });
  }
  if (typeof value.narrative !== 'string' || value.narrative.trim().length === 0) {
    diagnostics.push({ field: 'pitch.narrative', message: 'narrative must be non-empty' });
  }
}

function validateEntityDrafts(
  value: unknown,
  diagnostics: Diagnostic[],
  options: { readonly requireProposedCode: boolean },
): void {
  if (!Array.isArray(value) || value.length === 0) {
    diagnostics.push({ field: 'entityDrafts', message: 'entityDrafts must be non-empty' });
    return;
  }

  const seen = new Set<string>();
  value.forEach((draft, index) => {
    const path = `entityDrafts[${index}]`;
    if (!isRecord(draft)) {
      diagnostics.push({ field: path, message: 'entity draft must be an object' });
      return;
    }
    if ('basis' in draft)
      diagnostics.push({ field: `${path}.basis`, message: 'per-item basis is not accepted' });
    if (typeof draft.draftId !== 'string' || draft.draftId.trim().length === 0) {
      diagnostics.push({ field: `${path}.draftId`, message: 'draftId must be non-empty' });
    } else if (seen.has(draft.draftId)) {
      diagnostics.push({ field: `${path}.draftId`, message: `duplicate draftId "${draft.draftId}"` });
    } else {
      seen.add(draft.draftId);
    }
    if (!isOneOf(draft.plane, VALID_PLANES))
      diagnostics.push({ field: `${path}.plane`, message: 'invalid plane' });
    if (typeof draft.kind !== 'string' || draft.kind.trim().length === 0) {
      diagnostics.push({ field: `${path}.kind`, message: 'kind must be non-empty' });
    }
    if (options.requireProposedCode) {
      if (typeof draft.proposedCode !== 'string' || draft.proposedCode.trim().length === 0) {
        diagnostics.push({ field: `${path}.proposedCode`, message: 'proposedCode must be non-empty' });
      }
    } else if (
      draft.proposedCode !== undefined &&
      (typeof draft.proposedCode !== 'string' || draft.proposedCode.trim().length === 0)
    ) {
      diagnostics.push({
        field: `${path}.proposedCode`,
        message: 'proposedCode must be non-empty when present',
      });
    }
    if (typeof draft.title !== 'string' || draft.title.trim().length === 0) {
      diagnostics.push({ field: `${path}.title`, message: 'title must be non-empty' });
    }
  });
}

function proposeCodesForDrafts(
  db: Pick<BrunchDb, 'select'>,
  specId: number,
  drafts: readonly Pick<ReviewSetEntityDraft, 'kind' | 'plane'>[],
): { readonly status: 'success'; readonly codes: readonly string[] } | StructuralIllegal {
  const diagnostics: Diagnostic[] = [];
  const nextOrdinals = new Map<string, number>();
  const codes = drafts.map((draft, index) => {
    if (!VALID_NODE_KINDS.includes(draft.kind)) {
      diagnostics.push({ field: `entityDrafts[${index}].kind`, message: 'invalid node kind' });
      return '';
    }
    const kind = draft.kind as NodeKind;
    const key = `${draft.plane}\u0000${kind}`;
    const nextOrdinal = nextOrdinals.get(key) ?? readNextNodeKindOrdinal(db, specId, draft.plane, kind);
    nextOrdinals.set(key, nextOrdinal + 1);
    return formatGraphNodeCode(kind, nextOrdinal);
  });
  return diagnostics.length > 0
    ? { status: 'structural_illegal', diagnostics }
    : { status: 'success', codes };
}

function readNextNodeKindOrdinal(
  db: Pick<BrunchDb, 'select'>,
  specId: number,
  plane: NodePlane,
  kind: NodeKind,
): number {
  return (
    db
      .select({ nextOrdinal: schema.nodeKindCounters.next_ordinal })
      .from(schema.nodeKindCounters)
      .where(
        and(
          eq(schema.nodeKindCounters.spec_id, specId),
          eq(schema.nodeKindCounters.plane, plane),
          eq(schema.nodeKindCounters.kind, kind),
        ),
      )
      .get()?.nextOrdinal ?? 1
  );
}

function validateEdgeDrafts(value: unknown, diagnostics: Diagnostic[]): void {
  if (!Array.isArray(value) || value.length === 0) {
    diagnostics.push({ field: 'edgeDrafts', message: 'edgeDrafts must be non-empty' });
    return;
  }

  value.forEach((draft, index) => {
    const path = `edgeDrafts[${index}]`;
    if (!isRecord(draft)) {
      diagnostics.push({ field: path, message: 'edge draft must be an object' });
      return;
    }
    if ('relation' in draft)
      diagnostics.push({ field: `${path}.relation`, message: 'relation is retired; use category' });
    if ('basis' in draft)
      diagnostics.push({ field: `${path}.basis`, message: 'per-item basis is not accepted' });
    if ('sourceDraftId' in draft) {
      diagnostics.push({
        field: `${path}.sourceDraftId`,
        message: 'sourceDraftId is retired; use source.draftId',
      });
    }
    if ('targetDraftId' in draft) {
      diagnostics.push({
        field: `${path}.targetDraftId`,
        message: 'targetDraftId is retired; use target.draftId',
      });
    }
    if ('source' in draft) {
      diagnostics.push({ field: `${path}.source`, message: 'source is retired; use role-named endpoints' });
    }
    if ('target' in draft) {
      diagnostics.push({ field: `${path}.target`, message: 'target is retired; use role-named endpoints' });
    }
    if (!isOneOf(draft.category, VALID_CATEGORIES))
      diagnostics.push({ field: `${path}.category`, message: 'invalid edge category' });
    if (draft.stance !== undefined && !isOneOf(draft.stance, VALID_STANCES)) {
      diagnostics.push({ field: `${path}.stance`, message: 'invalid stance' });
    }

    if (!isOneOf(draft.category, VALID_CATEGORIES)) {
      return;
    }

    validateRoleNamedReviewSetEdgeDraft(draft as ReviewSetEdgeDraft, index, diagnostics);
  });
}

function validateRoleNamedReviewSetEdgeDraft(
  draft: ReviewSetEdgeDraft,
  index: number,
  diagnostics: Diagnostic[],
): void {
  const path = `edgeDrafts[${index}]`;
  const stanceRequired = EDGE_CATEGORY_METADATA[draft.category].stanceRequired;
  if (stanceRequired && (!('stance' in draft) || draft.stance === undefined)) {
    diagnostics.push({ field: `${path}.stance`, message: 'stance is required for witness/rationale edges' });
  }
  if (!stanceRequired && 'stance' in draft && draft.stance !== undefined) {
    diagnostics.push({
      field: `${path}.stance`,
      message: 'stance is allowed only on witness/rationale edges',
    });
  }

  const sourceField = endpointFieldPath(draft, index, 'source');
  const targetField = endpointFieldPath(draft, index, 'target');
  const { source, target } = roleNamedEdgeDraftEndpoints(draft);
  validateEndpointShape(source, sourceField, diagnostics);
  validateEndpointShape(target, targetField, diagnostics);
}

function endpointFieldPath(draft: ReviewSetEdgeDraft, index: number, position: 'source' | 'target'): string {
  const path = `edgeDrafts[${index}]`;
  if (draft.category === 'cross_reference') {
    return `${path}.${position === 'source' ? 'a' : 'b'}`;
  }

  const metadata = EDGE_CATEGORY_METADATA[draft.category as keyof typeof EDGE_CATEGORY_METADATA];
  return `${path}.${position === 'source' ? metadata.sourceRole : metadata.targetRole}`;
}
function replaceRoleNamedEndpoints(
  draft: ReviewSetEdgeDraft,
  source: GraphMutationNodeRef,
  target: GraphMutationNodeRef,
): RoleNamedEdgeDraftOf<GraphMutationNodeRef> {
  switch (draft.category) {
    case 'dependency':
      return { ...draft, dependency: source, dependent: target };
    case 'witness':
      return { ...draft, oracle: source, claim: target };
    case 'rationale':
      return { ...draft, support: source, claim: target };
    case 'realization':
      return { ...draft, abstract: source, concrete: target };
    case 'refinement':
      return { ...draft, abstract: source, concrete: target };
    case 'exclusion':
      return { ...draft, boundary: source, subject: target };
    case 'composition':
      return { ...draft, whole: source, part: target };
    case 'cross_reference':
      return { ...draft, a: source, b: target };
    case 'supersession':
      return { ...draft, successor: source, predecessor: target };
  }
}

function validateEndpointShape(value: unknown, path: string, diagnostics: Diagnostic[]): void {
  if (!isRecord(value)) {
    diagnostics.push({ field: path, message: 'endpoint must be an object' });
    return;
  }
  if ('existing' in value)
    diagnostics.push({ field: `${path}.existing`, message: 'raw existing DB ids are not accepted' });
  const hasDraft = 'draftId' in value;
  const hasCode = 'existingCode' in value;
  if (hasDraft === hasCode) {
    diagnostics.push({ field: path, message: 'endpoint must have exactly one of draftId or existingCode' });
    return;
  }
  if (hasDraft && (typeof value.draftId !== 'string' || value.draftId.trim().length === 0)) {
    diagnostics.push({ field: `${path}.draftId`, message: 'draftId must be non-empty' });
  }
  if (hasCode && (typeof value.existingCode !== 'string' || value.existingCode.trim().length === 0)) {
    diagnostics.push({ field: `${path}.existingCode`, message: 'existingCode must be non-empty' });
  }
}

function resolveReviewSetEndpoint(
  db: Pick<BrunchDb, 'select'>,
  specId: number,
  endpoint: ReviewSetEndpointRef,
  path: string,
): { readonly status: 'success'; readonly ref: GraphMutationNodeRef } | StructuralIllegal {
  if ('draftId' in endpoint) return { status: 'success', ref: endpoint.draftId };

  const parsed = parseGraphNodeCode(endpoint.existingCode);
  if (!parsed) {
    return {
      status: 'structural_illegal',
      diagnostics: [
        { field: `${path}.existingCode`, message: `unrecognized graph node code "${endpoint.existingCode}"` },
      ],
    };
  }

  const row = db
    .select({ id: schema.nodes.id })
    .from(schema.nodes)
    .where(
      and(
        eq(schema.nodes.spec_id, specId),
        eq(schema.nodes.kind, parsed.kind),
        eq(schema.nodes.kind_ordinal, parsed.kindOrdinal),
      ),
    )
    .get();
  if (!row) {
    return {
      status: 'structural_illegal',
      diagnostics: [
        {
          field: `${path}.existingCode`,
          message: `graph node code "${endpoint.existingCode}" not found in selected spec ${specId}`,
        },
      ],
    };
  }

  return { status: 'success', ref: { existing: row.id } };
}

function isNonEmptyStringArray(value: unknown): value is readonly string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === 'string' && item.trim().length > 0)
  );
}

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && allowed.includes(value as T);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

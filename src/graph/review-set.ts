import { and, eq } from 'drizzle-orm';

import type { BrunchDb } from '../db/connection.js';
import * as schema from '../db/schema.js';
import type {
  BatchEdgeInput,
  BatchEdgeRef,
  BatchNodeInput,
  CommitGraphInput,
  Diagnostic,
  StructuralIllegal,
} from './command-executor.js';
import type { NodePlane } from './schema/nodes.js';
import { parseGraphNodeCode } from './schema/nodes.js';

 type ReviewSetLens = 'intent' | 'design' | 'oracle';
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
  readonly title: string;
  readonly body?: string | undefined;
  readonly detail?: unknown;
}

 type ReviewSetEndpointRef = { readonly draftId: string } | { readonly existingCode: string };

 interface ReviewSetEdgeDraft {
  readonly category: string;
  readonly source: ReviewSetEndpointRef;
  readonly target: ReviewSetEndpointRef;
  readonly stance?: string | undefined;
  readonly rationale?: string | undefined;
}

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
  readonly command: CommitGraphInput;
}

export type ReviewSetTranslationResult = ReviewSetTranslationSuccess | StructuralIllegal;

const VALID_LENSES = ['intent', 'design', 'oracle'] as const;
const VALID_EPISTEMIC_STATUSES = ['inferred', 'assumed', 'asserted', 'observed'] as const;
const VALID_PLANES = ['intent', 'oracle', 'design', 'plan'] as const;
const VALID_CATEGORIES = schema.EDGE_CATEGORIES as unknown as readonly string[];
const VALID_STANCES = schema.EDGE_STANCES as unknown as readonly string[];

export function translateReviewSetPayloadToCommitGraph(options: {
  readonly db: Pick<BrunchDb, 'select'>;
  readonly specId: number;
  readonly payload: unknown;
}): ReviewSetTranslationResult {
  const diagnostics = validateReviewSetPayloadShape(options.payload);
  if (diagnostics.length > 0) return { status: 'structural_illegal', diagnostics };

  const payload = options.payload as ReviewSetProposalPayload;
  const edges: BatchEdgeInput[] = [];
  for (let index = 0; index < payload.edgeDrafts.length; index++) {
    const edge = payload.edgeDrafts[index]!;
    const source = resolveReviewSetEndpoint(
      options.db,
      options.specId,
      edge.source,
      `edgeDrafts[${index}].source`,
    );
    const target = resolveReviewSetEndpoint(
      options.db,
      options.specId,
      edge.target,
      `edgeDrafts[${index}].target`,
    );
    if (source.status === 'structural_illegal') diagnostics.push(...source.diagnostics);
    if (target.status === 'structural_illegal') diagnostics.push(...target.diagnostics);
    if (source.status === 'success' && target.status === 'success') {
      edges.push({
        category: edge.category,
        source: source.ref,
        target: target.ref,
        ...(edge.stance !== undefined ? { stance: edge.stance } : {}),
        ...(edge.rationale !== undefined ? { rationale: edge.rationale } : {}),
      });
    }
  }

  if (diagnostics.length > 0) return { status: 'structural_illegal', diagnostics };

  return {
    status: 'success',
    payload,
    command: {
      specId: options.specId,
      basis: 'explicit',
      nodes: payload.entityDrafts.map(toBatchNodeInput),
      edges,
    },
  };
}

function toBatchNodeInput(draft: ReviewSetEntityDraft): BatchNodeInput {
  return {
    ref: draft.draftId,
    plane: draft.plane,
    kind: draft.kind,
    title: draft.title,
    ...(draft.body !== undefined ? { body: draft.body } : {}),
    ...(draft.detail !== undefined ? { detail: draft.detail } : {}),
  };
}

function validateReviewSetPayloadShape(value: unknown): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  if (!isRecord(value)) return [{ field: 'payload', message: 'review-set payload must be an object' }];

  if ('basis' in value)
    diagnostics.push({ field: 'basis', message: 'review-set payload basis is always explicit' });
  if (value.schemaVersion !== 1)
    diagnostics.push({ field: 'schemaVersion', message: 'schemaVersion must be 1' });
  if (!isOneOf(value.lens, VALID_LENSES)) {
    diagnostics.push({ field: 'lens', message: 'lens must be intent, design, or oracle' });
  }
  if (!isOneOf(value.epistemicStatus, VALID_EPISTEMIC_STATUSES)) {
    diagnostics.push({ field: 'epistemicStatus', message: 'epistemicStatus is required' });
  }

  validateGrounding(value.grounding, diagnostics);
  validatePitch(value.pitch, diagnostics);
  validateEntityDrafts(value.entityDrafts, diagnostics);
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

function validateEntityDrafts(value: unknown, diagnostics: Diagnostic[]): void {
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
    if (typeof draft.title !== 'string' || draft.title.trim().length === 0) {
      diagnostics.push({ field: `${path}.title`, message: 'title must be non-empty' });
    }
  });
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
    if (!isOneOf(draft.category, VALID_CATEGORIES))
      diagnostics.push({ field: `${path}.category`, message: 'invalid edge category' });
    if (draft.stance !== undefined && !isOneOf(draft.stance, VALID_STANCES)) {
      diagnostics.push({ field: `${path}.stance`, message: 'invalid stance' });
    }
    validateEndpointShape(draft.source, `${path}.source`, diagnostics);
    validateEndpointShape(draft.target, `${path}.target`, diagnostics);
  });
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
): { readonly status: 'success'; readonly ref: BatchEdgeRef } | StructuralIllegal {
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

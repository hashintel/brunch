import {
  EDGE_CATEGORIES,
  EDGE_STANCES,
  type BatchEdgeInput,
  type BatchNodeInput,
  type CommandExecutor,
  type CommitGraphInput,
  type CommitGraphDryRunResult,
  type Diagnostic,
  type NodePlane,
  type StructuralIllegal,
} from '../../../graph/index.js';

export type ReviewSetLens = 'intent' | 'design' | 'oracle';
export type EpistemicStatus = 'inferred' | 'assumed' | 'asserted' | 'observed';

export interface ReviewSetProposalGrounding {
  readonly summary: string;
  readonly support: readonly string[];
}

export interface ReviewSetProposalPitch {
  readonly title: string;
  readonly narrative: string;
}

export interface ReviewSetEntityDraft {
  readonly draftId: string;
  readonly plane: NodePlane;
  readonly kind: string;
  readonly title: string;
  readonly body?: string;
  readonly detail?: unknown;
}

export interface ReviewSetEdgeDraft {
  readonly category: string;
  readonly sourceDraftId: string;
  readonly targetDraftId: string;
  readonly stance?: string;
  readonly rationale?: string;
}

export interface ReviewSetProposalDraft {
  readonly schemaVersion: 1;
  readonly lens: ReviewSetLens;
  readonly epistemicStatus: EpistemicStatus;
  readonly grounding: ReviewSetProposalGrounding;
  readonly pitch: ReviewSetProposalPitch;
  readonly entityDrafts: readonly ReviewSetEntityDraft[];
  readonly edgeDrafts: readonly ReviewSetEdgeDraft[];
  readonly proposalVersion?: number;
  readonly supersedes?: string;
}

export interface ReviewSetProposalPayload extends ReviewSetProposalDraft {
  readonly validation: CommitGraphDryRunResult;
}

export interface ReviewSetProposalValidationSuccess {
  readonly status: 'success';
  readonly proposal: ReviewSetProposalPayload;
}

export type ReviewSetProposalValidationResult = ReviewSetProposalValidationSuccess | StructuralIllegal;

const VALID_LENSES = ['intent', 'design', 'oracle'] as const;
const VALID_EPISTEMIC_STATUSES = ['inferred', 'assumed', 'asserted', 'observed'] as const;
const VALID_PLANES = ['intent', 'oracle', 'design', 'plan'] as const;

export function translateReviewSetProposalToCommitGraph(proposal: ReviewSetProposalDraft): CommitGraphInput {
  return {
    nodes: proposal.entityDrafts.map(
      (draft): BatchNodeInput => ({
        ref: draft.draftId,
        plane: draft.plane,
        kind: draft.kind,
        title: draft.title,
        ...(draft.body !== undefined ? { body: draft.body } : {}),
        basis: 'accepted_review_set',
        ...(draft.detail !== undefined ? { detail: draft.detail } : {}),
      }),
    ),
    edges: proposal.edgeDrafts.map(
      (draft): BatchEdgeInput => ({
        category: draft.category,
        source: draft.sourceDraftId,
        target: draft.targetDraftId,
        basis: 'accepted_review_set',
        ...(draft.stance !== undefined ? { stance: draft.stance } : {}),
        ...(draft.rationale !== undefined ? { rationale: draft.rationale } : {}),
      }),
    ),
  };
}

export function validateReviewSetProposalPayload(options: {
  readonly proposal: ReviewSetProposalDraft;
  readonly commandExecutor: CommandExecutor;
}): ReviewSetProposalValidationResult {
  const diagnostics = validateReviewSetProposalDraft(options.proposal);
  if (diagnostics.length > 0) {
    return { status: 'structural_illegal', diagnostics };
  }

  const validation = options.commandExecutor.dryRunCommitGraph(
    translateReviewSetProposalToCommitGraph(options.proposal),
  );
  if (validation.status !== 'success') {
    return validation;
  }

  return {
    status: 'success',
    proposal: {
      ...options.proposal,
      validation,
    },
  };
}

function validateReviewSetProposalDraft(value: ReviewSetProposalDraft): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const candidate = value as unknown;
  if (!isRecord(candidate)) {
    return [{ field: 'proposal', message: 'proposal must be an object' }];
  }

  if (candidate.schemaVersion !== 1) {
    diagnostics.push({ field: 'schemaVersion', message: 'schemaVersion must be 1' });
  }
  if (!isOneOf(candidate.lens, VALID_LENSES)) {
    diagnostics.push({ field: 'lens', message: 'lens must be intent, design, or oracle' });
  }
  if (!isOneOf(candidate.epistemicStatus, VALID_EPISTEMIC_STATUSES)) {
    diagnostics.push({ field: 'epistemicStatus', message: 'epistemicStatus is required' });
  }

  validateGrounding(candidate.grounding, diagnostics);
  validatePitch(candidate.pitch, diagnostics);
  validateEntityDrafts(candidate.entityDrafts, diagnostics);
  validateEdgeDrafts(candidate.edgeDrafts, diagnostics);
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
    if (typeof draft.draftId !== 'string' || draft.draftId.trim().length === 0) {
      diagnostics.push({ field: `${path}.draftId`, message: 'draftId must be non-empty' });
    } else if (seen.has(draft.draftId)) {
      diagnostics.push({ field: `${path}.draftId`, message: `duplicate draftId "${draft.draftId}"` });
    } else {
      seen.add(draft.draftId);
    }
    if (!isOneOf(draft.plane, VALID_PLANES)) {
      diagnostics.push({ field: `${path}.plane`, message: 'invalid plane' });
    }
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
    if ('relation' in draft) {
      diagnostics.push({ field: `${path}.relation`, message: 'relation is retired; use category' });
    }
    if (!isOneOf(draft.category, EDGE_CATEGORIES)) {
      diagnostics.push({ field: `${path}.category`, message: 'invalid edge category' });
    }
    if (draft.stance !== undefined && !isOneOf(draft.stance, EDGE_STANCES)) {
      diagnostics.push({ field: `${path}.stance`, message: 'invalid stance' });
    }
    if (typeof draft.sourceDraftId !== 'string' || draft.sourceDraftId.trim().length === 0) {
      diagnostics.push({ field: `${path}.sourceDraftId`, message: 'sourceDraftId must be non-empty' });
    }
    if (typeof draft.targetDraftId !== 'string' || draft.targetDraftId.trim().length === 0) {
      diagnostics.push({ field: `${path}.targetDraftId`, message: 'targetDraftId must be non-empty' });
    }
  });
}

function isNonEmptyStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'string');
}

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && allowed.includes(value as T);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

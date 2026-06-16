/**
 * CommandExecutor structural validation — pure input/patch validators and the
 * type guards and kind tables they depend on.
 *
 * All validators return `Diagnostic[]` (empty = valid); they never touch the db
 * or throw. Only the entry points consumed by `../command-executor.ts` are
 * exported; the predicate/detail helpers and guards stay module-private.
 */

import * as schema from '../../db/schema.js';
import {
  gapPredicateSupport,
  type ElicitationGapLensAffinity,
  type GapDisposition,
  type GapPredicate,
} from '../schema/elicitation-gaps.js';
import {
  DESIGN_KINDS,
  INTENT_KINDS,
  GAP_DISPOSITIONS,
  GAP_PREDICATE_KINDS,
  LENS_AFFINITIES,
  NODE_BASES,
  ORACLE_KINDS,
  PLAN_KINDS,
  READINESS_BANDS,
} from '../schema/kinds.js';
import { type NodeBasis, type NodePlane, type ReadinessBand } from '../schema/nodes.js';
import type { CreateElicitationGapInput, CreateNodeInput } from './command-types.js';
import type { Diagnostic, EdgePatch, NodePatch } from './graph-mutation-types.js';

type ExistingNodeRow = typeof schema.nodes.$inferSelect;

// ---------------------------------------------------------------------------
// Kind tables
// ---------------------------------------------------------------------------

const VALID_KINDS_BY_PLANE: Record<string, readonly string[]> = {
  intent: INTENT_KINDS as unknown as string[],
  oracle: ORACLE_KINDS as unknown as string[],
  design: DESIGN_KINDS as unknown as string[],
  plan: PLAN_KINDS as unknown as string[],
};

const KINDS_REQUIRING_DETAIL = new Set<string>(['decision', 'term']);
const VALID_NODE_BASES = NODE_BASES as unknown as string[];
const VALID_READINESS_BANDS = READINESS_BANDS as unknown as string[];
const VALID_NODE_KINDS = [
  ...INTENT_KINDS,
  ...ORACLE_KINDS,
  ...DESIGN_KINDS,
  ...PLAN_KINDS,
] as readonly string[];
const VALID_GAP_DISPOSITIONS = GAP_DISPOSITIONS as unknown as string[];
const VALID_GAP_PREDICATE_KINDS = GAP_PREDICATE_KINDS as unknown as string[];
const VALID_LENS_AFFINITIES = LENS_AFFINITIES as unknown as string[];

function isNodeBasis(value: string): value is NodeBasis {
  return VALID_NODE_BASES.includes(value);
}

function isNodePlane(value: string): value is NodePlane {
  return value === 'intent' || value === 'oracle' || value === 'design' || value === 'plan';
}

function isReadinessBand(value: string): value is ReadinessBand {
  return VALID_READINESS_BANDS.includes(value);
}

function isElicitationGapLensAffinity(value: string): value is ElicitationGapLensAffinity {
  return VALID_LENS_AFFINITIES.includes(value);
}

export function isGapDisposition(value: string): value is GapDisposition {
  return VALID_GAP_DISPOSITIONS.includes(value);
}

function validateGapPredicate(predicate: GapPredicate, diagnostics: Diagnostic[]): void {
  if (typeof predicate !== 'object' || predicate === null) {
    diagnostics.push({ field: 'predicate', message: 'predicate must be an object' });
    return;
  }

  if (!VALID_GAP_PREDICATE_KINDS.includes(predicate.kind)) {
    diagnostics.push({ field: 'predicate.kind', message: 'predicate kind is not valid' });
    return;
  }

  if (gapPredicateSupport(predicate.kind) === 'unsupported') {
    diagnostics.push({ field: 'predicate.kind', message: 'predicate kind not yet supported' });
    return;
  }

  if (predicate.kind === 'presence') {
    if (!Number.isInteger(predicate.minimum) || predicate.minimum < 1) {
      diagnostics.push({ field: 'predicate.minimum', message: 'minimum must be a positive integer' });
    }
    if (predicate.plane !== undefined && !isNodePlane(predicate.plane)) {
      diagnostics.push({ field: 'predicate.plane', message: 'plane is not valid' });
    }
    if (predicate.band !== undefined && !isReadinessBand(predicate.band)) {
      diagnostics.push({ field: 'predicate.band', message: 'band is not valid' });
    }
    if (predicate.nodeKind !== undefined && !VALID_NODE_KINDS.includes(predicate.nodeKind)) {
      diagnostics.push({ field: 'predicate.nodeKind', message: 'node kind is not valid' });
    }
    if (predicate.nodeKind === undefined && predicate.band === undefined) {
      diagnostics.push({ field: 'predicate', message: 'presence predicate needs nodeKind or band' });
    }
  }
}

export function validateCreateNode(input: CreateNodeInput): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  // Title must be non-empty
  if (!input.title.trim()) {
    diagnostics.push({ field: 'title', message: 'title must be non-empty' });
  }

  if (input.basis !== undefined && !isNodeBasis(input.basis)) {
    diagnostics.push({
      field: 'basis',
      message: 'basis must be explicit or implicit',
    });
  }

  // Kind must be valid for the given plane
  const validKinds = VALID_KINDS_BY_PLANE[input.plane];
  if (!validKinds?.includes(input.kind)) {
    diagnostics.push({
      field: 'kind',
      message: `"${input.kind}" is not a valid kind for plane "${input.plane}"`,
    });
    return diagnostics; // can't validate detail if kind is wrong
  }

  // Detail requirement: decision and term REQUIRE detail
  if (KINDS_REQUIRING_DETAIL.has(input.kind) && input.detail == null) {
    diagnostics.push({
      field: 'detail',
      message: `"${input.kind}" nodes require a detail object`,
    });
    return diagnostics;
  }

  // Detail prohibition: all other kinds must NOT have detail
  if (!KINDS_REQUIRING_DETAIL.has(input.kind) && input.detail != null) {
    diagnostics.push({
      field: 'detail',
      message: `"${input.kind}" nodes must not have a detail object`,
    });
    return diagnostics;
  }

  // Validate detail shape per kind
  if (input.kind === 'decision' && input.detail != null) {
    validateDecisionDetail(input.detail, diagnostics);
  }
  if (input.kind === 'term' && input.detail != null) {
    validateTermDetail(input.detail, diagnostics);
  }

  return diagnostics;
}

function hasOwn(object: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function parseNodeDetail(row: ExistingNodeRow): unknown {
  return row.detail == null ? undefined : JSON.parse(row.detail);
}

export function validateNodePatchAgainstExisting(row: ExistingNodeRow, patch: NodePatch): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const patchRecord = patch as Record<string, unknown>;
  const patchFields = Object.keys(patchRecord);
  const allowedFields = new Set(['title', 'body', 'source', 'detail']);

  if (patchFields.length === 0) {
    diagnostics.push({ field: 'patch', message: 'patch_node requires at least one patch field' });
    return diagnostics;
  }

  for (const field of patchFields) {
    if (!allowedFields.has(field)) {
      diagnostics.push({ field: `patch.${field}`, message: 'field is not patchable' });
    }
  }

  if (hasOwn(patchRecord, 'title') && typeof patch.title !== 'string') {
    diagnostics.push({ field: 'patch.title', message: 'title must be a string when present' });
  }
  if (hasOwn(patchRecord, 'body') && patch.body !== null && typeof patch.body !== 'string') {
    diagnostics.push({ field: 'patch.body', message: 'body must be a string or null when present' });
  }
  if (hasOwn(patchRecord, 'source') && patch.source !== null && typeof patch.source !== 'string') {
    diagnostics.push({ field: 'patch.source', message: 'source must be a string or null when present' });
  }

  const merged: CreateNodeInput = {
    specId: row.spec_id,
    plane: row.plane,
    kind: row.kind,
    title: hasOwn(patchRecord, 'title') ? (patch.title as string) : row.title,
    body: hasOwn(patchRecord, 'body') ? (patch.body ?? undefined) : (row.body ?? undefined),
    basis: row.basis,
    source: hasOwn(patchRecord, 'source') ? (patch.source ?? undefined) : (row.source ?? undefined),
    detail: hasOwn(patchRecord, 'detail') ? patch.detail : parseNodeDetail(row),
  };

  diagnostics.push(
    ...validateCreateNode(merged).map((diagnostic) => ({
      field: `patch.${diagnostic.field}`,
      message: diagnostic.message,
    })),
  );

  return diagnostics;
}

export function validateEdgePatch(patch: EdgePatch): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const patchRecord = patch as Record<string, unknown>;
  const patchFields = Object.keys(patchRecord);

  if (patchFields.length === 0) {
    diagnostics.push({ field: 'patch', message: 'patch_edge requires at least one patch field' });
    return diagnostics;
  }

  for (const field of patchFields) {
    if (field !== 'rationale') {
      diagnostics.push({ field: `patch.${field}`, message: 'field is not patchable' });
    }
  }

  if (hasOwn(patchRecord, 'rationale') && patch.rationale !== null && typeof patch.rationale !== 'string') {
    diagnostics.push({
      field: 'patch.rationale',
      message: 'rationale must be a string or null when present',
    });
  }

  return diagnostics;
}

export function validateCreateElicitationGap(input: CreateElicitationGapInput): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  if (!VALID_NODE_KINDS.includes(input.refersTo)) {
    diagnostics.push({ field: 'refersTo', message: `"${String(input.refersTo)}" is not a valid node kind` });
  }

  if (!input.question.trim()) {
    diagnostics.push({ field: 'question', message: 'question must be non-empty' });
  }

  if (!input.rationale.trim()) {
    diagnostics.push({ field: 'rationale', message: 'rationale must be non-empty' });
  }

  if (input.basis !== undefined && !isNodeBasis(input.basis)) {
    diagnostics.push({ field: 'basis', message: 'basis must be explicit or implicit' });
  }

  if (!isReadinessBand(input.band)) {
    diagnostics.push({
      field: 'band',
      message: `"${String(input.band)}" is not a valid readiness band`,
    });
  }

  if (input.importance !== undefined && (!Number.isInteger(input.importance) || input.importance < 1)) {
    diagnostics.push({ field: 'importance', message: 'importance must be a positive integer' });
  }

  validateGapPredicate(input.predicate, diagnostics);

  if (input.predicate.kind === 'manual' && !input.predicate.rubric.trim()) {
    diagnostics.push({ field: 'predicate.rubric', message: 'manual predicate rubric must be non-empty' });
  }

  if (input.planeAffinity !== undefined && !isNodePlane(input.planeAffinity)) {
    diagnostics.push({
      field: 'planeAffinity',
      message: `"${String(input.planeAffinity)}" is not a valid plane affinity`,
    });
  }

  if (input.lensAffinity !== undefined && !isElicitationGapLensAffinity(input.lensAffinity)) {
    diagnostics.push({
      field: 'lensAffinity',
      message: `"${String(input.lensAffinity)}" is not a valid lens affinity`,
    });
  }

  return diagnostics;
}

function validateDecisionDetail(detail: unknown, diagnostics: Diagnostic[]): void {
  if (typeof detail !== 'object' || detail === null) {
    diagnostics.push({ field: 'detail', message: 'must be an object' });
    return;
  }

  const d = detail as Record<string, unknown>;
  const knownFields = new Set(['chosen_option', 'rejected', 'rationale']);

  if (typeof d['chosen_option'] !== 'string') {
    diagnostics.push({
      field: 'detail.chosen_option',
      message: 'required string',
    });
  }

  if (
    !Array.isArray(d['rejected']) ||
    d['rejected'].length < 1 ||
    !d['rejected'].every((r) => typeof r === 'string')
  ) {
    diagnostics.push({
      field: 'detail.rejected',
      message: 'required non-empty string array',
    });
  }

  if (typeof d['rationale'] !== 'string') {
    diagnostics.push({ field: 'detail.rationale', message: 'required string' });
  }

  // Closed validation: reject unknown fields
  for (const key of Object.keys(d)) {
    if (!knownFields.has(key)) {
      diagnostics.push({ field: `detail.${key}`, message: 'unknown field' });
    }
  }
}

function validateTermDetail(detail: unknown, diagnostics: Diagnostic[]): void {
  if (typeof detail !== 'object' || detail === null) {
    diagnostics.push({ field: 'detail', message: 'must be an object' });
    return;
  }

  const d = detail as Record<string, unknown>;
  const knownFields = new Set(['definition', 'aliases']);

  if (typeof d['definition'] !== 'string') {
    diagnostics.push({
      field: 'detail.definition',
      message: 'required string',
    });
  }

  if (
    d['aliases'] != null &&
    (!Array.isArray(d['aliases']) || !d['aliases'].every((a) => typeof a === 'string'))
  ) {
    diagnostics.push({
      field: 'detail.aliases',
      message: 'must be a string array if present',
    });
  }

  // Closed validation: reject unknown fields
  for (const key of Object.keys(d)) {
    if (!knownFields.has(key)) {
      diagnostics.push({ field: `detail.${key}`, message: 'unknown field' });
    }
  }
}

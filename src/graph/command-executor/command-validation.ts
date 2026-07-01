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
  DESIGN_KINDS,
  INTENT_KINDS,
  NODE_BASES,
  NODE_SETTLEMENTS,
  ORACLE_KINDS,
  PLAN_KINDS,
} from '../schema/kinds.js';
import {
  claimFormKnownFields,
  NODE_DETAIL_FORMS,
  NODE_KINDS_REQUIRING_DETAIL,
  NODE_KINDS_WITH_FORM_DETAIL,
  nodeDetailKnownFields,
  type ClaimFormDiscriminant,
  type NodeBasis,
  type NodeKindRequiringDetail,
  type NodeKindWithFormDetail,
  type NodeSettlement,
} from '../schema/nodes.js';
import type { CreateNodeInput } from './command-types.js';
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

const KINDS_REQUIRING_DETAIL = new Set<string>(NODE_KINDS_REQUIRING_DETAIL);
const KINDS_WITH_FORM_DETAIL = new Set<string>(NODE_KINDS_WITH_FORM_DETAIL);
const VALID_NODE_BASES = NODE_BASES as unknown as string[];
const VALID_NODE_SETTLEMENTS = NODE_SETTLEMENTS as unknown as string[];

function isNodeBasis(value: string): value is NodeBasis {
  return VALID_NODE_BASES.includes(value);
}

function isNodeSettlement(value: string): value is NodeSettlement {
  return VALID_NODE_SETTLEMENTS.includes(value);
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

  if (input.settlement !== undefined && !isNodeSettlement(input.settlement)) {
    diagnostics.push({
      field: 'settlement',
      message: 'settlement must be advisory or settled',
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

  // Detail prohibition: kinds that neither require nor allow form detail must
  // NOT carry detail. Claim kinds (+ context) accept an optional form union.
  if (
    !KINDS_REQUIRING_DETAIL.has(input.kind) &&
    !KINDS_WITH_FORM_DETAIL.has(input.kind) &&
    input.detail != null
  ) {
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
  if (KINDS_WITH_FORM_DETAIL.has(input.kind) && input.detail != null) {
    validateClaimFormDetail(input.kind as NodeKindWithFormDetail, input.detail, diagnostics);
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
  const allowedFields = new Set(['title', 'body', 'source', 'detail', 'settlement']);

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
  if (hasOwn(patchRecord, 'settlement')) {
    if (typeof patch.settlement !== 'string' || !isNodeSettlement(patch.settlement)) {
      diagnostics.push({ field: 'patch.settlement', message: 'settlement must be advisory or settled' });
    } else if (row.settlement === 'settled' && patch.settlement === 'advisory') {
      diagnostics.push({
        field: 'patch.settlement',
        message: 'settlement cannot regress from settled to advisory (I52-L)',
      });
    }
  }

  const merged: CreateNodeInput = {
    specId: row.spec_id,
    plane: row.plane,
    kind: row.kind,
    title: hasOwn(patchRecord, 'title') ? (patch.title as string) : row.title,
    body: hasOwn(patchRecord, 'body') ? (patch.body ?? undefined) : (row.body ?? undefined),
    basis: row.basis,
    settlement: hasOwn(patchRecord, 'settlement') ? (patch.settlement as NodeSettlement) : row.settlement,
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
    if (field !== 'rationale' && field !== 'settlement') {
      diagnostics.push({ field: `patch.${field}`, message: 'field is not patchable' });
    }
  }

  if (hasOwn(patchRecord, 'rationale') && patch.rationale !== null && typeof patch.rationale !== 'string') {
    diagnostics.push({
      field: 'patch.rationale',
      message: 'rationale must be a string or null when present',
    });
  }

  // ceiling: no row-based monotonic transition check on edge settlement yet
  // (unlike patch_node) — add one if an edge-settlement regression bug surfaces.
  if (hasOwn(patchRecord, 'settlement') && !isNodeSettlement(patch.settlement as string)) {
    diagnostics.push({ field: 'patch.settlement', message: 'settlement must be advisory or settled' });
  }

  return diagnostics;
}

function validateDecisionDetail(detail: unknown, diagnostics: Diagnostic[]): void {
  if (typeof detail !== 'object' || detail === null) {
    diagnostics.push({ field: 'detail', message: 'must be an object' });
    return;
  }

  const d = detail as Record<string, unknown>;
  const knownFields = new Set(nodeDetailKnownFields('decision' satisfies NodeKindRequiringDetail));

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
  const knownFields = new Set(nodeDetailKnownFields('term' satisfies NodeKindRequiringDetail));

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

function validateClaimFormDetail(
  kind: NodeKindWithFormDetail,
  detail: unknown,
  diagnostics: Diagnostic[],
): void {
  if (typeof detail !== 'object' || detail === null) {
    diagnostics.push({ field: 'detail', message: 'must be an object' });
    return;
  }

  const d = detail as Record<string, unknown>;
  const allowedForms: readonly ClaimFormDiscriminant[] = NODE_DETAIL_FORMS[kind];
  const form = d['form'];

  if (typeof form !== 'string' || !allowedForms.includes(form as ClaimFormDiscriminant)) {
    diagnostics.push({
      field: 'detail.form',
      message: `form must be one of: ${allowedForms.join(', ')}`,
    });
    return;
  }

  switch (form as ClaimFormDiscriminant) {
    case 'plain':
      break;
    case 'gherkin':
      validateGherkinForm(d, diagnostics);
      break;
    case 'formal':
      validateFormalForm(d, diagnostics);
      break;
    case 'given':
      validateGivenForm(d, diagnostics);
      break;
    default: {
      const unreachable: never = form as never;
      void unreachable;
    }
  }

  // Closed validation: reject unknown fields per form
  const knownFields = new Set(claimFormKnownFields(form as ClaimFormDiscriminant));
  for (const key of Object.keys(d)) {
    if (!knownFields.has(key)) {
      diagnostics.push({ field: `detail.${key}`, message: 'unknown field' });
    }
  }
}

function validateGherkinForm(d: Record<string, unknown>, diagnostics: Diagnostic[]): void {
  if (
    !Array.isArray(d['then']) ||
    d['then'].length < 1 ||
    !d['then'].every((step) => typeof step === 'string')
  ) {
    diagnostics.push({ field: 'detail.then', message: 'required non-empty string array' });
  }

  for (const field of ['given', 'when'] as const) {
    const value = d[field];
    if (value != null && (!Array.isArray(value) || !value.every((step) => typeof step === 'string'))) {
      diagnostics.push({ field: `detail.${field}`, message: 'must be a string array if present' });
    }
  }
}

function validateFormalForm(d: Record<string, unknown>, diagnostics: Diagnostic[]): void {
  if (typeof d['language'] !== 'string' || !d['language'].trim()) {
    diagnostics.push({ field: 'detail.language', message: 'required string' });
  }
  if (typeof d['statement'] !== 'string' || !d['statement'].trim()) {
    diagnostics.push({ field: 'detail.statement', message: 'required string' });
  }
}

function validateGivenForm(d: Record<string, unknown>, diagnostics: Diagnostic[]): void {
  if (typeof d['statement'] !== 'string' || !d['statement'].trim()) {
    diagnostics.push({ field: 'detail.statement', message: 'required string' });
  }
}

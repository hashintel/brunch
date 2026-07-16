// The model-authored plan candidate (FE-1197 slice B). The schema deliberately has no
// command surface: the planner references capability ids and graph provenance only;
// deterministic providers resolve what may run (D130-L).

import { Type } from 'typebox';

export const CandidatePlanSchema = Type.Object(
  {
    schemaVersion: Type.Integer({ minimum: 1, maximum: 1 }),
    specId: Type.String({ minLength: 1 }),
    epics: Type.Array(
      Type.Object(
        {
          id: Type.String({ minLength: 1 }),
          title: Type.String({ minLength: 1 }),
          dependsOn: Type.Array(Type.String()),
          verificationCriterionIds: Type.Array(Type.String()),
        },
        { additionalProperties: false },
      ),
    ),
    slices: Type.Array(
      Type.Object(
        {
          id: Type.String({ minLength: 1 }),
          epicId: Type.String({ minLength: 1 }),
          scopeId: Type.Optional(Type.String({ minLength: 1 })),
          title: Type.String({ minLength: 1 }),
          goal: Type.String({ minLength: 1 }),
          doneCriteria: Type.Array(Type.String()),
          requirementIds: Type.Array(Type.String()),
          criterionIds: Type.Array(Type.String()),
          dependsOn: Type.Array(Type.String()),
          designItemIds: Type.Array(Type.String()),
          verificationItemIds: Type.Array(Type.String()),
        },
        { additionalProperties: false },
      ),
    ),
    requiredCapabilities: Type.Array(
      Type.Object(
        {
          id: Type.String({ minLength: 1 }),
          sourceItemId: Type.String({ minLength: 1 }),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);

export interface CandidatePlanEpic {
  readonly id: string;
  readonly title: string;
  readonly dependsOn: readonly string[];
  readonly verificationCriterionIds: readonly string[];
}

export interface CandidatePlanSlice {
  readonly id: string;
  readonly epicId: string;
  readonly scopeId?: string;
  readonly title: string;
  readonly goal: string;
  readonly doneCriteria: readonly string[];
  readonly requirementIds: readonly string[];
  readonly criterionIds: readonly string[];
  readonly dependsOn: readonly string[];
  readonly designItemIds: readonly string[];
  readonly verificationItemIds: readonly string[];
}

export interface CandidateCapabilityRequirement {
  readonly id: string;
  readonly sourceItemId: string;
}

export interface CandidatePlan {
  readonly schemaVersion: 1;
  readonly specId: string;
  readonly epics: readonly CandidatePlanEpic[];
  readonly slices: readonly CandidatePlanSlice[];
  readonly requiredCapabilities: readonly CandidateCapabilityRequirement[];
}

export type ParseCandidatePlanResult =
  | { readonly status: 'ok'; readonly candidate: CandidatePlan }
  | { readonly status: 'malformed_candidate'; readonly message: string };

export function parseCandidatePlan(input: unknown): ParseCandidatePlanResult {
  const malformed = (message: string): ParseCandidatePlanResult => ({
    status: 'malformed_candidate',
    message,
  });
  if (typeof input === 'string') {
    try {
      return parseCandidatePlan(JSON.parse(input));
    } catch (error) {
      return malformed(
        `candidate is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return malformed('candidate is not an object');
  }
  const record = input as Record<string, unknown>;
  if (record['schemaVersion'] !== 1) {
    return malformed(`unsupported candidate schema version: ${String(record['schemaVersion'])}`);
  }
  if (!isNonBlankString(record['specId'])) return malformed('candidate is missing specId');
  if (!Array.isArray(record['epics'])) return malformed('candidate is missing epics');
  if (!Array.isArray(record['slices'])) return malformed('candidate is missing slices');
  if (!Array.isArray(record['requiredCapabilities'])) {
    return malformed('candidate is missing requiredCapabilities');
  }

  const epics: CandidatePlanEpic[] = [];
  for (const [index, value] of record['epics'].entries()) {
    const epic = parseEpic(value);
    if (typeof epic === 'string') return malformed(`epic ${index}: ${epic}`);
    epics.push(epic);
  }
  const slices: CandidatePlanSlice[] = [];
  for (const [index, value] of record['slices'].entries()) {
    const slice = parseSlice(value);
    if (typeof slice === 'string') return malformed(`slice ${index}: ${slice}`);
    slices.push(slice);
  }
  const requiredCapabilities: CandidateCapabilityRequirement[] = [];
  for (const [index, value] of record['requiredCapabilities'].entries()) {
    const capability = parseCapability(value);
    if (typeof capability === 'string') return malformed(`requiredCapabilities ${index}: ${capability}`);
    requiredCapabilities.push(capability);
  }

  return {
    status: 'ok',
    candidate: { schemaVersion: 1, specId: record['specId'], epics, slices, requiredCapabilities },
  };
}

function parseEpic(value: unknown): CandidatePlanEpic | string {
  if (typeof value !== 'object' || value === null) return 'not an object';
  const record = value as Record<string, unknown>;
  if (!isNonBlankString(record['id'])) return 'missing non-blank string field: id';
  if (!isNonBlankString(record['title'])) return 'missing non-blank string field: title';
  const dependsOn = stringArray(record['dependsOn']);
  if (!dependsOn) return 'missing string-array field: dependsOn';
  const verificationCriterionIds = stringArray(record['verificationCriterionIds']);
  if (!verificationCriterionIds) return 'missing string-array field: verificationCriterionIds';
  return { id: record['id'], title: record['title'], dependsOn, verificationCriterionIds };
}

function parseSlice(value: unknown): CandidatePlanSlice | string {
  if (typeof value !== 'object' || value === null) return 'not an object';
  const record = value as Record<string, unknown>;
  const id = record['id'];
  const epicId = record['epicId'];
  const title = record['title'];
  const goal = record['goal'];
  if (!isNonBlankString(id)) return 'missing non-blank string field: id';
  if (!isNonBlankString(epicId)) return 'missing non-blank string field: epicId';
  if (!isNonBlankString(title)) return 'missing non-blank string field: title';
  if (!isNonBlankString(goal)) return 'missing non-blank string field: goal';
  const rawScopeId = record['scopeId'];
  const scopeId =
    rawScopeId === undefined ||
    rawScopeId === null ||
    (typeof rawScopeId === 'string' && rawScopeId.trim() === '')
      ? undefined
      : rawScopeId;
  if (scopeId !== undefined && !isNonBlankString(scopeId)) {
    return 'scopeId must be a non-blank string when present';
  }
  const arrays: Record<string, readonly string[] | undefined> = {
    doneCriteria: stringArray(record['doneCriteria']),
    requirementIds: stringArray(record['requirementIds']),
    criterionIds: stringArray(record['criterionIds']),
    dependsOn: stringArray(record['dependsOn']),
    designItemIds: stringArray(record['designItemIds']),
    verificationItemIds: stringArray(record['verificationItemIds']),
  };
  for (const [field, parsed] of Object.entries(arrays)) {
    if (!parsed) return `missing string-array field: ${field}`;
  }
  const doneCriteria = arrays['doneCriteria']!;
  const requirementIds = arrays['requirementIds']!;
  const criterionIds = arrays['criterionIds']!;
  const dependsOn = arrays['dependsOn']!;
  const designItemIds = arrays['designItemIds']!;
  const verificationItemIds = arrays['verificationItemIds']!;
  return {
    id,
    epicId,
    ...(scopeId !== undefined ? { scopeId: scopeId as string } : {}),
    title,
    goal,
    doneCriteria,
    requirementIds,
    criterionIds,
    dependsOn,
    designItemIds,
    verificationItemIds,
  };
}

function parseCapability(value: unknown): CandidateCapabilityRequirement | string {
  if (typeof value !== 'object' || value === null) return 'not an object';
  const record = value as Record<string, unknown>;
  if (!isNonBlankString(record['id'])) return 'missing non-blank string field: id';
  if (!isNonBlankString(record['sourceItemId'])) return 'missing non-blank string field: sourceItemId';
  return { id: record['id'], sourceItemId: record['sourceItemId'] };
}

function stringArray(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.every((entry) => typeof entry === 'string') ? (value as string[]) : undefined;
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

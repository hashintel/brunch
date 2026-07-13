// The model-authored plan candidate (FE-1197 slice B). The schema deliberately has no
// command surface: the planner references capability ids and graph provenance only;
// deterministic providers resolve what may run (D130-L).

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
    if (!epic) return malformed(`epic ${index} is malformed`);
    epics.push(epic);
  }
  const slices: CandidatePlanSlice[] = [];
  for (const [index, value] of record['slices'].entries()) {
    const slice = parseSlice(value);
    if (!slice) return malformed(`slice ${index} is malformed`);
    slices.push(slice);
  }
  const requiredCapabilities: CandidateCapabilityRequirement[] = [];
  for (const [index, value] of record['requiredCapabilities'].entries()) {
    const capability = parseCapability(value);
    if (!capability) return malformed(`requiredCapabilities ${index} is malformed`);
    requiredCapabilities.push(capability);
  }

  return {
    status: 'ok',
    candidate: { schemaVersion: 1, specId: record['specId'], epics, slices, requiredCapabilities },
  };
}

function parseEpic(value: unknown): CandidatePlanEpic | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const record = value as Record<string, unknown>;
  if (!isNonBlankString(record['id']) || !isNonBlankString(record['title'])) return undefined;
  const dependsOn = stringArray(record['dependsOn']);
  const verificationCriterionIds = stringArray(record['verificationCriterionIds']);
  if (!dependsOn || !verificationCriterionIds) return undefined;
  return { id: record['id'], title: record['title'], dependsOn, verificationCriterionIds };
}

function parseSlice(value: unknown): CandidatePlanSlice | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const record = value as Record<string, unknown>;
  if (!isNonBlankString(record['id']) || !isNonBlankString(record['epicId'])) return undefined;
  if (!isNonBlankString(record['title']) || !isNonBlankString(record['goal'])) return undefined;
  if (record['scopeId'] !== undefined && !isNonBlankString(record['scopeId'])) return undefined;
  const doneCriteria = stringArray(record['doneCriteria']);
  const requirementIds = stringArray(record['requirementIds']);
  const criterionIds = stringArray(record['criterionIds']);
  const dependsOn = stringArray(record['dependsOn']);
  const designItemIds = stringArray(record['designItemIds']);
  const verificationItemIds = stringArray(record['verificationItemIds']);
  if (
    !doneCriteria ||
    !requirementIds ||
    !criterionIds ||
    !dependsOn ||
    !designItemIds ||
    !verificationItemIds
  ) {
    return undefined;
  }
  return {
    id: record['id'],
    epicId: record['epicId'],
    ...(record['scopeId'] !== undefined ? { scopeId: record['scopeId'] as string } : {}),
    title: record['title'],
    goal: record['goal'],
    doneCriteria,
    requirementIds,
    criterionIds,
    dependsOn,
    designItemIds,
    verificationItemIds,
  };
}

function parseCapability(value: unknown): CandidateCapabilityRequirement | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const record = value as Record<string, unknown>;
  if (!isNonBlankString(record['id']) || !isNonBlankString(record['sourceItemId'])) return undefined;
  return { id: record['id'], sourceItemId: record['sourceItemId'] };
}

function stringArray(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.every((entry) => typeof entry === 'string') ? (value as string[]) : undefined;
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

import { MATRIX_CELL_IDS, type MatrixCellId } from './matrix-contract.js';
import { SPEC_SOURCES, type SpecSource } from './study-contract.js';
import { exactSet, nonempty, record, safeRelativePath, sha256 } from './validation.js';

export type RequirementOrigin = 'public_baseline' | 'controller_only' | 'elicited_decision';
export type ElicitationDisposition = 'explicit' | 'omitted' | 'contradicted' | 'not_assessable';
export type HandoffDisposition = 'present' | 'absent';
export type ImplementationDisposition = 'satisfied' | 'violated' | 'not_exposed' | 'not_assessable';
export type VerificationDisposition = 'passed' | 'failed' | 'not_run' | 'not_assessable';
export type RequirementAssessment =
  | 'explicit-and-implemented'
  | 'explicit-but-missed'
  | 'unelicited-but-inferred'
  | 'unelicited-and-missed'
  | 'contradicted'
  | 'not_assessable';

export interface EvidenceReference {
  readonly id: string;
  readonly audience: 'public' | 'controller_only';
}

export interface RequirementLedgerCell {
  readonly implementation: ImplementationDisposition;
  readonly verification: VerificationDisposition;
  readonly assessment: RequirementAssessment;
  readonly evidence: readonly EvidenceReference[];
}

export interface RequirementLedgerRow {
  readonly id: string;
  readonly publicConcern: string;
  readonly origin: RequirementOrigin;
  readonly publicWording?: string;
  readonly controller?: {
    readonly wording: string;
    readonly revealPolicy: string;
    readonly expectedState: string;
    readonly fixtureRefs: readonly string[];
  };
  readonly elicitation: Readonly<
    Record<
      SpecSource,
      {
        readonly status: ElicitationDisposition;
        readonly evidence: readonly string[];
      }
    >
  >;
  readonly handoff: Readonly<
    Record<
      SpecSource,
      {
        readonly status: HandoffDisposition;
        readonly evidence: string;
      }
    >
  >;
  readonly cells: Readonly<Record<MatrixCellId, RequirementLedgerCell>>;
}

export interface RequirementRegistry {
  readonly schemaVersion: 1;
  readonly caseId: string;
  readonly rows: readonly Pick<
    RequirementLedgerRow,
    'id' | 'publicConcern' | 'origin' | 'publicWording' | 'controller'
  >[];
}

export interface RequirementLedger {
  readonly schemaVersion: 1;
  readonly studyContractSha256: string;
  readonly rows: readonly RequirementLedgerRow[];
}

export function parseRequirementRegistry(value: unknown): RequirementRegistry {
  if (
    !record(value) ||
    value['schemaVersion'] !== 1 ||
    !nonempty(value['caseId']) ||
    !Array.isArray(value['rows']) ||
    value['rows'].length === 0
  ) {
    invalidRegistry();
  }
  const ids = new Set<string>();
  for (const row of value['rows']) {
    if (!record(row) || !registryRow(row) || ids.has(row['id'] as string)) {
      invalidRegistry();
    }
    ids.add(row['id'] as string);
  }
  return value as unknown as RequirementRegistry;
}

export function parseRequirementLedger(value: unknown): RequirementLedger {
  if (
    !record(value) ||
    value['schemaVersion'] !== 1 ||
    !sha256(value['studyContractSha256']) ||
    !Array.isArray(value['rows']) ||
    value['rows'].length === 0
  ) {
    invalid();
  }
  const ids = new Set<string>();
  for (const row of value['rows']) {
    if (!record(row) || !rowRecord(row) || ids.has(row['id'] as string)) invalid();
    ids.add(row['id'] as string);
  }
  return value as unknown as RequirementLedger;
}

function registryRow(value: Record<string, unknown>): boolean {
  const origin = value['origin'];
  return (
    nonempty(value['id']) &&
    nonempty(value['publicConcern']) &&
    (origin === 'public_baseline' || origin === 'controller_only' || origin === 'elicited_decision') &&
    (value['publicWording'] === undefined || nonempty(value['publicWording'])) &&
    (origin !== 'controller_only' || controllerRecord(value['controller'])) &&
    (value['controller'] === undefined || controllerRecord(value['controller']))
  );
}

function rowRecord(value: Record<string, unknown>): boolean {
  const origin = value['origin'];
  const elicitation = value['elicitation'];
  const handoff = value['handoff'];
  const cells = value['cells'];
  if (
    !nonempty(value['id']) ||
    !nonempty(value['publicConcern']) ||
    (origin !== 'public_baseline' && origin !== 'controller_only' && origin !== 'elicited_decision') ||
    (value['publicWording'] !== undefined && !nonempty(value['publicWording'])) ||
    !record(elicitation) ||
    !record(handoff) ||
    !record(cells) ||
    !exactSet(Object.keys(elicitation), SPEC_SOURCES) ||
    !exactSet(Object.keys(handoff), SPEC_SOURCES) ||
    !exactSet(Object.keys(cells), MATRIX_CELL_IDS)
  ) {
    return false;
  }
  if (origin === 'controller_only' && !controllerRecord(value['controller'])) return false;
  if (value['controller'] !== undefined && !controllerRecord(value['controller'])) return false;
  for (const source of SPEC_SOURCES) {
    if (!elicitationRecord(elicitation[source]) || !handoffRecord(handoff[source])) return false;
  }
  for (const cellId of MATRIX_CELL_IDS) {
    if (!cellRecord(cells[cellId])) return false;
  }
  return true;
}

function controllerRecord(value: unknown): boolean {
  return (
    record(value) &&
    nonempty(value['wording']) &&
    nonempty(value['revealPolicy']) &&
    nonempty(value['expectedState']) &&
    Array.isArray(value['fixtureRefs']) &&
    value['fixtureRefs'].every(safeRelativePath)
  );
}

function elicitationRecord(value: unknown): boolean {
  return (
    record(value) &&
    (value['status'] === 'explicit' ||
      value['status'] === 'omitted' ||
      value['status'] === 'contradicted' ||
      value['status'] === 'not_assessable') &&
    Array.isArray(value['evidence']) &&
    value['evidence'].every(safeRelativePath)
  );
}

function handoffRecord(value: unknown): boolean {
  return (
    record(value) &&
    (value['status'] === 'present' || value['status'] === 'absent') &&
    safeRelativePath(value['evidence'])
  );
}

function cellRecord(value: unknown): boolean {
  if (!record(value) || !Array.isArray(value['evidence'])) return false;
  const implementation = value['implementation'];
  const verification = value['verification'];
  const assessment = value['assessment'];
  if (
    (implementation !== 'satisfied' &&
      implementation !== 'violated' &&
      implementation !== 'not_exposed' &&
      implementation !== 'not_assessable') ||
    (verification !== 'passed' &&
      verification !== 'failed' &&
      verification !== 'not_run' &&
      verification !== 'not_assessable') ||
    (assessment !== 'explicit-and-implemented' &&
      assessment !== 'explicit-but-missed' &&
      assessment !== 'unelicited-but-inferred' &&
      assessment !== 'unelicited-and-missed' &&
      assessment !== 'contradicted' &&
      assessment !== 'not_assessable') ||
    !value['evidence'].every(evidenceRecord)
  ) {
    return false;
  }
  if (assessment === 'unelicited-but-inferred') {
    return (
      implementation === 'satisfied' &&
      verification === 'passed' &&
      value['evidence'].some((evidence) => record(evidence) && evidence['audience'] === 'public')
    );
  }
  return true;
}

function evidenceRecord(value: unknown): boolean {
  return (
    record(value) &&
    safeRelativePath(value['id']) &&
    (value['audience'] === 'public' || value['audience'] === 'controller_only')
  );
}

function invalid(): never {
  throw new Error('invalid end-to-end requirement ledger');
}

function invalidRegistry(): never {
  throw new Error('invalid end-to-end requirement registry');
}

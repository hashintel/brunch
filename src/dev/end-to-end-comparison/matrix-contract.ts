import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { parseExecutionAttempt, type ExecutionAttempt } from '../execution-comparison/artifact-contract.js';
import { sha256Bytes } from './handoff-contract.js';
import { EXECUTORS, SPEC_SOURCES, type Executor, type SpecSource } from './study-contract.js';
import { containedPath, exactSet, record, safeRelativePath, sha256 } from './validation.js';

export const MATRIX_CELL_IDS = [
  'brunch_spec--brunch',
  'brunch_spec--claude_code',
  'claude_spec--brunch',
  'claude_spec--claude_code',
] as const;

export type MatrixCellId = (typeof MATRIX_CELL_IDS)[number];

export interface MatrixCell {
  readonly id: MatrixCellId;
  readonly specSource: SpecSource;
  readonly executor: Executor;
  readonly handoffSha256: string;
  readonly attempt: {
    readonly path: string;
    readonly sha256: string;
  };
}

export interface EndToEndMatrixManifest {
  readonly schemaVersion: 1;
  readonly studyContractSha256: string;
  readonly cells: readonly MatrixCell[];
}

export interface LoadedEndToEndMatrix {
  readonly manifest: EndToEndMatrixManifest;
  readonly cells: readonly {
    readonly id: MatrixCellId;
    readonly specSource: SpecSource;
    readonly executor: Executor;
    readonly handoffSha256: string;
    readonly attemptPath: string;
    readonly attemptSha256: string;
    readonly attempt: ExecutionAttempt;
  }[];
}

export function parseEndToEndMatrixManifest(value: unknown): EndToEndMatrixManifest {
  if (
    !record(value) ||
    value['schemaVersion'] !== 1 ||
    !sha256(value['studyContractSha256']) ||
    !Array.isArray(value['cells'])
  ) {
    invalid();
  }
  const cells = value['cells'];
  if (
    !exactSet(
      cells.map((cell) => (record(cell) ? cell['id'] : undefined)),
      MATRIX_CELL_IDS,
    )
  ) {
    invalid();
  }
  for (const cell of cells) {
    if (!record(cell) || !cellRecord(cell)) invalid();
  }
  const handoffs = new Map<SpecSource, string>();
  for (const cell of cells as unknown as MatrixCell[]) {
    const existing = handoffs.get(cell.specSource);
    if (existing !== undefined && existing !== cell.handoffSha256) invalid();
    handoffs.set(cell.specSource, cell.handoffSha256);
  }
  return value as unknown as EndToEndMatrixManifest;
}

export async function loadEndToEndMatrix(input: {
  readonly bundleRoot: string;
  readonly value: unknown;
}): Promise<LoadedEndToEndMatrix> {
  const manifest = parseEndToEndMatrixManifest(input.value);
  let caseId: string | undefined;
  const cells = [];
  for (const cell of manifest.cells) {
    const attemptPath = resolve(input.bundleRoot, cell.attempt.path);
    if (!containedPath(input.bundleRoot, attemptPath)) invalid();
    const bytes = await readFile(attemptPath);
    if (sha256Bytes(bytes) !== cell.attempt.sha256) {
      throw new Error(`execution attempt hash drifted for matrix cell ${cell.id}`);
    }
    const attempt = parseExecutionAttempt(parseJson(bytes.toString('utf8')));
    if (attempt.lane !== cell.executor) {
      throw new Error(`execution attempt lane does not match matrix cell ${cell.id}`);
    }
    if (caseId !== undefined && caseId !== attempt.caseId) {
      throw new Error('matrix execution attempts must use one case');
    }
    caseId = attempt.caseId;
    cells.push({
      id: cell.id,
      specSource: cell.specSource,
      executor: cell.executor,
      handoffSha256: cell.handoffSha256,
      attemptPath,
      attemptSha256: cell.attempt.sha256,
      attempt,
    });
  }
  return { manifest, cells };
}

function cellRecord(value: Record<string, unknown>): boolean {
  const attempt = value['attempt'];
  if (!record(attempt)) return false;
  const expectedId = `${String(value['specSource'])}--${String(value['executor'])}`;
  return (
    MATRIX_CELL_IDS.includes(value['id'] as MatrixCellId) &&
    SPEC_SOURCES.includes(value['specSource'] as SpecSource) &&
    EXECUTORS.includes(value['executor'] as Executor) &&
    value['id'] === expectedId &&
    sha256(value['handoffSha256']) &&
    safeRelativePath(attempt['path']) &&
    sha256(attempt['sha256'])
  );
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error('invalid execution attempt JSON');
  }
}

function invalid(): never {
  throw new Error('invalid end-to-end matrix manifest');
}

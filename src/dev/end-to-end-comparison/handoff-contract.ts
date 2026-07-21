import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

import { assertControllerIsolation, SPEC_SOURCES, type SpecSource } from './study-contract.js';
import {
  containedPath,
  nonempty,
  record,
  safeId,
  safeRelativePath,
  sha256,
  timestamp,
} from './validation.js';

export interface ImmutableHandoffRecord {
  readonly schemaVersion: 1;
  readonly elicitationRunId: string;
  readonly specSource: SpecSource;
  readonly sourceArtifactPath: string;
  readonly specificationPath: 'spec.md';
  readonly specificationSha256: string;
  readonly approvedBy: string;
  readonly approvedAt: string;
  readonly studyContractSha256: string;
}

export function parseImmutableHandoffRecord(value: unknown): ImmutableHandoffRecord {
  if (
    !record(value) ||
    value['schemaVersion'] !== 1 ||
    !safeId(value['elicitationRunId']) ||
    !SPEC_SOURCES.includes(value['specSource'] as SpecSource) ||
    !safeRelativePath(value['sourceArtifactPath']) ||
    value['specificationPath'] !== 'spec.md' ||
    !sha256(value['specificationSha256']) ||
    !nonempty(value['approvedBy']) ||
    !timestamp(value['approvedAt']) ||
    !sha256(value['studyContractSha256'])
  ) {
    throw new Error('invalid immutable handoff record');
  }
  return value as unknown as ImmutableHandoffRecord;
}

export async function writeImmutableHandoff(input: {
  readonly elicitationRunRoot: string;
  readonly sourcePath: string;
  readonly handoffsRoot: string;
  readonly controllerRoot: string;
  readonly targetRoots: readonly string[];
  readonly elicitationRunId: string;
  readonly specSource: SpecSource;
  readonly expectedSpecificationSha256: string;
  readonly approvedBy: string;
  readonly approvedAt: string;
  readonly studyContractSha256: string;
}): Promise<{
  readonly directory: string;
  readonly specificationPath: string;
  readonly recordPath: string;
  readonly record: ImmutableHandoffRecord;
}> {
  assertControllerIsolation({
    controllerRoot: input.controllerRoot,
    targetRoots: input.targetRoots,
  });
  if (!containedPath(input.elicitationRunRoot, input.sourcePath)) {
    throw new Error('approved specification must stay inside the elicitation run');
  }
  if (containedPath(input.controllerRoot, input.sourcePath)) {
    throw new Error('approved specification may not come from the controller root');
  }
  if (!sha256(input.expectedSpecificationSha256)) {
    throw new Error('invalid approved specification hash');
  }

  const bytes = await readFile(input.sourcePath);
  const actualSha256 = sha256Bytes(bytes);
  if (actualSha256 !== input.expectedSpecificationSha256) {
    throw new Error('approved specification hash drifted');
  }

  const record = parseImmutableHandoffRecord({
    schemaVersion: 1,
    elicitationRunId: input.elicitationRunId,
    specSource: input.specSource,
    sourceArtifactPath: slash(relative(input.elicitationRunRoot, input.sourcePath)),
    specificationPath: 'spec.md',
    specificationSha256: actualSha256,
    approvedBy: input.approvedBy,
    approvedAt: input.approvedAt,
    studyContractSha256: input.studyContractSha256,
  });
  await mkdir(input.handoffsRoot, { recursive: true });
  const directory = join(input.handoffsRoot, input.specSource);
  try {
    await mkdir(directory);
  } catch (error) {
    if (recordValue(error) && error['code'] === 'EEXIST') {
      throw new Error(`handoff ${input.specSource} already exists`);
    }
    throw error;
  }

  const specificationPath = join(directory, record.specificationPath);
  const recordPath = join(directory, 'handoff.json');
  try {
    await writeFile(specificationPath, bytes, { flag: 'wx' });
    await writeFile(recordPath, `${JSON.stringify(record, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
    });
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
  return { directory, specificationPath, recordPath, record };
}

export function sha256Bytes(value: string | Buffer): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function slash(path: string): string {
  return sep === '/' ? path : path.split(sep).join('/');
}

function recordValue(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

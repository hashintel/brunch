import { mkdir, readFile } from 'node:fs/promises';
import { relative, sep } from 'node:path';

import {
  writeExecutionAttemptImmutable,
  type ExecutionAttempt,
} from '../execution-comparison/artifact-contract.js';
import { parseImmutableHandoffRecord, sha256Bytes } from './handoff-contract.js';
import type { MatrixCell } from './matrix-contract.js';
import type { SpecSource } from './study-contract.js';
import { containedPath } from './validation.js';

export async function retainExecutionCell(input: {
  readonly bundleRoot: string;
  readonly attemptsRoot: string;
  readonly specSource: SpecSource;
  readonly handoffRecordPath: string;
  readonly attempt: ExecutionAttempt;
}): Promise<MatrixCell> {
  if (
    !containedPath(input.bundleRoot, input.handoffRecordPath) ||
    !containedPath(input.bundleRoot, input.attemptsRoot)
  ) {
    throw new Error('execution cell artifacts must stay inside the retained bundle');
  }
  const handoffBytes = await readFile(input.handoffRecordPath);
  const handoff = parseImmutableHandoffRecord(parseJson(handoffBytes.toString('utf8')));
  if (handoff.specSource !== input.specSource) {
    throw new Error('execution cell handoff source does not match');
  }
  await mkdir(input.attemptsRoot, { recursive: true });
  const attemptPath = await writeExecutionAttemptImmutable(input.attemptsRoot, input.attempt);
  const attemptBytes = await readFile(attemptPath);
  return {
    id: `${input.specSource}--${input.attempt.lane}`,
    specSource: input.specSource,
    executor: input.attempt.lane,
    handoffSha256: sha256Bytes(handoffBytes),
    attempt: {
      path: slash(relative(input.bundleRoot, attemptPath)),
      sha256: sha256Bytes(attemptBytes),
    },
  };
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error('invalid immutable handoff JSON');
  }
}

function slash(path: string): string {
  return sep === '/' ? path : path.split(sep).join('/');
}

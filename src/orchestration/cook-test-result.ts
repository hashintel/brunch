import { appendFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { reportsPath } from './cook-report.js';
import {
  cookRunDir,
  cookRunMetadataPath,
  persistCookRunMetadata,
  readCookRunMetadata,
  type CookRunMetadata,
} from './cook-run.js';

interface TestResultPayload {
  readonly status?: string;
  readonly target?: string;
}

export type CookTestResultIngestResult =
  | {
      readonly status: 'missing_run';
      readonly runStatus: 'not_started';
      readonly runId: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'agent_result_not_ingested';
      readonly runStatus: CookRunMetadata['status'];
      readonly runId: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'missing_test_result';
      readonly runStatus: 'agent_result_ingested';
      readonly runId: string;
      readonly sliceId: string;
      readonly resultPath: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'test_result_ingested';
      readonly runStatus: 'test_result_ingested';
      readonly runId: string;
      readonly sliceId: string;
      readonly epicId: string;
      readonly resultPath: string;
      readonly metadataPath: string;
      readonly reportsPath: string;
      readonly sideEffects: readonly [
        { readonly kind: 'append_file'; readonly path: string },
        { readonly kind: 'write_file'; readonly path: string; readonly ifExists: 'overwrite' },
      ];
    };

export function testResultPath(cwd: string, runId: string, sliceId: string): string {
  return join(cookRunDir(cwd, runId), 'agent-output', sliceId, 'test-result.json');
}

export async function ingestCookTestResult(args: {
  readonly cwd: string;
  readonly runId: string;
}): Promise<CookTestResultIngestResult> {
  const metadataPath = cookRunMetadataPath(args.cwd, args.runId);
  const metadata = await readCookRunMetadata(metadataPath);
  if (!metadata) {
    return {
      status: 'missing_run',
      runStatus: 'not_started',
      runId: args.runId,
      metadataPath,
      sideEffects: [],
    };
  }

  if (metadata.status !== 'agent_result_ingested' || !metadata.activeSliceId || !metadata.activeEpicId) {
    return {
      status: 'agent_result_not_ingested',
      runStatus: metadata.status,
      runId: args.runId,
      metadataPath,
      sideEffects: [],
    };
  }

  const resultPath = testResultPath(args.cwd, args.runId, metadata.activeSliceId);
  const result = await readTestResult(resultPath);
  if (!result) {
    return {
      status: 'missing_test_result',
      runStatus: 'agent_result_ingested',
      runId: args.runId,
      sliceId: metadata.activeSliceId,
      resultPath,
      metadataPath,
      sideEffects: [],
    };
  }

  const reportPath = metadata.reportsPath ?? reportsPath(args.cwd, args.runId);
  const event = {
    event: 'slice_test_result',
    runId: args.runId,
    epicId: metadata.activeEpicId,
    sliceId: metadata.activeSliceId,
    status: result.status ?? 'passed',
    ...(result.target ? { target: result.target } : {}),
  };
  const updated: CookRunMetadata = {
    ...metadata,
    status: 'test_result_ingested',
    testResultPath: resultPath,
  };

  await appendFile(reportPath, `${JSON.stringify(event)}\n`, 'utf8');
  const metadataEffect = await persistCookRunMetadata(metadataPath, updated);

  return {
    status: 'test_result_ingested',
    runStatus: 'test_result_ingested',
    runId: args.runId,
    sliceId: metadata.activeSliceId,
    epicId: metadata.activeEpicId,
    resultPath,
    metadataPath,
    reportsPath: reportPath,
    sideEffects: [{ kind: 'append_file', path: reportPath }, metadataEffect],
  };
}

async function readTestResult(path: string): Promise<TestResultPayload | undefined> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as TestResultPayload;
  } catch {
    return undefined;
  }
}

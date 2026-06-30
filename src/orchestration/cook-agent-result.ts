import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { reportsPath } from './cook-report.js';
import { cookRunDir, cookRunMetadataPath, type CookRunMetadata } from './cook-run.js';

interface AgentResultPayload {
  readonly status?: string;
  readonly summary?: string;
}

export type CookAgentResultIngestResult =
  | {
      readonly status: 'missing_run';
      readonly runStatus: 'not_started';
      readonly runId: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'slice_not_requested';
      readonly runStatus: CookRunMetadata['status'];
      readonly runId: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'missing_agent_result';
      readonly runStatus: 'slice_execution_requested';
      readonly runId: string;
      readonly sliceId: string;
      readonly resultPath: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'agent_result_ingested';
      readonly runStatus: 'agent_result_ingested';
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

export function agentResultPath(cwd: string, runId: string, sliceId: string): string {
  return join(cookRunDir(cwd, runId), 'agent-output', sliceId, 'result.json');
}

export async function ingestCookAgentResult(args: {
  readonly cwd: string;
  readonly runId: string;
}): Promise<CookAgentResultIngestResult> {
  const metadataPath = cookRunMetadataPath(args.cwd, args.runId);
  const metadata = await readRunMetadata(metadataPath);
  if (!metadata) {
    return {
      status: 'missing_run',
      runStatus: 'not_started',
      runId: args.runId,
      metadataPath,
      sideEffects: [],
    };
  }

  if (metadata.status !== 'slice_execution_requested' || !metadata.activeSliceId || !metadata.activeEpicId) {
    return {
      status: 'slice_not_requested',
      runStatus: metadata.status,
      runId: args.runId,
      metadataPath,
      sideEffects: [],
    };
  }

  const resultPath = agentResultPath(args.cwd, args.runId, metadata.activeSliceId);
  const result = await readAgentResult(resultPath);
  if (!result) {
    return {
      status: 'missing_agent_result',
      runStatus: 'slice_execution_requested',
      runId: args.runId,
      sliceId: metadata.activeSliceId,
      resultPath,
      metadataPath,
      sideEffects: [],
    };
  }

  const reportPath = metadata.reportsPath ?? reportsPath(args.cwd, args.runId);
  const event = {
    event: 'slice_agent_result',
    runId: args.runId,
    epicId: metadata.activeEpicId,
    sliceId: metadata.activeSliceId,
    status: result.status ?? 'completed',
    ...(result.summary ? { summary: result.summary } : {}),
  };
  const updated: CookRunMetadata = {
    ...metadata,
    status: 'agent_result_ingested',
    agentResultPath: resultPath,
  };

  await appendFile(reportPath, `${JSON.stringify(event)}\n`, 'utf8');
  await writeFile(metadataPath, `${JSON.stringify(updated, null, 2)}\n`, 'utf8');

  return {
    status: 'agent_result_ingested',
    runStatus: 'agent_result_ingested',
    runId: args.runId,
    sliceId: metadata.activeSliceId,
    epicId: metadata.activeEpicId,
    resultPath,
    metadataPath,
    reportsPath: reportPath,
    sideEffects: [
      { kind: 'append_file', path: reportPath },
      { kind: 'write_file', path: metadataPath, ifExists: 'overwrite' },
    ],
  };
}

async function readRunMetadata(path: string): Promise<CookRunMetadata | undefined> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as CookRunMetadata;
  } catch {
    return undefined;
  }
}

async function readAgentResult(path: string): Promise<AgentResultPayload | undefined> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as AgentResultPayload;
  } catch {
    return undefined;
  }
}

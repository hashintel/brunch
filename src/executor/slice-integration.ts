import { appendFile } from 'node:fs/promises';

import type { GitSliceIntegrateEffect, GitSliceIntegrationPort } from './execution-ports.js';
import { readSliceVerificationVerdict } from './report-verdict.js';
import { reportsPath } from './report.js';
import { persistRunMetadata, readRunMetadata, runMetadataPath, type RunMetadata } from './run.js';

type IntegrationEffect =
  | GitSliceIntegrateEffect
  | { readonly kind: 'append_file'; readonly path: string }
  | { readonly kind: 'write_file'; readonly path: string; readonly ifExists: 'overwrite' };

export type SliceIntegrationResult =
  | {
      readonly status: 'slice_not_ready';
      readonly runStatus: RunMetadata['status'] | 'not_started';
      readonly sideEffects: readonly [];
    }
  | {
      readonly status:
        | 'slice_verification_not_passed'
        | 'slice_integration_conflict'
        | 'slice_integration_failed';
      readonly runStatus: 'test_result_ingested';
      readonly message: string;
      readonly sideEffects: readonly IntegrationEffect[];
    }
  | {
      readonly status: 'slice_integrated';
      readonly runStatus: 'slice_integrated';
      readonly sliceId: string;
      readonly integrationCommitSha: string;
      readonly sideEffects: readonly IntegrationEffect[];
    };

export async function integrateSlice(args: {
  readonly cwd: string;
  readonly runId: string;
  readonly gitSliceIntegration: GitSliceIntegrationPort;
}): Promise<SliceIntegrationResult> {
  const metadataPath = runMetadataPath(args.cwd, args.runId);
  const metadata = await readRunMetadata(metadataPath);
  if (
    !metadata ||
    metadata.status !== 'test_result_ingested' ||
    !metadata.worktreeDir ||
    !metadata.activeSliceId ||
    !metadata.activeSliceWorkspaceDir ||
    !metadata.activeSliceBaseSha
  ) {
    return { status: 'slice_not_ready', runStatus: metadata?.status ?? 'not_started', sideEffects: [] };
  }

  const reportPath = metadata.reportsPath ?? reportsPath(args.cwd, args.runId);
  const verdict = await readSliceVerificationVerdict({
    reportsPath: reportPath,
    expectedSliceIds: [metadata.activeSliceId],
  });
  if (verdict.status !== 'passed') {
    return {
      status: 'slice_verification_not_passed',
      runStatus: 'test_result_ingested',
      message: `slice verification is ${verdict.status}`,
      sideEffects: [],
    };
  }

  const result = await args.gitSliceIntegration.integrate({
    runWorktreeDir: metadata.worktreeDir,
    sliceWorktreeDir: metadata.activeSliceWorkspaceDir,
    sliceId: metadata.activeSliceId,
    baseSha: metadata.activeSliceBaseSha,
  });
  if (result.status !== 'integrated') {
    const status = result.status === 'conflict' ? 'slice_integration_conflict' : 'slice_integration_failed';
    await appendFile(
      reportPath,
      `${JSON.stringify({
        event: status,
        runId: args.runId,
        epicId: metadata.activeEpicId,
        sliceId: metadata.activeSliceId,
        status,
        message: result.message,
      })}\n`,
      'utf8',
    );
    return {
      status,
      runStatus: 'test_result_ingested',
      message: result.message,
      sideEffects: [...result.sideEffects, { kind: 'append_file', path: reportPath }],
    };
  }

  await appendFile(
    reportPath,
    `${JSON.stringify({
      event: 'slice_integrated',
      runId: args.runId,
      epicId: metadata.activeEpicId,
      sliceId: metadata.activeSliceId,
      status: 'slice_integrated',
      sliceCommitSha: result.sliceCommitSha,
      integrationCommitSha: result.integrationCommitSha,
    })}\n`,
    'utf8',
  );
  const metadataEffect = await persistRunMetadata(metadataPath, {
    ...metadata,
    status: 'slice_integrated',
    integratedSliceCommits: {
      ...metadata.integratedSliceCommits,
      [metadata.activeSliceId]: result.integrationCommitSha,
    },
  });
  return {
    status: 'slice_integrated',
    runStatus: 'slice_integrated',
    sliceId: metadata.activeSliceId,
    integrationCommitSha: result.integrationCommitSha,
    sideEffects: [...result.sideEffects, { kind: 'append_file', path: reportPath }, metadataEffect],
  };
}

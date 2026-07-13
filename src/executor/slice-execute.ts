import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { GitSliceIntegrationPort } from './execution-ports.js';
import { populatedPlanPath } from './populate.js';
import { reportsPath } from './report.js';
import {
  assertSafeSliceId,
  runDirPath,
  runMetadataPath,
  persistRunMetadata,
  readRunMetadata,
  type RunMetadata,
} from './run.js';
import { sliceWorkspacePath } from './slice-workspace.js';

export type SliceExecutionRequestResult =
  | {
      readonly status: 'slice_workspace_failed';
      readonly runStatus: 'slice_started';
      readonly runId: string;
      readonly sliceId: string;
      readonly message: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'missing_run';
      readonly runStatus: 'not_started';
      readonly runId: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'slice_not_started';
      readonly runStatus: RunMetadata['status'];
      readonly runId: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'plan_slice_invalid';
      readonly runStatus: 'slice_started';
      readonly runId: string;
      readonly sliceId: string;
      readonly metadataPath: string;
      readonly message: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'slice_execution_requested';
      readonly runStatus: 'slice_execution_requested';
      readonly runId: string;
      readonly sliceId: string;
      readonly epicId?: string;
      readonly metadataPath: string;
      readonly reportsPath: string;
      readonly requestPath: string;
      readonly sideEffects: readonly (
        | { readonly kind: 'git_worktree_add'; readonly path: string; readonly ref: string }
        | { readonly kind: 'mkdir'; readonly path: string }
        | { readonly kind: 'write_file'; readonly path: string; readonly ifExists: 'overwrite' }
        | { readonly kind: 'append_file'; readonly path: string }
      )[];
    };

export function sliceExecutionRequestPath(cwd: string, runId: string, sliceId: string): string {
  assertSafeSliceId(sliceId);
  return join(runDirPath(cwd, runId), 'agent-output', sliceId, 'request.json');
}

export async function requestSliceExecution(args: {
  readonly cwd: string;
  readonly runId: string;
  readonly gitSliceIntegration: GitSliceIntegrationPort;
}): Promise<SliceExecutionRequestResult> {
  const metadataPath = runMetadataPath(args.cwd, args.runId);
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

  if (metadata.status !== 'slice_started' || !metadata.activeSliceId) {
    return {
      status: 'slice_not_started',
      runStatus: metadata.status,
      runId: args.runId,
      metadataPath,
      sideEffects: [],
    };
  }
  assertSafeSliceId(metadata.activeSliceId);

  const reportPath = metadata.reportsPath ?? reportsPath(args.cwd, args.runId);
  const runWorktreeDir = metadata.worktreeDir;
  if (!runWorktreeDir) {
    return {
      status: 'slice_workspace_failed',
      runStatus: 'slice_started',
      runId: args.runId,
      sliceId: metadata.activeSliceId,
      message: 'run worktree is unavailable',
      sideEffects: [],
    };
  }
  const sliceWorktreeDir = sliceWorkspacePath(args.cwd, args.runId, metadata.activeSliceId);
  const workspace = await args.gitSliceIntegration.prepare({
    runWorktreeDir,
    sliceWorktreeDir,
    sliceId: metadata.activeSliceId,
  });
  if (workspace.status === 'failed') {
    return {
      status: 'slice_workspace_failed',
      runStatus: 'slice_started',
      runId: args.runId,
      sliceId: metadata.activeSliceId,
      message: workspace.message,
      sideEffects: [],
    };
  }
  const requestPath = sliceExecutionRequestPath(args.cwd, args.runId, metadata.activeSliceId);
  const requestDir = dirname(requestPath);
  const sliceResult = await readPlanSlice({ cwd: args.cwd, metadata, sliceId: metadata.activeSliceId });
  if (sliceResult.status === 'invalid') {
    return {
      status: 'plan_slice_invalid',
      runStatus: 'slice_started',
      runId: args.runId,
      sliceId: metadata.activeSliceId,
      metadataPath,
      message: sliceResult.message,
      sideEffects: [],
    };
  }
  const slice = sliceResult.slice;
  const request = {
    runId: args.runId,
    sliceId: metadata.activeSliceId,
    ...(metadata.activeEpicId === undefined ? {} : { epicId: metadata.activeEpicId }),
    ...(slice?.scopeId ? { scopeId: slice.scopeId } : {}),
    action: 'execute_slice',
    status: 'requested',
    ...(slice?.definition ? { definition: slice.definition } : {}),
    ...(slice?.criteria ? { criteria: slice.criteria } : {}),
    ...(slice?.derivedFrom ? { derivedFrom: slice.derivedFrom } : {}),
    ...(slice?.designContext ? { designContext: slice.designContext } : {}),
    ...(slice?.verificationContext ? { verificationContext: slice.verificationContext } : {}),
    ...(slice?.criteria && slice.criteria.length > 0
      ? { instruction: 'Make the minimum change that satisfies every criterion.' }
      : {}),
  };
  const event = {
    event: 'slice_execution_requested',
    runId: args.runId,
    ...(metadata.activeEpicId === undefined ? {} : { epicId: metadata.activeEpicId }),
    sliceId: metadata.activeSliceId,
    status: 'slice_execution_requested',
  };
  const updated: RunMetadata = {
    ...metadata,
    status: 'slice_execution_requested',
    activeSliceWorkspaceDir: sliceWorktreeDir,
    activeSliceBaseSha: workspace.baseSha,
    sliceExecutionRequestPath: requestPath,
  };

  await mkdir(requestDir, { recursive: true });
  await writeFile(requestPath, `${JSON.stringify(request, null, 2)}\n`, 'utf8');
  await appendFile(reportPath, `${JSON.stringify(event)}\n`, 'utf8');
  const metadataEffect = await persistRunMetadata(metadataPath, updated);

  return {
    status: 'slice_execution_requested',
    runStatus: 'slice_execution_requested',
    runId: args.runId,
    sliceId: metadata.activeSliceId,
    ...(metadata.activeEpicId === undefined ? {} : { epicId: metadata.activeEpicId }),
    metadataPath,
    reportsPath: reportPath,
    requestPath,
    sideEffects: [
      ...workspace.sideEffects,
      { kind: 'mkdir', path: requestDir },
      { kind: 'write_file', path: requestPath, ifExists: 'overwrite' },
      { kind: 'append_file', path: reportPath },
      metadataEffect,
    ],
  };
}

interface PlanSliceRequestShape {
  readonly scope_id?: string;
  readonly definition?: string;
  readonly verification?: readonly { readonly kind?: string; readonly target?: string }[];
  readonly derived_from?: readonly string[];
  readonly design_context?: readonly { readonly item_id?: string; readonly content?: string }[];
  readonly verification_context?: readonly { readonly item_id?: string; readonly content?: string }[];
}

async function readPlanSlice(args: {
  readonly cwd: string;
  readonly metadata: RunMetadata;
  readonly sliceId: string;
}): Promise<
  | {
      readonly status: 'ok';
      readonly slice: {
        readonly scopeId?: string;
        readonly definition?: string;
        readonly criteria?: readonly { readonly kind: string; readonly target: string }[];
        readonly derivedFrom?: readonly string[];
        readonly designContext?: readonly { readonly itemId: string; readonly content: string }[];
        readonly verificationContext?: readonly { readonly itemId: string; readonly content: string }[];
      };
    }
  | {
      readonly status: 'invalid';
      readonly message: string;
    }
> {
  const planPath = args.metadata.populatedPlanPath ?? populatedPlanPath(args.cwd, args.metadata.runId);
  let payload: {
    readonly scope_handoff_required?: boolean;
    readonly slices?: readonly ({ readonly id?: string } & PlanSliceRequestShape)[];
  };
  try {
    payload = JSON.parse(await readFile(planPath, 'utf8')) as typeof payload;
  } catch (error) {
    return {
      status: 'invalid',
      message: `Could not read populated plan for ${args.sliceId}: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  const slice = payload.slices?.find((candidate) => candidate.id === args.sliceId);
  if (!slice) {
    return { status: 'invalid', message: `Populated plan does not contain active slice ${args.sliceId}.` };
  }
  const criteria = Array.isArray(slice.verification)
    ? slice.verification.flatMap((criterion) =>
        isNonBlank(criterion?.kind) && isNonBlank(criterion?.target)
          ? [{ kind: criterion.kind, target: criterion.target }]
          : [],
      )
    : [];
  const derivedFrom = Array.isArray(slice.derived_from) ? slice.derived_from.filter(isNonBlank) : [];
  const designContext = Array.isArray(slice.design_context)
    ? slice.design_context.flatMap((item) =>
        isNonBlank(item?.item_id) && isNonBlank(item?.content)
          ? [{ itemId: item.item_id, content: item.content }]
          : [],
      )
    : [];
  const verificationContext = Array.isArray(slice.verification_context)
    ? slice.verification_context.flatMap((item) =>
        isNonBlank(item?.item_id) && isNonBlank(item?.content)
          ? [{ itemId: item.item_id, content: item.content }]
          : [],
      )
    : [];
  if (payload.scope_handoff_required === true || typeof slice.scope_id === 'string') {
    const missing = [
      ...(!isNonBlank(slice.scope_id) ? ['scope_id'] : []),
      ...(!isNonBlank(slice.definition) ? ['definition'] : []),
      ...(criteria.length === 0 ? ['verification'] : []),
      ...(derivedFrom.length === 0 ? ['derived_from'] : []),
      ...(designContext.length === 0 ? ['design_context'] : []),
      ...(verificationContext.length === 0 ? ['verification_context'] : []),
    ];
    if (missing.length > 0) {
      return {
        status: 'invalid',
        message: `Scope slice ${args.sliceId} is missing valid ${missing.join(', ')}.`,
      };
    }
  }
  return {
    status: 'ok',
    slice: {
      ...(typeof slice.scope_id === 'string' ? { scopeId: slice.scope_id } : {}),
      ...(typeof slice.definition === 'string' ? { definition: slice.definition } : {}),
      ...(Array.isArray(slice.verification) ? { criteria } : {}),
      ...(Array.isArray(slice.derived_from) ? { derivedFrom } : {}),
      ...(Array.isArray(slice.design_context) ? { designContext } : {}),
      ...(Array.isArray(slice.verification_context) ? { verificationContext } : {}),
    },
  };
}

function isNonBlank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

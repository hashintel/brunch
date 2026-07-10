import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

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

export type SliceExecutionRequestResult =
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
      readonly status: 'slice_execution_requested';
      readonly runStatus: 'slice_execution_requested';
      readonly runId: string;
      readonly sliceId: string;
      readonly epicId: string;
      readonly metadataPath: string;
      readonly reportsPath: string;
      readonly requestPath: string;
      readonly sideEffects: readonly [
        { readonly kind: 'mkdir'; readonly path: string },
        { readonly kind: 'write_file'; readonly path: string; readonly ifExists: 'overwrite' },
        { readonly kind: 'append_file'; readonly path: string },
        { readonly kind: 'write_file'; readonly path: string; readonly ifExists: 'overwrite' },
      ];
    };

export function sliceExecutionRequestPath(cwd: string, runId: string, sliceId: string): string {
  assertSafeSliceId(sliceId);
  return join(runDirPath(cwd, runId), 'agent-output', sliceId, 'request.json');
}

export async function requestSliceExecution(args: {
  readonly cwd: string;
  readonly runId: string;
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

  if (metadata.status !== 'slice_started' || !metadata.activeSliceId || !metadata.activeEpicId) {
    return {
      status: 'slice_not_started',
      runStatus: metadata.status,
      runId: args.runId,
      metadataPath,
      sideEffects: [],
    };
  }

  const reportPath = metadata.reportsPath ?? reportsPath(args.cwd, args.runId);
  const requestPath = sliceExecutionRequestPath(args.cwd, args.runId, metadata.activeSliceId);
  const requestDir = dirname(requestPath);
  const slice = await readPlanSlice({ cwd: args.cwd, metadata, sliceId: metadata.activeSliceId });
  const request = {
    runId: args.runId,
    sliceId: metadata.activeSliceId,
    epicId: metadata.activeEpicId,
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
    epicId: metadata.activeEpicId,
    sliceId: metadata.activeSliceId,
    status: 'slice_execution_requested',
  };
  const updated: RunMetadata = {
    ...metadata,
    status: 'slice_execution_requested',
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
    epicId: metadata.activeEpicId,
    metadataPath,
    reportsPath: reportPath,
    requestPath,
    sideEffects: [
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
      readonly scopeId?: string;
      readonly definition?: string;
      readonly criteria?: readonly { readonly kind: string; readonly target: string }[];
      readonly derivedFrom?: readonly string[];
      readonly designContext?: readonly { readonly itemId: string; readonly content: string }[];
      readonly verificationContext?: readonly { readonly itemId: string; readonly content: string }[];
    }
  | undefined
> {
  const planPath = args.metadata.populatedPlanPath ?? populatedPlanPath(args.cwd, args.metadata.runId);
  try {
    const payload = JSON.parse(
      await import('node:fs/promises').then(({ readFile }) => readFile(planPath, 'utf8')),
    ) as {
      readonly slices?: readonly ({ readonly id?: string } & PlanSliceRequestShape)[];
    };
    const slice = payload.slices?.find((candidate) => candidate.id === args.sliceId);
    if (!slice) return undefined;
    return {
      ...(typeof slice.scope_id === 'string' ? { scopeId: slice.scope_id } : {}),
      ...(typeof slice.definition === 'string' ? { definition: slice.definition } : {}),
      ...(Array.isArray(slice.verification)
        ? {
            criteria: slice.verification.flatMap((criterion) =>
              typeof criterion?.kind === 'string' && typeof criterion?.target === 'string'
                ? [{ kind: criterion.kind, target: criterion.target }]
                : [],
            ),
          }
        : {}),
      ...(Array.isArray(slice.derived_from)
        ? { derivedFrom: slice.derived_from.filter((value): value is string => typeof value === 'string') }
        : {}),
      ...(Array.isArray(slice.design_context)
        ? {
            designContext: slice.design_context.flatMap((item) =>
              typeof item?.item_id === 'string' && typeof item?.content === 'string'
                ? [{ itemId: item.item_id, content: item.content }]
                : [],
            ),
          }
        : {}),
      ...(Array.isArray(slice.verification_context)
        ? {
            verificationContext: slice.verification_context.flatMap((item) =>
              typeof item?.item_id === 'string' && typeof item?.content === 'string'
                ? [{ itemId: item.item_id, content: item.content }]
                : [],
            ),
          }
        : {}),
    };
  } catch {
    return undefined;
  }
}

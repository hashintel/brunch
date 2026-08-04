import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { populatedPlanPath } from './populate.js';
import {
  runExecutionActive,
  withRunExecutionAuthority,
  type RunExecutionActiveResult,
} from './run-execution-authority.js';
import { runDirPath, runMetadataPath, persistRunMetadata, readRunMetadata, type RunMetadata } from './run.js';

export type SourcePolicyKind = 'plan_only' | 'host_source_deferred';

export type SourcePolicyResult =
  | RunExecutionActiveResult
  | {
      readonly status: 'missing_run';
      readonly runStatus: 'not_started';
      readonly runId: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'missing_populated_plan';
      readonly runStatus: RunMetadata['status'];
      readonly runId: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'source_policy_selected';
      readonly runStatus: 'source_policy_selected';
      readonly runId: string;
      readonly metadataPath: string;
      readonly sourcePolicyPath: string;
      readonly policy: SourcePolicyKind;
      readonly sideEffects: readonly [
        { readonly kind: 'write_file'; readonly path: string; readonly ifExists: 'overwrite' },
        { readonly kind: 'write_file'; readonly path: string; readonly ifExists: 'overwrite' },
      ];
    };

export function sourcePolicyPath(cwd: string, runId: string): string {
  return join(runDirPath(cwd, runId), 'source-policy.json');
}

export async function selectSourcePolicy(args: {
  readonly cwd: string;
  readonly runId: string;
  readonly policy: SourcePolicyKind;
}): Promise<SourcePolicyResult> {
  return withRunExecutionAuthority({
    cwd: args.cwd,
    runId: args.runId,
    execute: () => selectSourcePolicyOwned(args),
    onContended: () => runExecutionActive(args.runId),
  });
}

async function selectSourcePolicyOwned(args: {
  readonly cwd: string;
  readonly runId: string;
  readonly policy: SourcePolicyKind;
}): Promise<SourcePolicyResult> {
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

  if (!(await fileExists(metadata.populatedPlanPath ?? populatedPlanPath(args.cwd, args.runId)))) {
    return {
      status: 'missing_populated_plan',
      runStatus: metadata.status,
      runId: args.runId,
      metadataPath,
      sideEffects: [],
    };
  }

  const policyPath = sourcePolicyPath(args.cwd, args.runId);
  const updated: RunMetadata = {
    ...metadata,
    status: 'source_policy_selected',
    sourcePolicy: args.policy,
    sourcePolicyPath: policyPath,
  };

  await writeFile(
    policyPath,
    `${JSON.stringify({ policy: args.policy, hostSourceCopied: false }, null, 2)}\n`,
    'utf8',
  );
  const metadataEffect = await persistRunMetadata(metadataPath, updated);

  return {
    status: 'source_policy_selected',
    runStatus: 'source_policy_selected',
    runId: args.runId,
    metadataPath,
    sourcePolicyPath: policyPath,
    policy: args.policy,
    sideEffects: [{ kind: 'write_file', path: policyPath, ifExists: 'overwrite' }, metadataEffect],
  };
}

// Deliberately not `path-exists.ts`'s `pathExists`: this reads the file, so it also
// answers false for a directory or a file the process cannot decode as UTF-8. The two
// sibling checks of the same populated-plan path (`launch.ts`, `run-freshness.ts`) use
// the shared existence predicate, so the stricter form here is an unadjudicated
// difference rather than a stated contract — it arrived whole with the file in FE-1089.
// Do not collapse it into the shared predicate without deciding which check this call
// site wants; doing so would widen what counts as a present populated plan.
async function fileExists(path: string): Promise<boolean> {
  try {
    await readFile(path, 'utf8');
    return true;
  } catch {
    return false;
  }
}

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { populatedPlanPath } from './populate.js';
import {
  cookRunDir,
  cookRunMetadataPath,
  persistCookRunMetadata,
  readCookRunMetadata,
  type CookRunMetadata,
} from './run.js';

export type CookSourcePolicyKind = 'plan_only' | 'host_source_deferred';

export type CookSourcePolicyResult =
  | {
      readonly status: 'missing_run';
      readonly runStatus: 'not_started';
      readonly runId: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'missing_populated_plan';
      readonly runStatus: CookRunMetadata['status'];
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
      readonly policy: CookSourcePolicyKind;
      readonly sideEffects: readonly [
        { readonly kind: 'write_file'; readonly path: string; readonly ifExists: 'overwrite' },
        { readonly kind: 'write_file'; readonly path: string; readonly ifExists: 'overwrite' },
      ];
    };

export function sourcePolicyPath(cwd: string, runId: string): string {
  return join(cookRunDir(cwd, runId), 'source-policy.json');
}

export async function selectCookSourcePolicy(args: {
  readonly cwd: string;
  readonly runId: string;
  readonly policy: CookSourcePolicyKind;
}): Promise<CookSourcePolicyResult> {
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
  const updated: CookRunMetadata = {
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
  const metadataEffect = await persistCookRunMetadata(metadataPath, updated);

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

async function fileExists(path: string): Promise<boolean> {
  try {
    await readFile(path, 'utf8');
    return true;
  } catch {
    return false;
  }
}

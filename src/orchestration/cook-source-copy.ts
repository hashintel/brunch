import { cp, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { cookRunMetadataPath, readCookRunMetadata, type CookRunMetadata } from './cook-run.js';
import { sourcePolicyPath, type CookSourcePolicyKind } from './cook-source-policy.js';
import { cookWorktreeDir } from './cook-worktree.js';

const EXCLUDED_TOP_LEVEL_ENTRIES = new Set(['.brunch', '.git', 'node_modules', 'dist', 'build']);

type CopyEntryEffect = { readonly kind: 'copy_entry'; readonly from: string; readonly to: string };
type WriteFileEffect = { readonly kind: 'write_file'; readonly path: string; readonly ifExists: 'overwrite' };

export type CookSourceCopyResult =
  | {
      readonly status: 'missing_run';
      readonly runStatus: 'not_started';
      readonly runId: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'missing_source_policy';
      readonly runStatus: CookRunMetadata['status'];
      readonly runId: string;
      readonly metadataPath: string;
      readonly sourcePolicyPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'policy_skipped';
      readonly runStatus: CookRunMetadata['status'];
      readonly runId: string;
      readonly metadataPath: string;
      readonly policy: CookSourcePolicyKind;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'source_copied';
      readonly runStatus: 'source_copied';
      readonly runId: string;
      readonly metadataPath: string;
      readonly sourcePolicyPath: string;
      readonly copiedEntries: readonly string[];
      readonly sideEffects: readonly [...CopyEntryEffect[], WriteFileEffect, WriteFileEffect];
    };

export async function copyCookHostSource(args: {
  readonly cwd: string;
  readonly runId: string;
}): Promise<CookSourceCopyResult> {
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

  const policyPath = metadata.sourcePolicyPath ?? sourcePolicyPath(args.cwd, args.runId);
  const policy = await readSourcePolicy(policyPath);
  if (!policy) {
    return {
      status: 'missing_source_policy',
      runStatus: metadata.status,
      runId: args.runId,
      metadataPath,
      sourcePolicyPath: policyPath,
      sideEffects: [],
    };
  }

  if (policy.policy === 'plan_only') {
    return {
      status: 'policy_skipped',
      runStatus: metadata.status,
      runId: args.runId,
      metadataPath,
      policy: policy.policy,
      sideEffects: [],
    };
  }

  const worktreeDir = metadata.worktreeDir ?? cookWorktreeDir(args.cwd, args.runId);
  const entries = (await readdir(args.cwd)).filter((entry) => !EXCLUDED_TOP_LEVEL_ENTRIES.has(entry)).sort();
  const copyEffects: CopyEntryEffect[] = [];

  for (const entry of entries) {
    const from = join(args.cwd, entry);
    const to = join(worktreeDir, entry);
    await cp(from, to, { recursive: true, force: true, dereference: false });
    copyEffects.push({ kind: 'copy_entry', from, to });
  }

  const updatedPolicy = { ...policy, hostSourceCopied: true, copiedEntries: entries };
  const updatedMetadata: CookRunMetadata = {
    ...metadata,
    status: 'source_copied',
    sourceCopied: true,
    copiedEntries: entries,
  };

  await writeFile(policyPath, `${JSON.stringify(updatedPolicy, null, 2)}\n`, 'utf8');
  await writeFile(metadataPath, `${JSON.stringify(updatedMetadata, null, 2)}\n`, 'utf8');

  return {
    status: 'source_copied',
    runStatus: 'source_copied',
    runId: args.runId,
    metadataPath,
    sourcePolicyPath: policyPath,
    copiedEntries: entries,
    sideEffects: [
      ...copyEffects,
      { kind: 'write_file', path: policyPath, ifExists: 'overwrite' },
      { kind: 'write_file', path: metadataPath, ifExists: 'overwrite' },
    ],
  };
}

async function readSourcePolicy(
  path: string,
): Promise<
  { policy: CookSourcePolicyKind; hostSourceCopied: boolean; copiedEntries?: string[] } | undefined
> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as {
      policy: CookSourcePolicyKind;
      hostSourceCopied: boolean;
      copiedEntries?: string[];
    };
  } catch {
    return undefined;
  }
}

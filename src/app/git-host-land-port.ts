import { lstat, mkdir, readdir, realpath, rm } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';

import type {
  GitHostLandIntegrateResult,
  GitHostLandInspectResult,
  GitHostLandMaterializeResult,
  GitHostLandPort,
  GitHostLandTargetClassification,
} from '../executor/execution-ports.js';
import { runCommand, type CommandResult, type CommandRunner } from './command-runner.js';

const GIT_TIMEOUT_MS = 30_000;
const GIT_MAX_OUTPUT_BYTES = 64 * 1024;
const GIT_IDENTITY = ['-c', 'user.name=brunch', '-c', 'user.email=cook@brunch'] as const;

export function createGitHostLandPort(options: { readonly run?: CommandRunner } = {}): GitHostLandPort {
  const run = options.run ?? runCommand;
  const command = (cwd: string, args: readonly string[]) =>
    run('git', args, { cwd, timeoutMs: GIT_TIMEOUT_MS, maxOutputBytes: GIT_MAX_OUTPUT_BYTES });

  return {
    async inspect(args) {
      const [target, runRepo] = await Promise.all([
        canonicalPath(args.targetDir),
        canonicalPath(args.runWorktreeDir),
      ]);
      if (target === runRepo) return { status: 'refused', reason: 'target_aliases_run', sideEffects: [] };
      if (args.strategy === 'materialize' && isPathInside(target, runRepo)) {
        return { status: 'refused', reason: 'target_inside_run', sideEffects: [] };
      }

      const tip = await command(args.runWorktreeDir, [
        'rev-parse',
        '--verify',
        '--quiet',
        `refs/heads/${args.reviewRef}`,
      ]);
      if (tip.exitCode !== 0) return failedInspect(tip, `cannot resolve review ref ${args.reviewRef}`);
      const reviewTipSha = tip.stdout.trim();
      if (reviewTipSha !== args.expectedTipSha) {
        return { status: 'refused', reason: 'ref_moved', sideEffects: [] };
      }

      const ancestor = await command(args.runWorktreeDir, [
        'merge-base',
        '--is-ancestor',
        args.runBaseSha,
        reviewTipSha,
      ]);
      if (ancestor.exitCode !== 0) {
        return failedInspect(ancestor, 'run base is not an ancestor of the promoted review tip');
      }
      const [log, diff] = await Promise.all([
        command(args.runWorktreeDir, [
          'log',
          '--reverse',
          '--format=%H%x09%s',
          `${args.runBaseSha}..${reviewTipSha}`,
        ]),
        command(args.runWorktreeDir, ['diff', '--name-status', args.runBaseSha, reviewTipSha]),
      ]);
      if (log.exitCode !== 0 || log.outputTruncated) {
        return failedInspect(log, 'cannot inspect the complete landing commit range');
      }
      if (diff.exitCode !== 0 || diff.outputTruncated) {
        return failedInspect(diff, 'cannot inspect the complete landing tree range');
      }
      const commits = parseCommitRange(log.stdout);
      const changedPaths = parseChangedPaths(diff.stdout);

      if (args.strategy === 'materialize') {
        let targetClassification: Awaited<ReturnType<typeof classifyMaterializeTarget>>;
        try {
          targetClassification = await classifyMaterializeTarget(args.targetDir);
        } catch (error) {
          return {
            status: 'failed',
            message: error instanceof Error ? error.message : 'cannot classify materialization target',
            sideEffects: [],
          };
        }
        const replay =
          targetClassification.kind === 'occupied_directory'
            ? await replayMaterializedTarget(command, args)
            : undefined;
        const inspectionTarget: GitHostLandTargetClassification = replay
          ? {
              kind: 'materialized_repository',
              path: replay.targetDir,
              branch: replay.branch,
              landedSha: replay.landedSha,
            }
          : targetClassification;
        return {
          status: 'inspected',
          runBaseSha: args.runBaseSha,
          reviewTipSha,
          commits,
          changedPaths,
          target: inspectionTarget,
          conflictRehearsal: { status: 'not_applicable' },
          admissible:
            inspectionTarget.kind === 'missing' ||
            inspectionTarget.kind === 'empty_directory' ||
            inspectionTarget.kind === 'materialized_repository',
          sideEffects: [],
        };
      }

      const rootCheck = await checkExactRoot(command, args.targetDir);
      if (rootCheck.kind === 'failed')
        return failedInspect(rootCheck.result, 'cannot resolve target git root');
      if (rootCheck.kind === 'not_root') {
        return {
          status: 'failed',
          message: 'landing target is not an exact repository root',
          sideEffects: [],
        };
      }
      const [branch, status] = await Promise.all([
        command(args.targetDir, ['symbolic-ref', '--quiet', '--short', 'HEAD']),
        command(args.targetDir, ['status', '--porcelain']),
      ]);
      if (status.exitCode !== 0 || status.outputTruncated) {
        return failedInspect(status, 'cannot inspect the complete target worktree status');
      }
      const worktree = parseWorktreeStatus(status.stdout);
      const rehearsal = await rehearseMerge(command, args.targetDir, reviewTipSha);
      if (rehearsal.status === 'failed') return rehearsal;
      const untrackedCollision = worktree.untrackedPaths.some((path) =>
        changedPaths.some((changed) => changed.path === path),
      );
      const targetClassification = {
        kind: 'repository' as const,
        path: args.targetDir,
        branch: branch.exitCode === 0 ? branch.stdout.trim() : undefined,
        trackedDirtyPaths: worktree.trackedDirtyPaths,
        untrackedPaths: worktree.untrackedPaths,
      };
      return {
        status: 'inspected',
        runBaseSha: args.runBaseSha,
        reviewTipSha,
        commits,
        changedPaths,
        target: targetClassification,
        conflictRehearsal: rehearsal.result,
        admissible:
          targetClassification.branch !== undefined &&
          targetClassification.trackedDirtyPaths.length === 0 &&
          rehearsal.result.status === 'clean' &&
          !untrackedCollision,
        sideEffects: [],
      };
    },

    async integrate(args) {
      const rootCheck = await checkExactRoot(command, args.hostDir);
      if (rootCheck.kind === 'failed') return failedIntegrate(rootCheck.result, 'cannot resolve git root');
      if (rootCheck.kind === 'not_root') {
        return { status: 'refused', reason: 'not_a_repo_root', sideEffects: [] };
      }

      const branch = await command(args.hostDir, ['symbolic-ref', '--quiet', '--short', 'HEAD']);
      if (branch.exitCode !== 0) return { status: 'refused', reason: 'detached', sideEffects: [] };
      const hostBranch = branch.stdout.trim();

      // Staged or tracked-dirty state refuses (a merge would bury it); untracked
      // files coexist — git itself aborts if the incoming tree would overwrite one.
      const status = await command(args.hostDir, ['status', '--porcelain']);
      if (status.exitCode !== 0) return failedIntegrate(status, 'cannot inspect host worktree');
      const trackedDirty = status.stdout
        .split('\n')
        .filter((line) => line.trim().length > 0 && !line.startsWith('??'))
        .map((line) => line.slice(3).trim());
      if (trackedDirty.length > 0) {
        return { status: 'refused', reason: 'dirty', paths: trackedDirty, sideEffects: [] };
      }

      const tip = await command(args.hostDir, [
        'rev-parse',
        '--verify',
        '--quiet',
        `refs/heads/${args.reviewRef}`,
      ]);
      if (tip.exitCode !== 0) {
        return failedIntegrate(tip, `review ref ${args.reviewRef} is not visible in the host repository`);
      }
      const tipSha = tip.stdout.trim();
      if (tipSha !== args.expectedTipSha) {
        return { status: 'refused', reason: 'ref_moved', sideEffects: [] };
      }

      const ancestor = await command(args.hostDir, ['merge-base', '--is-ancestor', 'HEAD', tipSha]);
      if (ancestor.exitCode === 0) {
        const ff = await command(args.hostDir, ['merge', '--ff-only', tipSha]);
        if (ff.exitCode !== 0) {
          if (mentionsUntrackedOverwrite(ff)) {
            return { status: 'refused', reason: 'untracked_collision', sideEffects: [] };
          }
          return failedIntegrate(ff, 'fast-forward failed');
        }
        return {
          status: 'landed',
          via: 'fast_forward',
          branch: hostBranch,
          landedSha: tipSha,
          sideEffects: [{ kind: 'host_branch_advance', path: args.hostDir, branch: hostBranch, sha: tipSha }],
        };
      }

      const merge = await command(args.hostDir, [
        ...GIT_IDENTITY,
        'merge',
        '--no-edit',
        '-m',
        args.message,
        tipSha,
      ]);
      if (merge.exitCode !== 0) {
        const inProgress = await command(args.hostDir, ['rev-parse', '--verify', '--quiet', 'MERGE_HEAD']);
        if (inProgress.exitCode === 0) {
          const conflicted = await command(args.hostDir, ['diff', '--name-only', '--diff-filter=U']);
          const abort = await command(args.hostDir, ['merge', '--abort']);
          if (abort.exitCode !== 0) return failedIntegrate(abort, 'cannot abort the conflicted merge');
          return {
            status: 'conflict',
            conflictedPaths: conflicted.stdout
              .split('\n')
              .map((line) => line.trim())
              .filter(Boolean),
            sideEffects: [],
          };
        }
        if (mentionsUntrackedOverwrite(merge)) {
          return { status: 'refused', reason: 'untracked_collision', sideEffects: [] };
        }
        return failedIntegrate(merge, 'merge failed');
      }

      const landed = await command(args.hostDir, ['rev-parse', 'HEAD']);
      if (landed.exitCode !== 0) return failedIntegrate(landed, 'cannot resolve merged host HEAD');
      const landedSha = landed.stdout.trim();
      return {
        status: 'landed',
        via: 'merge',
        branch: hostBranch,
        landedSha,
        sideEffects: [
          { kind: 'host_branch_advance', path: args.hostDir, branch: hostBranch, sha: landedSha },
        ],
      };
    },

    async materialize(args) {
      const [target, runRepo] = await Promise.all([
        canonicalPath(args.targetDir),
        canonicalPath(args.runWorktreeDir),
      ]);
      if (target === runRepo) return { status: 'refused', reason: 'target_aliases_run', sideEffects: [] };
      if (isPathInside(target, runRepo)) {
        return { status: 'refused', reason: 'target_inside_run', sideEffects: [] };
      }
      await mkdir(args.targetDir, { recursive: true });

      // ceiling: greenfield materialization accepts only missing/empty targets;
      // add an explicit existing-repository landing mode if product evidence requires it.
      const entries = await readdir(args.targetDir);
      if (entries.length > 0) {
        const replay = await replayMaterializedTarget(command, args);
        return replay ?? { status: 'refused', reason: 'occupied_target', sideEffects: [] };
      }

      // The target was verified empty, so a non-landed outcome restores it to
      // empty — no orphan .git may block the retry after the failure is fixed.
      const result = await materializeIntoEmptyTarget(command, args);
      if (result.status !== 'landed') await restoreEmptyTarget(args.targetDir);
      return result;
    },
  };
}

function parseCommitRange(output: string): readonly { readonly sha: string; readonly subject: string }[] {
  return output
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [sha = '', ...subject] = line.split('\t');
      return { sha, subject: subject.join('\t') };
    });
}

function parseChangedPaths(output: string): readonly { readonly status: string; readonly path: string }[] {
  return output
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [status = '', ...paths] = line.split('\t');
      return { status, path: paths.join(' -> ') };
    });
}

async function classifyMaterializeTarget(
  targetDir: string,
): Promise<
  | { readonly kind: 'missing'; readonly path: string }
  | { readonly kind: 'empty_directory'; readonly path: string }
  | { readonly kind: 'occupied_directory'; readonly path: string; readonly entries: readonly string[] }
> {
  try {
    const target = await lstat(targetDir);
    if (!target.isDirectory()) {
      return { kind: 'occupied_directory', path: targetDir, entries: [basename(targetDir)] };
    }
    const entries = await readdir(targetDir);
    return entries.length === 0
      ? { kind: 'empty_directory', path: targetDir }
      : { kind: 'occupied_directory', path: targetDir, entries: entries.sort() };
  } catch (error) {
    if (isErrno(error, 'ENOENT')) return { kind: 'missing', path: targetDir };
    throw error;
  }
}

function parseWorktreeStatus(output: string): {
  readonly trackedDirtyPaths: readonly string[];
  readonly untrackedPaths: readonly string[];
} {
  const lines = output.split('\n').filter(Boolean);
  return {
    trackedDirtyPaths: lines.filter((line) => !line.startsWith('??')).map((line) => line.slice(3).trim()),
    untrackedPaths: lines.filter((line) => line.startsWith('??')).map((line) => line.slice(3).trim()),
  };
}

async function rehearseMerge(
  command: (cwd: string, args: readonly string[]) => Promise<CommandResult>,
  targetDir: string,
  reviewTipSha: string,
): Promise<
  | { readonly status: 'ready'; readonly result: { readonly status: 'clean' } }
  | {
      readonly status: 'ready';
      readonly result: { readonly status: 'conflicts'; readonly paths: readonly string[] };
    }
  | Extract<GitHostLandInspectResult, { status: 'failed' }>
> {
  const ancestor = await command(targetDir, ['merge-base', '--is-ancestor', 'HEAD', reviewTipSha]);
  if (ancestor.exitCode === 0) return { status: 'ready', result: { status: 'clean' } };

  const mergeBase = await command(targetDir, ['merge-base', 'HEAD', reviewTipSha]);
  if (mergeBase.exitCode !== 0) return failedInspect(mergeBase, 'cannot find a target/review merge base');
  const rehearsal = await command(targetDir, ['merge-tree', mergeBase.stdout.trim(), 'HEAD', reviewTipSha]);
  if (rehearsal.exitCode !== 0 || rehearsal.outputTruncated) {
    return failedInspect(rehearsal, 'cannot rehearse the complete target merge');
  }
  const paths = parseMergeTreeConflictPaths(rehearsal.stdout);
  return paths.length === 0
    ? { status: 'ready', result: { status: 'clean' } }
    : { status: 'ready', result: { status: 'conflicts', paths } };
}

function parseMergeTreeConflictPaths(output: string): readonly string[] {
  const conflicts = new Set<string>();
  let path: string | undefined;
  for (const line of output.split('\n')) {
    const entry = /^\s+(?:base|our)\s+\d+\s+[0-9a-f]+\s+(.+)$/u.exec(line);
    if (entry?.[1]) path = entry[1];
    if (/^\+?<<<<<<< \.our/u.test(line) && path) conflicts.add(path);
  }
  return [...conflicts].sort();
}

async function replayMaterializedTarget(
  command: (cwd: string, args: readonly string[]) => Promise<CommandResult>,
  args: {
    readonly runWorktreeDir: string;
    readonly expectedTipSha: string;
    readonly targetDir: string;
    readonly branch: string;
    readonly message: string;
  },
): Promise<Extract<GitHostLandMaterializeResult, { status: 'landed' }> | undefined> {
  const root = await checkExactRoot(command, args.targetDir);
  if (root.kind !== 'root') return undefined;

  const [branch, status, rootCommit, head, headTree, expectedTree, identity] = await Promise.all([
    command(args.targetDir, ['symbolic-ref', '--quiet', '--short', 'HEAD']),
    command(args.targetDir, ['status', '--porcelain']),
    command(args.targetDir, ['rev-list', '--parents', '-n', '1', 'HEAD']),
    command(args.targetDir, ['rev-parse', 'HEAD']),
    command(args.targetDir, ['rev-parse', 'HEAD^{tree}']),
    command(args.targetDir, ['rev-parse', `${args.expectedTipSha}^{tree}`]),
    command(args.targetDir, ['log', '-1', '--format=%an%n%ae%n%s']),
  ]);
  if (
    [branch, status, rootCommit, head, headTree, expectedTree, identity].some(
      (result) => result.exitCode !== 0,
    )
  ) {
    return undefined;
  }
  const isBrunchMaterialization =
    branch.stdout.trim() === args.branch &&
    status.stdout.trim() === '' &&
    rootCommit.stdout.trim().split(/\s+/u).length === 1 &&
    headTree.stdout.trim() === expectedTree.stdout.trim() &&
    identity.stdout.trim() === `brunch\ncook@brunch\n${args.message}`;
  if (!isBrunchMaterialization) return undefined;

  return {
    status: 'landed',
    branch: args.branch,
    landedSha: head.stdout.trim(),
    targetDir: args.targetDir,
    sideEffects: [],
  };
}

async function materializeIntoEmptyTarget(
  command: (cwd: string, args: readonly string[]) => Promise<CommandResult>,
  args: {
    readonly runWorktreeDir: string;
    readonly reviewRef: string;
    readonly expectedTipSha: string;
    readonly targetDir: string;
    readonly branch: string;
    readonly message: string;
  },
): Promise<GitHostLandMaterializeResult> {
  const init = await command(args.targetDir, ['init', '-q', '-b', args.branch]);
  if (init.exitCode !== 0) return failedMaterialize(init, 'cannot initialize the target repository');

  const fetch = await command(args.targetDir, ['fetch', '--quiet', args.runWorktreeDir, args.reviewRef]);
  if (fetch.exitCode !== 0) {
    return failedMaterialize(fetch, 'cannot fetch the review ref from the run repository');
  }
  const fetched = await command(args.targetDir, ['rev-parse', 'FETCH_HEAD']);
  if (fetched.exitCode !== 0) return failedMaterialize(fetched, 'cannot resolve the fetched review ref');
  if (fetched.stdout.trim() !== args.expectedTipSha) {
    return { status: 'refused', reason: 'ref_moved', sideEffects: [] };
  }

  // One clean brunch-authored initial commit carrying the promoted tip tree;
  // run history stays in the run repository as provenance.
  const commit = await command(args.targetDir, [
    ...GIT_IDENTITY,
    'commit-tree',
    `${args.expectedTipSha}^{tree}`,
    '-m',
    args.message,
  ]);
  if (commit.exitCode !== 0) return failedMaterialize(commit, 'cannot create the initial commit');
  const landedSha = commit.stdout.trim();

  const ref = await command(args.targetDir, ['update-ref', `refs/heads/${args.branch}`, landedSha]);
  if (ref.exitCode !== 0) return failedMaterialize(ref, 'cannot point the initial branch');
  const checkout = await command(args.targetDir, ['reset', '--hard', '--quiet']);
  if (checkout.exitCode !== 0) return failedMaterialize(checkout, 'cannot materialize the working tree');

  return {
    status: 'landed',
    branch: args.branch,
    landedSha,
    targetDir: args.targetDir,
    sideEffects: [{ kind: 'git_materialize', path: args.targetDir, branch: args.branch, sha: landedSha }],
  };
}

async function restoreEmptyTarget(targetDir: string): Promise<void> {
  const entries = await readdir(targetDir);
  await Promise.all(entries.map((entry) => rm(join(targetDir, entry), { recursive: true, force: true })));
}

function mentionsUntrackedOverwrite(result: CommandResult): boolean {
  return `${result.stderr}\n${result.stdout}`.includes('untracked working tree files would be overwritten');
}

type ExactRootCheck =
  | { readonly kind: 'root' }
  | { readonly kind: 'not_root' }
  | { readonly kind: 'failed'; readonly result: CommandResult };

async function checkExactRoot(
  command: (cwd: string, args: readonly string[]) => Promise<CommandResult>,
  dir: string,
): Promise<ExactRootCheck> {
  const root = await command(dir, ['rev-parse', '--show-toplevel']);
  if (root.exitCode !== 0) return { kind: 'failed', result: root };
  const [actual, expected] = await Promise.all([canonicalPath(root.stdout.trim()), canonicalPath(dir)]);
  return actual === expected ? { kind: 'root' } : { kind: 'not_root' };
}

async function canonicalPath(path: string): Promise<string> {
  try {
    return await realpath(path);
  } catch {
    const resolved = resolve(path);
    const parent = dirname(resolved);
    return parent === resolved ? resolved : join(await canonicalPath(parent), basename(resolved));
  }
}

function isPathInside(child: string, parent: string): boolean {
  const rel = relative(parent, child);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}

function message(result: CommandResult, fallback: string): string {
  return result.stderr.trim() || result.stdout.trim() || result.spawnError || fallback;
}

function isErrno(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === code;
}

function failedInspect(
  result: CommandResult,
  fallback: string,
): Extract<GitHostLandInspectResult, { status: 'failed' }> {
  return { status: 'failed', message: message(result, fallback), sideEffects: [] };
}

function failedIntegrate(result: CommandResult, fallback: string): GitHostLandIntegrateResult {
  return { status: 'failed', message: message(result, fallback), sideEffects: [] };
}

function failedMaterialize(result: CommandResult, fallback: string): GitHostLandMaterializeResult {
  return { status: 'failed', message: message(result, fallback), sideEffects: [] };
}

import { mkdir, readdir, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';

import type {
  GitHostLandIntegrateResult,
  GitHostLandMaterializeResult,
  GitHostLandPort,
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
    async integrate(args) {
      const rootFailure = await exactRootFailure(command, args.hostDir);
      if (rootFailure) {
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
      await mkdir(args.targetDir, { recursive: true });
      const [target, runRepo] = await Promise.all([
        canonicalPath(args.targetDir),
        canonicalPath(args.runWorktreeDir),
      ]);
      if (target === runRepo) return { status: 'refused', reason: 'target_aliases_run', sideEffects: [] };
      if (isPathInside(target, runRepo)) {
        return { status: 'refused', reason: 'target_inside_run', sideEffects: [] };
      }

      // ceiling: only missing/empty targets land in the tracer; fresh `git init`
      // targets and existing repos (brunch/run/<runId> branch) ride slice 2.
      const entries = await readdir(args.targetDir);
      if (entries.length > 0) return { status: 'refused', reason: 'occupied_target', sideEffects: [] };

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
    },
  };
}

function mentionsUntrackedOverwrite(result: CommandResult): boolean {
  return `${result.stderr}\n${result.stdout}`.includes('untracked working tree files would be overwritten');
}

async function exactRootFailure(
  command: (cwd: string, args: readonly string[]) => Promise<CommandResult>,
  dir: string,
): Promise<string | undefined> {
  const root = await command(dir, ['rev-parse', '--show-toplevel']);
  if (root.exitCode !== 0) return message(root, 'cannot resolve git root');
  const [actual, expected] = await Promise.all([canonicalPath(root.stdout.trim()), canonicalPath(dir)]);
  return actual === expected ? undefined : `git root is ${root.stdout.trim()}`;
}

async function canonicalPath(path: string): Promise<string> {
  try {
    return await realpath(path);
  } catch {
    return resolve(path);
  }
}

function isPathInside(child: string, parent: string): boolean {
  const rel = relative(parent, child);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}

function message(result: CommandResult, fallback: string): string {
  return result.stderr.trim() || result.stdout.trim() || result.spawnError || fallback;
}

function failedIntegrate(result: CommandResult, fallback: string): GitHostLandIntegrateResult {
  return { status: 'failed', message: message(result, fallback), sideEffects: [] };
}

function failedMaterialize(result: CommandResult, fallback: string): GitHostLandMaterializeResult {
  return { status: 'failed', message: message(result, fallback), sideEffects: [] };
}

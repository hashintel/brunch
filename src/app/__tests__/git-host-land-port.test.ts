import { execFile } from 'node:child_process';
import { access, mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';

import { createGitHostLandPort } from '../git-host-land-port.js';
import { createGitRunPromotionPort } from '../git-run-promotion-port.js';

const execFileAsync = promisify(execFile);
const BRUNCH_IDENTITY = ['-c', 'user.name=brunch', '-c', 'user.email=cook@brunch'] as const;
const REVIEW_REF = 'brunch/review/run-1';

async function git(cwd: string, args: readonly string[]): Promise<string> {
  const result = await execFileAsync('git', [...args], { cwd });
  return result.stdout.trim();
}

async function commitFile(cwd: string, path: string, content: string, subject: string): Promise<void> {
  await writeFile(join(cwd, path), content, 'utf8');
  await git(cwd, ['add', '-A', '--', '.', ':(exclude).brunch']);
  await git(cwd, [...BRUNCH_IDENTITY, 'commit', '-q', '-m', subject]);
}

/**
 * The multi-commit contrastive fixture: an initial host base, a detached run
 * worktree with TWO slice-integration commits, then an uncommitted file plus
 * planted .brunch bookkeeping at promote time, so the real promotion adapter
 * creates the final promotion commit and pins brunch/review/run-1. Today's
 * `commitSha^..commitSha` patch semantics would deliver only the final commit
 * (src/c.ts) — every completeness assertion on src/a.ts / src/b.ts is the
 * contrast that kills that behavior.
 */
async function createBrownfieldFixture(prefix: string): Promise<{
  hostDir: string;
  runWorktreeDir: string;
  baseSha: string;
  tipSha: string;
}> {
  const root = await mkdtemp(join(tmpdir(), prefix));
  const hostDir = join(root, 'host');
  await mkdir(hostDir, { recursive: true });
  await git(hostDir, ['init', '-q', '-b', 'main']);
  await commitFile(hostDir, 'base.txt', 'base\n', 'host base');
  const baseSha = await git(hostDir, ['rev-parse', 'HEAD']);

  const runWorktreeDir = join(root, 'run-worktree');
  await git(hostDir, ['worktree', 'add', '--detach', runWorktreeDir, baseSha]);
  await mkdir(join(runWorktreeDir, 'src'), { recursive: true });
  await commitFile(runWorktreeDir, join('src', 'a.ts'), 'export const a = 1;\n', 'brunch: integrate slice a');
  await commitFile(runWorktreeDir, join('src', 'b.ts'), 'export const b = 2;\n', 'brunch: integrate slice b');
  await writeFile(join(runWorktreeDir, 'src', 'c.ts'), 'export const c = 3;\n', 'utf8');
  await mkdir(join(runWorktreeDir, '.brunch', 'cook'), { recursive: true });
  await writeFile(join(runWorktreeDir, '.brunch', 'cook', 'plan.json'), '{"planted":true}\n', 'utf8');

  const promoted = await createGitRunPromotionPort().promote({
    worktreeDir: runWorktreeDir,
    message: 'promote run-1',
    baseSha,
    reviewBranch: REVIEW_REF,
  });
  if (promoted.status !== 'promoted') throw new Error(`fixture promotion failed: ${promoted.status}`);
  return { hostDir, runWorktreeDir, baseSha, tipSha: promoted.commitSha };
}

async function createGreenfieldFixture(prefix: string): Promise<{
  root: string;
  runWorktreeDir: string;
  baseSha: string;
  tipSha: string;
}> {
  const root = await mkdtemp(join(tmpdir(), prefix));
  const runWorktreeDir = join(root, 'run-repo');
  await mkdir(runWorktreeDir, { recursive: true });
  await git(runWorktreeDir, ['init', '-q', '-b', 'main']);
  await git(runWorktreeDir, [
    ...BRUNCH_IDENTITY,
    'commit',
    '--allow-empty',
    '-q',
    '-m',
    'brunch: empty run base',
  ]);
  const baseSha = await git(runWorktreeDir, ['rev-parse', 'HEAD']);
  await mkdir(join(runWorktreeDir, 'src'), { recursive: true });
  await commitFile(runWorktreeDir, join('src', 'a.ts'), 'export const a = 1;\n', 'brunch: integrate slice a');
  await commitFile(runWorktreeDir, join('src', 'b.ts'), 'export const b = 2;\n', 'brunch: integrate slice b');
  await writeFile(join(runWorktreeDir, 'src', 'c.ts'), 'export const c = 3;\n', 'utf8');
  await mkdir(join(runWorktreeDir, '.brunch', 'cook'), { recursive: true });
  await writeFile(join(runWorktreeDir, '.brunch', 'cook', 'plan.json'), '{"planted":true}\n', 'utf8');

  const promoted = await createGitRunPromotionPort().promote({
    worktreeDir: runWorktreeDir,
    message: 'promote run-1',
    baseSha,
    reviewBranch: REVIEW_REF,
  });
  if (promoted.status !== 'promoted') throw new Error(`fixture promotion failed: ${promoted.status}`);
  return { root, runWorktreeDir, baseSha, tipSha: promoted.commitSha };
}

describe('createGitHostLandPort', () => {
  describe('inspect', () => {
    it('reports complete brownfield range, target, and clean rehearsal without mutation', async () => {
      const { hostDir, runWorktreeDir, baseSha, tipSha } =
        await createBrownfieldFixture('brunch-host-land-inspect-');
      await commitFile(hostDir, 'host-note.txt', 'note\n', 'host advanced');
      const headBefore = await git(hostDir, ['rev-parse', 'HEAD']);
      const statusBefore = await git(hostDir, ['status', '--porcelain']);
      const objectsBefore = await git(hostDir, ['count-objects', '-v']);

      const result = await createGitHostLandPort().inspect({
        strategy: 'integrate',
        runWorktreeDir,
        reviewRef: REVIEW_REF,
        runBaseSha: baseSha,
        expectedTipSha: tipSha,
        targetDir: hostDir,
      });

      expect(result).toMatchObject({
        status: 'inspected',
        runBaseSha: baseSha,
        reviewTipSha: tipSha,
        commits: [
          { subject: 'brunch: integrate slice a' },
          { subject: 'brunch: integrate slice b' },
          { subject: 'promote run-1' },
        ],
        changedPaths: [
          { status: 'A', path: 'src/a.ts' },
          { status: 'A', path: 'src/b.ts' },
          { status: 'A', path: 'src/c.ts' },
        ],
        target: {
          kind: 'repository',
          path: hostDir,
          branch: 'main',
          trackedDirtyPaths: [],
          untrackedPaths: [],
        },
        conflictRehearsal: { status: 'clean' },
        admissible: true,
        sideEffects: [],
      });
      expect(await git(hostDir, ['rev-parse', 'HEAD'])).toBe(headBefore);
      expect(await git(hostDir, ['status', '--porcelain'])).toBe(statusBefore);
      expect(await git(hostDir, ['count-objects', '-v'])).toBe(objectsBefore);
    });

    it('predicts brownfield conflict paths without starting a merge', async () => {
      const { hostDir, runWorktreeDir, baseSha, tipSha } = await createBrownfieldFixture(
        'brunch-host-land-inspect-conflict-',
      );
      await mkdir(join(hostDir, 'src'), { recursive: true });
      await commitFile(hostDir, join('src', 'a.ts'), 'export const a = 999;\n', 'host conflicting a');
      const headBefore = await git(hostDir, ['rev-parse', 'HEAD']);

      const result = await createGitHostLandPort().inspect({
        strategy: 'integrate',
        runWorktreeDir,
        reviewRef: REVIEW_REF,
        runBaseSha: baseSha,
        expectedTipSha: tipSha,
        targetDir: hostDir,
      });

      expect(result).toMatchObject({
        status: 'inspected',
        conflictRehearsal: { status: 'conflicts', paths: ['src/a.ts'] },
        admissible: false,
        sideEffects: [],
      });
      expect(await git(hostDir, ['rev-parse', 'HEAD'])).toBe(headBefore);
      expect(await git(hostDir, ['status', '--porcelain'])).toBe('');
    });

    it('classifies a missing greenfield target as admissible', async () => {
      const { root, runWorktreeDir, baseSha, tipSha } = await createGreenfieldFixture(
        'brunch-host-land-inspect-greenfield-',
      );
      const targetDir = join(root, 'new-project');

      await expect(
        createGitHostLandPort().inspect({
          strategy: 'materialize',
          runWorktreeDir,
          reviewRef: REVIEW_REF,
          runBaseSha: baseSha,
          expectedTipSha: tipSha,
          targetDir,
          branch: 'main',
          message: 'brunch: land run-1',
        }),
      ).resolves.toMatchObject({
        status: 'inspected',
        target: { kind: 'missing', path: targetDir },
        conflictRehearsal: { status: 'not_applicable' },
        admissible: true,
        sideEffects: [],
      });
      await expect(access(targetDir)).rejects.toMatchObject({ code: 'ENOENT' });
    });

    it('admits an exact prior materialization so metadata persistence can retry', async () => {
      const { root, runWorktreeDir, baseSha, tipSha } = await createGreenfieldFixture(
        'brunch-host-land-inspect-materialized-retry-',
      );
      const targetDir = join(root, 'new-project');
      const port = createGitHostLandPort();
      const materialized = await port.materialize({
        runWorktreeDir,
        reviewRef: REVIEW_REF,
        expectedTipSha: tipSha,
        targetDir,
        branch: 'main',
        message: 'brunch: land run-1',
      });
      if (materialized.status !== 'landed') {
        throw new Error(`materialize failed: ${JSON.stringify(materialized)}`);
      }

      await expect(
        port.inspect({
          strategy: 'materialize',
          runWorktreeDir,
          reviewRef: REVIEW_REF,
          runBaseSha: baseSha,
          expectedTipSha: tipSha,
          targetDir,
          branch: 'main',
          message: 'brunch: land run-1',
        }),
      ).resolves.toMatchObject({
        status: 'inspected',
        target: {
          kind: 'materialized_repository',
          path: targetDir,
          branch: 'main',
          landedSha: materialized.landedSha,
        },
        conflictRehearsal: { status: 'not_applicable' },
        admissible: true,
        sideEffects: [],
      });
      expect(await git(targetDir, ['status', '--porcelain'])).toBe('');
    });
  });

  describe('integrate (brownfield)', () => {
    it('fast-forwards the complete multi-commit run onto an unmoved host branch', async () => {
      const { hostDir, tipSha } = await createBrownfieldFixture('brunch-host-land-ff-');

      const result = await createGitHostLandPort().integrate({
        hostDir,
        reviewRef: REVIEW_REF,
        expectedTipSha: tipSha,
        message: 'brunch: land run-1',
      });

      expect(result).toEqual({
        status: 'landed',
        via: 'fast_forward',
        branch: 'main',
        landedSha: tipSha,
        sideEffects: [{ kind: 'host_branch_advance', path: hostDir, branch: 'main', sha: tipSha }],
      });
      const tree = await git(hostDir, ['ls-tree', '-r', '--name-only', 'HEAD']);
      expect(tree).toContain('base.txt');
      expect(tree).toContain('src/a.ts');
      expect(tree).toContain('src/b.ts');
      expect(tree).toContain('src/c.ts');
      expect(tree).not.toContain('.brunch');
      const log = await git(hostDir, ['log', '--format=%s']);
      expect(log).toContain('brunch: integrate slice a');
      expect(log).toContain('brunch: integrate slice b');
      expect(log).toContain('promote run-1');
      expect(await git(hostDir, ['status', '--porcelain'])).toBe('');
      await expect(git(hostDir, ['rev-parse', `refs/heads/${REVIEW_REF}`])).resolves.toBe(tipSha);
      // The fixture is genuinely multi-commit: the final promotion commit alone
      // carries only src/c.ts, so the retired commitSha^..commitSha patch
      // semantics would have dropped src/a.ts and src/b.ts.
      expect(await git(hostDir, ['diff', '--name-only', `${tipSha}^`, tipSha])).toBe('src/c.ts');
    });

    it('merges the run with a brunch-authored merge commit when the host advanced', async () => {
      const { hostDir, tipSha } = await createBrownfieldFixture('brunch-host-land-merge-');
      await commitFile(hostDir, 'host-note.txt', 'note\n', 'host advanced');

      const result = await createGitHostLandPort().integrate({
        hostDir,
        reviewRef: REVIEW_REF,
        expectedTipSha: tipSha,
        message: 'brunch: land run-1',
      });

      expect(result).toMatchObject({ status: 'landed', via: 'merge', branch: 'main' });
      const tree = await git(hostDir, ['ls-tree', '-r', '--name-only', 'HEAD']);
      for (const path of ['base.txt', 'host-note.txt', 'src/a.ts', 'src/b.ts', 'src/c.ts']) {
        expect(tree).toContain(path);
      }
      expect(tree).not.toContain('.brunch');
      expect(await git(hostDir, ['log', '-1', '--format=%an <%ae>'])).toBe('brunch <cook@brunch>');
      expect(await git(hostDir, ['log', '-1', '--format=%s'])).toBe('brunch: land run-1');
      expect(await git(hostDir, ['log', '-1', '--format=%p'])).toMatch(/\w+ \w+/);
    });

    it('aborts a conflicting merge back to a byte-identical host', async () => {
      const { hostDir, tipSha } = await createBrownfieldFixture('brunch-host-land-conflict-');
      await mkdir(join(hostDir, 'src'), { recursive: true });
      await commitFile(hostDir, join('src', 'a.ts'), 'export const a = 999;\n', 'host conflicting a');
      const headBefore = await git(hostDir, ['rev-parse', 'HEAD']);

      const result = await createGitHostLandPort().integrate({
        hostDir,
        reviewRef: REVIEW_REF,
        expectedTipSha: tipSha,
        message: 'brunch: land run-1',
      });

      expect(result).toEqual({ status: 'conflict', conflictedPaths: ['src/a.ts'], sideEffects: [] });
      expect(await git(hostDir, ['rev-parse', 'HEAD'])).toBe(headBefore);
      expect(await git(hostDir, ['status', '--porcelain'])).toBe('');
      await expect(git(hostDir, ['rev-parse', `refs/heads/${REVIEW_REF}`])).resolves.toBe(tipSha);
      await expect(readFile(join(hostDir, 'src', 'a.ts'), 'utf8')).resolves.toBe('export const a = 999;\n');
    });

    it('refuses a tracked-dirty host and leaves it untouched', async () => {
      const { hostDir, tipSha } = await createBrownfieldFixture('brunch-host-land-dirty-');
      await writeFile(join(hostDir, 'base.txt'), 'locally edited\n', 'utf8');
      const headBefore = await git(hostDir, ['rev-parse', 'HEAD']);

      const result = await createGitHostLandPort().integrate({
        hostDir,
        reviewRef: REVIEW_REF,
        expectedTipSha: tipSha,
        message: 'brunch: land run-1',
      });

      expect(result).toEqual({ status: 'refused', reason: 'dirty', paths: ['base.txt'], sideEffects: [] });
      expect(await git(hostDir, ['rev-parse', 'HEAD'])).toBe(headBefore);
      await expect(readFile(join(hostDir, 'base.txt'), 'utf8')).resolves.toBe('locally edited\n');
    });

    it('refuses a detached host HEAD', async () => {
      const { hostDir, tipSha } = await createBrownfieldFixture('brunch-host-land-detached-');
      await git(hostDir, ['checkout', '-q', '--detach']);

      await expect(
        createGitHostLandPort().integrate({
          hostDir,
          reviewRef: REVIEW_REF,
          expectedTipSha: tipSha,
          message: 'brunch: land run-1',
        }),
      ).resolves.toEqual({ status: 'refused', reason: 'detached', sideEffects: [] });
    });

    it('refuses when the review ref moved past the accepted tip', async () => {
      const { hostDir, runWorktreeDir, tipSha } = await createBrownfieldFixture('brunch-host-land-moved-');
      await commitFile(runWorktreeDir, 'late.txt', 'late\n', 'late commit');
      const movedSha = await git(runWorktreeDir, ['rev-parse', 'HEAD']);
      await git(runWorktreeDir, ['update-ref', `refs/heads/${REVIEW_REF}`, movedSha, tipSha]);

      await expect(
        createGitHostLandPort().integrate({
          hostDir,
          reviewRef: REVIEW_REF,
          expectedTipSha: tipSha,
          message: 'brunch: land run-1',
        }),
      ).resolves.toEqual({ status: 'refused', reason: 'ref_moved', sideEffects: [] });
    });

    it('classifies a non-repo host as failed with the git message', async () => {
      const { tipSha } = await createBrownfieldFixture('brunch-host-land-nonrepo-');
      const nonRepoHost = await mkdtemp(join(tmpdir(), 'brunch-host-land-nonrepo-host-'));

      const result = await createGitHostLandPort().integrate({
        hostDir: nonRepoHost,
        reviewRef: REVIEW_REF,
        expectedTipSha: tipSha,
        message: 'brunch: land run-1',
      });

      if (result.status !== 'failed') throw new Error(`expected failed, got ${JSON.stringify(result)}`);
      expect(result.message).toContain('not a git repository');
    });

    it('refuses a host dir nested inside a repository', async () => {
      const { hostDir, tipSha } = await createBrownfieldFixture('brunch-host-land-nested-');
      const nestedDir = join(hostDir, 'nested');
      await mkdir(nestedDir, { recursive: true });

      await expect(
        createGitHostLandPort().integrate({
          hostDir: nestedDir,
          reviewRef: REVIEW_REF,
          expectedTipSha: tipSha,
          message: 'brunch: land run-1',
        }),
      ).resolves.toEqual({ status: 'refused', reason: 'not_a_repo_root', sideEffects: [] });
    });

    it('lands over an unrelated untracked host file and leaves it intact', async () => {
      const { hostDir, tipSha } = await createBrownfieldFixture('brunch-host-land-untracked-');
      await writeFile(join(hostDir, 'notes.md'), 'my scratch notes\n', 'utf8');

      const result = await createGitHostLandPort().integrate({
        hostDir,
        reviewRef: REVIEW_REF,
        expectedTipSha: tipSha,
        message: 'brunch: land run-1',
      });

      expect(result).toMatchObject({ status: 'landed', via: 'fast_forward' });
      await expect(readFile(join(hostDir, 'notes.md'), 'utf8')).resolves.toBe('my scratch notes\n');
    });
  });

  describe('materialize (greenfield)', () => {
    it('materializes the complete promoted tree as one clean initial commit', async () => {
      const { root, runWorktreeDir, tipSha } = await createGreenfieldFixture('brunch-host-land-green-');
      const targetDir = join(root, 'new-project');

      const result = await createGitHostLandPort().materialize({
        runWorktreeDir,
        reviewRef: REVIEW_REF,
        expectedTipSha: tipSha,
        targetDir,
        branch: 'main',
        message: 'brunch: land run-1',
      });

      if (result.status !== 'landed') throw new Error(`materialize failed: ${JSON.stringify(result)}`);
      expect(result).toMatchObject({ status: 'landed', branch: 'main', targetDir });
      expect(await git(targetDir, ['rev-parse', '--abbrev-ref', 'HEAD'])).toBe('main');
      expect(await git(targetDir, ['rev-list', '--count', 'HEAD'])).toBe('1');
      const tree = await git(targetDir, ['ls-tree', '-r', '--name-only', 'HEAD']);
      expect(tree).toContain('src/a.ts');
      expect(tree).toContain('src/b.ts');
      expect(tree).toContain('src/c.ts');
      expect(tree).not.toContain('.brunch');
      expect(await git(targetDir, ['log', '-1', '--format=%an <%ae>'])).toBe('brunch <cook@brunch>');
      await expect(readFile(join(targetDir, 'src', 'a.ts'), 'utf8')).resolves.toBe('export const a = 1;\n');
      expect(await git(targetDir, ['status', '--porcelain'])).toBe('');
    });

    it('replays an already-materialized target so metadata persistence can retry', async () => {
      const { root, runWorktreeDir, tipSha } = await createGreenfieldFixture(
        'brunch-host-land-materialized-retry-',
      );
      const targetDir = join(root, 'new-project');
      const port = createGitHostLandPort();
      const args = {
        runWorktreeDir,
        reviewRef: REVIEW_REF,
        expectedTipSha: tipSha,
        targetDir,
        branch: 'main',
        message: 'brunch: land run-1',
      };

      const first = await port.materialize(args);
      if (first.status !== 'landed') throw new Error(`materialize failed: ${JSON.stringify(first)}`);

      await expect(port.materialize(args)).resolves.toEqual({
        status: 'landed',
        branch: 'main',
        landedSha: first.landedSha,
        targetDir,
        sideEffects: [],
      });
    });

    it('refuses an occupied non-git target without mutating it', async () => {
      const { root, runWorktreeDir, tipSha } = await createGreenfieldFixture('brunch-host-land-occupied-');
      const targetDir = join(root, 'occupied');
      await mkdir(targetDir, { recursive: true });
      await writeFile(join(targetDir, 'precious.txt'), 'keep me\n', 'utf8');

      await expect(
        createGitHostLandPort().materialize({
          runWorktreeDir,
          reviewRef: REVIEW_REF,
          expectedTipSha: tipSha,
          targetDir,
          branch: 'main',
          message: 'brunch: land run-1',
        }),
      ).resolves.toEqual({ status: 'refused', reason: 'occupied_target', sideEffects: [] });
      await expect(readFile(join(targetDir, 'precious.txt'), 'utf8')).resolves.toBe('keep me\n');
    });

    it('leaves a failed materialization target as found so a retry can land', async () => {
      const { root, runWorktreeDir, tipSha } = await createGreenfieldFixture('brunch-host-land-retry-');
      const targetDir = join(root, 'new-project');
      const port = createGitHostLandPort();
      const shared = {
        reviewRef: REVIEW_REF,
        expectedTipSha: tipSha,
        branch: 'main',
        message: 'brunch: land run-1',
      };

      const failed = await port.materialize({
        ...shared,
        runWorktreeDir: join(root, 'missing-run'),
        targetDir,
      });
      expect(failed.status).toBe('failed');
      // The failure restores the previously-empty target: no orphan .git remains.
      await expect(readdir(targetDir)).resolves.toEqual([]);

      const retried = await port.materialize({ ...shared, runWorktreeDir, targetDir });
      expect(retried).toMatchObject({ status: 'landed', branch: 'main', targetDir });
    });

    it('refuses a target that aliases or nests inside the run repository', async () => {
      const { runWorktreeDir, tipSha } = await createGreenfieldFixture('brunch-host-land-alias-');
      const port = createGitHostLandPort();
      const nestedTarget = join(runWorktreeDir, 'nested');
      const shared = {
        runWorktreeDir,
        reviewRef: REVIEW_REF,
        expectedTipSha: tipSha,
        branch: 'main',
        message: 'brunch: land run-1',
      };

      await expect(port.materialize({ ...shared, targetDir: runWorktreeDir })).resolves.toEqual({
        status: 'refused',
        reason: 'target_aliases_run',
        sideEffects: [],
      });
      await expect(port.materialize({ ...shared, targetDir: nestedTarget })).resolves.toEqual({
        status: 'refused',
        reason: 'target_inside_run',
        sideEffects: [],
      });
      await expect(access(nestedTarget)).rejects.toMatchObject({ code: 'ENOENT' });
    });
  });
});

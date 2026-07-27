import { execFileSync } from 'node:child_process';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  ensureSliceWorktree,
  seedSliceFromParentWorktree,
  seedSliceSandboxFromDeps,
  sliceIdsForEpicVerifyMerge,
} from './epic-sandbox-merge.js';
import type { Plan } from './types.js';

const GIT_TEST_TIMEOUT_MS = 20_000;

const txtLikePlan: Plan = {
  mode: 'greenfield',
  epics: [
    { id: 'scaffolding', summary: '', depends_on: [], verification: [] },
    { id: 'text-ops', summary: '', depends_on: ['scaffolding'], verification: [] },
  ],
  slices: [
    { id: 'version-flag', epic_id: 'scaffolding', definition: '', depends_on: [], verification: [] },
    {
      id: 'help-flag',
      epic_id: 'scaffolding',
      definition: '',
      depends_on: ['version-flag'],
      verification: [],
    },
    { id: 'reverse', epic_id: 'text-ops', definition: '', depends_on: [], verification: [] },
    { id: 'count', epic_id: 'text-ops', definition: '', depends_on: [], verification: [] },
    { id: 'slugify', epic_id: 'text-ops', definition: '', depends_on: [], verification: [] },
  ],
};

const crossEpicSliceDepPlan: Plan = {
  mode: 'greenfield',
  epics: [
    { id: 'epic-a', summary: '', depends_on: [], verification: [] },
    { id: 'epic-b', summary: '', depends_on: [], verification: [] },
  ],
  slices: [
    { id: 'slice-a', epic_id: 'epic-a', definition: '', depends_on: [], verification: [] },
    { id: 'slice-b', epic_id: 'epic-b', definition: '', depends_on: ['slice-a'], verification: [] },
  ],
};

describe('sliceIdsForEpicVerifyMerge', () => {
  it('lists slices from dependency epics then target epic in plan order', () => {
    expect(sliceIdsForEpicVerifyMerge(txtLikePlan, 'text-ops')).toEqual([
      'version-flag',
      'help-flag',
      'reverse',
      'count',
      'slugify',
    ]);
  });

  it('includes cross-epic slice dependencies', () => {
    expect(sliceIdsForEpicVerifyMerge(crossEpicSliceDepPlan, 'epic-b')).toEqual(['slice-a', 'slice-b']);
  });
});

describe('seedSliceSandboxFromDeps', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
    dirs.length = 0;
  });

  it('copies completed dependency slice files into the target slice sandbox', () => {
    const parent = mkdtempSync(join(tmpdir(), 'cook-seed-'));
    dirs.push(parent);
    mkdirSync(join(parent, 'version-flag', 'src'), { recursive: true });
    writeFileSync(join(parent, 'version-flag', 'src/cli.ts'), 'version\n');

    const slice = txtLikePlan.slices.find((s) => s.id === 'help-flag')!;
    const sliceDir = seedSliceSandboxFromDeps(parent, txtLikePlan, slice);

    expect(sliceDir).toBe(join(parent, 'help-flag'));
    expect(readFileSync(join(sliceDir, 'src/cli.ts'), 'utf8')).toBe('version\n');
  });

  it('preserveExisting keeps slice-owned files and edits on dep paths', () => {
    const parent = mkdtempSync(join(tmpdir(), 'cook-seed-'));
    dirs.push(parent);
    mkdirSync(join(parent, 'version-flag', 'src'), { recursive: true });
    writeFileSync(join(parent, 'version-flag', 'src/cli.ts'), 'dep\n');

    const slice = txtLikePlan.slices.find((s) => s.id === 'help-flag')!;
    seedSliceSandboxFromDeps(parent, txtLikePlan, slice);
    writeFileSync(join(parent, 'help-flag', 'src/stale.ts'), 'slice-owned\n');
    writeFileSync(join(parent, 'help-flag', 'src/cli.ts'), 'slice edit\n');

    seedSliceSandboxFromDeps(parent, txtLikePlan, slice, { preserveExisting: true });

    expect(readFileSync(join(parent, 'help-flag', 'src/stale.ts'), 'utf8')).toBe('slice-owned\n');
    expect(readFileSync(join(parent, 'help-flag', 'src/cli.ts'), 'utf8')).toBe('slice edit\n');
  });

  it('preserveExisting keeps slice modifications when re-seeding before tests', () => {
    const parent = mkdtempSync(join(tmpdir(), 'cook-seed-'));
    dirs.push(parent);
    mkdirSync(join(parent, 'version-flag', 'src'), { recursive: true });
    writeFileSync(join(parent, 'version-flag', 'src/cli.ts'), 'dep\n');

    const slice = txtLikePlan.slices.find((s) => s.id === 'help-flag')!;
    seedSliceSandboxFromDeps(parent, txtLikePlan, slice);
    writeFileSync(join(parent, 'help-flag', 'src/cli.ts'), 'slice edit\n');

    seedSliceSandboxFromDeps(parent, txtLikePlan, slice, { preserveExisting: true });

    expect(readFileSync(join(parent, 'help-flag', 'src/cli.ts'), 'utf8')).toBe('slice edit\n');
  });

  it('uses plan order when multiple deps share a path', () => {
    const plan: Plan = {
      mode: 'greenfield',
      epics: [{ id: 'e1', summary: '', depends_on: [], verification: [] }],
      slices: [
        { id: 'dep-b', epic_id: 'e1', definition: '', depends_on: [], verification: [] },
        { id: 'dep-a', epic_id: 'e1', definition: '', depends_on: [], verification: [] },
        {
          id: 'target',
          epic_id: 'e1',
          definition: '',
          depends_on: ['dep-b', 'dep-a'],
          verification: [],
        },
      ],
    };
    const parent = mkdtempSync(join(tmpdir(), 'cook-seed-'));
    dirs.push(parent);
    mkdirSync(join(parent, 'dep-b'), { recursive: true });
    writeFileSync(join(parent, 'dep-b', 'shared.txt'), 'B\n');
    mkdirSync(join(parent, 'dep-a'), { recursive: true });
    writeFileSync(join(parent, 'dep-a', 'shared.txt'), 'A\n');

    const slice = plan.slices.find((s) => s.id === 'target')!;
    seedSliceSandboxFromDeps(parent, plan, slice);

    expect(readFileSync(join(parent, 'target', 'shared.txt'), 'utf8')).toBe('A\n');
  });

  it('does not copy a dependency slice node_modules into the dependent slice', () => {
    const parent = mkdtempSync(join(tmpdir(), 'cook-seed-'));
    dirs.push(parent);
    mkdirSync(join(parent, 'version-flag', 'src'), { recursive: true });
    writeFileSync(join(parent, 'version-flag', 'src/cli.ts'), 'version\n');
    // The dependency slice ran an in-slice install, clobbering its node_modules
    // symlink into a real tree; seeding must not deep-copy it.
    mkdirSync(join(parent, 'version-flag', 'node_modules', 'dep'), { recursive: true });
    writeFileSync(join(parent, 'version-flag', 'node_modules/dep/index.js'), '1\n');

    const slice = txtLikePlan.slices.find((s) => s.id === 'help-flag')!;
    const sliceDir = seedSliceSandboxFromDeps(parent, txtLikePlan, slice);

    expect(readFileSync(join(sliceDir, 'src/cli.ts'), 'utf8')).toBe('version\n');
    expect(existsSync(join(sliceDir, 'node_modules'))).toBe(false);
  });

  it('reset re-seed removes orphaned slice files from a prior rework attempt', () => {
    const parent = mkdtempSync(join(tmpdir(), 'cook-seed-'));
    dirs.push(parent);
    mkdirSync(join(parent, 'version-flag', 'src'), { recursive: true });
    writeFileSync(join(parent, 'version-flag', 'src/cli.ts'), 'dep\n');

    const slice = txtLikePlan.slices.find((s) => s.id === 'help-flag')!;
    seedSliceSandboxFromDeps(parent, txtLikePlan, slice);
    writeFileSync(join(parent, 'help-flag', 'src/stale.ts'), 'orphan\n');
    writeFileSync(join(parent, 'help-flag', 'src/cli.ts'), 'bad edit\n');

    seedSliceSandboxFromDeps(parent, txtLikePlan, slice);

    expect(existsSync(join(parent, 'help-flag', 'src/stale.ts'))).toBe(false);
    expect(readFileSync(join(parent, 'help-flag', 'src/cli.ts'), 'utf8')).toBe('dep\n');
  });
});

describe('seedSliceFromParentWorktree', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
    dirs.length = 0;
  });

  const singleSlicePlan: Plan = {
    mode: 'greenfield',
    epics: [{ id: 'e1', summary: '', depends_on: [], verification: [] }],
    slices: [{ id: 'only', epic_id: 'e1', definition: '', depends_on: [], verification: [] }],
  };

  /**
   * Create a tmp dir initialised as a git worktree of a fresh repo at HEAD,
   * mimicking the structure cook produces via createSandbox in codebase mode:
   * the "parent" is itself a `git worktree add` of a separate "source" repo,
   * checked out on a `brunch/run/<runId>` branch.
   */
  function makeGitParentWorktree(runId: string): {
    parent: string;
    source: string;
    addUntracked: (relPath: string, content: string) => void;
  } {
    const source = mkdtempSync(join(tmpdir(), 'cook-source-'));
    dirs.push(source);
    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: source });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: source });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: source });
    writeFileSync(join(source, 'README.md'), '# project\n');
    mkdirSync(join(source, 'src'));
    writeFileSync(join(source, 'src', 'a.ts'), 'export const a = 1;\n');
    execFileSync('git', ['add', '.'], { cwd: source });
    execFileSync('git', ['commit', '-q', '-m', 'initial'], { cwd: source });

    const runDir = mkdtempSync(join(tmpdir(), 'cook-run-'));
    dirs.push(runDir);
    const parent = join(runDir, 'worktree');
    execFileSync('git', ['worktree', 'add', '-q', '-b', `brunch/run/${runId}`, parent, 'HEAD'], {
      cwd: source,
    });

    return {
      parent,
      source,
      addUntracked: (relPath, content) => {
        const abs = join(parent, relPath);
        mkdirSync(dirname(abs), { recursive: true });
        writeFileSync(abs, content);
      },
    };
  }

  it('tracked content arrives via git worktree checkout', () => {
    const { parent } = makeGitParentWorktree('r1');

    const sliceDir = seedSliceFromParentWorktree(parent, 'only', singleSlicePlan, 'r1');

    expect(sliceDir).toBe(join(parent, 'only'));
    expect(readFileSync(join(sliceDir, 'README.md'), 'utf8')).toBe('# project\n');
    expect(readFileSync(join(sliceDir, 'src/a.ts'), 'utf8')).toBe('export const a = 1;\n');
  });

  it('untracked content (other than node_modules) arrives via CoW copy from the parent', () => {
    const { parent, addUntracked } = makeGitParentWorktree('r2');
    // Simulate generated artifacts present in the parent worktree but NOT
    // tracked by git. `dist/` is copied (a slice may rebuild it independently).
    addUntracked('dist/bundle.js', 'console.log("bundle");\n');

    const sliceDir = seedSliceFromParentWorktree(parent, 'only', singleSlicePlan, 'r2');

    expect(lstatSync(join(sliceDir, 'dist')).isSymbolicLink()).toBe(false);
    expect(readFileSync(join(sliceDir, 'dist/bundle.js'), 'utf8')).toBe('console.log("bundle");\n');
  });

  it('shares node_modules via a symlink to the parent rather than copying it', () => {
    const { parent, addUntracked } = makeGitParentWorktree('r2b');
    addUntracked('node_modules/dep/index.js', 'module.exports = 1;\n');

    const sliceDir = seedSliceFromParentWorktree(parent, 'only', singleSlicePlan, 'r2b');

    const linkPath = join(sliceDir, 'node_modules');
    expect(lstatSync(linkPath).isSymbolicLink()).toBe(true);
    expect(readlinkSync(linkPath)).toBe(join(parent, 'node_modules'));
    // Resolves transparently for pi-actions reading deps through the link.
    expect(readFileSync(join(linkPath, 'dep/index.js'), 'utf8')).toBe('module.exports = 1;\n');
  });

  it('slice worktree is checked out on a slice-level cook branch', () => {
    const { parent } = makeGitParentWorktree('r3');

    const sliceDir = seedSliceFromParentWorktree(parent, 'only', singleSlicePlan, 'r3');

    const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: sliceDir,
      encoding: 'utf8',
    }).trim();
    expect(branch).toBe('brunch/slice/r3/only');
  });

  it('excludes sibling slice subdirs from the untracked copy', () => {
    const { parent, addUntracked } = makeGitParentWorktree('r4');
    const planTwo: Plan = {
      mode: 'greenfield',
      epics: [{ id: 'e1', summary: '', depends_on: [], verification: [] }],
      slices: [
        { id: 'first', epic_id: 'e1', definition: '', depends_on: [], verification: [] },
        { id: 'second', epic_id: 'e1', definition: '', depends_on: [], verification: [] },
      ],
    };
    addUntracked('first/already-cooked.txt', 'first slice output\n');

    const sliceDir = seedSliceFromParentWorktree(parent, 'second', planTwo, 'r4');

    expect(existsSync(join(sliceDir, 'first'))).toBe(false);
  });

  it('excludes __epic__ reserved dir from the untracked copy', () => {
    const { parent, addUntracked } = makeGitParentWorktree('r5');
    addUntracked('__epic__/e1/leftover.txt', 'leftover\n');

    const sliceDir = seedSliceFromParentWorktree(parent, 'only', singleSlicePlan, 'r5');

    expect(existsSync(join(sliceDir, '__epic__'))).toBe(false);
  });

  it(
    'rejects slice ids that collide with top-level repo entries',
    () => {
      const { parent } = makeGitParentWorktree('r6');
      const plan: Plan = {
        mode: 'greenfield',
        epics: [{ id: 'e1', summary: '', depends_on: [], verification: [] }],
        slices: [{ id: 'src', epic_id: 'e1', definition: '', depends_on: [], verification: [] }],
      };

      expect(() => seedSliceFromParentWorktree(parent, 'src', plan, 'r6')).toThrow(
        'Slice id "src" collides with an existing entry in the parent worktree',
      );
    },
    GIT_TEST_TIMEOUT_MS,
  );
});

describe('ensureSliceWorktree', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
    dirs.length = 0;
  });

  const singleSlicePlan: Plan = {
    mode: 'brownfield',
    epics: [{ id: 'e1', summary: '', depends_on: [], verification: [] }],
    slices: [{ id: 'only', epic_id: 'e1', definition: '', depends_on: [], verification: [] }],
  };

  function makeGitParentWorktree(runId: string): string {
    const source = mkdtempSync(join(tmpdir(), 'cook-source-'));
    dirs.push(source);
    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: source });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: source });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: source });
    writeFileSync(join(source, 'README.md'), '# project\n');
    execFileSync('git', ['add', '.'], { cwd: source });
    execFileSync('git', ['commit', '-q', '-m', 'initial'], { cwd: source });

    const runDir = mkdtempSync(join(tmpdir(), 'cook-run-'));
    dirs.push(runDir);
    const parent = join(runDir, 'worktree');
    execFileSync('git', ['worktree', 'add', '-q', '-b', `brunch/run/${runId}`, parent, 'HEAD'], {
      cwd: source,
    });
    return parent;
  }

  it(
    'creates the slice worktree on first call and is a no-op on repeat (rework-safe)',
    () => {
      const parent = makeGitParentWorktree('r1');

      const first = ensureSliceWorktree(parent, 'only', singleSlicePlan, 'r1');
      expect(existsSync(join(first, 'README.md'))).toBe(true);

      // Second call must not throw (seedSliceFromParentWorktree would, via its
      // path-availability assertion) and must return the same dir.
      const second = ensureSliceWorktree(parent, 'only', singleSlicePlan, 'r1');
      expect(second).toBe(first);
    },
    GIT_TEST_TIMEOUT_MS,
  );

  it(
    'fails loudly when a slice id collides with a tracked parent entry, not a worktree',
    () => {
      // A slice id matching a tracked top-level dir (here `src`) resolves to an
      // existing path that is NOT a provisioned worktree. Early-returning it
      // would hand the project source to the slice as its sandbox.
      const source = mkdtempSync(join(tmpdir(), 'cook-source-'));
      dirs.push(source);
      execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: source });
      execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: source });
      execFileSync('git', ['config', 'user.name', 'Test'], { cwd: source });
      mkdirSync(join(source, 'src'));
      writeFileSync(join(source, 'src', 'index.ts'), 'export {};\n');
      execFileSync('git', ['add', '.'], { cwd: source });
      execFileSync('git', ['commit', '-q', '-m', 'initial'], { cwd: source });

      const runDir = mkdtempSync(join(tmpdir(), 'cook-run-'));
      dirs.push(runDir);
      const parent = join(runDir, 'worktree');
      execFileSync('git', ['worktree', 'add', '-q', '-b', 'brunch/run/r2', parent, 'HEAD'], { cwd: source });

      const collidingPlan: Plan = {
        mode: 'brownfield',
        epics: [{ id: 'e1', summary: '', depends_on: [], verification: [] }],
        slices: [{ id: 'src', epic_id: 'e1', definition: '', depends_on: [], verification: [] }],
      };

      expect(() => ensureSliceWorktree(parent, 'src', collidingPlan, 'r2')).toThrow(/collides/i);
    },
    GIT_TEST_TIMEOUT_MS,
  );
});

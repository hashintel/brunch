// End-to-end smoke test for `cook-codebase-mode` slice 2.
//
// Constructs a tmpdir git repo with seeded files + a `.brunch/cook/plan.yaml`
// carrying a 1-slice plan, then runs the orchestrator with FAKE actions that
// mutate a pre-existing file. Verifies:
//   - the source branch in the source repo is byte-identical before/after,
//   - the cook artifact (slice worktree) contains the modification.
//
// The "fixture" lives as a test-setup function rather than committed under
// `fixtures/brownfield-smoke/` because nesting a real `.git/` inside the
// brunch repo creates submodule weirdness.
//
// Out of scope: real pi invocation (covered by manual outer-loop smoke later).

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { resolveCookMode } from './cook-cli.js';
import { createOrchestrator } from './engine.js';
import { loadPlan } from './plan-loader.js';
import { InMemoryReportSink } from './report-sink.js';
import type { ActionContext, ActionHandlers, TestRunner } from './types.js';
import { createSandbox } from './worktree.js';

describe('brownfield smoke — 1-slice 1-epic codebase mode', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
    dirs.length = 0;
  });

  function makeSeededRepo(): string {
    const dir = mkdtempSync(join(tmpdir(), 'brownfield-smoke-'));
    dirs.push(dir);
    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: dir });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir });
    writeFileSync(join(dir, '.gitignore'), '.brunch/\n');
    writeFileSync(join(dir, 'README.md'), '# original\n');
    writeFileSync(join(dir, 'src.txt'), 'hello\n');
    execFileSync('git', ['add', '.'], { cwd: dir });
    execFileSync('git', ['commit', '-q', '-m', 'initial'], { cwd: dir });

    mkdirSync(join(dir, '.brunch', 'cook'), { recursive: true });
    writeFileSync(
      join(dir, '.brunch', 'cook', 'plan.yaml'),
      [
        'epics:',
        '  - id: smoke',
        '    summary: smoke epic',
        '    depends_on: []',
        '    verification: []',
        'slices:',
        '  - id: modify-src',
        '    epic_id: smoke',
        '    definition: append modified line to src.txt',
        '    depends_on: []',
        '    verification:',
        '      - kind: unit-test',
        '        target: src.txt',
        '',
      ].join('\n'),
    );

    return dir;
  }

  function makeFakeActions(reports: InMemoryReportSink): ActionHandlers {
    let evalCalls = 0;
    return {
      // First eval returns NO (forces write-tests → write-code → run-tests),
      // second eval returns YES (slice done).
      'evaluate-done': async (ctx: ActionContext) => {
        evalCalls++;
        const done = evalCalls >= 2;
        const id = `rpt-eval-${ctx.slice.id}-${evalCalls}`;
        reports.append({
          id,
          ts: new Date().toISOString(),
          epicId: ctx.epic.id,
          sliceId: ctx.slice.id,
          actor: 'evaluator',
          event: 'eval-done',
          payload: { done },
        });
        return id;
      },
      'write-tests': async (ctx: ActionContext) => {
        // The slice "tests" the modification by reading src.txt; create a
        // throwaway test file in the slice dir.
        writeFileSync(join(ctx.sandboxDir, 'src.test.txt'), 'placeholder\n');
        const id = `rpt-wt-${ctx.slice.id}`;
        reports.append({
          id,
          ts: new Date().toISOString(),
          epicId: ctx.epic.id,
          sliceId: ctx.slice.id,
          actor: 'test-writer',
          event: 'tests-written',
          payload: {},
        });
        return id;
      },
      'write-code': async (ctx: ActionContext) => {
        // The pre-existing src.txt (seeded from cwd) is mutated in-place.
        const srcPath = join(ctx.sandboxDir, 'src.txt');
        const before = readFileSync(srcPath, 'utf8');
        writeFileSync(srcPath, before + 'modified\n');
        const id = `rpt-wc-${ctx.slice.id}`;
        reports.append({
          id,
          ts: new Date().toISOString(),
          epicId: ctx.epic.id,
          sliceId: ctx.slice.id,
          actor: 'code-writer',
          event: 'code-written',
          payload: { srcPath },
        });
        return id;
      },
      'assess-semantic': async (ctx: ActionContext) => {
        const id = `rpt-sem-${ctx.slice.id}`;
        reports.append({
          id,
          ts: new Date().toISOString(),
          epicId: ctx.epic.id,
          sliceId: ctx.slice.id,
          actor: 'semantic-assessor',
          event: 'semantic-assessed',
          payload: { satisfied: true },
        });
        return id;
      },
    };
  }

  const fakeTestRunner: TestRunner = {
    async run() {
      return { passed: true, output: 'fake ok' };
    },
  };

  it('source repo is byte-identical and cook artifact contains the modification', async () => {
    const source = makeSeededRepo();

    // Resolve via the same path runCook uses.
    const resolved = resolveCookMode(source);
    expect(resolved.mode).toBe('codebase');
    if (resolved.mode !== 'codebase') throw new Error('unreachable');

    const plan = loadPlan(resolved.planPath);
    // baseDir = source (cwd-scoped per SPEC §A49).
    const sandbox = createSandbox(source, undefined, {
      mode: 'codebase',
      sourceDir: resolved.sourceDir,
    });

    const sourceHeadBefore = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: source,
      encoding: 'utf8',
    }).trim();

    const reports = new InMemoryReportSink();
    const actions = makeFakeActions(reports);

    const engine = createOrchestrator('serial');
    const result = await engine.run({
      plan,
      sandboxDir: sandbox.sandboxDir,
      actions,
      reports,
      testRunner: fakeTestRunner,
      policy: { maxRetries: 3 },
      sandboxMode: 'codebase',
      runId: sandbox.runId,
    });

    expect(result.status).toBe('completed');

    // Source branch byte-identical: HEAD unchanged, no uncommitted changes
    // to tracked files (the `.brunch/` ignore keeps cook artifacts invisible
    // to `git status` on tracked content).
    const sourceHeadAfter = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: source,
      encoding: 'utf8',
    }).trim();
    expect(sourceHeadAfter).toBe(sourceHeadBefore);
    const trackedStatus = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], {
      cwd: source,
      encoding: 'utf8',
    });
    expect(trackedStatus).toBe('');

    // Modification landed: the slice worktree contains the mutated src.txt.
    const sliceDir = join(sandbox.sandboxDir, 'modify-src');
    expect(existsSync(sliceDir)).toBe(true);
    const modified = readFileSync(join(sliceDir, 'src.txt'), 'utf8');
    expect(modified).toBe('hello\nmodified\n');

    // The parent worktree (the git worktree of source HEAD) was on cook/<runId>.
    const parentBranch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: sandbox.sandboxDir,
      encoding: 'utf8',
    }).trim();
    expect(parentBranch).toBe(`cook/${sandbox.runId}`);

    // The slice worktree is a real git worktree on its slice-level branch
    // (sibling namespace cook-slice/ to avoid ref-hierarchy collision with cook/<runId>).
    const sliceBranch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: sliceDir,
      encoding: 'utf8',
    }).trim();
    expect(sliceBranch).toBe(`cook-slice/${sandbox.runId}/modify-src`);
  });
});

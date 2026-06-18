// FE-884 Slice A — recoverable epic verification, end-to-end in codebase mode.
//
// Drives the full orchestrator over a seeded git repo whose epic carries an
// integration-test target, with a SCRIPTED stub remediation agent (no real pi).
// Proves the loop the topology tests can only show structurally:
//
//   - broken → remediation edits product code → re-verify passes → epic done,
//     and the fix round-trips onto the slice branch (so harvest folds it);
//   - a remediation that edits the epic integration test is rejected
//     (detect-and-reject) and burns a budget unit;
//   - a no-op remediation exhausts the budget and halts with an honest reason;
//   - dual re-verify: a verify that greens the epic integration test but breaks a
//     slice suite on the folded tree is NOT accepted.
//
// Like brownfield-smoke, the "fixture" is a setup function (a real nested .git/
// under the brunch repo would create submodule weirdness).

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { resolveCookPlan, resolveSandboxPlan } from './cook-cli.js';
import { createOrchestrator } from './engine.js';
import { loadPlan } from './plan-loader.js';
import { InMemoryReportSink } from './report-sink.js';
import type { ActionContext, ActionHandlers, ReportLine, TestRunner } from './types.js';
import { createSandbox } from './worktree.js';

const GIT_TEST_TIMEOUT_MS = 30_000;
const EPIC_TEST_TARGET = 'epic-itest.txt';

describe('FE-884 — recoverable epic verification (codebase mode)', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
    dirs.length = 0;
  });

  // A 1-slice epic that carries an integration-test target, so the verify-epic
  // transition (and the FE-884 remediation chain) is compiled.
  function makeSeededRepo(): string {
    const dir = mkdtempSync(join(tmpdir(), 'epic-recovery-'));
    dirs.push(dir);
    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: dir });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir });
    writeFileSync(join(dir, '.gitignore'), '.brunch/\n');
    writeFileSync(join(dir, 'src.txt'), 'seed\n');
    execFileSync('git', ['add', '.'], { cwd: dir });
    execFileSync('git', ['commit', '-q', '-m', 'initial'], { cwd: dir });

    mkdirSync(join(dir, '.brunch', 'cook'), { recursive: true });
    writeFileSync(
      join(dir, '.brunch', 'cook', 'plan.yaml'),
      [
        'mode: brownfield',
        'epics:',
        '  - id: ep',
        '    summary: recoverable epic',
        '    depends_on: []',
        '    verification:',
        '      - kind: integration-test',
        `        target: ${EPIC_TEST_TARGET}`,
        'slices:',
        '  - id: s1',
        '    epic_id: ep',
        '    definition: seed src.txt',
        '    depends_on: []',
        '    verification:',
        '      - kind: unit-test',
        '        target: src.txt',
        '',
      ].join('\n'),
    );
    return dir;
  }

  // Scripted actions. `remediation` selects what the stub remediation agent does
  // to the folded epic tree; `epicPasses` lets a scenario force the integration
  // test green to isolate dual re-verify.
  function makeFakeActions(
    reports: InMemoryReportSink,
    opts: {
      remediation: 'fix' | 'touch-test' | 'noop';
      epicPasses?: boolean;
      // FE-884 Slice B: force the verify-epic verdict to report an infra/timeout
      // failure — 'always' (never recovers) or 'once' (infra then pass).
      epicInfra?: 'always' | 'once';
    },
  ): ActionHandlers {
    const evalCalls = new Map<string, number>();
    let verifyCalls = 0;
    return {
      'evaluate-done': async (ctx: ActionContext) => {
        const n = (evalCalls.get(ctx.slice.id) ?? 0) + 1;
        evalCalls.set(ctx.slice.id, n);
        const done = n >= 2; // NO then YES
        const id = `eval-${ctx.slice.id}-${n}`;
        reports.append(line(id, ctx, 'evaluator', 'eval-done', { done }));
        return id;
      },
      'write-tests': async (ctx: ActionContext) => {
        const id = `wt-${ctx.slice.id}`;
        reports.append(line(id, ctx, 'test-writer', 'tests-written', {}));
        return id;
      },
      'write-code': async (ctx: ActionContext) => {
        // Product code in the slice worktree: a known value WITHOUT the fix token.
        writeFileSync(join(ctx.sandboxDir, 'src.txt'), 'v1\n');
        const id = `wc-${ctx.slice.id}`;
        reports.append(line(id, ctx, 'code-writer', 'code-written', {}));
        return id;
      },
      'assess-semantic': async (ctx: ActionContext) => {
        const id = `sem-${ctx.slice.id}`;
        reports.append(line(id, ctx, 'semantic-assessor', 'semantic-assessed', { satisfied: true }));
        return id;
      },
      // The epic integration test: passes iff the folded src.txt carries the fix
      // token (or the scenario forces it green to isolate dual re-verify).
      'verify-epic': async (ctx: ActionContext) => {
        verifyCalls += 1;
        const id = `ve-${ctx.epic.id}-${reports.getAll().length}`;
        // FE-884 Slice B: infra/timeout verdicts re-run verify without remediation.
        if (opts.epicInfra === 'always' || (opts.epicInfra === 'once' && verifyCalls === 1)) {
          reports.append(
            line(id, ctx, 'orchestrator', 'epic-verified', { passed: false, failureKind: 'infra' }),
          );
          return id;
        }
        const srcPath = join(ctx.sandboxDir, 'src.txt');
        const txt = existsSync(srcPath) ? readFileSync(srcPath, 'utf8') : '';
        // 'once': the infra blip cleared on the re-run, so the epic now passes.
        const passed = opts.epicInfra === 'once' ? true : (opts.epicPasses ?? txt.includes('FIXED'));
        reports.append(line(id, ctx, 'orchestrator', 'epic-verified', { passed }));
        return id;
      },
      // The stub remediation agent acts on the FOLDED epic tree.
      'remediate-epic': async (ctx: ActionContext) => {
        if (opts.remediation === 'fix') {
          const srcPath = join(ctx.sandboxDir, 'src.txt');
          const before = existsSync(srcPath) ? readFileSync(srcPath, 'utf8') : '';
          writeFileSync(srcPath, `${before}FIXED\n`); // product code only
        } else if (opts.remediation === 'touch-test') {
          // Try to green the epic by editing its own oracle — must be rejected.
          writeFileSync(join(ctx.sandboxDir, EPIC_TEST_TARGET), 'tampered\n');
        }
        // 'noop': touch nothing.
        const id = `rem-${ctx.epic.id}-${reports.getAll().length}`;
        reports.append(line(id, ctx, 'coding-agent', 'remediation-agent-done', {}));
        return id;
      },
    };
  }

  function line(
    id: string,
    ctx: ActionContext,
    actor: ReportLine['actor'],
    event: string,
    payload: Record<string, unknown>,
  ): ReportLine {
    return {
      id,
      ts: new Date().toISOString(),
      epicId: ctx.epic.id,
      sliceId: ctx.slice.id,
      actor,
      event,
      payload,
    };
  }

  function passingRunner(): TestRunner {
    return {
      async run() {
        return { passed: true, output: 'ok' };
      },
    };
  }

  // Pass in the slice loop (slice worktree cwd), fail in dual re-verify (folded
  // __epic__ cwd) — isolates the slice-suite-on-folded-tree signal.
  function failOnFoldedRunner(): TestRunner {
    return {
      async run(_target: string, sandboxDir: string) {
        if (sandboxDir.includes('__epic__'))
          return { passed: false, output: 'slice regressed', failureKind: 'test' };
        return { passed: true, output: 'ok' };
      },
    };
  }

  async function runCook(
    source: string,
    actions: ActionHandlers,
    testRunner: TestRunner,
    maxRetries: number,
  ) {
    const resolved = resolveCookPlan(source);
    if (resolved.kind !== 'resolved') throw new Error('plan not resolved');
    const plan = loadPlan(resolved.planPath);
    const sandboxPlan = resolveSandboxPlan(plan.mode, resolved.sourceDir);
    if (sandboxPlan.kind !== 'codebase') throw new Error('expected codebase sandbox');
    const sandbox = createSandbox(source, undefined, { mode: 'codebase', sourceDir: sandboxPlan.sourceDir });
    const reports = (actions as { __reports?: InMemoryReportSink }).__reports!;
    const engine = createOrchestrator('serial');
    const result = await engine.run({
      plan,
      sandboxDir: sandbox.sandboxDir,
      actions,
      reports,
      testRunner,
      policy: { maxRetries },
      sandboxMode: 'codebase',
      runId: sandbox.runId,
    });
    return { result, reports, sandbox };
  }

  function withReports(reports: InMemoryReportSink, actions: ActionHandlers): ActionHandlers {
    (actions as { __reports?: InMemoryReportSink }).__reports = reports;
    return actions;
  }

  it(
    'broken epic self-heals: remediation edits product code, re-verify passes, fix round-trips to the slice branch',
    async () => {
      const source = makeSeededRepo();
      const reports = new InMemoryReportSink();
      const actions = withReports(reports, makeFakeActions(reports, { remediation: 'fix' }));

      const { result, sandbox } = await runCook(source, actions, passingRunner(), 3);

      // Epic recovered → run completes.
      expect(result.status).toBe('completed');
      expect(result.epics).toContainEqual({ epicId: 'ep', status: 'completed' });

      // verify-epic ran ≥2 times: at least one FAIL then a PASS.
      const verdicts = reports
        .getAll()
        .filter((r) => r.event === 'epic-verified')
        .map((r) => (r.payload as { passed: boolean }).passed);
      expect(verdicts).toContain(false);
      expect(verdicts).toContain(true);

      // Remediation was accepted (round-trip), not rejected.
      const remediations = reports.getAll().filter((r) => r.event === 'epic-remediated');
      expect(remediations.some((r) => (r.payload as { accepted: boolean }).accepted)).toBe(true);

      // fix-promotes: the representative slice branch carries the fix.
      const sliceSrc = readFileSync(join(sandbox.sandboxDir, 's1', 'src.txt'), 'utf8');
      expect(sliceSrc).toContain('FIXED');
    },
    GIT_TEST_TIMEOUT_MS,
  );

  it(
    'oracle integrity: a remediation that edits the epic integration test is rejected and the epic halts',
    async () => {
      const source = makeSeededRepo();
      const reports = new InMemoryReportSink();
      const actions = withReports(reports, makeFakeActions(reports, { remediation: 'touch-test' }));

      const { result } = await runCook(source, actions, passingRunner(), 2);

      expect(result.status).toBe('halted');
      const remediations = reports.getAll().filter((r) => r.event === 'epic-remediated');
      expect(remediations.length).toBeGreaterThan(0);
      expect(remediations.every((r) => (r.payload as { accepted: boolean }).accepted === false)).toBe(true);
      expect(remediations.some((r) => (r.payload as { reason?: string }).reason === 'touched-test')).toBe(
        true,
      );
    },
    GIT_TEST_TIMEOUT_MS,
  );

  it(
    'budget exhaustion: a no-op remediation burns the budget and halts with an honest reason',
    async () => {
      const source = makeSeededRepo();
      const reports = new InMemoryReportSink();
      const actions = withReports(reports, makeFakeActions(reports, { remediation: 'noop' }));

      const { result } = await runCook(source, actions, passingRunner(), 2);

      expect(result.status).toBe('halted');
      expect(result.reason ?? '').toMatch(/remediation attempts/);
      // Verify was attempted maxRetries+1 times (initial + one per budget unit).
      const verifies = reports.getAll().filter((r) => r.event === 'epic-verified');
      expect(verifies.length).toBe(3);
    },
    GIT_TEST_TIMEOUT_MS,
  );

  it(
    'dual re-verify: an epic that greens the integration test but breaks a slice suite is not accepted',
    async () => {
      const source = makeSeededRepo();
      const reports = new InMemoryReportSink();
      // Force the integration test green; the slice suite fails on the folded tree.
      const actions = withReports(
        reports,
        makeFakeActions(reports, { remediation: 'noop', epicPasses: true }),
      );

      const { result } = await runCook(source, actions, failOnFoldedRunner(), 1);

      // The integration test passed every time, yet the epic never completes:
      // the slice-suite re-verify on the folded tree vetoes it.
      expect(result.status).toBe('halted');
      const reverify = reports.getAll().filter((r) => r.event === 'epic-slice-reverify');
      expect(reverify.length).toBeGreaterThan(0);
      expect(reverify.every((r) => (r.payload as { passed: boolean }).passed === false)).toBe(true);
    },
    GIT_TEST_TIMEOUT_MS,
  );

  it(
    'infra retry (Slice B): an infra/timeout verdict re-runs verify — not the remediation agent — then completes',
    async () => {
      const source = makeSeededRepo();
      const reports = new InMemoryReportSink();
      // verify reports infra once, then passes on the re-run.
      const actions = withReports(
        reports,
        makeFakeActions(reports, { remediation: 'noop', epicInfra: 'once' }),
      );

      const { result } = await runCook(source, actions, passingRunner(), 3);

      expect(result.status).toBe('completed');
      // Verify ran twice (infra → re-verify → pass); the remediation agent was
      // never invoked — an infra blip is a toolchain re-run, not a logic fix.
      const verifies = reports.getAll().filter((r) => r.event === 'epic-verified');
      expect(verifies.length).toBe(2);
      expect(reports.getAll().filter((r) => r.event === 'epic-remediated')).toHaveLength(0);
    },
    GIT_TEST_TIMEOUT_MS,
  );

  it(
    'infra exhaustion (Slice B): a persistent infra/timeout failure halts with an honest infra reason, never remediated',
    async () => {
      const source = makeSeededRepo();
      const reports = new InMemoryReportSink();
      const actions = withReports(
        reports,
        makeFakeActions(reports, { remediation: 'noop', epicInfra: 'always' }),
      );

      const { result } = await runCook(source, actions, passingRunner(), 2);

      expect(result.status).toBe('halted');
      // Honest cause — a toolchain/timeout failure, not "tests failed" / "remediation attempts".
      expect(result.reason ?? '').toMatch(/infra retries \(toolchain\/timeout\)/);
      expect(reports.getAll().filter((r) => r.event === 'epic-remediated')).toHaveLength(0);
      // Verify was attempted maxInfraRetries+1 times (initial + one per budget unit).
      expect(reports.getAll().filter((r) => r.event === 'epic-verified')).toHaveLength(3);
    },
    GIT_TEST_TIMEOUT_MS,
  );
});

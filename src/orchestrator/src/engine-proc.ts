import { createReport } from './report-helpers.js';
import type {
  ActionContext,
  Epic,
  EpicOutcome,
  Orchestrator,
  OrchestratorInput,
  OrchestratorResult,
  Plan,
  Slice,
  SliceOutcome,
} from './types.js';

export class ProceduralOrchestrator implements Orchestrator {
  async run(input: OrchestratorInput): Promise<OrchestratorResult> {
    try {
      return await this.runInner(input);
    } catch (err) {
      return {
        status: 'halted',
        reason: err instanceof Error ? err.message : String(err),
        reports: [],
        epics: input.plan.epics.map((e) => ({ epicId: e.id, status: 'halted' as const })),
        slices: input.plan.slices.map((s) => ({ sliceId: s.id, status: 'halted' as const })),
      };
    }
  }

  private async runInner(input: OrchestratorInput): Promise<OrchestratorResult> {
    const { plan, reports, actions, testRunner, policy } = input;
    const reportIds: string[] = [];
    const sliceOutcomes: SliceOutcome[] = [];
    const epicOutcomes: EpicOutcome[] = [];

    const epicOrder = topoSort(
      plan.epics,
      (e) => e.id,
      (e) => e.depends_on,
    );

    for (const epic of epicOrder) {
      const epicSlices = plan.slices.filter((s) => s.epic_id === epic.id);
      const sliceOrder = topoSort(
        epicSlices,
        (s) => s.id,
        (s) => s.depends_on,
      );
      let epicHalted = false;

      for (const slice of sliceOrder) {
        const outcome = await this.executeSlice(slice, epic, input, reportIds);
        sliceOutcomes.push(outcome);
        if (outcome.status === 'halted') {
          epicHalted = true;
          break;
        }
      }

      if (epicHalted) {
        epicOutcomes.push({ epicId: epic.id, status: 'halted' });
        return this.haltedResult(
          plan,
          `Epic ${epic.id} halted due to slice failure`,
          reportIds,
          epicOutcomes,
          sliceOutcomes,
        );
      }

      // Epic-level verification (one call — handler owns all targets)
      if (epic.verification.length > 0) {
        const verifyId = await actions['verify-epic']({
          slice: epicSlices[0]!,
          epic,
          plan,
          worktreeDir: input.worktreeDir,
          reports,
        });
        reportIds.push(verifyId);
        const verifyReport = reports.getById(verifyId);
        if (verifyReport && !(verifyReport.payload as { passed?: boolean }).passed) {
          epicOutcomes.push({ epicId: epic.id, status: 'halted' });
          return this.haltedResult(
            plan,
            `Epic ${epic.id} verification failed`,
            reportIds,
            epicOutcomes,
            sliceOutcomes,
          );
        }
      }

      epicOutcomes.push({ epicId: epic.id, status: 'completed' });
    }

    return {
      status: 'completed',
      reports: reportIds,
      epics: epicOutcomes,
      slices: sliceOutcomes,
    };
  }

  /** Fill in unreached items as halted before returning a halted result. */
  private haltedResult(
    plan: Plan,
    reason: string,
    reportIds: string[],
    epicOutcomes: EpicOutcome[],
    sliceOutcomes: SliceOutcome[],
  ): OrchestratorResult {
    const seenEpics = new Set(epicOutcomes.map((e) => e.epicId));
    const seenSlices = new Set(sliceOutcomes.map((s) => s.sliceId));
    for (const epic of plan.epics) {
      if (!seenEpics.has(epic.id)) epicOutcomes.push({ epicId: epic.id, status: 'halted' });
    }
    for (const slice of plan.slices) {
      if (!seenSlices.has(slice.id)) sliceOutcomes.push({ sliceId: slice.id, status: 'halted' });
    }
    return { status: 'halted', reason, reports: reportIds, epics: epicOutcomes, slices: sliceOutcomes };
  }

  private async executeSlice(
    slice: Slice,
    epic: Epic,
    input: OrchestratorInput,
    reportIds: string[],
  ): Promise<SliceOutcome> {
    const { actions, reports, testRunner, policy } = input;

    const ctx: ActionContext = {
      slice,
      epic,
      plan: input.plan,
      worktreeDir: input.worktreeDir,
      reports,
    };

    // TDD inner loop
    while (true) {
      // 1. Evaluate — is this slice done?
      const evalId = await actions['evaluate-done'](ctx);
      reportIds.push(evalId);
      const evalReport = reports.getById(evalId);
      if (evalReport && (evalReport.payload as { done?: boolean }).done) {
        return { sliceId: slice.id, status: 'completed' };
      }

      // 2. Write tests
      const testWriteId = await actions['write-tests'](ctx);
      reportIds.push(testWriteId);

      // 3. Write code
      const codeWriteId = await actions['write-code'](ctx);
      reportIds.push(codeWriteId);

      // 4. Run tests (orchestrator-owned, deterministic)
      const target = slice.verification[0]?.target ?? '';
      let result = await testRunner.run(target, input.worktreeDir);
      const runReportId = createReport(reports, {
        epicId: epic.id,
        sliceId: slice.id,
        actor: 'test-runner',
        event: 'tests-run',
        payload: { passed: result.passed, output: result.output },
      });
      reportIds.push(runReportId);

      if (result.passed) {
        // Tests pass → loop back to evaluate
        continue;
      }

      // Retry loop: write-code + run-tests
      let passed = false;
      for (let retry = 0; retry < policy.maxRetries; retry++) {
        const retryCodeId = await actions['write-code'](ctx);
        reportIds.push(retryCodeId);

        result = await testRunner.run(target, input.worktreeDir);
        const retryRunId = createReport(reports, {
          epicId: epic.id,
          sliceId: slice.id,
          actor: 'test-runner',
          event: 'tests-run',
          payload: { passed: result.passed, output: result.output },
        });
        reportIds.push(retryRunId);

        if (result.passed) {
          passed = true;
          break;
        }
      }

      if (!passed) {
        return { sliceId: slice.id, status: 'halted' };
      }
      // Tests pass after retry → loop back to evaluate
    }
  }
}

// ---------------------------------------------------------------------------
// Topo sort
// ---------------------------------------------------------------------------

function topoSort<T>(items: T[], getId: (item: T) => string, getDeps: (item: T) => string[]): T[] {
  const byId = new Map(items.map((item) => [getId(item), item]));
  const visited = new Set<string>();
  const result: T[] = [];

  function visit(id: string) {
    if (visited.has(id)) return;
    visited.add(id);
    const item = byId.get(id);
    if (!item) return;
    for (const dep of getDeps(item)) {
      visit(dep);
    }
    result.push(item);
  }

  for (const item of items) visit(getId(item));
  return result;
}

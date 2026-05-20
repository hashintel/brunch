import type {
  ActionContext,
  Epic,
  EpicOutcome,
  Orchestrator,
  OrchestratorInput,
  OrchestratorResult,
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

    const epicOrder = topoSort(plan.epics);

    for (const epic of epicOrder) {
      const epicSlices = plan.slices.filter((s) => s.epic_id === epic.id);
      const sliceOrder = topoSortSlices(epicSlices);
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
        return {
          status: 'halted',
          reason: `Epic ${epic.id} halted due to slice failure`,
          reports: reportIds,
          epics: epicOutcomes,
          slices: sliceOutcomes,
        };
      }

      // Epic-level verification
      for (const v of epic.verification) {
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
          return {
            status: 'halted',
            reason: `Epic ${epic.id} verification failed: ${v.target}`,
            reports: reportIds,
            epics: epicOutcomes,
            slices: sliceOutcomes,
          };
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
      // Append a report for the test run
      const runReportId = `rpt-run-${Date.now()}`;
      reports.append({
        id: runReportId,
        ts: new Date().toISOString(),
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
        const retryRunId = `rpt-retry-${retry}-${Date.now()}`;
        reports.append({
          id: retryRunId,
          ts: new Date().toISOString(),
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
// Topo sort helpers
// ---------------------------------------------------------------------------

function topoSort(epics: Epic[]): Epic[] {
  const byId = new Map(epics.map((e) => [e.id, e]));
  const visited = new Set<string>();
  const result: Epic[] = [];

  function visit(id: string) {
    if (visited.has(id)) return;
    visited.add(id);
    const epic = byId.get(id);
    if (!epic) return;
    for (const dep of epic.depends_on) {
      visit(dep);
    }
    result.push(epic);
  }

  for (const e of epics) visit(e.id);
  return result;
}

function topoSortSlices(slices: Slice[]): Slice[] {
  const byId = new Map(slices.map((s) => [s.id, s]));
  const visited = new Set<string>();
  const result: Slice[] = [];

  function visit(id: string) {
    if (visited.has(id)) return;
    visited.add(id);
    const slice = byId.get(id);
    if (!slice) return;
    for (const dep of slice.depends_on) {
      visit(dep);
    }
    result.push(slice);
  }

  for (const s of slices) visit(s.id);
  return result;
}

import { compilePlan } from './net-compiler.js';
import type { RunCtx } from './net-compiler.js';
import type { Orchestrator, OrchestratorInput, OrchestratorResult } from './types.js';

// ---------------------------------------------------------------------------
// PetriOrchestrator — implements Orchestrator
// ---------------------------------------------------------------------------

export class PetriOrchestrator implements Orchestrator {
  async run(input: OrchestratorInput): Promise<OrchestratorResult> {
    const ctx: RunCtx = {
      reportIds: [],
      sliceOutcomes: new Map(),
      epicOutcomes: new Map(),
      halted: false,
    };

    try {
      const net = compilePlan(input, ctx);
      await net.run('serial', () => ctx.halted);
    } catch (err) {
      return {
        status: 'halted',
        reason: err instanceof Error ? err.message : String(err),
        reports: ctx.reportIds,
        epics: input.plan.epics.map(
          (e) => ctx.epicOutcomes.get(e.id) ?? { epicId: e.id, status: 'halted' as const },
        ),
        slices: input.plan.slices.map(
          (s) => ctx.sliceOutcomes.get(s.id) ?? { sliceId: s.id, status: 'halted' as const },
        ),
      };
    }

    // Fill in any slices/epics not yet in outcomes (e.g. never reached)
    for (const slice of input.plan.slices) {
      if (!ctx.sliceOutcomes.has(slice.id)) {
        ctx.sliceOutcomes.set(slice.id, { sliceId: slice.id, status: 'halted' });
        ctx.halted = true;
        ctx.haltReason ??= 'Some slices were never reached';
      }
    }
    for (const epic of input.plan.epics) {
      if (!ctx.epicOutcomes.has(epic.id)) {
        ctx.epicOutcomes.set(epic.id, { epicId: epic.id, status: 'halted' });
        ctx.halted = true;
        ctx.haltReason ??= 'Some epics were never reached';
      }
    }

    return {
      status: ctx.halted ? 'halted' : 'completed',
      reason: ctx.haltReason,
      reports: ctx.reportIds,
      epics: input.plan.epics.map((e) => ctx.epicOutcomes.get(e.id)!),
      slices: input.plan.slices.map((s) => ctx.sliceOutcomes.get(s.id)!),
    };
  }
}

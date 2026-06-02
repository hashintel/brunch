import { compileTopology, wireHandlers } from './net-compiler.js';
import type { FiringPolicy } from './petri-net.js';
import type { Orchestrator, OrchestratorInput, OrchestratorResult, RunCtx } from './types.js';

// ---------------------------------------------------------------------------
// createOrchestrator — single factory. Two-pass compilation pipeline:
//   1. compileTopology(plan, policy) → NetBlueprint (pure data)
//   2. wireHandlers(blueprint, input, ctx) → PetriNet (fire closures)
//
// FE-761 Slice 2b: halt is observed via `net.hasHaltToken()` / halt tokens
// on `:halted` places rather than `ctx.halted` mutation. The halt reason
// comes from the halt token itself (`token.haltReason`).
// ---------------------------------------------------------------------------

export function createOrchestrator(firingPolicy: FiringPolicy): Orchestrator {
  return {
    async run(input: OrchestratorInput): Promise<OrchestratorResult> {
      const ctx: RunCtx = {
        reportIds: [],
        sliceOutcomes: new Map(),
        epicOutcomes: new Map(),
      };

      let haltReason: string | undefined;
      let hasStructuralHalt = false;

      try {
        const blueprint = compileTopology(input.plan, input.policy);
        const net = wireHandlers(blueprint, input, ctx);
        await net.run(firingPolicy, () => net.hasHaltToken());

        hasStructuralHalt = net.hasHaltToken();
        // Derive halt reason from any halt token deposited during the run.
        const haltTokens = net.getHaltTokens();
        for (const { token } of haltTokens) {
          if (token.haltReason) {
            haltReason = token.haltReason;
            break;
          }
        }
      } catch (err) {
        return {
          status: 'halted',
          reason: err instanceof Error ? err.message : String(err),
          reports: [...ctx.reportIds],
          epics: input.plan.epics.map(
            (e) => ctx.epicOutcomes.get(e.id) ?? { epicId: e.id, status: 'halted' as const },
          ),
          slices: input.plan.slices.map(
            (s) => ctx.sliceOutcomes.get(s.id) ?? { sliceId: s.id, status: 'halted' as const },
          ),
        };
      }

      // Fill in any slices/epics not yet in outcomes (e.g. never reached).
      let neverReached = false;
      for (const slice of input.plan.slices) {
        if (!ctx.sliceOutcomes.has(slice.id)) {
          ctx.sliceOutcomes.set(slice.id, { sliceId: slice.id, status: 'halted' });
          neverReached = true;
        }
      }
      for (const epic of input.plan.epics) {
        if (!ctx.epicOutcomes.has(epic.id)) {
          ctx.epicOutcomes.set(epic.id, { epicId: epic.id, status: 'halted' });
          neverReached = true;
        }
      }
      if (neverReached && !haltReason) {
        haltReason = 'Some slices or epics were never reached';
      }

      const halted = hasStructuralHalt || haltReason !== undefined;

      return {
        status: halted ? 'halted' : 'completed',
        reason: haltReason,
        reports: [...ctx.reportIds],
        epics: input.plan.epics.map((e) => ctx.epicOutcomes.get(e.id)!),
        slices: input.plan.slices.map((s) => ctx.sliceOutcomes.get(s.id)!),
      };
    },
  };
}

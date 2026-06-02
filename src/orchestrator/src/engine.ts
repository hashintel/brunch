import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { compileTopology, wireHandlers } from './net-compiler.js';
import type { FiringPolicy, NetEventSink } from './petri-net.js';
import { createPetrinautEventStream } from './petrinaut-events.js';
import { serializeBlueprint } from './petrinaut-export.js';
import { createIdentityFolding, createNetFolding, type NetFolding } from './petrinaut-fold.js';
import { toSdcpnFile } from './petrinaut-sdcpn.js';
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

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function createOrchestrator(firingPolicy: FiringPolicy): Orchestrator {
  return {
    async run(input: OrchestratorInput): Promise<OrchestratorResult> {
      const ctx: RunCtx = {
        reportIds: [],
        sliceOutcomes: new Map(),
        epicOutcomes: new Map(),
        warnings: [],
      };

      let haltReason: string | undefined;
      let hasStructuralHalt = false;

      try {
        const blueprint = compileTopology(input.plan, input.policy);

        // FE-764: one folding per cook run, shared by the static export and
        // the live event stream so they fold identically. Default is the
        // identity fold (unfolded per-slice net) — the demo / small-N case;
        // `--petrinaut-fold=color` selects the color fold for large-N runs.
        const folding: NetFolding =
          input.petrinautFold === 'color' ? createNetFolding(blueprint) : createIdentityFolding(blueprint);

        // FE-762: write the Petrinaut-format compiled net to <runDir>/net.json
        // so the Petrinaut team can render the topology of this cook run.
        // Skipped when runDir is absent (library callers / tests).
        if (input.runDir) {
          try {
            const serialized = serializeBlueprint(blueprint, { runId: input.runId ?? 'unknown', folding });
            writeFileSync(join(input.runDir, 'net.json'), `${JSON.stringify(serialized, null, 2)}\n`);

            // Also emit a Petrinaut SDCPN import file so the compiled net drops
            // straight into the Petrinaut editor's file-picker import.
            const sdcpn = toSdcpnFile(serialized, {});
            writeFileSync(join(input.runDir, 'net.sdcpn.json'), `${JSON.stringify(sdcpn, null, 2)}\n`);
          } catch (err) {
            // Best-effort integration output — don't fail the cook run.
            ctx.warnings?.push(`Petrinaut net export disabled: ${errorMessage(err)}`);
          }
        }

        // FE-763: open a Petrinaut event stream when runDir is present.
        // Emits an initial_marking event up-front, then transition_fired /
        // net_halted / net_deadlocked events as the net runs. Library
        // callers without a runDir get the existing no-op behavior.
        let eventSink: NetEventSink | undefined;
        if (input.runDir) {
          try {
            const stream = createPetrinautEventStream({
              runId: input.runId ?? 'unknown',
              folding,
              filePath: join(input.runDir, 'petrinaut-events.jsonl'),
              // FE-764 slice 3a: optional in-process fan-out for the SSE bus.
              ...(input.onPetrinautEvent ? { onEvent: input.onPetrinautEvent } : {}),
              onError: (message) => ctx.warnings?.push(message),
            });
            stream.emitInitialMarking(blueprint);
            eventSink = stream.sink;
          } catch (err) {
            // Best-effort integration output — don't fail the cook run.
            ctx.warnings?.push(`Petrinaut event stream disabled: ${errorMessage(err)}`);
          }
        }

        const net = wireHandlers(blueprint, input, ctx);
        await net.run(firingPolicy, () => net.hasHaltToken(), eventSink);

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
          reason: errorMessage(err),
          warnings: ctx.warnings ?? [],
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
        warnings: ctx.warnings ?? [],
        reports: [...ctx.reportIds],
        epics: input.plan.epics.map((e) => ctx.epicOutcomes.get(e.id)!),
        slices: input.plan.slices.map((s) => ctx.sliceOutcomes.get(s.id)!),
      };
    },
  };
}

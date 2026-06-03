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
// Halt is observed via `net.hasHaltToken()` / halt tokens on `:halted`
// places rather than `ctx.halted` mutation. The halt reason comes from the
// halt token itself (`token.haltReason`).
// ---------------------------------------------------------------------------

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Combine the general Petrinaut event fan-out with the optional live-stream
 * callback so an engine event reaches both consumers in one call. Returns
 * `undefined` when neither is set so the downstream stream constructor can
 * skip wiring `onEvent` entirely.
 */
function mergeEventCallbacks(
  a: ((event: import('./petrinaut-events.js').PetrinautEvent) => void) | undefined,
  b: ((event: import('./petrinaut-events.js').PetrinautEvent) => void) | undefined,
): ((event: import('./petrinaut-events.js').PetrinautEvent) => void) | undefined {
  if (!a && !b) return undefined;
  if (a && !b) return a;
  if (!a && b) return b;
  return (event) => {
    a!(event);
    b!(event);
  };
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

        // One folding per cook run, shared by the static export and the live
        // event stream so they fold identically. Default is the identity fold
        // (unfolded per-slice net) — the demo / small-N case;
        // `--petrinaut-fold=color` selects the color fold for large-N runs.
        const folding: NetFolding =
          input.petrinautFold === 'color' ? createNetFolding(blueprint) : createIdentityFolding(blueprint);

        // Compute the Petrinaut SDCPN file once in memory. File output is
        // best-effort (failure must not fail the run), but the live stream can
        // still use the in-memory `sdcpnFile` if disk writes fail.
        const runId = input.runId ?? 'unknown';
        let sdcpnFile: ReturnType<typeof toSdcpnFile> | undefined;
        if (input.runDir) {
          try {
            const serialized = serializeBlueprint(blueprint, { runId, folding });
            sdcpnFile = toSdcpnFile(serialized, {});
            try {
              writeFileSync(join(input.runDir, 'net.json'), `${JSON.stringify(serialized, null, 2)}\n`);
              writeFileSync(join(input.runDir, 'net.sdcpn.json'), `${JSON.stringify(sdcpnFile, null, 2)}\n`);
            } catch (err) {
              // Disk write failed — `sdcpnFile` is still valid for streaming.
              ctx.warnings?.push(`Petrinaut net export disabled: ${errorMessage(err)}`);
            }
          } catch (err) {
            // Compile failed — both disk export and live stream become impossible.
            ctx.warnings?.push(`Petrinaut net export disabled: ${errorMessage(err)}`);
          }
        }

        // Open a Petrinaut event stream when runDir is present. Library
        // callers without a runDir get the existing no-op behavior.
        let eventSink: NetEventSink | undefined;
        if (input.runDir) {
          let setupCallback: ((event: import('./petrinaut-events.js').PetrinautEvent) => void) | undefined;
          // The live setup callback is assigned only after the stream has
          // initialized and setup has resolved; events are not emitted before
          // that point.
          const setupFanOut = input.setupPetrinautStream
            ? (event: import('./petrinaut-events.js').PetrinautEvent) => setupCallback?.(event)
            : undefined;
          const fanOut = mergeEventCallbacks(input.onPetrinautEvent, setupFanOut);
          let stream: ReturnType<typeof createPetrinautEventStream> | undefined;
          try {
            // Construct the event stream before starting any live-stream
            // server. If the event stream cannot initialize, no launcher URL
            // is advertised with an unwired bus behind it.
            stream = createPetrinautEventStream({
              runId,
              folding,
              filePath: join(input.runDir, 'petrinaut-events.jsonl'),
              ...(fanOut ? { onEvent: fanOut } : {}),
              onError: (message) => ctx.warnings?.push(message),
            });
          } catch (err) {
            // Best-effort integration output — don't fail the cook run.
            ctx.warnings?.push(`Petrinaut event stream disabled: ${errorMessage(err)}`);
          }

          if (stream) {
            // Await setup before emitting the first event so any async sink
            // (HTTP/SSE server) is fully listening before `initial_marking`.
            if (input.setupPetrinautStream && sdcpnFile) {
              setupCallback = await input.setupPetrinautStream({ runId, sdcpnFile });
            } else if (input.setupPetrinautStream) {
              ctx.warnings?.push('Petrinaut live stream disabled: SDCPN file was not available');
            }
            try {
              stream.emitInitialMarking(blueprint);
              eventSink = stream.sink;
            } catch (err) {
              // Best-effort integration output — don't fail the cook run.
              ctx.warnings?.push(`Petrinaut event stream disabled: ${errorMessage(err)}`);
            }
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

// ---------------------------------------------------------------------------
// In-process Petrinaut stream bus.
//
// Bridges the engine's PetrinautEvent stream into the SSE wire shape Petrinaut
// consumes (`BrunchExecutionExportFrame`). Owns the replay buffer so that any
// subscriber — including a late one that attaches after firings have already
// published — observes the full ordered timeline:
//
//   definition (once, on subscribe)
//   → initial_state (after the run's `initial_marking` PetrinautEvent)
//   → N × transition_firing (one per `transition_fired` PetrinautEvent)
//   → terminal (after the first terminal net event)
//
// Pure: no I/O, no globals, no timers. The HTTP `/stream` route mounts on
// top, serializing each frame as one SSE event.
//
// Frame translation re-uses the same `eventToTransitionFiring` /
// `reduceMarking` / `projectNetDefinition` helpers as the static reducer
// (`reduceBrunchExecutionExport`) so the live stream and the static export
// produce structurally identical content. Each `transition_firing` frame
// carries only the arc-scoped consume/produce delta (FE-819, A99); the single
// `initial_state` frame carries the full marking, and the consumer
// reconstructs the running net state from it. Replay-equivalence is enforced
// by the oracle in `petrinaut-stream-bus.test.ts`.
// ---------------------------------------------------------------------------

import type { PetrinautEvent, TerminalEventKind } from './petrinaut-events.js';
import { projectFiring, projectMarking, survivingNodes } from './petrinaut-lane-projection.js';
import type { SdcpnFile } from './petrinaut-sdcpn.js';
import {
  augmentDefinitionWithRunStatus,
  eventToTransitionFiring,
  type Marking,
  type NetDefinition,
  projectNetDefinition,
  reduceMarking,
  synthesizeRunStatusFiring,
  type TransitionFiring,
} from './petrinaut-stream-export.js';

/** Terminal run states a stream consumer can observe (FE-819 Card B). */
export type TerminalRunState = 'completed' | 'halted' | 'deadlocked';

/** Run state carried by the leading `status` frame — `running` until terminal. */
export type RunState = 'running' | TerminalRunState;

/** Map a terminal PetrinautEvent kind onto its observable run state. */
const TERMINAL_STATE: Record<TerminalEventKind, TerminalRunState> = {
  net_completed: 'completed',
  net_halted: 'halted',
  net_deadlocked: 'deadlocked',
};

/**
 * One logical frame of the SSE wire stream. Disjoint from PetrinautEvent
 * kinds so the wire and the engine's internal event union don't collide.
 *
 * `status` (FE-819 Card B) leads every connection so a consumer learns the
 * run state at connect time — `running` mid-run, or the terminal state +
 * reason for a late joiner. `terminal` carries the same state + reason at run
 * end and still closes the stream.
 */
export type BrunchExecutionExportFrame =
  | { kind: 'definition'; definition: NetDefinition }
  | { kind: 'status'; state: RunState; reason?: string }
  | { kind: 'initial_state'; initialState: Marking }
  | { kind: 'transition_firing'; firing: TransitionFiring }
  | { kind: 'terminal'; state: TerminalRunState; reason?: string };

export type CreatePetrinautStreamBusOpts = {
  /** Carried for symmetry with PetrinautEvent.runId; not currently embedded in frames. */
  runId: string;
  /** Source for the `definition` frame; known at bus construction. */
  sdcpnFile: SdcpnFile;
};

export type PetrinautStreamSubscriber = (frame: BrunchExecutionExportFrame) => void;

export type PetrinautStreamBus = {
  /** Feed an engine-emitted PetrinautEvent through the translator and fan out the resulting frame(s). */
  publish(event: PetrinautEvent): void;
  /**
   * Attach a subscriber. The full buffered timeline (definition →
   * initial_state → all firings so far → terminal if present) is delivered
   * synchronously before this call returns; subsequent frames flow live.
   * Returns an unsubscribe handle.
   */
  subscribe(handler: PetrinautStreamSubscriber): () => void;
};

/**
 * Build a pure in-process pub/sub for one cook run. The `definition` frame
 * is materialised eagerly from `opts.sdcpnFile` so subscribers attached
 * before any publish still receive it on subscribe.
 */
export function createPetrinautStreamBus(opts: CreatePetrinautStreamBusOpts): PetrinautStreamBus {
  const baseDefinition = augmentDefinitionWithRunStatus(projectNetDefinition(opts.sdcpnFile));
  // Surviving nodes drive frame projection (FE-819 Card E). With a both-mode
  // (full) definition every node survives, so projection is a no-op; with a
  // lane-projected (mechanical) definition the suppressed semantic nodes are
  // absent, so their firings drop and their place tokens fall out of frames.
  const surviving = survivingNodes(baseDefinition);
  // Materialised once; replaced in-place at a halt with a title-suffixed copy
  // so late joiners replay a single, updated definition (FE-819 Card B).
  let definitionFrame: Extract<BrunchExecutionExportFrame, { kind: 'definition' }> = {
    kind: 'definition',
    definition: baseDefinition,
  };

  // Append-only timeline; bus is the source of truth for replay order.
  // `buffer[0]` is always the definition frame.
  const buffer: BrunchExecutionExportFrame[] = [definitionFrame];
  let terminalEmitted = false;
  // Current run state + halt reason, surfaced to every new connection via the
  // leading `status` frame (FE-819 Card B).
  let runState: RunState = 'running';
  let runReason: string | undefined;
  const subscribers = new Set<PetrinautStreamSubscriber>();

  // Deliver to live subscribers only — no buffering. Snapshot to tolerate
  // handler-side unsubscribe during iteration.
  function notify(frame: BrunchExecutionExportFrame): void {
    for (const handler of [...subscribers]) handler(frame);
  }

  function broadcast(frame: BrunchExecutionExportFrame): void {
    buffer.push(frame);
    notify(frame);
  }

  return {
    publish(event: PetrinautEvent): void {
      if (terminalEmitted) return;
      switch (event.kind) {
        case 'initial_marking':
          broadcast({
            kind: 'initial_state',
            initialState: projectMarking(reduceMarking(event.marking), surviving.places),
          });
          return;
        case 'transition_fired': {
          // Each firing is an arc-scoped delta; the frame is projected onto
          // surviving nodes. A suppressed-transition firing (mechanical mode)
          // drops here (FE-819 Card E).
          const projected = projectFiring(eventToTransitionFiring(event), surviving);
          if (projected) broadcast({ kind: 'transition_firing', firing: projected });
          return;
        }
        case 'net_completed':
        case 'net_halted':
        case 'net_deadlocked': {
          terminalEmitted = true;
          runState = TERMINAL_STATE[event.kind];
          runReason = event.reason;
          // A halt with a reason re-emits the definition with a title that
          // reflects the halt: in-place so late joiners replay one updated
          // definition, plus a live re-send so already-connected subscribers
          // re-parse (the current Petrinaut consumer's onDefinition is
          // idempotent and preserves received firings).
          if (runState === 'halted' && event.reason) {
            definitionFrame = {
              kind: 'definition',
              definition: { ...baseDefinition, title: `${baseDefinition.title} — halted: ${event.reason}` },
            };
            buffer[0] = definitionFrame;
            notify(definitionFrame);
          }
          // Run end fires one synthetic run-status firing (FE-819 Card C) so
          // the halt/completion is structurally visible — the final frame
          // deposits the status token into run:halted / run:completed.
          {
            const projected = projectFiring(synthesizeRunStatusFiring(event.kind, event.ts), surviving);
            if (projected) broadcast({ kind: 'transition_firing', firing: projected });
          }
          broadcast({ kind: 'terminal', state: runState, ...(event.reason ? { reason: event.reason } : {}) });
          return;
        }
      }
    },
    subscribe(handler: PetrinautStreamSubscriber): () => void {
      // Lead with the current run state (FE-819 Card B), then synchronously
      // replay the buffered timeline so every connection — pre-subscribed or
      // late — observes the same ordered sequence.
      handler({ kind: 'status', state: runState, ...(runReason ? { reason: runReason } : {}) });
      for (const frame of buffer) handler(frame);
      subscribers.add(handler);
      return () => subscribers.delete(handler);
    },
  };
}

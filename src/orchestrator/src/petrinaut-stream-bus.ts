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
// produce structurally identical content. Replay-equivalence is enforced by
// the oracle in `petrinaut-stream-bus.test.ts`.
// ---------------------------------------------------------------------------

import type { PetrinautEvent } from './petrinaut-events.js';
import type { SdcpnFile } from './petrinaut-sdcpn.js';
import {
  eventToTransitionFiring,
  type Marking,
  type NetDefinition,
  projectNetDefinition,
  reduceMarking,
  type TransitionFiring,
} from './petrinaut-stream-export.js';

/**
 * One logical frame of the SSE wire stream. Disjoint from PetrinautEvent
 * kinds so the wire and the engine's internal event union don't collide.
 */
export type BrunchExecutionExportFrame =
  | { kind: 'definition'; definition: NetDefinition }
  | { kind: 'initial_state'; initialState: Marking }
  | { kind: 'transition_firing'; firing: TransitionFiring }
  | { kind: 'terminal' };

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
  // Materialised once — every subscriber sees the same definition object.
  const definitionFrame: BrunchExecutionExportFrame = {
    kind: 'definition',
    definition: projectNetDefinition(opts.sdcpnFile),
  };

  // Append-only timeline; bus is the source of truth for replay order.
  const buffer: BrunchExecutionExportFrame[] = [definitionFrame];
  let terminalEmitted = false;
  const subscribers = new Set<PetrinautStreamSubscriber>();

  function broadcast(frame: BrunchExecutionExportFrame): void {
    buffer.push(frame);
    // Snapshot to tolerate handler-side unsubscribe during iteration.
    for (const handler of [...subscribers]) handler(frame);
  }

  return {
    publish(event: PetrinautEvent): void {
      if (terminalEmitted) return;
      switch (event.kind) {
        case 'initial_marking':
          broadcast({ kind: 'initial_state', initialState: reduceMarking(event.marking) });
          return;
        case 'transition_fired':
          broadcast({ kind: 'transition_firing', firing: eventToTransitionFiring(event) });
          return;
        case 'net_completed':
        case 'net_halted':
        case 'net_deadlocked':
          terminalEmitted = true;
          broadcast({ kind: 'terminal' });
          return;
      }
    },
    subscribe(handler: PetrinautStreamSubscriber): () => void {
      // Synchronous replay of the buffered timeline so late subscribers
      // observe the same ordered sequence as pre-subscribed ones.
      for (const frame of buffer) handler(frame);
      subscribers.add(handler);
      return () => subscribers.delete(handler);
    },
  };
}

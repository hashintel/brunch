// ---------------------------------------------------------------------------
// FE-763 — Petrinaut event stream for a live cook run.
//
// Adapts the orchestrator's internal NetEvent stream into the cross-team-
// agreed Petrinaut event format, plus an `initial_marking` event emitted
// once at run start from the compiled blueprint.
//
// Wire format (2026-05-26 alignment):
//
//   transition_fired:
//     { kind, ts, runId, transitionName,
//       input:  { <place>: [{ id: <UUID>, ...payload }] },
//       output: { <place>: [{ id: <UUID>, ...payload }] } }
//
//   initial_marking:
//     { kind, ts, runId,
//       marking: { <place>: [{ id: <UUID>, ...payload }] } }
//
//   net_completed / net_halted / net_deadlocked:
//     { kind, ts, runId }
//
// Halt outcomes appear in two complementary forms:
//   1. structurally — as halt tokens on `slice:<sid>:halted` / `epic:<eid>:halted`
//      places (deposited by the FE-761 Slice 2b halted-as-place refactor).
//      These flow naturally through `transition_fired` events as token payload.
//   2. as a terminal event marking the run's end state.
//
// Decision needed with Petrinaut before treating token ids as durable
// identities: today every emission generates fresh UUIDs (no lineage across
// consume→emit). This module is the seam to evolve once identity semantics are
// settled.
// ---------------------------------------------------------------------------

import { randomUUID } from 'node:crypto';
import { appendFileSync, writeFileSync } from 'node:fs';

import type { NetBlueprint, TokenSeed } from './net-blueprint.js';
import type { NetEvent, NetEventSink, Token } from './petri-net.js';
import type { NetFolding } from './petrinaut-fold.js';

export type PetrinautToken = {
  id: string;
  sliceId?: string;
  epicId?: string;
  retryCount?: number;
  reworkCount?: number;
  /** Halt reason carried by halt tokens (FE-761 Slice 2b). */
  haltReason?: string;
};

export type PetrinautInitialMarkingEvent = {
  kind: 'initial_marking';
  ts: string;
  runId: string;
  marking: Record<string, PetrinautToken[]>;
};

export type PetrinautTransitionFiredEvent = {
  kind: 'transition_fired';
  ts: string;
  runId: string;
  transitionName: string;
  input: Record<string, PetrinautToken[]>;
  output: Record<string, PetrinautToken[]>;
};

/** The three terminal event kinds a run can end on. Canonical across the stream seam. */
export type TerminalEventKind = 'net_completed' | 'net_halted' | 'net_deadlocked';

export type PetrinautTerminalEvent = {
  kind: TerminalEventKind;
  ts: string;
  runId: string;
  /**
   * Halt reason, verbatim from the halt token (or the run error on the
   * exception path). Present only for `net_halted`; the wire surfaces it on
   * the leading `status` and the `terminal` frames (FE-819 Card B).
   */
  reason?: string;
};

export type PetrinautEvent =
  | PetrinautInitialMarkingEvent
  | PetrinautTransitionFiredEvent
  | PetrinautTerminalEvent;

export type CreatePetrinautEventStreamOpts = {
  runId: string;
  /** The color fold of the net being run — folds concrete firings onto the folded net (FE-784). */
  folding: NetFolding;
  /** When set, every event is appended as one JSON object per line. */
  filePath?: string;
  /** Override the per-token UUID generator (tests). */
  tokenIdFn?: () => string;
  /** Fan-out for in-memory consumers (tests, sync-server forwarder). */
  onEvent?: (event: PetrinautEvent) => void;
  /** Receives best-effort file-output failures without failing the cook run. */
  onError?: (message: string) => void;
};

export type PetrinautEventStream = {
  /** NetEventSink to pass into `PetriNet.run()`. */
  sink: NetEventSink;
  /** Emit the initial marking event from a compiled blueprint. Call once before `net.run()`. */
  emitInitialMarking(blueprint: NetBlueprint): void;
};

/**
 * Create a Petrinaut-shaped event stream. Returns a NetEventSink adapter and
 * a helper to emit the initial marking up-front. The stream writes one JSON
 * object per line to `filePath` when provided, and also fans out to
 * `onEvent` so in-process consumers (tests, the sync server) can subscribe
 * without re-reading the file.
 */
export function createPetrinautEventStream(opts: CreatePetrinautEventStreamOpts): PetrinautEventStream {
  const { runId, folding, filePath, onEvent, onError } = opts;
  const tokenId = opts.tokenIdFn ?? randomUUID;
  let fileOutputDisabled = false;

  // Initialize the file as empty so the first append produces a well-formed JSONL file.
  if (filePath) writeFileSync(filePath, '');

  function publish(event: PetrinautEvent): void {
    if (filePath && !fileOutputDisabled) {
      try {
        appendFileSync(filePath, `${JSON.stringify(event)}\n`);
      } catch (err) {
        fileOutputDisabled = true;
        onError?.(`Petrinaut event stream disabled: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    onEvent?.(event);
  }

  /** Fold an event's parallel place/token arrays onto folded places and shape the tokens. */
  function foldedTokensByPlace(
    places: string[] | undefined,
    tokens: Token[] | undefined,
  ): Record<string, PetrinautToken[]> {
    if (!places) return {};
    const entries = places.map((place, i) => {
      const token = tokens?.[i];
      return [place, token ? [token] : []] as const;
    });
    const byPlace = folding.foldedMarking(entries);
    const out: Record<string, PetrinautToken[]> = {};
    for (const [place, placeTokens] of byPlace) {
      out[place] = placeTokens.map((t) => tokenToPetrinaut(t, tokenId));
    }
    return out;
  }

  const sink: NetEventSink = {
    emit(event: NetEvent): void {
      switch (event.kind) {
        case 'transition_fired': {
          if (!event.transitionId) {
            throw new Error('transition_fired NetEvent missing transitionId');
          }
          publish({
            kind: 'transition_fired',
            ts: event.ts,
            runId,
            transitionName: folding.foldTransition(event.transitionId),
            input: foldedTokensByPlace(event.consumed, event.consumedTokens),
            output: foldedTokensByPlace(event.produced, event.producedTokens),
          });
          return;
        }
        case 'net_completed':
        case 'net_halted':
        case 'net_deadlocked': {
          publish({
            kind: event.kind,
            ts: event.ts,
            runId,
            ...(event.reason !== undefined ? { reason: event.reason } : {}),
          });
          return;
        }
      }
    },
  };

  function emitInitialMarking(blueprint: NetBlueprint): void {
    const byPlace = folding.foldedMarking(
      blueprint.initialTokens.map(({ place, token }) => [place, [token]] as const),
    );
    const marking: Record<string, PetrinautToken[]> = {};
    for (const [place, seeds] of byPlace) {
      marking[place] = seeds.map((seed) => seedToPetrinaut(seed, tokenId()));
    }
    publish({
      kind: 'initial_marking',
      ts: new Date().toISOString(),
      runId,
      marking,
    });
  }

  return { sink, emitInitialMarking };
}

function tokenToPetrinaut(token: Token, idFn: () => string): PetrinautToken {
  return {
    id: idFn(),
    ...(token.sliceId ? { sliceId: token.sliceId } : {}),
    ...(token.epicId ? { epicId: token.epicId } : {}),
    ...(token.retryCount !== undefined ? { retryCount: token.retryCount } : {}),
    ...(token.reworkCount !== undefined ? { reworkCount: token.reworkCount } : {}),
    ...(token.haltReason !== undefined ? { haltReason: token.haltReason } : {}),
  };
}

function seedToPetrinaut(seed: TokenSeed, id: string): PetrinautToken {
  return {
    id,
    ...(seed.sliceId ? { sliceId: seed.sliceId } : {}),
    ...(seed.epicId ? { epicId: seed.epicId } : {}),
    ...(seed.retryCount !== undefined ? { retryCount: seed.retryCount } : {}),
    ...(seed.reworkCount !== undefined ? { reworkCount: seed.reworkCount } : {}),
  };
}

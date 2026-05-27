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
//   net_halted / net_deadlocked:
//     { kind, ts, runId }
//
// Halt outcomes appear in two complementary forms:
//   1. structurally — as halt tokens on `slice:<sid>:halted` / `epic:<eid>:halted`
//      places (deposited by the FE-761 Slice 2b halted-as-place refactor).
//      These flow naturally through `transition_fired` events as token payload.
//   2. as a terminal `net_halted` event marking the run's end state.
//
// Open coordination item (tracked on FE-763): token UUID lifecycle —
// today every emission generates fresh UUIDs (no lineage across
// consume→emit). When Petrinaut decides whether to persist token
// identity across firings this module is the seam to evolve.
// ---------------------------------------------------------------------------

import { randomUUID } from 'node:crypto';
import { appendFileSync, writeFileSync } from 'node:fs';

import type { NetBlueprint, TokenSeed } from './net-blueprint.js';
import type { NetEvent, NetEventSink, Token } from './petri-net.js';

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

export type PetrinautTerminalEvent = {
  kind: 'net_halted' | 'net_deadlocked';
  ts: string;
  runId: string;
};

export type PetrinautEvent =
  | PetrinautInitialMarkingEvent
  | PetrinautTransitionFiredEvent
  | PetrinautTerminalEvent;

export type CreatePetrinautEventStreamOpts = {
  runId: string;
  /** When set, every event is appended as one JSON object per line. */
  filePath?: string;
  /** Override the per-token UUID generator (tests). */
  tokenIdFn?: () => string;
  /** Fan-out for in-memory consumers (tests, sync-server forwarder). */
  onEvent?: (event: PetrinautEvent) => void;
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
  const { runId, filePath, onEvent } = opts;
  const tokenId = opts.tokenIdFn ?? randomUUID;

  // Initialize the file as empty so the first append produces a well-formed JSONL file.
  if (filePath) writeFileSync(filePath, '');

  function publish(event: PetrinautEvent): void {
    if (filePath) appendFileSync(filePath, `${JSON.stringify(event)}\n`);
    onEvent?.(event);
  }

  function groupTokens(
    places: string[] | undefined,
    tokens: Token[][] | undefined,
  ): Record<string, PetrinautToken[]> {
    const out: Record<string, PetrinautToken[]> = {};
    if (!places || !tokens) return out;
    for (let i = 0; i < places.length; i++) {
      const place = places[i]!;
      const placeTokens = tokens[i] ?? [];
      const list = out[place] ?? [];
      for (const t of placeTokens) list.push(tokenToPetrinaut(t, tokenId));
      out[place] = list;
    }
    return out;
  }

  const sink: NetEventSink = {
    emit(event: NetEvent): void {
      switch (event.kind) {
        case 'transition_fired': {
          publish({
            kind: 'transition_fired',
            ts: event.ts,
            runId,
            transitionName: event.transitionId ?? '',
            input: groupTokens(event.consumed, event.consumedTokens),
            output: groupTokens(event.produced, event.producedTokens),
          });
          return;
        }
        case 'net_halted':
        case 'net_deadlocked': {
          publish({ kind: event.kind, ts: event.ts, runId });
          return;
        }
      }
    },
  };

  function emitInitialMarking(blueprint: NetBlueprint): void {
    const marking: Record<string, PetrinautToken[]> = {};
    for (const { place, token } of blueprint.initialTokens) {
      const list = marking[place] ?? [];
      list.push(seedToPetrinaut(token, tokenId()));
      marking[place] = list;
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

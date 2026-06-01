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
// Decision needed with Petrinaut before treating token ids as durable
// identities: today every emission generates fresh UUIDs (no lineage across
// consume→emit). This module is the seam to evolve once identity semantics are
// settled.
// ---------------------------------------------------------------------------

import { randomUUID } from 'node:crypto';
import { appendFileSync, writeFileSync } from 'node:fs';

import type { NetBlueprint, TokenSeed } from './net-blueprint.js';
import type { NetEvent, NetEventSink, Token } from './petri-net.js';
import { buildTransitionFoldMap, collectSliceIds, foldPlaceId, foldTransitionId } from './petrinaut-fold.js';

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
  const { runId, filePath, onEvent, onError } = opts;
  const tokenId = opts.tokenIdFn ?? randomUUID;
  let fileOutputDisabled = false;

  // FE-784 colour fold — captured from the blueprint at emitInitialMarking so
  // live firings map onto the same folded net as the static net.json export.
  // The fold map knows which transitions diverge (dep-gated `slice-ready`,
  // dep-signalling `return-done`) and so stay at their concrete ids. Until the
  // blueprint is seen, fold maps fall back to per-event slice-id derivation.
  let sliceIds: ReadonlySet<string> = new Set();
  let transitionFoldMap: Map<string, string> | undefined;

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

  function groupTokens(
    places: string[] | undefined,
    tokens: Token[] | undefined,
  ): Record<string, PetrinautToken[]> {
    const out: Record<string, PetrinautToken[]> = {};
    if (!places) return out;
    if (!tokens) {
      for (const place of places) out[foldPlaceId(place)] = [];
      return out;
    }
    for (let i = 0; i < places.length; i++) {
      const place = foldPlaceId(places[i]!);
      const list = out[place] ?? [];
      const token = tokens[i];
      if (token) list.push(tokenToPetrinaut(token, tokenId));
      out[place] = list;
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
          // Fold the concrete firing onto the exported net. Prefer the
          // blueprint-derived map (knows divergent transitions); otherwise
          // derive slice ids from this event's own place ids.
          const effectiveSliceIds = transitionFoldMap
            ? sliceIds
            : collectSliceIds([...(event.consumed ?? []), ...(event.produced ?? [])]);
          const transitionName =
            transitionFoldMap?.get(event.transitionId) ??
            foldTransitionId(event.transitionId, effectiveSliceIds);
          publish({
            kind: 'transition_fired',
            ts: event.ts,
            runId,
            transitionName,
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
    // Capture the fold context so subsequent firings map onto the same net.
    sliceIds = collectSliceIds(blueprint.places);
    transitionFoldMap = buildTransitionFoldMap(blueprint.transitions, sliceIds);

    const marking: Record<string, PetrinautToken[]> = {};
    for (const { place, token } of blueprint.initialTokens) {
      const folded = foldPlaceId(place);
      const list = marking[folded] ?? [];
      list.push(seedToPetrinaut(token, tokenId()));
      marking[folded] = list;
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

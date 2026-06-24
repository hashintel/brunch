// ---------------------------------------------------------------------------
// Petri-net interpreter — PetriNet class, Token, TransitionDef, FiringPolicy.
// ---------------------------------------------------------------------------

export type Token = {
  reportId?: string;
  sliceId: string;
  epicId: string;
  /** Retry counter — carried on retry-budget tokens. */
  retryCount?: number;
  /** Semantic rework counter — carried on semantic-budget tokens.
   *  Prevents infinite rework loops when assess-semantic always rejects. */
  reworkCount?: number;
  /** FE-884 Slice B: epic infra/timeout re-verify counter — carried on the
   *  verify-ready work token. A toolchain/timeout failure re-runs verify
   *  (bounded) without invoking remediation, so it is counted separately from
   *  `retryCount` (remediation attempts). */
  infraRetryCount?: number;
  /**
   * FE-761 Slice 2b: halt reason carried on tokens emitted to `:halted`
   * places. Engine derives `result.reason` from this field. Replaces the
   * retired `ctx.haltReason` mutation seam.
   */
  haltReason?: string;
};

/**
 * Serializable snapshot of a net's marking — every place mapped to its current
 * tokens. Tokens are plain data, so this is JSON-serializable: a halted run can
 * persist its marking and a freshly recompiled net (same topology) can re-enter
 * the interpreter at it (durable-resume). Captures quiescent markings only —
 * in-flight deferred work is not represented, so snapshot at a halt/quiescent
 * point.
 */
export type MarkingSnapshot = {
  places: Record<string, Token[]>;
};

/**
 * Typed metadata per transition — describes what a transition represents
 * without affecting firing semantics. Enables the interpreter and event
 * model to distinguish mechanical from semantic transitions.
 */
export type TransitionContract = {
  /** Transition classification. */
  kind: 'mechanical' | 'semantic' | 'structural';
  /** Which subnet lane this transition belongs to. */
  lane?: 'mechanical' | 'semantic' | 'epic';
  /** What entity fires this transition. */
  actor?: 'coding-agent' | 'test-agent' | 'test-runner' | 'evaluator' | 'semantic-assessor' | 'orchestrator';
  /** Human-readable guard description (predicate logic is in the fire handler). */
  guard?: string;
};

export type TransitionDef = {
  id: string;
  inputs: string[];
  /** Optional typed metadata — does not affect firing semantics. */
  contract?: TransitionContract;
  /**
   * Optional peek-time enabling guard. Evaluated against the first token in
   * each input place (peeked, not consumed) before the transition is
   * considered enabled. Returns true to allow firing, false to defer.
   * Used by FE-761 sibling transitions to express mutually-exclusive
   * conditional branching at the topology level.
   */
  guard?: (peeked: Token[]) => boolean;
  fire: (consumed: Token[]) => Promise<{ place: string; token: Token }[]>;
};

/**
 * Firing policy determines how the interpreter selects the next enabled
 * transition.  `serial` fires first-enabled one at a time; `parallel`
 * fires all enabled transitions concurrently via greedy token claiming.
 */
export type FiringPolicy = 'serial' | 'parallel';

// ---------------------------------------------------------------------------
// §7 Event vocabulary — structured events emitted by the interpreter.
// ---------------------------------------------------------------------------

/** Event kinds aligned with spec doc §7. */
export type NetEventKind = 'transition_fired' | 'net_deadlocked' | 'net_halted' | 'net_completed';

/**
 * Structured event emitted during net execution.
 *
 * `consumed` / `produced` are place-name lists (one entry per arc).
 * `consumedTokens` / `producedTokens` carry the single token that traversed
 * each corresponding arc. Brunch currently models one-token-per-arc firing;
 * if multi-token arcs become real, this contract should change deliberately
 * with tests that exercise that capability.
 */
export type NetEvent = {
  kind: NetEventKind;
  ts: string;
  transitionId?: string;
  contract?: TransitionContract;
  consumed?: string[];
  consumedTokens?: Token[];
  produced?: string[];
  producedTokens?: Token[];
  /** Halt reason, set on `net_halted` from the halt token (FE-819 Card B). */
  reason?: string;
};

/** Sink for structured net events. Optional — defaults to no-op. */
export interface NetEventSink {
  emit(event: NetEvent): void;
}

/** Place names that may retain tokens after clean termination (resource pools, budgets, markers). */
const BENIGN_RESIDUAL_PLACES = new Set([
  'retry-budget',
  'semantic-budget',
  'completed',
  'done',
  // FE-761 Slice 2a: halt sink — receives a token when a slice/epic halts.
  // Treated as benign so the engine reports net_halted (via ctx) rather than
  // a spurious net_deadlocked.
  'halted',
]);

export function placeName(placeId: string): string {
  const sliceMatch = placeId.match(/^slice:[^:]+:(.+)$/);
  if (sliceMatch) return sliceMatch[1]!;
  const epicMatch = placeId.match(/^epic:[^:]+:(.+)$/);
  if (epicMatch) return epicMatch[1]!;
  return placeId;
}

type TransitionClaim = { transition: TransitionDef; consumed: Token[] };
export type ConsumedClaim = { places: string[]; tokens: Token[] };

export class PetriNet {
  private places = new Map<string, Token[]>();
  private transitions: TransitionDef[] = [];

  // ------------------------------------------------------------------
  // FE-761 Slice 3: async dispatch / deferred completion plumbing.
  //
  // A producer fire closure may return its synchronous outputs (e.g.
  // returning an agent token to its pool) AND additionally enqueue
  // asynchronous follow-up work via `scheduleDeferred(work)`. The
  // deferred Promise resolves with the eventual output tokens, which
  // are then deposited as if a separate fire had produced them. The
  // run loop awaits at least one deferred completion whenever no
  // transition is immediately enabled, so the engine continues to
  // step other independent slices while a handler is in flight.
  // ------------------------------------------------------------------
  private pendingDeferred = 0;
  private deferredWaiters: Array<() => void> = [];
  private deferredEventSink?: NetEventSink;
  private deferredError?: unknown;

  /**
   * Enqueue asynchronous follow-up work whose resolved tokens should be
   * deposited into the net once the Promise settles. Used by producer
   * fire closures to decouple handler invocation from synchronous emit.
   *
   * The provided `transitionId` and `contract` are used to emit a
   * `transition_fired` event when the deferred outputs land, so async
   * completions appear in the event stream just like synchronous fires.
   *
   * Error semantics are intentionally first-error-wins for now: the next run
   * loop turn observes `deferredError`, throws it, and leaves any later
   * settlements as background bookkeeping. Deferred success emits exactly one
   * event when outputs are deposited; the synchronous producer fire returns []
   * and does not emit its own transition_fired event.
   */
  scheduleDeferred(
    transitionId: string,
    contract: TransitionContract | undefined,
    consumed: ConsumedClaim,
    work: Promise<{ place: string; token: Token }[]>,
  ): void {
    this.pendingDeferred++;
    work
      .then((outputs) => this.completeDeferred(transitionId, contract, consumed, outputs))
      .catch((err) => {
        this.deferredError ??= err;
        this.pendingDeferred--;
        this.wakeOneWaiter();
      });
  }

  private completeDeferred(
    transitionId: string,
    contract: TransitionContract | undefined,
    consumed: ConsumedClaim,
    outputs: { place: string; token: Token }[],
  ): void {
    const producedPlaces: string[] = [];
    const producedTokens: Token[] = [];
    for (const { place, token } of outputs) {
      this.addToken(place, token);
      producedPlaces.push(place);
      producedTokens.push(token);
    }
    this.deferredEventSink?.emit({
      kind: 'transition_fired',
      ts: new Date().toISOString(),
      transitionId,
      contract,
      consumed: consumed.places,
      consumedTokens: consumed.tokens,
      produced: producedPlaces,
      producedTokens,
    });
    this.pendingDeferred--;
    this.wakeOneWaiter();
  }

  private wakeOneWaiter(): void {
    const wake = this.deferredWaiters.shift();
    if (wake) wake();
  }

  private async waitForOneDeferred(): Promise<void> {
    return new Promise((resolve) => this.deferredWaiters.push(resolve));
  }

  addPlace(id: string): void {
    this.places.set(id, []);
  }

  addToken(placeId: string, token: Token): void {
    const tokens = this.places.get(placeId);
    if (!tokens) throw new Error(`Unknown place: ${placeId}`);
    tokens.push(token);
  }

  addTransition(def: TransitionDef): void {
    this.transitions.push(def);
  }

  /**
   * Snapshot the current marking as plain, JSON-serializable data — a deep copy
   * so later net mutation does not bleed into the snapshot. Includes every
   * place (empty ones too) so a restore reproduces the exact distribution.
   */
  snapshotMarking(): MarkingSnapshot {
    const places: Record<string, Token[]> = {};
    for (const [placeId, tokens] of this.places) {
      places[placeId] = tokens.map((t) => ({ ...t }));
    }
    return { places };
  }

  /**
   * Replace the current marking with `snapshot`: every existing place is
   * cleared, then the snapshot's tokens are deposited (deep-copied). A snapshot
   * place absent from this net is a topology mismatch and throws — the
   * recompiled net must match the net the snapshot was taken from. Resume
   * assumes a quiescent snapshot (no in-flight deferred work).
   */
  restoreMarking(snapshot: MarkingSnapshot): void {
    for (const placeId of Object.keys(snapshot.places)) {
      if (!this.places.has(placeId)) {
        throw new Error(`Cannot restore marking: unknown place "${placeId}"`);
      }
    }
    for (const placeId of this.places.keys()) {
      this.places.set(
        placeId,
        (snapshot.places[placeId] ?? []).map((t) => ({ ...t })),
      );
    }
  }

  /** Returns the number of registered places. */
  get placeCount(): number {
    return this.places.size;
  }

  /** Returns the number of registered transitions. */
  get transitionCount(): number {
    return this.transitions.length;
  }

  /** Returns registered transitions for inspection (e.g. adapter tests). */
  getTransitions(): ReadonlyArray<TransitionDef> {
    return this.transitions;
  }

  /**
   * FE-761 Slice 2b: place-level halt introspection. Returns true when any
   * place whose name ends in `:halted` currently holds tokens. The engine
   * uses this as the structural halt signal in place of the retired
   * `ctx.halted` mutation.
   */
  hasHaltToken(): boolean {
    for (const [placeId, tokens] of this.places) {
      if (tokens.length === 0) continue;
      if (placeName(placeId) === 'halted') return true;
    }
    return false;
  }

  /**
   * FE-761 Slice 2b: return all tokens currently sitting on halt-sink places.
   * Engine reads these to derive `result.reason` and per-scope halt status.
   */
  getHaltTokens(): { placeId: string; token: Token }[] {
    const out: { placeId: string; token: Token }[] = [];
    for (const [placeId, tokens] of this.places) {
      if (placeName(placeId) !== 'halted') continue;
      for (const token of tokens) out.push({ placeId, token });
    }
    return out;
  }

  /**
   * First halt reason carried by any halt token, for enriching the
   * `net_halted` terminal event (FE-819 Card B). Undefined when no halt token
   * carries a reason.
   */
  private firstHaltReason(): string | undefined {
    for (const { token } of this.getHaltTokens()) {
      if (token.haltReason) return token.haltReason;
    }
    return undefined;
  }

  /**
   * True when every input place of `t` has at least one token AND, if `t`
   * defines a peek-time enabling guard, that guard returns true for the
   * first token at each input place.
   */
  private isEnabled(t: TransitionDef): boolean {
    const peeked: Token[] = [];
    for (const p of t.inputs) {
      const tokens = this.places.get(p);
      if (!tokens || tokens.length === 0) return false;
      peeked.push(tokens[0]!);
    }
    if (t.guard && !t.guard(peeked)) return false;
    return true;
  }

  /**
   * durable-resume (FE-1082): true when the net stopped with resumable work
   * still on it — work-bearing tokens remain (not a clean completion). The
   * engine uses this to decide whether to persist a resume snapshot.
   */
  hasPendingWork(): boolean {
    return this.hasWorkBearingTokens();
  }

  /** True when any non-resource place still holds tokens (actual deadlock, not clean completion). */
  private hasWorkBearingTokens(): boolean {
    for (const [placeId, tokens] of this.places) {
      if (tokens.length === 0) continue;
      if (placeId.startsWith('pool:')) continue;
      const name = placeName(placeId);
      if (BENIGN_RESIDUAL_PLACES.has(name)) continue;
      return true;
    }
    return false;
  }

  private restoreClaim({ transition, consumed }: TransitionClaim): void {
    for (let i = 0; i < transition.inputs.length; i++) {
      this.addToken(transition.inputs[i]!, consumed[i]!);
    }
  }

  private depositClaim(
    { transition, consumed }: TransitionClaim,
    outputs: { place: string; token: Token }[],
    eventSink?: NetEventSink,
  ): void {
    const producedPlaces: string[] = [];
    const producedTokens: Token[] = [];
    for (const { place, token } of outputs) {
      this.addToken(place, token);
      producedPlaces.push(place);
      producedTokens.push(token);
    }
    // Deferred handlers return [] synchronously; their transition_fired
    // event is emitted once from completeDeferred when outputs land.
    if (producedPlaces.length === 0) return;
    eventSink?.emit({
      kind: 'transition_fired',
      ts: new Date().toISOString(),
      transitionId: transition.id,
      contract: transition.contract,
      consumed: transition.inputs,
      consumedTokens: consumed,
      produced: producedPlaces,
      producedTokens,
    });
  }

  async run(policy: FiringPolicy, shouldHalt?: () => boolean, eventSink?: NetEventSink): Promise<void> {
    if (policy === 'serial') {
      await this.runSerial(shouldHalt, eventSink);
    } else {
      await this.runParallel(shouldHalt, eventSink);
    }
  }

  /** Serial policy — find first enabled transition, fire, repeat. */
  private async runSerial(shouldHalt?: () => boolean, eventSink?: NetEventSink): Promise<void> {
    this.deferredEventSink = eventSink;
    while (true) {
      if (this.deferredError) throw this.deferredError;
      if (shouldHalt?.()) {
        eventSink?.emit({ kind: 'net_halted', ts: new Date().toISOString(), reason: this.firstHaltReason() });
        break;
      }

      const enabled = this.transitions.find((t) => this.isEnabled(t));
      if (!enabled) {
        // FE-761 Slice 3: when nothing is immediately enabled, wait for any
        // in-flight deferred completion to deposit its outputs before
        // re-evaluating enablement. Only declare deadlock when both the
        // step list AND the pending-completion queue are empty.
        if (this.pendingDeferred > 0) {
          await this.waitForOneDeferred();
          continue;
        }
        if (this.hasWorkBearingTokens()) {
          eventSink?.emit({ kind: 'net_deadlocked', ts: new Date().toISOString() });
        } else {
          eventSink?.emit({ kind: 'net_completed', ts: new Date().toISOString() });
        }
        break;
      }

      const claim: TransitionClaim = { transition: enabled, consumed: [] };
      for (const p of enabled.inputs) {
        claim.consumed.push(this.places.get(p)!.shift()!);
      }

      try {
        const outputs = await enabled.fire(claim.consumed);
        this.depositClaim(claim, outputs, eventSink);
      } catch (err) {
        this.restoreClaim(claim);
        throw err;
      }
    }
  }

  /**
   * Parallel policy — find all enabled transitions, claim tokens greedily,
   * fire all claimed transitions concurrently via Promise.allSettled, repeat.
   *
   * Successful fires in a batch are committed before checking halt, matching
   * serial semantics where each completed fire persists. Handler rejections
   * deliberately roll back the entire claimed batch and rethrow the first
   * rejection: this is an all-or-nothing net-state boundary for FE-743, not
   * per-slice failure isolation. External handler side effects are not
   * compensated here; if agent flakiness becomes common, per-claim rollback or
   * AggregateError collection should be designed as a follow-up.
   */
  private async runParallel(shouldHalt?: () => boolean, eventSink?: NetEventSink): Promise<void> {
    this.deferredEventSink = eventSink;
    while (true) {
      if (this.deferredError) throw this.deferredError;
      if (shouldHalt?.()) {
        eventSink?.emit({ kind: 'net_halted', ts: new Date().toISOString(), reason: this.firstHaltReason() });
        break;
      }

      const allEnabled = this.transitions.filter((t) => this.isEnabled(t));

      if (allEnabled.length === 0) {
        // FE-761 Slice 3: same deferred-await behavior as serial mode —
        // wait for an in-flight async completion before declaring deadlock.
        if (this.pendingDeferred > 0) {
          await this.waitForOneDeferred();
          continue;
        }
        if (this.hasWorkBearingTokens()) {
          eventSink?.emit({ kind: 'net_deadlocked', ts: new Date().toISOString() });
        } else {
          eventSink?.emit({ kind: 'net_completed', ts: new Date().toISOString() });
        }
        break;
      }

      const claims: TransitionClaim[] = [];
      for (const t of allEnabled) {
        if (!this.isEnabled(t)) continue;

        const consumed: Token[] = [];
        for (const p of t.inputs) {
          consumed.push(this.places.get(p)!.shift()!);
        }
        claims.push({ transition: t, consumed });
      }

      if (claims.length === 0) {
        eventSink?.emit({
          kind: this.hasWorkBearingTokens() ? 'net_deadlocked' : 'net_completed',
          ts: new Date().toISOString(),
        });
        break;
      }

      const results = await Promise.allSettled(
        claims.map(async (claim) => ({
          claim,
          outputs: await claim.transition.fire(claim.consumed),
        })),
      );

      let hasRejection = false;
      let firstError: unknown;
      const fulfilled: { claim: TransitionClaim; outputs: { place: string; token: Token }[] }[] = [];

      for (const result of results) {
        if (result.status === 'fulfilled') {
          fulfilled.push(result.value);
        } else {
          hasRejection = true;
          firstError ??= result.reason;
        }
      }

      if (hasRejection) {
        for (const claim of claims) {
          this.restoreClaim(claim);
        }
        throw firstError;
      }

      for (const { claim, outputs } of fulfilled) {
        this.depositClaim(claim, outputs, eventSink);
      }
      if (shouldHalt?.()) {
        eventSink?.emit({ kind: 'net_halted', ts: new Date().toISOString(), reason: this.firstHaltReason() });
        break;
      }
    }
  }
}

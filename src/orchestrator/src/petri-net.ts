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
export type NetEventKind = 'transition_fired' | 'net_deadlocked' | 'net_halted';

/** Structured event emitted during net execution. */
export type NetEvent = {
  kind: NetEventKind;
  ts: string;
  transitionId?: string;
  contract?: TransitionContract;
  consumed?: string[];
  produced?: string[];
};

/** Sink for structured net events. Optional — defaults to no-op. */
export interface NetEventSink {
  emit(event: NetEvent): void;
}

/** Place names that may retain tokens after clean termination (resource pools, budgets, markers). */
const BENIGN_RESIDUAL_PLACES = new Set(['retry-budget', 'semantic-budget', 'completed', 'done']);

function placeName(placeId: string): string {
  const sliceMatch = placeId.match(/^slice:[^:]+:(.+)$/);
  if (sliceMatch) return sliceMatch[1]!;
  const epicMatch = placeId.match(/^epic:[^:]+:(.+)$/);
  if (epicMatch) return epicMatch[1]!;
  return placeId;
}

type TransitionClaim = { transition: TransitionDef; consumed: Token[] };

export class PetriNet {
  private places = new Map<string, Token[]>();
  private transitions: TransitionDef[] = [];

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

  /** True when every input place of `t` has at least one token. */
  private isEnabled(t: TransitionDef): boolean {
    return t.inputs.every((p) => {
      const tokens = this.places.get(p);
      return tokens && tokens.length > 0;
    });
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
    { transition, consumed: _consumed }: TransitionClaim,
    outputs: { place: string; token: Token }[],
    eventSink?: NetEventSink,
  ): void {
    const producedPlaces: string[] = [];
    for (const { place, token } of outputs) {
      this.addToken(place, token);
      producedPlaces.push(place);
    }
    eventSink?.emit({
      kind: 'transition_fired',
      ts: new Date().toISOString(),
      transitionId: transition.id,
      contract: transition.contract,
      consumed: transition.inputs,
      produced: producedPlaces,
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
    while (true) {
      if (shouldHalt?.()) {
        eventSink?.emit({ kind: 'net_halted', ts: new Date().toISOString() });
        break;
      }

      const enabled = this.transitions.find((t) => this.isEnabled(t));
      if (!enabled) {
        if (this.hasWorkBearingTokens()) {
          eventSink?.emit({ kind: 'net_deadlocked', ts: new Date().toISOString() });
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
    while (true) {
      if (shouldHalt?.()) {
        eventSink?.emit({ kind: 'net_halted', ts: new Date().toISOString() });
        break;
      }

      const allEnabled = this.transitions.filter((t) => this.isEnabled(t));

      if (allEnabled.length === 0) {
        if (this.hasWorkBearingTokens()) {
          eventSink?.emit({ kind: 'net_deadlocked', ts: new Date().toISOString() });
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

      if (claims.length === 0) break;

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
        eventSink?.emit({ kind: 'net_halted', ts: new Date().toISOString() });
        break;
      }
    }
  }
}

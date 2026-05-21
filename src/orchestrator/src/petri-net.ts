// ---------------------------------------------------------------------------
// Petri-net interpreter — extracted from engine-petri.ts for Phase 0.
// PetriNet class, Token, TransitionDef, and FiringPolicy live here.
// ---------------------------------------------------------------------------

export type Token = {
  reportId?: string;
  sliceId: string;
  epicId: string;
  /** Retry counter — carried on retry-budget tokens. Phase 0 extension
   *  to move retry state into the net instead of leaking to ctx.retries. */
  retryCount?: number;
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
 * transition.  Phase 0 ships only `serial` (first-enabled); Phase 2 will
 * add `parallel` (all-enabled concurrently).
 */
export type FiringPolicy = 'serial';

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

  hasTokens(placeId: string): boolean {
    const tokens = this.places.get(placeId);
    return !!tokens && tokens.length > 0;
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

  async run(_policy: FiringPolicy, shouldHalt?: () => boolean, eventSink?: NetEventSink): Promise<void> {
    // Phase 0: only serial policy — find first enabled, fire, repeat.
    while (true) {
      if (shouldHalt?.()) {
        eventSink?.emit({ kind: 'net_halted', ts: new Date().toISOString() });
        break;
      }

      const enabled = this.transitions.find((t) =>
        t.inputs.every((p) => {
          const tokens = this.places.get(p);
          return tokens && tokens.length > 0;
        }),
      );
      if (!enabled) {
        // No enabled transition — either deadlock or clean termination.
        // Deadlock = places have tokens but no transition can fire.
        const hasTokens = [...this.places.values()].some((tokens) => tokens.length > 0);
        if (hasTokens) {
          eventSink?.emit({ kind: 'net_deadlocked', ts: new Date().toISOString() });
        }
        break;
      }

      // Consume one token per input place
      const consumed: Token[] = [];
      for (const p of enabled.inputs) {
        consumed.push(this.places.get(p)!.shift()!);
      }

      // Fire — handler decides outputs
      const outputs = await enabled.fire(consumed);
      const producedPlaces: string[] = [];
      for (const { place, token } of outputs) {
        this.addToken(place, token);
        producedPlaces.push(place);
      }

      // Emit transition_fired event
      eventSink?.emit({
        kind: 'transition_fired',
        ts: new Date().toISOString(),
        transitionId: enabled.id,
        contract: enabled.contract,
        consumed: enabled.inputs,
        produced: producedPlaces,
      });
    }
  }
}

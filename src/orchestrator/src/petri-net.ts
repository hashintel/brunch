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

export type TransitionDef = {
  id: string;
  inputs: string[];
  fire: (consumed: Token[]) => Promise<{ place: string; token: Token }[]>;
};

/**
 * Firing policy determines how the interpreter selects the next enabled
 * transition.  Phase 0 ships only `serial` (first-enabled); Phase 2 will
 * add `parallel` (all-enabled concurrently).
 */
export type FiringPolicy = 'serial';

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

  async run(_policy: FiringPolicy, shouldHalt?: () => boolean): Promise<void> {
    // Phase 0: only serial policy — find first enabled, fire, repeat.
    while (true) {
      if (shouldHalt?.()) break;

      const enabled = this.transitions.find((t) =>
        t.inputs.every((p) => {
          const tokens = this.places.get(p);
          return tokens && tokens.length > 0;
        }),
      );
      if (!enabled) break;

      // Consume one token per input place
      const consumed: Token[] = [];
      for (const p of enabled.inputs) {
        consumed.push(this.places.get(p)!.shift()!);
      }

      // Fire — handler decides outputs
      const outputs = await enabled.fire(consumed);
      for (const { place, token } of outputs) {
        this.addToken(place, token);
      }
    }
  }
}

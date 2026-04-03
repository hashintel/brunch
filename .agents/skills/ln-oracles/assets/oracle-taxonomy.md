# Oracle Taxonomy

An oracle is any mechanism that distinguishes correct behavior from incorrect behavior. The best oracle removes the most bad degrees of freedom per unit time (Regehr). Coverage is easy to game; choose oracles that constrain actual wrongness, not just exercise paths.

## Families by natural loop tier

### Inner loop (ms-scale, always-on)

- **Schema validation** -- structural correctness at boundaries. Validate all `unknown` data: HTTP, DB, queues, external APIs, user input. A single schema artifact serves validation, generation, and contract testing.
- **Type-level tests** -- compile-time correctness proofs for public API surfaces, utility types, builder patterns, event maps.
- **Type-aware linting** -- semantic static checks beyond style: promise misuse, unsafe narrowing, unhandled async, bogus boolean checks.
- **Fast unit tests** -- scoped to changed modules, exercising pure domain logic.

### Middle loop (seconds-minutes, regression/fitness)

- **Property-based testing** -- one property encodes many tests. Prioritize: round-trip (encode/decode), metamorphic (f(f(x)) = f(x)), invariant (totals conserved), model-based (compare against reference).
- **Contract testing** -- boundary agreement between producer and consumer. Catches service drift without full integration environments.
- **Mutation testing** -- measures whether the test suite can distinguish wrong code from right code. Run on critical modules, not universally.
- **Performance budgets** -- latency, bundle size, query count, render count, memory. Executable regression gates, not aspirational targets.
- **Accessibility assertions** -- structural compliance checks in browser tests. Converts fuzzy UX requirements into executable oracles.
- **Differential testing** -- compare implementations: new vs old, spec vs code, golden master vs current output. Especially valuable at LLM boundaries where ground truth is hand-labeled.

### Outer loop (slow hardening)

- **API fuzzing** -- generate tests from API schemas (OpenAPI, GraphQL). Finds edge-case combinations humans don't enumerate. Yields reproducible failures.
- **Large-seed campaigns** -- extended property-based runs, wider compatibility matrices, soak and concurrency tests, failure injection.
- **Manual walkthrough** -- human observer with structured checklist. Irreplaceable for qualitative judgment (UX feel, content quality, flow coherence).
- **Fixture capture** -- materialize golden master fixtures from confirmed-good manual runs (e.g. query DB after a good session). Bootstraps ground truth without hand-authoring JSON.

## Underrated patterns

**Metamorphic testing** -- when no ground truth exists, assert relationships between runs: idempotency, monotonicity, commutativity, invariance under transformation. Often easier to author than expected-value tests and much harder to game.

**Model-based testing** -- keep a tiny dumb reference model (in-memory map, naive ledger, simple state machine). Compare the real system against it with generated traces.

**Round-trip oracles** -- serialize then deserialize, migrate up then down, render then parse. Proves structural consistency without knowing the "right" answer.

**Negative-space oracles** -- don't prove correctness; catch "obviously bad" fast: no uncaught exceptions, no 5xx in critical paths, no secret leakage in logs, no new circular dependencies, no hydration mismatches.

## The combination principle

The best oracle is often a **pair of independent artifacts**:

- schema + generator (structure defines, generator explores)
- spec + fuzzer (spec constrains, fuzzer probes)
- old impl + new impl (differential oracle)
- type system + property tests (static + dynamic)
- UI journey + accessibility scan (behavioral + structural)
- performance baseline + budget (measurement + gate)
- golden master + observer output (reference + implementation)

Pairs remove more degrees of freedom than either artifact alone. This is a heuristic, not a mandate -- a single oracle that covers the critical path is better than a forced pair.

## Selection heuristic

For each claim that needs verification:

1. What oracle family addresses it?
2. Which loop tier does it belong in?
3. What is setup cost vs cost-of-being-wrong?
4. Can it pair with another oracle for compound assurance?

Prefer the oracle that gives the crispest signal in the tightest loop. When cost is uncertain, flag for `ln-spike` rather than collapsing uncertainty into a confident estimate.

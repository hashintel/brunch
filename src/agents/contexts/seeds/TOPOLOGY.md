# agents/contexts/seeds/ — context seeds

SPEC decisions: D58-L, D76-L, D78-L, D91-L, D102-L, A36-L

## Owns

Seed text that Brunch deliberately inserts into model context:

- `turn-context.ts` renders the selected workspace/session snapshot used by background subagent context assembly.
- `origination.ts` composes the provider-visible `brunch.context_seed` payload used when a session is kicked or resumed.
- `graph-fact-seed.ts` derives and renders the thin, graph-derived neutral seed (D102-L, A36-L): raw facts only — graph LSN, node counts by kind, and zero-count kinds with their `latestExpectedBand` — never a score, rank, or "this is underanswered" judgment. It has no `settlement` dependency; the seed must not depend on settlement state.

All three modules are pure over already-read data. Callers own PULL: graph reads, the session elicitation-scratchpad projection, workspace inspection, transcript-tail classification, and Pi/session side effects.

Seed wording is intentionally protected with semantic invariant tests rather than full goldens. These blocks are glue between already-goldened renderers and live prompt assembly; the contract is stable scope tags, selected workspace/spec/session facts, and graph-fact-seed summaries, not exact prose beyond those invariants.

## Boundary rules

```pseudo
rules:
  seeds/*          -> agents/contexts/data-model/, agents/contexts/exchanges/, graph/, session/schema [format already-read facts]
  .pi/extensions/ -> seeds/                            [foreground/background prompt adapters]
  session/        -> seeds/origination.ts              [append choreography uses seed text]
  seeds/          x> .pi/, app/, rpc/                  [no host, adapter, or transport effects]
```

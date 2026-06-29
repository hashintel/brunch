# agents/contexts/seeds/ — context seeds

SPEC decisions: D58-L, D76-L, D78-L, D91-L

## Owns

Seed text that Brunch deliberately inserts into model context:

- `turn-context.ts` composes compact per-turn pushed context blocks for prompt assembly and background subagent world snapshots.
- `origination.ts` composes the provider-visible `brunch.context_seed` payload used when a session is kicked or resumed.

Both modules are pure over already-read data. Callers own PULL: graph reads, gap reads, workspace inspection, transcript-tail classification, and Pi/session side effects.

Seed wording is intentionally protected with semantic invariant tests rather than full goldens. These blocks are glue between already-goldened renderers and live prompt assembly; the contract is stable scope tags, selected workspace/spec/session facts, gap/readiness summaries, and graph-priority ordering, not exact prose beyond those invariants.

## Boundary rules

```pseudo
rules:
  seeds/*          -> agents/contexts/*, graph/, session/schema [format already-read facts]
  .pi/extensions/ -> seeds/                            [foreground/background prompt adapters]
  session/        -> seeds/origination.ts              [append choreography uses seed text]
  seeds/          x> .pi/, app/, rpc/                  [no host, adapter, or transport effects]
```

# agents/runtime/shared/ — shared prompt runtime helpers

SPEC decisions: D40-L, D52-L, D90-L, D93-L, D98-L

## Owns

`src/agents/runtime/shared/` owns Pi-independent runtime helpers that are shared by live foreground agents without carrying elicitor-specific control policy.

## Boundary Rules

```pseudo
rules:
  agents/runtime/{elicitor,...}/ -> agents/runtime/shared/ [pure shared helpers]
  agents/runtime/shared/ x> agents/runtime/suspended/ [no legacy control reads]
  agents/runtime/shared/ x> .pi/ [no adapter effects]
```

## Migration Note

Only helpers with at least two current runtime readers belong here. The live elicitor path should stay in `agents/runtime/elicitor/`; legacy control policy should move to `agents/runtime/suspended/`.

# .pi/extensions/dev-mode/session-query/ — dev session-log query tool

SPEC decisions: D39-L, D58-L, D69-L, D71-L

## Owns

Dev-gated, read-only Pi tool registration for `brunch_session_query`: predicate matching over the current session branch, capped path projection, and output truncation/spillover.

## Does NOT own

- Provider-payload capture or `/introspect` reporting — sibling `../introspection/` owns the payload plane.
- Prompt-resource manifests or product prompt behavior — `.pi/extensions/agent-runtime/runtime/` (manifest/legality), `.pi/extensions/agent-runtime/system-prompts/` (composition), and the `.pi/agents/` + `.pi/skills/` markdown bodies.
- Product transcript/domain projection — top-level `session/` and `projections/` seams.

## Boundary rules

```pseudo
rules:
  session-query/ -> ctx.sessionManager.getBranch()       [read-only]
  session-query/ x> session mutation / pi.appendEntry    [no writes]
  session-query/ x> prompt-resource manifests            [tool description nudge only]
```

## Migration notes

This is the slice-2 conversational introspection surface for `dx-introspection-live`: the agent can query and echo exact session-log values in chat without adding product prompt resources or weakening the sealed profile.

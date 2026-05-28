<!-- CARDS.md — temporary execution queue for the active FE-744 frontier.
     Delete when exhausted or superseded. Canonical state remains in memory/SPEC.md and memory/PLAN.md. -->

# Cards — FE-744 public RPC elicitation parity

## Orientation

- **Containing seam:** FE-744 `pi-ui-extension-patterns`, now re-aimed from the completed raw Pi RPC editor-fallback proof toward the public Brunch JSON-RPC elicitation session parity proof.
- **Frontier item:** `pi-ui-extension-patterns`; this card is a slice inside the existing FE-744 Linear/branch boundary, not a new tracker item or branch.
- **Volatile handoff state:** `HANDOFF.md` remains an untracked transfer artifact. Its durable claims have been reconciled into `memory/SPEC.md` / `memory/PLAN.md`; do not treat the old completed card queue as active.
- **Main open risk:** discovery must be useful to an agent-as-user without becoming a generic RPC platform or drifting away from the handlers that actually validate and serve Brunch methods.

## Cross-cutting obligations for all cards

- Public clients speak Brunch JSON-RPC only. Raw Pi RPC may be used behind Brunch adapters, but method discovery must not expose Pi command objects, Pi `get_commands`, or slash-command internals as Brunch product methods.
- Preserve TypeBox as the runtime schema vocabulary for Brunch boundaries (`D41-L`); do not introduce Zod or hand-wavy schema prose for RPC discovery.
- Preserve the thin named-method-family posture (`D19-L`): concrete product methods and projection handlers, not a generic read gateway or generic records API.
- Preserve workspace/spec/session hierarchy and explicit activation semantics (`D11-L`, `D21-L`, `I22-L`). Discovery must describe activation; it must not silently activate or create sessions.
- Preserve linear transcript policy and transcript-backed elicitation (`I19-L`, `I23-L`, `I32-L`) even though this first card does not yet implement pending/respond.

---

## Card 1 — Public RPC method discovery registry

- **Status:** done
- **Weight:** full scope card — establishes the public method-discovery seam for FE-744 and becomes the contract source for later agent-as-user probes.

### Target Behavior

A Brunch JSON-RPC client can call `rpc.discover` with no params and receive a self-describing list of currently supported public Brunch methods with descriptions, parameter schemas, result schemas, and example calls.

### Boundary Crossings

```text
→ JSON-RPC request { method: "rpc.discover" }
→ createRpcHandlers dispatch
→ Brunch-owned RPC method registry / schema descriptions
→ TypeBox/JSON-Schema-shaped method metadata
→ JSON-RPC success response usable by CLI/web/fixture clients
```

### Risks and Assumptions

- RISK: Discovery schemas drift from handler validation schemas.
  → MITIGATION: centralize discoverable method metadata near the RPC handler layer; reuse exported TypeBox schemas where they already exist (for example `SpecSessionActivationDecisionSchema` / activation params) rather than duplicating shapes in comments.
- RISK: Discovery tries to describe future methods and misleads the agent-as-user probe.
  → MITIGATION: `rpc.discover` lists only methods implemented by the current host in this slice; pending future methods (`session.startElicitation`, `session.pendingExchange`, `elicitation.respond`) land with their own cards.
- RISK: Examples become a second informal contract that diverges from schemas.
  → MITIGATION: tests assert examples are valid JSON-RPC request shapes for their advertised methods and include no raw Pi RPC commands.
- ASSUMPTION: A compact hand-authored registry for the current method set is enough to bootstrap public discovery without refactoring the whole dispatcher into a framework.
  → IMPACT IF FALSE: later pending/respond work may need a deeper handler-table refactor before the parity driver can rely on discovery.
  → VALIDATE: this card lands a discoverable registry for all currently implemented public methods and tests it against existing handler behavior.
  → `memory/SPEC.md` §Assumptions: A23-L.

### Acceptance Criteria

✓ `rpc.discover` — returns entries for `rpc.discover`, `workspace.snapshot`, `workspace.selectionState`, `workspace.activate`, `session.elicitationExchanges`, and `session.transcriptDisplay`.

✓ `rpc.discover` params contract — rejects any non-empty `params` with JSON-RPC `-32602 Invalid params`.

✓ Method metadata shape — every discovered method has `method`, `description`, `paramsSchema`, `resultSchema`, and at least one JSON-RPC example call.

✓ Product boundary — discovery does not list raw Pi RPC commands such as `prompt`, `get_state`, `get_commands`, or slash command names.

✓ Schema usefulness — `workspace.activate` discovery exposes the activation decision union closely enough that a client can see `continue`, `openSession`, `newSession`, `newSpec`, and `cancel` variants without reading source.

✓ Drift guard — examples in discovery are valid JSON-RPC request objects for advertised methods, and tests fail if discovery omits an implemented public method or advertises an unsupported method.

### Verification Approach

- **Inner:** `npm run fix`; targeted `vitest` for `src/rpc.test.ts`; `npm run check`.
- **Middle:** JSON-RPC contract tests for discovery shape, invalid params, no raw Pi exposure, example validity, and registry/dispatcher method parity for the currently implemented public method set.
- **Outer:** none for this card; human review of the discovery response is sufficient until the agent-as-user parity driver consumes it.

### Cross-cutting obligations

- Keep discovery Brunch-owned and product-shaped (`D5-L`, `D48-L`); do not copy Pi's non-JSON-RPC command shape.
- Keep TypeBox/JSON-Schema as the schema vocabulary for RPC boundary metadata (`D41-L`).
- Keep discovery scoped to named Brunch method families (`D19-L`); do not introduce generic `records.*` or a read-model platform.
- Preserve activation/session semantics: describe `workspace.*` methods without opening sessions or invoking TUI picker code (`I22-L`).

### Promotion checklist

- [x] Does this change a requirement? Already reconciled in `memory/SPEC.md` as R27/R24/R28.
- [x] Does this create, retire, or invalidate an assumption? It advances but does not retire A23-L.
- [x] Does this slice depend on an unvalidated high-impact assumption? It attacks A23-L as the first tracer bullet rather than assuming the whole ten-turn proof works.
- [x] Does this make or reverse a non-trivial design decision? Already reconciled as D48-L; this card implements it.
- [x] Does this establish a new seam-level invariant? Already reconciled as I32-L; this card establishes the discovery part.
- [ ] Does this change a frontier-level cross-cutting obligation or verification architecture layer? No — obligations were reconciled in SPEC/PLAN before this card.
- [ ] Does it cross more than two major seams? No — JSON-RPC dispatch + registry/schema metadata.
- [x] Is this the first touch in an unfamiliar seam from a fresh thread? Yes; use full card.
- [ ] Can you not name the containing seam or current rationale from the live docs? No.

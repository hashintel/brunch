<!-- CARDS.md — temporary execution queue for one PLAN frontier item.
     Created by ln-scope. Delete or overwrite when exhausted/superseded.
     Frontier: mode-shell-and-fixture-driver / FE-735 / ln/fe-735-mode-shell-fixture-driver -->

# Scope Cards — mode-shell-and-fixture-driver

## Orientation

- **Containing seam:** Brunch transport-mode shell over the existing Pi-backed host/coordinator: CLI dispatch, print/RPC transport adapters, named product handlers, and transcript projections.
- **Frontier item:** `mode-shell-and-fixture-driver` (FE-735) on `ln/fe-735-mode-shell-fixture-driver`; this is structural M1 work stacked after `walking-skeleton`.
- **Volatile handoff state:** no `HANDOFF.md`; current uncommitted canonical updates already distinguish transport modes from agent modes/lenses and make M1 print a snapshot renderer.
- **Main open risk:** accidentally letting transport adapters own product semantics, recreate session boot, or introduce a generic read/chat model instead of reusing `WorkspaceSessionCoordinator`, named handlers, and Pi JSONL truth.
- **Frontier obligations:** preserve transport-mode vs agent-mode separation (D23-L); keep `workspace.*` / `session.*` named method families thin over projection handlers (D19-L); keep transcript truth in Pi JSONL with no canonical chat/turn store (D6-L, D12-L, D13-L); establish the replay-regression fixture path without overbuilding property/adversarial layers before graph/coherence substrates exist.

## Card 1 — Print snapshot transport shell

**Status:** done

### Weight

Full scope card — establishes the transport-mode dispatch seam and the first product-shaped projection path outside TUI.

### Target Behavior

`brunch --mode print` exits after rendering the coordinator-derived workspace snapshot.

### Boundary Crossings

```text
→ CLI argv
→ Brunch transport-mode dispatcher
→ shared host/workspace bootstrap seam
→ WorkspaceSessionCoordinator
→ product-shaped workspace/session snapshot projection
→ stdout renderer
```

### Risks and Assumptions

- RISK: Print mode reimplements spec/session boot instead of using the coordinator → MITIGATION: make tests inject a coordinator and assert print consumes coordinator states rather than touching stores directly.
- RISK: Snapshot shape becomes a throwaway string instead of reusable product state → MITIGATION: introduce a small typed snapshot/projection function used by the renderer and later RPC handler tests.
- ASSUMPTION: A snapshot can cover `ready`, `select_spec`, and `needs_human` states without running Pi interactive mode → VALIDATE: unit tests for all three states and one CLI smoke test.

### Acceptance Criteria

✓ `brunch --mode print` with a ready workspace prints cwd, current spec, session id/file, phase, and chat mode, then exits with code 0.
✓ `brunch --mode print` with no selected spec prints a `select_spec` snapshot without prompting or creating a session.
✓ `brunch --mode print` routes through injected/shared coordinator APIs in tests and does not launch `InteractiveMode`.

### Verification Approach

- Inner: unit tests + CLI smoke tests — prove dispatch and snapshot rendering over coordinator states.
- Middle: store-backed smoke in a temp cwd — prove printed ready state corresponds to `.brunch/state.json` and Pi JSONL session binding created by the coordinator.
- Outer: none for this slice.

### Cross-cutting obligations

- Keep print as a transport-mode proof-of-life; do not run an agent turn or introduce agent-mode defaults.
- Keep the snapshot projection product-shaped enough for RPC reuse without becoming a generic read model.
- Preserve `WorkspaceSessionCoordinator` as the boot/session-binding owner.

## Card 2 — Named RPC stdio skeleton

**Status:** done

### Weight

Full scope card — establishes the JSON-RPC transport adapter and first named product method family surface.

### Target Behavior

`brunch --mode rpc` serves named workspace/session methods over stdio.

### Boundary Crossings

```text
→ CLI argv
→ Brunch transport-mode dispatcher
→ shared host/workspace bootstrap seam
→ named handler registry (`workspace.*`, `session.*`)
→ JSON-RPC stdio adapter
→ client request/response
```

### Risks and Assumptions

- RISK: The RPC shape drifts into a generic data API → MITIGATION: expose only concrete named methods needed by M1 snapshots, e.g. `workspace.snapshot` and `session.snapshot` or one explicitly named equivalent pair.
- RISK: Stdio framing details consume the slice → MITIGATION: implement the smallest JSON-RPC 2.0 request/response loop needed for deterministic tests; subscriptions and streaming remain out of scope.
- ASSUMPTION: M1 can start with request/response methods before first-class subscriptions exist → VALIDATE: contract tests exercise initial state reads; subscription tests are deferred to later frontier acceptance.

### Acceptance Criteria

✓ A JSON-RPC stdio client can request the workspace/session snapshot and receive product-shaped state matching print mode's projection.
✓ Unknown methods and invalid params return structured JSON-RPC errors without crashing the process.
✓ RPC mode boots through the same host/coordinator path as print/TUI and does not create a generic `records.*` surface.

### Verification Approach

- Inner: handler unit tests — prove named method dispatch and error shapes.
- Middle: stdio contract test — spawn `brunch --mode rpc`, send JSON-RPC requests, assert ordered responses and snapshot parity with print projection.
- Outer: none for this slice.

### Cross-cutting obligations

- Preserve JSON-RPC as the primary machine protocol while keeping HTTP/read-model concerns absent.
- Keep handler semantics separate from stdio transport framing so later WebSocket/TUI in-process callers can reuse them.
- Do not bypass the coordinator for session/spec state.

## Card 3 — Elicitation exchange projection

**Status:** next

### Weight

Full scope card — establishes the transcript projection unit that fixture capture and observer extraction will rely on.

### Target Behavior

A Pi JSONL transcript projects into ordered elicitation exchanges with stable entry ranges.

### Boundary Crossings

```text
→ Pi JSONL session file
→ transcript entry loader/parser
→ elicitation exchange projector
→ `session.*` projection handler result
→ tests / fixture-prep caller
```

### Risks and Assumptions

- RISK: Projection overfits current Pi entry shapes or loses raw payload fidelity → MITIGATION: derive types from Pi exports where available and keep raw entry ids/ranges in the projection result.
- RISK: Prompt/response span rules are underspecified for tool/custom entries → MITIGATION: implement the M1 default from SPEC D13-L: prompt side is all system/assistant/tool-side entries since prior user response; response side is user text and/or structured response entries.
- ASSUMPTION: Current Pi JSONL entries expose enough stable identity/order to name ranges for replay fixtures → VALIDATE: synthetic JSONL tests plus at least one coordinator-created session file fixture; if false, route to `jsonl-session-viability` or `ln-spike`.

### Acceptance Criteria

✓ Synthetic transcripts with alternating assistant/user spans project into expected prompt-side and response-side entry ranges.
✓ Custom structured elicitation entries are included in the correct prompt or response side without creating chat/turn records.
✓ Empty or incomplete transcripts return an explicit no-open-exchange/empty projection shape rather than inventing ambient chat state.

### Verification Approach

- Inner: projection unit tests over synthetic Pi entry arrays — prove span/range behavior.
- Middle: JSONL file round-trip test — load a temp Pi session JSONL file and assert the same projection result from `session.*` handler shape.
- Outer: none for this slice; replay fixture capture consumes this projection in a later card.

### Cross-cutting obligations

- Keep Pi JSONL as transcript truth; do not introduce canonical chat or turn tables.
- Preserve elicitation-first semantics: user entries are responses to prompt-side spans, not ambient chat.
- Keep projection handlers as read views over canonical entries, not stores.

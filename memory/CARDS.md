<!-- CARDS.md — temporary execution queue for the active frontier.
     Created by ln-scope. Delete when exhausted or superseded.
     Frontier boundary remains memory/PLAN.md `web-shell` / FE-737 / ln/fe-737-web-shell. -->

# Scope Cards — `web-shell` follow-up batch

## Orientation

- Containing seams: Brunch transcript/session projection (`session.*`), Brunch runtime transport modes, and the first browser/web transport adapter.
- Frontier item: `web-shell` / M3 / FE-737 on branch `ln/fe-737-web-shell`; these cards are slices inside that frontier, not new Linear issue or branch units.
- Volatile state: the first D24-L/I19-L hardening batch is complete and verified; `memory/CARDS.md` was deleted by that builder and is being recreated for the next queue.
- Main open risk: the browser surface must consume the same thin `workspace.*` / `session.*` handler boundary without reintroducing branch adaptation, raw transcript file parameters, REST reads, or browser-only product semantics.

## Queue discipline

- Work cards in order unless implementation makes a later card invalid.
- After each card: run `npm run fix`; before each commit: run `npm run verify`.
- Keep all changes on FE-737 / `ln/fe-737-web-shell` unless `memory/PLAN.md` is revised by `ln-plan`.
- Update card `Status` as work is completed; delete this file when the queue is exhausted.

---

## Card 1 — Repair web-shell slice history wording

- **Status:** done
- **Weight:** light planning-hygiene card

### Objective

`memory/PLAN.md` distinguishes the completed linear-transcript-policy slice from the still-active `web-shell` frontier.

### Acceptance Criteria

✓ `web-shell` remains Active / in-progress and its `Current execution pointer` names the completed hardening slice plus the next browser-shell slice.
✓ `Recently Completed` no longer states that the whole `web-shell` frontier is done.
✓ The note about completed D24-L/I19-L hardening remains discoverable without implying M3 completion.

### Verification Approach

- Inner: docs diff review — verifies PLAN wording matches frontier state.
- Middle: no command required beyond the normal `npm run fix` / `npm run verify` cadence if this card is committed alone with code-adjacent work.

### Cross-cutting obligations

- Preserve PLAN's frontier-item semantics: `web-shell` remains the issue/branch unit; hardening slices are execution detail inside it.
- Do not add a new planning document or split FE-737 merely to represent completed scope-card work.

### Promotion checklist

- [x] Does not change a requirement.
- [x] Does not create, retire, or invalidate an assumption.
- [x] Does not make or reverse a non-trivial design decision.
- [x] Does not establish a new seam-level invariant.
- [x] Does not change frontier-level obligations or verification architecture.
- [x] Does not cross more than two major seams.
- [x] Containing seam and rationale are named in SPEC/PLAN.

---

## Card 2 — Strict Pi JSONL transcript reader

- **Status:** queued
- **Weight:** light hardening card

### Objective

File-backed Brunch transcript loading rejects malformed Pi JSONL instead of projecting headerless or structurally invalid entries.

### Acceptance Criteria

✓ Header requirement — `loadJsonlTranscriptEntries` rejects a file without exactly one Pi `session` header.
✓ Entry shape requirement — every non-header line must have a string `id`, a string-or-null `parentId`, and a string `type`; malformed lines are rejected before projection.
✓ Linear fixture continuity — coordinator-created sessions and M1 fixture JSONL still load and project as before.
✓ Pure projector preservation — synthetic unit tests may still exercise `projectElicitationExchanges` directly without requiring full file-backed Pi headers.

### Verification Approach

- Inner: transcript loader unit tests — validates strict file-backed shape checks and unchanged pure projection behavior.
- Middle: M1 fixture replay/projection parity — validates existing accepted fixtures remain valid Brunch-supported linear sessions.

### Cross-cutting obligations

- Preserve D24-L/I19-L fail-fast posture: malformed or non-linear session files must not be adapted into a best-effort projection.
- Preserve D13-L: elicitation exchanges remain derived from Brunch-supported linear Pi JSONL, not from a new chat/turn store.
- Keep the pure projection function as a functional core; put file/shape validation at the file-backed reader boundary.

### Promotion checklist

- [x] Does not change a requirement; it tightens enforcement of existing D24-L/I19-L.
- [x] Does not create, retire, or invalidate an assumption.
- [x] Does not make or reverse a non-trivial design decision.
- [x] Does not establish a new seam-level invariant.
- [x] Does not change frontier-level obligations or verification architecture.
- [x] Crosses only transcript reader and projection tests.
- [x] Containing seam and rationale are named in SPEC/PLAN.

---

## Card 3 — Product-facing linear exchange projection helper

- **Status:** queued
- **Weight:** light hardening card

### Objective

Callers that need elicitation exchanges use one product-facing helper that loads, validates, and projects the selected linear transcript.

### Acceptance Criteria

✓ `session.elicitationExchanges` calls the product-facing helper rather than separately composing load + project.
✓ Fixture capture and M1 replay tests use the same helper where they are asserting product-reader behavior.
✓ Direct `projectElicitationExchanges` imports are limited to pure projection unit tests or private implementation code.
✓ The helper preserves the same non-linear error discriminant used by RPC.

### Verification Approach

- Inner: focused unit/contract tests plus grep-style architectural assertion if useful — validates callers share the safe reader boundary.
- Middle: RPC handler tests and fixture capture/replay tests — validate product behavior remains unchanged for accepted linear sessions.

### Cross-cutting obligations

- Preserve D19-L: named product handlers project from canonical stores; helpers may exist but must stay subordinate to concrete `session.*` behavior.
- Preserve D24-L/I19-L: no caller should need to know how to branch-select, flatten, migrate, or adapt Pi JSONL.
- Do not create a generic read gateway or a parallel view store while deepening the transcript helper.

### Promotion checklist

- [x] Does not change a requirement.
- [x] Does not create, retire, or invalidate an assumption.
- [x] Does not make or reverse a non-trivial design decision.
- [x] Does not establish a new seam-level invariant; it reduces bypass risk for I19-L.
- [x] Does not change frontier-level obligations or verification architecture.
- [x] Crosses transcript helper, RPC, and fixture tests only.
- [x] Containing seam and rationale are named in SPEC/PLAN.

---

## Card 4 — Web mode HTTP shell

- **Status:** queued
- **Weight:** full structural card

### Target Behavior

`brunch --mode web` starts a local Brunch web host that serves a minimal browser shell.

### Boundary Crossings

```text
→ CLI `--mode web`
→ Brunch host/coordinator setup
→ HTTP transport shim
→ static browser shell response
```

### Risks and Assumptions

- RISK: The first HTTP shim could drift into a REST read API → MITIGATION: only serve static shell assets and infrastructure endpoints needed to boot the browser; no product JSON reads over HTTP.
- RISK: Long-running server tests can hang CI → MITIGATION: expose a start/stop-capable host helper and test it with ephemeral ports.
- ASSUMPTION: A minimal Node HTTP server is enough for the first shell before bundler integration → VALIDATE: an integration test fetches the shell and proves the process can stop cleanly.

### Acceptance Criteria

✓ CLI dispatch — `runBrunchCli({ argv: ["--mode=web"] })` can launch through an injectable web-host runner without falling through to TUI/RPC/print.
✓ Static shell — the web host serves an HTML shell that identifies Brunch and does not import or embed `pi-web-ui`.
✓ No REST reads — the first web host exposes no `workspace.*` / `session.*` product data over HTTP GET endpoints.
✓ Lifecycle oracle — tests can start the host on an ephemeral port and stop it without leaving an open handle.

### Verification Approach

- Inner: CLI dispatch + web host unit/integration tests — proves `web` is a transport mode on the same Brunch CLI.
- Middle: HTTP-shim contract test — proves static serving exists without adding REST product reads.
- Outer: defer until the browser app renders product state.

### Cross-cutting obligations

- Preserve D10-L: the browser surface is native Brunch web UI, not `pi-web-ui` reuse.
- Preserve D19-L: HTTP is a thin transport shim; product state comes later through JSON-RPC/WebSocket, not REST.
- Preserve D23-L: web is a transport mode, not an agent mode or lens selector.

---

## Card 5 — WebSocket JSON-RPC bridge

- **Status:** queued
- **Weight:** full structural card

### Target Behavior

The web host accepts one WebSocket JSON-RPC connection that reuses the existing Brunch RPC handlers.

### Boundary Crossings

```text
→ Browser/WebSocket client
→ WebSocket transport adapter
→ existing `createRpcHandlers` boundary
→ `workspace.*` / `session.*` projection handlers
```

### Risks and Assumptions

- RISK: The WebSocket adapter could fork JSON-RPC semantics from stdio RPC → MITIGATION: share request/response handling helpers or use the same handler result shape in contract tests.
- RISK: WebSocket library choice may add dependency/build friction → MITIGATION: choose the smallest server dependency needed for Node tests and keep protocol framing narrow.
- ASSUMPTION: Request/response JSON messages are sufficient before subscriptions land → VALIDATE: browser-like WebSocket client can request `workspace.snapshot` and `session.elicitationExchanges`.

### Acceptance Criteria

✓ Shared handlers — WebSocket requests for `workspace.snapshot` and `session.elicitationExchanges` return the same JSON-RPC result/error shapes as stdio mode.
✓ Non-linear guard propagation — a non-linear selected session returns the same product-shaped failure over WebSocket as over stdio RPC.
✓ No REST fallback — web tests do not fetch product state through HTTP JSON endpoints.
✓ Connection lifecycle — the server closes WebSocket connections cleanly during test teardown.

### Verification Approach

- Inner: WebSocket adapter contract tests — proves handler reuse and error-shape parity.
- Middle: cross-transport parity test — compares stdio RPC and WebSocket RPC for the same coordinator/session fixture.
- Outer: defer until browser UI smoke.

### Cross-cutting obligations

- Preserve D5-L: JSON-RPC is the primary browser/RPC protocol.
- Preserve D19-L: WebSocket is a transport adapter over named handlers, not a new product API.
- Preserve D24-L/I19-L: branch/non-linear transcript failures must propagate unchanged to browser transport.

---

## Card 6 — Native React workspace snapshot shell

- **Status:** queued
- **Weight:** full structural card

### Target Behavior

The native Brunch React app renders workspace chrome from `workspace.snapshot` over the WebSocket JSON-RPC client.

### Boundary Crossings

```text
→ served browser app bundle
→ WebSocket JSON-RPC client
→ `workspace.snapshot` handler
→ React route/component rendering
```

### Risks and Assumptions

- RISK: Frontend tooling can sprawl beyond the slice → MITIGATION: add only the minimal Vite/React/TanStack Router/TanStack Query setup needed to render one route.
- RISK: Client state could become a browser-owned product runtime → MITIGATION: browser state is query cache over RPC results only; no local product model or REST reads.
- ASSUMPTION: TanStack Router + Query are the right first client primitives per D10-L → VALIDATE: one route renders workspace snapshot through Query using the WebSocket RPC client.

### Acceptance Criteria

✓ Build scaffold — web app build/check is wired into the normal verification path or has an explicit tested script invoked by `npm run verify`.
✓ Router/Query presence — the first route is owned by TanStack Router and fetches via TanStack Query.
✓ Snapshot rendering — the page renders cwd/spec/session/chrome state from `workspace.snapshot` over the WebSocket RPC client.
✓ Thin-client discipline — no REST product fetches, no `pi-web-ui` dependency/import, and no browser-only session semantics.

### Verification Approach

- Inner: frontend build/type check + component/client unit tests where practical — proves the app compiles and the RPC client contract is typed.
- Middle: browser-shell integration test or DOM-level render test with a fake WebSocket RPC server — proves snapshot state reaches UI through the intended transport.
- Outer: manual browser smoke after this card or the next transcript-rendering card.

### Cross-cutting obligations

- Preserve D10-L: native Brunch React app over one WebSocket RPC client.
- Preserve D19-L: TanStack Query caches projections; it is not a canonical store or read-model platform.
- Preserve D32-L future affordance posture: if establishment-offer placeholders appear, they must read as ambient orientation, not a default exhaustive strategy menu.

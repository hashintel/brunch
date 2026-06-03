# Web sidecar hardening before continued graph observer work

Frontier: live-graph-observer | n/a
Status:   active
Mode:     chain
Created:  2026-06-03

## Orientation

- Containing seam: TUI launch (`src/brunch-tui.ts`), web sidecar host (`src/rpc/web-host.ts`), public RPC transport (`src/rpc/*`), and web route/query attachment state (`src/web/*`). This file is a pre-continuation hardening pass before Graph spine Card 5 or Web Card 2.
- Frontier item: `live-graph-observer` (FE-795). These cards do not create a new Linear issue or branch; they tighten the same TUI-writer + web-read-attachment black triangle.
- Volatile user decisions: use **web sidecar** / **TUI-started web attachment host**, not “observer”; `brunch-cli` should default to TUI; TUI should start the web sidecar by default and auto-open a browser, with auto-open disable-able by a flag such as `--auto-open=false`; web viewed spec is client-local and must not rebind the TUI active spec/session.
- Main open risk: these are cross-seam corrections, so keep them to product-path hardening and naming. Do not widen into a full web mutation policy framework or a generic RPC module split.
- Cross-cutting obligations: D10-L native web over Brunch RPC; D19-L thin named methods and process-local `brunch.updated`; D33-L browser is an attachment, not a durable session; D52-L dependency direction; one-writer/many-read-attachments remains the F1 model.

## Card 1 — done — Web sidecar launch opens the active spec graph route

### Target Behavior

`brunch-cli` launches the TUI by default, starts the TUI-owned web sidecar after activation, and opens/advertises the active spec graph route.

### Boundary Crossings

```pseudo
→ brunch-cli argv parse
→ TUI workspace/spec/session activation
→ web sidecar host start with shared update publisher
→ browser-open adapter / stdout URL advertisement
→ browser route `/spec/$specId`
→ static web host SPA fallback
```

### Risks and Assumptions

- RISK: Browser auto-open creates platform-specific or test-hostile behavior.
  → MITIGATION: inject the browser opener in tests and make `--auto-open=false` skip only the open action while still starting/advertising the sidecar.
- RISK: Serving `/spec/$specId` directly from the static host can accidentally expose file traversal paths.
  → MITIGATION: keep asset serving constrained to `/assets/*`; for other app routes, serve only `index.html` as SPA fallback.
- RISK: Sidecar launch polish sprawls into general CLI config.
  → MITIGATION: add only the current flag needed by the decision: default auto-open and `--auto-open=false` opt-out.
- ASSUMPTION: Opening the active spec route is the right proof path for F1.
  → IMPACT IF FALSE: browser smoke remains manually recoverable by typing the route, but the default product path would not prove live graph visibility.
  → VALIDATE: launch-path tests assert the exact URL includes `/spec/<activeSpecId>` and the host serves that route.

### Tracer-bullet check

- Proof of life: plain `brunch-cli` means TUI writer plus immediately visible web graph view for the selected spec.
- Invariants: web sidecar remains an attachment to the TUI process and shares its process-local update bus.

### Acceptance Criteria

✓ Default mode — `runBrunchCli({ argv: [] })` routes to TUI, not print/web/rpc.
✓ Sidecar start — TUI activation starts the sidecar before/alongside `InteractiveMode.run()` with the shared update publisher.
✓ Route URL — the advertised/opened URL is `/spec/<activeSpecId>` for the activated spec.
✓ Auto-open opt-out — `--auto-open=false` keeps the sidecar and printed URL but does not invoke the browser opener.
✓ SPA fallback — `startWebHost` serves `index.html` for `/spec/<id>` while preserving `/assets/*` traversal guards and 404s for missing assets.
✓ Naming — user-facing output says `Brunch web sidecar` or `Brunch web attachment`, not `observer`.

### Verification Approach

- Inner: `src/brunch.test.ts`, `src/brunch-tui.test.ts`, `src/rpc/web-host.test.ts` — argv dispatch, launch sequencing, opener injection, SPA route serving, traversal guard.
- Middle: manual smoke in `.fixtures/workbenches/live-graph-observer/` — run `brunch-cli`, confirm TUI starts and browser lands on the selected spec graph route.

### Cross-cutting obligations

- D33-L: browser route selection must not mutate the TUI active spec/session.
- One-writer/many-read-attachments: no browser graph mutation controls or write authority added here.
- Keep the sidecar process-local; no cross-process daemon/event bus.

### Expected touched paths (tentative)

```pseudo
src/
├── brunch.ts                         ~
├── brunch.test.ts                    ~
├── brunch-tui.ts                     ~
├── brunch-tui.test.ts                ~
└── rpc/
    ├── web-host.ts                   ~
    └── web-host.test.ts              ~
memory/cards/
└── live-graph-observer--graph-rpc-spine.md ?
```

## Card 2 — done — Client-local spec viewing does not borrow the TUI session transcript

### Target Behavior

The web spec route treats `specId` from the route as client-local view state and only renders session projections when the selected session belongs to that viewed spec.

### Boundary Crossings

```pseudo
→ browser route `/spec/$specId`
→ TanStack Router params
→ workspace.snapshot query
→ session projection target derivation
→ session transcript query enablement
→ React render state
```

### Risks and Assumptions

- RISK: Hiding the transcript on cross-spec views may look like data loss.
  → MITIGATION: render an explicit message: the TUI is active in a different spec/session, and this web view is only showing graph reads for the route spec.
- RISK: Fixing this by calling `workspace.activate` from web would violate the client-local view decision.
  → MITIGATION: no route navigation may call `workspace.activate`; route params only affect read method params.
- ASSUMPTION: A later web session picker can choose a session for the viewed spec if needed.
  → IMPACT IF FALSE: current route still has correct graph observation; transcript ergonomics remain thin until a scoped web session-selection slice.
  → VALIDATE: route tests with active Spec A snapshot and `/spec/B` assert graph read for B and no session projection for A.

### Tracer-bullet check

- Invariants: proves web attachments read explicit resources without rebinding or conflating durable TUI session identity.

### Acceptance Criteria

✓ Same-spec transcript — `/spec/A` with workspace snapshot active on Spec A queries `session.transcriptDisplay({specId:A,sessionId})`.
✓ Cross-spec graph — `/spec/B` with workspace snapshot active on Spec A still queries `graph.overview({specId:B})`.
✓ Cross-spec transcript guard — `/spec/B` with workspace snapshot active on Spec A does not query `session.transcriptDisplay` for Spec A.
✓ User-facing state — cross-spec view explains that no session is attached for the viewed spec in this web route.
✓ No activation — route navigation and graph reads do not call `workspace.activate`.

### Verification Approach

- Inner: `src/web/app.test.tsx` route tests with fake RPC calls and notifications.
- Middle: browser smoke after Card 1 — manually navigate from `/spec/A` to `/spec/B`; graph route changes without TUI switching sessions.

### Cross-cutting obligations

- D33-L: transport attachments are not sessions; route spec is client-local view state.
- D19-L: graph/session reads remain named RPC methods with explicit targets.

### Expected touched paths (tentative)

```pseudo
src/web/
├── routes/
│   ├── root.tsx                      ~
│   └── spec.tsx                      ~
├── app.test.tsx                      ~
└── subscriptions/brunch-updates.ts   ?
```

## Card 3 — next — Real CLI RPC uses the product update publisher

### Objective

`brunch-cli --mode rpc` wires one shared `ProductUpdatePublisher` into both JSON-RPC handlers and the stdio line server.

### Acceptance Criteria

✓ RPC mode publisher — `runBrunchCli({ argv:['--mode=rpc'] })` creates and shares one publisher between `createRpcHandlers` and `runJsonRpcLineServer`.
✓ Product-path notification — a real CLI RPC mutation such as `session.startElicitation` writes both the response and a `brunch.updated` notification on stdout.
✓ Existing stdio framing — LF-framed parsing still handles U+2028/U+2029 inside JSON strings and request/response correlation remains intact.
✓ No new event store — publisher remains process-local and non-durable.

### Verification Approach

- Inner: `src/brunch.test.ts` product-path stdio notification regression; existing `src/rpc/handlers.test.ts` line-framing tests stay green.

### Cross-cutting obligations

- D19-L: notifications are invalidation hints, not canonical truth.
- Preserve Brunch JSON-RPC-shaped envelopes; do not expose raw Pi RPC events.

### Assumption dependency

None — this is a wiring gap inside the already-built Card 3 seam.

### Expected touched paths (tentative)

```pseudo
src/
├── brunch.ts                         ~
└── brunch.test.ts                    ~
```

### Promotion checklist

- [ ] Does this change a requirement?
- [ ] Does this create, retire, or invalidate an assumption?
- [ ] Does this slice depend on an unvalidated high-impact assumption?
- [ ] Does this make or reverse a non-trivial design decision?
- [ ] Does this establish a new seam-level invariant?
- [ ] Does this change a frontier-level cross-cutting obligation or verification architecture layer?
- [ ] Does it cross more than two major seams?
- [ ] Is this the first touch in an unfamiliar seam from a fresh thread?
- [ ] Can you not name the containing seam or current rationale from the live docs?

## Card 4 — next — Rename observer terminology to web sidecar / attachment host

### Objective

Recent code, tests, docs, and active cards use the web-sidecar terminology consistently and reserve “observer” for agent-role vocabulary.

### Acceptance Criteria

✓ Code symbols — public/internal symbols introduced for Card 4 use `WebSidecar` or `WebAttachmentHost`, not `ObserverWebHost`.
✓ User-facing strings — CLI/stdout and README text avoid `observer` for the sidecar.
✓ Scope/docs — active scope files no longer teach “observer endpoint/host” for this launch path except where referring to the frontier name itself.
✓ No compatibility aliases — because this is pre-release, obsolete observer-named exports introduced by the prior commit are renamed, not duplicated.

### Verification Approach

- Inner: focused tests compile after symbol rename; text scan for `observer` in touched sidecar paths with allowed exceptions for frontier names or historical phrases.

### Cross-cutting obligations

- Lexicon hygiene: `observer` remains available for future agent-role semantics and should not name the web attachment host.

### Assumption dependency

None — this implements a user-confirmed naming decision.

### Expected touched paths (tentative)

```pseudo
src/
├── brunch-tui.ts                     ~
├── brunch-tui.test.ts                ~
├── rpc/
│   ├── web-host.test.ts              ~
│   └── README.md                     ?
└── web/
    └── README.md                     ?
memory/cards/
├── live-graph-observer--graph-rpc-spine.md       ~
└── live-graph-observer--web-sidecar-hardening.md ~
```

### Promotion checklist

- [ ] Does this change a requirement?
- [ ] Does this create, retire, or invalidate an assumption?
- [ ] Does this slice depend on an unvalidated high-impact assumption?
- [ ] Does this make or reverse a non-trivial design decision?
- [ ] Does this establish a new seam-level invariant?
- [ ] Does this change a frontier-level cross-cutting obligation or verification architecture layer?
- [ ] Does it cross more than two major seams?
- [ ] Is this the first touch in an unfamiliar seam from a fresh thread?
- [ ] Can you not name the containing seam or current rationale from the live docs?

## Card 5 — next — Discovery schemas match public wire shapes

### Objective

`rpc.discover` schemas describe the JSON-RPC shapes that handlers actually accept and return.

### Acceptance Criteria

✓ Numeric spec ids — discovery result schemas and examples use numeric `specId` / `spec.id` where runtime methods use numbers.
✓ Session projection params — `session.*` projection params schema matches actual accepted params: `{sessionId: string, specId?: number}`.
✓ Schema/example contract — discovery examples remain valid JSON-RPC requests for their advertised methods.
✓ No method expansion — this card only corrects described shapes; it does not add new RPC methods.

### Verification Approach

- Inner: `src/rpc/handlers.test.ts` discovery schema assertions and example contract assertions.

### Cross-cutting obligations

- D48-L: Brunch owns public RPC discovery; discovery must be usable by product clients, not merely decorative.

### Assumption dependency

None — this is contract hardening inside the existing RPC discovery seam.

### Expected touched paths (tentative)

```pseudo
src/rpc/
├── handlers.ts                       ~
└── handlers.test.ts                  ~
```

### Promotion checklist

- [ ] Does this change a requirement?
- [ ] Does this create, retire, or invalidate an assumption?
- [ ] Does this slice depend on an unvalidated high-impact assumption?
- [ ] Does this make or reverse a non-trivial design decision?
- [ ] Does this establish a new seam-level invariant?
- [ ] Does this change a frontier-level cross-cutting obligation or verification architecture layer?
- [ ] Does it cross more than two major seams?
- [ ] Is this the first touch in an unfamiliar seam from a fresh thread?
- [ ] Can you not name the containing seam or current rationale from the live docs?

## Deferred review finding — RPC handler deepening

`src/rpc/handlers.ts` is becoming a pressure point, but do not split it in this hardening chain unless one of the cards above makes the local edit unsafe. Card 5 in `live-graph-observer--graph-rpc-spine.md` will add `session.runtimeState`; that is the better moment to decide whether to split private `rpc/session-methods`, `rpc/graph-methods`, or protocol modules behind the public `handlers.ts` entry point.

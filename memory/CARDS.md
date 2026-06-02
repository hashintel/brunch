<!-- CARDS.md — prepared scope-card queue for one live frontier item.
     Created by ln-scope · consumed by ln-build · retired when queue exhausted.
     Frontier: petri-sync-server (FE-764).
     Parent branch: ka/fe-784-petrinaut-colour-fold. -->

# Scope cards — FE-764 petri-sync-server

Slices 1 + 2 done — the static export + live event stream now fold through
one caller-supplied `NetFolding`, the cook CLI selects fold mode via
`--petrinaut-fold=color|identity` (default `identity`), and an engine-driven
frame-replay oracle round-trips a real cook run through
`reduceBrunchExecutionExport`. All work lives on
`ka/fe-764-petri-sync-server` (stacked on `ka/fe-784`).

Slice 3 (ephemeral live stream) shipped as two commits:

- **3a done:** `petrinaut-stream-bus.ts` — pure pub/sub + replay buffer +
  incremental `PetrinautEvent` → `BrunchExecutionExportFrame` translator.
  `OrchestratorInput.onPetrinautEvent` engine fan-out hook.
- **3b done:** `petrinaut-stream-server.ts` — thin HTTP/SSE shell over the
  3a bus. `createPetrinautStreamServer({ bus, host?, port? })` returns
  `{ start, stop, connectionCount }`. Localhost-only bind, ephemeral port,
  one route `GET /stream` returning `text/event-stream`; one bus
  subscription per connection, response closes after `terminal` frame.

Slice 4 (`--petrinaut-stream` + URL composition + multi-tier base-URL +
auto-open) is next — wires the 3b server into `runCook` behind the flag
and composes the Petrinaut launcher URL. Slice 5 (web-UI button +
endpoint discovery) stays sketched below; promote to a full card once a
real Petrinaut client has consumed the stream end-to-end.

---

## Slice 5 (sketch — promote to full card after slice 4 ships)

### Slice 5 — brunch web-UI button + endpoint discovery

A persistent UI affordance that opens the live run in Petrinaut. Needs a discovery mechanism: the cook process advertises `{ sessionId, url, port }` somewhere the brunch SPA can read (proposed: `<runDir>/petrinaut-stream.json` written by slice 3 + watched by the SPA; alternative: a brunch-server endpoint `/runs/{runId}/petrinaut` that proxies to the live cook). Decision pending — open coordination item in PLAN.md.

---

## Slice 1: export reducer — `BrunchExecutionExport` from run artifacts

**Status:** done — commit `a41db69f`. `reduceBrunchExecutionExport` + locked contract types live in `src/orchestrator/src/petrinaut-stream-export.ts` with 11 passing tests (schema, markings, frame-replay oracle, type pins). `createIdentityFolding(blueprint)` landed in `petrinaut-fold.ts` as sibling to `createNetFolding` per the slice queue's note — slice 2 only needs to add CLI surface + SPEC lexicon entry.

**Deferred to slice 2:** engine-driven version of the frame-replay oracle. `serializeBlueprint` currently hard-codes `createNetFolding`; slice 2 widens it to accept a folding opt so an identity-fold end-to-end run becomes round-trippable through the same path.

### Target Behavior

A pure function `reduceBrunchExecutionExport({ sdcpnFile, events })` returns a `BrunchExecutionExport` matching the schema locked in PLAN.md §petri-sync-server: `definition` is a tight `NetDefinition` projection of the input SDCPN file (keeps `version`, `meta`, `title`, `places`, `transitions`, `types`; drops `scenarios`, `differentialEquations`, `parameters`, `metrics`); `initialState` is the marking from the `initial_marking` event reduced into the `Marking` shape (count arm under identity folding; coloured arm passthrough when present); `transitionFirings` are the per-place deltas from every `transition_fired` event in arrival order, with `ts: string` preserved verbatim.

### Boundary Crossings

```
→ src/orchestrator/src/petrinaut-stream-export.ts (new — public reducer)
→ consumes:
    src/orchestrator/src/petrinaut-sdcpn.ts (SdcpnFile type)
    src/orchestrator/src/petrinaut-events.ts (PetrinautEvent union: initial_marking | transition_fired | terminal)
→ exits at:
    src/orchestrator/src/petrinaut-stream-export.test.ts (new — unit + replay oracle)
```

No cook-process / filesystem / SSE wiring in this slice. The function is consumed in-memory in tests; later slices wire it into the cook event stream and the SSE response body.

### Risks and Assumptions

```
- ASSUMPTION: Marking ≡ Petrinaut's runtime InitialMarking — the no-colour arm is exactly Record<PlaceId, number>.
  → VALIDATE: TS type alias compiles against @hashintel/petrinaut-core's exported InitialMarking shape (mirror the type locally; cross-check via the reducer producing values that pass through Petrinaut's loader). For this slice the validation is the type declaration + the frame-replay oracle proving counts behave like additive multisets.
  → memory/PLAN.md §petri-sync-server (Marking ≡ InitialMarking; count arm for the identity fold)

- ASSUMPTION: petrinaut-events.jsonl preserves arrival order (single producer; append-only) — so reducing events as a sequence reconstructs firing order faithfully.
  → VALIDATE: replay oracle reconstructs every frame from initialState + ordered deltas; a single negative-marking violation falsifies the assumption.

- RISK: PetrinautEvent shape on fe-784 may differ from /tmp/reduce-export.mjs's expectations (the mjs prototype was written against the unfolded fe-763 shape; fe-784's adapter folds concrete→folded, so firing input/output reference folded place ids when color-fold is active).
  → MITIGATION: this slice runs against IDENTITY-folded artifacts only (test fixtures use createIdentityFolding so place ids are concrete and the reducer logic from /tmp matches 1:1). The color-fold variant is exercised in slice 2's tests.

- RISK: `definition = Omit<SdcpnFile, 'scenarios'>` keeps inert top-level fields (metrics, parameters, differentialEquations) that Petrinaut's loader may flag.
  → MITIGATION: keep them — they're explicit placeholders in petrinaut-sdcpn.ts; removing them is a separate decision.
```

### Acceptance Criteria

```
✓ All public types (`PlaceId`, `TokenColour`, `Marking`, `SdcpnInputArc`, `SdcpnOutputArc`, `SdcpnPlace`, `SdcpnTransition`, `NetDefinition`, `TransitionFiring`, `BrunchExecutionExport`) exported from petrinaut-stream-export.ts and match the schema locked in PLAN.md §petri-sync-server byte-for-byte.

✓ `Marking = Record<PlaceId, number | TokenColour[]>` — sum type preserved (count + colour arms); identity-fold runs only populate the count arm, but the type permits the colour arm for future colour-fold consumers feeding the same reducer.

✓ `TransitionFiring.ts: string` (preserved verbatim from `PetrinautTransitionFiredEvent.ts` — confirmed in petrinaut-events.ts:60).

✓ `reduceBrunchExecutionExport(input)` is a pure function — no filesystem, no process exits, no globals.

✓ `definition` projection is the tight 6-field NetDefinition: keeps `version`, `meta`, `title`, `places`, `transitions`, `types`; explicitly drops `scenarios`, `differentialEquations`, `parameters`, `metrics`. Not `Omit<SdcpnFile, 'scenarios'>` — an explicit constructor that names every kept field.

✓ Reducer count-reduces every per-place token array to a number under the count arm of `Marking` (identity-fold case); per-place keys with zero tokens are not synthesized (empty places stay absent).

✓ test: round-trip on a synthetic 2-slice plan under IDENTITY folding — compile blueprint, drive firings through the live engine seam with `createIdentityFolding`, capture events, reduce, then frame-replay: reconstruct every marking from initialState + transitionFirings deltas, assert no negative marking and final marking equals the live PetriNet's terminal marking. (Note: createIdentityFolding doesn't exist yet at slice 1's start — see slice 2. Prefer landing the constructor as a single-file helper here so slice 2 only adds CLI surface; alternative is an inline NetFolding identity mock in the test.)

✓ test: referential integrity — every place id in initialState and every firing's input/output is present in `definition.places`; every `transitionId` is present in `definition.transitions`.

✓ test: definition projection — given an SdcpnFile populated with non-empty `scenarios`, `differentialEquations`, `parameters`, `metrics`, the returned `NetDefinition` contains none of those keys and is structurally equal to the input on the 6 kept fields.

✓ test: ts roundtrip — `TransitionFiring.ts` strings match the source events 1:1 (no Date coercion, no number conversion).

✓ `npm run check` clean (0 errors); `npm run test` includes the new test file and it passes.
```

### Verification Approach

```
- Inner: synthetic-fixture unit tests + frame-replay oracle (already validated on real run 904d205d via /tmp/reduce-export.mjs — port the oracle into the test file, drive it off a deterministic in-test plan instead of disk).
- Middle: (deferred) wire the reducer into the cook event stream in a follow-up slice, then snapshot a real-run export and validate against Petrinaut's loader.
- Outer: (deferred) end-to-end Petrinaut import — cross-team validation against a real run; happens after the SSE transport slice lands.
```

---

## Slice 2: identity fold wiring + `--petrinaut-fold` cook CLI flag

**Status:** done. `--petrinaut-fold=color|identity` (default `identity`) parsed in `cook-cli.ts` → `OrchestratorInput.petrinautFold` → `engine.ts` constructs one folding (identity or color) and shares it between `serializeBlueprint` (now requires `folding: NetFolding` opt) and `createPetrinautEventStream`. SPEC §Lexicon gained `identity fold`. Engine-driven frame-replay oracle landed in `engine-contract.test.ts` covering both modes. `npm run verify` green (1525 tests).

### Target Behavior

`brunch cook` accepts `--petrinaut-fold=color|identity` (default `identity`); when `identity`, the run uses a new `createIdentityFolding(blueprint)` constructor that returns a `NetFolding` mapping every concrete id to itself with no token-colour decoration; when `color`, the run uses the existing `createNetFolding(blueprint)`.

### Boundary Crossings

```
→ src/server/cli.ts (or wherever brunch cook parses argv — confirm at build time)
→ src/orchestrator/src/petrinaut-fold.ts (new public constructor: createIdentityFolding)
→ cook entry that today calls createNetFolding (one site — confirm at build time)
→ consumers (serializeBlueprint, createPetrinautEventStream) UNCHANGED — they still receive a NetFolding and never branch on which constructor produced it.
```

### Risks and Assumptions

```
- ASSUMPTION: NetFolding's interface as established in petrinaut-fold.ts is expressive enough to encode the identity case without escape hatches (id→id maps, pass-through token decoration, places/transitions = blueprint.places / blueprint.transitions verbatim).
  → VALIDATE: createIdentityFolding implementation fits in <20 lines with no internal branches in serializeBlueprint or createPetrinautEventStream — if either consumer needs a new conditional to handle identity output, the interface is wrong and the slice promotes to refactor the interface first.

- RISK: Flipping the default to identity is a posture change that affects fixtures and tests that currently snapshot folded output (petrinaut-export.test.ts, petrinaut-events.test.ts, petrinaut-fold.test.ts, petrinaut-sdcpn.test.ts).
  → MITIGATION: cook CLI default flips; tests that exercise the color-fold path explicitly construct createNetFolding (don't rely on a default). Existing fold-targeted tests should already be explicit; verify and fix any that implicitly relied on the default. Snapshot updates limited to the cook entry's default behaviour.

- RISK: Flag name and the SPEC §Lexicon entries (`color fold`, `folded net`) need a matching `identity fold` term to stay tight per AGENTS.md.
  → MITIGATION: extend SPEC §Lexicon with `identity fold` in this slice; reference it in the cook CLI help text and in PLAN.md.
```

### Acceptance Criteria

```
✓ `createIdentityFolding(blueprint)` exported from petrinaut-fold.ts; returns the same NetFolding type as createNetFolding; no token-colour decoration; place/transition id maps are identity.

✓ `serializeBlueprint(blueprint, opts)` and `createPetrinautEventStream(opts)` are byte-identical to before this slice — no new branches, no new conditionals, no new opts fields.

✓ test: applying createIdentityFolding to a 2-slice blueprint produces a net.json whose places and transitions match the unfolded blueprint shape (42 places, 37 transitions on the standard 2-slice plan — confirm exact counts at build time).

✓ test: applying createIdentityFolding to a 2-slice blueprint produces an event stream whose transition_fired events reference concrete place ids (no `slice:` prefix stripped).

✓ `brunch cook` parses `--petrinaut-fold=color|identity`; default is `identity`; unknown values exit non-zero with a clear error.

✓ test: the cook entry's default code path constructs createIdentityFolding (assert via the cook entry's injection seam, not by invoking the binary).

✓ SPEC §Lexicon gains `identity fold`; CLI `--help` describes both modes.

✓ `npm run verify` green (fmt, lint, test, build).
```

### Verification Approach

```
- Inner: unit tests on createIdentityFolding (id maps + place/transition lists); snapshot/structural tests on serializeBlueprint + event stream under each fold.
- Middle: cook entry test that confirms the default constructor is identity and the flag flips to color.
- Outer: (deferred) cross-team check that Petrinaut's loader accepts both modes' net.json against H-6519 readiness.
```

### Notes

- Slice 2 IS sequentially obvious from slice 1 — its scope wouldn't change based on what slice 1 finds. Keeping both pre-scoped per the prepared-queue rule.
- Once both land, `/tmp/reduce-export.mjs` and `HANDOFF.md` can be deleted (HANDOFF retirement rule fires: branch decision recorded, FE-764 work committed, next-slice scope card exists).

---

## Slice 3a: event-bus + replay buffer + incremental frame translator

**Status:** done. `petrinaut-stream-bus.ts` + `petrinaut-stream-bus.test.ts`
(12 unit tests). `eventToTransitionFiring`, `reduceMarking`,
`projectNetDefinition` extracted from `petrinaut-stream-export.ts` and
shared by the static reducer + the bus. `OrchestratorInput.onPetrinautEvent`
fan-out hook plumbed through `engine.ts` (no engine-level branching — just
threads the callback into `createPetrinautEventStream`'s existing `onEvent`).
Engine-driven replay-equivalence oracle in `engine-contract.test.ts` runs a
real cook with the bus subscribed pre-publish and a late subscriber. `npm
run verify` green (1538 tests).

### Target Behavior

A new pure module `petrinaut-stream-bus.ts` exposes
`createPetrinautStreamBus({ runId, sdcpnFile })` returning
`{ publish(event: PetrinautEvent), subscribe(handler): unsubscribe }` where
every subscriber — including a late subscriber that attaches after firings
have already published — observes the full ordered sequence of
`BrunchExecutionExportFrame` values: exactly one `definition` frame, then
exactly one `initial_state` frame, then zero or more `transition_firing`
frames in publish order, then at most one `terminal` frame after which the
subscriber receives no further frames.

### Boundary Crossings

```
→ src/orchestrator/src/petrinaut-stream-bus.ts (new — pure pub/sub + replay buffer + frame translator)
→ src/orchestrator/src/petrinaut-stream-export.ts (existing — extract per-event `eventToTransitionFiring(event): TransitionFiring` so the bus and the static reducer share one transform)
→ src/orchestrator/src/types.ts (existing — add `onPetrinautEvent?: (event: PetrinautEvent) => void` fan-out hook on OrchestratorInput)
→ src/orchestrator/src/engine.ts (existing — pass `input.onPetrinautEvent` into createPetrinautEventStream as the `onEvent` callback so engine-emitted events fan out to the bus without engine knowing the bus exists)
→ exits at:
    src/orchestrator/src/petrinaut-stream-bus.test.ts (new — pub/sub + replay-on-subscribe + frame translation + terminal closure)
    src/orchestrator/src/engine-contract.test.ts (existing — extend FE-764 block: drive engine with `onPetrinautEvent` set, attach bus subscriber, assert replay-on-connect invariant on a real run)
```

### Risks and Assumptions

```
- ASSUMPTION: The `BrunchExecutionExportFrame` discriminated-union shape is the right SSE wire format — one logical frame per SSE `data:` payload, frame kinds disjoint from PetrinautEvent kinds.
  → VALIDATE: `Frame = { kind: 'definition'; definition: NetDefinition } | { kind: 'initial_state'; initialState: Marking } | { kind: 'transition_firing'; firing: TransitionFiring } | { kind: 'terminal' }` is structurally equivalent to walking `BrunchExecutionExport` field-by-field. Type-level check in tests: reducing the captured frame sequence reconstructs a `BrunchExecutionExport` byte-equal to `reduceBrunchExecutionExport({ sdcpnFile, events })`.
  → If the cross-team Petrinaut team specifies a different envelope (e.g. always-named `event:` SSE field, batched frames), slice 3b adapts the HTTP serializer; this slice's shape stays.

- ASSUMPTION: A late subscriber gets the full buffered timeline *before* any further live frames. No interleaving — replay completes synchronously on subscribe, then live frames flow.
  → VALIDATE: test where subscriber attaches after 3 firings have published; subscriber receives `definition`, `initial_state`, all 3 `transition_firing` frames synchronously, then live firings appear in order.

- ASSUMPTION: The bus owns the timeline. The engine remains the sole publisher; subscribers are read-only. No backpressure (a slow subscriber doesn't pause the engine — it queues per-subscriber).
  → VALIDATE: per-subscriber queue is unbounded for now (in-process, small N); slice 3b revisits if necessary when real HTTP backpressure matters.

- RISK: Mixing replay and live publish risks a race — if `publish()` is called concurrently with `subscribe()`, the late subscriber could either double-receive a frame or miss one at the boundary.
  → MITIGATION: bus is single-threaded JS; replay and the subscribe-mark-live happen in one synchronous tick before publish() can next fire. Test explicitly: `subscribe()` immediately followed by `publish()` produces exactly one delivery of the new frame.

- RISK: The static reducer (`reduceBrunchExecutionExport`) currently does its own per-event transform inline; factoring it into a shared helper risks regressing slice-1 tests.
  → MITIGATION: extract `eventToTransitionFiring` first as a no-op refactor, run all 11 slice-1 tests green, then build the bus on top.
```

### Acceptance Criteria

```
✓ `createPetrinautStreamBus({ runId, sdcpnFile })` exported from petrinaut-stream-bus.ts; returns `{ publish, subscribe }`; pure (no I/O, no globals, no timers).

✓ `BrunchExecutionExportFrame` discriminated union exported from petrinaut-stream-bus.ts: `definition` | `initial_state` | `transition_firing` | `terminal`. Type-level pin test mirroring slice-1's locked-schema test.

✓ test: subscriber attached *before* any publish observes — in order — exactly one `definition` frame, exactly one `initial_state` frame after the first `initial_marking` PetrinautEvent, one `transition_firing` per `transition_fired` PetrinautEvent in publish order, and exactly one `terminal` frame after the first `net_halted` or `net_deadlocked` PetrinautEvent.

✓ test: subscriber attached *after* N firings and a terminal have published receives the full back-buffer (`definition`, `initial_state`, N × `transition_firing`, `terminal`) synchronously on subscribe, then no further frames.

✓ test: subscriber attached between firings receives the buffered frames synchronously, then the subsequent live firings; no firing is dropped, no firing is delivered twice.

✓ test: `unsubscribe()` halts delivery to that handler; other subscribers continue receiving frames.

✓ test: replay-equivalence oracle — collect every frame from one subscriber attached pre-publish, fold them back into a `BrunchExecutionExport`, assert byte-equal to `reduceBrunchExecutionExport({ sdcpnFile, events })`.

✓ `OrchestratorInput.onPetrinautEvent?: (event: PetrinautEvent) => void` added to types.ts; engine.ts threads it into createPetrinautEventStream's `onEvent` opt (no other engine changes).

✓ test: engine-driven integration in engine-contract.test.ts — run cook with `onPetrinautEvent` wired to the bus, subscribe before run, assert replay-equivalence after run completes.

✓ Refactor: `eventToTransitionFiring(event)` extracted into petrinaut-stream-export.ts and reused by both `reduceBrunchExecutionExport` and the bus; all 11 existing slice-1 tests still pass.

✓ `npm run verify` green.
```

### Verification Approach

```
- Inner: unit tests on createPetrinautStreamBus (pre-subscribe, post-subscribe, mid-stream subscribe, unsubscribe, terminal closure, replay-equivalence oracle).
- Middle: engine-contract.test.ts integration — real cook run with onPetrinautEvent wired into the bus; assert replay-equivalence on captured frames.
- Outer: deferred to slice 3b (real HTTP client reading SSE).
```

---

## Slice 3b: HTTP/SSE server mounted on the 3a bus

**Status:** done. `petrinaut-stream-server.ts` + 13-test suite. Real
`http.createServer` + `listen(0)` per test; covers wire conformance,
replay-on-connect (both terminated and mid-stream buses), concurrent
connections, AbortController-disconnect-unsubscribes,
404-on-unknown-routes, CORS preflight, idempotent `stop()`, in-flight
response cleanup on `stop()`. `runCook` integration deferred to slice 4
as planned. `npm run verify` green (1551 tests).

### Target Behavior

A new module `petrinaut-stream-server.ts` exposes
`createPetrinautStreamServer({ bus, host?, port? })` returning
`{ start(): Promise<{ host: string; port: number; streamUrl: string }>, stop(): Promise<void> }`
where `start()` binds a Node `http.Server` (default `host: '127.0.0.1'`,
default `port: 0`) and a single route `GET /stream` returns
`Content-Type: text/event-stream` with one SSE event per
`BrunchExecutionExportFrame` (`event: <kind>\ndata: <JSON>\n\n`); each
connection subscribes to the bus on open, replays the buffered timeline
synchronously, streams live frames, and closes the response with
`res.end()` immediately after writing the `terminal` frame.

### Boundary Crossings

```
→ src/orchestrator/src/petrinaut-stream-server.ts (new — pure HTTP shell over the 3a bus)
→ consumes:
    src/orchestrator/src/petrinaut-stream-bus.ts (createPetrinautStreamBus → subscribe / publish, BrunchExecutionExportFrame)
    node:http (createServer, Server, IncomingMessage, ServerResponse)
→ exits at:
    src/orchestrator/src/petrinaut-stream-server.test.ts (new — real fetch() against listen(0); SSE wire conformance + lifecycle)
→ NOT touched in this slice:
    src/orchestrator/src/cook-cli.ts (server boot stays opt-in via slice 4's --petrinaut-stream flag)
    src/orchestrator/src/engine.ts (no engine changes — slice 3a already added the onPetrinautEvent fan-out hook)
```

### Risks and Assumptions

```
- ASSUMPTION: One bus subscription per HTTP connection is the right model — replay-on-subscribe happens once per connect, live frames flow until terminal or client disconnect.
  → VALIDATE: tests cover (a) single connection sees definition → initial_state → N firings → terminal, (b) two concurrent connections each see the full timeline independently, (c) client-disconnect mid-stream unsubscribes cleanly.

- ASSUMPTION: SSE wire shape per frame is `event: <kind>\ndata: <json>\n\n` with UTF-8 — matches what every SSE client (Petrinaut included) parses out of the box. No `id:` field (we own the timeline; `Last-Event-ID` resume is out of scope for v1 since the buffer is the timeline and a new connection just re-replays).
  → VALIDATE: test parses the raw response body and asserts the `event:` / `data:` / blank-line framing per frame.

- ASSUMPTION: Localhost-only bind (`127.0.0.1`) makes auth and CORS posture irrelevant for v1. `Access-Control-Allow-Origin: *` is safe because nothing outside this host can connect.
  → VALIDATE: server defaults to `host: '127.0.0.1'` (not `0.0.0.0`); test explicitly asserts the bound host. CORS header sent unconditionally on `/stream` and `OPTIONS`.

- ASSUMPTION: Keep-alive comment frames are unnecessary for v1 — Petrinaut consumes the stream over localhost in seconds-to-minutes, well under any reasonable proxy idle timeout. If Petrinaut later loses connection on long-idle runs, slice 4 or later adds `setInterval(() => res.write(': keep-alive\n\n'), 15_000)`.
  → VALIDATE: slice 3b ships without keep-alive; revisit when a real Petrinaut client connects to a real run.

- RISK: Closing the response immediately after the terminal frame may race with the client's read of the terminal — if `res.end()` happens before the OS has flushed, the client could see a truncated body.
  → MITIGATION: Node's `res.write()` + `res.end()` flushes through the kernel buffer; for SSE that's effectively atomic. Test explicitly: client reads the full body after `terminal`, then the connection closes.

- RISK: Multiple connections share one bus → if a slow subscriber blocks, every subscriber stalls.
  → MITIGATION: 3a uses synchronous `for (handler of subscribers) handler(frame)`; the bus does not await. v1 accepts that a misbehaving HTTP write would back up the Node event loop briefly — acceptable for localhost / single-client demos. Production hardening (per-subscriber queue + drop policy) deferred.

- RISK: Test approach for HTTP — fake `Server` / `ServerResponse` mocks tend to drift from real Node behavior.
  → MITIGATION: tests use real `http.createServer` with `listen(0)` + Node's built-in `fetch()` against `http://127.0.0.1:<port>/stream`. Each test starts and stops one server in `beforeEach` / `afterEach`. No mocks of the HTTP layer.
```

### Acceptance Criteria

```
✓ `createPetrinautStreamServer({ bus, host?, port? })` exported from petrinaut-stream-server.ts; returns `{ start, stop }`.

✓ Defaults: `host: '127.0.0.1'`, `port: 0`. `start()` resolves with `{ host, port, streamUrl }` where `streamUrl` = `http://${host}:${port}/stream` and `port` is the kernel-chosen ephemeral port.

✓ test: GET /stream returns 200, Content-Type: text/event-stream, Cache-Control: no-cache, Connection: keep-alive.

✓ test: a pre-subscribed connection (connect before any publish) receives — in order — exactly one `event: definition`, one `event: initial_state`, one `event: transition_firing` per published transition_fired event, and exactly one `event: terminal`, then the response stream closes.

✓ test: each SSE frame's `data:` line parses as JSON whose shape matches the corresponding BrunchExecutionExportFrame variant.

✓ test: a connection opened AFTER the bus has published N firings and a terminal receives the full back-buffer synchronously on connect, then the response closes.

✓ test: two concurrent connections each see the full ordered frame sequence independently; one closing doesn't affect the other.

✓ test: client closing the connection mid-stream (`AbortController.abort()` on the fetch) unsubscribes from the bus (assert via bus internals — e.g. publish one more event after abort, count subscribers).

✓ test: requests to any path other than `/stream` return 404.

✓ test: `OPTIONS /stream` returns 204 with CORS headers (`Access-Control-Allow-Origin: *`, `Access-Control-Allow-Methods: GET, OPTIONS`).

✓ test: `start()` rejects if called twice; `stop()` is idempotent.

✓ test: `stop()` ends any in-flight responses and closes the server (any outstanding fetch reads end cleanly).

✓ `npm run verify` green.
```

### Verification Approach

```
- Inner: petrinaut-stream-server.test.ts — real http.createServer + listen(0) + Node fetch() per test, no HTTP mocks. Covers wire conformance, lifecycle, concurrent connections, disconnect, 404, OPTIONS, idempotent stop.
- Middle: deferred to slice 4 (cook-CLI integration — boot via --petrinaut-stream flag, real cook run streams real frames to a real Petrinaut client mock).
- Outer: deferred to slice 4 / 5 cross-team check — a real Petrinaut client (Chris's repo) consumes a real cook run end-to-end.
```

### Notes

- Slice 3b is sequentially obvious from 3a — its scope wouldn't change based on what 3a finds (and didn't). The HTTP shell composes 3a's `subscribe` callback into a `res.write()` per frame; that's it.
- Slice 4's job is the trigger surface: `--petrinaut-stream` flag flips server boot on, `--petrinaut-base-url` + env + auto-open compose the Petrinaut launcher URL, `runCook` orchestrates the lifecycle.
- After 3b ships, `/tmp/reduce-export.mjs` is fully obsolete (the bus's replay-equivalence oracle subsumes its frame-replay role).

---

## Slice 4: `--petrinaut-stream` cook wiring + URL composition + auto-open

**Status:** scoped (this card). Wires the 3b SSE server into `runCook` behind `--petrinaut-stream`, resolves the multi-tier base URL, composes the Petrinaut launcher URL, and auto-opens it (suppressible). Brings FE-764 to demo-runnable: `brunch cook <dir> --petrinaut-stream` opens Petrinaut on the running session.

### Target Behavior

`brunch cook <dir> --petrinaut-stream` boots an ephemeral SSE server on `127.0.0.1` (kernel-chosen port) before the engine starts firing, subscribes the engine's `PetrinautEvent` stream to the bus, prints the composed Petrinaut launcher URL (`{baseUrl}?runId={runId}&mode=actual&sse={streamUrl}`), auto-opens it in the default browser unless `--no-petrinaut-open` or `process.env.CI` is set, leaves the SSE server alive for the entire `engine.run()`, and stops the server after the run completes (success or failure). Without `--petrinaut-stream`, cook behaviour is byte-identical to today (no server, no URL, no open). The base URL resolves CLI flag > env var > hard-fail before any cook side effects (no sandbox created, no engine started).

### Boundary Crossings

```
→ src/orchestrator/src/cook-cli.ts (existing)
    - new fields on CookOptions: petrinautStream, petrinautBaseUrl, petrinautOpen
    - new flag parsing: --petrinaut-stream, --petrinaut-base-url=<url>, --no-petrinaut-open
    - usage string + help text update
    - runCook: load .env via loadLocalEnvFile(launchCwd); resolve base URL pre-flight; on --petrinaut-stream, create bus + server, wire bus.publish to OrchestratorInput.onPetrinautEvent, start server, compose + print URL, auto-open; ensure stop() in finally
→ src/orchestrator/src/petrinaut-launcher-url.ts (new — pure URL composer + base-URL resolver)
    - export resolvePetrinautBaseUrl({ cliFlag, env }) → { baseUrl } | { error: string }
    - export composeLauncherUrl({ baseUrl, runId, streamUrl }) → string
→ src/orchestrator/src/types.ts (existing)
    - OrchestratorInput already carries onPetrinautEvent; no change.
    - NEW: optional onPetrinautBus?(bus: PetrinautStreamBus): void so engine hands the constructed bus back to cook-cli for HTTP wiring (bus needs sdcpnFile, which engine.ts builds — bus must be constructed inside engine).
→ src/orchestrator/src/engine.ts (existing)
    - When input.onPetrinautBus is set AND runDir is set: construct bus via createPetrinautStreamBus({ runId, sdcpnFile }) inside the existing FE-762 sdcpn block, call input.onPetrinautBus(bus), and use bus.publish as the onEvent for createPetrinautEventStream. When onPetrinautBus is unset, behaviour is byte-identical to today.
→ src/server/runtime-config.ts (existing)
    - loadLocalEnvFile(cwd) already exported; reuse from cook-cli.ts. No change to runtime-config itself.
→ .env.example (existing)
    - add line: PETRINAUT_BASE_URL=
→ package.json (existing)
    - 'open' dependency already declared (open ^11). No change.
→ exits at:
    src/orchestrator/src/petrinaut-launcher-url.test.ts (new — pure tests for base-URL resolution + URL composition)
    src/orchestrator/src/cook-cli.test.ts (existing — extend parseCookArgs cases for the three new flags + .env loading + URL composition; do not invoke the cook binary)
    src/orchestrator/src/engine-contract.test.ts (existing — extend FE-764 block: run engine with onPetrinautBus, attach an HTTP client to the returned bus's server, assert end-to-end frame delivery on a real cook run)
```

### Risks and Assumptions

```
- ASSUMPTION: The bus needs the SdcpnFile, which is built inside engine.ts after compileTopology. So the bus must be constructed inside engine and handed back via a callback — cook-cli cannot construct it pre-flight. `onPetrinautBus` is that callback.
  → VALIDATE: engine.ts builds bus only when `input.onPetrinautBus` is set; existing callers without the callback see byte-identical behavior. Test: existing engine tests without onPetrinautBus pass unchanged.

- ASSUMPTION: `loadLocalEnvFile(launchCwd)` (currently used by `src/server/cli.ts`) is the right reuse target for cook-cli — it only sets unset env vars, never overrides shell env, and tolerates a missing .env.
  → VALIDATE: import directly from `../../server/runtime-config.js` (cross-mini-library import already done elsewhere?). If the import direction is wrong per AGENTS.md's mini-library posture, extract the loader to a shared module (e.g. `src/shared/load-local-env.ts`) and have both callers consume it. Confirm at build time; prefer reuse over duplication.

- ASSUMPTION: The `open` npm package (already a dep) launches the system browser cross-platform and resolves whether or not the browser actually opens.
  → VALIDATE: invoke `open(url)` inside a try/catch; failure prints a "Couldn't auto-open browser; visit {url}" warning and continues. Test: auto-open is suppressed in tests by injecting an `openUrl` seam (default = npm `open`) so we never spawn a real browser in CI.

- ASSUMPTION: Server lifetime ≡ engine.run lifetime. Starting before engine.run guarantees the URL is openable as soon as the user sees it; stopping in `finally` guarantees cleanup on success, failure, and uncaught exception.
  → VALIDATE: test: server.stop() is called whether engine.run resolves or rejects; connectionCount() drops to 0 after stop.

- ASSUMPTION: URL param shape `{baseUrl}?runId={runId}&mode=actual&sse={streamUrl}` is speculative (Chris hasn't locked names). v1 emits these names; slice 5 / coordination revisits.
  → VALIDATE: URL composer is a pure function with a single source of truth; renaming a param is a one-line change confined to composeLauncherUrl.

- ASSUMPTION: CI detection via `process.env.CI` (any truthy value) is the right signal — matches `gh actions`, `circleci`, `vercel`, etc.
  → VALIDATE: test: with `process.env.CI = '1'`, auto-open is skipped even without `--no-petrinaut-open`; URL still prints.

- RISK: If `--petrinaut-stream` is set but base URL resolution fails, cook should hard-fail BEFORE creating the sandbox / writing artifacts (avoid orphan run dirs).
  → MITIGATION: resolve base URL as the first step in runCook when `petrinautStream === true`; on failure, print the locked message and exit(1) before resolveCookMode / createSandbox.

- RISK: Test for engine-contract.test.ts end-to-end may flake on port allocation / connection timing.
  → MITIGATION: rely on listen(0) (already done in 3b tests) + await server.start() before composing URL; use Node fetch() with explicit signal; if flake materialises, gate the e2e test on `process.env.PETRINAUT_E2E` and keep inner-loop tests deterministic (unit-level URL composer + cook-cli flag parsing).

- RISK: Cross-mini-library import (orchestrator → server) might violate the codebase's compartmentalization posture.
  → MITIGATION: if so, lift loadLocalEnvFile to `src/shared/` (or copy the ~10-line helper into orchestrator) — both are acceptable; pick the simpler one at build time. Don't block the slice on this.
```

### Acceptance Criteria

```
✓ `parseCookArgs` accepts `--petrinaut-stream` (boolean, default false), `--petrinaut-base-url=<url>` (string, default undefined), `--no-petrinaut-open` (boolean, default false). Usage string updated. Unknown values exit non-zero with a clear error (existing pattern).

✓ `CookOptions` gains: `petrinautStream: boolean`, `petrinautBaseUrl?: string`, `petrinautOpen: boolean` (resolves the flag + CI default at parse time? — no, leave CI check in runCook so parseCookArgs stays pure).

✓ test: parseCookArgs round-trips each new flag with correct precedence (no flag → defaults; `--no-petrinaut-open` → petrinautOpen=false; etc.).

✓ `resolvePetrinautBaseUrl({ cliFlag, env })` exported from petrinaut-launcher-url.ts: returns `{ baseUrl }` from CLI flag if set, else from `env.PETRINAUT_BASE_URL` if set, else `{ error: 'Petrinaut base URL required: set PETRINAUT_BASE_URL in .env or pass --petrinaut-base-url=<url>' }`. Pure function.

✓ test: all three resolution branches (CLI > env > error) verified, including the exact error message string.

✓ `composeLauncherUrl({ baseUrl, runId, streamUrl })` exported from petrinaut-launcher-url.ts: returns `${baseUrl}?runId=${runId}&mode=actual&sse=${encodeURIComponent(streamUrl)}` (URL-encodes `sse` since it contains a URL). Pure function.

✓ test: composer handles baseUrl with and without trailing slash; URL-encodes the sse parameter; preserves runId verbatim.

✓ `runCook` (when `opts.petrinautStream === true`):
    1. Calls `loadLocalEnvFile(launchCwd)` early (before base-URL resolution).
    2. Resolves base URL via `resolvePetrinautBaseUrl({ cliFlag: opts.petrinautBaseUrl, env: process.env })`. On error: prints message to stderr and `process.exit(1)` — before createSandbox / loadPlan side effects.
    3. Creates the bus + server via `onPetrinautBus` callback inside engine; `server.start()` returns `{ streamUrl }`.
    4. Composes launcher URL via `composeLauncherUrl(...)`, prints to stderr.
    5. Auto-opens via the npm `open` package unless `opts.petrinautOpen === false` or `process.env.CI` is set; on open failure, warns and continues (doesn't fail the cook run).
    6. Calls `server.stop()` in a `finally` (success, failure, or thrown error all cleanup).

✓ test (cook-cli.test.ts): with `--petrinaut-stream` and a base URL set via env, runCook (via an injected seam — testable subset, not a real binary spawn) calls openUrl with the composed launcher URL. With `--no-petrinaut-open`, openUrl is not called but the URL is printed. With `CI=1`, openUrl is not called.

✓ test (engine-contract.test.ts): a real cook run with `onPetrinautBus` wired produces a bus that, when fed to `createPetrinautStreamServer` and connected to via Node fetch(), delivers `definition` → `initial_state` → all firings → `terminal` to an HTTP client. Asserts replay-equivalence at the SSE layer.

✓ `OrchestratorInput.onPetrinautBus?: (bus: PetrinautStreamBus) => void` added to types.ts; engine.ts wires it inside the existing FE-762 sdcpn block; existing tests without the callback still pass.

✓ `.env.example` gains `PETRINAUT_BASE_URL=` (empty placeholder so first-run setup is obvious).

✓ `npm run verify` green (fmt, lint, test, build).
```

### Verification Approach

```
- Inner: petrinaut-launcher-url.test.ts unit tests for base-URL resolution + URL composition (pure); cook-cli.test.ts extension for the three new flags; engine.ts unchanged for callers without onPetrinautBus.
- Middle: engine-contract.test.ts extension — real http.Server over the bus, fetch() asserts SSE frames end-to-end on a real cook run.
- Outer: deferred to slice 5 / cross-team validation — Chris's Petrinaut client connects to a real cook run and renders the "actual" view. Bristol-demo readiness gate.
```

### Notes

- The `--petrinaut-fold` flag from slice 2 stays orthogonal: identity-fold is the demo default, and the stream just carries whatever fold the engine produced. Stream tests should not re-litigate fold behaviour.
- After slice 4 lands, the only blocker to running the Bristol demo is Chris's Petrinaut client wiring the `?sse=` query param to its SSE consumer — coordination item, not brunch code.
- Slice 5 (web-UI button) needs a discovery mechanism (`<runDir>/petrinaut-stream.json` advertised by the cook process is the leading candidate); deferred per PLAN.md.

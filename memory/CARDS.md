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

Slice 3 (ephemeral live stream) is split into two card-sized commits:

- **3a (next):** event-bus + replay buffer + incremental frame translator
  (`PetrinautEvent` → `BrunchExecutionExport` frames). Pure, no HTTP. Wired
  into the engine via a new `onPetrinautEvent` fan-out hook on
  `OrchestratorInput`.
- **3b (sequentially obvious):** HTTP server (`http.createServer` +
  `listen(0)`) + `/stream` (text/event-stream) mounted on the 3a bus.
  Connection lifecycle, port advertisement, process-death cleanup.

Slices 4 (`--petrinaut-stream` + URL composition + multi-tier base-URL +
auto-open) and 5 (web-UI button + endpoint discovery) stay sketched below;
promote to full scope cards once 3a + 3b ship and a real Petrinaut client
has consumed the stream end-to-end.

---

## Slices 4–5 (sketches — promote to full cards after slice 3b ships)

### Slice 4 — `--petrinaut-stream` flag + URL composition + multi-tier base-URL + auto-open

- New flag `--petrinaut-stream` on `brunch cook` — opt-in (default off). Without it, cook continues to write JSONL artifacts but doesn't boot slice 3's server. With it, slice 3's server starts and the URL is composed/presented.
- New flag `--petrinaut-base-url=<url>` — one-off override for the Petrinaut SPA base.
- New env var `PETRINAUT_BASE_URL` — read via brunch's existing env loader (`.env` is the practical home).
- New flag `--no-petrinaut-open` — suppress auto-launching the browser; URL still prints. Implicit when `process.env.CI` is set.
- **Base-URL resolution** (locked in PLAN.md FE-764): CLI flag > env var > **hard fail** with `Petrinaut base URL required: set PETRINAUT_BASE_URL in .env or pass --petrinaut-base-url=<url>`. No baked-in default.
- URL shape: `{baseUrl}?runId={runId}&mode=actual&sse={localEndpoint}` (exact param names pending Chris — emit speculatively for v1; align before Bristol).
- `.env.example` gains a `PETRINAUT_BASE_URL=` line (commented or with a placeholder so first-run setup is obvious).
- Auto-open via `open` / `xdg-open` (npm `open` package — small mature dep). Falls back to print-only on launch failure.
- Validation runs **before** the cook engine starts so a misconfig fails fast rather than mid-run.

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

**Status:** next. Pure data-shape work — no HTTP yet. Establishes the
in-process pub/sub that slice 3b will mount its `/stream` route on.

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

## Slice 3b (sketch — promote to full card after 3a ships)

Mount the 3a bus on an HTTP server inside the cook process.
`http.createServer` + `listen(0)`; one route `GET /stream` returns
`Content-Type: text/event-stream`, subscribes to the bus, serializes each
`BrunchExecutionExportFrame` as one SSE event (`event: <kind>\ndata:
<json>\n\n`), closes the connection after the `terminal` frame is sent.
Server boots before `engine.run`, dies with the process (SIGINT/SIGTERM).
Cook prints the chosen `localhost:<port>/stream` URL on boot; slice 4
composes the Petrinaut launcher URL on top. No persistence, no auth,
localhost-only bind.

Open items to lock when 3b is scoped: keep-alive comment cadence (Petrinaut
client tolerance), `Last-Event-ID` resume semantics (probably out-of-scope
for v1 since the buffer is the timeline), CORS posture (probably allow `*`
since localhost-only — confirm with Chris), test approach for HTTP (real
`fetch` against bound port vs in-process `http.request` vs a stub
ResponseStream).

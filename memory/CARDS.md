<!-- CARDS.md — prepared scope-card queue for one live frontier item.
     Created by ln-scope · consumed by ln-build · retired when queue exhausted.
     Frontier: petri-sync-server (FE-764).
     Parent branch: ka/fe-784-petrinaut-colour-fold. -->

# Scope cards — FE-764 petri-sync-server

Two-slice prepared queue. Slice 1 promotes the export reducer prototype into
`src/orchestrator/src/` + tests under the existing `NetFolding` seam. Slice 2
adds the `createIdentityFolding` constructor and the `--petrinaut-fold` cook
CLI flag, flipping the default to `identity`. Both slices live on
`ka/fe-764-petri-sync-server` (stacked on `ka/fe-784`).

Later slices (ephemeral SSE server in the cook process — slice 3;
`--petrinaut-stream` flag + URL composition + multi-tier base-URL
resolution + auto-open — slice 4; web-UI button + endpoint discovery —
slice 5) get sketched below; they get full scope-card treatment once
slices 1+2 ship and the on-wire contract has held up against an
integration test.

---

## Slices 3–5 (sketches — promote to full cards after slice 2 ships)

### Slice 3 — ephemeral SSE server in the cook process

Boot an HTTP server on a free port inside the cook process (`http.createServer` + `listen(0)`); one route `/stream` returns `text/event-stream` and replays `definition` → `initial_marking` → all firings-so-far → live firings → terminal per the `BrunchExecutionExport` contract. Lifecycle: starts at cook init, dies with the process. Buffers prior events in memory so a late joiner gets the full timeline. No persistence, no auth, localhost-only.

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

**Status:** next. Slice 1 already landed `createIdentityFolding` in `petrinaut-fold.ts`; slice 2 just adds the CLI flag, threads it through the cook entry to pick the constructor, extends `serializeBlueprint` (currently hard-codes `createNetFolding`) to accept a `folding` opt, updates SPEC §Lexicon with `identity fold`, and adds an engine-driven version of the frame-replay oracle exercising the identity path end-to-end.

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

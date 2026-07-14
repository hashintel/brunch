# Active-branch session cutover

Frontier: session-branching
Status:   active
Mode:     slices
Created:  2026-07-14

## Orientation

- FE-1196 currently exposes native Pi `/tree`, `/fork`, and `/clone` while Brunch file readers reject or misproject the valid session trees those actions create.
- D24-L now makes Pi's active root-to-leaf branch the source of current Brunch session semantics across SDK/in-process and RPC/file-backed reads.
- The load-bearing risk is abandoned-branch leakage: append-order `getEntries()` can select stale runtime mode, orientation, scratchpad, binding, pending exchange, watermark, or capture state.
- Full history remains legitimate only for explicitly named diagnostic/artifact surfaces; this sequence must not erase those uses by blindly replacing every history read.

Posture: proving (inherited from `session-branching`).

Cross-cutting obligations:

- Preserve D6-L JSONL-first transcript truth and D21-L coordinator ownership; introduce no chat/turn store or second session authority.
- Preserve D76-L/D77-L/D78-L turn-boundary choreography by making each current-state fold branch-relative.
- Preserve exactly-one immutable session binding (I8-L) across `/tree`, `/fork`, `/clone`, and resume.
- Use Pi's public `SessionManager`/runtime/RPC tree APIs; do not rebuild a second tree parser in Brunch.

---

## Card 1 — Canonical active-branch read seam

Status: next
Weight: full

### Target Behavior

A valid Pi session containing sibling branches, an optional branch summary, or a fork/clone parent header opens through Brunch and projects the active branch without rejection.

### Cold-start reads

- `memory/SPEC.md` — requirement 8; D24-L; I8-L, I10-L, I13-L, I19-L
- `memory/PLAN.md` — frontier `session-branching`
- `src/session/TOPOLOGY.md` — active-session-branch contract and session-envelope ownership
- Pi docs — `docs/session-format.md`, `docs/sdk.md` §Session Management, `docs/rpc.md` `get_entries`/`get_tree`

### Boundary Crossings

```text
Pi SessionManager tree + active leaf
  -> Brunch active-session-branch adapter
  -> session envelope / exchange projection
  -> one public session.* read
```

### Risks and Assumptions

- RISK: file-backed reopen may derive the wrong leaf after a tree switch → MITIGATION: construct the fixture through real Pi APIs, append on the selected branch, close, physically reopen, and assert `getBranch()` identity before asserting Brunch output.
- RISK: session binding exists only on an abandoned path after fork/clone → MITIGATION: test real Pi fork/clone output; fail loudly only for a genuinely absent/ambiguous Brunch binding, never for valid tree shape.
- ASSUMPTION: Pi's public `SessionManager.open()` + `getHeader()` + `getBranch()` carry all product information currently taken from raw JSONL.
  -> IMPACT IF FALSE: file-backed RPC needs Pi tree+leaf reconstruction rather than the same adapter shape.
  -> VALIDATE: this card's physical-reload tracer.

### Posture check

- Lights up: `/tree` branch → continue → physical reload → Brunch public projection.
- Stabilizes: one active-branch read seam for later consumer cutover.
- Retires: the remaining implementation uncertainty formerly carried by A37-L.

### Acceptance Criteria

- ✓ `src/session/__tests__/active-session-branch.test.ts` — a real `SessionManager` sibling tree reopens on the selected active path and Brunch accepts `branch_summary`.
- ✓ `src/session/__tests__/active-session-branch.test.ts` — real fork/clone-style `parentSession` headers retain the Brunch binding and project without `NonLinearTranscriptError`.
- ✓ `src/session/__tests__/exchange-projection.test.ts` — abandoned sibling asks/runtime entries do not appear in active-branch exchange state.
- ✓ `src/rpc/__tests__/handlers.test.ts` — one file-backed `session.exchanges`/`session.runtimeState` public read agrees with the SDK active branch over the same physical fixture.

### Invariants preserved

- JSONL remains canonical transcript truth — guarded by `src/session/__tests__/jsonl-session-viability.test.ts`.
- A session stays bound to exactly one spec — guarded by `src/session/__tests__/workspace-session-coordinator.test.ts`.
- No product read silently falls back from branch APIs to append order — guarded initially by direct adapter tests; Card 3 installs the architectural inventory guard.

### Verification Approach

- Inner: real-Pi unit/contract tests over `SessionManager` tree APIs.
- Middle: physical JSONL reload plus SDK/public-RPC differential over one branched fixture.
- Outer: owned by Card 3's TUI `/tree` walkthrough after the reader sweep lands.

### Expected touched paths (tentative)

```text
src/session/
├── active-session-branch.ts                         +
├── brunch-session-envelope.ts                      ~
├── exchange-projection.ts                          ~
└── __tests__/
    ├── active-session-branch.test.ts                +
    └── exchange-projection.test.ts                  ~
src/rpc/
├── methods/session.ts                              ~
└── __tests__/handlers.test.ts                       ~
```

---

## Card 2 — Live current-state consumer cutover

Status: queued
Weight: full

### Target Behavior

Every in-process Brunch consumer that derives current session state reads Pi's active branch, so abandoned branches cannot supply current runtime, orientation, scratchpad, binding, continuity, capture, TUI, or Chrome state.

### Cold-start reads

- `memory/SPEC.md` — D24-L; I5-L, I8-L, I13-L, I19-L, I25-L, I45-L–I47-L
- `memory/PLAN.md` — frontier `session-branching`
- `src/session/TOPOLOGY.md` — runtime-state, scratchpad, orientation, continuity ownership
- `src/.pi/extensions/TOPOLOGY.md` — extension consumer topology

### Boundary Crossings

```text
Pi extension/app SessionManager
  -> active-session-branch adapter
  -> runtime/orientation/scratchpad/binding/continuity folds
  -> TUI + Chrome + agent context/current commands
```

### Risks and Assumptions

- RISK: bulk replacement erases intentional all-history reads → MITIGATION: classify each production `getEntries()` site before changing it; migrate only current/latest semantics and record explicit history exceptions.
- RISK: a test harness omits `getBranch()` and currently survives through a fallback → MITIGATION: make the branch capability required in product-facing interfaces and update harnesses; no `getEntries()` fallback.
- RISK: continuity watermarks from an abandoned branch suppress required re-announcement → MITIGATION: branch-rival fixtures pin watermark, mention, orientation, and pending-exchange negative space.

### Posture check

- Stabilizes: I19-L across the entire live product-reader family.
- Lights up: branch-local runtime mode and continuity state after `/tree` navigation.

### Acceptance Criteria

- ✓ `src/projections/session/__tests__/runtime-state.test.ts` — a newer append-order runtime entry on an abandoned branch cannot change active operational mode.
- ✓ `src/session/__tests__/elicitation-scratchpad.test.ts` and `src/session/__tests__/session-orientation.test.ts` — branch-rival snapshots/resolutions fold only from the active branch.
- ✓ `.pi` extension tests — command recovery, system prompts, scratchpad tools, session binding, orientation, capture sweep, and Chrome consume a required branch reader with no `getEntries()` fallback.
- ✓ app/TUI tests — Brunch TUI and extension composition derive current runtime state from the active branch while the full tree remains navigable by Pi.

### Invariants preserved

- Operational mode remains transcript-backed and foreground role remains derived — guarded by runtime-state and authority-matrix suites.
- Orientation remains one append-only carrier and kick routing remains deterministic — guarded by session-orientation registrar/juncture suites.
- Continuity origination remains idempotent and never fabricates a user turn — guarded by Tier-2 I45-L–I47-L tests.

### Verification Approach

- Inner: branch-rival fixtures for every fold family.
- Middle: one real `SessionManager` fixture drives representative app and extension composition paths.
- Outer: deferred within this same scope file to Card 3 after all consumers converge.

### Expected touched paths (tentative)

```text
src/session/
├── runtime-state.ts                                 ~
├── elicitation-scratchpad.ts                        ~
└── session-orientation.ts                           ~
src/projections/session/                             ~
src/.pi/extensions/
├── agent-runtime/                                   ~
├── brunch-data/                                     ~
├── commands/index.ts                                ~
├── compaction/                                      ?
├── session-orientation/                             ~
└── chrome/index.ts                                  ~
src/app/
├── brunch-tui.ts                                    ~
└── pi-extensions.ts                                 ~
```

---

## Card 3 — File/RPC convergence and closed reader inventory

Status: queued
Weight: full

### Target Behavior

Every Brunch file-backed or RPC session method either projects Pi's active branch through the canonical adapter or declares itself an all-history diagnostic, with no raw parser or non-linearity rejection masquerading as current state.

### Cold-start reads

- `memory/SPEC.md` — D5-L, D19-L, D24-L; I10-L, I13-L, I19-L, I21-L, I25-L
- `memory/PLAN.md` — frontier `session-branching`
- `src/session/TOPOLOGY.md` and `src/rpc/TOPOLOGY.md`
- `docs/architecture/probes-and-transcripts.md` — artifact/history reader distinctions

### Boundary Crossings

```text
session file or Pi RPC tree+leaf response
  -> active-session-branch adapter
  -> canonical session inventory / transcript / exchange / runtime projections
  -> Brunch RPC handlers and explicit diagnostic renderers
```

### Risks and Assumptions

- RISK: diagnostic/probe artifacts need abandoned history for evidence → MITIGATION: keep an explicit full-tree/all-history API or local helper whose name and type advertise that contract; do not feed it to product current-state projections.
- RISK: canonical session inventory counts abandoned turns or picks names from abandoned paths → MITIGATION: derive user-facing session metadata from Pi's active branch/session APIs and add rival-branch fixtures.
- RISK: a new consumer regrows append-order current-state reads → MITIGATION: add a bounded architectural inventory test over production paths, with explicit diagnostic allow-list entries carrying rationale.

### Posture check

- Closes: the five known branch-danger contact families and the unsafe fallback pattern.
- Stabilizes: one enforceable active-branch/all-history vocabulary across session and RPC topology.

### Acceptance Criteria

- ✓ `src/rpc/__tests__/handlers.test.ts` — `session.pendingExchange`, `session.exchanges`, and `session.runtimeState` agree with the active Pi branch and never return `-32002` merely because siblings/branch summaries/parentSession exist.
- ✓ `src/session/__tests__/workspace-session-coordinator.test.ts` — session inventory/name/turn count follows the active branch for a branched physical session.
- ✓ `src/session/__tests__/session-transcript.test.ts` — default product transcript rendering is active-branch-relative; any all-history rendering is explicitly named and tested as diagnostic output.
- ✓ architectural reader-inventory test — every production `getEntries()` or raw session JSONL parser is classified; no product-semantic caller remains outside the branch adapter.
- ✓ existing probe/dev readers — append-order artifact inspection remains available only where its all-history purpose is explicit.
- ✓ manual walkthrough (`TESTING_FINDINGS.md`, FE-1196 owner) — TUI `/tree` → select prior turn → continue into sibling → quit → resume; Brunch exchange/runtime-state readback remains usable and branch-correct.

### Invariants preserved

- Brunch public RPC stays product-shaped and does not require clients to coordinate raw Pi RPC — guarded by RPC discovery/parity suites.
- Historical JSONL remains available for audit/probe evidence — guarded by probe artifact tests.
- Topology files describe materialized current state at completion — guarded by `npm run check:markdown-links` and review of `src/session/TOPOLOGY.md`/`src/rpc/TOPOLOGY.md` migration notes.

### Verification Approach

- Inner: handler, coordinator, transcript, and architecture tests.
- Middle: SDK/public-RPC differential over the same branched physical fixture.
- Outer: one owned TUI branch/continue/restart walkthrough recorded under FE-1196 before tie-off.

### Expected touched paths (tentative)

```text
src/session/
├── session-projection-reader.ts                     ~
├── session-transcript.ts                            ~
├── workspace-session-coordinator/
│   └── canonical-session-files.ts                   ~
├── TOPOLOGY.md                                      ~
└── __tests__/                                       ~
src/rpc/
├── methods/session.ts                               ~
├── handlers.ts                                      ?
├── TOPOLOGY.md                                      ~
└── __tests__/                                       ~
src/dev/                                             ?
src/probes/                                          ?
docs/architecture/probes-and-transcripts.md          ?
TESTING_FINDINGS.md                                   ~
memory/PLAN.md                                       ~
```

# Agents snapshot contexts and FE-806 closeout

Frontier: agents-composition-layer
Status:   active
Mode:     chain
Created:  2026-06-04

## Orientation

- Containing seam: FE-806 now has the first `src/agents/state.ts` + `src/agents/compose.ts` product prompt path; the remaining frontier proof is D60-L context rendering plus removing the legacy `.pi/context` prompt-pack substrate.
- Planner frontier diagram adds two proof signals to preserve in the remaining slices: strategies must differ in available instructions, and lenses must differ in context emphasis.
- Worktree state: current `git status` is clean except foreign untracked `.agents/skills/ln-plan/references/`; do not touch that directory.
- Main open risk: context proof can become harness-as-false-proof if tests inject snapshots that the real Brunch launch path never supplies; pushed prompt context must come from selected-spec graph/session data already bound by the product runtime factory.

## Card 1 — Full scope — Lens-shaped agent-context renderers

Status: done

Result: Landed `src/agents/contexts/{cwd,graph,node}.ts` renderers, pushed rendered context through `composeAgentPrompt()`, and wired the real `.pi` prompting path to selected-spec-bound graph snapshot readers from the Brunch runtime factory. Verified with targeted context/compose/prompting Vitest coverage and `npm run fix`.

### Target Behavior

Agent prompts include selected-spec snapshot context rendered by `src/agents/contexts/` with lens-specific emphasis.

### Boundary Crossings

```
→ Brunch TUI runtime factory / explicit Pi extension shell
→ selected-spec graph snapshot readers (`graph/snapshot.ts` via pre-bound `GraphSnapshotReaders`)
→ session/workspace facts already owned by the coordinator/prompt context
→ `src/agents/contexts/{graph,node,cwd}.ts` RENDER layer
→ `src/agents/compose.ts` pushed context section
→ Pi `before_agent_start` system prompt
```

### Risks and Assumptions

- RISK: prompt tests may pass by directly passing fake context that production never wires.
  → MITIGATION: include a `.pi`/TUI prompt-path test whose prompt context provider uses the same selected-spec-bound graph snapshot readers as `createBrunchAgentSessionRuntimeFactory`.
- RISK: implementing a rich cwd scanner would widen FE-806 into a new context subsystem.
  → MITIGATION: keep cwd context to already-owned workspace/session/posture/lifecycle facts plus compact handles; defer filesystem heuristic scanning unless current tests need it.
- RISK: graph rendering may duplicate graph-domain bucketing or policy.
  → MITIGATION: import typed snapshot values from `graph/`; `agents/contexts/` only formats and emphasizes.
- ASSUMPTION: graph overview and optional node-neighborhood values are enough to prove lens context emphasis for the POC.
    → IMPACT IF FALSE: a later card may add richer snapshot pull/tool surfaces, but the render seam remains valid.
    → VALIDATE: compare intent/design/oracle render output over the same typed graph snapshot.

### Tracer-bullet check

- **Proof of life:** a real `before_agent_start` prompt can contain selected-spec graph context, not just context handles.
- **Invariants:** advances I35-L/D60-L by keeping PULL in `graph/`/`session`, RENDER in `agents/contexts/`, and SURFACE through composition.
- **Uncertainty:** proves whether lens state can affect context emphasis before capture and graph-tool-resilience depend on runtime posture.

### Acceptance Criteria

✓ `src/agents/contexts/graph.test.ts` — the same `GraphOverview` renders differently for `intent`, `design`, and `oracle` lens emphasis without mutating or re-querying graph data.

✓ `src/agents/contexts/node.test.ts` — a node-neighborhood snapshot renders the anchor, neighbors, and relevant edges with bounded output and a clear missing-node rendering.

✓ `src/agents/contexts/cwd.test.ts` — cwd/workspace context renders selected-spec/session/posture facts without scanning ambient Pi resources or inventing workspace-global graph truth.

✓ `src/agents/compose.test.ts` — `composeAgentPrompt()` surfaces rendered snapshot text, not only opaque handles, and lens changes alter the context emphasis while preserving the same resource-manifest legality rules.

✓ `src/.pi/__tests__/prompting.test.ts` or `src/brunch-tui.test.ts` — the real product prompt path can supply selected-spec graph snapshot context to `composeAgentPrompt()` through the existing shell/runtime factory.

### Verification Approach

- Inner: file-scoped Vitest tests for `src/agents/contexts/*`, `src/agents/compose.ts`, and the `.pi` prompting adapter; `npm run fix` after edits.
- Middle: product-shell prompt test over `createBrunchPiExtensionShell()` or `createBrunchAgentSessionRuntimeFactory()` proving selected-spec-bound snapshot context reaches `before_agent_start`.
- Outer: none for this card; behavioral LLM quality remains a frontier fitness signal, not a merge gate.

### Cross-cutting obligations

- Preserve D52-L: `agents/contexts/` may import graph/session types or typed readers, but graph/session must not import `agents/`.
- Preserve D60-L: do not render LLM strings in `graph/`; do not re-pull graph data from `.pi/extensions/`.
- Preserve D61-L: every graph snapshot is selected-spec scoped; no workspace-global graph fallback.
- Preserve D39-L: context rendering must not discover prompt resources or ambient `.pi` files.

### Expected touched paths (tentative)

```
src/agents/
├── compose.ts                         ~
├── compose.test.ts                    ~
├── contexts/
│   ├── cwd.ts                         +
│   ├── cwd.test.ts                    +
│   ├── graph.ts                       +
│   ├── graph.test.ts                  +
│   ├── index.ts                       +
│   ├── node.ts                        +
│   └── node.test.ts                   +
└── README.md                          ~
src/.pi/extensions/
└── prompting.ts                       ~
src/.pi/__tests__/
└── prompting.test.ts                  ~
src/brunch-tui.ts                      ?
src/brunch-tui.test.ts                 ?
```

## Card 2 — Light scope — Fold and delete legacy prompt context

Status: next

### Objective

Remove the legacy `src/.pi/context` prompt-pack implementation after any still-useful prompt guidance has been folded into `src/agents/` resources.

### Acceptance Criteria

✓ Legacy prompt-pack specifics that still matter (`structured-exchange` detail discriminants, capture-as-analysis-not-mutation, candidate proposal rubric constraints) are present in the corresponding `src/agents/methods/*.md` resources.

✓ `src/.pi/context/` is deleted rather than preserved as a parallel prompt source.

✓ A grep/architecture test or existing prompt topology test fails if product code imports from `src/.pi/context` again.

✓ Topology READMEs no longer describe `.pi/context` as pending migration state.

### Verification Approach

- Inner: targeted resource content assertions or snapshot-free text tests; grep/architecture test for no `.pi/context` imports; `npm run fix` after edits.
- Middle: existing prompt composition tests still pass with only `src/agents/**` resources packaged.

### Cross-cutting obligations

- Retire stale concepts directly under the repo's free-rewrite posture; do not add aliases, shims, or compatibility loaders.
- Keep `.pi/extensions/` as adapter-only; do not move product prompt assets back under `.pi`.

### Assumption dependency

None — this is deletion/rehome work inside the settled FE-806 seam.

### Expected touched paths (tentative)

```
src/agents/
├── README.md                          ~
└── methods/
    ├── generate-proposal.md           ~
    ├── infer-and-capture.md           ~
    └── run-structured-exchange.md     ~
src/.pi/context/                       -
src/.pi/extensions/
└── snapshot-cwd.ts                     ?
src/.pi/README.md                      ~
src/README.md                          ~
src/agents/architecture.test.ts        +
src/.pi/__tests__/prompting.test.ts    ?
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

## Card 3 — Light scope — Runtime-posture proof fixture

Status: next

### Objective

Record a compact FE-806 proof that stored runtime axes produce materially different real product prompt posture.

### Acceptance Criteria

✓ A product-path test or probe drives `before_agent_start` with transcript-backed runtime switches and records that stored axes become gated manifests on the actual Brunch prompt path.

✓ The proof contrasts two strategies and shows different advertised instructions/resources.

✓ The proof contrasts two lenses over the same selected-spec snapshot and shows different context emphasis.

✓ The proof artifact names accepted blind spots: prompt/body quality is fitness evidence; graph-write reliability remains with `graph-tool-resilience`; capture quality remains with `capture-response-to-graph`.

### Verification Approach

- Inner: deterministic Vitest product-path fixture preferred; no model call required.
- Middle: optional prompt-review artifact under `.fixtures/runs/` only if the builder chooses a manual/probe proof.

### Cross-cutting obligations

- Avoid harness-as-false-proof: do not prove by calling `composeAgentPrompt()` alone if the claim is product-path posture.
- Preserve co-tenancy: if probe artifacts are generated, write only this card's specific `.fixtures/runs/<probe-id>/<run-id>/` directory.

### Assumption dependency

None — this card proves FE-806 wiring posture and does not claim A14-L or A22-L behavioral reliability.

### Expected touched paths (tentative)

```
src/.pi/__tests__/
└── prompting.test.ts                  ~
src/brunch-tui.test.ts                 ?
src/probes/                            ?
.fixtures/runs/agents-composition-layer/ ?
memory/PLAN.md                         ?
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

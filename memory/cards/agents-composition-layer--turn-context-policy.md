# FE-806 turn context and posture policy review fixes

Frontier: agents-composition-layer
Status:   active
Mode:     chain
Created:  2026-06-04

## Orientation

- Containing seam: FE-806's `src/agents/` composition layer is landed but review found two prompt/posture boundary holes before submit: selected-spec prompt context can stale after `/brunch` switches, and method manifests do not share a policy source with active Pi tools.
- Relevant frontier item: `agents-composition-layer` (FE-806) is marked done in `memory/PLAN.md`; these cards are pre-submit review fixes on the same branch/frontier, not new Linear/Graphite work.
- Posture: proving (inherited from `agents-composition-layer` via project default `.pi/POSTURE.md`); the fixes should preserve the tracer proof that stored runtime axes change actual product prompt/tool posture.
- Volatile worktree state: branch is clean and ahead of origin; user explicitly accepts parallel non-FE-806 commits on this branch, so branch splitting is not scoped here.
- Main open risk: fixing each review finding locally could preserve two parallel posture models; prefer the code-judo move that lets the real turn boundary supply one current context to both prompt composition and tool activation.

## Card 1 — Full scope — Current selected-spec prompt context after session switches

Status: done

### Target Behavior

Every `before_agent_start` prompt composes from the spec/session currently bound to the active Brunch session.

### Boundary Crossings

```
→ `/brunch` spec/session switch or Pi replacement session
→ `WorkspaceSessionCoordinator.bindCurrentSpecToReplacementSession(...)`
→ Brunch Pi extension shell turn-boundary context provider
→ `.pi/extensions/prompting.ts`
→ `agents/compose.ts`
→ appended system prompt
```

### Risks and Assumptions

- RISK: `createBrunchAgentSessionRuntimeFactory()` currently closes over launch-time `specId`, `graphDeps`, and `currentWorkspace`.
  → MITIGATION: derive prompt context at turn time from the session binding/current coordinator state or from a single shell-owned mutable state updated by the session-boundary handler; do not close over launch spec/session for future turns.
- RISK: a direct unit test may fake the prompt provider and miss the real switch path.
  → MITIGATION: add a product-path test that exercises shell/session-boundary update then runs `before_agent_start`.
- ASSUMPTION: the coordinator remains the canonical owner of Brunch session binding during `/brunch` switches.
    → IMPACT IF FALSE: FE-806 and FE-807 multi-spec selected-spec guarantees need plan-level redesign.
    → VALIDATE: use the existing coordinator/shell test seam, not a new prompt store.

### Posture check

- **Proof of life:** proves the actual product prompt path follows selected-spec switches rather than only initial launch.
- **Invariants:** stabilizes D11-L/D21-L/D61-L multi-spec discipline and D58-L selected-spec prompt composition.

### Acceptance Criteria

✓ `src/brunch-tui.test.ts` or `src/.pi/__tests__/prompting.test.ts` — after a simulated `/brunch` session/spec switch, `before_agent_start` prompt context names the newly bound spec/session and not the launch spec/session.

✓ `src/brunch-tui.test.ts` or `src/.pi/__tests__/prompting.test.ts` — graph snapshot readers used for prompt context are rebound to the current selected spec.

✓ Source check — `createBrunchAgentSessionRuntimeFactory()` no longer closes prompt context over a launch-time `specId`/`graphDeps` that can survive a session switch.

### Verification Approach

- Inner: targeted Vitest over the extension shell / TUI runtime factory switch path.
- Middle: product-path prompt event test proving `before_agent_start` observes the current durable Brunch session binding.

### Cross-cutting obligations

- Preserve D39-L: no ambient `.pi` discovery or filesystem resource lookup.
- Preserve D40-L: runtime axes still come from transcript-backed session entries.
- Preserve D61-L: graph snapshots are selected-spec scoped; no workspace-global graph fallback.

### Expected touched paths (tentative)

```
src/brunch-tui.ts                    ~
src/brunch-tui.test.ts               ~
src/.pi/pi-extension-shell.ts         ?
src/.pi/extensions/
└── prompting.ts                      ?
src/.pi/__tests__/
└── prompting.test.ts                 ?
src/session/
└── workspace-session-coordinator.ts  ?
```

## Card 2 — Light scope — Use session-owned posture type in agent prompt context

Status: next

### Objective

Make workspace posture's finite shape come from the session/workspace owner instead of a widened local `Record` in `agents/compose.ts`.

### Acceptance Criteria

✓ `AgentPromptWorkspaceContext.posture` imports or projects the canonical workspace posture type from `session/`.

✓ Prompting/compose tests construct posture fixtures through that canonical type or a typed helper, not an arbitrary `Record<string, string | undefined>`.

✓ No runtime dependency cycle is introduced from `session/` back to `agents/`.

### Verification Approach

- Inner: targeted type/lint/test run over `src/agents/compose.test.ts`, `src/agents/contexts/cwd.test.ts`, and affected session exports.

### Cross-cutting obligations

- Preserve D52-L dependency direction: `agents/` may import types from `session/`; `session/` must not import `agents/`.
- Preserve type source-of-truth: import/project, do not restate the posture state space.

### Assumption dependency

None — this is a type-contract collapse inside the settled workspace/session seam.

### Expected touched paths (tentative)

```
src/session/
├── workspace-session-coordinator.ts  ~
└── README.md                         ?
src/agents/
├── compose.ts                        ~
├── compose.test.ts                   ~
└── contexts/
    ├── cwd.ts                        ~
    └── cwd.test.ts                   ~
src/.pi/__tests__/
└── prompting.test.ts                 ?
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

## Card 3 — Full scope — Single posture policy for manifests and active tools

Status: next

### Target Behavior

The same runtime/grade policy determines both advertised method resources and active Pi tool names.

### Boundary Crossings

```
→ transcript-backed runtime-state projection
→ selected spec readiness grade from current prompt/turn context
→ `agents/state.ts` posture policy
→ `agents/compose.ts` `<available_methods>` manifest
→ `.pi/extensions/operational-mode.ts` `setActiveTools(...)`
→ Pi tool-call boundary
```

### Risks and Assumptions

- RISK: current tool activation only removes `bash`/`edit`/`write`, so `commit_graph` may be active when `commit-graph` is not advertised.
  → MITIGATION: project active tool names from the same legal method/tool policy used to emit `<available_methods>`; keep tool-call blocking as defense-in-depth.
- RISK: mapping prompt method ids to Pi tool names can become another duplicated registry.
  → MITIGATION: own the mapping in one `agents/state.ts` policy export and make both compose and operational-mode import/project from it.
- ASSUMPTION: grade-gated method availability is the intended POC authority signal for graph tool exposure.
    → IMPACT IF FALSE: FE-806's “runtime axes change actual posture” proof and FE-807/FE-808 startup assumptions need revision.
    → VALIDATE: tests contrast grounding vs elicitation/commitment grades with the same registered tool set.

### Posture check

- **Proof of life:** runtime/grade state changes not only prompt text but actual active tool posture.
- **Invariants:** stabilizes I25-L/I38-L by collapsing prompt and tool gating to one source.

### Acceptance Criteria

✓ `src/agents/state.test.ts` or existing compose tests — method manifests and projected active tool allow-list are derived from one policy for grounding, elicitation, and commitments grades.

✓ `src/.pi/__tests__/operational-mode.test.ts` or `prompting.test.ts` — `commit_graph` is not active when `commit-graph` is not legal for the current runtime/grade posture.

✓ `src/.pi/__tests__/operational-mode.test.ts` or `prompting.test.ts` — `commit_graph` becomes active when the same posture advertises `commit-graph`, assuming the tool is registered.

✓ Source check — no second hard-coded method/tool legality table exists outside the policy owner.

### Verification Approach

- Inner: Vitest over `agents/state.ts`, `.pi/extensions/operational-mode.ts`, and `.pi` prompting/shell integration.
- Middle: product-path prompt/tool test proving the same transcript-backed runtime state and selected spec grade drive both surfaces.

### Cross-cutting obligations

- Preserve D20-L/D53-L: graph writes still route through `commit_graph` → `CommandExecutor`; this card only controls availability.
- Preserve D39-L: tool/method metadata is code-owned, not filesystem-discovered.
- Preserve D40-L: no hidden extension memory for runtime posture.

### Expected touched paths (tentative)

```
src/agents/
├── state.ts                          ~
├── compose.ts                        ?
├── compose.test.ts                   ~
└── state.test.ts                     +
src/.pi/extensions/
├── operational-mode.ts               ~
└── prompting.ts                      ?
src/.pi/__tests__/
├── operational-mode.test.ts          ~
└── prompting.test.ts                 ~
src/.pi/pi-extension-shell.ts         ?
src/brunch-tui.ts                     ?
src/brunch-tui.test.ts                ?
```

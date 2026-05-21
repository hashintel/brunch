<!-- CARDS.md — temporary execution queue for the active frontier.
     Created by ln-scope. Delete when exhausted or superseded.
     Frontier boundary remains memory/PLAN.md `web-shell` / FE-737 / ln/fe-737-web-shell. -->

# Scope Cards — `web-shell` first batch

## Orientation

- Containing seam: transcript/session projection seam that M3 web-shell will consume through `session.*` / `workspace.*` handlers.
- Frontier item: `web-shell` / M3 / FE-737 on branch `ln/fe-737-web-shell`; these cards are slices inside that frontier, not new issue or branch units.
- Volatile handoff state: no `HANDOFF.md`; prior sync recommends hardening D24-L/I19-L linear transcript policy before browser consumption.
- Main open risk: Pi supports branch/tree substrate behavior, while Brunch POC must fail fast instead of projecting an active branch, adapting non-linear sessions, or preserving accidental branch compatibility.

## Queue discipline

- Work cards in order unless implementation makes a later card invalid.
- After each card: run `npm run fix`; before each commit: run `npm run verify`.
- Keep all changes on FE-737 / `ln/fe-737-web-shell` unless `memory/PLAN.md` is revised by `ln-plan`.
- Update card `Status` as work is completed; delete this file when the queue is exhausted.

---

## Card 1 — Linear transcript validator

- **Status:** done
- **Weight:** light hardening card

### Objective

Brunch transcript loading rejects non-linear Pi JSONL before elicitation exchange projection.

### Acceptance Criteria

✓ Linear transcript fixtures — coordinator-created and M1 fixture JSONL still load and project elicitation exchanges exactly as before.
✓ Non-linear branch fixture — a Pi JSONL with multiple children from one parent is rejected before projection.
✓ Branch-derived fixture — a Pi JSONL with `parentSession` or `branch_summary` evidence is rejected before projection.
✓ Legacy adaptation removal — tests no longer assert active-branch selection, abandoned-branch exclusion, or branch flattening as Brunch behavior.

### Verification Approach

- Inner: focused unit tests in the transcript/projection test family — validates fail-fast linearity checks and unchanged linear-session projection.
- Middle: M1 fixture replay/projection parity — validates existing fixture bundles remain accepted linear sessions.

### Cross-cutting obligations

- Preserve D24-L/I19-L: reject non-linear JSONL rather than flattening, migrating, adapting, or selecting a branch.
- Preserve D13-L: elicitation exchanges remain derived projections over Brunch-supported linear Pi JSONL.
- Do not introduce a canonical chat/turn table or view store while hardening projection.

### Promotion checklist

- [x] Does not change a requirement.
- [x] Does not create, retire, or invalidate an assumption.
- [x] Does not make or reverse a non-trivial design decision.
- [x] Does not establish a new seam-level invariant; it enforces existing I19-L.
- [x] Does not change frontier-level obligations or verification architecture.
- [x] Does not cross more than two major seams.
- [x] Containing seam and rationale are named in SPEC/PLAN.

---

## Card 2 — RPC reader fail-fast semantics

- **Status:** done
- **Weight:** light hardening card

### Objective

`session.elicitationExchanges` returns a product-shaped JSON-RPC error when the selected Brunch session is non-linear.

### Acceptance Criteria

✓ RPC success path — linear coordinator-selected sessions still return the same elicitation exchange projection shape.
✓ RPC rejection path — a non-linear selected session returns a deterministic JSON-RPC failure rather than a partial projection.
✓ Parameter discipline — callers still cannot pass raw transcript file paths to bypass coordinator-selected session state.

### Verification Approach

- Inner: RPC handler contract tests — validates success/rejection/error-code behavior.
- Middle: existing fixture/RPC parity tests — validates accepted linear sessions still project through named `session.*` handlers.

### Cross-cutting obligations

- Browser-facing `session.*` reads must stay thin projections over canonical session JSONL, not a separate read model.
- Rejections must preserve D24-L fail-fast posture and should not expose branch-selection or migration affordances.
- Keep JSON-RPC as the public product protocol shape; do not add REST or file-param escape hatches.

### Promotion checklist

- [x] Does not change a requirement.
- [x] Does not create, retire, or invalidate an assumption.
- [x] Does not make or reverse a non-trivial design decision.
- [x] Does not establish a new seam-level invariant; it exposes existing I19-L through RPC.
- [x] Does not change frontier-level obligations or verification architecture.
- [x] Crosses only transcript projection and RPC handler seams.
- [x] Containing seam and rationale are named in SPEC/PLAN.

---

## Card 3 — TUI branch-flow guard hooks

- **Status:** next
- **Weight:** light hardening card

### Objective

Brunch's internal TUI extension cancels Pi tree/fork branch flows before they mutate Brunch-controlled sessions.

### Acceptance Criteria

✓ Tree guard — the Brunch extension returns `cancel: true` for Pi `session_before_tree` events.
✓ Fork/clone guard — the Brunch extension returns `cancel: true` for Pi `session_before_fork` events.
✓ Allowed session replacement — Brunch-supported `/new` / session-start binding behavior remains covered and is not blocked by the branch guards.
✓ User-facing reason — the guard path has a stable explanatory message or notification suitable for tests and future UI copy.

### Verification Approach

- Inner: extension factory unit tests with a fake Pi extension API — validates registered hook behavior without full TUI automation.
- Middle: existing coordinator/TUI boot tests — validates Brunch's same-spec session binding path still works.

### Cross-cutting obligations

- Preserve D24-L/I19-L: Brunch-controlled runtime flows do not create or navigate Pi session branches.
- Preserve D21-L/I8-L: coordinator remains the only Brunch product seam for creating/opening bound sessions and writing `brunch.session_binding`.
- Do not expose Pi branch mechanics as a Brunch product surface or add compatibility shims for branch history.

### Promotion checklist

- [x] Does not change a requirement.
- [x] Does not create, retire, or invalidate an assumption.
- [x] Does not make or reverse a non-trivial design decision.
- [x] Does not establish a new seam-level invariant; it enforces existing I19-L.
- [x] Does not change frontier-level obligations or verification architecture.
- [x] Crosses only TUI extension hooks and coordinator binding coverage.
- [x] Containing seam and rationale are named in SPEC/PLAN.

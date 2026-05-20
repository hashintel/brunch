# Scope Cards

## walking-skeleton / M0 — workspace-session coordinator core + store-only runbook oracle

**Status:** next
**Weight:** full scope card

### Orientation

- **Containing seam:** `WorkspaceSessionCoordinator` — the boot/session seam that owns `.brunch/` resolution, spec selection state, Pi `SessionManager` setup, `brunch.session_binding`, `/new`, and chrome-state derivation.
- **Containing frontier:** `walking-skeleton` (FE-729 / `ln/fe-729-walking-skeleton`). This card is a slice inside that frontier, not a new Linear issue or branch.
- **Volatile handoff state:** no separate `HANDOFF.md` or prior `memory/CARDS.md` state exists; current truth is in `memory/SPEC.md` and `memory/PLAN.md`.
- **Main open risk:** the exact Pi session JSONL/custom-entry mechanics must be exercised against the installed `@earendil-works/pi-coding-agent`; prior design verified the seam exists, but this slice is the first production use.

### Target Behavior

A scratch cwd can be initialized into a Brunch workspace with a Pi JSONL session bound to one spec, and a store-only runbook oracle can prove the binding invariants afterward.

### Boundary Crossings

```text
→ test/CLI-facing coordinator call
→ WorkspaceSessionCoordinator
→ filesystem workspace root (.brunch/, .brunch/state.json)
→ pi SessionManager.create(cwd, ".brunch/sessions/")
→ Pi session custom entry append (brunch.session_binding)
→ store-only runbook oracle over .brunch/state.json + .brunch/sessions/*.jsonl
```

### Risks and Assumptions

- RISK: Pi's installed JSONL/custom-entry shape differs from the design-pass expectation → MITIGATION: write the runbook checker against observed JSONL shape after first real session creation; keep the checker tolerant to irrelevant Pi metadata but strict about Brunch custom-entry facts.
- RISK: implementing TUI selector/chrome in the same slice would make failures hard to localize → MITIGATION: keep this card store/coordinator-first; TUI presentation can consume the coordinator in a follow-up card.
- RISK: `.brunch/state.json` may be mistaken for canonical session binding → MITIGATION: tests and runbook assert state.json is acceleration only; each session JSONL must carry exactly one `brunch.session_binding`.
- ASSUMPTION: `SessionManager.create(cwd, ".brunch/sessions/")` and session custom-entry append are sufficient to create a project-local self-describing Pi session → VALIDATE: coordinator test creates a real scratch workspace and runbook oracle observes the session file + binding entry → memory/SPEC.md A1-L, A2-L.

### Acceptance Criteria

✓ `workspace session coordinator creates scoped state` — in a temporary cwd, invoking the coordinator creates `.brunch/`, `.brunch/state.json`, and at least one Pi JSONL session under `.brunch/sessions/`.

✓ `session binding is written once` — the created session contains exactly one `brunch.session_binding` entry with a spec id matching `.brunch/state.json`.

✓ `same-spec new session is represented without mutation` — invoking the coordinator's `/new`-equivalent path creates a second session bound to the same spec and does not add or rewrite a second binding in the first session.

✓ `chrome state is derivable without TUI rendering` — the coordinator exposes cwd / spec / phase / chat-mode state as data for later TUI chrome consumption.

✓ `store-only runbook oracle passes` — a repo-local executable checker can be pointed at the scratch cwd and verifies `.brunch/`, state, session count, exactly-one binding per checked session, and same-spec `/new` invariants.

✓ `verify gate passes` — `npm run verify` is green.

### Verification Approach

- Inner: unit/integration tests — exercise coordinator state transitions, filesystem setup, session binding creation, same-spec new-session behavior, and chrome-state derivation in temporary directories.
- Middle: runbook oracle — store-only postcondition checker over `.brunch/state.json` and `.brunch/sessions/*.jsonl`, matching SPEC §Runbook Oracle Design.
- Outer: manual TUI smoke is deferred; this slice establishes the durable state proof that the TUI slice must later pair with visual checks.

### Cross-cutting obligations

- Preserve `cwd → spec → session`; each session binds to exactly one spec and never changes specs (D11-L, I8-L).
- Only `WorkspaceSessionCoordinator` may create/open Brunch user-flow Pi sessions or write `brunch.session_binding` (D21-L).
- Do not introduce a canonical DB-backed chat/turn store or generic read-model layer while proving session state (D6-L, D18-L, D19-L, I10-L).
- Manual visual success is not enough for frontier completion; durable state claims need artifact/query postconditions (SPEC §Verification Stance, §Runbook Oracle Design).
- Keep this slice inside `walking-skeleton`; do not create a new issue/branch for the runbook oracle.

### Promotion / routing note

This is already a full scope card because it establishes the first production `WorkspaceSessionCoordinator` boundary and the first runbook oracle. No SPEC/PLAN change is required before build; the canonical decisions and frontier obligations already cover this slice.

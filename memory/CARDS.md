# Scope cards — FE-744 spec/session picker correction

Status key: `next` / `in progress` / `done` / `dropped`.

## Orientation

- **Containing seam / frontier:** `pi-ui-extension-patterns` (FE-744), specifically the Brunch-owned startup/in-session selection seam over Pi TUI extension affordances.
- **Canonical model:** SPEC D11-L / D36-L: `workspace(cwd) → spec → session`; workspace is cwd scope, not a user-created object; spec/session selection is Brunch-owned before agent loop entry.
- **Volatile state:** The current implementation still lives under `workspace-dialog` file/module names and renders a flat list with labels like “Start new session in X” / “Open X” / “Create workspace”. Those names are implementation lag, not product vocabulary.
- **Main open risk:** The TUI redesign must improve hierarchy without coupling UI components to session creation/opening; the RPC/headless path must expose equivalent activation decisions without invoking TUI picker code.
- **Cross-cutting obligations:** Preserve linear transcript policy (D24-L/I19-L), coordinator-owned activation and session binding (D21-L/I8-L/I22-L), no implicit transcript resume before explicit TUI activation (D22-L/I22-L), and RPC/headless non-TUI startup selection (D36-L/I22-L).

---

## Card 1 — Pure spec/session selection model

**Status:** next  
**Weight:** full scope card

### Target Behavior

The selection model turns workspace inventory into hierarchical spec/session stages whose top-level actions are `continue last session`, `create new spec`, `resume existing spec`, and `cancel` without listing individual specs as top-level actions.

### Boundary Crossings

```text
→ WorkspaceLaunchInventory
→ src/pi-components/workspace-dialog/model.ts selection-state/model helpers
→ WorkspaceSwitchDecision values consumed by coordinator/TUI adapters
```

### Risks and Assumptions

- RISK: Trying to rename every `workspace-*` implementation symbol in the same slice creates noisy churn. → MITIGATION: Fix product-facing labels and model shape first; leave file/module renames to a later cleanup unless they block clarity.
- RISK: The existing flat `WorkspaceDialogOption[]` shape may not express nested screens cleanly. → MITIGATION: Replace or wrap it with explicit stage/view data (`home`, `newSpecTitle`, `specList`, `specAction`, `sessionList`) while keeping `WorkspaceSwitchDecision` as the activation boundary.
- ASSUMPTION: Existing coordinator decision variants are sufficient for the new hierarchy. → VALIDATE: Model tests prove new-spec, new-session, open-session, continue, and cancel all still produce existing `WorkspaceSwitchDecision` variants.

### Acceptance Criteria

✓ `src/workspace-dialog.test.ts` — inventory with a valid selected session produces a home stage containing a continue-last option, create-new-spec, resume-existing-spec, and cancel; it does not include `resume spec X` / `open X` / per-spec labels at top level.  
✓ `src/workspace-dialog.test.ts` — selecting `resume existing spec` yields a spec-list stage populated by existing specs; selecting a spec yields a stage with `create new session` and `resume existing session`.  
✓ `src/workspace-dialog.test.ts` — selecting `resume existing session` yields a session-list stage for the chosen spec and returns `openSession` only after a session is chosen.  
✓ `src/workspace-dialog.test.ts` — selecting `create new spec` enters title-entry state and returns `newSpec` with the entered title; no session-selection step is required for this path.

### Verification Approach

- Inner: Unit tests over the pure selection model — prove hierarchy, labels, and decision mapping independent of terminal rendering.
- Middle: Architectural boundary assertion in tests — model emits decisions only; it does not call coordinator/session APIs or mutate `.brunch/state.json`.

### Cross-cutting obligations

- Keep `WorkspaceSessionCoordinator` as the only owner of activation, session creation/opening, `.brunch/state.json`, and `brunch.session_binding` writes.
- Keep `WorkspaceSwitchDecision` product-shaped and transport-neutral so TUI and RPC/headless activation can share it.
- Retire stale user-facing “workspace” wording in model labels/descriptions touched by this slice.

---

## Card 2 — Hierarchical TUI spec/session picker

**Status:** next  
**Weight:** full scope card

### Target Behavior

The startup and in-session TUI picker renders the hierarchical spec/session flow with a continue-last fast path and navigates through each stage using keyboard input.

### Boundary Crossings

```text
→ createWorkspaceDialogComponent(options)
→ selection model from Card 1
→ @earendil-works/pi-tui Component render/handleInput
→ runWorkspaceDialogPreflight / ctx.ui.custom overlay adapters
→ WorkspaceSwitchDecision callback
```

### Risks and Assumptions

- RISK: Multi-screen state can become a local UI state machine that diverges from the pure model. → MITIGATION: Keep screen/view derivation in the model module where possible; component stores only current stage, selected index, and text input.
- RISK: Scrollable spec/session lists may be more work than needed for first pass. → MITIGATION: Implement bounded visible-window scrolling only if list length exceeds available content height; otherwise keep list rendering simple but ensure selected index can move through all entries.
- RISK: Current tests assume flat-list arrow counts. → MITIGATION: Replace those tests with stage-by-stage input tests matching the new hierarchy.

### Acceptance Criteria

✓ `src/workspace-dialog.test.ts` — rendered copy says “Choose a specification” / “Create new specification” / “Resume existing specification” and does not say “Brunch workspace”, “Create workspace”, or “Open workspace” in user-facing text.  
✓ `src/workspace-dialog.test.ts` — pressing Enter on continue-last returns the existing `continue` decision when valid prior state exists.  
✓ `src/workspace-dialog.test.ts` — keyboard path `resume existing specification → choose spec → create new session` returns `newSession` for that spec.  
✓ `src/workspace-dialog.test.ts` — keyboard path `resume existing specification → choose spec → resume existing session → choose session` returns `openSession` for that session.  
✓ `src/workspace-dialog.test.ts` — escape backs out one picker stage where possible and cancels from the home stage.  
✓ `src/brunch-tui.test.ts` — startup preflight and in-session overlay still pass the same overlay width/lifecycle expectations and clear after decision.

### Verification Approach

- Inner: Component render/input tests — prove keyboard navigation, visible labels, and decision callbacks.
- Middle: Existing startup preflight lifecycle test — proves no stale overlay remains after activation.
- Outer: Manual/pty smoke after build — launch `brunch-next` in a scratch cwd with multiple specs/sessions and capture that no prior transcript renders before explicit continue/open.

### Cross-cutting obligations

- Preserve the startup invariant: no prior transcript or agent loop before explicit activation.
- Preserve shared startup/in-session component reuse; adapters may differ only in terminal lifecycle and Pi session replacement mechanics.
- Keep copy aligned to SPEC lexicon: workspace = cwd label only; spec/session are the user choices.

---

## Card 3 — RPC/headless initial selection contract

**Status:** next  
**Weight:** full scope card

### Target Behavior

RPC mode exposes initial spec/session selection as structured JSON-RPC state and activation methods without constructing or invoking the TUI picker.

### Boundary Crossings

```text
→ brunch --mode rpc / createRpcHandlers
→ WorkspaceSwitchCoordinator.inspectWorkspace / activateWorkspace
→ JSON-RPC method family
→ product-shaped selection/inventory and activation responses
```

### Risks and Assumptions

- RISK: Reusing `workspace.snapshot` for activation would blur read vs mutation behavior. → MITIGATION: Add explicit method names, e.g. `workspace.selectionState` for inventory/requirements and `workspace.activate` for submitting a `WorkspaceSwitchDecision`.
- RISK: JSON-RPC params may accidentally accept impossible decision shapes. → MITIGATION: Add narrow runtime parsing for `continue`, `openSession`, `newSession`, `newSpec`, and `cancel` decisions; invalid params return `-32602`.
- RISK: Activation can return a ready state containing non-serializable `SessionManager`. → MITIGATION: Return a serializable snapshot/activation DTO derived from `WorkspaceActivationState`, not the raw state object.

### Acceptance Criteria

✓ `src/rpc.test.ts` — `workspace.selectionState` returns cwd, current spec/session acceleration, specs/sessions inventory, unavailable sessions, and a `requiresSelection`/status field when no ready default exists.  
✓ `src/rpc.test.ts` — `workspace.activate` accepts `newSpec`, `newSession`, `openSession`, `continue`, and `cancel` decision params and delegates to `coordinator.activateWorkspace` without importing or constructing the TUI picker/component.  
✓ `src/rpc.test.ts` — successful activation returns a serializable product snapshot including selected spec/session ids and status; needs-human/cancelled activation returns structured reason/status without switching sessions.  
✓ `src/rpc.test.ts` — invalid activation params return JSON-RPC `-32602` and unknown methods still return `-32601`.

### Verification Approach

- Inner: JSON-RPC handler contract tests — prove method names, param validation, coordinator delegation, and serializable responses.
- Middle: Architectural import/boundary test or source assertion — RPC module does not import `pi-components/workspace-dialog` or TUI picker code.

### Cross-cutting obligations

- RPC/headless must not invoke TUI picker code; it exposes the same product selection requirement and activation decisions through JSON-RPC.
- Keep transport modes distinct from product state: RPC connections are client attachments, not sessions.
- Keep coordinator as the only activation/session-binding writer.

---

## Card 4 — Terminology cleanup and compatibility retirement

**Status:** next  
**Weight:** light scope card

### Objective

Remove stale user-facing “workspace dialog/switcher” terminology from tests, descriptions, commands, and documentation-adjacent strings touched by the picker work while preserving stable internal APIs unless renaming is cheap.

### Acceptance Criteria

✓ User-facing command/shortcut descriptions say “Open the Brunch spec/session picker” or equivalent, not “workspace dialog”.  
✓ Tests assert the new lexicon for visible UI text and no longer expect “Create workspace” / “Brunch workspace”.  
✓ Any implementation names left as `workspace-dialog` are either private/file-path compatibility or explicitly deferred; no product copy depends on them.

### Verification Approach

- Inner: `rg` checks plus existing unit tests.
- Middle: Manual screenshot/smoke review for startup and Ctrl-Shift-B copy.

### Cross-cutting obligations

- Do not rename public/product decision variants purely for aesthetics if doing so would create avoidable churn for coordinator/RPC clients.
- Delete obsolete copy/tests rather than preserving aliases for old “workspace” wording.

### Promotion checklist

- [ ] Does this change a requirement? No — SPEC already changed; this card implements terminology cleanup.
- [ ] Does this create, retire, or invalidate an assumption? No.
- [ ] Does this make or reverse a non-trivial design decision? No.
- [ ] Does this establish a new seam-level invariant? No.
- [ ] Does this change a frontier-level cross-cutting obligation or verification architecture layer? No.
- [ ] Does it cross more than two major seams? No, if kept to user-facing strings/tests.
- [ ] Is this the first touch in an unfamiliar seam from a fresh thread? No.
- [ ] Can you not name the containing seam or current rationale from the live docs? No.

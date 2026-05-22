# FE-744 Scope Cards — Workspace switcher / startup flow

## Orientation

- Containing seam: Brunch TUI/workspace-session boot seam over Pi `SessionManager` and `InteractiveMode`; the coordinator owns spec/session effects, while UI/adapters return product decisions.
- Frontier item: `pi-ui-extension-patterns` / FE-744 on `ln/fe-744-pi-ui-extension-patterns`; these are slices within the existing frontier, not new Linear issues or branches.
- Volatile state from `HANDOFF.md`: `memory/SPEC.md` now persists D21-L/D22-L/D35-L/D36-L/I22-L; dirty `src/brunch-tui.ts` and `src/brunch-tui.test.ts` suppress generic Pi startup noise but do not solve implicit stale transcript resume.
- Main open risk: Pi session inspection may tempt activation/binding as a side effect; keep inventory/read-model code separate from activation, and prove no prior transcript reaches Pi before explicit resume/open.

Frontier-level obligations every card must preserve:

- Preserve workspace hierarchy and startup invariant: `.brunch/state.json` is default acceleration, not an implicit resume instruction; no prior transcript or agent loop before explicit workspace-switch activation (R19 / D11-L / D21-L / D22-L / D36-L / I22-L).
- Preserve the linear transcript policy: no Pi branch creation/navigation as Brunch product behavior, and no transcript flattening to hide branch shape (D24-L / I19-L).
- Keep UI and adapters out of session mutation: only `WorkspaceSessionCoordinator` may create/open Brunch Pi sessions, write `.brunch/state.json`, or write `brunch.session_binding` (D21-L / D36-L).
- Keep chrome product-shaped: when a real session is activated, downstream chrome receives the activated session id rather than fabricating `unbound` (D35-L).

---

## Card 1 — Workspace launch inventory

- **Status:** done
- **Weight:** full scope card
- **Frontier:** `pi-ui-extension-patterns` / FE-744

### Target Behavior

The coordinator can report launch inventory for existing Brunch specs/sessions without activating a session.

### Boundary Crossings

```text
→ caller asks WorkspaceSessionCoordinator.inspectWorkspace()
→ .brunch/state.json default-state reader
→ .brunch/sessions/*.jsonl binding/header/message scanner
→ WorkspaceLaunchInventory read model
```

### Risks and Assumptions

- RISK: Inventory scanning accidentally calls existing bind/open helpers and rewrites JSONL/state. → MITIGATION: implement a read-only scanner path and assert file counts/content mtimes or source boundaries in tests.
- RISK: Current spec state is not enough to enumerate historical specs. → MITIGATION: reconstruct spec candidates from `brunch.session_binding` entries and treat state-only current spec as a candidate with zero/unknown sessions.
- RISK: Session labels become a premature UX taxonomy. → MITIGATION: expose minimal stable fields first (`sessionId`, `file`, `spec`, optional `name`/first-message preview/timestamps) and keep rich label formatting in the switcher model.
- ASSUMPTION: Existing linear JSONL headers plus `brunch.session_binding` entries are sufficient for launch inventory. → VALIDATE: inventory tests with current/default session, multiple sessions, missing state, and incompatible bindings. → memory/SPEC.md A1-L, D6-L, D21-L, D36-L

### Acceptance Criteria

✓ `workspace-session-coordinator.test.ts` — `inspectWorkspace()` returns cwd, current spec/session defaults, bound specs, and bound sessions for a seeded `.brunch/state.json` plus multiple JSONL sessions.

✓ `workspace-session-coordinator.test.ts` — `inspectWorkspace()` on an empty workspace returns an inventory requiring new-spec creation without creating `.brunch/sessions/*.jsonl`.

✓ `workspace-session-coordinator.test.ts` — `inspectWorkspace()` marks unbound or incompatible JSONL sessions unavailable instead of binding, rewriting, or silently selecting them.

✓ Boundary/source test — inventory code does not call `bindSessionToSpec`, `appendCustomEntry`, `SessionManager.create`, or `writeCurrentWorkspaceState`.

### Verification Approach

- Inner: unit + boundary tests — prove the read model shape and read-only behavior.
- Middle: store oracle — compare before/after `.brunch/state.json` and session JSONL content for no activation writes.

### Cross-cutting obligations

- Inventory is not activation; it must not mutate `.brunch/state.json`, create sessions, or write `brunch.session_binding`.
- Inventory must preserve Brunch-supported linear-session assumptions and surface invalid sessions honestly.
- Inventory types should be Brunch-owned; Pi types should be imported/projected only where Pi owns the envelope (`SessionHeader`, `CustomEntry`, `SessionInfo`) per `docs/praxis/pi-types.md`.

---

## Card 2 — Workspace decision activation

- **Status:** done
- **Weight:** full scope card
- **Frontier:** `pi-ui-extension-patterns` / FE-744

### Target Behavior

The coordinator can turn an explicit workspace decision into the resulting ready or cancelled workspace state.

### Boundary Crossings

```text
→ WorkspaceSwitchDecision from UI/adapter
→ WorkspaceSessionCoordinator.activateWorkspace(decision)
→ session binding/state validation
→ SessionManager.open/create through coordinator-owned helpers
→ .brunch/state.json + binding-only JSONL persistence
→ WorkspaceSessionReadyState or cancellation result
```

### Risks and Assumptions

- RISK: `continue` reintroduces implicit resume semantics. → MITIGATION: only call activation after a caller supplies an explicit `continue` or `openSession` decision; keep `openExisting()` from being the TUI startup path after Card 4.
- RISK: Cancel/quit return shape leaks into durable architecture. → MITIGATION: keep cancellation a small adapter-facing product result with no persistent state mutation; update SPEC only if semantics exceed D36-L.
- RISK: Opening a selected session with stale/mismatched binding corrupts current state. → MITIGATION: validate selected file binding against the decision spec before writing `.brunch/state.json`.
- ASSUMPTION: Existing binding flush helper remains sufficient for newly-created binding-only sessions. → VALIDATE: reload newly-created sessions with `SessionManager.open` and `verifyWorkspaceSessionStores()`. → memory/SPEC.md D21-L, I8-L

### Acceptance Criteria

✓ `workspace-session-coordinator.test.ts` — activating `{ action: "openSession" }` or `{ action: "continue" }` opens the selected bound session, writes it as the current workspace default, and returns `WorkspaceSessionReadyState` with the real session id.

✓ `workspace-session-coordinator.test.ts` — activating `{ action: "newSession" }` creates a binding-only session for the selected spec, writes it as current, and preserves all existing sessions.

✓ `workspace-session-coordinator.test.ts` — activating `{ action: "newSpec" }` creates a new spec plus binding-only session and makes that pair current.

✓ `workspace-session-coordinator.test.ts` — activating `{ action: "cancel" }` returns a non-ready cancellation result and leaves `.brunch/state.json` plus session files unchanged.

✓ `workspace-session-coordinator.test.ts` — activating a mismatched or unavailable session fails with a structured `needs_human`/error result rather than rebinding it.

### Verification Approach

- Inner: coordinator contract tests — prove each decision discriminant and returned state shape.
- Middle: store oracle — prove state JSON and session binding postconditions after each activation path.
- Middle: reload round-trip — prove binding-only sessions reopen without duplicate headers/bindings.

### Cross-cutting obligations

- Activation is the only place this queue may create/open Brunch Pi sessions or write bindings/state.
- New-session activation must land in a binding-only session for the selected spec; no assistant/user transcript entries are required.
- Returned ready state must carry enough product state for chrome to render the real session id in later cards.

---

## Card 3 — Workspace switcher decision UI

- **Status:** done
- **Weight:** full scope card
- **Frontier:** `pi-ui-extension-patterns` / FE-744

### Target Behavior

The workspace switcher UI can turn launch inventory into a typed workspace decision with no workspace side effects.

### Boundary Crossings

```text
→ WorkspaceLaunchInventory
→ workspace-switcher option/label model
→ pi-tui selection/input component or testable component factory
→ WorkspaceSwitchDecision
```

### Risks and Assumptions

- RISK: UI imports the coordinator and becomes a hidden mutation path. → MITIGATION: keep `workspace-switcher/*` dependent only on inventory/decision types and `@earendil-works/pi-tui`; add a source/boundary test.
- RISK: First-screen choices overfit current fixture data. → MITIGATION: start with stable actions only: continue current session when available, start new session in a spec, choose/open another session, create spec, cancel/quit.
- RISK: Direct `@earendil-works/pi-tui` usage remains transitive. → MITIGATION: add `@earendil-works/pi-tui` as a direct dependency when importing it.
- ASSUMPTION: Pi `SelectList`/`Input` components are sufficient for the first switcher surface. → VALIDATE: component tests or a minimal render/input harness for up/down/enter/escape/name entry. → memory/SPEC.md D22-L, D36-L, A10-L

### Acceptance Criteria

✓ `workspace-switcher.test.ts` — option construction from inventory prioritizes explicit resume/new-session/create-spec/cancel choices without inventing a default exhaustive lens/menu surface.

✓ `workspace-switcher.test.ts` — selecting an existing session returns `{ action: "openSession", specId, sessionFile }` and selecting current resume returns an explicit continue/open decision.

✓ `workspace-switcher.test.ts` — selecting create-spec plus title entry returns `{ action: "newSpec", title }`; escape/cancel returns `{ action: "cancel" }`.

✓ Boundary/source test — `workspace-switcher/*` does not import `SessionManager`, `WorkspaceSessionCoordinator`, or session-binding write helpers.

✓ Dependency check — if the component imports `@earendil-works/pi-tui`, `package.json` declares it directly.

### Verification Approach

- Inner: pure model tests — prove inventory-to-option and option-to-decision mappings.
- Inner: component input tests — prove enter/escape/navigation/name entry where feasible without a full terminal.
- Middle: boundary/source test — prove UI cannot mutate workspace/session state directly.

### Cross-cutting obligations

- Switcher UI returns decisions only; coordinator activation owns all effects.
- Continue/resume must be an explicit selectable decision, not an automatic consequence of `.brunch/state.json`.
- Keep line widths bounded in custom components; use `truncateToWidth`/`SelectList` patterns from Pi TUI docs.

---

## Card 4 — Pre-Pi startup gate

- **Status:** next
- **Weight:** full scope card
- **Frontier:** `pi-ui-extension-patterns` / FE-744

### Target Behavior

TUI mode starts Pi `InteractiveMode` only after a workspace switch decision has been activated.

### Boundary Crossings

```text
→ runBrunchTui()
→ coordinator.inspectWorkspace()
→ runWorkspaceSwitchPreflight(inventory)
→ coordinator.activateWorkspace(decision)
→ launchPiInteractive({ workspace, coordinator })
→ Pi InteractiveMode.run()
```

### Risks and Assumptions

- RISK: Existing `openExisting()` call path remains reachable from TUI startup and still renders stale transcript. → MITIGATION: replace TUI boot with inspect → decision → activate; keep `openExisting()` only for print/RPC/headless paths that intentionally project defaults.
- RISK: Pre-Pi TUI lifecycle leaves terminal state dirty before Pi starts. → MITIGATION: isolate terminal lifecycle in `runWorkspaceSwitchPreflight()` and add manual/pty runbook coverage after unit tests land.
- RISK: Dirty Pi startup-noise suppression gets confused with the startup fix. → MITIGATION: keep suppression as product-shell hardening in this adapter, but acceptance must prove no transcript launch before decision independently.
- ASSUMPTION: Injected preflight runner is enough to prove boot ordering before a full pty oracle is added. → VALIDATE: unit test with stale transcript seed and launch spy, then follow with pty/ANSI runbook before tying off FE-744. → memory/SPEC.md I22-L

### Acceptance Criteria

✓ `brunch-tui.test.ts` — `runBrunchTui()` calls inspect/preflight/activate before `launchInteractive`, and `launchInteractive` receives the activated ready workspace.

✓ `brunch-tui.test.ts` — with an existing current session containing transcript entries, TUI startup does not call `launchInteractive` when the preflight returns cancel.

✓ `brunch-tui.test.ts` — with an existing current session containing transcript entries, choosing `newSession` launches a different binding-only session for the same spec.

✓ `brunch-tui.test.ts` — chrome setup receives activated chrome/session state sufficient to render the real session id, not `unbound`.

✓ Existing startup suppression test still passes or is replaced by an equivalent product-shell assertion for quiet Pi resources and `PI_OFFLINE`.

### Verification Approach

- Inner: TUI boot unit tests with injected coordinator/preflight/launcher spies — prove ordering and no implicit resume.
- Middle: store oracle after new-session decision — prove binding-only session and preserved prior transcript.
- Middle: pty/ANSI-stripped runbook follow-up — prove prior transcript text is absent before explicit resume/open in an actual TUI launch.

### Cross-cutting obligations

- Do not start `InteractiveMode` before decision activation.
- Do not delete or mutate prior transcript when the user chooses a new session.
- Keep generic Pi resource/update suppression separate from the workspace-switch invariant; suppression reduces shell noise but does not prove I22-L.

---

## Not queued yet

- Product-shell metadata hardening: fold/review the dirty startup-noise suppression, reduce duplicated header/widget/footer/status facts, and decide permanent `PI_OFFLINE` semantics after Card 4 proves the startup gate.
- In-session workspace switcher command: reuse the same decision UI through Pi `ctx.ui.custom()` plus `waitForIdle`/session replacement; scope after the pre-Pi path proves the reusable decision model.

# FE-744 Scope Cards — Brunch Pi extension shell follow-through

## Orientation

- Containing seam: Brunch TUI/workspace-session boot plus the internal Pi extension shell under `src/pi-extensions/brunch/`; the TUI host orchestrates pre-Pi activation, while the extension owns Pi event/command/UI registration.
- Frontier item: `pi-ui-extension-patterns` / FE-744 on `ln/fe-744-pi-ui-extension-patterns`; these are slices inside the existing frontier, not new Linear issues or branches.
- Current state: workspace inventory/activation, pure switcher UI, pre-Pi startup gate, coordinator interface cleanup, active-session chrome, and initial extension/workspace-switcher module extraction are committed; `HANDOFF.md` is the only untracked file and is stale once these cards land.
- Main risk: product-shell hardening must not become cosmetic rearrangement; each slice should clarify which Pi UI surface owns which Brunch fact and keep all session mutation behind coordinator activation.

Pi extension patterns to preserve from the reviewed examples:

- Extension entrypoints are thin and event-shaped: `index.ts` registers `pi.on(...)`, commands, tools, or UI hooks; private helpers own formatting/state details.
- Use the lightest Pi UI surface: `setStatus` for compact persistent facts, `setWidget` for multi-line contextual facts, `setHeader` for product identity, `setFooter` only when intentionally replacing Pi's footer, `setTitle` for terminal title/working signal.
- `ctx.ui.custom()` components should return typed product data; they should not perform workspace/session effects.
- Any timer or session-bound UI state must clean up on `session_shutdown`.

Frontier-level obligations every card must preserve:

- Preserve workspace hierarchy and startup invariant: `.brunch/state.json` is default acceleration, not an implicit resume instruction; no prior transcript or agent loop before explicit workspace-switch activation (R19 / D11-L / D21-L / D22-L / D36-L / I22-L).
- Preserve linear transcript policy: no Pi branch creation/navigation as Brunch product behavior; branch effects remain blocked and transcript readers fail fast on non-linear JSONL (D24-L / I19-L).
- Keep UI/adapters out of session mutation: only `WorkspaceSessionCoordinator` activates decisions, creates/opens Brunch Pi sessions, writes `.brunch/state.json`, or writes `brunch.session_binding` (D21-L / D36-L).
- Keep Brunch chrome product-shaped and activated-session-shaped: no fabricated `unbound` session ids (D35-L).

---

## Card 1 — Split the Brunch Pi extension by Pi surface

- **Status:** done
- **Weight:** full scope card
- **Frontier:** `pi-ui-extension-patterns` / FE-744

### Target Behavior

The Brunch Pi extension entrypoint registers extension behavior through surface-specific private modules.

### Boundary Crossings

```text
→ launchPiInteractive() supplies createBrunchExtension(...) as an ExtensionFactory
→ src/pi-extensions/brunch/index.ts wires Pi events
→ chrome/session-binding/branch-policy private modules own their surface logic
→ Pi ExtensionAPI receives the same registered handlers as before
```

### Risks and Assumptions

- RISK: This becomes file shuffling without deleting complexity. → MITIGATION: keep `index.ts` as a thin registration map and move behavior to modules named by Pi surface/responsibility, not generic `utils`.
- RISK: Tests keep importing through `brunch-tui.ts`, hiding extension boundaries. → MITIGATION: test extension formatting/registration through `src/pi-extensions/brunch` exports where possible; leave `brunch-tui` tests for launch orchestration.
- RISK: Splitting modules accidentally changes handler order. → MITIGATION: preserve current registration order: session binding/chrome on `session_start`, binding refresh on pre-agent/assistant start, branch policy cancellation hooks.
- ASSUMPTION: One internal Brunch extension remains the right public factory; separate exported Pi extensions are not needed yet. → VALIDATE: `brunchResourceLoaderOptions()` still receives one Brunch factory and existing behavior tests pass. → memory/SPEC.md D22-L, D35-L

### Acceptance Criteria

✓ `pi-extensions/brunch` structure — `index.ts` is a thin entrypoint that composes private surface modules; chrome formatting/rendering, branch policy, and session-boundary binding are no longer all implemented in `index.ts`.

✓ Extension behavior tests — existing chrome rendering, branch-flow cancellation, and session-boundary binding tests still pass through the exported Brunch extension factory.

✓ TUI host tests — `brunch-tui.ts` still proves inspect → decision → activate → launch ordering, resource suppression, and explicit extension factory wiring without owning extension handler internals.

✓ `npm run verify` — full gate passes after the extraction.

### Verification Approach

- Inner: refactor-preservation tests — existing extension behavior tests continue to prove the same UI calls and cancellation return values.
- Inner: module-boundary compile check — the TUI host imports only the public Brunch extension factory/state helper, not private surface modules.

### Cross-cutting obligations

- Do not use Pi auto-discovery; Brunch still passes explicit `extensionFactories` while `noExtensions: true` remains set.
- Do not add product behavior in this card; it is structural extraction only.
- Preserve replacement-session binding before rendering chrome on `session_start`.

---

## Card 2 — Product-shell chrome surface allocation

- **Status:** done
- **Weight:** light scope card
- **Frontier:** `pi-ui-extension-patterns` / FE-744

### Objective

Brunch chrome renders each persistent shell fact on one deliberate Pi UI surface instead of repeating metadata across header, widget, status, and footer.

### Acceptance Criteria

✓ Chrome formatting tests — header contains product identity plus active spec/session; status contains compact phase/coherence/need summary; widget contains only expanded diagnostic facts; footer is either restored to Pi default or has a narrowly justified Brunch-only purpose.

✓ Title tests — terminal title remains Brunch-owned and compact, derived from activated workspace state.

✓ Existing RPC degradation expectations remain true — tests assert only status/widget/title/notify as RPC-visible surfaces; header/footer/working indicator stay TUI-only assumptions.

✓ Product-shell noise suppression still holds — quiet startup settings, disabled Pi resource categories, and `PI_OFFLINE` default remain covered.

### Verification Approach

- Inner: formatting/unit tests for each chrome surface.
- Inner: extension UI call tests proving the intended `setHeader` / `setStatus` / `setWidget` / `setTitle` calls and absence or deliberate use of `setFooter`.
- Middle: existing RPC/chrome expectations — no new fixture should rely on TUI-only header/footer events.

### Cross-cutting obligations

- Preserve active-session chrome: no `unbound` fallback.
- Keep Brunch product wrappers as the only downstream API; do not scatter raw `ctx.ui.*` calls outside the Brunch extension surface modules.
- Follow Pi example posture: use `setFooter` only when replacing the whole footer is intentionally the feature; otherwise prefer status/widget/title.

### Promotion checklist

- [ ] Does this change a requirement? No.
- [ ] Does this create, retire, or invalidate an assumption? No.
- [ ] Does this make or reverse a non-trivial design decision? No; it applies D35-L.
- [ ] Does this establish a new seam-level invariant? No.
- [ ] Does this change a frontier-level cross-cutting obligation or verification architecture layer? No.
- [ ] Does it cross more than two major seams? No.
- [ ] Is this the first touch in an unfamiliar seam from a fresh thread? No.
- [ ] Can you not name the containing seam or current rationale from the live docs? No.

---

## Card 3 — In-session workspace switcher command

- **Status:** done
- **Weight:** full scope card
- **Frontier:** `pi-ui-extension-patterns` / FE-744

### Target Behavior

A Brunch-owned slash command opens the reusable workspace switcher inside an active Pi session and switches to the activated workspace decision.

### Boundary Crossings

```text
→ Brunch extension registers a product command
→ command handler waits for idle
→ coordinator.inspectWorkspace()
→ ctx.ui.custom(...) renders workspace-switcher component as a typed decision UI
→ coordinator.activateWorkspace(decision)
→ ctx.switchSession(activated.session.file, { withSession }) replaces the Pi session
→ fresh replacement-session context renders Brunch chrome/notification
```

### Risks and Assumptions

- RISK: Old command context/session objects are used after `ctx.switchSession()`. → MITIGATION: follow Pi docs; after replacement, use only the `withSession` context and plain data captured before switching.
- RISK: Command handler bypasses coordinator activation for new-session/new-spec decisions. → MITIGATION: all decisions go through `activateWorkspace()` first; Pi `switchSession()` only attaches the already-activated file to the current runtime.
- RISK: Command name collides with Pi built-ins or implies strict built-in suppression. → MITIGATION: use a Brunch-owned non-conflicting command name and keep command-containment docs honest.
- RISK: Switching to the currently active session causes unnecessary shutdown/rebind. → MITIGATION: either no-op with a notification when activated file equals current file, or prove `switchSession` handles it safely.
- ASSUMPTION: A coordinator-created binding-only session can be attached via `ctx.switchSession()` without needing Pi `ctx.newSession()`. → VALIDATE: unit/fake command tests and, if feasible, a small integration harness using a real coordinator-created session file. → memory/SPEC.md D21-L, D36-L, I8-L

### Acceptance Criteria

✓ Brunch extension command registration test — the exported extension registers a non-conflicting Brunch workspace command with a clear description.

✓ Command handler test — command calls `waitForIdle()`, obtains inventory, renders the switcher through `ctx.ui.custom()`, activates the returned decision through the coordinator, and switches to the activated session file.

✓ Replacement context test — post-switch notification/chrome update uses only the `withSession` context, not stale pre-switch `ctx` session-bound objects.

✓ Cancel/needs-human tests — cancel leaves the current session untouched; `needs_human` reports a warning/error and does not switch.

✓ Store oracle — new-session/new-spec command decisions produce coordinator-owned binding/state effects before Pi runtime switches.

### Verification Approach

- Inner: command registration/handler tests with fake ExtensionCommandContext — prove ordering, cancellation, and no stale-context use.
- Middle: coordinator store oracle — prove activated target session binding and current workspace state.
- Outer: manual TUI walkthrough later — invoke the command, switch sessions, confirm chrome/session id changes.

### Cross-cutting obligations

- Workspace switcher UI remains pure decision UI; no session mutation in the component.
- Coordinator remains the only owner of activation effects.
- After Pi session replacement, use only `withSession` context for session-bound UI/notifications.
- Do not claim or attempt built-in `/resume` or `/new` override; this is a product command alongside residual Pi built-ins.

---

## Card 4 — Startup pty oracle for no implicit transcript resume

- **Status:** done
- **Weight:** full scope card
- **Frontier:** `pi-ui-extension-patterns` / FE-744

### Target Behavior

An executable startup oracle proves Brunch TUI startup does not render a prior transcript before an explicit workspace-switch decision.

### Boundary Crossings

```text
→ seeded scratch cwd with current session containing unique transcript text
→ Brunch TUI launch under a pty/script harness
→ ANSI-stripped startup capture before resume/open activation
→ oracle assertion on captured text and store state
```

### Risks and Assumptions

- RISK: TUI/pty testing is flaky in CI-like environments. → MITIGATION: make the oracle a runbook/checker script or targeted test that can be run manually, with deterministic seed text and ANSI stripping; do not block normal unit tests if terminal prerequisites are absent unless the project already supports it.
- RISK: The harness accidentally chooses resume and invalidates the claim. → MITIGATION: capture the initial switcher screen before sending any activation keystroke, then separately exercise new-session if automated input is reliable.
- RISK: This becomes only a screenshot test. → MITIGATION: pair terminal capture with store assertions: old transcript file preserved, new binding-only session when new-session path is exercised.
- ASSUMPTION: Existing source launch can be driven through `tsx`/built CLI in a pty enough to capture first paint. → VALIDATE: run locally and document command/output in the runbook or test fixture. → memory/SPEC.md I22-L

### Acceptance Criteria

✓ Runbook/checker exists — a documented command seeds a workspace with unique stale transcript text and captures Brunch TUI startup output with ANSI stripped.

✓ No-stale-transcript assertion — captured startup output before explicit resume/open does not contain the unique stale transcript text.

✓ Switcher-visible assertion — captured startup output contains Brunch workspace-switcher text or a stable product startup marker.

✓ Optional new-session assertion when automated input is reliable — choosing new session creates a new binding-only session and preserves the stale transcript file unchanged.

### Verification Approach

- Middle: runbook oracle — combines terminal capture and executable text/store postconditions.
- Inner: any helper functions for ANSI stripping/seed setup get unit tests if introduced.
- Outer: manual walkthrough can reuse the same runbook for qualitative startup feel.

### Cross-cutting obligations

- This card proves I22-L at the user-facing boundary; it should not change product behavior unless the oracle exposes a real bug.
- Keep fixture/test artifacts out of the repo unless intentionally checked in as runbook scripts.

---

## Card 5 — FE-744 affordance memo reconciliation

- **Status:** queued
- **Weight:** light scope card
- **Frontier:** `pi-ui-extension-patterns` / FE-744

### Objective

The Pi UI extension patterns memo reflects the Brunch implementation and the relevant Pi example patterns for chrome, typed custom UI, command shutdown, structured output, and title/status surfaces.

### Acceptance Criteria

✓ `docs/architecture/pi-ui-extension-patterns.md` records Brunch's internal extension layout and current implementation evidence for header/status/widget/title/footer choices.

✓ The memo distinguishes implemented Brunch surfaces from source/example-derived Pi affordance evidence: `question`/`questionnaire` typed UI, `shutdown-command`, `structured-output`, `titlebar-spinner`, `custom-header`, `custom-footer`, `status-line`, and `border-status-editor`.

✓ The memo records remaining FE-744 gaps honestly: residual built-in command exposure, keybinding policy, manual startup pty oracle status, and whether in-session switcher command is implemented.

✓ No SPEC/PLAN durable semantics change unless implementation revealed a new decision; otherwise this is evidence reconciliation only.

### Verification Approach

- Inner: doc review against current code paths and the reviewed Pi examples.
- Middle: traceability check — memo claims match implemented tests/runbook evidence and do not overclaim strict Pi built-in suppression.

### Cross-cutting obligations

- Keep FE-744 evidence tiered: Brunch-host proof, Pi source/example evidence, RPC controllability, and manual runbook evidence are not interchangeable.
- Do not let source/example evidence masquerade as Brunch integration proof.

### Promotion checklist

- [ ] Does this change a requirement? No.
- [ ] Does this create, retire, or invalidate an assumption? No.
- [ ] Does this make or reverse a non-trivial design decision? No.
- [ ] Does this establish a new seam-level invariant? No.
- [ ] Does this change a frontier-level cross-cutting obligation or verification architecture layer? No.
- [ ] Does it cross more than two major seams? No.
- [ ] Is this the first touch in an unfamiliar seam from a fresh thread? No.
- [ ] Can you not name the containing seam or current rationale from the live docs? No.

---

## Done / retired context

The earlier workspace-switcher and extension-organization refactor queues are exhausted and intentionally not repeated here. `HANDOFF.md` should be deleted once these cards are underway or once a newer handoff supersedes it; its startup diagnosis has been absorbed into SPEC/PLAN/code/cards.

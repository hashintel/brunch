# Scope Cards — sealed-pi-profile-runtime-state

## Orientation

- **Containing frontier:** `sealed-pi-profile-runtime-state` in `memory/PLAN.md`; this is one frontier/Linear/branch boundary, with multiple commit-sized port/migration slices queued here.
- **Containing seam:** Brunch-owned Pi wrapper: extension factories, command/tool policy, TUI components, chrome, autocomplete, transcript UI primitives, and resource isolation from ambient `.pi/`.
- **Volatile state:** The `.pi/extensions/*` and `.pi/components/*` files are probe/test artifacts whose useful behavior should be ported into product `src/` modules, then retired so Brunch runtime no longer depends on project-local Pi discovery.
- **Main open risk:** The `/brunch` menu is intentionally only a shell in this queue; deeper settings/config IA still needs grilling, so this queue scopes only a combined menu entry that preserves current workspace-switch behavior and leaves obvious extension points.

## Frontier-level obligations

- Preserve the sealed-profile posture: Brunch product behavior comes from programmatic extension factories and profile policy, not ambient `.pi/` discovery.
- Keep product modules flat: `src/pi-extensions/{extension}.ts`, aggregate `src/pi-extensions.ts`, and reusable TUI components under `src/pi-components/{component}.ts`.
- Retire duplicate/stale `.pi/` probe code once its behavior is ported; do not leave parallel extension implementations masquerading as live product truth.
- Preserve current Brunch session invariants while moving files: one spec per session, linear transcript policy, branch/fork/tree blocking, and coordinator-owned workspace activation.
- Keep demo/probe affordances out of production defaults: demo card commands and fixture tag JSON should not ship as product behavior.

---

## Card 1 — Flatten the existing product extension shell

**Status:** done
**Weight:** full scope card

### Target Behavior

The existing Brunch Pi extension shell is imported from flat `src/pi-extensions.ts` and flat `src/pi-extensions/*.ts` modules with no remaining runtime imports from `src/pi-extensions/brunch/*`.

### Boundary Crossings

```text
→ src/brunch-tui.ts extension factory wiring
→ src/pi-extensions.ts aggregate factory
→ flat extension modules (command-policy, session-lifecycle, chrome, settings-switcher-menu)
→ existing tests/importers
```

### Risks and Assumptions

- RISK: Rename-only movement can accidentally change behavior or break public test exports → MITIGATION: preserve current exported names where useful from `src/pi-extensions.ts`, update tests mechanically, and run focused TUI/extension tests.
- ASSUMPTION: A flat aggregate file is enough; no directory index is needed → VALIDATE: all current imports compile and no import path still references `src/pi-extensions/brunch`.

### Acceptance Criteria

✓ `src/pi-extensions.ts` exports `createBrunchPiExtensionShell` plus existing test-facing symbols.
✓ `src/pi-extensions/command-policy.ts` contains the current branch/tree/fork blocking behavior from `branch-policy.ts`.
✓ `src/pi-extensions/session-lifecycle.ts` contains the current session-boundary binding behavior from `session-boundary.ts`.
✓ `src/pi-extensions/settings-switcher-menu.ts` initially contains the current workspace command behavior from `workspace-command.ts`, even if the command name changes in a later card.
✓ No runtime or test import references `src/pi-extensions/brunch/*`.

### Verification Approach

- Inner: `npm run fix`; targeted tests for `brunch-tui` / workspace command imports.
- Middle: `rg "pi-extensions/brunch|./pi-extensions/brunch|../pi-extensions/brunch" src` returns no live imports.

### Cross-cutting obligations

- This card is structural movement only; do not change `/brunch-workspace` semantics yet.
- Preserve branch/session effect blocking exactly while renaming the module to command policy.

---

## Card 2 — Move reusable Pi TUI components under `src/pi-components`

**Status:** done
**Weight:** full scope card

### Target Behavior

Reusable Pi TUI components live under `src/pi-components`, including the workspace switcher and cards component library, with importers updated to consume the new component location.

### Boundary Crossings

```text
→ src/workspace-switcher/*
→ src/pi-components/workspace-switcher.ts or workspace-switcher/*
→ .pi/components/cards.ts
→ src/pi-components/cards.ts
→ extension/component tests and package scripts
```

### Risks and Assumptions

- RISK: Collapsing `workspace-switcher/*` too aggressively could make tests less clear → MITIGATION: preserve a small public component/preflight entrypoint under `src/pi-components/workspace-switcher.ts` or `src/pi-components/workspace-switcher/index.ts` if needed; prefer clarity over one-file compression.
- ASSUMPTION: `cards.ts` has no product dependency on `.pi/` placement → VALIDATE: it imports only Pi TUI/theme primitives and works from `src/pi-components/cards.ts`.

### Acceptance Criteria

✓ `createWorkspaceSwitchComponent` and `runWorkspaceSwitchPreflight` are imported from `src/pi-components` paths, not `src/workspace-switcher`.
✓ `CardComponent`, `ResponsiveColumns`, and `chunk` are available from `src/pi-components/cards.ts`.
✓ Existing workspace-switcher behavior and tests still pass after the move.
✓ Package lint/format scripts no longer need `.pi/components` to cover product component code.

### Verification Approach

- Inner: `npm run fix`; workspace-switcher tests.
- Middle: `rg "workspace-switcher|\.pi/components" src package.json` shows only intentional compatibility exports if any.

### Cross-cutting obligations

- Keep Pi-specific TUI widgets out of general product/domain folders.
- Do not change workspace activation semantics; component move only.

---

## Card 3 — Replace `/brunch-workspace` with the Brunch menu shell

**Status:** done
**Weight:** full scope card

### Target Behavior

`/brunch` and `ctrl+shift+b` open a Brunch menu shell that can launch the existing workspace/session switch flow, replacing `/brunch-workspace` as the primary product command.

### Boundary Crossings

```text
→ src/pi-extensions/settings-switcher-menu.ts
→ src/pi-components/brunch-menu.ts
→ src/pi-components/workspace-switcher
→ WorkspaceSessionCoordinator activation
→ TUI command/shortcut tests
```

### Risks and Assumptions

- RISK: The final settings/config IA is not designed → MITIGATION: scope only a menu shell with a workspace/session item and clear extension points; do not invent full settings semantics.
- RISK: Removing `/brunch-workspace` immediately may break tests or muscle memory → MITIGATION: either retire it deliberately with test updates or keep it as a hidden/backward test alias only if needed for one transition commit; prefer deletion in pre-release.
- ASSUMPTION: `ctrl+shift+b` is collision-safe based on the probe extension note → VALIDATE: register shortcut test asserts the binding exists and no `ctrl+b` alias returns.

### Acceptance Criteria

✓ `src/pi-components/brunch-menu.ts` renders a minimal menu with a workspace/session switch action.
✓ `src/pi-extensions/settings-switcher-menu.ts` registers `/brunch` and `ctrl+shift+b` to open the Brunch menu.
✓ Choosing the workspace/session switch action preserves the current coordinator-backed activation behavior and chrome refresh.
✓ `/brunch-workspace` is removed as the primary command; tests assert the intended command/shortcut surface.

### Verification Approach

- Inner: `npm run fix`; unit tests with fake command contexts and workspace decisions.
- Middle: source-level command registry test verifies `/brunch`, `ctrl+shift+b`, no `ctrl+b`, and no product reliance on the old command name.

### Cross-cutting obligations

- The menu returns product decisions; `WorkspaceSessionCoordinator` still owns session opening, state writes, and binding.
- Do not introduce settings persistence or hidden menu state in this card.

---

## Card 4 — Port and merge honest chrome

**Status:** done
**Weight:** full scope card

### Target Behavior

`src/pi-extensions/chrome.ts` uses the richer `.pi/extensions/brunch-chrome.ts` header/footer discipline while rendering only Brunch/Pi state with real producers today.

### Boundary Crossings

```text
→ .pi/extensions/brunch-chrome.ts probe implementation
→ existing src/pi-extensions chrome wrapper
→ WorkspaceSessionChromeState / session binding state
→ Pi header/footer/status/widget/title surfaces
→ chrome tests and TUI launch wiring
```

### Risks and Assumptions

- RISK: The probe chrome reads `.brunch/state.json` directly while current product chrome receives activated workspace state → MITIGATION: favor product-provided activated state when available; use session binding / ctx-derived fallbacks only for honest reload/session-switch reconstruction.
- RISK: Future-state stubs (lens, coherence, worker statuses) can become misleading → MITIGATION: do not render speculative fields until producers exist; leave clear placeholders only where current product state owns them.
- ASSUMPTION: Header/footer are the right primary chrome surfaces; status remains contribution channel → VALIDATE: code avoids using status as the main Brunch chrome owner except for intentional current wrapper compatibility.

### Acceptance Criteria

✓ `src/pi-extensions/chrome.ts` supersedes both the old product chrome and `.pi/extensions/brunch-chrome.ts` probe code.
✓ Header/footer render brand/version/cwd/spec/session/model/context/git/status information only where producers exist.
✓ Future state such as operational mode, lens, coherence, workers, and establishment offer is not fabricated; extension points are named for later producers.
✓ Existing chrome formatting tests are updated or replaced to assert the richer honest rendering contract.

### Verification Approach

- Inner: `npm run fix`; chrome formatter unit tests.
- Middle: fake `ExtensionContext`/footer-data tests cover selected spec/session binding fallback, model/thinking/context display, and extension status passthrough.
- Outer: optional manual TUI smoke after build thread if terminal rendering changed substantially.

### Cross-cutting obligations

- Chrome is projection, not authority; it must not mutate workspace/session state.
- Preserve RPC limitations: only assert Pi RPC chrome events that actually exist.

---

## Card 5 — Port operational-mode tool policy

**Status:** done
**Weight:** full scope card

### Target Behavior

`src/pi-extensions/operational-mode.ts` enforces the current `elicit`-safe read-only tool posture while being named and shaped as the future operational-mode policy seam.

### Boundary Crossings

```text
→ .pi/extensions/brunch-tools.ts probe implementation
→ Pi tool registry / active tool selection
→ before_agent_start prompt composition
→ tool_call and user_bash blocking events
→ Brunch extension aggregate factory
```

### Risks and Assumptions

- RISK: Re-registering built-in read-only tools may conflict with Pi base tools or custom tools → MITIGATION: preserve the probe's available-tool filtering and test active tool names after registration.
- RISK: A permanent read-only name would fight future `execute` mode → MITIGATION: expose the code as operational-mode policy with an initial `elicit` bundle/default, not `tool-policy.ts`.
- ASSUMPTION: `read`, `grep`, `find`, `ls` are sufficient safe tools for the current elicitation prototype → VALIDATE: tests assert side-effecting tools are blocked and prompt text tells the agent the allowed set.

### Acceptance Criteria

✓ `operational-mode.ts` registers/readies read-only tools and sets active tools for the current elicit posture.
✓ `before_agent_start` appends operational-mode/tool-policy prompt guidance.
✓ `tool_call` blocks side-effecting tools, including `bash`, `edit`, and `write`.
✓ `user_bash` is blocked with a deterministic Brunch result.
✓ The module name and exported API leave room for future `execute` bundles.

### Verification Approach

- Inner: `npm run fix`; fake ExtensionAPI unit tests for active tools, prompt injection, and blocked calls.
- Middle: aggregate extension factory test proves operational-mode policy is loaded programmatically, not through `.pi/settings.json`.

### Cross-cutting obligations

- This is the first concrete enforcement for I25-L; do not let active tool state come from ambient Pi settings.
- Keep side-effect suppression aligned with future `elicit` operational mode rather than global product incapability.

---

## Card 6 — Port mention autocomplete as graph-code completion

**Status:** done
**Weight:** full scope card

### Target Behavior

`src/pi-extensions/mention-autocomplete.ts` provides `#` completion from a Brunch-owned graph mention source keyed by stable node codes, with no `.pi/extensions/brunch-tags.json` file.

### Boundary Crossings

```text
→ .pi/extensions/brunch-autocomplete.ts probe implementation
→ Brunch graph mention source interface
→ Pi autocomplete provider
→ before_agent_start mention guidance
→ future graph data plane integration point
```

### Risks and Assumptions

- RISK: The graph data plane is not available yet → MITIGATION: define an injectable `GraphMentionSource` interface and test with fake intent/design/oracle/plan nodes; production source can return empty until M4/M5 plugs in.
- RISK: Stable code formats are not fully final → MITIGATION: support current known families (`D{n}` decisions and analogous intent/design/oracle/plan codes) through typed data, not hardcoded fixture food tags.
- ASSUMPTION: Pi autocomplete still persists only inserted handle text → VALIDATE: prompt guidance remains explicit that labels/descriptions are UI-only.

### Acceptance Criteria

✓ The autocomplete extension inserts stable handles such as `#D12` from Brunch-owned graph-node candidates.
✓ Candidate labels/descriptions are display-only and not treated as hidden transcript metadata.
✓ No code writes or reads `.pi/extensions/brunch-tags.json`.
✓ The graph mention source is injectable/testable before graph persistence lands.

### Verification Approach

- Inner: `npm run fix`; autocomplete extraction/apply unit tests with fake graph candidates.
- Middle: source audit `rg "brunch-tags|\.pi/extensions/brunch-tags" src .pi package.json` confirms the fixture JSON path is retired.

### Cross-cutting obligations

- Preserve D14-L: inserted text must be a stable Brunch-resolvable handle; autocomplete metadata is not transcript truth.
- Do not invent a graph lookup tool in this card.

---

## Card 7 — Port alternatives/card transcript primitive without demos

**Status:** done
**Weight:** full scope card

### Target Behavior

`src/pi-extensions/alternatives.ts` registers the persistent alternatives card transcript primitive and `present_alternatives` tool using `src/pi-components/cards.ts`, without shipping demo commands.

### Boundary Crossings

```text
→ .pi/extensions/brunch-messages.ts probe implementation
→ src/pi-components/cards.ts
→ Pi custom message renderer
→ Pi tool registry
→ structured exchange future seam
```

### Risks and Assumptions

- RISK: Alternatives may be confused with terminal structured-question responses → MITIGATION: name it as a presentation/proposal primitive; do not record it as an answered offer or terminal response.
- RISK: Demo commands leak into product command surface → MITIGATION: delete `/cards-demo`, `/cards-columns-demo`, and `/cards-flavors` during port.
- ASSUMPTION: `present_alternatives` remains useful enough to register as a product tool → VALIDATE: tests prove content fallback plus details payload are self-contained and replay-renderable.

### Acceptance Criteria

✓ `alternatives-card-set` custom message renderer is registered from product code.
✓ `present_alternatives` tool emits persistent custom transcript content plus structured details.
✓ Demo commands from the probe file are not registered.
✓ The primitive is documented/named as a structured-exchange building block, not a terminal answer collector.

### Verification Approach

- Inner: `npm run fix`; renderer/tool unit tests with fake ExtensionAPI.
- Middle: command registry test proves demo commands are absent while `present_alternatives` is available.

### Cross-cutting obligations

- Preserve transcript truth: custom message content must provide a readable fallback for RPC/replay clients without the renderer.
- Keep this separate from structured-question result details until the FE-744 structured-response tool lands.

---

## Card 8 — Retire `.pi/` probe runtime reliance and update docs/scripts

**Status:** next
**Weight:** full scope card

### Target Behavior

The ported product behavior no longer relies on `.pi/extensions`, `.pi/components`, `.pi/settings.json`, or `.pi/extensions/brunch-tags.json`, and stale references are either deleted or explicitly documented as historical probe evidence.

### Boundary Crossings

```text
→ .pi/extensions/* probe files
→ .pi/components/* probe files
→ .pi/settings.json ambient config
→ package scripts
→ docs/reference and architecture references
→ source audits
```

### Risks and Assumptions

- RISK: Some docs intentionally describe Pi's generic extension discovery locations → MITIGATION: keep reference docs that explain Pi generally, but update Brunch product docs to say product extensions are loaded programmatically from `src`.
- RISK: Deleting `.pi/settings.json` could remove useful local test defaults → MITIGATION: if needed, replace with a non-product example under docs or test fixtures; do not keep ambient config in the repo root.
- ASSUMPTION: Product lint/format coverage should now target `src` only → VALIDATE: package scripts no longer mention `.pi/extensions` or `.pi/components`.

### Acceptance Criteria

✓ Duplicate `.pi/extensions/brunch-*.ts`, `.pi/components/cards.ts`, and `.pi/extensions/brunch-tags.json` are deleted or moved into non-runtime historical documentation if explicitly needed.
✓ `.pi/settings.json` no longer controls Brunch product behavior; preferably it is removed from the repo.
✓ `package.json` lint/format scripts target product code, not deleted probe paths.
✓ Architecture docs mentioning `.pi/extensions/brunch-autocomplete.ts` or temporary probes are updated to point at `src/pi-extensions/*` or explicitly describe archived evidence.
✓ `rg "\.pi/extensions/brunch|\.pi/components|brunch-tags.json|brunch-workspace"` returns no stale product-runtime references.

### Verification Approach

- Inner: `npm run fix`; `npm run verify` if this is the tie-off card.
- Middle: source/doc audit commands for stale `.pi` product references and old command names.

### Cross-cutting obligations

- Keep generic Pi reference docs accurate where they discuss Pi itself; only remove Brunch product reliance on ambient `.pi`.
- Do not delete evidence references in architecture docs without replacing them with the durable product module names or noting the proof was temporary.

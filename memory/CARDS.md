# Scope Cards — sealed-pi-profile-runtime-state follow-up

## Orientation

- **Containing frontier:** `sealed-pi-profile-runtime-state` in `memory/PLAN.md`; this remains one frontier/Linear/branch boundary, now following the completed FE-744 extension/component port.
- **Containing seam:** Brunch-owned Pi wrapper: `src/pi-extensions.ts`, `src/pi-extensions/*`, `src/pi-components/*`, transcript-backed `BrunchAgentState`, prompt/tool posture, chrome projection, and sealed-profile resource isolation.
- **Volatile state:** Prior Cards 1–8 for the extension/component port have landed on `ln/fe-744-pi-ui-extension-patterns`; review found post-port cleanup and overclaim issues that must be fixed before runtime-state expansion.
- **Main open risk:** Runtime-state work will be built on shaky footing if the just-ported extension layout, chrome contract, menu naming, and operational-mode seam still contain stale probe-era vocabulary.

## Frontier-level obligations

- Preserve sealed-profile posture: Brunch product behavior comes from programmatic Brunch extension factories and profile policy, not ambient `.pi/` discovery.
- Preserve D23-L/D40-L/I25-L: transport mode, operational mode, agent role, strategy, and lens are separate axes, and active agent posture must be reconstructable from linear transcript entries at turn start.
- Preserve D25-L/D32-L: lenses are elicitor metadata and establishment offers are orientation artifacts, not a persistent default strategy menu.
- Preserve current elicit-safe tool policy: `elicit` must not expose side-effecting tools such as raw `bash`, `edit`, or `write` unless explicitly allowed by a future operational mode.
- Keep derivative planning state disciplined: scope-card queues live in `memory/CARDS.md`; temporary sidecar drafts must be reconciled and deleted.

---

## Card 0 — Reconcile post-port review findings before runtime-state work

**Status:** done
**Weight:** full scope card

### Target Behavior

The completed extension/component port has no unreconciled draft sidecar, chrome overclaim, or stale probe-era naming in product code and architecture evidence.

### Boundary Crossings

```text
→ docs/design/DRAFT_CARDS.md temporary sidecar
→ memory/CARDS.md canonical scope queue
→ src/pi-extensions/chrome.ts and chrome tests
→ docs/architecture/pi-ui-extension-patterns.md
→ src/pi-extensions/settings-switcher-menu.ts aggregate exports
→ src/pi-extensions/operational-mode.ts naming/comments
→ src/pi-components/cards.ts and src/pi-extensions/alternatives.ts comments
```

### Risks and Assumptions

- RISK: Chrome code and architecture docs can drift in opposite directions → MITIGATION: either finish the richer chrome port or narrow the docs/acceptance in the same slice; do not leave proof language stronger than code.
- RISK: Renaming menu/workspace exports can break tests or external imports → MITIGATION: update aggregate exports and tests deliberately; keep workspace switching as an internal helper behind menu/settings-switcher language.
- RISK: Card 0 becomes a grab bag → MITIGATION: limit it to review findings #1–#6 from the completed port and stop before adding new runtime-state behavior.
- ASSUMPTION: FE-744 Cards 1–8 are otherwise green and this slice is cleanup/reconciliation, not a feature expansion → VALIDATE: `npm run verify` remains green after edits.

### Acceptance Criteria

✓ `planning sidecar removed` — useful content from `docs/design/DRAFT_CARDS.md` is reconciled into `memory/CARDS.md`, and `docs/design/DRAFT_CARDS.md` is deleted.
✓ `chrome proof matches code` — `src/pi-extensions/chrome.ts` and `docs/architecture/pi-ui-extension-patterns.md` agree on the actual chrome contract: either richer version/build/model/thinking/context/git/status passthrough is implemented and tested, or docs explicitly narrow the claim.
✓ `extension layout narrative updated` — `docs/architecture/pi-ui-extension-patterns.md` names the current flat `src/pi-extensions.ts`, `command-policy`, `session-lifecycle`, `settings-switcher-menu`, `operational-mode`, `mention-autocomplete`, `alternatives`, and `src/pi-components/*` layout without old `branch-policy` / `session-boundary` / `workspace-command` narratives.
✓ `menu surface renamed` — public-ish exports use menu/settings-switcher language for `/brunch`; workspace switching is an internal menu action helper rather than the exported registration surface.
✓ `operational-mode vocabulary cleaned` — `operational-mode.ts` no longer reads like copied “Brunch — tools” / generic read-only tool policy, and local constants/comments use `elicit` / operational-mode policy vocabulary.
✓ `stale comments cleaned` — `src/pi-components/cards.ts` and `src/pi-extensions/alternatives.ts` no longer reference `.pi/extensions`, `brunch-messages.ts`, malformed comments, or empty activation sections.

### Verification Approach

- Inner: `npm run fix`; targeted unit/source tests for chrome formatting, menu command registration/export shape, and operational-mode policy where present.
- Middle: source/doc audit — `rg "DRAFT_CARDS|branch-policy|session-boundary|workspace-command|brunch-workspace|brunch-messages|\.pi/extensions" memory docs/architecture src` has only intentional historical references, and `npm run verify` passes.

### Cross-cutting obligations

- Do not add Brunch agent-state switching in this cleanup card.
- Preserve existing `/brunch` behavior and coordinator-owned workspace activation while renaming the module surface.
- Keep chrome a projection, not authority; it must not mutate workspace/session state.

---

## Card 1 — Project Brunch agent state from transcript

**Status:** done
**Weight:** full scope card

### Target Behavior

`src/pi-extensions/operational-mode.ts` reconstructs the active `BrunchAgentState` from `brunch.agent_runtime_state` custom entries with a deterministic default when no runtime entries exist.

### Boundary Crossings

```text
→ Pi SessionManager linear entries
→ Brunch agent-runtime-entry parser/projection helpers
→ Brunch operational-mode / agent-role definition registry
→ operational-mode policy state used by extension handlers
```

### Risks and Assumptions

- RISK: Runtime-entry schemas become durable before they are typed tightly enough → MITIGATION: define discriminated TypeScript shapes for `brunch.agent_runtime_state`, reject unknown/partial entries in projection tests, and keep parser tolerant only by ignoring malformed entries rather than guessing.
- RISK: Default state silently diverges from the current fixed read-only policy → MITIGATION: make the default state explicit (`operationalMode: "elicit"`, `agentRole: "elicitor"`, default strategy/lens) and assert its resolved tool/prompt posture in tests.
- ASSUMPTION: Pi custom entries can be read synchronously enough from `ctx.sessionManager.getEntries()` during `session_start` / `before_agent_start` → VALIDATE: fake SessionManager tests plus existing JSONL projection tests; already governed by D17-L/D40-L/I25-L.

### Acceptance Criteria

✓ `projects default runtime` — with no runtime custom entries, projection returns a `BrunchAgentState` with operational mode `elicit`, agent role `elicitor`, and role-default strategy/lens selections.
✓ `last valid runtime state wins` — a later `brunch.agent_runtime_state` supersedes earlier snapshots without mutating older transcript state.
✓ `rejects ambient config authority` — projection does not read `.pi/presets.json`, `.pi/modes.json`, environment mode files, or extension-local persisted booleans.
✓ `exports typed runtime state` — tests can import a narrow `projectBrunchAgentState`/equivalent helper without instantiating a full Pi runtime.

### Verification Approach

- Inner: unit/schema tests — runtime-entry parsing, default projection, last-valid-entry-wins ordering, malformed-entry handling.
- Middle: JSONL fixture/projection test — append representative runtime init/switch custom entries and reload/project them through the same helper used by the extension.

### Cross-cutting obligations

- Runtime state is transcript-backed, not hidden extension memory.
- Keep the concept named `BrunchAgentState` / `operational mode`, not generic Pi mode or plan mode.
- This card should not add user-facing strategy/lens menus.

### Terminology and types

```ts
export interface BrunchAgentState {
  schemaVersion: 1
  operationalMode: OperationalModeId
  agentRole: AgentRoleId
  agentStrategy: AgentStrategyId
  agentLens: AgentLensId | null
}

export interface OperationalModeDefinition {
  id: OperationalModeId
  defaultRole: AgentRoleId
  allowedRoles: readonly AgentRoleId[]
  toolPolicyId: ToolPolicyId
  promptPackIds: readonly PromptPackId[]
}

export interface AgentRoleDefinition {
  id: AgentRoleId
  operationalMode: OperationalModeId
  defaultStrategy: AgentStrategyId
  allowedStrategies: readonly AgentStrategyId[]
  defaultLens: AgentLensId | null
  allowedLenses: readonly AgentLensId[]
  promptPackIds: readonly PromptPackId[]
  modelPreference?: ModelPreference
  thinkingLevel?: ThinkingLevel
}

export interface ResolvedBrunchAgentState extends BrunchAgentState {
  operationalModeDefinition: OperationalModeDefinition
  agentRoleDefinition: AgentRoleDefinition
}

export interface BrunchAgentStateEntryData {
  schemaVersion: 1
  reason: "init" | "switch"
  state: BrunchAgentState
  previous?: BrunchAgentState
  source: "system" | "user" | "agent" | "extension"
}
```

Custom entry kind: `brunch.agent_runtime_state`.

Validation requires: `OperationalModeDefinition.allowedRoles` contains `agentRole`; `AgentRoleDefinition.operationalMode` equals `operationalMode`; `AgentRoleDefinition.allowedStrategies` contains `agentStrategy`; and `agentLens` is either `null` or contained in `AgentRoleDefinition.allowedLenses`.

---

## Card 2 — Apply active Brunch agent state to prompt and tools

**Status:** done
**Weight:** full scope card

### Target Behavior

Before each agent turn, `operational-mode.ts` applies the reconstructed and resolved `BrunchAgentState` tool policy and prompt packs.

### Boundary Crossings

```text
→ runtime-state projection helper
→ Pi before_agent_start hook
→ Pi active-tool registry
→ Pi tool_call / user_bash enforcement hooks
→ model-facing system prompt
```

### Risks and Assumptions

- RISK: `setActiveTools()` is only a visibility layer and cannot be the whole authority boundary → MITIGATION: preserve `tool_call` and `user_bash` blockers as defense-in-depth.
- RISK: Prompt fragments become scattered strings again → MITIGATION: centralize prompt text in operational-mode and agent-role definitions and have `before_agent_start` compose from resolved state.
- ASSUMPTION: Current `elicit` + `elicitor` state should preserve the read-only tool set from `.pi/extensions/brunch-tools.ts` / current `operational-mode.ts` → VALIDATE: active-tools and blocking tests assert `read`, `grep`, `find`, `ls` allowed and `bash`, `edit`, `write` blocked.

### Acceptance Criteria

✓ `applies elicit tools` — `before_agent_start` sets active tools from the resolved operational mode / agent role definitions for `elicit` + `elicitor`.
✓ `injects resolved prompt` — the system prompt includes operational-mode and agent-role guidance from the resolved `BrunchAgentState`.
✓ `blocks side effects` — `tool_call` blocks `bash`, `edit`, `write`, and any non-allowed tool under `elicit` + `elicitor` with deterministic Brunch wording.
✓ `blocks user bash` — `user_bash` returns a deterministic blocked result under `elicit` + `elicitor`.
✓ `does not hardcode plan-mode vocabulary` — product prompt/status strings refer to Brunch operational mode and agent role, not borrowed plan-mode terminology.

### Verification Approach

- Inner: fake ExtensionAPI tests — active tool application, prompt composition, tool-call blocking, user-bash blocking.
- Middle: aggregate extension factory test — `createBrunchPiExtensionShell` loads operational-mode policy programmatically and no ambient `.pi` tool policy is required.

### Cross-cutting obligations

- Preserve I25-L: tool gating follows reconstructed operational mode.
- Preserve sealed-profile posture: ambient Pi settings/resources must not decide the tool set.
- Keep future `execute` as a new operational-mode definition, not a contradiction of current `elicit` safety.

---

## Card 3 — Persist Brunch agent-state switches as selected-state snapshots

**Status:** queued
**Weight:** full scope card

### Target Behavior

Brunch-owned runtime switch helpers persist accepted agent-state changes as full selected `BrunchAgentState` snapshots.

### Boundary Crossings

```text
→ product command/helper entry point
→ operational-mode / agent-role registry validation
→ Pi appendEntry custom transcript persistence
→ runtime-state projection helper
→ Brunch chrome/status projection input
→ future observer/reviewer routing metadata
```

### Risks and Assumptions

- RISK: A switch UI turns into a default strategy menu and violates D32-L → MITIGATION: expose narrow product command/helper hooks for explicit user/agent switches only; do not render a persistent exhaustive menu by default.
- RISK: Runtime axes drift into invalid combinations → MITIGATION: validate every requested change against the operational-mode / agent-role registry hierarchy and append only a full valid selected `BrunchAgentState` snapshot.
- ASSUMPTION: Product commands may append custom entries through Pi extension APIs for now, while future Brunch command-layer integration can own richer authority → VALIDATE: tests assert append shape and replay projection; no graph mutation is introduced.

### Acceptance Criteria

✓ `appends runtime init` — session initialization appends one `brunch.agent_runtime_state` entry when no valid runtime state exists.
✓ `appends runtime switch` — a Brunch helper/command appends a `brunch.agent_runtime_state` snapshot with `reason: "switch"`, previous state, source metadata, and validated `operationalMode` / `agentRole` / `agentStrategy` / `agentLens` fields.
✓ `projects latest runtime state` — projection reconstructs and resolves the active mode/role/strategy/lens from the latest valid full-state snapshot.
✓ `updates chrome input only when producers exist` — chrome/status may consume projected active lens/strategy, but no speculative worker/coherence/offer state is fabricated.
✓ `no persistent strategy menu` — no default exhaustive lens/strategy chooser is added to idle UI.

### Verification Approach

- Inner: unit tests — append payload shape, registry validation, projection last-valid-snapshot wins, invalid combination rejection.
- Middle: JSONL reload/projection test — selected runtime-state snapshots survive reload and resolve active mode/role/strategy/lens.
- Outer: optional manual TUI/RPC smoke — explicit switch command/helper is inspectable in transcript and reflected in status/chrome where currently wired.

### Cross-cutting obligations

- Preserve D25-L: lens is metadata within the `elicitor` role, not an agent role or operational mode.
- Preserve D32-L: establishment offers remain orientation artifacts, not a default next-action menu.
- Do not introduce graph writes or observer/reviewer routing behavior in this card; only provide the transcript-backed state seam.

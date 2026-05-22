# Scope Cards — pi-ui-extension-patterns

Volatile execution queue for the existing `pi-ui-extension-patterns` frontier in `memory/PLAN.md`. Delete or overwrite this file when the queue is exhausted or superseded. These cards narrow one PLAN frontier; they do not create separate Linear issues or branches.

## Orientation

- **Containing seam:** Pi extension/TUI UI affordance seam for Brunch's opinionated product shell; this informs M5 lenses/review-sets, M6 authority gates, and M7 turn-boundary delivery.
- **Frontier item:** `pi-ui-extension-patterns` under PLAN `Parallel / Low-conflict`; active implementation should use one frontier-level Linear issue/Graphite branch, not one branch per card.
- **Volatile state:** `docs/architecture/pi-ui-extension-patterns.md` now holds Card 1 command-containment evidence; `docs/architecture/pi-ui-extension-patterns-provisional-plan.md` still holds expanded future-affordance inventory until this queue is exhausted.
- **Main open risk:** Strict built-in command suppression requires a Pi command-policy API; Card 2 must still prove whether Brunch-owned chrome makes the shell feel product-owned despite that residual exposure, while preserving RPC degradation facts.

Frontier-level obligations to preserve throughout this queue:

- Brunch hides Pi's generic extension surface from users rather than becoming a configurable Pi shell.
- Brunch-controlled flows preserve linear transcript policy (`I19-L`) and must not introduce `/tree`, `/fork`, `/clone`, branch adaptation, or parallel chat/turn state.
- Slash commands, action affordances, and future writes route through Brunch-owned handlers/`CommandExecutor`; prototype UI state must not become a bypass path.
- Establishment-offer rendering remains orientation-first and user-invoked when expanded, not a default exhaustive lens menu.
- Evidence must distinguish source-audit findings, raw Pi-harness observations, Brunch-host observations, and assumptions.

## Queue

### Card 1 — status: done

## Full scope card — Command containment feasibility

### Target Behavior

A command-containment matrix classifies Pi interactive commands by Brunch policy, suppression seam, blocker seam, residual exposure, and required API ask with supporting evidence.

### Boundary Crossings

```text
→ Pi docs/source audit for commands, autocomplete, input events, lifecycle hooks, shortcuts, and RPC commands
→ scratch Pi extension or Brunch-internal probe for autocomplete and execution interception
→ branch-policy/effect-blocking checks for `/fork`, `/clone`, `/tree`, `/new`, `/resume`, and `/compact`
→ feasibility matrix in the final Pi UI extension memo or provisional artifact
```

### Risks and Assumptions

- RISK: Autocomplete suppression may hide commands while exact slash execution still exposes off-brand Pi UI → MITIGATION: score visibility suppression, effect blocking, and product-surface containment separately.
- RISK: Hidden interactive commands or shortcuts bypass the advertised `BUILTIN_SLASH_COMMANDS` inventory → MITIGATION: audit `InteractiveMode.setupEditorSubmitHandler`, keybindings, and RPC command docs in addition to `slash-commands.ts`.
- RISK: Lifecycle hooks block dangerous effects only after Pi UI has already started → MITIGATION: record pre-cancel exposure as residual product risk rather than calling the command “blocked.”
- ASSUMPTION: “Hide from autocomplete plus block dangerous effects” may be sufficient for the POC if strict command-policy hooks are unavailable → VALIDATE: user/product review of the matrix verdict before downstream UI work treats this as settled → memory/SPEC.md §Open Assumptions A18-L.

### Acceptance Criteria

✓ Command inventory — advertised built-ins, hidden interactive commands, relevant keybindings, extension commands, prompt/skill commands, and RPC-only session commands are classified.
✓ Autocomplete probe — an allowlist wrapper either demonstrates filtered slash suggestions while preserving file/path and future `#` completion behavior, or records why the seam cannot do so.
✓ Execution probe — extension `input`, lifecycle hooks, command collision behavior, settings knobs, and custom-editor interception are tested or source-proven against representative allowed/disallowed commands.
✓ Branch-flow guard — `/fork`, `/clone`, and `/tree` effects remain blocked or explicitly fail-fast in any prototype path, with no branchy Brunch transcript fixture created.
✓ API ask — if strict suppression is not feasible, the memo contains a minimal Pi command-policy API request and marks whether it is required before M5/M6/M7 or merely desirable.

### Verification Approach

- Inner: static/source oracle plus `npm run fix` for committed artifacts — proves the inventory and docs/probe code stay coherent with repo style.
- Middle: scripted or manual probe runbook — proves advertised suppression/blocking outcomes for representative commands and records exact Pi version/source paths.
- Outer: product-shell review checklist — decides whether residual built-in exposure is acceptable for the POC or requires a Pi upstream/API change.

### Cross-cutting obligations

- Preserve `I19-L`: no prototype may create or normalize Pi branches as Brunch product behavior.
- Do not treat extension command collision as an override mechanism; Brunch commands should be product-named unless Pi grows command policy.
- Keep command policy separate from `CommandExecutor` mutation policy: command containment gates product shell exposure; `CommandExecutor` still owns graph/product writes.
- Record evidence tiers explicitly: source audit vs raw Pi harness vs Brunch host vs assumption.

---

### Card 2 — status: next

## Full scope card — Dynamic Brunch chrome proof

### Target Behavior

A Brunch-owned chrome renderer updates Pi TUI header, footer, status, and widgets from one product-state snapshot with documented idle, streaming, reload, and RPC-degradation behavior.

### Boundary Crossings

```text
→ Brunch chrome/product-state snapshot fixture
→ Brunch-owned renderer wrapper over Pi `ExtensionUIContext`
→ Pi TUI chrome seams: `setHeader`, `setFooter`, `setStatus`, `setWidget`, optional `setWorkingIndicator`
→ raw Pi harness and/or Brunch TUI host demo
→ feasibility matrix entry and runbook evidence
```

### Risks and Assumptions

- RISK: Chrome update calls scattered across probes become de facto architecture → MITIGATION: centralize in a named wrapper/prototype API such as `renderBrunchChrome(ctx, state)` before downstream cards call raw Pi UI methods.
- RISK: Dynamic updates work while idle but corrupt input or visual state during streaming → MITIGATION: simulate observer/reviewer queue changes during both idle and streaming states.
- RISK: Reload/session replacement loses chrome state in a confusing way → MITIGATION: either reconstruct from durable/product state on `session_start` or document deliberate reset semantics.
- RISK: RPC behavior differs from TUI behavior → MITIGATION: record that header/footer/custom components are TUI-only while status/widget string updates have RPC fire-and-forget parity.
- ASSUMPTION: Strong chrome replacement is enough for Brunch to feel product-owned even if some Pi built-ins remain technically callable → VALIDATE: product-shell review after Card 1 and Card 2 evidence are both present → memory/SPEC.md §Open Assumptions A10-L.

### Acceptance Criteria

✓ Chrome wrapper — one Brunch-named wrapper/prototype owns calls to `setHeader`, `setFooter`, `setStatus`, and `setWidget` for the demo.
✓ State coverage — demo state includes cwd, selected spec, session, phase/stage, active lens or “none,” coherence verdict, observer/reviewer/reconciler status, reconciliation-need count, and latest establishment-offer summary when present.
✓ Dynamic behavior — evidence records update behavior while idle, during assistant streaming, after `/reload`, and after session replacement or selected-session reopen where applicable.
✓ Styling behavior — the demo proves color/glyph styling is legible in narrow terminals and does not depend on raw Pi branding/footer data as the primary product surface.
✓ RPC degradation — memo records which chrome calls produce RPC `extension_ui_request` events and which are no-ops, so fixture-driver expectations do not assume TUI-only behavior.

### Verification Approach

- Inner: formatter/unit oracle for pure chrome-state formatting plus `npm run fix` — proves the wrapper’s deterministic string/state mapping.
- Middle: runbook oracle against a scratch/raw Pi harness or Brunch TUI host — proves idle/streaming/reload/session-replacement observations with captured notes or logs.
- Outer: manual visual walkthrough — judges whether the shell reads as Brunch-owned and whether establishment-offer chrome stays orientation-first.

### Cross-cutting obligations

- Chrome state is projection state over canonical Brunch/session facts, not a new store or authority layer.
- Establishment-offer rendering remains ambient orientation; expanded offer inspection must remain user-invoked.
- Do not introduce graph/product writes from chrome controls in this card; any future action affordance must route through Brunch handlers/`CommandExecutor`.
- Keep raw Pi UI calls behind the wrapper so M5/M6/M7 can reuse product-named affordances rather than Pi primitives directly.

## Queue stop rule

Stop after these two cards before scoping review-set overlays or structured prompt components if Card 1 concludes strict command containment needs a Pi upstream/API change, or if Card 2 shows dynamic chrome cannot be reconstructed safely across reload/session replacement. Otherwise the next scoping pass can prepare structured prompt and review-set interaction cards using the evidence from this queue.

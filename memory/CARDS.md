# FE-776 scope queue — sealed Pi profile/runtime state

## Orientation

- **Containing seam:** Brunch Pi Profile plus explicit product extension shell (`src/brunch-pi-profile.ts`, `src/brunch-tui.ts`, `src/tui-client/pi-extension-shell.ts`).
- **Frontier:** `sealed-pi-profile-runtime-state` on FE-776; the first profile-resource slice has landed, so the next work stays inside the same issue/branch.
- **Volatile state:** Brunch Pi settings are now in-memory and product-owned; runtime-state helpers exist but still need proof as a transcript-backed contract.
- **Main open risk:** A19-L remains open until behavior-shaping Pi settings are either sealed by programmatic Brunch policy or explicitly recorded as an upstream Pi seam.

Frontier obligations for every card:

- Do not expose Pi's generic extension/skill/prompt/theme configuration to Brunch users.
- Do not reintroduce ambient `.pi` discovery through a Brunch-internal filesystem loader.
- Keep runtime state linear-transcript-backed, not extension-local memory.
- Keep tool/prompt policy product-owned and mode-aware; `elicit` remains read-only except explicit Brunch-safe tools.
- Preserve the A18-L distinction: Brunch can seal/hide/block what current Pi seams expose, but exact interactive built-in slash-command suppression may remain an upstream Pi seam.

## Card 1 — done — Settings policy seal

### Target Behavior

Brunch-created Pi settings ignore ambient global/project Pi settings for behavior-shaping product policy.

### Boundary Crossings

```text
→ createBrunchPiProfile
→ createBrunchSettingsManager / SettingsManager seam
→ createAgentSessionServices / InteractiveMode settings reads
```

### Risks and Assumptions

- RISK: Pi settings overrides applied through `applyOverrides` may be lost when Pi calls `settingsManager.reload()`.
  → MITIGATION: prefer a file-isolated/in-memory Brunch settings manager or method-level overrides that survive reload; add a regression test that calls `reload()` before assertions.
- RISK: sealing every visible setting becomes a generic settings framework.
  → MITIGATION: use one Brunch profile default/override object or one narrow wrapper in `src/brunch-pi-profile.ts`; no new abstraction layer beyond the current profile boundary.
- RISK: model/provider defaults may currently depend on user Pi settings.
  → MITIGATION: if removing ambient model defaults breaks launch, record the precise temporary exception in SPEC/PLAN as runtime-bundle debt rather than silently reading all user settings.
- ASSUMPTION: Current Pi public `SettingsManager` APIs are sufficient to either isolate file reads or override all known behavior-shaping getters.
  → IMPACT IF FALSE: A19-L cannot close without a narrow Pi upstream seam; graph/authority work must carry that blocker explicitly.
  → VALIDATE: hostile global/project settings fixture plus source-audit test over Pi settings getter usage.
  → SPEC: A19-L / D39-L / I24-L.

### Tracer-bullet check

- **Invariant:** makes the profile boundary responsible for settings policy, not just resource-loader flags.
- **Uncertainty:** directly pressures A19-L by trying to make hostile ambient settings inert.

### Acceptance Criteria

```text
✓ hostile ambient settings fixture — with global/project `.pi/settings.json` values for shell path/prefix, npm command, packages/resources, skill commands, double-escape action, compaction/retry, image/terminal/UI, transport/theme/changelog/telemetry, Brunch profile returns product-owned values or documented temporary exceptions.
✓ reload resilience — after `settingsManager.reload()`, sealed Brunch values still win over hostile file settings.
✓ no ambient resource settings — `getPackages()`, `getExtensionPaths()`, `getSkillPaths()`, `getPromptTemplatePaths()`, and `getThemePaths()` return empty Brunch-owned values under the profile.
✓ command/keybinding hardening — `getEnableSkillCommands()` is false and `getDoubleEscapeAction()` is `"none"` under the profile.
✓ source audit — `src/brunch-pi-profile.ts` owns every Brunch settings override and `src/brunch-tui.ts` remains free of `SettingsManager.create` / individual settings policy.
✓ residual seam note — any settings getter that cannot be sealed is named in SPEC/PLAN with its current blast radius and upstream Pi ask.
```

### Verification Approach

- Inner: unit/contract tests in `src/brunch-tui.test.ts` or a new `src/brunch-pi-profile.test.ts` with hostile settings fixtures.
- Middle: source-audit test against installed Pi `settings-manager.d.ts` / known getter usage to keep the audited list visible without pretending to own Pi internals.

### Cross-cutting obligations

- Preserve explicit Brunch extension factories while disabling ambient resources.
- Do not preserve accidental compatibility with existing local Pi settings.
- Do not claim A18-L exact slash-command suppression is solved unless a real Pi command/keybinding seam is exercised.

## Card 2 — next — Runtime state transcript contract

### Target Behavior

Brunch runtime selection is reconstructable from the latest valid `brunch.agent_runtime_state` entry in a linear Pi transcript.

### Boundary Crossings

```text
→ Brunch runtime-state helpers
→ Pi SessionManager custom entries
→ projection used by product extensions
```

### Risks and Assumptions

- RISK: Existing helper code may accept malformed or cross-mode states because the type model is wider than the current POC state.
  → MITIGATION: test invalid entries and keep the domain deliberately tiny: `elicit` + `elicitor` + current strategies/lenses only.
- RISK: This drifts into a full runtime-bundle editor.
  → MITIGATION: no UI, no persistence outside JSONL, no new modes; prove append/project/switch only.
- ASSUMPTION: Pi custom entries are sufficient for full selected-state runtime state.
  → IMPACT IF FALSE: D40-L needs a different persistence seam before graph-agent work.
  → VALIDATE: append/replay tests over fake or real SessionManager entry arrays.
  → SPEC: D40-L / I25-L.

### Tracer-bullet check

- **Proof of life:** initializes and switches the state through the same transcript primitive later turn prep will read.
- **Invariant:** establishes transcript-backed runtime state instead of extension-local memory.

### Acceptance Criteria

```text
✓ init append — `appendBrunchAgentRuntimeInit` appends exactly one default `brunch.agent_runtime_state` entry when none exists.
✓ init idempotence — init does not append another entry when a valid runtime-state entry is already present.
✓ switch append — `appendBrunchAgentRuntimeSwitch` appends a valid switch entry carrying previous selected state.
✓ projection order — `projectBrunchAgentState` returns the latest valid state and ignores malformed runtime-state entries.
✓ invalid state rejection — impossible mode/role/strategy/lens combinations are not appendable or projectable.
```

### Verification Approach

- Inner: focused unit tests for append/project helpers; fake SessionManager is acceptable if it matches the minimal custom-entry methods.
- Middle: optional real JSONL SessionManager round-trip only if fake tests leave uncertainty about Pi custom-entry shape.

### Cross-cutting obligations

- Keep selected state as one coherent bundle; do not store each knob independently.
- Keep static types projected from the runtime-state module; do not duplicate DTOs in tests.

## Card 3 — queued — Runtime-state prompt/tool posture wiring

### Target Behavior

Before each agent turn, Brunch derives prompt additions and active tools from the transcript-projected runtime state.

### Boundary Crossings

```text
→ Pi `session_start` / `before_agent_start` / `tool_call` hooks
→ runtime-state projection
→ prompt composition + active-tool policy
```

### Risks and Assumptions

- RISK: Prompting and tool policy can diverge if each projects state independently.
  → MITIGATION: tests should exercise both extensions against the same transcript fixture.
- RISK: Current default-only runtime state makes tests tautological.
  → MITIGATION: include the non-default current strategy/lens (`disambiguate-via-examples`) so prompt text proves projection is read.
- ASSUMPTION: The existing extension event seams are enough to re-apply policy at session start and before every agent turn.
  → IMPACT IF FALSE: Brunch needs a different turn-prep seam before M5/M6.
  → VALIDATE: extension-factory tests with fake Pi event registration and sessionManager entries.
  → SPEC: D40-L / I25-L / A19-L.

### Tracer-bullet check

- **Proof of life:** transcript state changes observable agent posture without hidden extension memory.
- **Invariant:** `elicit` read-only tool policy remains tied to operational mode.

### Acceptance Criteria

```text
✓ session-start policy — operational-mode extension appends default init if needed and sets active tools from projected state.
✓ before-agent policy — operational-mode extension re-applies active tools from latest transcript state before an agent turn.
✓ prompt composition — prompting extension appends Brunch prompt material naming the projected operational mode, role, strategy, lens, and active tools.
✓ elicit blocking — `bash`, `edit`, and `write` remain blocked by `tool_call`; user shell commands return the Brunch policy-blocked result.
✓ no hidden memory — changing only the transcript entries changes projected prompt/tool posture in tests without mutating extension-local state.
```

### Verification Approach

- Inner: extension contract tests using fake `ExtensionAPI` and fake session manager entries.
- Middle: existing full `npm run verify` gate; no browser/TUI manual loop needed for this slice.

### Cross-cutting obligations

- Do not introduce execute mode or graph tools in this card.
- Preserve safe explicit Brunch tools and current structured-exchange tools under `elicit`; do not replace with a stale allowlist that hides future safe Brunch tools.

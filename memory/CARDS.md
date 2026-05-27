# Scope cards — FE-744 judo fixes and next UI-seam slices

Status key: `next` / `in progress` / `done` / `dropped`.

## Orientation

- **Containing seam / frontier:** `pi-ui-extension-patterns` (FE-744), the Brunch-owned Pi UI affordance seam: startup/in-session spec/session selection, RPC/headless selection contract, and the next structured-question/RPC-relay proof.
- **Current state:** The hierarchical spec/session picker landed and verified. Cards 1–2 retired stale flat-picker exports, renamed the activation decision/coordinator types, restored separate dev-tag styling, and put `workspace.activate` behind a TypeBox-backed activation schema with required coordinator capabilities. The remaining review finding is the visible regression to minimal chrome.
- **Main open risk:** The next structured-question work will add another UI/RPC boundary; if the existing picker/RPC seam keeps stale APIs and cast-heavy parsing, the structured-question slice will copy that complexity.
- **Frontier obligations:** Preserve `workspace(cwd) → spec → session` (D11-L/D36-L/I22-L), coordinator-owned activation and binding (D21-L/I8-L), no implicit TUI resume before explicit activation (D22-L/I22-L), RPC/headless non-TUI selection, Pi transcript truth for structured interactions (D37-L/I23-L), and TypeBox as Brunch's runtime schema vocabulary (D41-L/I26-L).

---

## Card 1 — Delete legacy flat picker API, rename activation decision, and restore version styling

**Status:** done  
**Weight:** light scope card

### Objective

Retire the obsolete flat workspace-dialog option API, rename the activation decision boundary away from “workspace switch” language, and restore the separate styled dev build tag in the spec/session picker header.

### Acceptance Criteria

✓ `rg "buildWorkspaceDialogOptions|WorkspaceDialogOption" src` finds no exported production API and no tests depending on the old flat-list picker.  
✓ `src/pi-components/workspace-dialog/model.ts` contains only the hierarchical selection model for picker option generation.  
✓ `WorkspaceSwitchDecision` is replaced in production code with a spec/session activation name such as `SpecSessionActivationDecision`; if `WorkspaceSwitchCoordinator` remains, it is either renamed too or justified by a narrower follow-up.  
✓ `src/workspace-dialog.test.ts` asserts hierarchical model/component behavior without testing the old flat option list.  
✓ The picker header renders `brunch v...` and the dev metadata as separately styled segments/lines so the dev tag uses `success` styling rather than being folded into the accent version string.  
✓ `npm run verify` passes.

### Verification Approach

- Inner: `npm run fix`; targeted `npx vitest --run src/workspace-dialog.test.ts src/brunch-tui.test.ts`; then `npm run verify`.
- Middle: `rg` deletion check for the retired flat-picker symbols.

### Cross-cutting obligations

- Delete stale concepts instead of preserving compatibility scaffolding; this is pre-release and `buildWorkspaceDialogOptions` is now the wrong model.
- Keep the renamed spec/session activation decision as the transport-neutral activation boundary; do not rename individual action variants just for copy cleanup unless doing so deletes more ambiguity than it creates.
- Preserve current TUI startup and in-session picker behavior while removing old API surface.

### Promotion checklist

- [ ] Does this change a requirement? No.
- [ ] Does this create, retire, or invalidate an assumption? No.
- [ ] Does this make or reverse a non-trivial design decision? No — D36-L already chose the hierarchical model.
- [ ] Does this establish a new seam-level invariant? No.
- [ ] Does this change a frontier-level cross-cutting obligation or verification architecture layer? No.
- [ ] Does it cross more than two major seams? No.
- [ ] Is this the first touch in an unfamiliar seam from a fresh thread? No.
- [ ] Can you not name the containing seam or current rationale from the live docs? No.

---

## Card 2 — Schema-backed RPC spec/session activation boundary

**Status:** done  
**Weight:** full scope card

### Target Behavior

`workspace.activate` validates activation params through an explicit TypeBox-backed spec/session activation decision schema and is only registered with a coordinator that supports workspace inspection and spec/session activation.

### Boundary Crossings

```text
→ JSON-RPC request params
→ TypeBox workspace activation decision schema/parser
→ SpecSessionActivationDecision
→ spec/session activation coordinator method
→ serializable activation response DTO
```

### Risks and Assumptions

- RISK: Continuing with `Partial<WorkspaceSwitchCoordinator>` (or its renamed equivalent) keeps an impossible registered-method state: the method exists but can only return an internal error. → MITIGATION: Make `createRpcHandlers` require the coordinator capabilities it registers, or split selection/activation handler registration into a separate explicit factory if a read-only coordinator is truly needed.
- RISK: Hand-rolled casts around `unknown` will be copied into the upcoming structured-question RPC work. → MITIGATION: Establish the TypeBox parse pattern here before adding more RPC boundaries.
- ASSUMPTION: All current call sites can pass a full `WorkspaceSessionCoordinator` plus the renamed spec/session activation coordinator capability. → VALIDATE: Typecheck all call sites (`brunch.ts`, `web-host.ts`, fixture capture, tests) after tightening the type.

### Acceptance Criteria

✓ `src/rpc.ts` has no manual `(decision as { ... })` parser for `workspace.activate`; params are parsed/checked via a TypeBox schema or a small schema-backed helper returning the renamed spec/session activation decision type.  
✓ `createRpcHandlers` no longer accepts a partial activation coordinator for methods it always registers; required capabilities are explicit at the factory boundary.  
✓ `workspace.activate` invalid params still return `-32602`; valid `cancel`, `newSpec`, `newSession`, `continue`, and `openSession` decisions still delegate exactly once to `activateWorkspace`.  
✓ Activation responses remain serializable and do not expose `SessionManager`.  
✓ The source assertion that RPC does not import TUI picker code remains meaningful and passes.  
✓ `npm run verify` passes.

### Verification Approach

- Inner: RPC contract tests — valid/invalid decision parsing, coordinator delegation, serializable activation snapshots, and typecheck of all handler call sites.
- Middle: Architectural boundary/source assertion — `src/rpc.ts` does not import TUI picker code and does not use non-TypeBox runtime schema libraries.

### Cross-cutting obligations

- Honor D41-L/I26-L: TypeBox is the runtime schema vocabulary at Brunch boundaries.
- RPC/headless startup must expose structured selection/activation, not TUI picker code.
- Keep transport connections as client attachments; activation still flows through coordinator, not through connection-local session identity.

---

## Card 3 — Restore rich Brunch chrome projection

**Status:** next  
**Weight:** full scope card

### Target Behavior

The persistent Brunch TUI chrome renders a richer product-owned header/footer/status/widget projection, including the selected cwd/spec/session and available runtime/context metadata, without fabricating unavailable facts.

### Boundary Crossings

```text
→ WorkspaceSessionReadyState / Brunch runtime snapshot producers
→ BrunchChromeState
→ renderBrunchChrome wrapper
→ Pi ui.setHeader / setFooter / setStatus / setWidget / setTitle
→ TUI visual surface and RPC-compatible status/widget events
```

### Risks and Assumptions

- RISK: The earlier rich chrome may have depended on metadata producers that are not currently wired into `BrunchChromeState` (context usage, model/thinking, runtime bundle, git/build data). → MITIGATION: First inventory what data is available from Pi extension contexts and Brunch runtime state; render optional fields only when the producer exists, and record missing producers as follow-up rather than fabricating values.
- RISK: A sophisticated footer can become a pile of formatting branches. → MITIGATION: Split pure formatting helpers by region (`header`, `footer`, `widget/status`) and keep `renderBrunchChrome()` as the only imperative shell.
- RISK: Header/footer are TUI-only in Pi RPC. → MITIGATION: Mirror the important compact facts into `setStatus` / `setWidget` so RPC tests and fixture drivers still have deterministic observability.
- ASSUMPTION: `setFooter` remains the right home for the richer metadata/status bar. → VALIDATE: Unit tests prove `setFooter` receives the rich projection; manual TUI smoke validates visual hierarchy.

### Acceptance Criteria

✓ `src/pi-extensions/chrome.ts` exposes a deeper `BrunchChromeState` or projection input that can carry optional runtime metadata such as model/thinking/runtime bundle/build info/context usage without making those fields mandatory.  
✓ `formatBrunchChromeFooterLines` renders a richer footer than the current two plain lines, including a compact context-usage progress bar when usage data is present and a clear omission when it is not.  
✓ `renderBrunchChrome` still calls `setHeader`, `setFooter`, `setStatus`, `setWidget`, and `setTitle` through one wrapper; downstream code does not scatter raw `ctx.ui.*` calls.  
✓ `src/brunch-tui.test.ts` covers the rich footer/header/status/widget projection and RPC-compatible degradation expectations.  
✓ Manual TUI smoke or pty capture confirms the Brunch chrome no longer resembles the minimal cwd/spec/session dump shown in the regression screenshot.  
✓ `npm run verify` passes.

### Verification Approach

- Inner: Pure formatter unit tests plus wrapper-call tests in `src/brunch-tui.test.ts`.
- Middle: Manual/pty TUI smoke comparing the live Brunch chrome against the rich footer/header expectations; RPC-compatible tests assert status/widget only for facts Pi RPC actually emits.

### Cross-cutting obligations

- `renderBrunchChrome` remains the canonical wrapper; no feature code should call raw Pi chrome primitives directly.
- Do not fabricate unavailable metadata; optional chrome fields are presentation metadata, not product truth.
- Preserve RPC degradation rules: header/footer are TUI-only, status/widget/title are deterministic for headless/RPC observers.

---

## Card 4 — Structured-question result model and transcript payload

**Status:** next  
**Weight:** full scope card

### Target Behavior

A Brunch structured-question tool can return a self-contained `toolResult.details` payload for text, single-select, multi-select, questionnaire, and optional-freeform answers.

### Boundary Crossings

```text
→ Pi extension tool registration
→ TypeBox structured-question parameter/result schemas
→ TUI/RPC-neutral structured answer model
→ toolResult.content + toolResult.details
→ Pi JSONL transcript projection inputs
```

### Risks and Assumptions

- RISK: Building UI first may leave the durable transcript shape under-specified. → MITIGATION: Start with pure schemas/builders and tests for `details` and model-readable `content`; add UI adapters later.
- RISK: The tool parameter schema and result schema can drift. → MITIGATION: Keep both in one module and derive TS types from TypeBox `Static<typeof Schema>`.
- ASSUMPTION: A single details envelope can cover all current answer modes without a separate custom entry. → VALIDATE: Tests cover `answered`, `skipped`, `cancelled`, and at least one answer shape per mode; if linked custom entries are needed, stop and rescope before building UI.

### Acceptance Criteria

✓ A new structured-question module defines TypeBox schemas for question/tool params and terminal result details.  
✓ Tests prove the returned `toolResult.details` includes schema/version, status, mode, prompts/questions, options where relevant, answers, and transport metadata without requiring rehydration from assistant tool-call args.  
✓ Tests prove `toolResult.content` is generated from the same details payload and remains model-readable.  
✓ The module supports text, single-select, multi-select, questionnaire, and optional-freeform shapes at the data/model layer.  
✓ `npm run verify` passes.

### Verification Approach

- Inner: Schema/builder unit tests for each mode and terminal status; typecheck against `Static<typeof Schema>` types.
- Middle: Transcript-shape contract test using a synthetic tool result entry to prove the payload is self-contained enough for later projection.

### Cross-cutting obligations

- Pi JSONL remains transcript truth; the details payload is not an ephemeral UI return value.
- Use TypeBox, not Zod/ad-hoc casts, for the new runtime boundary.
- Do not introduce graph mutations, command-layer bypasses, or a parallel chat/turn store.

---

## Card 5 — TUI custom UI adapter for structured questions

**Status:** next  
**Weight:** full scope card

### Target Behavior

In TUI mode, the structured-question tool can replace the default input surface with a Brunch custom UI and persist the selected answer through the Card 4 result builder.

### Boundary Crossings

```text
→ registered structured-question Pi tool
→ ctx.ui.custom TUI adapter
→ pi-tui component for answer selection/input
→ structured result builder
→ toolResult.details persisted in Pi JSONL
```

### Risks and Assumptions

- RISK: One component for every question shape may become a mini-framework. → MITIGATION: Implement the thinnest shared selector/input component that covers the supported modes; do not generalize beyond Card 4 schemas.
- RISK: UI-local return values may diverge from transcript details. → MITIGATION: The UI returns only inputs needed by the Card 4 builder; content/details are built in one place.
- ASSUMPTION: `ctx.ui.custom()` is available in the Brunch TUI extension path for this tool. → VALIDATE: Unit/fake-context test plus manual TUI smoke; if unavailable in a context, return `unavailable` details rather than blocking.

### Acceptance Criteria

✓ TUI fake-context tests prove single-select, multi-select, questionnaire, text/freeform, skip/cancel paths call the structured result builder and return terminal details.  
✓ The component is input-replacing for TUI and does not append a separate custom message as the canonical answer store.  
✓ Empty/invalid required answers remain in the UI until answered, skipped, or cancelled.  
✓ `npm run verify` passes.

### Verification Approach

- Inner: Component/tool unit tests with fake `ctx.ui.custom`.
- Middle: Manual TUI smoke or pty capture demonstrating an input-replacing question and JSONL inspection showing one terminal tool result with details.

### Cross-cutting obligations

- Preserve transcript-native structured elicitation (D37-L/I23-L).
- Keep UI adapters thin over the shared data/result model.
- Do not widen Pi command/keybinding behavior while adding this tool.

---

## Card 6 — RPC JSON-editor fallback for structured questions

**Status:** next  
**Weight:** full scope card

### Target Behavior

When rich TUI custom UI is unavailable over raw Pi RPC, the structured-question tool can round-trip the same semantic interaction through schema-tagged JSON in `ctx.ui.editor` and produce the same result details.

### Boundary Crossings

```text
→ structured-question Pi tool
→ ctx.ui.editor JSON prefill
→ raw Pi RPC extension_ui_request/response
→ JSON parse/validation
→ structured result builder from Card 4
→ Brunch product-facing relay/probe expectations
```

### Risks and Assumptions

- RISK: Exposing raw editor JSON as product UX would violate D38-L. → MITIGATION: Treat JSON-editor as compatibility adapter only; Brunch public RPC clients should see product-shaped pending interaction semantics in a later relay slice.
- RISK: Invalid edited JSON can produce ambiguous failure behavior. → MITIGATION: Validate with TypeBox; invalid/malformed responses become terminal `unavailable` or a clear validation error according to the tool contract decided in Card 4.
- ASSUMPTION: Pi RPC's documented editor request/response path is sufficient for this fallback. → VALIDATE: Raw Pi RPC probe based on `examples/rpc-extension-ui.ts` or equivalent local fixture.

### Acceptance Criteria

✓ Tests prove editor prefill JSON includes schema tag/version, mode, prompt/questions, options, and response instructions.  
✓ Tests prove valid edited JSON produces the same `toolResult.details` shape as the TUI adapter.  
✓ Tests prove malformed or schema-invalid edited JSON fails deterministically without producing a misleading `answered` result.  
✓ A raw Pi RPC probe/runbook demonstrates `ctx.ui.editor` fallback round-trips through documented extension UI protocol.  
✓ `npm run verify` passes.

### Verification Approach

- Inner: JSON prefill/parse/validation tests over the Card 4 schema and builder.
- Middle: Raw Pi RPC probe/runbook — proves the fallback works against Pi's actual extension UI messages.

### Cross-cutting obligations

- JSON-editor fallback is private adapter mechanics, not a second public Brunch API.
- Preserve one public Brunch RPC surface; raw Pi RPC remains behind adapters/probes.
- Keep structured result details self-contained and transcript-backed.

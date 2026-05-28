<!-- STRUCTURED_EXCHANGE_SIDE_MISSION.md — temporary side-mission scope.
     Created because memory/CARDS.md is currently owned by another in-flight builder.
     Delete or absorb after the prototype verdict is reconciled into SPEC/PLAN/CARDS/code. -->

# Structured Exchange Side Mission — JIT Editor Probe

## Orientation

- **Containing seam:** FE-744 `pi-ui-extension-patterns`, specifically the structured-exchange response surface in `src/pi-extensions/structured-exchange.ts` and its transcript replay rendering.
- **Frontier item:** `pi-ui-extension-patterns`; this side mission stays inside the existing FE-744 branch/Linear boundary and must not create a new tracker item.
- **Coordination:** do **not** edit `memory/CARDS.md` for this side mission while another builder thread owns the active card queue. This file is a temporary sidecar scope by explicit user request.
- **Main open risk:** the single just-in-time editor may feel better than the second note tab, but it may not be feasible with current `ctx.ui.custom()` focus/render constraints or may create ambiguous result payload semantics.

## Disambiguation findings to carry into the probe

- **Single global context field:** For option questions, there should be at most one additional text field for the whole response, regardless of single-select or multi-select.
- **JIT visibility:** The additional field appears only after a selection is made; no-selection does not reveal a freeform field.
- **Listed option semantics:** Selecting a listed option makes the JIT field optional additional context. Payload: selected `OptionAnswer`(s) plus `note` when non-empty.
- **Other semantics:** Selecting the built-in `Other` / `Something else` row makes the same JIT field required custom-answer text. Payload: one `OtherAnswer` with the custom text; `note` is empty/omitted.
- **Multi-select Other rule:** Tentative model for the probe: `Other` is exclusive in multi-select and deselects listed options. This is not yet a durable decision; the prototype should validate or reject it.
- **Replay rendering finding:** On transcript resume, Pi appears to replay only `renderResult`, not `renderCall`; therefore result rendering must be self-contained enough to show the question/context as well as the answer.
- **Review-set flow is deferred:** Review-set proposals likely need approve / request-changes / reject plus comments that can mention simulated proposal IDs, but this side mission should only note that future complexity. Do not solve review-set UI in this probe.

## Scope Card — JIT editor structured-exchange prototype

- **Status:** next
- **Weight:** full scope card — this probes a live interaction model and may change the production structured-exchange state machine/result rendering.

### Target Behavior

A throwaway structured-exchange prototype answers whether one inline just-in-time editor can replace the second note step across the option-selection permutations.

### Boundary Crossings

```text
→ local prototype command or narrowly marked prototype branch in structured-exchange tests
→ option-selection state machine mirroring ask_user_question single/multi modes
→ TUI-like render/input loop with picker focus and inline editor focus
→ payload projection examples for OptionAnswer / OtherAnswer / note
→ prototype verdict captured in this file or handoff
```

### Risks and Assumptions

- RISK: `pi-tui` `Editor` cannot comfortably render/focus inline beneath the picker for all option modes.
  → MITIGATION: build the probe near the current `ctx.ui.custom()` component and drive real `Editor` instances if possible; if not, record the exact technical blocker and fall back to state-machine-only evidence.
- RISK: JIT editor reduces tab complexity but reintroduces height/scroll problems in the active answer surface.
  → MITIGATION: prototype with compact prompt rendering: full question/context remains in transcript/tool-call render, active picker/editor stays short.
- RISK: multi-select editing creates stale note text when selections change.
  → MITIGATION: include scripted cases for selection changes after text entry; prototype must expose current state after each action.
- RISK: replay rendering bug is conflated with JIT interaction.
  → MITIGATION: treat replay as an adjacent acceptance candidate, not the main prototype question; record whether production `renderResult` should include prompt context.
- ASSUMPTION: A small prototype is cheaper than directly rewriting production `askSingleChoice` / `askMultiChoice`.
  → IMPACT IF FALSE: if the prototype is too artificial, production work still needs exploratory churn.
  → VALIDATE: the probe must exercise the same keyboard/focus primitives or clearly state where it diverges.
  → `memory/SPEC.md` §Assumptions: A23-L indirectly; this mostly informs FE-744 structured-exchange UX, not the public RPC parity assumption.

### Tracer-bullet check

- **Proof of life:** lights up the proposed no-second-tab interaction before production rewrite.
- **Invariants:** clarifies payload semantics for `OptionAnswer`, `OtherAnswer`, and global `note`.
- **Uncertainty:** attacks the open “is this even possible / does it feel usable?” question directly.

### Acceptance Criteria

✓ **exclusive listed option** — selecting a listed option focuses one inline optional context editor and can submit `{ answers: [OptionAnswer], note }`.

✓ **exclusive Other** — selecting `Other` focuses the same inline editor as a required custom-answer field and submits `{ answers: [OtherAnswer], note: "" }` or omits `note`.

✓ **inclusive listed options** — selecting multiple listed options uses one global optional context editor and submits sorted option answers plus one global note.

✓ **inclusive Other exclusivity** — selecting `Other` in multi-select clears listed options in the prototype, requires custom text, and submits one `OtherAnswer`.

✓ **no-selection state** — before any selection, no editor is shown and submission is unavailable.

✓ **selection-change behavior** — the prototype demonstrates what happens when selections change after editor text exists, with state visible after each action.

✓ **replay note** — the verdict records whether production `renderResult` must render `question` / `context` because resumed transcripts do not replay `renderCall`.

✓ **review-set note** — the verdict records that review-set comments with simulated proposal IDs and `#`-mention-like affordances are a later flow, not part of the option-question prototype.

### Verification Approach

- **Inner:** no production test gate required for a throwaway prototype; if any production or test code is touched, run `npm run fix` and `npm run check`.
- **Middle:** scripted interaction cases print state/render/payload for the six acceptance permutations above.
- **Outer:** human/user judgement on whether the inline editor feels clearer than the second tab and whether the `Other` semantics are legible.

### Cross-cutting obligations

- Keep prompt/question content transcript-backed and replayable; production result rendering must not rely solely on `renderCall` if resumed transcripts only replay `renderResult`.
- Do not introduce a parallel chat/turn store or non-transcript response state.
- Keep `Other` as an answer value, not a note, unless the prototype disproves this model.
- Keep review-set proposal/comment semantics out of this slice; only record future complexity.
- Do not mutate user-level Pi config or ambient `.pi` resources.

### Expected prototype verdict shape

```md
## Prototype Verdict: JIT editor structured exchange

**Command:** [exact command]
**What we tried:** [single listed, single Other, multi listed, multi Other, selection-change case]
**Verdict:** [JIT editor viable? production shape?]
**Absorb:** [state-machine/result-render changes to production]
**Delete:** [prototype file(s) or branch]
**Follow-up:** [scope card for production rewrite, if warranted]
```

## Candidate production slices after verdict

These are **not** active cards; they are likely follow-ups if the prototype is positive.

1. **Replace option-note second step with JIT editor** — rewrite `askSingleChoice` / `askMultiChoice` production UI around one inline editor and update tests.
2. **Make result rendering replay-self-contained** — update `renderResult` so resumed transcripts show question/context plus selected/rejected/note lines.
3. **Align RPC editor fallback payload examples** — adjust schema instructions/examples so listed-option notes and `OtherAnswer` custom text match the chosen payload semantics.
4. **Review-set flow design pass** — later: model review-set proposal IDs, approve/request-changes/reject, and comment editor with simulated `#`-mention affordance.

## Prototype Verdict: JIT editor structured exchange

**Branch:** UI
**Command:** `npx tsx src/pi-extensions/structured-exchange-jit-editor.prototype.ts`

**What we tried:** A throwaway state/render/payload probe in `src/pi-extensions/structured-exchange-jit-editor.prototype.ts` covering: no-selection hidden-editor state; single-select listed option with optional note; single-select `Other` with required custom text; multi-select listed options with one global note; multi-select `Other` exclusivity; and selection changes after editor text exists.

**Verdict:** The single JIT editor model is viable at the state/payload level and clearer than the second note tab. Production should keep one editor whose meaning changes by selection kind: listed options treat the text as optional global `note`; `Other` treats the text as the required `OtherAnswer` value and omits/empties `note`. The tentative multi-select `Other` exclusivity rule held up: selecting `Other` clears listed options and submits exactly one `OtherAnswer`. The only unresolved feel risk is low-level Pi focus/height behavior in the real `ctx.ui.custom()` component; the prototype is intentionally state-machine/render-level and did not instantiate real `pi-tui` `Editor` objects.

**Absorb:** Replace the option-note second step with one inline editor under the picker; keep submit disabled before any selection; focus the inline editor after a selection; preserve global note text across listed-option changes; treat switching to `Other` as converting the current editor text into the required custom answer; sort listed option answers by original index. Update result rendering so `renderResult` is self-contained: resumed transcripts appear to replay only `renderResult`, so production result display should include question/context (or a compact prompt summary) along with selected/rejected answers and note. Align RPC editor fallback instructions/examples to the same semantics: listed option answers plus `note`; `OtherAnswer` custom text plus omitted/empty `note`.

**Delete:** Delete `src/pi-extensions/structured-exchange-jit-editor.prototype.ts` after the production rewrite or after a scoped build explicitly rejects this direction. Delete or absorb this side-mission file after its findings are reconciled into canonical SPEC/PLAN and the active card queue.

**Follow-up:** Scope a production slice to implement the inline JIT editor in `askSingleChoice` / `askMultiChoice` and update tests; scope a second small slice if needed for replay-self-contained `renderResult`. Review-set comments with proposal IDs and `#`-mention-like affordances remain a later design pass, not part of option-question UI.

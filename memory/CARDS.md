<!-- CARDS.md — temporary execution queue for the active FE-744 frontier.
     Delete when exhausted or superseded. Canonical state remains in memory/SPEC.md and memory/PLAN.md. -->

# Cards — FE-744 structured exchange proof

## Orientation

- **Containing seam:** FE-744 `pi-ui-extension-patterns`, specifically the structured-exchange tool surface now hosted at `src/pi-extensions/structured-exchange.ts` with a project-local Pi loader at `.pi/extensions/structured-exchange.ts`.
- **Frontier item:** `pi-ui-extension-patterns`; these cards are slices inside the existing FE-744 Linear/branch boundary, not new tracker items.
- **Volatile state:** `HANDOFF.md` is absent; the working tree was clean before this queue was written. Canonical reconciliation for the newly remembered optional-note requirement has been applied to `memory/SPEC.md` and `memory/PLAN.md`.
- **Main open risk:** the TUI note step must not make the active `ctx.ui.custom()` surface tall again, and the RPC proof must falsify semantic parity rather than merely proving a low-level Pi editor request round-trips.

## Cross-cutting obligations for all cards

- Preserve Pi transcript truth: terminal structured exchange results must be self-contained in `toolResult.details` (or proof custom entry details where the probe directly exercises adapter helpers).
- Preserve linear transcript policy: no Pi branching, no parallel chat/turn store, and no mid-turn state outside the established Pi transcript / Brunch handler seams.
- Keep option-selection `note` separate from `Other`/custom answers: `Other` is an answer value; `note` is additional context attached to the selected answer(s).
- Keep full question/details content out of the focused picker unless a later explicit internal viewport slice is scoped.
- Do not mutate the user-level Pi extension/config under `/Users/lunelson/.pi/agent/`.

---

## Card 1 — Option-selection note step in TUI

- **Status:** done
- **Weight:** light build card inside a now-reconciled structural frontier

### Objective

Option-based structured exchanges advance from answer selection to a focused optional-note editor before submitting the terminal result.

### Acceptance Criteria

✓ Single-select mode moves to a note step after selecting a listed option or `Other`; the note editor is focused; pressing Enter submits even when empty.  
✓ Multi-select mode moves to a note step after activating Submit; the note editor is focused; pressing Enter submits even when empty.  
✓ Esc from the note step returns to the answer picker with prior selections preserved rather than cancelling the whole exchange.  
✓ `toolResult.details` for answered option modes includes a string `note` field, with `""` representing an intentionally empty note.  
✓ `Other` remains represented as an `OtherAnswer`; it is not folded into `note`.  
✓ `renderResult` shows the note only when non-empty while preserving the selected/rejected summary.  
✓ Text/freeform mode behavior is unchanged by this card.

### Verification Approach

- **Inner:** `npm run fix`; targeted `vitest` for structured-exchange tests; `npm run check`.
- **Middle:** component/state-machine tests drive the registered tool through fake `ctx.ui.custom()` callbacks for single-select and multi-select, including empty-note and non-empty-note submissions.
- **Outer:** optional manual TUI smoke to confirm the note step feels like a compact second tab/step and does not reintroduce tall active content.

### Promotion checklist

- [ ] Requirement already reconciled? Yes — SPEC/PLAN now name optional notes for option-selection exchanges.
- [ ] Creates/retires/invalidates an assumption? No.
- [ ] New seam-level invariant? No; implements the existing structured-result self-containment invariant.
- [ ] More than two major seams? No — TUI tool UI + result payload/rendering.

---

## Card 2 — RPC editor fallback carries option notes

- **Status:** done
- **Weight:** light build card, dependent on Card 1 result shape

### Objective

The structured-exchange tool can collect option answers plus optional notes through Pi RPC using schema-tagged JSON over `ctx.ui.editor()` instead of `ctx.ui.custom()`.

### Acceptance Criteria

✓ In an RPC-compatible path, single-select payloads include options, selected answer, and `note`.  
✓ In an RPC-compatible path, multi-select payloads include options, selected answers, and `note`.  
✓ Empty-note submissions round-trip as `note: ""`.  
✓ Invalid editor JSON returns a structured terminal failure or retry/error result without producing a malformed answered payload.  
✓ TUI `ctx.ui.custom()` behavior from Card 1 remains the rich path; RPC/editor fallback is an adapter over Pi-supported extension UI, not a new public Pi command family.

### Verification Approach

- **Inner:** `npm run fix`; targeted helper/adapter tests; `npm run check`.
- **Middle:** contract tests for JSON prefill/parse/validation prove the returned `toolResult.details` is self-contained for option answers plus notes.
- **Outer:** defer full subprocess RPC proof to Card 3.

### Promotion checklist

- [ ] Requirement already reconciled? Yes.
- [ ] Creates/retires/invalidates an assumption? No unless Pi RPC cannot express the fallback.
- [ ] New seam-level invariant? No; it exercises D38-L JSON-over-editor compatibility.
- [ ] More than two major seams? Borderline but acceptable: tool result model + Pi RPC editor adapter; public Brunch relay stays for later proof work.

---

## Card 3 — RPC structured-exchange evaluator proof

- **Status:** done
- **Weight:** light build/proof card, dependent on Card 2 RPC fallback

### Objective

A repeatable RPC probe demonstrates that an agent-as-user can complete an option-based structured exchange with an optional note and report blocker/friction findings.

### Acceptance Criteria

✓ The probe runs Pi in `--mode rpc` with the project structured-exchange extension or a minimal proof extension importing the same implementation/helpers.  
✓ The evaluator scenario declares mission/intention, UX or feature-evaluation focus, and max-turn budget in the probe fixture/result.  
✓ The scripted agent-as-user response selects at least one option and submits a non-empty note.  
✓ The captured terminal details include prompt/question, options, selected answer(s), rejected option context where applicable, `note`, mode, status, and transport/probe metadata sufficient for Brunch projection.  
✓ The probe emits a blocker/friction report even when no blockers are found.  
✓ A regression test fails if the RPC path silently drops `note` or only proves raw `extension_ui_request(editor)` without validating the structured result payload.

### Verification Approach

- **Inner:** `npm run fix`; targeted `vitest` for the RPC proof; `npm run check`.
- **Middle:** subprocess RPC proof analogous to `src/structured-question-rpc-proof.ts`, but shaped around structured exchange option selection plus note.
- **Outer:** manual review of the saved probe result/session snippet to confirm the transcript is intelligible as evidence, not just protocol noise.

### Promotion checklist

- [ ] Requirement already reconciled? Yes.
- [ ] Creates/retires/invalidates an assumption? No if it passes; if it fails, route to `ln-plan`/`ln-spike` because A5-L / FE-744 RPC proof pressure changes.
- [ ] New seam-level invariant? No; it adds coverage to existing structured-exchange/RPC obligations.
- [ ] More than two major seams? No for the proof harness; public web relay remains intentionally out of this queue.

## Not queued yet

- Web real-time update smoke should be scoped after Card 3, because its exact target should follow the proven RPC/public-surface shape rather than guessing ahead.
- Invocation-discipline tightening should be scoped separately after the transport proof, because it changes assistant-facing tool guidance rather than response semantics.

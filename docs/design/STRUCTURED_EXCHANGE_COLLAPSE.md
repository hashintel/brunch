# Structured Exchange: collapse the request side to a single server-routed `request_response`

> Status: **built** (single-terminal rename + present-side `present_question` merge + review collapse all landed 2026-06-23). `request_response` is the sole terminal, dispatching `present_question` and `present_review_set` by pending present tool; `request_review` is retired as a tool but preserved as a result-detail discriminant. Remaining frontier work (pieces 3–5 + `ln-review` graduation) is the broader discriminant-companion contract, tracked in `memory/PLAN.md`.
> Date: 2026-06-22; updated 2026-06-23.
> Scope: the structured-exchange **tool surface** — the `present_*` / `request_*` two-call grammar. This document records a Design-It-Twice (`ln-design`) exploration of three module shapes, the comparison, the chosen design, its load-bearing claims, and the tracer bullets that have now started landing.
>
> Governs / refines: `memory/SPEC.md` **I23-L** (structured-exchange tuple grammar), **D37-L/D38-L** (structured-exchange contract), **D84-L/D86-L** (live-exchange broker / TUI editor response surface). Companion: [REVIEW_SETS.md](REVIEW_SETS.md) (the review-set proposal payload), `src/.pi/extensions/exchanges/schemas/README.md` (the schema source boundaries).
>
> SPEC is the authoritative register; this document is rationale and texture for a not-yet-active frontier. When the design is built, its durable residue reconciles into SPEC (I23-L + a new/updated assumption) and this doc becomes the long-form companion.

## Why this note exists

The structured-exchange surface keeps producing the same class of live bug: **the agent mis-pairs the two-call grammar.** The FE-811 ship-gate runbook caught it directly — the agent presented a free-text question (`present_question`) then tried to collect the answer with `request_choice` (the multiple-choice collector), which is structurally illegal and was correctly rejected. The agent then mis-narrated its own recovery before landing on the legal `request_answer`.

That bug is one face of a recurring theme across the runbook (the "enforced-but-untaught" signal): the legal shape is *enforced* by Zod enums but the model must still *choose* the right terminal tool, and it chooses wrong. Two cheaper fixes already shipped (typing `present_review_set.payload`, `64fe9a41`; describing the pairing field + guideline, `95933e5f`). Those teach the rule better but do not remove the *decision*. This document designs the structural fix that removes the decision entirely.

## Background: the current two-call grammar

A structured exchange today is two tool calls:

```
chain
  present_*   ->  paints a durable markdown question/offer into the Pi JSONL
                  transcript as a toolResult (the recoverable anchor)
  request_*   ->  opens the interactive UI affordance (ctx.ui.editor / .select),
                  BLOCKS on the human, records the terminal answer
```

The legal pairs (`src/.pi/extensions/exchanges/schemas/shared.ts`, `tool_meta.curr/next`):

| present_* | legal request_* |
| --- | --- |
| `present_question` | `request_answer` |
| `present_options` | `request_choice` / `request_choices` |
| `present_candidates` | `request_choice` |
| `present_review_set` | `request_review` |

The model declares the pairing via a `respondsToPresentTool` param on the request tool. That field is where the mistake happens.

### The load-bearing constraint: recoverability

The two-call split is not arbitrary. Its value is entirely on the **present side**: the `present_*` `toolResult` is the durable transcript record of the question, and it **survives even if the user never answers** (the request half is interrupted, cancelled, or the session ends). On resume, `findIncompleteStructuredExchangePresents` (`src/.pi/extensions/exchanges/shared/recovery.ts`) scans the transcript for `present_*` results with no matching `request_*` result and re-surfaces them.

This is **I23-L**: *"a structured-exchange tuple has a recoverable `present_*` result and, when required, exactly one matching terminal `request_*` result before the next agent turn consumes it."* Any redesign must keep this recoverability clause true.

### The diagnosis that motivates the redesign

The split's load-bearing **value** is on the present side (durable, recoverable question). The recurring **bug** is on the request side (the model choosing the wrong terminal tool). These are separable. The right cut keeps the present side whole and removes choice from the request side.

## Three designs (Design-It-Twice)

Three radically different shapes were explored in parallel, each under a divergent constraint.

### Design A — Full collapse to `ask_*` tools

One tool per interaction type (`ask_freeform`, `ask_choice`, `ask_multi`, `ask_review`); each **paints the durable question AND opens the input affordance AND records the answer** in a single call. `respondsToPresentTool` ceases to exist.

```
data-shape
  ask_choice({ prompt, options[], defaultOptionId?, recoveryKey? })
    -> { kind: "choice", status: "answered"|"cancelled", selectedOptionId?, exchangeId }
```

- **Hides:** the present/request pairing, the legal-pair matrix, the present-vs-collect distinction, the TUI-vs-broker routing.
- **Recoverability mechanism:** the tool must **synchronously commit a durable `present`-phase checkpoint to the transcript BEFORE it blocks** on `ctx.ui`, then append a terminal result on answer. Recovery scans for `phase: "present"` checkpoints with no terminal.
- **Fatal uncertainty:** this requires Pi to support **committing a durable transcript toolResult from inside a still-running tool**. If Pi only writes `toolResult` after the tool returns, then under hard interruption the durable question is trapped inside the unfinished call and **I23-L cannot hold**. This is an unproven, load-bearing dependency on Pi's execution model.

### Design B — `present_*` + a single server-routed `request_response` (CHOSEN)

Keep all `present_*` tools (they remain the durable anchor — recoverability **unchanged**). Collapse the four `request_*` tools into **one** `request_response` tool whose UI mode (editor / select / multi / review) is **derived by the runtime from the pending present's type**, not declared by the model.

```
chain
  present_question({ heading, body, ... })
    -> durable toolResult + { exchangeId, responseKind: "answer" }   (server-owned)
  request_response({ exchangeId })
    -> runtime sees pending present_question -> opens editor -> records
       { kind: "answer", answer }
```

- **Hides:** the request-tool taxonomy, `respondsToPresentTool`, `tool_meta.next` as a model-facing contract, the editor-vs-select-vs-review UI routing, the TUI-vs-broker fallback.
- **Recoverability mechanism:** unchanged. `present_*` still emits the durable anchor exactly as today; recovery still finds unmatched presents and now offers the single legal continuation (`request_response`). No new Pi capability required.
- **Mis-pairing:** **unrepresentable** — there is no request-tool name for the model to get wrong. The terminal half is one polymorphic call routed by server-owned pending state.

### Design C — Derive-don't-trust (minimal)

Keep both call layers and all 8 tools; downgrade `respondsToPresentTool` to advisory and route the request by looking up the pending present's type, **ignoring the model's declaration**. A wrong-but-unambiguous request call is silently coerced onto the right behavior.

- **Hides:** the pairing decision's *consequences* (the runtime corrects them).
- **Recoverability:** unchanged (present side untouched).
- **Weakness:** it **coerces** rather than **prevents**. The model still emits the wrong call; the surface still presents 8 tools and a now-meaningless pairing field; residual risk remains (the model authoring the wrong *present* content, multiple ambiguous pending presents, the taxonomy still inviting the mistake). It treats the symptom, not the representable-wrong-state.

## Comparison

| Axis (Ousterhout) | A — collapse | B — `request_response` | C — derive |
| --- | --- | --- | --- |
| **Depth** | High but leaky (one tool owns paint+block+record+recovery) | **Highest clean** — `request_response` is a deep dispatcher; `present_*` stays a focused anchor | Medium — same 8 tools, behavior hidden in routing |
| **Kills mis-pair by construction** | yes (no pairing field) | **yes** (no request tool to name) | no (coerces, doesn't prevent) |
| **Recoverability risk** | **high** — unproven mid-tool checkpoint | **none** — present anchor unchanged | none |
| **Churn** | largest (8→4, three-layer + recovery rewrite) | medium (4 request→1; present untouched) | smallest |
| **Epistemic cost** | bets on an unverified Pi capability | bets only on "one dispatcher serves all request UIs" — cheaply testable | bets on "one pending present is unambiguous" — leaves silent-coercion debt |

**Decisive insight:** A and C both touch the present side — A *endangers* recoverability (the unproven checkpoint), C *preserves the bug* (coercion, not prevention). **B is the only design that cuts exactly at the joint:** present side whole (recoverability free, I23-L's anchor clause unchanged), request side collapsed (mis-pairing unrepresentable). B dominates A on epistemic cost (no unproven Pi dependency) and dominates C on correctness (prevents, not coerces).

## Chosen design: B, with C's mechanism as the migration bridge

End state is **B**: `present_*` tools unchanged; a single `request_response` tool; UI mode derived from the pending present; `respondsToPresentTool` and the request-tool taxonomy deleted.

Borrow **C's derive-from-pending mechanism as the migration path**: during transition, route any terminal call (legacy `request_*` or new `request_response`) through the same pending-present lookup, so the surface can migrate tool-by-tool without breaking mid-flight. The bridge is removed when all interaction types route through `request_response`.

### What changes across the three layers

- **`src/.pi/extensions/exchanges/`** — the four `request_*.ts` tools collapse into one `request-response.ts`; `present_*.ts` tools gain a server-owned `responseKind` on their result; `respondsToPresentTool` removed from params.
- **`src/projections/exchanges/`** — request projections collapse behind a normalized pending-exchange record (`{ presentToolName, exchangeId, responseKind, consumedAt? }`); recovery maps unmatched presents → `request_response`.
- **`src/agents/contexts/exchanges/`** — present renderers unchanged; the four request renderers collapse behind one dispatcher keyed by `responseKind`.
- **`schemas/`** — delete `respondsToPresentTool` and model-facing `tool_meta.next`; add a `request_response` params schema (`{ exchangeId }` + small shared options); `tool_meta.curr/next` becomes internal/derivation-only, no longer a model contract.

### Interaction with the broker / web-driver path (D84-L/D86-L)

`request_response` must serve **both** response surfaces the current request tools serve: the TUI `ctx.ui` editor/select (D86-L: TUI editor is authoritative when present) and the live-exchange broker (D84-L: web-driver fallback). The dispatcher routes UI *mode* by `responseKind` and routes *surface* by the existing D86-L precedence (interactive editor when present, else broker). This is an open detail to confirm during scoping — see claim 1.

## Load-bearing claims

1. **A single `request_response` dispatcher can serve all current request UIs (editor / select / multi / review) across both the TUI and broker surfaces without UX parity loss** — because the four request tools today differ only by UI mode and terminal payload shape, not by surface mechanics. *Not currently in `memory/SPEC.md` §Assumptions; add it when the build starts.* Highest-risk claim.
2. **The pending unmatched present is unambiguously identifiable at `request_response` time** (at most one open exchange per turn). Largely implied by I23-L's "exactly one matching terminal request before the next turn"; make explicit.
3. **Removing the request-tool taxonomy drops mis-pairing to zero** — trivially true by construction (no wrong tool to name). Not a risk, a definition.

## Recommended first tracer bullet

Add `request_response` for **`present_question` only**, behind the existing structured-exchange surface, leaving the other three pairs intact. **Landed 2026-06-23** as the first tracer:

- `present_question` emits `responseKind: "answer"` on its result.
- `request_response({ exchangeId })` finds the pending `present_question`, opens the **same editor path** `request_answer` uses (proving reuse), records the terminal answer, marks consumed.
- `recovery.ts` offers `request_response` for an unmatched `present_question`.

**Breaks if claim 1 is wrong** (the dispatcher cannot reuse the editor/broker path) — and proves the seam end-to-end on the dominant free-text case before migrating `options` / `review` / `candidates`. A tracer slice proves claim 1 more cheaply than a throwaway spike, so prefer `ln-scope` → `ln-build` over `ln-spike`.

## Relation to the shipped stopgaps

The two cheap fixes already landed (`64fe9a41`, `95933e5f`) annotate and teach the *current* grammar. When this collapse lands, the `respondsToPresentTool` `.describe()` additions from `95933e5f` are **deleted with the field** — they were explicitly the now-half of a "teach now, delete later" plan. This document is the "delete later" design.

## Adjacent gaps this design does NOT close (evidence from the 2026-06-22 runbook)

A later runbook run surfaced two findings that bound this design's scope. Both are quality/legibility gaps, not correctness bugs (the exchanges completed; the agent self-corrected to `mutate_graph`), but they show the collapse addresses only one of three sub-problems. All three are faces of the same recurring **"enforced-but-untaught"** signal that ran through the whole FE-811 runbook.

### Gap 1 — the present-side selection gap (NOT fixed by the request-side collapse)

The collapse makes the *request* side unrepresentable-wrong, but the agent must still pick the right **present** tool — and it does so badly, in the *inverse* of the original bug. Twice in one run the agent used `present_question` (free-text) while authoring a genuinely **multiple-choice** question, embedding an enumerated candidate list in markdown prose ("The real situations: — New-from-scratch — Brownfield — Continuation. Which one, or more?") then collecting a free-text answer. The structured-choice machinery (`present_options` + `request_choice`, which captures a selectable option id) was bypassed.

This is the same root as the original mis-pairing, one tool earlier: **the present-tool selection (`question` vs `options`) is under-guided.** The model does not reliably map "I am offering a finite set of answers" → `present_options`. The current `present_question` guideline mentions "for a multiple-choice question, use present_options instead" but buries it in a pairing-focused line; it is not catching.

**Design implication:** the request-side collapse (B) does not touch this. The sharper structural fix would extend the collapse to the *present* side too — a single `present` (or `ask`) surface taking an optional `options[]`, where **the presence of options determines choice-vs-freeform**, making the present selection structural rather than a model decision. That is a strictly larger redesign than B; weigh it as a phase 2: B removes request-side mis-pairing first (proven dominant bug), then a present-side merge removes selection error. Until then, the cheap mitigation is richer `present_question`/`present_options` descriptions naming the choosing rule (a present-side analogue of `95933e5f`).

### Gap 2 — the review-set nested payload shape is still invisible to the model

The `64fe9a41` top-level payload typing fix **worked**: in this run `present_review_set.payload` arrived as a proper object with all six top-level keys (no JSON string). But it surfaced the *next* layer — the deep validator correctly rejected `grounding` as a string (should be `{summary, support[]}`), a missing required `epistemicStatus`, and a malformed `pitch`. The boundary schema only guarantees `schemaVersion: 1`, so the **rich nested shape stays invisible** and the model guesses the nested fields.

**Design implication:** independent of the collapse, the review-set nested payload needs the same `.describe()`/typing treatment the top level got — either describe the nested `grounding`/`pitch`/`entityDrafts`/`edgeDrafts` shape in the boundary schema, or (better, post-collapse) `ask_review` takes typed structured params instead of an opaque nested payload. A small describe-pass like `95933e5f`; deferrable but cheap.

## Status / next

Chosen and **built**. The `request_response`-for-`present_question` tracer landed first: `request_response({ exchangeId })` finds the unmatched prompt from the session transcript and shares the same TUI-editor → live-broker → unavailable dispatcher as `request_answer`. The present-side merge landed as `present_question`: no `options` derives free-text `answer`, `options` derives single `choice`, and `options + multiple` derives `choices`. The review collapse then folded `request_review` into `request_response`: `request_response.execute` is a thin router on the pending present's `tool_meta.curr` — `present_question` to the answer/choice/choices sources, `present_review_set` to the extracted `shared/review-source.ts` (approve/request-changes/reject) — and `request_review` is retired as a tool while its result details are preserved. Choice, multi-choice, and review paths reuse the TUI select/editor flows and return `unavailable` without `ctx.ui` rather than inventing broker surfaces. **Update (2026-06-24):** the `present_candidates` stub has since been un-stubbed under `elicitor-generate` (FE-1059, commits `9a6219e9`/`be0b8765`); `request_response` now dispatches a pending `present_candidates` through `collectChoiceFromUi` (single pick, emitting `request_choice` → `capture_candidate`), so the legal-pair table row above is live, not stubbed. Remaining: the review-set nested-payload describe-pass (piece 3) and the wider discriminant-companion pieces 4–5 in `memory/PLAN.md`.

# Structured Exchange: collapse the request side to a single server-routed `respond`

> Status: **design proposal** (chosen shape, not yet built).
> Date: 2026-06-22.
> Scope: the structured-exchange **tool surface** — the `present_*` / `request_*` two-call grammar. This document records a Design-It-Twice (`ln-design`) exploration of three module shapes, the comparison, the chosen design, its load-bearing claims, and the recommended first tracer bullet. It does **not** change behavior; it is the durable rationale for the eventual build.
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

### Design B — `present_*` + a single server-routed `respond` (CHOSEN)

Keep all `present_*` tools (they remain the durable anchor — recoverability **unchanged**). Collapse the four `request_*` tools into **one** `respond` tool whose UI mode (editor / select / multi / review) is **derived by the runtime from the pending present's type**, not declared by the model.

```
chain
  present_question({ heading, body, ... })
    -> durable toolResult + { exchangeId, responseKind: "answer" }   (server-owned)
  respond({ exchangeId })
    -> runtime sees pending present_question -> opens editor -> records
       { kind: "answer", answer }
```

- **Hides:** the request-tool taxonomy, `respondsToPresentTool`, `tool_meta.next` as a model-facing contract, the editor-vs-select-vs-review UI routing, the TUI-vs-broker fallback.
- **Recoverability mechanism:** unchanged. `present_*` still emits the durable anchor exactly as today; recovery still finds unmatched presents and now offers the single legal continuation (`respond`). No new Pi capability required.
- **Mis-pairing:** **unrepresentable** — there is no request-tool name for the model to get wrong. The terminal half is one polymorphic call routed by server-owned pending state.

### Design C — Derive-don't-trust (minimal)

Keep both call layers and all 8 tools; downgrade `respondsToPresentTool` to advisory and route the request by looking up the pending present's type, **ignoring the model's declaration**. A wrong-but-unambiguous request call is silently coerced onto the right behavior.

- **Hides:** the pairing decision's *consequences* (the runtime corrects them).
- **Recoverability:** unchanged (present side untouched).
- **Weakness:** it **coerces** rather than **prevents**. The model still emits the wrong call; the surface still presents 8 tools and a now-meaningless pairing field; residual risk remains (the model authoring the wrong *present* content, multiple ambiguous pending presents, the taxonomy still inviting the mistake). It treats the symptom, not the representable-wrong-state.

## Comparison

| Axis (Ousterhout) | A — collapse | B — `respond` | C — derive |
| --- | --- | --- | --- |
| **Depth** | High but leaky (one tool owns paint+block+record+recovery) | **Highest clean** — `respond` is a deep dispatcher; `present_*` stays a focused anchor | Medium — same 8 tools, behavior hidden in routing |
| **Kills mis-pair by construction** | yes (no pairing field) | **yes** (no request tool to name) | no (coerces, doesn't prevent) |
| **Recoverability risk** | **high** — unproven mid-tool checkpoint | **none** — present anchor unchanged | none |
| **Churn** | largest (8→4, three-layer + recovery rewrite) | medium (4 request→1; present untouched) | smallest |
| **Epistemic cost** | bets on an unverified Pi capability | bets only on "one dispatcher serves all request UIs" — cheaply testable | bets on "one pending present is unambiguous" — leaves silent-coercion debt |

**Decisive insight:** A and C both touch the present side — A *endangers* recoverability (the unproven checkpoint), C *preserves the bug* (coercion, not prevention). **B is the only design that cuts exactly at the joint:** present side whole (recoverability free, I23-L's anchor clause unchanged), request side collapsed (mis-pairing unrepresentable). B dominates A on epistemic cost (no unproven Pi dependency) and dominates C on correctness (prevents, not coerces).

## Chosen design: B, with C's mechanism as the migration bridge

End state is **B**: `present_*` tools unchanged; a single `respond` tool; UI mode derived from the pending present; `respondsToPresentTool` and the request-tool taxonomy deleted.

Borrow **C's derive-from-pending mechanism as the migration path**: during transition, route any terminal call (legacy `request_*` or new `respond`) through the same pending-present lookup, so the surface can migrate tool-by-tool without breaking mid-flight. The bridge is removed when all interaction types route through `respond`.

### What changes across the three layers

- **`src/.pi/extensions/exchanges/`** — the four `request_*.ts` tools collapse into one `respond.ts`; `present_*.ts` tools gain a server-owned `responseKind` on their result; `respondsToPresentTool` removed from params.
- **`src/projections/exchanges/`** — request projections collapse behind a normalized pending-exchange record (`{ presentToolName, exchangeId, responseKind, consumedAt? }`); recovery maps unmatched presents → `respond`.
- **`src/renderers/exchanges/`** — present renderers unchanged; the four request renderers collapse behind one dispatcher keyed by `responseKind`.
- **`schemas/`** — delete `respondsToPresentTool` and model-facing `tool_meta.next`; add a `respond` params schema (`{ exchangeId }` + small shared options); `tool_meta.curr/next` becomes internal/derivation-only, no longer a model contract.

### Interaction with the broker / web-driver path (D84-L/D86-L)

`respond` must serve **both** response surfaces the current request tools serve: the TUI `ctx.ui` editor/select (D86-L: TUI editor is authoritative when present) and the live-exchange broker (D84-L: web-driver fallback). The dispatcher routes UI *mode* by `responseKind` and routes *surface* by the existing D86-L precedence (interactive editor when present, else broker). This is an open detail to confirm during scoping — see claim 1.

## Load-bearing claims

1. **A single `respond` dispatcher can serve all current request UIs (editor / select / multi / review) across both the TUI and broker surfaces without UX parity loss** — because the four request tools today differ only by UI mode and terminal payload shape, not by surface mechanics. *Not currently in `memory/SPEC.md` §Assumptions; add it when the build starts.* Highest-risk claim.
2. **The pending unmatched present is unambiguously identifiable at `respond` time** (at most one open exchange per turn). Largely implied by I23-L's "exactly one matching terminal request before the next turn"; make explicit.
3. **Removing the request-tool taxonomy drops mis-pairing to zero** — trivially true by construction (no wrong tool to name). Not a risk, a definition.

## Recommended first tracer bullet

Add `respond` for **`present_question` only**, behind the existing structured-exchange surface, leaving the other three pairs intact:

- `present_question` emits `responseKind: "answer"` on its result.
- `respond({ exchangeId })` finds the pending `present_question`, opens the **same editor path** `request_answer` uses (proving reuse), records the terminal answer, marks consumed.
- `recovery.ts` offers `respond` for an unmatched `present_question`.

**Breaks if claim 1 is wrong** (the dispatcher cannot reuse the editor/broker path) — and proves the seam end-to-end on the dominant free-text case before migrating `options` / `review` / `candidates`. A tracer slice proves claim 1 more cheaply than a throwaway spike, so prefer `ln-scope` → `ln-build` over `ln-spike`.

## Relation to the shipped stopgaps

The two cheap fixes already landed (`64fe9a41`, `95933e5f`) annotate and teach the *current* grammar. When this collapse lands, the `respondsToPresentTool` `.describe()` additions from `95933e5f` are **deleted with the field** — they were explicitly the now-half of a "teach now, delete later" plan. This document is the "delete later" design.

## Status / next

Chosen but **not scheduled**. By the FE-811 framing this is post-runbook structural work. When picked up: `ln-scope` the `respond`-for-`present_question` tracer (claim 1), then migrate the remaining interaction types, then delete the request-tool taxonomy + `respondsToPresentTool` + the stopgap describes, and reconcile I23-L to the single-terminal-call grammar.

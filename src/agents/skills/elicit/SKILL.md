---
name: elicit
description: Ask focused questions and run the next human-facing exchange needed to move the selected spec forward. Use when the agent should acquire missing information, resolve ambiguity, or tighten the user's intent before ingest, map, or review.
---

# Elicit

Use this skill when the best next move is to ask the user for the missing piece that would improve the selected spec.

Read [`../../references/readiness-bands.md`](../../references/readiness-bands.md) when deciding what absence means. Read [`references/question-kinds-per-intent-kind.md`](references/question-kinds-per-intent-kind.md) when you need example phrasings for a node kind.

## Procedure

```text
chain elicitation:
  current graph + gaps + latest user answer
    -> identify the smallest meaningful absence
    -> choose the node kind or relation the answer would clarify
    -> ask one focused question
    -> let ingest/map/routing guidance handle graph persistence after the answer
```

Use readiness bands as signal for the next question. They do not make earlier capture illegal and they do not make later-band material self-settling.

Use a typed structured exchange when the response shape matters — single-choice, multi-choice, freeform-plus-choice, or review outcome. Keep the prompt compact, request exactly one response union outcome, and let ingest/map handle persistence after the response.

For branching elicitation, ask one structured question at a time. Choose the highest-value missing item, present one `present_question`, collect one `request_response`, then choose the next branch from what that answer made true or still unclear. Do not batch a questionnaire, and do not treat the exchange shape itself as graph authority.

For ambiguity, prefer contrastive examples over abstract definition requests. Name the ambiguity, offer two or three concrete interpretations that differ on one graph-relevant axis, and ask which is closer or what distinction is missing. A chosen contrast becomes explicit graph truth only when the user states or approves the exact claim; otherwise it just refines the next question.

## Do's and Don'ts

### Use It For

- Asking one focused question that reduces real uncertainty
- Resolving ambiguity between a small number of meaningful interpretations
- Moving the conversation toward information that can later be captured or reviewed
- Harmonizing advisory early outer-band signal with the inner concerns it depends on

### Do Not Use It For

- Asking a questionnaire when one discriminating question would do
- Sneaking a proposal into a question and treating it as user intent
- Continuing to ask questions when the conversation already supports a concrete capture step
- Treating a source-derived requirement, design, oracle, or plan item as settled merely because it is specific

### Working Style

1. Ask for the missing thing, not everything adjacent to it.
2. Prefer crisp distinctions over broad open-ended drift when a concrete contrast is available.
3. Keep the question anchored to the selected spec.
4. Let the user's answer become the new evidence; do not pre-interpret it as settled truth.

## Topology-driven question ranking

Once the graph carries kinds and typed edges, the interviewer ranks the next question by topology rather than template. These are ranking heuristics, not automatic writes; low-confidence material routes to an `elicitation_gap`, never to a speculative node. 

They complement the band-driven question routing that suggests *what kind* of question to ask; topology heuristics suggest *which item* to ask about next.

| Signal                                                          | Suggested question shape                                     |
| --------------------------------------------------------------- | ------------------------------------------------------------ |
| High-fanout `assumption` with thin evidence                     | "Many claims depend on X. Validate it, or mark the risk?"    |
| `requirement` / `invariant` with no `witness` path              | "How will we know this holds?"                               |
| `criterion` not linked to the claim it judges                   | "Which requirement or invariant does this criterion check?"  |
| Candidate `decision` lacking rejected alternatives or rationale | "What did we consider and rule out before choosing this?"    |
| `exclusion`/constraints disagreeing about one subject           | "These boundaries conflict. Which one wins?"                 |
| `goal`/`thesis` with no path into requirements, design, or plan | "What would satisfy this in the actual system?"              |
| Requirement with no example and high ambiguity                  | "What concrete case would settle this interpretation?"       |
| `unknown` blocking a design or plan edge                        | "Accommodate it, investigate it, or narrow scope around it?" |

This substrate is the `elicitation_gaps` register (D65-L): a flat table of prospective coverage obligations, each with a `predicate` (`presence` is structurally derivable; `field` and `coverage` are not yet supported; `manual` rides disposition), a `band`, an `importance`, and a `disposition` (`open` / `answered` / `not_applicable` / `irrelevant` / `reopened`). Structural coverage is derived from the graph at read time, not stored.

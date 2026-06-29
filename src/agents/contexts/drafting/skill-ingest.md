---
name: ingest
description: "Ingest source material into the selected spec — a human answer, a pasted block, a referenced document/URL, or a bounded brownfield area — through one banded capture sweep. Not for relating existing nodes (edge authoring), committing a settled batch (commit-graph), or auditing accepted truth (review-for-gaps)."
---

# Method: ingest (draft)

> Draft skill (scratch; not wired). This file demonstrates the consolidated shape for generalized-content ingestion. It is **not** enumerated in `agents/runtime/state.ts` / `agents/registry.ts`, so it is inert and advertises nothing. It collapses the four current acquisition modes (`elicit-by-question`, `ingest-paste`, `read-referenced-documents`, `explore-and-characterize`) into one deep procedure with *source* as the only shallow branch.
>
> Source of truth: the band-walk [`slice-band-walk.md`](slice-band-walk.md), kind selection [`slice-kind-selection.md`](slice-kind-selection.md), confidence/conflict routing [`slice-promotion-capture.md`](slice-promotion-capture.md), edges [`slice-edge-authoring.md`](slice-edge-authoring.md); generated vocabulary [`graph-ontology.md`](../references/graph-ontology.md). Cite these; do not restate their tables (D97-L).

Ingest is one procedure: whatever the source, material enters the transcript, a banded capture sweep turns it into graph truth or agenda, then you ask from the updated world. The source only changes how the material arrives and whether it needs a digest first.

## Procedure

```
chain ingest:
  identify source (ask | paste | reference | brownfield)
    -> digest if raw/large           (reference + brownfield: required; paste: if large; ask: n/a)
    -> banded capture sweep          (walk slice-band-walk over digest + conversation)
    -> route by confidence/conflict  (slice-promotion-capture: truth | gap | reconciliation)
    -> ask from the updated graph + gaps
```

Each step ends on a checkable criterion:

1. **Identify source.** Name the source in ordinary language. Done when the source and its provenance phrasing are explicit.
2. **Digest if raw/large.** For a referenced document or brownfield area, read with legal read tools and write an assistant-authored digest in the transcript that separates direct claims from interpretation and names open uncertainties; raw tool output stays background. Done when the sweep has a bounded digest to work from, not unbounded raw bulk. (Skip for a direct human answer; optional for a small paste.)
3. **Banded capture sweep.** Walk [`slice-band-walk.md`](slice-band-walk.md) over the digest + conversation, classifying each span to a kind ([`slice-kind-selection.md`](slice-kind-selection.md)). Done when every span is either classified to a kind or deliberately abstained — none left as untyped prose.
4. **Route by confidence/conflict.** Send each classified span to its substrate ([`slice-promotion-capture.md`](slice-promotion-capture.md)): high-confidence → graph truth (`explicit` / `implicit`); low-confidence → `elicitation_gap`; contradiction → `reconciliation_need`. Relate only settled endpoints with edges ([`slice-edge-authoring.md`](slice-edge-authoring.md)). Done when nothing low-confidence is committed and no contradiction was written as truth.
5. **Ask from the updated world.** Compose the next question over the updated graph + gaps, not the pre-ingest state.

## Source branch

The only thing that differs by source is arrival + whether a digest is required:

```
matrix source -> conduct
policy: exclusive (one source per ingest)

source     | trigger                                   | digest?  | provenance phrasing
-----------|-------------------------------------------|----------|---------------------------
ask        | the human is the authority for the answer | no       | "you said…"
paste      | user pasted a block of text/notes/logs    | if large | "from your pasted …"
reference  | user named files / URLs / tickets         | yes      | "from <named source>"
brownfield | an existing codebase/area needs a map     | yes      | "from <area> as inspected"
```

- ask: the human is the source; do not read or search just because a question *could* be researched.
- paste: do not require saving to a file before learning from it.
- reference: use only legal read tools; `web_fetch` for a known URL, `web_search` only when external context would change the next move.
- brownfield: smallest useful reconnaissance bounded by the user's area and the current gap; do not crawl for completeness.

## Anti-goals (one source of truth for all sources)

- Do not treat every sentence as a graph node.
- Do not make raw tool output the capture source for bulk material; digest first.
- Do not launder ambiguous material into graph truth to avoid a follow-up question.
- Do not bypass the capture sweep with direct graph claims in prose.
- Do not run a product-side extraction pass or revive observer/auditor queues; this is transcript conduct plus the standard sweep.

## If promoted (not in scope now)

To wire this, it becomes `src/agents/skills/methods/ingest/SKILL.md` enumerated in `agents/runtime/state.ts` + `agents/registry.ts`. The four current acquisition modes either collapse into the source branch here or shrink to thin trigger-shells that delegate to it; `capture` keeps the banded sweep (this skill cites it rather than duplicating it). That restructuring touches the sealed skills tree and is out of scope for this drafting pass.

---
name: capture
description: Capture source material into the selected spec — a human answer, a pasted block, a referenced document/URL, or a bounded brownfield area — through one banded capture sweep. 
---

# Capture

Capture is one procedure: whatever the source, material enters the transcript, a banded capture sweep turns it into settled graph truth, advisory graph signal, or agenda, then you ask from the updated world. The source only changes how the material arrives and whether it needs a digest first.

Canonical readiness-band concepts live in [`../../contexts/about/readiness-bands.md`](../../contexts/about/readiness-bands.md). Use this skill for the capture conduct that applies those concepts.

## Procedure

```
chain `capture`:
  identify source (ask | paste | reference | brownfield)
    -> digest if raw/large           (reference + brownfield: required; paste: if large; ask: n/a)
    -> banded capture sweep          (walk slice-band-walk over digest + conversation)
    -> route by confidence/conflict/settlement
       (settled truth | advisory signal | gap | reconciliation)
    -> ask from the updated graph + gaps
```

Each step ends on a checkable criterion:

1. **Identify source.** Name the source in ordinary language. Done when the source and its provenance phrasing are explicit.
2. **Digest if raw/large.** For a referenced document or brownfield area, read with legal read tools and write an assistant-authored digest in the transcript that separates direct claims from interpretation and names open uncertainties; raw tool output stays background. Done when the sweep has a bounded digest to work from, not unbounded raw bulk. (Skip for a direct human answer; optional for a small paste.)
3. **Banded capture sweep.** Walk [`slice-band-walk.md`](slice-band-walk.md) over the digest + conversation, classifying each span to a kind. Done when every span is either classified to a kind or deliberately abstained — none left as untyped prose.
4. **Route by confidence/conflict/settlement.** Send each classified span to its substrate: harmonized high-confidence material → settled graph truth (`basis: explicit` / `implicit`); reviewed but not-yet-harmonized source material → advisory graph signal; low-confidence material → `elicitation_gap`; contradiction → `reconciliation_need`. Done when nothing low-confidence is committed and no contradiction was written as truth.
5. **Ask from the updated world.** Compose the next question over the updated graph + gaps, not the pre-capture state.

### Routing per source type

- ask: the human is the source; do not read or search just because a question *could* be researched.
- paste: do not require saving to a file before learning from it.
- reference: use only legal read tools; `web_fetch` for a known URL, `web_search` only when external context would change the next move.
- brownfield: smallest useful reconnaissance bounded by the user's area and the current gap; do not crawl for completeness.

```
matrix source -> conduct
policy: exclusive (one source per capture)

| source     | trigger                                   | digest?  | provenance phrasing        |
| ---------- | ----------------------------------------- | -------- | -------------------------- |
| ask        | the human is the authority for the answer | no       | "you said…"                |
| paste      | user pasted a block of text/notes/logs    | if large | "from your pasted …"       |
| reference  | user named files / URLs / tickets         | yes      | "from <named source>"      |
| brownfield | an existing codebase/area needs a map     | yes      | "from <area> as inspected" |
```

### Anti-goals (one source of truth for all sources)

- Do not treat every sentence as a graph node.
- Do not make raw tool output the capture source for bulk material; digest first.
- Do not launder ambiguous material into graph truth to avoid a follow-up question.
- Do not launder reviewed arbitrary-source material into settled commitments just because it is specific or already structured.
- Do not bypass the capture sweep with direct graph claims in prose.
- Do not run a product-side extraction pass or revive observer/auditor queues; this is transcript conduct plus the standard sweep.

## Methodology

...

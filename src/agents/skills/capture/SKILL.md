---
name: capture
description: Capture source material into the selected spec — a human answer, a pasted block, a referenced document/URL, or a bounded brownfield area — through one banded capture sweep. 
---

# Capture

Capture is one procedure: whatever the source, material enters the transcript, a banded capture sweep turns it into settled graph truth, advisory graph signal, or agenda, then you ask from the updated world. The source only changes how the material arrives and whether it needs a digest first.

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

1. **Identify source.** Name the source in ordinary language. Done when the source and its provenance phrasing are explicit.
2. **Digest if raw/large.** For a referenced document or brownfield area, read with legal read tools and write an assistant-authored digest in the transcript that separates direct claims from interpretation and names open uncertainties; raw tool output stays background. Done when the sweep has a bounded digest to work from, not unbounded raw bulk. (Skip for a direct human answer; optional for a small paste.)
3. **Banded capture sweep.** Walk [`slice-band-walk.md`](slice-band-walk.md) over the digest + conversation, classifying each span to a kind. Done when every span is either classified to a kind or deliberately abstained — none left as untyped prose.
4. **Route by confidence/conflict/settlement.** Send each classified span to its substrate: harmonized high-confidence material → settled graph truth (`basis: explicit` / `implicit`); reviewed but not-yet-harmonized source material → advisory graph signal; low-confidence material → `elicitation_gap`; contradiction → `reconciliation_need`. Done when nothing low-confidence is committed and no contradiction was written as truth.
5. **Ask from the updated world.** Compose the next question over the updated graph + gaps, not the pre-capture state.

### Digest (if needed)

| source type | trigger                                   | digest?  | provenance phrasing        |
| ----------- | ----------------------------------------- | -------- | -------------------------- |
| ask         | the human is the authority for the answer | no       | "you said…"                |
| paste       | user pasted a block of text/notes/logs    | if large | "from your pasted …"       |
| reference   | user named files / URLs / tickets         | yes      | "from <named source>"      |
| brownfield  | an existing codebase/area needs a map     | yes      | "from <area> as inspected" |

- **ask**: the human is the source; do not read or search just because a question *could* be researched.
- **paste**: do not require saving to a file before learning from it.
- **reference**: use only legal read tools; `web_fetch` for a known URL, `web_search` only when external context would change the next move.
- **brownfield**: smallest useful reconnaissance bounded by the user's area and the current gap; do not crawl for completeness.

### Sweep

```
chain capture-sweep:
  unswept transcript tail
    -> classify each span by modality (see slice-kind-selection)
    -> promote context to its sharpest kind
    -> route by confidence/conflict (table below)
    -> mutate_graph / update_elicitation_gaps / raise reconciliation_need
    -> compose next question over the updated graph + gaps
```

## Method

Walk readiness bands as concern envelopes, not as workflow stages. Capture whatever the source actually supports, then assign the right route: gap, reconciliation need, advisory graph item, or settled graph item.

```text
chain capture-band-walk:
  ingested material (digest + conversation)
    -> GROUND  establish the initiative frame
    -> ELICIT  expand the working middle
    -> PROJECT harmonize requirements/design/oracles
    -> COMMIT  harden obligations and sequencing
  ANYTIME: band-less kinds are capturable wherever they surface
```

### Ground

- Routing question: "What outcome, for whom and why, is true about the world, and what is ruled out?"
- Capture rule: anchor `goal` / `thesis` when supported; use `context` / `constraint` for the frame only when sharper kinds do not fit.
- Completion signal: the smallest missing frame becomes an `elicitation_gap`; do not ask deeper just to make the graph look complete.

### Elicit

- Routing question: "What is believed but falsifiable, what is unknown, what was chosen, what must remain true, and what bounds the space?"
- Capture rule: preserve epistemic shape. Do not launder `unknown` into `assumption`, `constraint` into `invariant`, or broad description into `context` when a sharper kind is available.
- Completion signal: open forks are either captured, made into gaps, or routed to reconciliation.

### Project

- Routing question: "What requirements, design shape, or oracle machinery follows from the settled inner concerns?"
- Capture rule: source-derived `requirement`, `module`, `interface`, `entity`, `check`, `evidence`, `vv_method`, and `vv_obligation` may be persisted as advisory when reviewed but not yet harmonized.
- Completion signal: projected items name the intent they serve through edges or remain advisory/gap material until support is clear.

### Commit

- Routing question: "What is binding now, how will we judge it, and how is the work sequenced?"
- Capture rule: commitment-band material (`criterion`, `milestone`, `frontier`, `slice`) captured early is early outer-band signal unless it has survived review against the inner concerns.
- Completion signal: commitments are promoted, rewritten, superseded, or reconciled. They are not auto-settled merely because they appeared in a source document.

---
name: ingest
description: Ingest source material for the selected spec — a human answer, pasted block, referenced document/URL, or bounded brownfield area — by digesting it and handing graph-worthy material to map/routing guidance.
---

# Ingest

Ingest owns how source material arrives and how its provenance is phrased. It does not own graph ontology: use [`../map/references/map-nodes.md`](../map/references/map-nodes.md), [`../map/references/map-edges.md`](../map/references/map-edges.md), and [`../map/references/routing.md`](../map/references/routing.md) when deciding what graph item, edge, or non-truth substrate the material becomes.

## Procedure

```
chain ingest:
  identify source (ask | paste | reference | brownfield)
    -> digest if raw/large           (reference + brownfield: required; paste: if large; ask: n/a)
    -> map graph-worthy spans        (kinds, edges, design/oracle/plan guidance live under ../map/)
    -> route by confidence/conflict  (settled truth | advisory signal | gap | reconciliation)
    -> ask from the updated graph + gaps
```

1. **Identify source.** Name the source in ordinary language. Done when the source and its provenance phrasing are explicit.
2. **Digest if raw/large.** For a referenced document or brownfield area, read with legal read tools and write an assistant-authored digest in the transcript that separates direct claims from interpretation and names open uncertainties; raw tool output stays background. Done when the sweep has a bounded digest to work from, not unbounded raw bulk. (Skip for a direct human answer; optional for a small paste.)
3. **Map graph-worthy spans.** Use map references to classify spans to the sharpest supported kind and author only confident relations. Done when every useful span is either mapped, deliberately abstained, or named as missing support.
4. **Route by confidence/conflict/settlement.** Use [`../map/references/routing.md`](../map/references/routing.md) to send mapped material to settled graph truth, advisory graph signal, `elicitation_gap`, or `reconciliation_need`. Done when nothing low-confidence is committed and no contradiction was written as truth.
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
chain ingest-sweep:
  unswept transcript tail
    -> classify each span by graph role
    -> promote context to its sharpest supported kind
    -> route by confidence/conflict
    -> mutate_graph / update_elicitation_gaps / raise reconciliation_need
    -> compose next question over the updated graph + gaps
```

## Method

Walk readiness bands as concern envelopes, not as workflow stages. Ingest whatever the source actually supports, then assign the right route: gap, reconciliation need, advisory graph item, or settled graph item.

```text
chain ingest-band-walk:
  ingested material (digest + conversation)
    -> GROUND  establish the initiative frame
    -> ELICIT  expand the working middle
    -> PROJECT harmonize requirements/design/oracles
    -> COMMIT  harden obligations and sequencing
  ANYTIME: band-less kinds are capturable wherever they surface
```

### Ground

- Routing question: "What outcome, for whom and why, is true about the world, and what is ruled out?"
- Ingest rule: anchor `goal` / `thesis` when supported; use `context` / `constraint` for the frame only when sharper kinds do not fit.
- Completion signal: the smallest missing frame becomes an `elicitation_gap`; do not ask deeper just to make the graph look complete.

### Elicit

- Routing question: "What is believed but falsifiable, what is unknown, what was chosen, what must remain true, and what bounds the space?"
- Ingest rule: preserve epistemic shape. Do not launder `unknown` into `assumption`, `constraint` into `invariant`, or broad description into `context` when a sharper kind is available.
- Completion signal: open forks are either captured, made into gaps, or routed to reconciliation.

### Project

- Routing question: "What requirements, design shape, or oracle machinery follows from the settled inner concerns?"
- Ingest rule: source-derived `requirement`, `module`, `interface`, `entity`, `check`, `evidence`, `vv_method`, and `vv_obligation` may be persisted as advisory when reviewed but not yet harmonized.
- Completion signal: projected items name the intent they serve through edges or remain advisory/gap material until support is clear.

### Commit

- Routing question: "What is binding now, how will we judge it, and how is the work sequenced?"
- Ingest rule: commitment-band material (`criterion`, `milestone`, `frontier`, `slice`) captured early is early outer-band signal unless it has survived review against the inner concerns.
- Completion signal: commitments are promoted, rewritten, superseded, or reconciled. They are not auto-settled merely because they appeared in a source document.

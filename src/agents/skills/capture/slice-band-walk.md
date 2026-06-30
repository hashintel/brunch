# Slice: Capture Band Walk

Support slice for generalized capture. The canonical readiness concepts and latest-band table live in [`../../contexts/about/readiness-bands.md`](../../contexts/about/readiness-bands.md); this file owns only the capture walk.

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

## Ground

- Routing question: "What outcome, for whom and why, is true about the world, and what is ruled out?"
- Capture rule: anchor `goal` / `thesis` when supported; use `context` / `constraint` for the frame only when sharper kinds do not fit.
- Completion signal: the smallest missing frame becomes an `elicitation_gap`; do not ask deeper just to make the graph look complete.

## Elicit

- Routing question: "What is believed but falsifiable, what is unknown, what was chosen, what must remain true, and what bounds the space?"
- Capture rule: preserve epistemic shape. Do not launder `unknown` into `assumption`, `constraint` into `invariant`, or broad description into `context` when a sharper kind is available.
- Completion signal: open forks are either captured, made into gaps, or routed to reconciliation.

## Project

- Routing question: "What requirements, design shape, or oracle machinery follows from the settled inner concerns?"
- Capture rule: source-derived `requirement`, `module`, `interface`, `entity`, `check`, `evidence`, `vv_method`, and `vv_obligation` may be persisted as advisory when reviewed but not yet harmonized.
- Completion signal: projected items name the intent they serve through edges or remain advisory/gap material until support is clear.

## Commit

- Routing question: "What is binding now, how will we judge it, and how is the work sequenced?"
- Capture rule: commitment-band material (`criterion`, `milestone`, `frontier`, `slice`) captured early is early outer-band signal unless it has survived review against the inner concerns.
- Completion signal: commitments are promoted, rewritten, superseded, or reconciled. They are not auto-settled merely because they appeared in a source document.

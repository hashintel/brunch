# Slice: the band-walk (ingestion movements)

> Draft injectable context slice (scratch; not wired). Inject as the procedural backbone for generalized-content ingestion: the order in which the elicitor walks readiness bands while sweeping ingested material into graph truth. Source of truth for the kind→band table is [`graph-ontology.md`](../../contexts/references/graph-ontology.md) (D94-L); kind selection is [`slice-kind-selection.md`](slice-kind-selection.md); confidence/conflict routing is [`slice-promotion-capture.md`](slice-promotion-capture.md). This slice owns the *walk* (a procedure), not the vocabulary (a lookup).

Readiness bands are `grounding → elicitation → projection → commitment` (plus band-less kinds), derived per-kind by the schema (D94-L). Walked as a procedure, they are four **movements** the elicitor moves through while ingesting any source material. Bands guide *what to look for and ask next*; they **do not gate truth** — if the user states a later-movement item early, capture it honestly with the right kind and basis.

```
chain band-walk:
  ingested material (digest + conversation)
    -> GROUND   establish the initiative frame
    -> ELICIT   expand the working middle
    -> PROJECT  materialize structure (design / oracle)
    -> CLOSE    harden obligations + sequence the work
  ANYTIME: term / example / sketch are capturable in any movement
```

## GROUND — grounding band

- Gathers: `goal`, `thesis`, `context`, `constraint` (band membership: cite ontology).
- Routing question: "What outcome, for whom and why, is true about the world, and what is ruled out?"
- Completion: the initiative frame is anchored (problem / for-whom / value / bounding context present as truth) or the smallest missing anchor is a spawned gap. Do not push deeper just to look complete.

(reconciliation: the sketch's "pitch" = `thesis`.)

## ELICIT — elicitation band

- Gathers: `context`, `story`, `unknown`, `assumption`, `constraint`, `invariant`, `decision`.
- Routing question: "What is believed-but-falsifiable, what is an acknowledged unknown, what was chosen among alternatives, what must stay true, what bounds the space?"
- Completion: open forks captured as truth or gaps; tentative language preserved as `assumption` / `unknown`, not laundered into commitment.

(reconciliation: the sketch placed `story` under ANYTIME and omitted `invariant`; canonically both are elicitation-band.)

## PROJECT — projection band

Projection is gated: do not materialize structure ahead of a settled-enough intent frame. The sketch splits this into two sub-movements:

- design — `module`, `interface`, `entity`. Routing question: "How is it shaped?"
- oracle — `check`, `vv_method`, `evidence`, `vv_obligation`. Routing question: "How is it checked or evidenced?"
- Completion: a projection node only when the intent it serves is settled — each design node realizes a claim (`realization`), each oracle node witnesses one (`witness`).

(reconciliation: the sketch placed `check` under CLOSURE; canonically `check` is projection-band, and `entity` / `evidence` belong here too.)

## CLOSE — commitment band

- Gathers: `requirement`, `criterion`; plan kinds `milestone`, `frontier`, `slice`.
- Routing question: "What must the system do, how will we judge it, and how is the work sequenced?"
- Completion: commitments are reviewed; `requirement` / `criterion` become truth via the user's direct statement or an accepted review set, not auto-promoted from a sweep.

(reconciliation: the sketch grouped `milestone` / `frontier` under PROJECTION:PLAN; canonically plan kinds are commitment-band, and `slice` belongs here too.)

## ANYTIME — band-less

`term`, `example`, `sketch` carry no readiness band; capture them in whatever movement they surface. `term` fixes lexicon; `example` is a witness (pair with a `witness` edge, stance `for` / `against`); `sketch` is advisory design, not yet hardened.

## Sketch → canonical reconciliation (overlay)

```
matrix sketch-group -> canonical band
policy: overlay (procedural; no schema change)

sketch group        | canonical band | reconciliation
--------------------|----------------|--------------------------------------------------
GROUNDING           | grounding      | "pitch" = thesis
ELICITATION         | elicitation    | + invariant; + story (sketch put story in ANYTIME)
ANYTIME             | band-less      | term, example, sketch (story is elicitation-band)
PROJECTION:DESIGN   | projection     | + entity
PROJECTION:ORACLE   | projection     | + evidence; check is projection (sketch put it in CLOSURE)
PROJECTION:CLOSURE  | commitment     | requirement, criterion
PROJECTION:PLAN     | commitment     | milestone, frontier, + slice
```

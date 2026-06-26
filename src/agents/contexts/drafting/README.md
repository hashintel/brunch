# agents/contexts/drafting/ — scratch, not wired

Draft, isolated experiments. Nothing here is runtime prompt payload, packaged into agent assets, cited by a skill/prompt, or imported by code. This directory exists to develop candidate context material before any decision to promote it.

Promoting anything from here into `src/agents/contexts/references/` is a separate, deliberate step: a runtime-eligible reference needs a named skill/prompt reader under D97-L, and the generated vocabulary tables ([`../references/graph-ontology.md`](../references/graph-ontology.md)) remain the source of truth that authored slices cite rather than restate.

## Contents

- [`intent-graph-semantics.md`](intent-graph-semantics.md) — the design-reasoning synthesis: the current ontology (4 planes / 24 kinds / 4 bands, 9 edge categories, `detail`/`detail.form`, reconciliation + elicitation substrates) with the rationale preserved from the recovered `INTENT_GRAPH_SEMANTICS.md`. Read this for *why*; read the slices for *do this now*.
- `slice-*.md` — compact, model-facing injectable slices distilled from that synthesis (reference tier: vocabulary + judgment).
- [`skill-ingest.md`](skill-ingest.md) — a draft method skill (step tier) for generalized-content ingestion: one deep procedure with *source* as a shallow branch, citing the slices. Demonstrates the consolidated shape that would replace the four live acquisition modes.

## Injectable slices — when to inject which

```
policy: cumulative   (more than one slice may apply to a turn)

slice                          | inject when the agent is…                       | primary readers
-------------------------------|-------------------------------------------------|-----------------------------
slice-kind-selection.md        | picking a node `kind` for new graph truth        | elicitor capture, generate
slice-edge-authoring.md        | relating two nodes (which category + stance)     | commit-graph, generate
slice-detail-payloads.md       | creating decision/term, or attaching detail.form | capture, generate
slice-promotion-capture.md     | sweeping a turn into truth/gaps/reconciliation   | capture, review-for-gaps
slice-band-walk.md             | walking bands while ingesting/sweeping material  | capture, ingest
slice-neighborhood-reading.md  | consuming an anchored context pack to reason     | any agent reading graph context
slice-plane-authoring.md       | generating coherent intent/oracle/design/plan    | generate-proposal (per lens)
```

`slice-plane-authoring.md` is section-anchored (`#intent`, `#oracle`, `#design`, `#plan`) so a per-lens caller can inject one plane's conduct rather than the whole file.

## Skill drafts

- [`skill-ingest.md`](skill-ingest.md) — the consolidated generalized-content ingestion method (step tier). It sequences the slices: identify source → digest-if-raw → banded capture sweep ([`slice-band-walk.md`](slice-band-walk.md) + [`slice-kind-selection.md`](slice-kind-selection.md)) → route by confidence/conflict ([`slice-promotion-capture.md`](slice-promotion-capture.md)) → ask. It collapses the four live acquisition modes into one deep procedure with *source* as the only shallow branch.

## Design rationale (meta-skill-design)

These drafts apply the meta-skill-design levers:

- **Description as routing surface.** `skill-ingest`'s `description` front-loads the leading word (ingest/acquire) and names one trigger per source branch, disambiguated from `capture` (the sweep), edge authoring, and review.
- **Deep module, simple interface.** One ingestion procedure; *source* is the only shallow branch. The four live acquisition modes split a single behavior four ways and duplicate one spine — `skill-ingest` shows the merged shape.
- **Single source of truth.** The band-walk, kind selection, confidence routing, and edge grammar each live in one slice; the skill cites them rather than restating tables (honors D97-L).
- **Reference tier vs step tier.** `slice-*.md` are reference (vocabulary + judgment); `skill-ingest.md` is the sequencing step layer that cites them. Progressive disclosure runs skill → slices → generated `graph-ontology.md`.
- **Completion criteria.** Each ingest step ends on a checkable, exhaustive criterion ("every span classified or abstained") to resist premature completion.

## Slice form conventions

Slices use the `pseudo` notations — `matrix` decision tables (with explicit `policy:`), `chain` flows, `graph` node/edge lists, `data-shape` YAML — plus markdown tables, kept terse and activation-dense. Each slice header states its purpose, its inject-trigger, and the source of truth it cites. A slice is operational ("do this"); the synthesis doc is explanatory ("why").

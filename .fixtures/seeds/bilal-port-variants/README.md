# `.fixtures/seeds/bilal-port-variants/`

Small, reproducible base variants derived from the consolidated Bilal port for product-path fixture curation runs.

## `macro-view-grounded-intent.json`

Source: `../bilal-port/macro-view.json`.

Profile: `grounded-intent`.

Deterministic filter, implemented in [`_variant-script.ts`](./_variant-script.ts):

- keep only intent-plane nodes
- keep only `basis: explicit` rows
- keep only nodes whose `source` starts with `stakeholder`, `external-observed`, or `technical-observed`
- keep only edges whose endpoints both survive the node filter
- rewrite `local_id` and edge endpoint ids densely from 1 in source order
- emit spec slug `macro-view-grounded-intent`

The variant is curated starting truth for tracer runs. Product-created curation output is not merged back into this reusable seed; mixed-basis evidence belongs under `.fixtures/runs/fixture-curation/<run-id>/`.

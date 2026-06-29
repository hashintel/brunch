# agents/skills/ — Brunch activity guidance

SPEC decisions: D25-L, D39-L, D52-L, D58-L, D59-L, D85-L, D95-L, D98-L

## Owns

Activity-named homes for Brunch-authored model-facing guidance. The live elicitor does not negotiate prompt-resource manifests; active conduct currently lives in the fixed prompt body and code-owned tool/context policy. The pre-D98 strategy/lens/method taxonomy is quarantined under `_suspended/`.

These are Brunch-authored model-facing prompt resources, not product data models and not ambient filesystem discovery inputs.

## Layout

```text
skills/
├── README.md
├── __fixtures__/unlisted-fixture/SKILL.md  test-only sealing fixture
├── capture/{README,SKILL}.md               live capture conduct home
├── context/{README,SKILL}.md               live context-reading conduct home
├── elicit/{README,SKILL}.md                live elicitation conduct home
├── project/{README,SKILL}.md               live graph projection conduct home
├── review/{README,SKILL}.md                live review conduct home
└── _suspended/                             quarantined prompt-resource taxonomy
    ├── README.md
    ├── strategies/<name>/SKILL.md          reusable interaction shapes
    ├── lenses/<name>/SKILL.md              topical focus lenses
    └── methods/<name>/SKILL.md             tool-routing and sequencing guidance
        └── references/*.md                 optional disclosed reference payloads
```

The live activity homes now each carry a lightweight Agent Skills–compliant `SKILL.md` so the activity topology is explicit and ready for future activation, even though the live elicitor does not currently negotiate prompt-resource manifests from them.

Each quarantined prompt-resource directory has a `SKILL.md` with YAML frontmatter (`name`, `description`) plus the instruction body. These resources are excluded from normal discovery and testing.

## Boundary rules

```pseudo
rules:
  agents/runtime/elicitor/      x> agents/skills/_suspended/ [no live prompt-resource negotiation]
  agents/skills/**/SKILL.md      x> TypeScript imports      [read-only prompt resources]
  agents/skills/                 x> graph mutation          [guidance only]
```

The legacy legal set is quarantined and no longer part of live registry or runtime discovery. The former `goals` family is retired by D85-L; the elicitor objective postures are retired from the live elicitor prompt.

`_suspended/` is the quarantine target for strategy/lens/method resources now that the live elicitor manifest no longer consults them. It is not a discovery directory and does not make resources live by filesystem presence.

## Prompt-resource sub-shapes

- **`references/` subfiles:** available under the Agent Skills standard when a concrete live skill needs progressive disclosure. The quarantined legacy instance is `_suspended/methods/generate-proposal/references/`.
- **Shared typed-vocab context references:** materialized at `src/agents/contexts/references/graph-ontology.md`, the runtime-eligible shared context-reference home for generated node-kind/band, edge-policy, detail-payload, and `detail.form` vocabulary that prompt resources cite rather than restate (D97-L). Generated from the typed graph schema sources via `npm run generate:ontology` and drift-checked by `npm run check:data-model` (wired into `npm run check`); read-only and locked separately from the authored prompt-resource body lock below.
- **Shared authored context references:** materialized at `src/agents/contexts/references/graph-authoring-heuristics.md` when two or more prompt resources need the same judgment rules. These files cite generated vocabulary references for kind/band tables and carry only shared conduct; skill-specific sequencing stays in the owning `SKILL.md`.

## Prompt-resource body lock ledger

User-approved COMPOSE disposition (updated 2026-06-22): the git-tracked `SKILL.md` body is the body lock. `composeAgentPrompt` emits only manifest name/description/location metadata; it does not transform or inline resource bodies, so copy-goldening these files would not lock additional behavior. The existing manifest resource test keeps every advertised skill body readable, repo-owned, frontmatter-valid, and at least 700 characters.

| Family | Resource | Required? | Lock disposition |
| --- | --- | --- | --- |
| strategies | `freestyle/SKILL.md` | required | Source file + manifest readability invariant; excluded from AUTO by `state.ts`. |
| strategies | `step-wise-decision-tree/SKILL.md` | required | Source file + manifest readability invariant. |
| strategies | `step-wise-disambiguate/SKILL.md` | required | Source file + manifest readability invariant. |
| lenses | `design/SKILL.md` | required | Source file + manifest readability invariant. |
| lenses | `intent/SKILL.md` | required | Source file + manifest readability invariant. |
| lenses | `oracle/SKILL.md` | required | Source file + manifest readability invariant. |
| methods | `commit-graph/SKILL.md` | required | Source file + manifest readability invariant; capability-gated by selected-spec gaps. |
| methods | `generate-proposal/SKILL.md` | required | Source file + manifest readability invariant; capability-gated by selected-spec gaps. |
| methods | `capture/SKILL.md` | required | Source file + manifest readability invariant; canonical home for FE-861 capture conduct and the D81-L commitment gradient. |
| methods | `elicit-by-question/SKILL.md` | required | Source file + manifest readability invariant; D82-L direct conversational acquisition mode. |
| methods | `ingest-paste/SKILL.md` | required | Source file + manifest readability invariant; D82-L pasted-material acquisition mode. |
| methods | `read-referenced-documents/SKILL.md` | required | Source file + manifest readability invariant; D82-L bounded document-read mode with assistant digest before capture. |
| methods | `explore-and-characterize/SKILL.md` | required | Source file + manifest readability invariant; D82-L bounded brownfield exploration mode with assistant digest before capture. |
| methods | `read-context/SKILL.md` | required | Source file + manifest readability invariant. |
| methods | `review-for-gaps/SKILL.md` | required | Source file + manifest readability invariant; audit-only, capability-gated by selected-spec gaps. |
| methods | `run-structured-exchange/SKILL.md` | required | Source file + manifest readability invariant. |
| fixtures | `__fixtures__/unlisted-fixture/SKILL.md` | test-only | Proves filesystem presence under `skills/` is not advertisement. |

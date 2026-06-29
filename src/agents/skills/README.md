# agents/skills/ — Brunch prompt-resource skills

SPEC decisions: D25-L, D39-L, D52-L, D58-L, D59-L, D85-L, D95-L, D98-L

## Owns

Agent Skills-standard prompt resources the Brunch Pi session agent reads on demand after Brunch runtime policy advertises them. The pre-D98 strategy/lens/method taxonomy is suspended as live elicitor authority; useful prompt guidance may be regrouped around durable activities as later slices prove the new shape.

These are Brunch-authored model-facing prompt resources, not product data models and not ambient filesystem discovery inputs.

## Layout

```text
skills/
├── README.md
├── __fixtures__/unlisted-fixture/SKILL.md  test-only sealing fixture
├── strategies/<name>/SKILL.md              reusable interaction shapes
├── lenses/<name>/SKILL.md                  topical focus lenses
├── methods/<name>/SKILL.md                 tool-routing and sequencing guidance
│   └── references/*.md                     optional disclosed reference payloads
└── suspended/README.md                     quarantine home for retired taxonomy resources
```

Each legacy prompt-resource directory has a `SKILL.md` with YAML frontmatter (`name`, `description`) plus the instruction body. `name` must equal the parent directory and the code-owned id in `agents/runtime/suspended/state.ts`.

## Boundary rules

```pseudo
rules:
  agents/runtime/suspended/state.ts -> agents/skills/*/*/SKILL.md [explicit code-owned legacy path list via agents/registry.ts]
  agents/runtime/suspended/state.ts -> pi loadSkills(includeDefaults:false, skillPaths=[...])
  agents/skills/**/SKILL.md      x> TypeScript imports [read-only prompt resources]
  agents/skills/                 x> graph mutation     [guidance only]
```

The legacy legal set is sealed by the code-owned path list in `agents/runtime/suspended/state.ts`; adding a `SKILL.md` does not make it available until that table enumerates it. `src/agents/registry.ts` owns file locations. Frontmatter owns `name` and `description`; code owns family, legality, and location enumeration. The former `goals/` family is retired by D85-L; the elicitor objective postures are retired from the live elicitor prompt.

`suspended/` is the quarantine target for strategy/lens/method resources once the live elicitor manifest stops consulting them. It is not a discovery directory and does not make resources live by filesystem presence.

## Prompt-resource sub-shapes

- **`references/` subfiles:** available under the Agent Skills standard when a concrete skill needs progressive disclosure. No empty reference directories are introduced. The first materialized instance is `methods/generate-proposal/references/`, where the shared `SKILL.md` points to plane-specific payloads without advertising those payloads as separate skills.
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

# agents/skills/ — prompt-resource skill homes

SPEC decisions: D52-L, D58-L, D85-L, D95-L, D97-L, D98-L

## Owns

`src/agents/skills/` owns Brunch-authored prompt-resource guidance that may be cited or loaded by agents. Live homes are activity-named; the retired strategy/lens/method taxonomy is quarantined under `_suspended/`.

```text
skills/
├── elicit/        questioning conduct
├── ingest/        source intake, digest, and provenance conduct
├── propose/       proposal generation conduct
├── analyze/       orientation and selected-spec synthesis conduct
├── map/           graph-mapping ontology and relation guidance
├── review/        review and review-set conduct
├── _suspended/    legacy strategy/lens/method resources
└── __fixtures__/  registry guard fixtures only
```

## Skill Routing

The live elicitor should choose skill guidance by the work move it is making, not by the old strategy/lens/method taxonomy. These homes are peers; no activity skill owns orchestration for the others.

| Move      | Use when...                                                                 | Typical handoff                        |
| --------- | --------------------------------------------------------------------------- | -------------------------------------- |
| `analyze` | current selected-spec or graph truth could change the next move             | `elicit`, `propose`, or `review`       |
| `elicit`  | the next missing material should come from the user                         | `ingest` / `map` after the answer      |
| `ingest`  | material arrives from a paste, reference, document, URL, or brownfield area | `map` and routing                      |
| `propose` | the agent should generate candidate material for user recognition or review | `present_*` flows, `map`, or `review`  |
| `map`     | response, source, or proposal material needs graph expression               | graph mutation, gap, or reconciliation |
| `review`  | existing or proposed material needs critique before further commitment      | `elicit`, `propose`, or `map`          |

If this table is rendered into a future `<brunch-skills>` manifest, keep it compact and operational: it should help the model pick the next prompt resource, not restate each `SKILL.md`.

## Boundary Rules

```pseudo
rules:
  agents/skills/* x> TypeScript imports [read-only prompt resources]
  agents/runtime/elicitor x> agents/skills/_suspended/ [live elicitor does not negotiate legacy axes]
  agents/skills/map/references/ -> graph/schema + graph/policy [cite schema-owned vocabulary]
  agents/skills/ingest/ -> agents/skills/map/references/ [delegate graph kind/edge mapping]
  agents/skills/* -> agents/references/readiness-bands.md [cite readiness terminology]
```

## Migration Note

D98-L suspends strategy/lens/method as runtime axes. Useful conduct moves into activity homes only when it is live guidance; historical or compatibility prompt resources remain under `_suspended/` and are not available merely because a file exists.

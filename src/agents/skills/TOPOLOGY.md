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

## Boundary Rules

```pseudo
rules:
  agents/skills/* x> TypeScript imports [read-only prompt resources]
  agents/runtime/elicitor x> agents/skills/_suspended/ [live elicitor does not negotiate legacy axes]
  agents/skills/map/references/ -> graph/schema + graph/policy [cite schema-owned vocabulary]
  agents/skills/ingest/ -> agents/skills/map/references/ [delegate graph kind/edge mapping]
  agents/skills/* -> agents/contexts/about/readiness-bands.md [cite readiness terminology]
```

## Migration Note

D98-L suspends strategy/lens/method as runtime axes. Useful conduct moves into activity homes only when it is live guidance; historical or compatibility prompt resources remain under `_suspended/` and are not available merely because a file exists.

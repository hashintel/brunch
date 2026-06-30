# agents/skills/ — prompt-resource skill homes

SPEC decisions: D52-L, D58-L, D85-L, D95-L, D97-L, D98-L

## Owns

`src/agents/skills/` owns Brunch-authored prompt-resource guidance that may be cited or loaded by agents. Live homes are activity-named; the retired strategy/lens/method taxonomy is quarantined under `_suspended/`.

```text
skills/
├── elicit/        focused question + typed-response conduct
├── ingest/        source intake, digest, and provenance conduct
├── propose/       fan-out / compare / fan-in proposal conduct
│   └── references/ intent/design/oracle branch payloads + review-set drafting aid
├── analyze/       orientation and edge-local selected-spec reading conduct
├── map/           graph vocabulary, routing, persistence-boundary guidance
├── review/        critique, plane weakness heuristics, and next-move routing
├── tutorial/      product walkthrough and operator help
├── _suspended/    audited legacy strategy/lens/method resources
└── __fixtures__/  registry guard fixtures only
```

Only directories with a routable `SKILL.md` are live prompt-resource homes. Empty staging folders are not part of the live routing surface.

## Skill Routing

The live elicitor chooses skill guidance by the work move it is making, not by the old strategy/lens/method taxonomy. These homes are peers; no activity skill owns orchestration for the others.

| Move | Use when... | Typical handoff |
| --- | --- | --- |
| `analyze` | current selected-spec or graph truth could change the next move; an anchor needs edge-local reading | `elicit`, `propose`, or `review` |
| `elicit` | the next missing material should come from the user | `ingest` / `map` after the answer |
| `ingest` | material arrives from a paste, reference, document, URL, or brownfield area | `map` and routing |
| `propose` | the agent should generate candidate material for user recognition or review | `present_*` flows, `map`, or `review` |
| `map` | response, source, or proposal material needs graph expression or routing | graph mutation, gap, reconciliation, or review set |
| `review` | existing or proposed material needs critique before further commitment | `elicit`, `propose`, or `map` |
| `tutorial` | the user wants a walkthrough of Brunch itself, current capabilities, or how to get started | concrete next step in the product |

If this table is rendered into a future `<brunch-skills>` manifest, keep it compact and operational: it should help the model pick the next prompt resource, not restate each `SKILL.md`.

## Boundary Rules

```pseudo
rules:
  agents/skills/* x> TypeScript imports [read-only prompt resources]
  agents/runtime/elicitor x> agents/skills/_suspended/ [live elicitor does not negotiate legacy axes]
  agents/skills/propose -> agents/skills/map/references/ [graph expression/persistence boundary]
  agents/skills/map/references/ -> graph/schema + graph/policy [cite schema-owned vocabulary]
  agents/skills/ingest/ -> agents/skills/map/references/ [delegate graph kind/edge/routing]
  agents/skills/review/ -> agents/skills/analyze/ [review depends on enough local orientation]
  agents/skills/* -> agents/references/readiness-bands.md [cite readiness terminology]
```

## Migration Note

D98-L suspends strategy/lens/method as runtime axes. Useful conduct has been lifted into activity homes only where it is live guidance:

- `generate-proposal` → `propose` plus `propose/references/{intent,design,oracle,present-review-set}.md`
- `read-context` → `analyze` plus `analyze/references/neighborhoods.md`
- `review-for-gaps` → `review`
- acquisition/capture/commit/exchange methods → decomposed across `ingest`, `map`, `propose`, `elicit`, and product exchange contracts

Historical or compatibility prompt resources remain under `_suspended/` and are not available merely because a file exists.

# agents/skills/ — prompt-resource skill homes

SPEC decisions: D52-L, D58-L, D85-L, D95-L, D97-L, D98-L, D100-L

## Owns

`src/agents/skills/` owns Brunch-authored prompt-resource guidance that may be cited or loaded by agents. Live homes are activity-named and sit exactly one directory below `skills/`; nested directories under a live home are references, not additional skills.

```text
skills/
├── elicit/        focused question + typed-response conduct
├── ingest/        source intake, digest, and provenance conduct
├── propose/       fan-out / compare / fan-in proposal conduct
│   └── references/ intent/design/oracle branch payloads + review-set drafting aid
├── project/       cross-plane derivation conduct from accepted upstream graph anchors
├── analyze/       orientation and edge-local selected-spec reading conduct
├── map/           graph vocabulary, routing, persistence-boundary guidance
├── review/        critique, plane weakness heuristics, and next-move routing
├── tutorial/      product walkthrough and operator help
├── registry.ts    code-owned live skill manifest for prompt injection
└── __fixtures__/  registry guard fixtures only
```

Only first-level directories with a routable `SKILL.md` are live prompt-resource homes. Empty staging folders, nested references, and fixtures are not part of the live routing surface.

## Skill Routing

The live elicitor chooses skill guidance by the work move it is making, not by the old strategy/lens/method taxonomy. These homes are peers; no activity skill owns orchestration for the others.

| Move | Use when... | Typical handoff |
| --- | --- | --- |
| `analyze` | current selected-spec or graph truth could change the next move; an anchor needs edge-local reading | `elicit`, `propose`, or `review` |
| `elicit` | the next missing material should come from the user | `ingest` / `map` after the answer |
| `ingest` | material arrives from a paste, reference, document, URL, or brownfield area | `map` and routing |
| `propose` | the agent should generate candidate material for user recognition or review inside a target plane | `present_*` flows, `map`, or `review` |
| `project` | accepted upstream graph anchors should derive downstream plane material, such as intent → design or design → oracle | `present_candidates`, `present_review_set`, then `map` for exact graph expression |
| `map` | response, source, proposal, or projection material needs graph expression or routing | graph mutation, gap, reconciliation, or review set |
| `review` | existing or proposed material needs critique before further commitment | `elicit`, `propose`, or `map` |
| `tutorial` | the user wants a walkthrough of Brunch itself, current capabilities, or how to get started | concrete next step in the product |

If this table is rendered into a future `<brunch-skills>` manifest, keep it compact and operational: it should help the model pick the next prompt resource, not restate each `SKILL.md`.

## Boundary Rules

```pseudo
rules:
  agents/skills/* x> TypeScript imports [read-only prompt resources]
  agents/skills/registry.ts -> agents/skills/{analyze,elicit,ingest,map,project,propose,review,tutorial}/SKILL.md [first-level live manifest only]
  agents/skills/propose -> agents/skills/map/references/ [graph expression/persistence boundary]
  agents/skills/project -> agents/skills/map/references/ [projection drafts use existing graph expression/persistence boundary]
  agents/skills/map/references/ -> graph/schema + graph/policy [cite schema-owned vocabulary]
  agents/skills/ingest/ -> agents/skills/map/references/ [delegate graph kind/edge/routing]
  agents/skills/review/ -> agents/skills/analyze/ [review depends on enough local orientation]
  agents/skills/* -> agents/references/readiness-bands.md [cite readiness terminology]
```

## Migration Note

D98-L retired strategy/lens/method as live runtime or manifest axes. Useful conduct was lifted into activity homes only where it remains live guidance:

- `generate-proposal` → `propose` plus `propose/references/{intent,design,oracle,present-review-set}.md`
- cross-plane derivation → `project` (first-level live home) using the existing exchange triad and `map` / review-set commitment boundary
- `read-context` → `analyze` plus `analyze/references/neighborhoods.md`
- `review-for-gaps` → `review`
- acquisition/capture/commit/exchange methods → decomposed across `ingest`, `map`, `propose`, `elicit`, and product exchange contracts
- strategy interaction tactics → `src/agents/prompts/elicitor.md` and `elicit`
- lens plane heuristics → `elicit`, `review`, and `propose/references/{intent,design,oracle}.md`

There is no legacy runtime manifest tree left in `src/agents/skills/`: if a skill is live, it appears in the first-level registry above; if guidance is not there, it is not switchable product state.

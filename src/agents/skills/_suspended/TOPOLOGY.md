# agents/skills/_suspended/ — audited suspended prompt-resource taxonomy

SPEC decisions: D25-L, D52-L, D85-L, D95-L, D98-L

## Owns

`src/agents/skills/_suspended/` is the quarantine home for prompt resources organized by the retired strategy/lens/method taxonomy when those resources no longer participate in the live elicitor manifest. Many files now contain disposition stubs because their surviving conduct has been lifted into live activity homes.

```text
_suspended/
├── TOPOLOGY.md
├── strategies/<name>/SKILL.md        retired interaction-shape resources
├── lenses/<name>/SKILL.md            retired focus-lens resources
└── methods/
    ├── generate-proposal/            lifted to propose; probes.md left as future eval seed
    ├── read-context/                 lifted to analyze
    ├── review-for-gaps/              lifted to review
    ├── elicit-by-question/           confirmed live owner: elicit
    ├── explore-and-characterize/     backported to ingest
    ├── read-referenced-documents/    backported to ingest
    ├── ingest-paste/                 confirmed/backported to ingest
    ├── capture/                      decomposed across ingest/map/propose/review
    ├── commit-graph/                 backported to map routing + graph-owned contracts
    └── run-structured-exchange/      local reminders only; exchange contract remains product-owned
```

## Boundary Rules

```pseudo
rules:
  agents/runtime/_suspended/ -> agents/skills/_suspended/ [legacy manifest compatibility]
  agents/runtime/elicitor/ x> agents/skills/_suspended/ [live elicitor does not negotiate prompt resources]
  agents/skills/_suspended/ x> TypeScript imports [read-only prompt resources]
```

## Migration Note

The strategy/lens/method taxonomy has moved here and is not a live routing surface. Useful conduct should be lifted into activity-named homes under `agents/skills/` only when the live elicitor needs a real prompt-resource surface again; filesystem presence alone does not make these suspended resources active.

Post-salvage dispositions:

- **Lifted:** `generate-proposal`, its intent/design/oracle references, `read-context`, and `review-for-gaps`.
- **Confirmed/backported:** `elicit-by-question`, `explore-and-characterize`, `read-referenced-documents`, `ingest-paste`, `capture`, `commit-graph`, and `run-structured-exchange`.
- **Left suspended intentionally:** `generate-proposal/probes.md` remains future oracle/eval material; strategies and lenses remain quarantined by D98-L unless a later frontier reopens prompt-resource organization.

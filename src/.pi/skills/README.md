# .pi/skills/ — Brunch prompt-resource skills

SPEC decisions: D25-L, D39-L, D52-L, D58-L, D59-L, D85-L

## Owns

Agent Skills-standard prompt resources the Brunch Pi session agent reads on demand after `.pi/extensions/runtime/state.ts` advertises them in a runtime-filtered `<brunch-skills>` manifest.

These are Pi-harness prompt resources, not product data models and not ambient filesystem discovery inputs.

## Layout

```text
skills/
├── README.md
├── __fixtures__/unlisted-fixture/SKILL.md  test-only sealing fixture
├── strategies/<name>/SKILL.md              reusable interaction shapes
├── lenses/<name>/SKILL.md                  topical focus lenses
└── methods/<name>/SKILL.md                 tool-routing and sequencing guidance
```

Each live resource is a directory whose `SKILL.md` has YAML frontmatter (`name`, `description`) plus the instruction body. `name` must equal the parent directory and the code-owned id in `.pi/extensions/runtime/state.ts`.

## Boundary rules

```pseudo
rules:
  .pi/extensions/runtime/state.ts -> .pi/skills/*/*/SKILL.md  [explicit code-owned path list]
  .pi/extensions/runtime/state.ts -> pi loadSkills(includeDefaults:false, skillPaths=[...])
  .pi/skills/**/SKILL.md          x> TypeScript imports [read-only prompt resources]
  .pi/skills/                     x> graph mutation     [guidance only]
```

The legal set is sealed by the code-owned path list in `.pi/extensions/runtime/state.ts`; adding a `SKILL.md` does not make it available until that table enumerates it. Frontmatter owns `name` and `description`; code owns axis family, legality, and location enumeration. The former `goals/` family is retired by D85-L; the elicitor objective postures are inline in `src/.pi/agents/elicitor/SYSTEM.md`.

## Deferred prompt-resource sub-shapes

- **`references/` subfiles:** available under the Agent Skills standard when a concrete skill needs progressive disclosure. No empty reference directories are introduced.
- **_generated/ typed-vocab references:** deferred until a concrete stale-member need appears, such as an agent relying on a reference whose runtime axis or graph vocabulary members can drift from the TypeScript `kinds.ts` leaves. If built, these files are generated from typed sources, regenerated and drift-checked, and locked separately from the authored prompt-resource body lock below.

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

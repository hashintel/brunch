# .pi/skills/ — Brunch prompt resources

SPEC decisions: D25-L, D39-L, D52-L, D58-L, D59-L, D85-L

## Owns

Markdown resources the Brunch Pi session agent reads on demand after `.pi/extensions/runtime/state.ts` advertises them in a runtime-filtered manifest.

These are Pi-harness prompt resources, not product data models and not ambient filesystem discovery inputs.

## Layout

```text
skills/
├── README.md
├── strategies/    reusable interaction shapes
├── lenses/        topical focus lenses
└── methods/       tool-routing and sequencing guidance
```

## Deferred prompt-resource shapes

- **`SKILL.md + references/` shape:** deferred until a skill needs sub-references. The intended adoption shape is one skill folder, for example `methods/capture/SKILL.md` plus `methods/capture/references/*.md`, and adoption should happen for the first concrete skill that needs adjacent reference material rather than by reshaping every flat `.md` file preemptively. The code-owned manifest in `.pi/extensions/runtime/state.ts` remains the only availability surface.
- **_generated/ typed-vocab references:** deferred until a concrete stale-member need appears, such as an agent relying on a reference whose runtime axis or graph vocabulary members can drift from the TypeScript `kinds.ts` leaves. If built, these files are generated from typed sources, regenerated and drift-checked, and locked separately from the authored prompt-resource body lock below. No empty `_generated/` directory or stub generator exists while the need is absent.

## Boundary rules

```pseudo
rules:
  .pi/extensions/runtime/state.ts -> .pi/skills/*/*.md  [manifest locations]
  .pi/skills/*.md     x> TypeScript imports [read-only prompt resources]
  .pi/skills/         x> graph mutation     [guidance only]
```

The legal set is sealed by code-owned manifest metadata in `.pi/extensions/runtime/state.ts`; adding a markdown file does not make it available until the state table advertises it. The former `goals/` family is retired by D85-L; the elicitor objective postures are inline in `src/.pi/agents/elicitor/SYSTEM.md`.

## Prompt-resource body lock ledger

User-approved COMPOSE disposition (2026-06-11): the git-tracked markdown source file is the body lock. `composeAgentPrompt` emits only manifest name/description/location metadata; it does not transform or inline resource bodies, so copy-goldening these files would not lock additional behavior. The existing manifest resource test keeps every advertised skill body readable, repo-owned, and at least 700 characters.

| Family | Resource | Required? | Lock disposition |
| --- | --- | --- | --- |
| strategies | `freestyle.md` | required | Source file + manifest readability invariant; excluded from AUTO by `state.ts`. |
| strategies | `step-wise-decision-tree.md` | required | Source file + manifest readability invariant. |
| strategies | `step-wise-disambiguate.md` | required | Source file + manifest readability invariant. |
| lenses | `design.md` | required | Source file + manifest readability invariant. |
| lenses | `intent.md` | required | Source file + manifest readability invariant. |
| lenses | `oracle.md` | required | Source file + manifest readability invariant. |
| methods | `commit-graph.md` | required | Source file + manifest readability invariant; capability-gated by selected-spec gaps. |
| methods | `generate-proposal.md` | required | Source file + manifest readability invariant; capability-gated by selected-spec gaps. |
| methods | `capture.md` | required | Source file + manifest readability invariant; canonical home for FE-861 capture conduct and the D81-L commitment gradient. |
| methods | `elicit-by-question.md` | required | Source file + manifest readability invariant; D82-L direct conversational acquisition mode. |
| methods | `ingest-paste.md` | required | Source file + manifest readability invariant; D82-L pasted-material acquisition mode. |
| methods | `read-referenced-documents.md` | required | Source file + manifest readability invariant; D82-L bounded document-read mode with assistant digest before capture. |
| methods | `explore-and-characterize.md` | required | Source file + manifest readability invariant; D82-L bounded brownfield exploration mode with assistant digest before capture. |
| methods | `read-context.md` | required | Source file + manifest readability invariant. |
| methods | `review-for-gaps.md` | required | Source file + manifest readability invariant; audit-only, capability-gated by selected-spec gaps. |
| methods | `run-structured-exchange.md` | required | Source file + manifest readability invariant. |

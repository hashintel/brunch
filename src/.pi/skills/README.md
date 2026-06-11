# .pi/skills/ — Brunch prompt resources

SPEC decisions: D25-L, D39-L, D52-L, D58-L, D59-L

## Owns

Markdown resources the Brunch Pi session agent reads on demand after `.pi/agents/state.ts` advertises them in a runtime-filtered manifest.

These are Pi-harness prompt resources, not product data models and not ambient filesystem discovery inputs.

## Layout

```text
skills/
├── README.md
├── goals/         what objective the session agent is pursuing
├── strategies/    reusable interaction shapes
├── lenses/        topical focus lenses
└── methods/       tool-routing and sequencing guidance
```

## Boundary rules

```pseudo
rules:
  .pi/agents/state.ts -> .pi/skills/*/*.md  [manifest locations]
  .pi/skills/*.md     x> TypeScript imports [read-only prompt resources]
  .pi/skills/         x> graph mutation     [guidance only]
```

The legal set is sealed by code-owned manifest metadata in `.pi/agents/state.ts`; adding a markdown file does not make it available until the state table advertises it.

## Prompt-resource body lock ledger

User-approved COMPOSE disposition (2026-06-11): the git-tracked markdown source file is the body lock. `composeAgentPrompt` emits only manifest name/description/location metadata; it does not transform or inline resource bodies, so copy-goldening these files would not lock additional behavior. The existing manifest resource test keeps every advertised skill body readable, repo-owned, and at least 700 characters.

| Family | Resource | Required? | Lock disposition |
| --- | --- | --- | --- |
| goals | `capture-posture.md` | required | Source file + manifest readability invariant. |
| goals | `commit-converge.md` | required | Source file + manifest readability invariant. |
| goals | `elicit-expand.md` | required | Source file + manifest readability invariant. |
| goals | `grounding-advance.md` | required | Source file + manifest readability invariant. |
| strategies | `freestyle.md` | required | Source file + manifest readability invariant; excluded from AUTO by `state.ts`. |
| strategies | `project-graph.md` | required | Source file + manifest readability invariant. |
| strategies | `propose-graph.md` | required | Source file + manifest readability invariant. |
| strategies | `step-wise-decision-tree.md` | required | Source file + manifest readability invariant. |
| strategies | `step-wise-disambiguate.md` | required | Source file + manifest readability invariant. |
| lenses | `design.md` | required | Source file + manifest readability invariant. |
| lenses | `intent.md` | required | Source file + manifest readability invariant. |
| lenses | `oracle.md` | required | Source file + manifest readability invariant. |
| methods | `commit-graph.md` | required | Source file + manifest readability invariant; capability-gated by selected-spec gaps. |
| methods | `generate-proposal.md` | required | Source file + manifest readability invariant; capability-gated by selected-spec gaps. |
| methods | `infer-and-capture.md` | required | Source file + manifest readability invariant. |
| methods | `read-context.md` | required | Source file + manifest readability invariant. |
| methods | `review-for-gaps.md` | required | Source file + manifest readability invariant; capability-gated by selected-spec gaps. |
| methods | `run-structured-exchange.md` | required | Source file + manifest readability invariant. |

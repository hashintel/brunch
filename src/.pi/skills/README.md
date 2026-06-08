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

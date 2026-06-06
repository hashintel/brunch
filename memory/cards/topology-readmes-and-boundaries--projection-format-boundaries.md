# Top-level projections and renderers topology

Frontier: topology-readmes-and-boundaries
Status:   active
Mode:     chain
Created:  2026-06-05

## Orientation

- Containing seam: source topology after FE-809 made projection and formatting real cross-cutting seams rather than local helper folders.
- Relevant frontier item: `topology-readmes-and-boundaries`; this supersedes the earlier local cleanup card that framed `project/` vs `format/` mostly as hollow-layer deletion.
- Volatile handoff state: `HANDOFF.md` remains untracked review context; FE-809 schema/emission closure has landed, so this card no longer needs to defer around dirty structured-exchange work.
- Main open risk: top-level `projections/` and `renderers/` could become vague utility buckets. The migration must define them as narrow boundary layers with import rules, not as places to put any reusable function.
- Runtime-state addendum: D40-L audit found one mixed seam: `src/session/runtime-state.ts` owns transcript entry facts, reusable projection DTOs, and agent/tool policy definitions, while `.pi/extensions/runtime` partially duplicates tool authority. This chain must split those responsibilities without weakening the transcript-backed runtime-state contract.

Posture: proving (inherited from `topology-readmes-and-boundaries`).

Frontier-level cross-cutting obligations this slice carries:

- Preserve D52-L dependency direction: graph owns graph truth and may import `db/`; session owns Pi JSONL/session semantics; `.pi` owns the sealed Pi-harness runtime surface; `rpc` and app entrypoints adapt product seams rather than owning domain logic.
- Preserve D37-L/D41-L structured-exchange schema lock: details construction remains Zod/projector-owned; markdown remains renderer-owned; `.pi/extensions/exchanges` remains adapter/UI registration.
- Preserve topology README authority: every moved directory with a README gets updated in the same commit that changes its ownership or layout.
- Preserve free-rewrite posture: move imports directly and delete old paths; do not leave compatibility barrels for old `project/` / `format/` / `src/agents/` locations.
- Preserve overlap discipline: this card touches broad topology and is not parallel-safe with other cards moving `src/{graph,session,structured-exchange,.pi}` files.
- Preserve D40-L runtime-state authority: Pi JSONL `brunch.agent_runtime_state` entries remain state-change facts, the foreground agent remains derived from `op_mode`, and `.pi` may adapt projected policy but must not own hidden runtime memory or duplicate authority lists.

## Target topology sketch

```pseudo
src/
├── app/              [product entrypoints and host wiring]
├── workspace/        [cwd/package/workspace identity]
├── scripts/          [local executable utilities]
├── graph/            [graph truth, mutation, readers, policy]
├── session/          [Pi JSONL/session semantics]
├── projections/      [structured DTOs derived from domain/session/tool facts]
│   ├── graph/
│   ├── session/
│   ├── workspace/
│   └── exchanges/
├── renderers/       [lossy text/markdown/toon/tool content]
│   ├── markdown.ts
│   ├── toon.ts       ? [only if current code already needs it]
│   ├── graph/
│   ├── session/
│   └── exchanges/
├── .pi/             [sealed Pi-harness runtime surface]
│   ├── agents/      [prompt assembly, agent definitions, context orchestration]
│   ├── skills/      [goal/strategy/lens/method resources]
│   ├── components/  [Pi TUI/message components]
│   └── extensions/  [Pi registrars and runtime adapters]
├── rpc/             [JSON-RPC transport/method handlers]
├── web/             [React client]
├── probes/          [product-path probes]
└── db/              [persistence substrate]
```

Layer rules to prove during build:

```pseudo
rules:
  graph/          -> db/                         [allowed]
  projections/*   -> graph/, session/             [read/domain imports allowed]
  renderers/*     -> projections/, graph/, session/ as needed for input types
  .pi/            -> graph/, session/, projections/, renderers/ [Pi runtime surface]
  rpc/, app/      -> graph/, session/, projections/, renderers/
  graph/, session/ x> .pi/, rpc/, app/, web/
  projections/    x> .pi/, rpc/, app/, web/
  renderers/      x> .pi/, rpc/, app/, web/
```

## Card 1 — Lock the top-level topology decision

Status: done
Weight: full

### Target Behavior

The canonical topology documentation names `app/`, `workspace/`, `scripts/`, `projections/`, and `renderers/` as first-class source layers.

### Boundary Crossings

```pseudo
→ current D52-L / src README topology
→ new top-level layer contract and import rules
→ stale local projection/format cleanup card language
→ architecture/topology tests if they assert old root layout
```

### Risks and Assumptions

- RISK: Documentation gets ahead of code and creates a false topology claim.
  → MITIGATION: mark the migration state explicitly: layers are canonical target, with later cards materializing files.
- RISK: `projectors` vs `projections` naming remains unsettled.
  → MITIGATION: choose `projections/` unless the build uncovers an existing convention that makes `projectors/` materially clearer; update docs once, not both.
- ASSUMPTION: Top-level projection/renderer layers improve navigation more than domain-local `project/` / `format/` subtrees now that multiple domains share the pattern.
  → IMPACT IF FALSE: later cards should stop after docs and keep local folders, leaving only root-entrypoint cleanup.
  → VALIDATE: import/call-site audit included in this card's build report before moving code.

### Posture check

This proving slice establishes the target topology and makes the migration auditable before moving files. It scores on invariants and uncertainty: if the import audit shows the top-level layers would be bucket-like rather than boundary-like, the chain stops here.

### Acceptance Criteria

✓ `memory/SPEC.md` D52-L (or the current topology decision) describes `app/`, `workspace/`, `scripts/`, `projections/`, and `renderers/` with dependency direction.
✓ `src/README.md` matches the new target topology and names any not-yet-moved directories as migration state rather than current truth.
✓ This scope file no longer asks builders to merely collapse `project/` layers; it scopes a top-level topology migration.
✓ A call-site audit in the build summary identifies which current `project/` and `format/` files will move, collapse, or remain intentionally local.

### Verification Approach

- Inner: docs/readme review — proves topology claims are precise and do not overclaim completed moves.
- Inner: grep/import audit — proves the proposed moved sets are finite and not mixed with adapter-only code.
- Middle: `npm run check` — catches formatting/lint drift from documentation edits.

### Card 1 build summary

```pseudo
audit: current projection/renderer migration inputs

current owner                                  | files / callers                                      | next disposition
-----------------------------------------------|------------------------------------------------------|-----------------
src/graph/project/*                            | 4 DTO projectors; used by graph renderers, .pi graph tool, .pi agent context | move confirmed reusable DTOs to projections/graph/
src/graph/format/*                             | 4 text renderers; used by .pi graph tool and .pi agent context               | move confirmed reusable text renderers to renderers/graph/
src/session/project/transcript-context.ts      | transcript DTO; used by session transcript formatter                         | move to projections/session/ if still reusable
src/session/runtime-state.ts                      | runtime-state entry schema, projection, default posture, and policy definitions; used by .pi runtime/prompt/chrome, rpc, web, probes | split: keep session-owned transcript entry semantics inward, hoist reusable projection/policy to projections/session/, then make .pi runtime consume the shared policy in Cards 4–5
src/session/format/transcript.ts               | transcript markdown artifact renderer                                        | move to renderers/session/ if still reusable
src/structured-exchange/project/*              | active present/request projectors plus capture/candidate topology stubs       | move active DTO constructors to projections/structured-exchange/; preserve/delete stubs only under topology-stub rules
src/structured-exchange/format/*               | active present/request renderers plus capture/candidate topology stubs        | move active markdown renderers to renderers/structured-exchange/; preserve/delete stubs only under topology-stub rules
src/render/markdown.ts                         | shared markdown helpers for graph/structured-exchange renderers               | move to renderers/markdown.ts if callers remain
src/render/toon.ts                             | comment-only compact-data renderer stub                                      | move only if graph renderer still needs it; otherwise apply topology-stub deletion rules
src/.pi/extensions/*                           | Pi registrars/hooks/UI wrappers; no db/ imports observed                     | keep adapter-local; import projections/renderers after Card 3
src/.pi/agents/contexts/*                      | agent-context orchestration over typed pulls                                  | remain .pi-agent-owned; may call top-level renderers, but not a renderer bucket
```

Confirmed doc delta: `memory/SPEC.md` D52-L, `src/README.md`,
`src/.pi/README.md`, `src/.pi/extensions/README.md`, `src/.pi/agents/README.md`,
`src/.pi/skills/README.md`, and `memory/PLAN.md` now name the target topology
and distinguish migration state from current file placement.

### Applied topology move — Pi harness consolidation

Status: done

```pseudo
move summary:
  src/agents/                         -> src/.pi/agents/
  src/.pi/agents/goals/               -> src/.pi/skills/goals/
  src/.pi/agents/strategies/          -> src/.pi/skills/strategies/
  src/.pi/agents/lenses/              -> src/.pi/skills/lenses/
  src/.pi/agents/methods/             -> src/.pi/skills/methods/
  src/.pi/extensions/alternatives.ts  -> src/.pi/components/alternatives.ts
  src/.pi/extensions/chrome.ts        -> src/.pi/extensions/chrome/index.ts
  src/.pi/extensions/command-policy.ts -> src/.pi/extensions/commands/policy.ts
  src/.pi/extensions/commands.ts      -> src/.pi/extensions/commands/index.ts
  src/.pi/extensions/mention-autocomplete.ts -> src/.pi/extensions/mentions/index.ts
  src/.pi/extensions/operational-mode.ts -> src/.pi/extensions/runtime/index.ts
  src/.pi/extensions/prompting.ts     -> src/.pi/extensions/system-prompts/index.ts
  src/.pi/extensions/session-lifecycle.ts -> src/.pi/extensions/session/lifecycle.ts
  src/.pi/extensions/snapshot-cwd.ts  -> src/.pi/extensions/context/get-cwd.ts
  src/.pi/extensions/structured-exchange/ -> src/.pi/extensions/exchanges/
  src/.pi/extensions/workspace-dialog.ts -> src/.pi/extensions/workspace/index.ts
  src/.pi/extensions/auto-compaction-anchors.json -> src/.pi/extensions/compaction/index.ts
```

Rationale: these agents and resources exist only inside the Pi harness, so the
topology now treats `.pi/` as the sealed Pi runtime surface rather than a thin
extension-only adapter folder. This supersedes Card 1's earlier top-level
`src/agents/` target.

### Cross-cutting obligations

- Do not move source files in Card 1 except to satisfy a failing topology test.
- Do not introduce compatibility aliases.
- Do not rename the graph/session/.pi authority layers themselves.

### Expected touched paths (tentative)

```pseudo
memory/
├── SPEC.md                                             ~
└── PLAN.md                                             ?

src/
└── README.md                                           ~

memory/cards/
└── topology-readmes-and-boundaries--projection-format-boundaries.md ~
```

## Card 2 — Move root entrypoints into app/workspace/scripts

Status: done
Weight: full

### Target Behavior

No product entrypoint, workspace identity helper, or local executable utility source file remains directly under `src/` root.

### Boundary Crossings

```pseudo
→ src root entrypoint files
→ app/ product host module imports
→ workspace/ identity helper imports
→ scripts/ print snapshot imports
→ package/bin/test import paths
→ topology READMEs
```

### Risks and Assumptions

- RISK: Build/package entrypoints assume `src/brunch.ts` or `src/brunch-tui.ts` paths.
  → MITIGATION: follow TypeScript/test failures and update package scripts or bin imports directly; no root aliases.
- RISK: `package-identity` is actually session-owned rather than workspace-owned.
  → MITIGATION: move it to `workspace/` only if call sites use it as cwd/package identity; otherwise stop and rescope that file.
- ASSUMPTION: Root-level `brunch*`, `print-snapshot*`, and `package-identity*` files are entrypoint/workspace/script concerns, not domain modules.
  → IMPACT IF FALSE: affected file remains in its domain owner and the acceptance criterion is narrowed in the card update.
  → VALIDATE: call-site audit before file moves.

### Posture check

This slice materializes the `app/`, `workspace/`, and `scripts/` layer names without touching graph/session semantics. It scores on topology and deletion: root-level source ambiguity disappears.

### Acceptance Criteria

✓ `src/app/` owns Brunch product entrypoints and their tests.
✓ `src/workspace/` owns package/workspace identity source and tests if call-site audit confirms that ownership.
✓ `src/scripts/` owns print-snapshot utility source and tests.
✓ `src/README.md` and any new directory README accurately describe these layers.
✓ No root-level `src/brunch*`, `src/print-snapshot*`, or `src/package-identity*` source/test file remains.

### Verification Approach

- Inner: moved file tests — proves import-path repair preserved entrypoint behavior.
- Middle: `npm run check` and targeted tests for brunch/print/package identity.
- Gate: `npm run verify` if build scripts or package entrypoints changed.

### Card 2 build summary

```pseudo
move summary:
  src/brunch.ts                    -> src/app/brunch.ts
  src/brunch.test.ts               -> src/app/brunch.test.ts
  src/brunch.smoke.test.ts         -> src/app/brunch.smoke.test.ts
  src/brunch-tui.ts                -> src/app/brunch-tui.ts
  src/brunch-tui.test.ts           -> src/app/brunch-tui.test.ts
  src/print-snapshot.ts            -> src/scripts/print-snapshot.ts
  src/print-snapshot.test.ts       -> src/scripts/print-snapshot.test.ts
  src/package-identity.test.ts     -> src/workspace/package-identity.test.ts
```

Package/bin entrypoints now point at `dist/app/brunch.js`, and local dev RPC docs/helpers point at `src/app/brunch.ts`. New `src/app/README.md`, `src/scripts/README.md`, and `src/workspace/README.md` describe the materialized layer ownership. `memory/SPEC.md` D52-L and `src/README.md` no longer describe root entrypoints as pending migration state.

### Cross-cutting obligations

- Keep `app/` as wiring/entrypoint code, not a new domain layer.
- Keep `workspace/` scoped to cwd/package/workspace identity; session/spec selection remains in `session/` unless a separate design changes it.
- Delete old root paths directly; do not create compatibility barrels.

### Expected touched paths (tentative)

```pseudo
src/
├── brunch.ts                                           -
├── brunch.test.ts                                      -
├── brunch.smoke.test.ts                                -
├── brunch-tui.ts                                       -
├── brunch-tui.test.ts                                  -
├── print-snapshot.ts                                   -
├── print-snapshot.test.ts                              -
├── package-identity.test.ts                            -
├── app/                                                +
│   ├── README.md                                       +
│   ├── brunch.ts                                       +
│   ├── brunch.test.ts                                  +
│   ├── brunch.smoke.test.ts                            +
│   ├── brunch-tui.ts                                   +
│   └── brunch-tui.test.ts                              +
├── workspace/                                          +
│   ├── README.md                                       +
│   ├── package-identity.ts                             +?
│   └── package-identity.test.ts                        +
├── scripts/                                            +
│   ├── README.md                                       +
│   ├── print-snapshot.ts                               +
│   └── print-snapshot.test.ts                          +
└── README.md                                           ~

package.json                                            ?
bin/                                                    ?
tsconfig*.json                                          ?
```

## Card 3 — Hoist reusable projections and renderers

Status: next
Weight: full

### Target Behavior

Reusable projection and formatting modules live under top-level `src/projections/` and `src/renderers/` instead of whichever local caller first needed them.

### Boundary Crossings

```pseudo
→ graph/session/structured-exchange project/format modules
→ print-mode workspace snapshot projection/rendering currently parked under scripts/
→ top-level projections/renderers import rules
→ .pi / rpc / .pi/agents / web / probes call sites
→ topology READMEs
→ architecture/source-boundary tests
```

### Risks and Assumptions

- RISK: Some domain-local files are not reusable boundary projections and should collapse into their only caller instead of moving.
  → MITIGATION: apply the same test as the old card: a file moves only if it has a named DTO/text boundary; otherwise collapse it in place.
- RISK: Structured-exchange `project/*` imports `.pi` schema types, which may make `projections/structured-exchange` look adapter-dependent.
  → MITIGATION: preserve the current schema-lock direction until a separate schema-ownership card changes it; document this as current migration state if needed.
- RISK: Large import churn hides behavior changes.
  → MITIGATION: move one family at a time inside the card and run focused tests after each family.
- RISK: `src/scripts/print-snapshot.ts` currently contains shared DTO projection and text rendering used by `rpc` and `web`, not only local executable utility code.
  → MITIGATION: split workspace snapshot DTO construction into `projections/workspace/` and lossy print text into `renderers/workspace/`; leave `scripts/` only if an actual script-facing shell remains.
- ASSUMPTION: Current `graph/project`, `session/project`, and `structured-exchange/project` modules are projection-layer concerns, while current `*/format` modules are renderer-layer concerns.
  → IMPACT IF FALSE: move only the confirmed subset and mark the remainder as stale for rescoping.
  → VALIDATE: call-site audit from Card 1 and compiler/test failures during breakage-driven repair.

### Posture check

This slice materializes the projection/renderer boundary in code. It scores on invariants, topology, and deletion: old local `project/` / `format/` folders disappear unless a local owner still has a current reason to keep one.

### Acceptance Criteria

✓ `src/projections/{graph,session,structured-exchange,workspace}/` owns every surviving reusable non-text projection module.
✓ `src/renderers/{graph,session,structured-exchange,workspace}/` owns every surviving text/markdown formatter module, and `src/renderers/markdown.ts` replaces `src/render/markdown.ts` if that helper is still needed.
✓ Old `src/**/project/` and `src/**/format/` folders touched by this card are deleted unless a README names why a local folder remains.
✓ `.pi`, `rpc`, `.pi/agents`, `web`, `session`, `graph`, and probes import from the new top-level layers without compatibility barrels.
✓ Boundary tests or README rules make it clear that projections/renderers must not import adapters, app entrypoints, web, or RPC handlers.

### Verification Approach

- Inner: TypeScript import repair — proves no stale old paths remain.
- Inner: focused tests for graph formatting, session transcript formatting, workspace snapshot projection/rendering, structured-exchange formatting, and boundary tests.
- Middle: `npm run check` plus targeted `npm run test -- structured-exchange graph session workspace-snapshot` as applicable.
- Gate: `npm run verify` before commit.

### Cross-cutting obligations

- Do not change structured-exchange details schemas, graph command semantics, or session exchange projection semantics while moving files.
- Do not use barrels to preserve old import paths.
- Do not move web-specific formatting into top-level renderers unless it is shared outside web.
- Do not leave `rpc` or `web` importing from `scripts/`; scripts are local utility shells, not shared DTO ownership.
- Do not mix runtime-state policy consolidation into this card; Cards 4–5 own the D40-L split so projection/renderer moves stay mechanical.

### Expected touched paths (tentative)

```pseudo
src/
├── projections/                                         +
│   ├── README.md                                        +
│   ├── graph/                                           +
│   │   ├── commit-result.ts                             +?
│   │   ├── neighborhood.ts                              +?
│   │   ├── overview.ts                                  +?
│   │   └── reconciliation-needs.ts                      +?
│   ├── session/                                         +
│   │   └── transcript-context.ts                        +?
│   ├── workspace/
│   │   └── workspace-snapshot.ts                        +
│   └── structured-exchange/                             +
│       ├── present-options.ts                           +
│       ├── present-question.ts                          +
│       ├── present-review-set.ts                        +
│       ├── request-answer.ts                            +
│       ├── request-choice.ts                            +
│       ├── request-choices.ts                           +
│       └── request-review.ts                            +
├── renderers/                                           +
│   ├── README.md                                        +
│   ├── markdown.ts                                      +?
│   ├── graph/                                           +
│   │   ├── commit-result.ts                             +?
│   │   ├── neighborhood.ts                              +?
│   │   ├── overview.ts                                  +?
│   │   └── reconciliation-needs.ts                      +?
│   ├── session/                                         +
│   │   └── transcript.ts                                +?
│   ├── workspace/
│   │   └── workspace-snapshot.ts                        +
│   └── structured-exchange/                             +
│       ├── present-options.ts                           +
│       ├── present-question.ts                          +
│       ├── present-review-set.ts                        +
│       ├── request-answer.ts                            +
│       ├── request-choice.ts                            +
│       ├── request-choices.ts                           +
│       └── request-review.ts                            +
├── render/                                              -?
├── graph/                                               ~
│   ├── README.md                                        ~
│   ├── project/                                         -?
│   └── format/                                          -?
├── session/                                             ~
│   ├── README.md                                        ~
│   ├── project/                                         -?
│   └── format/                                          -?
├── scripts/
│   ├── README.md                                        ~
│   ├── print-snapshot.ts                                -?
│   └── print-snapshot.test.ts                           -?
├── structured-exchange/                                 -?
│   ├── project/                                         -?
│   └── format/                                          -?
├── .pi/                                                 ~
├── rpc/                                                 ~
└── probes/                                              ~

src/.pi/__tests__/structured-exchange-boundaries.test.ts ~
src/README.md                                           ~
memory/SPEC.md                                          ~
memory/PLAN.md                                          ?
```

## Card 4 — Hoist runtime-state projection ownership

Status: next
Weight: full

### Target Behavior

Runtime-state projection is a top-level session projection derived from session-owned transcript entry facts.

### Boundary Crossings

```pseudo
→ Pi JSONL brunch.agent_runtime_state entries
→ session-owned runtime-state entry schema / append helpers
→ projections/session runtime-state projection
→ .pi agents / .pi extensions / rpc / web / probes consumers
→ D40-L and D52-L topology documentation
```

### Risks and Assumptions

- RISK: Splitting `src/session/runtime-state.ts` could invert dependency direction by making `session/` import from `projections/`.
  → MITIGATION: keep transcript entry schemas, parsers, and append helpers in `session/`; projections import inward from `session/`, never the reverse.
- RISK: Moving runtime-state types through the public `.pi/extensions/runtime` re-export could hide old import paths as compatibility barrels.
  → MITIGATION: update callers directly to the new ownership paths except for intentional product-level `.pi` bundle exports that already serve external harness wiring.
- RISK: The existing RPC result schema mirrors `RuntimeStateProjection` and may drift during the move.
  → MITIGATION: keep the schema in `rpc` for method discovery, but source enum/literal sets from the same projection/policy constants where practical; do not invent a generic schema-derivation layer just for this slice.
- ASSUMPTION: Runtime-state projection is reusable DTO construction, while runtime-state transcript entry parsing/appending is session-domain behavior.
  → IMPACT IF FALSE: the slice should stop after import repair and update D40-L to preserve `session/` as projection owner.
  → VALIDATE: import-direction tests and focused runtime-state/RPC tests prove no `session/ → projections/` dependency and no runtime-state result drift.

### Posture check

This slice scores on invariants and topology: it resolves the D40-L/D52-L ownership tension by making `session/` own transcript facts and `projections/session/` own the reusable DTO projection, without changing the runtime-state data model.

### Acceptance Criteria

✓ Runtime-state entry facts — `brunch.agent_runtime_state` schema/parsing/appending remains session-owned and linear-transcript-backed.
✓ Runtime-state projection — `projectBrunchAgentState` and `projectSessionRuntimeState` live under `src/projections/session/` and import only allowed domain/session inputs.
✓ Consumer imports — `.pi/agents`, `.pi/extensions`, `rpc`, `web`, and probes import runtime-state projection/policy from the new ownership paths without old compatibility aliases.
✓ RPC parity — `session.runtimeState` still rejects non-linear transcripts and returns the same shaped mentions/world/lifecycle projection.
✓ Topology docs — D40-L/D52-L and relevant READMEs describe the split between session transcript facts and projection DTOs.

### Verification Approach

- Inner: runtime-state projection tests — prove default projection, last-writer-wins, malformed-entry handling, mentions/world/lifecycle slots, and non-linear rejection still hold.
- Inner: RPC session tests — prove `session.runtimeState` explicit target handling and result shape still hold.
- Inner: import-boundary/source-boundary tests — prove `session/` does not import `projections/` and projections do not import adapters.
- Middle: `npm run check` plus targeted `npm run test -- runtime-state session`.
- Gate: `npm run verify` before commit if D40-L/D52-L docs or package-wide imports change.

### Cross-cutting obligations

- Preserve D40-L: runtime state is transcript-backed, last-writer-wins over linear entries, and default/empty slots remain explicit.
- Preserve D52-L: `projections/` may import `session/`; `session/` must not import `.pi`, `rpc`, `app`, `web`, or `projections/`.
- Do not create compatibility barrels for the old `src/session/runtime-state.ts` projection API.

### Expected touched paths (tentative)

```pseudo
src/
├── session/
│   ├── runtime-state.ts                              ~
│   ├── runtime-state.test.ts                         ~
│   └── README.md                                     ~
├── projections/
│   ├── README.md                                     ~
│   └── session/
│       ├── runtime-state.ts                          +
│       └── runtime-policy.ts                         +?
├── .pi/
│   ├── brunch-pi-extensions.ts                       ~
│   ├── __tests__/
│   │   ├── operational-mode.test.ts                  ~
│   │   └── prompting.test.ts                         ~
│   ├── agents/
│   │   ├── compose.test.ts                           ~
│   │   ├── compose.ts                                ~
│   │   ├── state.test.ts                             ~
│   │   └── state.ts                                  ~
│   └── extensions/
│       ├── chrome/index.ts                           ~
│       ├── runtime/index.ts                          ~
│       └── system-prompts/index.ts                   ~
├── rpc/
│   ├── handlers.test.ts                              ~
│   └── methods/session.ts                            ~
├── web/
│   └── queries/session.ts                            ~
├── probes/
│   ├── fixture-curation-loop.ts                      ~
│   └── propose-graph-commit-proof.ts                 ~
└── README.md                                         ~

memory/
└── SPEC.md                                           ~
```

## Card 5 — Apply projected runtime tool policy

Status: next
Weight: full

### Target Behavior

The Pi runtime extension applies tool authority from the projected runtime policy.

### Boundary Crossings

```pseudo
→ projected Brunch runtime state
→ shared tool-policy definition
→ .pi agents active-tool calculation
→ .pi extensions/runtime tool registration and blocking hooks
→ prompt/chrome/runtime posture tests
```

### Risks and Assumptions

- RISK: Pi still needs defensive `tool_call` and `user_bash` interception even when `setActiveTools` is correct.
  → MITIGATION: keep defensive hooks, but drive their decisions and messages from the shared policy rather than local duplicate lists.
- RISK: Read-only tool registration is Pi-adapter behavior, while tool-selection authority is product policy; merging both into `projections/` would create adapter leakage.
  → MITIGATION: keep concrete Pi tool factories/renderers in `.pi/extensions/runtime`; only the allow/block policy and selected posture move to the shared policy seam.
- RISK: Prompt and active tools can diverge if `.pi/extensions/runtime` and `.pi/extensions/system-prompts` compute policy through different helper paths.
  → MITIGATION: both call the same runtime-policy helper and tests assert prompt active-tool lines match `pi.setActiveTools`.
- ASSUMPTION: `elicit-read-only` remains the only current tool policy, but it should already be represented as a registry entry to make future `execute` policy additive.
  → IMPACT IF FALSE: this slice should keep the simpler single-policy helper, but still delete local duplicate blocked-tool lists.
  → VALIDATE: operational-mode and prompting tests exercise the current elicit posture without requiring a future mode.

### Posture check

This slice scores on invariants: it closes the D40-L audit divergence by ensuring `.pi` adapts transcript-projected runtime policy instead of maintaining hidden or duplicate authority state.

### Acceptance Criteria

✓ Single policy source — `elicit-read-only` allowed/blocked tool names are declared once and consumed by `.pi/agents/state.ts`, `.pi/extensions/runtime/index.ts`, and `.pi/extensions/system-prompts/index.ts`.
✓ Runtime adapter boundary — concrete Pi read-only tool factories/renderers stay under `.pi/extensions/runtime`, not in projections.
✓ Defensive blocking — side-effecting `bash`/`edit`/`write` tool calls and `user_bash` remain blocked in `elicit` mode through policy-derived checks.
✓ Prompt/tool parity — prompt composition and `pi.setActiveTools` use the same projected runtime state and readiness grade.
✓ Drift deletion — stale comments claiming a later transcript-backed replacement is still pending are removed or rewritten.

### Verification Approach

- Inner: operational-mode tests — prove default/switch runtime state drives active tools and side-effecting tools remain blocked.
- Inner: prompting tests — prove prompt manifests and active tools derive from the same projected state.
- Inner: import-boundary/source-boundary tests — prove policy helpers do not import Pi adapters.
- Middle: `npm run check` plus targeted `npm run test -- operational-mode prompting`.
- Gate: `npm run verify` before commit if policy helpers or `.pi` bundle exports change.

### Cross-cutting obligations

- Preserve D40-L: `.pi` runtime policy is an adapter over projected transcript state, not a second runtime state machine.
- Preserve minimal-authority-shell direction: current `elicit` posture remains read-only and blocks side effects until a future `execute` mode is explicitly designed.
- Preserve topology-card overlap discipline: build this in the same chain as Card 4; do not create a parallel scope file that also touches runtime-state projection paths.

### Expected touched paths (tentative)

```pseudo
src/
├── projections/
│   └── session/
│       ├── runtime-policy.ts                         ~
│       └── runtime-state.ts                          ~?
├── .pi/
│   ├── __tests__/
│   │   ├── operational-mode.test.ts                  ~
│   │   └── prompting.test.ts                         ~
│   ├── agents/
│   │   ├── state.test.ts                             ~
│   │   └── state.ts                                  ~
│   └── extensions/
│       ├── runtime/index.ts                          ~
│       └── system-prompts/index.ts                   ~
└── README.md                                         ~?

memory/
└── SPEC.md                                           ~?
```

# FE-1216 agent control-surface sweep

Frontier: agent-control-plane-closure
Status:   active
Mode:     sweep
Created:  2026-07-17

## Orientation

- **Containing seam:** Brunch-owned foreground/background prompt ingress and agent resource grants, from code-owned manifests and persisted/session controls through provider-visible prompt carriers or sealed child sessions.
- **Frontier:** `agent-control-plane-closure` / FE-1216 on `ln/fe-1216-agent-control-plane-closure`; this one coverage ledger is the execution context for all seven required rows.
- **Volatile handoff state:** none. FE-1210 residue and current `HANDOFF.md` state are not execution inputs for this frontier.
- **Main risk:** a local cleanup could preserve contradicted D131-L assurance guidance, reintroduce eager context, or advertise a resource that the receiving agent cannot read.

**Posture: earned (inherited from `agent-control-plane-closure`).**

Frontier-level obligations:

- Materialize D134-L/I67-L without introducing another control primitive: spec posture, elicitation style, asking agenda, origination continuity, and later on-demand reads retain distinct owners and lifetimes.
- Materialize D131-L before any row amplifies assurance guidance through grants or resource-read expectations.
- Preserve the thin/load-on-demand D58-L foreground model and capability-honest background grants.
- Keep graph schema, persisted rows, historical fixtures, capture IR, reviewer behavior, review rendering, and the four-section capture experiment outside this sweep.

## Sweep preflight

1. **Boundary:** included are live assurance guidance, owned foreground block replacement, the foreground context cutover, control provenance, observable foreground resource reads, background skill/rubric grants, and small caching/renderer consolidation inside those seams. Excluded are schema or data migration, production capture machinery, fixture regeneration, reviewer conduct, FE-1187 rendering/outer evidence, automatic evidence promotion, and the downstream capture experiment.
2. **Source-of-truth inputs:** D131-L governs assurance conduct; D134-L/I67-L govern prompt identity, context ingress, and capability honesty; D58-L/D101-L/D102-L/D118-L govern origination versus later reads and control provenance; D90-L/D95-L govern agent/skill manifests. Each row below names its narrower inputs.
3. **Owner and closure:** every required row names one canonical code/topology owner and a deterministic closure oracle. The row contract is the acceptance criterion for one later `ln-builder` delegation.
4. **Classification:** `buildable-now`; D134-L/I67-L settle the ingress model and no row requires a design, spike, provider, browser, or human gate.
5. **Closed inventory:** exactly the seven PLAN rows below are required. Discovery of more than one omitted capability or any new sub-seam stops the sweep and routes back to `ln-plan`.

## Aggregate done-definition

Every required inventory row is built or has an explicit non-applicable disposition; foreground and background prompts contain no contradictory tool/resource instructions; per-turn changes replace stale owned blocks; topology/SPEC/code tell one story about context; and the assurance chain is criteria/method → concrete check (`realization`) plus deliberately promoted prior observation → witnessed/falsified claim (`witness`).

The sweep is not done while any `●` row remains `partial`, `spec`, or `new`.

## Dependency-safe execution

- Builders consume exactly one ledger row at a time and update only that row's status plus its declared manifest.
- File order is topological, not a license to infer implementation findings from an earlier row. A later row may rely only on the decisions and completed contracts named in `Prerequisite`.
- Rows with `none` may build in either order, but write-capable delegation remains serialized on this branch.
- `capture-ledger-tracer` stays wait-gated until the whole sweep closes. Its manifest intersections are downstream serialization points, not permission to implement its capture intervention or campaign.
- FE-1187 scope files are external-owner context. Completed-row path intersections do not reopen their work; the active outer checkpoint owns only findings/evidence paths.

## Coverage ledger

| Capability | Status | Req | Fill | Canonical owner / next | Source-of-truth inputs | Closure oracle | Prerequisite |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Assurance semantics | `built` | `●` | `earned` | `src/agents/references/` + activity skill homes; build Row 1 | D131-L, D87-L, D94-L, D99-L; current schema is readable input, not a write target | focused static/resource contract test plus `npm run check:skills` proves criteria/method → check via `realization`, observed evidence only → claim via `witness`, and legacy/reserved `vv_obligation` | none |
| Foreground block identity | `built` | `●` | `earned` | provider-prompt adapter; build Row 2 | D134-L/I67-L; current role/style/tool/resource composition | plain-string and provider carrier matrix proves identical composition is idempotent and any changed owned block replaces its predecessor | none |
| Context topology | `built` | `●` | `earned` | foreground prompt adapter + agent context topology; build Row 3 | D58-L, D101-L, D102-L, D118-L, D134-L | import/topology and focused context tests prove origination continuity plus later on-demand reads, with no dead eager path, unused must-wire read, or nonexistent caller | none |
| Control ownership | `built` | `●` | `earned` | elicitor runtime/context owners; build Row 4 | D98-L, D101-L, D102-L, D118-L, D134-L/I67-L | control-map tests prove posture/style/agenda provenance and lifetime while keeping their state and render ownership distinct | Context topology |
| Resource invocation | `partial` | `●` | `earned` | trajectory report contract; build Row 5 | D58-L, D95-L, D131-L, D134-L/I67-L; code-owned skill/reference locations | controlled ingest/project/propose trace tests distinguish advertised, read, and provider-visible states and fail when a required capture-time read is absent | Assurance semantics; Foreground block identity; Context topology |
| Background grants | `partial` | `●` | `earned` | background manifest/adapter and sealed child prompt assembly; build Row 6 | D90-L/D91-L/D92-L, D134-L/I67-L; actual child tool/resource-loader grant | readable-skill, bundled-rubric, and no-tools prompt/grant matrix contains no dead resource token or missing-tool instruction and preserves Markdown handback plus foreground mutation authority | Assurance semantics |
| Minor closure | `partial` | `●` | `earned` | prompt/resource registries and shared context rendering; build Row 7 | completed Rows 1–6 and their final immutable bodies/manifests | identity/reuse tests prove process-lifetime caching at the owning registry/body seam; context snapshots prove one shared renderer without a wider public API | Assurance semantics; Foreground block identity; Context topology; Control ownership; Resource invocation; Background grants |

## Row 1 · Assurance semantics

**Target:** Every live ingest/map/project/propose/review resource expresses D131-L assurance conduct without changing the physical graph schema or historical data.

### Cold-start reads

- `memory/SPEC.md` — D131-L, D87-L, D94-L, D99-L
- `memory/PLAN.md` — frontier `agent-control-plane-closure`, Assurance semantics row, aggregate acceptance/boundary
- `src/agents/references/TOPOLOGY.md` and `src/agents/skills/TOPOLOGY.md` — static-reference and activity-skill ownership
- `src/graph/TOPOLOGY.md` — physical graph vocabulary remains input-only

### Acceptance and verification

- ✓ `src/agents/references/data-model.md` and `src/agents/references/readiness-bands.md` distinguish the physical compatibility taxonomy from D131-L conduct: `evidence` is capture-only and never an expected projection deliverable; `vv_obligation` is legacy/reserved without deleting its schema entry.
- ✓ focused assurance resource contract test — ingest/map/project/propose/review and referenced oracle guidance never propose future evidence, generate a new `vv_obligation`, or treat an unexecuted check as proof; they express criterion/method → concrete `check` through `realization` and deliberately promoted observation → claim through `witness`.
- ✓ `npm run check:skills` — every edited skill/reference link and required skill contract remains valid.
- Existing persisted rows and seed fixtures are read-only compatibility evidence; no enum, migration, shim, or fixture rewrite is acceptance.

### Expected touched paths

```text
memory/cards/agent-control-plane-closure--control-surface-sweep.md ~
src/agents/
├── references/
│   ├── data-model.md                                            ~
│   └── readiness-bands.md                                       ~
└── skills/
    ├── ingest/SKILL.md                                          ~
    ├── map/
    │   ├── SKILL.md                                             ~
    │   └── references/
    │       ├── map-intents.md                                   ~
    │       ├── map-nodes.md                                     ~
    │       └── map-oracles.md                                   ~
    ├── project/
    │   ├── SKILL.md                                             ~
    │   └── references/design-to-oracle.md                       ~
    ├── propose/
    │   ├── SKILL.md                                             ~
    │   └── references/
    │       ├── oracle.md                                        ~
    │       └── present-review-set.md                            ~
    ├── review/SKILL.md                                          ~
    └── __tests__/assurance-semantics.test.ts                    +
```

The `~` entries above are the known D131-L edit sites. The builder must also audit the
complete `ingest` / `map` / `project` / `propose` / `review` resource chain named in the
cold-start reads; another file in those five homes is `?` and becomes writable only when
that audit identifies a concrete D131-L contradiction. Do not replace a known edit with an
unrelated symmetry cleanup.

## Row 2 · Foreground block identity

**Target:** Every supported provider carrier contains exactly one current Brunch-owned foreground block whose identity is stable and whose content is replaceable.

### Cold-start reads

- `memory/SPEC.md` — D134-L, I67-L, D58-L
- `memory/PLAN.md` — frontier `agent-control-plane-closure`, Foreground block identity acceptance
- `src/agents/runtime/TOPOLOGY.md` and `src/.pi/extensions/TOPOLOGY.md` — composition/adapter ownership

### Acceptance and verification

- ✓ `src/.pi/extensions/__tests__/agent-runtime-system-prompts.test.ts` — identical-composition idempotence and changed-composition replacement for role, elicitation style, active tools, and resource manifests in plain strings plus supported provider block/message carriers.
- ✓ negative-space matrix — the old first-line/heading sentinel cannot retain stale Brunch content or append a rival owned block.
- ✓ focused provider composition tests — unrelated provider/base-prompt content and non-Brunch blocks are preserved byte-for-byte.

### Expected touched paths

```text
memory/cards/agent-control-plane-closure--control-surface-sweep.md ~
src/.pi/extensions/
├── shared/provider-system-prompt.ts                             ~
├── agent-runtime/system-prompts/index.ts                        ~
├── __tests__/agent-runtime-system-prompts.test.ts               ~
└── TOPOLOGY.md                                                  ~
```

## Row 3 · Context topology

**Target:** Foreground context has one D134-L topology: origination continuity is pushed once and later graph/scratchpad detail is read on demand.

### Cold-start reads

- `memory/SPEC.md` — D58-L, D101-L, D102-L, D118-L, D134-L; I67-L
- `memory/PLAN.md` — frontier `agent-control-plane-closure`, Context topology acceptance
- `src/agents/contexts/TOPOLOGY.md`, `src/agents/runtime/elicitor/TOPOLOGY.md`, `src/.pi/extensions/TOPOLOGY.md`, `src/session/TOPOLOGY.md` — current claimed topology

### Acceptance and verification

- ✓ focused context/import tests — the dead eager per-turn graph/scratchpad composer and obsolete world-read cache are absent from production topology; reusable snapshot rendering needed by background assembly remains owned and tested.
- ✓ prompt adapter type/contract tests — `graphReads` is not a production-required unused parameter and no fallback reintroduces eager reads.
- ✓ origination and live-prompt suites — origination/resume retains graph overview, neutral facts, scratchpad, process move, and established posture; later turns discover graph/scratchpad tools without repeating that payload.
- ✓ topology/import contract check — no canonical doc names `composeAgentContextSeed`, `world-reads.ts`, or another nonexistent caller after the cutover.

### Expected touched paths

```text
memory/cards/agent-control-plane-closure--control-surface-sweep.md ~
src/agents/
├── contexts/
│   ├── TOPOLOGY.md                                              ~
│   └── seeds/
│       ├── turn-context.ts                                      ~
│       └── __tests__/turn-context.test.ts                       ~
└── runtime/elicitor/TOPOLOGY.md                                 ~
src/.pi/extensions/
├── agent-runtime/system-prompts/
│   ├── index.ts                                                 ~
│   ├── world-reads.ts                                           -
│   └── __tests__/world-reads.test.ts                            -
└── TOPOLOGY.md                                                  ~
```

## Row 4 · Control ownership

**Target:** Spec posture, elicitation style, and asking agenda are rendered from distinct canonical owners with explicit provenance and lifetime.

### Cold-start reads

- `memory/SPEC.md` — D98-L, D101-L, D102-L, D118-L, D134-L; I67-L
- `memory/PLAN.md` — frontier `agent-control-plane-closure`, Control ownership acceptance
- `src/session/TOPOLOGY.md`, `src/agents/contexts/TOPOLOGY.md`, `src/agents/runtime/elicitor/TOPOLOGY.md` — persisted/session/prompt ownership
- Row 3 in this file — completed context topology only; do not infer implementation findings

### Acceptance and verification

- ✓ focused control-map test — posture is a persisted product fact, elicitation style is active-branch session process bias, and asking agenda is origination/prompt conduct; each assertion names its reader and lifetime.
- ✓ prompt/origination contrast — shared formatting cannot make one control satisfy, overwrite, persist, or gate another.
- ✓ topology reconciliation — canonical current-state docs use the same ownership map without copying D134-L rationale.

### Expected touched paths

```text
memory/cards/agent-control-plane-closure--control-surface-sweep.md ~
src/agents/
├── contexts/
│   └── seeds/
│       ├── origination.ts                                      ~
│       └── __tests__/origination.test.ts                       ~
└── runtime/elicitor/
    ├── context.ts                                               ~
    ├── TOPOLOGY.md                                              ~
    └── __tests__/control-ownership.test.ts                      +
src/session/TOPOLOGY.md                                         ~
```

## Row 5 · Resource invocation

**Target:** Controlled foreground trajectories prove required capture-time resources are advertised, actually read, and provider-visible as distinct observable states.

### Cold-start reads

- `memory/SPEC.md` — D58-L, D95-L, D131-L, D134-L; I67-L
- `memory/PLAN.md` — frontier `agent-control-plane-closure`, Resource invocation acceptance/verification
- `src/agents/skills/TOPOLOGY.md`, `src/agents/references/TOPOLOGY.md` — manifest authority
- `src/.pi/extensions/dev-mode/introspection/TOPOLOGY.md` and `src/dev/TOPOLOGY.md` — existing trajectory/report observability only
- Rows 1–3 in this file — completed assurance, owned-block, and context contracts only

### Acceptance and verification

- ✓ controlled ingest/project/propose trajectory tests — each required capture-time skill/reference has separate `advertised`, `read`, and `provider_visible` evidence tied to its exact code-owned location.
- ✓ negative trace — manifest presence without the required read fails the capture contract; a read of an unadvertised or different path cannot satisfy it.
- ✓ no-production-IR guard — the existing trajectory/report surface supplies the oracle; if it cannot express the contract without a new production capture schema, stop and return to `ln-plan`.

### Expected touched paths

```text
memory/cards/agent-control-plane-closure--control-surface-sweep.md ~
src/dev/
├── trajectory-report.ts                                        ?  (modify only if the existing projection cannot preserve the required state distinction)
└── __tests__/
    ├── trajectory-report.test.ts                               ~
    └── agent-resource-invocation.test.ts                        +
src/.pi/extensions/
├── dev-mode/introspection/trajectory.ts                         ?  (modify only if the existing recorder omits required real read evidence)
└── __tests__/dev-mode-introspection.test.ts                     ?  (producer regression coverage when the recorder changes)
```

## Row 6 · Background grants

**Target:** Each background agent receives only named skills/resources it can read, or a complete task-bundled rubric when it cannot read them.

### Cold-start reads

- `memory/SPEC.md` — D90-L, D91-L, D92-L, D134-L; I67-L
- `memory/PLAN.md` — frontier `agent-control-plane-closure`, Background grants acceptance/boundary
- `src/agents/subagents/TOPOLOGY.md` and `src/.pi/extensions/subagents/TOPOLOGY.md` — body/manifest versus adapter/session ownership
- `src/session/schema/agent-manifest.ts` — shared manifest shape
- Row 1 in this file — completed assurance semantics only

### Acceptance and verification

- ✓ background manifest/adapter tests — named skill grants survive authoring parse and product loading only when the sealed child can read their exact locations.
- ✓ prompt matrix — readable-skill child gets a legal named grant; no-tools child gets a complete rubric in its delegated task bundle or no skill instruction; neither receives a dead manifest token or “read this” instruction without `read` authority.
- ✓ child-session tests — actual advertised tools/resources match the prompt, Markdown handback remains legal, and foreground retains collation plus every mutation authority.
- Reviewer behavior, review rendering, and a new rubric design are negative space; only capability-honest delivery of an already-selected rubric is in scope.

### Expected touched paths

```text
memory/cards/agent-control-plane-closure--control-surface-sweep.md ~
src/session/schema/agent-manifest.ts                              ?
src/agents/subagents/*.md                                       ?  (frontmatter grants only; no behavior rewrite)
src/.pi/extensions/subagents/
├── agents.ts                                                    ~
├── prompt-assembly.ts                                           ~
├── session.ts                                                   ~
├── __tests__/agents.test.ts                                     ~
└── TOPOLOGY.md                                                  ~
src/.pi/extensions/__tests__/subagents.test.ts                   ~
src/app/
├── pi-subagents.ts                                              ~
└── __tests__/pi-subagents.test.ts                               ?
```

## Row 7 · Minor closure

**Target:** Immutable prompt bodies/manifests are loaded once at their owning lifetime and duplicated posture/context rendering has one private shared implementation.

### Cold-start reads

- `memory/SPEC.md` — D58-L, D90-L, D98-L, D118-L, D134-L; I67-L
- `memory/PLAN.md` — frontier `agent-control-plane-closure`, Minor closure row
- `src/agents/runtime/TOPOLOGY.md`, `src/agents/contexts/TOPOLOGY.md`, `src/agents/prompts/TOPOLOGY.md`, `src/agents/references/TOPOLOGY.md`, `src/agents/skills/TOPOLOGY.md` — current owner boundaries
- Rows 1–6 in this file — completed bodies/manifests/topology only; do not expand their acceptance

### Acceptance and verification

- ✓ registry/body identity tests — immutable elicitor/executor bodies plus skill/reference manifests are reused at process lifetime and still resolve correctly from an unrelated cwd.
- ✓ context snapshot/contract tests — one private posture/context renderer serves live foreground and explicit background snapshot composition without creating a new public runtime seam.
- ✓ `npm run check:skills` — cached manifests still expose the exact code-owned live skill set.
- ✓ `npm run verify` — the full seven-row implementation passes the routine project gate before submission.

### Expected touched paths

```text
memory/cards/agent-control-plane-closure--control-surface-sweep.md ~
src/agents/
├── prompts/
│   ├── registry.ts                                              ~
│   └── __tests__/registry.test.ts                               ~
├── references/
│   ├── registry.ts                                              ~
│   └── TOPOLOGY.md                                              ~
├── skills/
│   ├── registry.ts                                              ~
│   └── __tests__/registry.test.ts                               ~
├── runtime/
│   ├── elicitor/
│   │   ├── compose-live-prompt.ts                               ~
│   │   └── __tests__/compose-live-prompt.test.ts                ~
│   └── executor/
│       ├── compose-prompt.ts                                    ~
│       └── __tests__/compose-prompt.test.ts                     ~
└── contexts/
    ├── seeds/turn-context.ts                                    ~
    └── TOPOLOGY.md                                              ~
src/agents/shared/
├── posture-context.ts                                           +
└── __tests__/posture-context.test.ts                            +
```

## PLAN acceptance preservation map

- **Assurance semantics:** `src/agents/references/data-model.md` and `readiness-bands.md` distinguish physical compatibility taxonomy from D131-L conduct. Evidence is capture-only and is not an expected projection deliverable; `vv_obligation` is marked legacy/reserved without deleting its schema entry.
- **Foreground block identity:** focused prompt tests prove identical-composition idempotence and changed-composition replacement for role/style/tools/resources in plain strings and provider block/message carriers.
- **Context topology:** context tests and topology docs prove the selected D58-L/D101-L path; no production-required parameter is unused and no canonical doc names a nonexistent caller.
- **Control ownership:** control-map tests make posture/style/agenda provenance and lifetime explicit while preserving their intentional separation.
- **Resource invocation / Background grants:** foreground trajectory tests prove required capture-time skill/reference reads; background prompt tests cover readable-skill, bundled-rubric, and no-tools agents without contradictory instructions.
- **Global negative space:** existing seed fixtures and historical rows remain unchanged unless they are live conduct oracles. No schema enum, database migration, compatibility shim, production capture IR, or mass fixture regeneration lands.

## Verification stack

- Per row: run the focused oracle named by that row, then `npm run fix` after each meaningful edit.
- Before any row commit: `npm run verify`.
- Before frontier submission: `npm run check:skills`; all prompt/resource composition and provider-carrier tests; topology/import contract checks; focused subagent prompt/grant tests; controlled ingest/project/propose traces; final `npm run verify`.
- `npm run verify:full` is required locally only if a row changes a slow production seam under `AGENTS.md`; otherwise CI owns the full suite.

## Explicitly unscoped

- FE-1187 review renderer, web graph display, and outer extraction-breadth evidence.
- `capture-ledger-tracer` and its four-section capture intervention, campaign schema, run fixtures, judgments, or promotion work.
- `reviewer-agent-mode` behavior; this sweep supplies only honest resource access for that external-owner consumer.
- Dedicated automatic evidence promotion, new graph kinds/edges, schema migration, compatibility shims, and fixture regeneration.
- Any design/spike, production capture IR, or row discovered beyond this closed inventory.

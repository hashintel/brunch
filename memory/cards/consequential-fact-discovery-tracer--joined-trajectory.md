# Joined trajectory from a real TUI run

Frontier: consequential-fact-discovery-tracer
Status:   active
Mode:     single
Created:  2026-07-15

## Orientation

- **Containing seam:** dev-only observability joins the real Brunch/Pi TUI path to scratch evidence; it does not create product runtime state.
- **Frontier:** FE-1208 `consequential-fact-discovery-tracer`; this is the first tracer inside the frontier, not a separate issue or branch.
- **Posture:** proving (inherited from `consequential-fact-discovery-tracer`).
- **Main open risk:** current Pi events, provider-payload introspection, active-branch JSONL, and TUI-driver artifacts may not correlate precisely enough to distinguish advertised, read, and provider-visible directives without inventing a second event spine.

## Target Behavior

A real `BRUNCH_DEV` TUI session is reconstructable as one deterministic report from provider-visible directives through persisted outputs.

## Cold-start reads

- `memory/SPEC.md` — requirement 24; A5-L; D68-L–D70-L; I55-L; §Verification Design combined trajectory/evaluation assessment, loop-tier oracles, flywheel note, and acknowledged blind spots.
- `memory/PLAN.md` — frontier `consequential-fact-discovery-tracer` (FE-1208).
- `src/dev/TOPOLOGY.md` — dev front door, TUI-driver scratch lifecycle, real-boot meaning, and debug-cache/evidence distinction.
- `src/.pi/extensions/TOPOLOGY.md` — adapter-only ownership and last-registered passive introspection discipline.
- `src/.pi/extensions/dev-mode/introspection/TOPOLOGY.md` — current provider-payload capture and debug-cache contract.
- `src/session/TOPOLOGY.md` — active-branch-only product semantics and explicit diagnostic/history exceptions.
- `docs/design/AGENT_TRACING.md` — constraints only: passive taps, no global OTel provider, traces never product truth.

## Boundary Crossings

```text
project-local pi-interactive-shell overlay → real npm run dev-cli TUI launch with BRUNCH_DEV
  → documented npm run tui-driver fallback only when the host overlay cannot bind
  → last-registered passive introspection hooks
  → normalized provider/tool/message event capture in workspace .brunch/debug/
  → canonical active-session branch + optional bounded terminal viewport artifact
  → npm run dev-cli -- trajectory (explicit workspace/session/run inputs)
  → .fixtures/scratch/trajectory/<run-id>/{trajectory.json,report.md}
```

## Scope

Build only the legibility envelope needed to witness one foreground turn sequence:

- Persist a normalized, ordered dev-only event stream for provider requests, resource-reading tool calls/results, and assistant message completion. Correlate with Pi-owned turn/tool-call identifiers where available; fail loudly rather than timestamp-guess when a required join is ambiguous.
- Project each provider call's directive state into named categories: fixed agent body/control, advertised skill/reference manifests, resources actually read, and which subsequent provider call could see each read result. Preserve an explicit `unknown`/unclassified representation rather than silently dropping prompt material.
- Reuse the canonical active-branch reader for transcript effects. Do not parse append-order JSONL as current product state and do not introduce a transcript/event store.
- Add one dev-front-door `trajectory` command that takes explicit workspace, session file, portable run id, and an optional bounded viewport artifact; it writes one structured envelope and one deterministic Markdown projection under repo-root scratch. The report contract must not depend on one terminal-driver implementation.
- Include the bounded viewport when supplied. Keep any raw overlay/PTY log in its existing scratch home; do not copy an unbounded terminal log into the trajectory artifact.
- Exercise the real composition root: the tracer may enable existing `BRUNCH_DEV`/developer-tool options, but no test-only registrar may supply instrumentation that the TUI launch omits.

Excluded from this slice:

- the hidden-fact scenario, scorer, warrant-directive ablation, multi-run campaign, or promoted evidence;
- OTel exporters, span-tree UI, subagent ancestry, provider/cache metrics, or trace rotation;
- Claude Code/Cursor adapters or a generic benchmark framework;
- product RPC/schema changes, product truth, or automatic reading of trajectory artifacts by the agent.

## Risks and Assumptions

- **ASSUMPTION:** Pi's installed lifecycle events plus active-branch JSONL expose stable turn/tool-call correlation for the foreground path.
  - **IMPACT IF FALSE:** the joined-envelope shape or the frontier's first implementation boundary must change before scorer work; broad tracing cannot safely build on guessed order.
  - **VALIDATE:** the real-TUI tracer and generated fixture must fail on a missing/ambiguous correlation and pass without timestamp-only joins.
- **RISK:** prompt-section parsing becomes a brittle shadow prompt model.
  - **MITIGATION:** classify only stable Brunch-owned markers/manifests, retain hashes and explicit unclassified material, and keep the projector dev-only.
- **RISK:** normalized traces capture secrets, authorization data, or unbounded model/transcript content.
  - **MITIGATION:** do not record environment/auth/provider headers; capture only the directive metadata and bounded content required by this claim; keep raw local sources in their existing workspace/TUI scratch homes.
- **RISK:** a harness-only event source passes while production TUI wiring remains absent.
  - **MITIGATION:** register through `createBrunchPiExtensions`' existing introspection option and witness through `runBrunchTui`; no injected test-only extension path.
- **RISK:** `.brunch/debug/` is mistaken for promoted evidence.
  - **MITIGATION:** the report copies normalized inputs into `.fixtures/scratch/trajectory/`; neither location is durable evidence until the later campaign explicitly reviews and promotes it.

## Posture Check

- **Proof of life:** lights the real TUI → directive capture → JSONL/output join → text report path.
- **Invariant:** locates the product-path/passive-tap boundary and the active-branch/scratch-evidence boundary.
- **Uncertainty:** directly tests whether the existing Pi event surface is sufficient before OTel or broader span work earns entry.
- A spike is not cheaper: only the vertical product-path tracer can expose harness-only wiring and real correlation gaps.

## Acceptance Criteria

- ✓ `src/.pi/__tests__/introspection.test.ts` — the last-registered tap records the bounded provider/read-tool/message event vocabulary in order, preserves Pi correlation ids, returns `undefined`, and omits auth/provider-header data.
- ✓ `src/dev/__tests__/trajectory-report.test.ts` — a captured event stream + active-branch session fixture projects stable directive states (`advertised`, `read`, `provider_visible`, `unknown`) and transcript effects into deterministic JSON and Markdown.
- ✓ `src/dev/__tests__/trajectory-report.test.ts` — missing or ambiguous required correlation fails with a named diagnostic rather than falling back to timestamp order.
- ✓ `src/dev/__tests__/dev-cli.test.ts` — `trajectory` requires explicit safe inputs, rejects non-portable run ids and mismatched workspace/session/viewport sources, and writes only beneath `.fixtures/scratch/trajectory/<run-id>/`.
- ✓ `src/session/__tests__/active-branch-reader-inventory.test.ts` and the new report fixture — an abandoned sibling's directives/tool effects cannot enter the current trajectory.
- ✓ FE-1208 first-slice TUI tracer — launch a seeded Brunch TUI through the canonical project-local `pi-interactive-shell` overlay (use `npm run tui-driver` only when documented sandbox socket policy prevents the overlay), drive one named resource read and subsequent assistant output, generate the report, and verify it contains the ordered directive read, the later provider-visible state, the persisted output effect, and a bounded viewport while teardown leaves no live session.
- ✓ `npm run verify` — repository gate passes without adding a shipped runtime dependency or product extension mode.

## Verification Approach

- **Inner:** schema/contract, negative-space, deterministic projection, and active-branch tests prove event shape, ordering, directive classification, fail-closed joins, and artifact bounds.
- **Middle:** one real-provider TUI-driver tracer proves the product composition root emits enough evidence to reconstruct the report.
- **Outer:** none for this instrumentation slice. Semantic human calibration and promoted 3×/arm evidence remain owned by FE-1208's later evaluator/campaign slices; re-enter when the joined report is stable.

## Cross-cutting Obligations

- Traces and `.brunch/debug/` remain dev/eval artifacts, never product truth or a canonical cross-store event spine.
- The common envelope must not require Brunch-only internals for its eventual outcome fields; Brunch trajectory enrichment is diagnostic.
- Directive presence and temporal precedence support attribution only; this slice must not label them causal.
- Preserve the recorded frontier tradeoffs and triggers in `memory/PLAN.md` and SPEC §Acknowledged Blind Spots.
- Scratch artifacts do not promote automatically; I55-L path portability applies when later evidence is promoted.

## Expected Touched Paths (Tentative)

```text
src/
├── .pi/
│   ├── __tests__/introspection.test.ts                         ~
│   └── extensions/dev-mode/introspection/
│       ├── TOPOLOGY.md                                        ~
│       ├── debug-cache.ts                                     ~
│       ├── index.ts                                           ~
│       └── trajectory.ts                                      +
├── dev/
│   ├── TOPOLOGY.md                                            ~
│   ├── dev-cli.ts                                             ~
│   ├── trajectory-report.ts                                   +
│   └── __tests__/
│       ├── dev-cli.test.ts                                    ~
│       └── trajectory-report.test.ts                          +
└── session/__tests__/active-branch-reader-inventory.test.ts   ~

.fixtures/scratch/trajectory/<run-id>/                          + runtime-only, gitignored
```

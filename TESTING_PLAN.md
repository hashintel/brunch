# Brunch Demo / Audit / Diagnose Testing Plan

This pass validates the current Brunch POC after the recent data-model and agent-model changes landed on the Graphite stack. It is a demo plan and an audit checklist: run through real dev scenarios, observe what the agent saw and did, and classify any divergence.

## Goals

1. Prove the current dev launcher and workbench loop are understandable and repeatable.
2. Confirm `.brunch/debug/*` observability is present for source/dev runs.
3. Exercise Specify-mode elicitor behavior across orientation, elicitation, proposal, projection, mapping, review, and commitment flows.
4. Verify recent model changes in live context:
   - no persisted/count-based elicitation gap scoring
   - session-local elicitation scratchpad as asking agenda, not graph truth
   - readiness as just-in-time graph-fact reasoning
   - graph item `settlement` distinct from `basis`
   - absolute, readable Brunch `SKILL.md` locations in the live prompt manifest
5. Capture divergences as product, data-model, prompt/context, skill-routing, transport/projection, or demo-friction findings.
6. Pressure-test two design questions with live evidence — **both answered by the 2026-07-03 grill; probes remain as verification, not open design**:
   - **Generative discoverability**: does the Specify-mode elicitor ever spontaneously go generative (`propose`/`project`) when the spec needs it, and would a user ever discover they can ask for it? *Answered:* generative flows are offered at deterministic junctures via the product-owned orientation dialog (`session-entry-orientation`), not model volition; Enhance as a third mode is rejected (two modes only, D98-L). The probe now verifies menu→conduct routing.
   - **Reboot semantics**: "kick" is currently origination-only; the working hypothesis was that all restart-like session events should be able to trigger a kick. *Answered differently:* the resolution is the orientation dialog on juncture events (`session_start` new/resume/fork, `session_tree`, esc/abort settle, mode switch, `/consult`) whose recorded `brunch.session_orientation` outcome feeds the next kick — not kick-on-every-FTR-event. Scenario 7's evidence fed this decision.

## Primary invocation surface

The dev launcher is `scripts/dev.ts`, exposed through:

```sh
npm run dev
```

It delegates to `src/dev/dev-cli.ts` and is the front door for local workbenches, scripted RPC reads, graph curation, and fixture export.

Useful forms:

```sh
# Interactive TUI workbench from a tracked seed; opens the web observer by default.
npm run dev -- --seed workspace-alpha-grounding/base --reset

# Same, with prompt-affecting developer tools enabled.
npm run dev -- --seed workspace-alpha-grounding/base --reset --dev-tools

# Re-open an existing workbench.
npm run dev -- --workspace .fixtures/workbenches/workspace-alpha-grounding

# Public RPC read/write host without TUI.
npm run dev -- rpc rpc.discover --workspace .fixtures/workbenches/workspace-alpha-grounding
npm run dev -- rpc workspace.state --workspace .fixtures/workbenches/workspace-alpha-grounding
npm run dev -- rpc graph.overview '{"specId":1}' --workspace .fixtures/workbenches/workspace-alpha-grounding

# Explicit local graph curation through CommandExecutor.
npm run dev -- mutate --workspace .fixtures/workbenches/workspace-alpha-grounding --params-file /tmp/mutate.json

# Export current workbench graph state as a reusable seed candidate.
npm run dev -- export --workspace .fixtures/workbenches/workspace-alpha-grounding --spec-id 1 --out .fixtures/seeds/custom/example.json
```

Seeding is never implicit. Launch-time seeding must pair `--seed <name>/<variant>` with `--reset` so stale local session state does not masquerade as reusable truth.

## Debug and dev-tool matrix

Source/dev TUI launches create passive debug mirrors by default through `debugMirror: isBrunchDevelopmentRuntime()`. The CLI does not require `--dev-tools` for this default mirror.

| Surface | Requires `--dev-tools`? | Expected output / effect |
| --- | --- | --- |
| `.brunch/debug/entry-contents.md` | No, in source/dev TUI runs | Brunch-authored custom entries and custom-message contents such as context seed, `worldUpdate`, continuity drains, and capture-sweep markers. Should exist even for seeded-but-unkicked sessions when a seed entry is appended. |
| `.brunch/debug/origination.md` | No, in source/dev TUI runs | Origination decision/outcome records: start/resume/idle/no-model evidence. |
| `.brunch/debug/system-prompt.md` | No, in source/dev TUI runs, but needs a provider request | Latest captured final provider system prompt from `before_provider_request`. Absence before any provider call is expected. |
| `.brunch/debug/tool-contents.md` | No, in source/dev TUI runs, but needs matching tool results | Text from explicit Brunch-owned tool results, including `read_graph`, `read_session_context`, `read_workspace_context`, `present_question`, `present_review_set`, `request_response`, `mutate_graph`, and the dev query tools when used. |
| `.brunch/debug/transcript.md` | Harness-dependent | Written by faux / tier-2 harness loops, not the ordinary TUI mirror. |
| `/introspect` command | No when introspection/debug mirror is enabled | Reports base prompt inputs plus latest passive provider payload capture to the TUI. |
| `brunch_session_query` tool | Yes | Dev-gated read-only query over current session branch. Candidate for retirement if the ordinary debug mirrors prove sufficient. |
| `brunch_introspect_query` tool | Yes | Dev-gated read-only query over captured provider payload/base prompt inputs. Candidate for retirement if the ordinary debug mirrors prove sufficient. |
| `subagent` tool | No | Product Brunch subagent affordance in Specify mode when a delegatable set is registered. |
| Web sidecar (default; `--no-webui` opts out of browser opening) | No | Opens the read-only browser observer attached to the TUI process. |
| `rpc`, `mutate`, `export` dev CLI subcommands | No | Scripted host/curation/export commands; not prompt-affecting tools. |

Audit rule: a missing debug file is only a failure if its trigger happened. For example, no `system-prompt.md` before any provider request is expected; no `entry-contents.md` after session origination/continuity seed is suspicious.

## Baseline scenario loop

For each scenario:

1. Reset or select a workbench.
2. Capture initial projections:
   ```sh
   npm run dev -- rpc workspace.state --workspace <workspace>
   npm run dev -- rpc session.runtimeState --workspace <workspace>
   npm run dev -- rpc graph.overview '{"specId":1}' --workspace <workspace>
   ```
3. Run the TUI scenario.
4. Inspect `.brunch/debug/*` and the session JSONL.
5. Re-read RPC projections and graph overview/neighborhood.
6. Classify findings.

Suggested starting workbench:

```sh
npm run dev -- --seed workspace-alpha-grounding/base --reset --dev-tools
```

## Scenario catalog

### 1. New session orientation

Expected behavior:

- Agent starts from selected spec/workspace context.
- Agent asks for the smallest missing anchor if the frame is thin.
- Agent focuses one concrete vein rather than attempting to cover all zero-count kinds.
- `entry-contents.md` shows context seed and scratchpad/graph-fact material.
- `system-prompt.md` includes the live Brunch skills manifest after the first provider request.

Evidence to inspect:

- `.brunch/debug/entry-contents.md`
- `.brunch/debug/origination.md`
- `.brunch/debug/system-prompt.md`
- `session.pendingExchange`, `session.exchanges`, `session.runtimeState`

### 2. Skill-routing smoke

Prompt the agent toward moves that should trigger different Brunch prompt resources:

- “Look over the current graph and tell me what changed your next move.” → `analyze`
- “Ask me the next focused question.” → `elicit`
- “I’m pasting source notes; digest and route them.” → `ingest`
- “Turn that answer into graph shape.” → `map`
- “Generate candidate requirements / oracles / design options.” → `propose`
- “Project accepted requirements into design/oracle material.” → `project`
- “Critique what we have before committing more.” → `review`
- “Walk me through how Brunch works.” → `tutorial`

Expected behavior:

- The live prompt manifest lists exactly the first-level skills.
- Each `<location>` is an absolute path ending in `agents/skills/<id>/SKILL.md`.
- The path is readable from the running process cwd.
- The model uses the read tool to load a matching skill before leaning on detailed guidance.

Evidence to inspect:

- `.brunch/debug/system-prompt.md`
- `.brunch/debug/tool-contents.md`
- session JSONL tool calls/results
- `src/agents/skills/__tests__/registry.test.ts`

Failure modes to discriminate: never-reads (manifest ignored), wrong-skill (reads a non-matching SKILL.md), reads-but-ignores (loads it, conduct unchanged).

#### Per-skill discriminating state (seed-gap matrix)

Each probe needs graph state where the target skill is the *distinctively correct* move; without it, routing evidence is ambiguous.

| skill | trigger probe | discriminating state | fit today |
| --- | --- | --- | --- |
| analyze | "what changes your next move?" | mid-size graph | ◔ alpha trivial; `bilal-macro-view/base` (232n) is wrong workbench |
| elicit | "ask next focused question" | thin intent + zero-count bands | ✓ alpha is exactly this |
| ingest | paste source notes | any state (empty workbench cleanest) | ✓ now |
| map | "turn answer into graph shape" | chained after elicit/ingest | ✓ chained |
| propose | "generate candidate reqs/oracles" | settled intent + EMPTY target plane | ✓ `workspace-alpha-grounding/intent-settled` |
| project | "project reqs into design/oracle" | ACCEPTED upstream + empty downstream | ✓ `workspace-alpha-grounding/requirements-accepted` |
| review | "critique before committing" | plantable weaknesses; advisory items | ◔ no seed has settlement variation |
| tutorial | "walk me through Brunch" | state-independent | ✓ now |

#### Seed-variation worklist (fixture-prep; offered as a batch-2 scope card, not yet scoped)

- `✓ <ws>/intent-settled` → unlocks propose: settled goal/req intent, empty design+oracle planes
- `✓ <ws>/requirements-accepted` → unlocks project: settled requirements, zero criterion/check/vv_*
- `+ <ws>/advisory-pending` → unlocks review: settled+advisory mix — **new variant class**; A36-L made seeds settlement-independent, so check `seedFixture` accepts settlement on the way in first
- `+ <ws>/contradictory` → review + `semantic_conflict` testing (converges with `reconciliation-derivation` frontier)
- `? mid-size alpha (~30n)` for analyze
- Prep path: drive a workbench live to the desired state → `npm run dev -- export` as seed candidate

Key dependency: the generative paths (propose/project) are exactly the ones with no discriminating seed — those variants are a prerequisite for the generative-discoverability probe (goal 6) and for verifying the F17 mode-menu options, not just skill routing.

### 3. Readiness and next-question flow

Expected behavior:

- Deterministic renderers expose raw facts: graph LSN, node counts by kind, zero-count kinds with latest expected bands.
- No count-based readiness score, rank, importance, persisted gap grade, or coverage estimate appears.
- The elicitor uses bands as absence signals and capability-readiness as judgment, not as a gate.
- Missing material becomes a structured question or session-local scratchpad obligation, not a persisted `elicitation_gaps` row.

Evidence to inspect:

- `.brunch/debug/entry-contents.md` for context seed rendering
- `.brunch/debug/system-prompt.md` for per-turn selected workspace/spec graph context
- `brunch_session_query` if `--dev-tools` is enabled
- `session.runtimeState` and session JSONL for scratchpad entries

Canonical code paths:

- `src/agents/contexts/seeds/graph-fact-seed.ts`
- `src/agents/contexts/seeds/origination.ts`
- `src/agents/contexts/seeds/turn-context.ts`
- `src/agents/prompts/elicitor.md`
- `src/agents/references/readiness-bands.md`
- `src/session/elicitation-scratchpad.ts`

### 4. Settlement visibility and graph writes

Expected behavior:

- DB schema includes `settlement` on `nodes` and `edges` with default `settled`.
- Commands can create advisory graph material and promote advisory → settled.
- Commands reject invalid settlements and settled → advisory regression.
- Graph projections/renderers surface advisory items honestly.
- **Capture-time settlement convention** (prompt-carried, not code-enforced — watch closely): intent-plane captures may land settled with direct authority; design/oracle/commitment-plane material captured during ingest/map lands `advisory` and is settled only through the review window. Known hazard: `mutate_graph` defaults omitted settlement to `settled`, so a forgetful elicitor silently over-settles ingested material. Record every non-intent-plane create where the agent omitted or wrongly set settlement — this decides whether we need provenance/action-traced enforcement (or a mode-derived signal) in code.

Evidence to inspect:

- `drizzle/0008_sharp_storm.sql`
- `src/db/schema.ts`
- `src/graph/__tests__/settlement.test.ts`
- `graph.overview` / `graph.nodeNeighborhood`
- `.brunch/debug/tool-contents.md` after `read_graph` or graph mutation tools

### 5. Structured exchange and review set

Expected behavior:

- Assistant authors present-side exchanges with `present_question`, `present_candidates`, or `present_review_set`.
- Follow-up collection uses `request_response`.
- Selection responses preserve the current result-detail vocabulary (`request_answer`, `request_choice`, `request_choices`).
- Review-set approval commits atomically through the graph command layer.
- No graph write happens before recognition/approval when the flow is candidate/review based.

Evidence to inspect:

- session JSONL paired toolCall/toolResult entries
- `session.pendingExchange`
- `session.exchanges`
- graph LSN before/after approval
- `.brunch/debug/tool-contents.md`

### 6. Public RPC and web observer parity

Expected behavior:

- `rpc.discover` exposes Brunch product methods, not raw Pi capability inference.
- Ordinary web sidecar `/rpc` is read-only.
- `/rpc/driver` exposes live driver methods only when TUI live handles exist.
- Graph/session changes publish visible projection invalidations.

Evidence to inspect:

- `rpc.discover` from dev CLI
- browser sidecar behavior
- `graph.overview`, `session.pendingExchange`, `session.exchanges` before/after turns

### 7. Mode switch, FTR events, and session reboot

Known state going in: `applyModeSwitch` (`src/.pi/extensions/commands/index.ts`) swaps the system prompt + active tools and appends a `brunch.agent_runtime_state` custom entry (`reason: 'switch'`), but does **not** trigger a kick — kick today is origination-only (D78-L, `src/session/originate-assistant-turn.ts`). **Resolution decided (2026-07-03 grill):** the seam is the deterministic orientation dialog on juncture events — `session-entry-orientation` owns the dialog + juncture set, `execute-entry-readiness` owns the Execute-mode entry assessment — not a unified "kick on every FTR event" mechanism. This scenario's probes remain useful as before/after evidence for those frontiers.

Expected behavior (current contract):

- `/brunch:mode` (or `alt+m`) switches Specify ↔ Execute.
- Runtime-switch entry appears in session state with `previous` + `source`.
- A status-change notification is visible in the transcript/TUI.
- The next provider request uses the new role's system prompt (`elicitor.md` vs `executor.md`) and the new active-tool set.
- Executor mode blocks shell/edit/write and exposes executor-only `execute_*` tools.

Dramaturgical probes (observe, classify, don't fix in-line unless trivial):

- After switching, does the new agent orient itself unprompted, or does it sit silent until poked? (This is the missing mode-entry kick.)
- **Execute-gate pushback**: switch to Execute with a spec that has intent but thin design/oracle/commitment coverage and say "OK let's go." Does the executor push back — "let's figure out technical design, verification design, and plan sequencing first" — and route the user back, or does it barrel ahead? *Settled (2026-07-03 grill):* two modes only; Enhance is rejected. The target conduct is now defined by `execute-entry-readiness` (entry assessment + gentle backfill, no mode ping-pong) — this probe becomes its before/after walkthrough beat.
- Resume an existing session (`--workspace` without `--seed`): does re-entry produce a coherent reorientation, and is there any session-state evidence of the re-entry event?

Evidence to inspect:

- `.brunch/debug/system-prompt.md` before/after switch
- `.brunch/debug/origination.md` (expect NO mode-switch kick record — confirming the gap)
- `session.runtimeState` and session JSONL runtime-switch entries
- `src/.pi/extensions/__tests__/commands-runtime-switch.test.ts` as the current contract

### 8. Seeded-scenario probe via tier-2 harness

Expected behavior:

- A tracked seed loads a scenario to a known state, a scripted input runs, and output quality is validated — without the interactive TUI.
- The probe writes JSONL evidence under `.fixtures/scratch/` suitable for promotion.

Canonical code paths:

- `src/dev/tier-2-harness.ts`, `src/dev/faux-harness.ts`
- `src/probes/capture-quality-loop.ts`, `src/probes/fixture-curation-loop.ts`
- `src/graph/seed-fixtures.ts`

Evidence to inspect:

- probe run JSONL + report/oracle artifact
- `.brunch/debug/transcript.md` (tier-2 harness writes this)

Fixture grooming rider: while here, inventory `.fixtures/seeds/` (18 seed dirs) for staleness against the current data model, wipe and reseed dev workbenches, and shortlist which seeds become the preset scenarios for repeatable probes. Grooming actions are their own scoped task — record candidates, don't churn fixtures mid-walkthrough.

## Finding classification

Use this taxonomy while diagnosing:

| Finding kind | Meaning |
| --- | --- |
| product behavior | The user-visible flow is wrong even if internals are working. |
| data model | Graph/session facts are missing, stale, illegally shaped, or over/under-settled. |
| prompt/context | The model did not see the right context, or saw misleading/stale prompt text. |
| skill routing | Skill manifest/path/load behavior is wrong, or model chooses the wrong prompt resource. |
| exchange protocol | Structured exchange present/response/review-set tuple is illegal or unobservable. |
| transport/projection | RPC/web/TUI projections disagree with canonical state. |
| observability | Behavior might be correct, but debug/probe surfaces do not let us prove it. |
| demo friction | Product may be sound, but the operator path is too hard for demos. |

## Promotion discipline

Scratch output under `.fixtures/scratch/` is not durable evidence. Promote a run only after review:

1. Move reviewed artifacts under `.fixtures/runs/<probe-id>/<run-id>/`.
2. Include source `session.jsonl` and a report/oracle artifact.
3. Normalize local absolute paths.
4. Run the promoted-path guard before committing promoted evidence.

```sh
npm run check:promoted-run-paths
```

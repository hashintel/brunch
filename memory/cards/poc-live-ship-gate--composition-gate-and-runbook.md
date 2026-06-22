# POC live ship gate: public-entry composition gate + live runbook

Frontier: poc-live-ship-gate | FE-811
Status:   active
Mode:     chain
Created:  2026-06-22

## Orientation

- **Seam:** `poc-live-ship-gate` (FE-811), lower-line ship-correctness gate on branch
  `ln/fe-811-poc-live-ship-tie-off`. The demo is past; the gate's purpose survives as the
  harness-as-false-proof guard — prove the real product composes through public entrypoints
  with no hand-wired wiring modules.
- **Load-bearing finding (recon 2026-06-22):** the public CLI exposes `--mode rpc` (a real
  JSON-RPC line server over stdio built from genuine `createRpcHandlers` + coordinator +
  `createProductUpdatePublisher`). Its `FULL_RPC_METHOD_REGISTRY` = `rpc.discover + workspace.* +
  graph.* + session.*`. It **excludes** `session.driveTurn` / `session.answerExchange` (added only
  by `createWebSidecarRpcHandlers` when the TUI attaches a live-`AgentSession` handle). The faux
  provider is an **in-process-only** `agentServices` override (tests + tier-2 harness); `PI_OFFLINE`
  yields *no model* (kick skipped, `no_model_available`), not a deterministic fake. **Conclusion: a
  subprocess driving the public entrypoint cannot produce a deterministic agent turn** without
  shipping a test-only provider seam into the product (rejected under pre-release posture).
- **Fork resolution:** not A/B/C — a **two-tier split**. Tier 1 (Card 1) is the deterministic
  composition gate + anti-cheat guard over `--mode rpc`, CI-grade, no model. Tier 2 (Card 2) is the
  live `brunch --mode tui` runbook against a real provider, manual/outer, evidence-not-gate, emitting
  durable artifacts. This matches the frontier's stance ("executable where practical, manual where
  TUI/browser interaction is unavoidable; pair every visual assertion with a durable artifact").
- **Open risk:** posture *switch* (strategy/lens/goal) has no RPC method — it is a TUI affordance.
  Card 1 proves posture **inspectable** (`session.runtimeState`); Card 2 proves **switch changes
  composed posture** via the `.brunch/debug/system-prompt.md` before/after artifact. Do not add an
  RPC posture-switch method speculatively for this gate.
- **Posture:** proving (inherited from poc-live-ship-gate).
- **Cross-cutting obligations:** keep the gate small and real (no generic e2e framework, no unrelated
  polish); gate driver/probe code lives under `src/probes/`; multi-spec discipline (target the
  selected spec, never a workspace-global graph); the anti-cheat guard is scoped to the gate
  driver/probe only — it must launch the public CLI and **not** import `createRpcHandlers`,
  `createWorkspaceSessionCoordinator`, or `createBrunchAgentSessionRuntimeFactory`.

Anti-speculation chain check: Card 2 (manual runbook + artifact schema) does **not** depend on any
implementation finding from Card 1 (subprocess composition probe). They are independent concerns on
one frontier/branch; build Card 1 first.

---

## Card 1 — Deterministic public-entry composition gate + anti-cheat import guard

Status: done

### Target Behavior

A subprocess launched via the public CLI (`node dist/app/brunch.js --mode rpc`) composes the
fresh-cwd → two-spec activation → selected-spec graph-overview → runtime-state observable path over
JSON-RPC, and a mechanical test fails if the gate driver imports private wiring modules.

### Full-card cold-start reads

```
- memory/SPEC.md   — I22-L, I35-L, I38-L, I39-L, I40-L (harness-as-false-proof); D5-L, D11-L,
                     D21-L, D52-L, D61-L (public method names, multi-spec, topology, web boundary)
- memory/PLAN.md    — frontier: poc-live-ship-gate (acceptance list = closed runbook ledger)
- src/rpc/README.md — method registry, read-only vs full vs driver registries, streaming transport
- src/app/brunch.ts — runBrunchCli --mode rpc path (the public entrypoint under test)
- src/probes/portable-report.ts — portableCwd / assertPortableRunId artifact conventions
- src/probes/public-rpc-parity-proof.ts — the in-process RPC proof to NOT imitate (imports wiring)
```

### Boundary Crossings

```
→ test/probe spawns `node dist/app/brunch.js --mode rpc --cwd <fresh tmpdir>` (subprocess)
→ JSON-RPC line client over child stdio (no wiring imports)
→ workspace.activate (new spec A) ; workspace.activate (new spec B) ; workspace.selectionState
→ graph.overview (selected spec — the web read path) ; session.runtimeState (posture observable)
→ assert composed responses + emit durable composition report under .fixtures/runs/<gate>/
→ separate static test asserts the gate driver source imports none of the three wiring modules
```

### Risks and Assumptions

```
- RISK: --mode rpc may not expose a write to *create/activate* a spec from a truly fresh cwd
    → MITIGATION: verify workspace.activate + workspace.* cover create+select; if a fresh cwd needs a
      seed step, use the public seed CLI where one exists (gate setup may use public seed), never the
      coordinator import. If no public create path exists, that is a real product gap — stop and flag,
      do not import createWorkspaceSessionCoordinator to fake it.
- RISK: spawning dist requires a build; flakiness on cold dist
    → MITIGATION: build in the probe harness (as verify-startup-no-resume.sh does) or assert dist
      freshness; keep the probe out of the default unit gate, run as a middle-loop script.
- ASSUMPTION: graph.overview + session.runtimeState are the same projections the web client consumes
    → IMPACT IF FALSE: the gate proves a contract the web does not use (false composition proof)
    → VALIDATE: cross-check method names against src/web/** RPC consumption + src/rpc/README.md
- ASSUMPTION: the three wiring modules are the complete anti-cheat denylist for this gate
    → IMPACT IF FALSE: a hand-wired path slips through under a fourth module
    → VALIDATE: confirm against the frontier acceptance list (createRpcHandlers,
      createWorkspaceSessionCoordinator, createBrunchAgentSessionRuntimeFactory) + SPEC I-refs
    → [→ memory/SPEC.md §Assumptions A5-L]
```

### Posture check (proving)

Scores on **proof of life** (first probe that drives the product through the public CLI entrypoint
end-to-end) and **invariant** (the anti-cheat import guard stabilizes the harness-as-false-proof
seam). A tracer bullet that breaks loudly if the product stops composing over public RPC — build it.

### Acceptance Criteria

```
✓ gate-composition-proof — spawns `--mode rpc` subprocess; workspace.activate creates spec A then
  spec B in one fresh cwd; workspace.selectionState confirms the active session/graph target is the
  selected spec (not workspace-global)
✓ gate-composition-proof — graph.overview returns the selected spec's overview over RPC; a second
  spec's nodes are not present in spec A's overview
✓ gate-composition-proof — session.runtimeState returns a structured posture observable over RPC
✓ gate-composition-proof — emits a durable composition report (schemaVersion, portable cwd/runId,
  per-step request/response summary) under .fixtures/runs/<gate-id>/
✓ anti-cheat-import-guard — a static test fails if the gate driver source imports createRpcHandlers,
  createWorkspaceSessionCoordinator, or createBrunchAgentSessionRuntimeFactory
```

### Verification Approach

```
- Inner: static import-guard test (anti-cheat) — runs in the default gate; trivially fast
- Middle: subprocess + JSON-RPC readback proof — launches public CLI, asserts composed projections;
  run as a script (build-then-spawn), not the default unit gate
```

### Cross-cutting obligations

```
- Gate driver/probe lives under src/probes/; imports no wiring modules (the anti-cheat invariant)
- Multi-spec discipline: assert the selected spec is the graph target; never a workspace-global graph
- Keep it small — composition + guard only; no generic e2e framework, no unrelated polish
```

### Expected touched paths (tentative)

```
src/probes/
├── ship-gate-composition-proof.ts        +
├── ship-gate-rpc-client.ts               +   (thin stdio JSON-RPC client; no wiring imports)
├── __tests__/
│   ├── ship-gate-composition-proof.test.ts   +
│   └── ship-gate-anti-cheat-guard.test.ts    +
└── scripts/
    └── run-ship-gate-composition.sh      ?   (build-then-spawn harness, if a script wrapper helps)
.fixtures/runs/ship-gate-composition/     +
```

### Build notes

- Landed `src/probes/ship-gate-composition-proof.ts` and `ship-gate-rpc-client.ts`: the probe spawns
  `node dist/app/brunch.js --mode rpc --cwd <fresh tmpdir>` and talks JSON-RPC over stdio; it does not
  import the denied wiring modules.
- To assert non-empty cross-spec graph isolation without enabling `dev.graph.mutateGraph`, setup uses the
  existing public seed CLI (`node dist/graph/seed-fixtures.js`) for two named workspace-spread specs, then
  activates each through `workspace.activate {action: "newSession"}`. This is the scoped divergence from
  the original "workspace.activate creates both specs" wording; the public create path alone creates empty
  specs, which cannot prove "second spec nodes absent" non-vacuously.
- Middle-loop command: `src/probes/scripts/run-ship-gate-composition.sh`. Sample evidence written to
  `.fixtures/runs/ship-gate-composition/2026-06-22T12-03-12.181Z/report.json`.
- Verification: `npx vitest --run src/probes/__tests__/ship-gate-anti-cheat-guard.test.ts src/probes/__tests__/ship-gate-composition-proof.test.ts`; `bash src/probes/scripts/run-ship-gate-composition.sh`; `npx tsc -p tsconfig.build.json --noEmit`.

---

## Card 2 — Live fresh-cwd runbook + durable artifact schema (manual/outer)

Status: in progress — runbook/schema landed; live provider sample run still required

### Target Behavior

A documented procedure drives the genuine `brunch --mode tui` product against a real provider from a
fresh cwd through capture→graph→web-update and a posture switch, producing a defined set of durable
artifacts checked in under `.fixtures/runs/`.

### Full-card cold-start reads

```
- memory/PLAN.md    — frontier: poc-live-ship-gate (acceptance: elicitation-rich composed path)
- docs/praxis/manual-testing.md — outer-loop UI testing / fixture capture protocol
- docs/architecture/probes-and-transcripts.md — transcript/report artifact conventions
- src/app/brunch-tui.ts — runBrunchTui: live AgentSession, web sidecar, /rpc/driver, posture switch
- src/probes/portable-report.ts — durable report schema conventions to mirror
```

### Boundary Crossings

```
→ human launches `brunch` (--mode tui) in a fresh cwd, with --open-web for the observer
→ spec/session picker → create/select spec → assistant opening turn (seeded, gap-grounded)
→ next-best question → answer → gap writeback → high-confidence generalized capture → graph truth
→ web observer shows the graph update + posture; posture switch changes .brunch/debug/system-prompt.md
→ capture durable artifacts (transcript, graph summary, posture before/after, accepted gaps) to disk
```

### Risks and Assumptions

```
- RISK: live model makes the run non-deterministic → not a CI gate
    → MITIGATION: this card is explicitly evidence/outer-loop, not a gate; the artifact schema +
      procedure are the durable deliverable, the specific run is a sample
- ASSUMPTION: the composed live path (blocks 1–3) already works end-to-end through the TUI
    → IMPACT IF FALSE: the runbook surfaces a real composition defect — that is a valid gate outcome
    → VALIDATE: the runbook itself is the validation; record any defect back to PLAN.md
- ASSUMPTION: posture switch is observable via .brunch/debug/system-prompt.md before/after
    → IMPACT IF FALSE: no durable posture-switch evidence → fall back to session.runtimeState capture
    → VALIDATE: confirm the debug system-prompt write path fires on runtime switch
```

### Posture check (proving)

Scores on **proof of life** — the genuine user entrypoint composes the full elicitation-rich path
once, with durable evidence. The artifact schema is the reusable invariant; the run is the tracer.

### Acceptance Criteria

```
✓ a runbook doc enumerates the fresh-cwd steps, each naming a public entrypoint and a durable artifact
✓ a defined artifact schema (transcript, graph summary, posture before/after, accepted gaps) is
  documented and a sample run is captured under .fixtures/runs/<runbook-id>/
✓ the sample run shows: seeded gap-grounded opening, a question→answer→gap-writeback, a
  high-confidence capture committing to graph truth, the web observer reflecting the update, and a
  posture switch changing the composed system prompt
✓ no step hand-wires the product (every step is the real TUI / its public sidecar RPC)
```

### Verification Approach

```
- Outer: manual walkthrough against a real provider; durable artifacts are the evidence
- Middle (optional): the Card 1 composition proof is re-run against the seeded workbench the runbook
  leaves behind, to tie deterministic and live evidence together
```

### Cross-cutting obligations

```
- Pair every visual/observer claim with a durable artifact or projection query
- Use the genuine entrypoint (brunch --mode tui + its sidecar /rpc); do not import wiring to fake steps
- Artifacts live under .fixtures/runs/; mirror portable-report conventions
```

### Expected touched paths (tentative)

```
docs/architecture/
└── poc-live-ship-runbook.md              +   (the documented procedure + artifact schema)
.fixtures/runs/ship-gate-runbook/         +   (sample captured run)
src/probes/portable-report.ts             ?   (only if the artifact schema needs a shared shape)
```

### Build notes

- Landed `docs/architecture/poc-live-ship-runbook.md`: public-entry-only live TUI procedure, step-by-step artifact capture checklist, report shape, and pass/fail rule. The runbook mirrors `portable-report` conventions without adding a shared TypeScript shape because the deliverable is manual/outer evidence, not a product API.
- Added `.fixtures/runs/ship-gate-runbook/README.md` as the artifact home and required file list. It explicitly says no live provider evidence has been captured yet, so it cannot be mistaken for ship evidence.
- Stop condition fired: this card requires an outer-loop manual run against a real provider/browser before it can be marked done. The remaining acceptance item is a dated `.fixtures/runs/ship-gate-runbook/<run-id>/` sample run containing transcript, graph, gap, posture, and web-observer artifacts.
- Verification performed for this build portion: `git diff --check -- docs/architecture/poc-live-ship-runbook.md .fixtures/runs/ship-gate-runbook/README.md memory/cards/poc-live-ship-gate--composition-gate-and-runbook.md` passed. `npx oxfmt --check ...` has no Markdown target in this repo and exited with “Expected at least one target file”; no JSON artifact was authored to parse.

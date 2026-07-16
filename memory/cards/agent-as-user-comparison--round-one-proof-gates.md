# FE-1210 round-one proof gates: live-control cadence + Brunch document acquisition

Frontier: agent-as-user-comparison
Status:   complete (2026-07-16 — both gates hold; scope the tracer proper next, consuming the recorded cadence settings and the `document-export` entry point)
Mode:     slices
Created:  2026-07-16

## Orientation

- Containing seam: FE-1210 round one — the harness-level Pi actor tracer defined in `memory/PLAN.md` §agent-as-user-comparison and detailed in `docs/planning/fe-1210-agent-as-user-comparison-round-one.md`. Branch `ln/fe-1210-agent-as-user-comparison` (no unique commits yet).
- These two gates are the frontier's declared preconditions: **no mission packet, actor recipe, rubric, or handover document is authored until both gates hold.** Gate failure reshapes the Friday cut immediately through `ln-plan`/`ln-scope` — it is never compensated with documentation.
- The sequence deliberately stops after the gates (anti-speculation): the tracer, mission packet, and judgment slices depend on what the gates prove (usable cadence settings; the real document-export seam) and are scoped in a follow-up card.
- Main open risks: (1) `interactive_shell` hands-free updates may be too slow for conversational control (60s default query limit); (2) `renderSpecMarkdownOutput`/`renderPlanMarkdownOutput` have definitions and tests but **no production or dev call site** — a callable Brunch document export is unproven.

Posture: proving (inherited from `agent-as-user-comparison`).

Timebox: both gates are same-day checks. If either consumes more than ~half a day without an answer, treat that as a gate failure signal and route back to `ln-plan`.

---

## Card 1 — Live-control cadence gate

Status: done 2026-07-16 — verdict `live-overlay: usable`; evidence at `.fixtures/scratch/comparisons/preflight/live-control-cadence.md` (effective loop ≈60–70 s per observe-act cycle, floor set by the 60 s query rate limit; settings quietThreshold 3000 / updateInterval 30000 / autoExitOnQuiet false; attempt 1 aborted on user takeover and retained)

### Target Behavior

A harness-level Pi session completes a rendered prompt → input → rendered result cycle against a live interactive target through `interactive_shell` hands-free mode, without substantive human takeover, with the effective settings and measured cadence recorded.

### Full-card cold-start reads

```
- memory/PLAN.md    — frontier: agent-as-user-comparison (round-one actor, proof gates)
- docs/planning/fe-1210-agent-as-user-comparison-round-one.md — §1 Same-day proof gates; §3 Pi actor skill
- docs/praxis/manual-testing.md — TUI-driving priority order, evidence capture, cleanup discipline
- .pi/npm/node_modules/pi-interactive-shell/skills/pi-interactive-shell/SKILL.md — overlay launch, hands-free query/update settings, spawn seam
```

### Boundary Crossings

```
→ harness-level Pi session (the actor)
→ interactive_shell overlay (hands-free mode; configured quiet/update settings)
→ live PTY target (a trivial interactive program or a seeded `npm run dev-cli` TUI)
→ rendered viewport back to the actor → keyed/text response → rendered result
```

### Risks and Assumptions

```
- RISK: hands-free updates arrive too slowly for a conversational loop (default 60s query limit)
    → MITIGATION: tune the documented quiet/update settings first; if still unusable, the gate
      verdict is "fallback" — the tracer uses `npm run tui-driver` and the lost overlay
      capabilities (takeover, runtime resize, multiline paste) are recorded as a real loss,
      not papered over.
- ASSUMPTION: `interactive_shell` asynchronous update behavior is usable for an agent-driven loop
    → IMPACT IF FALSE: the round-one actor shape changes (fallback driver), Friday scope reshapes
    → VALIDATE: this gate is the validation — run it, do not study it
    → HANDOFF-listed volatile assumption; no SPEC id (record verdict in the frontier, not SPEC)
```

### Posture check

Proving. Scores on **uncertainty** (retires the cadence assumption) and **invariants** (fixes the actor↔overlay cadence settings every later tracer slice aims from). Landing the gate *is* the proof — no spike needed.

### Acceptance Criteria

```
✓ cadence evidence — a scratch evidence note at
  .fixtures/scratch/comparisons/preflight/live-control-cadence.md records: target launched,
  the exact hands-free settings used (incl. effective minQueryIntervalSeconds and update
  settings), one full rendered prompt → input → rendered result cycle, and measured
  prompt→response timing
✓ no-takeover witness — the cycle completed without substantive human takeover (mechanical
  recovery, if any, is noted)
✓ gate verdict — the note ends with an explicit verdict: `live-overlay: usable` (settings
  recorded for the tracer) or `fallback: tui-driver` (lost capabilities enumerated)
✓ cleanup — the note records that no background process/session remained after teardown
```

Oracle: this is an outer/manual gate — the evidence note is the oracle. No repo code changes; no inner tests apply.

### Verification Approach

```
- Inner: none (no code)
- Outer: the recorded preflight evidence note, bound to the acceptance leaves above; owned by
  this card, not deferred
```

### Cross-cutting obligations

```
- scratch evidence lives under .fixtures/scratch/ and is not durable until promoted (req 24/A5-L)
- do not restart the parked warrant campaign or touch the --mode web seam
- failed/aborted attempts are retained, not deleted
```

### Expected touched paths (tentative)

```
.fixtures/scratch/comparisons/preflight/
└── live-control-cadence.md   +      (gitignored scratch; not committed)
```

---

## Card 2 — Brunch document-acquisition gate

Status: done 2026-07-16 — verdict `entry-point: dev-export (new)`; commit `34f4410c` adds the read-only `document-export` dev-cli subcommand over `renderSpecMarkdownOutput`; evidence at `.fixtures/scratch/comparisons/preflight/document-acquisition.md` + `settled-spec.md`

### Target Behavior

One fixture-backed settled spec renders to a target-authored Markdown file through a callable Brunch entry point — an existing one if discovery finds it, otherwise the thinnest dev-only export wired over the existing `renderSpecMarkdownOutput`/`renderPlanMarkdownOutput` renderers.

### Full-card cold-start reads

```
- memory/PLAN.md    — frontier: agent-as-user-comparison (document-acquisition gate; "target-authored, never reconstructed")
- docs/planning/fe-1210-agent-as-user-comparison-round-one.md — §1 gate 2; §4 final-document acquisition
- src/agents/contexts/data-model/spec/TOPOLOGY.md and .../plan/TOPOLOGY.md — renderer ownership; future web/download consumers
- src/dev/TOPOLOGY.md — dev-cli subcommand seam (`rpc`/`print`/`mutate`/`export` precedent)
- docs/praxis/seeded-dev-rpc.md — seeded workspace + deterministic read conventions
```

### Boundary Crossings

```
→ dev-cli entry (`npm run dev-cli -- <subcommand>`)
→ workspace graph read (settled spec state from a seeded workbench)
→ data-model Markdown renderer (renderSpecMarkdownOutput / renderPlanMarkdownOutput)
→ Markdown file on disk (the comparison artifact)
```

### Risks and Assumptions

```
- RISK: timeboxed discovery finds no callable entry point (expected — source search found
  definitions/tests only)
    → MITIGATION: the card pre-authorizes the thinnest dev-only export subcommand over the
      existing renderers; no new renderer, no product-runtime surface, no web/download consumer
- ASSUMPTION: Brunch can expose a target-authored Markdown document without the outer actor
  synthesizing it from a transcript
    → IMPACT IF FALSE: the comparison artifact is counterfeit (harness-supplies-wiring); the
      whole round-one comparison is invalid — reshape via ln-plan before any tracer run
    → VALIDATE: this gate — render a real fixture-backed spec to a file and diff-inspect it
    → HANDOFF-listed volatile assumption; no SPEC id
```

### Posture check

Proving. Scores on **proof of life** (first callable graph-state → Markdown-document path) and **uncertainty** (retires the document-acquisition assumption). Reshaped-not-deferred: the export slice rides inside the gate rather than waiting on a study.

### Acceptance Criteria

```
✓ callable seam — `npm run dev-cli -- <document subcommand> --workspace <ws> --spec-id <id> --out <file.md>`
  (or the discovered existing equivalent) writes the rendered spec Markdown to the named file
  — bound to a focused test in src/dev/__tests__/dev-cli.test.ts (or a sibling) asserting the
  subcommand renders a fixture spec through renderSpecMarkdownOutput to the output path
✓ renderer fidelity — the emitted file is the renderer's output for the settled state
  (existing spec-output/plan-output tests stay green: src/agents/contexts/data-model/spec/__tests__/spec-output.test.ts,
  .../plan/__tests__/plan-output.test.ts)
✓ manual witness — one run against a seeded workbench produces a Markdown document a human can
  read as "the spec Brunch produced"; evidence note at
  .fixtures/scratch/comparisons/preflight/document-acquisition.md records the command, workspace,
  and output path
✓ gate verdict — the note ends with: `entry-point: existing <path>` or `entry-point: dev-export (new)`
✓ verify — `npm run verify` green if code landed; `npm run check` if discovery found an existing seam
```

### Invariants preserved

```
- renderers stay pure presentation over graph state (no new graph-write path) — guarded by:
  existing spec-output/plan-output tests + review of the new subcommand's read-only wiring
- dev-only surface: nothing enters the shipped product CLI/runtime for this gate — guarded by:
  the subcommand lives in src/dev/dev-cli.ts alongside rpc/print/export, not src/app/
```

### Verification Approach

```
- Inner: focused dev-cli subcommand test + existing renderer tests — proves the callable seam
  and fidelity
- Outer: the manual seeded-workbench witness, bound to the acceptance leaf above; owned by this
  card
```

### Cross-cutting obligations

```
- the comparison artifact must be target-authored from durable Brunch state — never an
  outer-actor reconstruction, seed JSON, or hand-written summary (harness-as-false-proof rule)
- scratch evidence under .fixtures/scratch/ until promoted
- no product-runtime dependency or surface added for evaluation tooling
```

### Expected touched paths (tentative)

```
src/dev/
├── dev-cli.ts                      ~   (new dev-only document subcommand, if no seam found)
└── __tests__/dev-cli.test.ts       ~
src/agents/contexts/data-model/
├── spec/spec-output.ts             ?   (read-only reuse expected; touch only if a call-site
└── plan/plan-output.ts             ?    seam needs a small export adjustment)
.fixtures/scratch/comparisons/preflight/
└── document-acquisition.md         +   (gitignored scratch; not committed)
```

---

## Sequence discipline

- Card 1 and Card 2 have disjoint write paths and independent findings; sequential is the default, parallel is permitted.
- When both gates hold, delete this file and scope the tracer proper (mission packet, actor recipe, worked Brunch+Claude run, judgment packets, Dora handover) in a follow-up scope file — those slices consume the gates' recorded settings and entry point.
- If either gate fails its verdict, stop: route back through `ln-plan` to reshape the Friday cut (fallback driver and/or reduced artifact claim). Do not begin mission/rubric authoring on a failed gate.

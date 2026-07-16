# FE-1210 round-one comparison tracer

Frontier: agent-as-user-comparison
Status:   active
Mode:     slices
Created:  2026-07-16

## Orientation

- Containing seam: FE-1210's product-neutral, mission-driven comparison loop; the Pi harness session is the actor, and Brunch/Claude Code run as live targets through `interactive_shell`.
- Relevant frontier: `agent-as-user-comparison` (FE-1210) on `ln/fe-1210-agent-as-user-comparison`; the complete proof-gates card established `live-overlay: usable` and the read-only `document-export` dev-cli seam.
- Volatile handoff state: Friday 2026-07-17 needs a Dora-runnable handover. The settled operator cadence is `quietThreshold: 3000`, `updateInterval: 30000`, `autoExitOnQuiet: false`; rendered readback has a 60-second floor, so an observe-act cycle is about 60–70 seconds.
- Main risk: one live comparison may expose a real target/mission mismatch. The sequence therefore ends at its outer witness; Dora handover distillation is deliberately scoped only from the retained run evidence.

Posture: proving (inherited from `agent-as-user-comparison`).

Frontier obligations carried by every card:

- Keep comparison product-neutral: mission, matched budget, target-visible interaction, and target-authored final document are the comparison contract; Brunch JSONL/debug/trajectory material is diagnostic only.
- Retain failed and invalid attempts. Scratch is `.fixtures/scratch/comparisons/<campaign-id>/<target-run-id>/` (a campaign id other than `preflight`); reviewed bundles promote immutably to `.fixtures/runs/agent-as-user-comparison/<campaign-id>/`, after `npm run check:promoted-run-paths`.
- Do not restart `warrant-ablation-campaign`, touch `--mode web`, add a PTY abstraction, script the actor, or broaden this into orchestration. `npm run tui-driver` remains a capability-loss fallback only.

---

## Card 1 — Public mission packet and worked example

Status: done 2026-07-16 — public/controller split, matched budgets, fictional worked example, validity rules, and settled specification export command documented; `npm run check` green

### Target Behavior

A reusable public mission-packet format gives each target the same bounded brief and ready-document goal without exposing controller-only facts.

### Full-card cold-start reads

```
- memory/SPEC.md — I55-L; evidence/probe lexicon
- memory/PLAN.md — frontier: agent-as-user-comparison
- docs/planning/fe-1210-agent-as-user-comparison-round-one.md — §2, §5, §7
- docs/praxis/comparison-runs.md — cross-product boundary
- docs/praxis/manual-testing.md — evidence lifecycle and findings discipline
- memory/cards/agent-as-user-comparison--round-one-proof-gates.md — completed gate verdicts
```

### Boundary Crossings

```
→ controller-authored public mission
→ target opening prompt and target cwd
→ qualifying target-visible question
→ controller-only reveal decision
→ target-authored ready specification document
```

### Risks and Assumptions

```
- RISK: a template can accidentally place a private fact or controller path in target-visible material
  → MITIGATION: make the public/controller split and invalid-run rule explicit, then inspect the
    worked example as a target would see it.
- ASSUMPTION: a small fictional worked example is sufficient to prove packet mechanics before Dora's
  three PRDs arrive
  → IMPACT IF FALSE: the tracer needs a different mission, but the public/private contract and
    run validity rules remain reusable
  → VALIDATE: the outer tracer applies the packet unchanged; do not invent a PRD-shaped mission now.
```

### Posture check

Proving. This stabilizes the mission↔target boundary and makes private-fact leakage and invalidation observable before the live tracer. It does not claim that the worked example is representative of Dora's later PRDs.

### Acceptance Criteria

```
✓ public-packet review — docs/praxis/comparison-runs/mission-packet.md contains a public brief,
  matched question/turn/time/intervention budgets, named target output path/shape, ready and
  budget-exhausted stops, forbidden inventions/non-answers, and one small fictional worked example
  — guarded by `npm run check`
✓ controller-boundary review — the same document defines a separate controller-only fact/reveal-key
  schema, qualifying-question-only disclosure, target-cwd/path exclusions, substantive-takeover and
  private-material-access invalidation, and retention of invalid runs — guarded by manual packet
  review against the worked example
✓ leakage ceiling — the packet calls same-user filesystem separation leakage resistance rather than
  a security boundary, and never places private facts or the private-key path in the public example
  — guarded by manual packet review
✓ ready artifact — round one names a settled specification Markdown document as the ready document
  and cites `npm run dev-cli -- document-export --workspace <dir> --spec-id <id> --out <file.md>`;
  it does not require plan rendering absent a ready-definition need — guarded by manual packet review
```

### Verification Approach

```
- Inner: `npm run check` — documentation/Markdown/skill-system checks
- Outer: target-view packet review of the public example — proves no controller-only material or
  private path is presented before a qualifying reveal
```

### Cross-cutting obligations

```
- Product-neutral missions are not Brunch seeds or a new brief-library subsystem.
- Controller-only facts remain out of the target cwd/opening prompt and out of promoted public evidence.
- A public mission is copied into a reviewed promoted bundle; its private key is not.
```

### Expected touched paths (tentative)

```
docs/praxis/comparison-runs/
└── mission-packet.md   +
```

---

## Card 2 — Frozen overlay actor recipe

Status: done 2026-07-16 — frozen reveal/budget/validity policy, witnessed overlay cadence, target launch/acquisition adapters, fallback loss, and deterministic cleanup documented; `npm run check` green

### Target Behavior

A fresh harness-level Pi session can follow one frozen recipe to drive any round-one target through its live rendered interface under the witnessed cadence budget.

### Full-card cold-start reads

```
- memory/SPEC.md — I55-L; probe/evidence lexicon
- memory/PLAN.md — frontier: agent-as-user-comparison
- docs/planning/fe-1210-agent-as-user-comparison-round-one.md — §3–§5
- docs/praxis/manual-testing.md — overlay priority, fallback limits, cleanup
- docs/praxis/comparison-runs/mission-packet.md — public/controller packet contract (Card 1)
- memory/cards/agent-as-user-comparison--round-one-proof-gates.md — cadence verdict and document-export entry point
- .pi/npm/node_modules/pi-interactive-shell/skills/pi-interactive-shell/SKILL.md — supported overlay/spawn operations
```

### Boundary Crossings

```
→ fresh harness-level Pi actor
→ controller packet and budget ledger
→ interactive_shell hands-free overlay
→ Brunch / Claude Code / Cursor target process
→ bounded rendered viewport → target-visible response → retained interaction record
```

### Risks and Assumptions

```
- RISK: an actor treats the overlay as fast polling and misses a target transition
  → MITIGATION: require send-before-query and budget 60–70 seconds per observe-act cycle; never
    prescribe rapid polling.
- RISK: target-specific launch directions become target-specific conversational policy
  → MITIGATION: freeze one reveal, budget, intervention, ready-stop, and invalidation policy;
    isolate only launch/output acquisition instructions by target.
- ASSUMPTION: the documented Pi overlay operations remain available to Dora's host
  → IMPACT IF FALSE: the run may use tui-driver only with affected capability loss and
    non-equivalence recorded; it does not justify a new driver
  → VALIDATE: the tracer's preflight/cleanup evidence and lane validity note.
```

### Posture check

Proving. This lights up the actor→overlay→heterogeneous-target path and stabilizes its cadence, intervention, and cleanup invariants. The live tracer—not prose alone—tests whether it reaches a ready document.

### Acceptance Criteria

```
✓ recipe contract — .agents/skills/agent-as-user-comparison/SKILL.md instructs a fresh actor to
  load the packet, maintain a budget/interaction ledger, reveal only after qualifying questions,
  use bounded rendered viewports plus named keys/bracketed paste, and stop at ready/budget expiry
  — guarded by `npm run check`
✓ cadence contract — the recipe fixes quietThreshold 3000, updateInterval 30000, and
  autoExitOnQuiet false; it sends input before querying and budgets 60–70 seconds per observe-act
  cycle without assuming fast polling — guarded by manual recipe review against the gate evidence
✓ target adapters — the recipe gives Brunch `npm run dev-cli` TUI launch plus the settled
  `document-export` acquisition command, Claude `spawn: { agent: "claude" }`, and Cursor
  `spawn: { agent: "cursor" }` instructions without changing conversational policy — guarded by
  manual recipe review
✓ validity and cleanup — declared mechanical-only takeover, fallback capability-loss marking,
  process/session teardown, and target-visible interaction/validity recording are required;
  substantive takeover invalidates but retains the run — guarded by the tracer evidence-note oracle
```

### Verification Approach

```
- Inner: `npm run check` — recipe resource and documentation checks
- Outer: Card 4's retained overlay session/status/cleanup evidence — proves the recipe can be
  followed in a real target lane
```

### Cross-cutting obligations

```
- One fresh Pi session per target lane prevents cross-lane coaching.
- No scripted state machine, nested Claude actor, generic runner, or new PTY surface.
- tui-driver is fallback only; missing takeover/resize/multiline paste is a recorded capability loss.
```

### Expected touched paths (tentative)

```
.agents/skills/agent-as-user-comparison/
└── SKILL.md   +
```

---

## Card 3 — Split judgment prompt pack

Status: done 2026-07-16 — separately assembled masked outcome and unblinded process prompts, evidence criteria, retained execution inventory, Dora authority, and judge-affinity ceiling documented; `npm run check` green

### Target Behavior

A predeclared prompt pack produces separate evidence-referenced outcome and process assessments for one comparison run.

### Full-card cold-start reads

```
- memory/SPEC.md — I55-L; evidence lexicon
- memory/PLAN.md — frontier: agent-as-user-comparison
- docs/planning/fe-1210-agent-as-user-comparison-round-one.md — §6–§7
- docs/praxis/comparison-runs.md — cross-product comparison boundary
- docs/praxis/comparison-runs/mission-packet.md — readiness and mission rules (Card 1)
- docs/praxis/manual-testing.md — artifact lifecycle
```

### Boundary Crossings

```
→ final documents and target-visible interaction records
→ outcome packet with lane labels only
→ unblinded normalized process packet
→ manual LLM prompt execution
→ Dora adjudication record
```

### Risks and Assumptions

```
- RISK: outcome and process evidence get mixed, defeating outcome label blinding
  → MITIGATION: specify separate input packets, explicit allowed evidence, and a checkable packet
    assembly procedure.
- RISK: a Claude judge's affinity with the Claude Code lane is mistaken for neutrality
  → MITIGATION: make Dora the adjudicator and record single-Claude-judge affinity as a ceiling.
- ASSUMPTION: manual prompt execution is adequate for one round-one run
  → IMPACT IF FALSE: no result should claim repeatable automated judging; the existing frontier
    deferral owns scripted/API judging and calibration
  → VALIDATE: retain exact prompt version, inputs, outputs, and Dora's agreement/disagreement.
```

### Posture check

Proving. This stabilizes the comparison's two judgment boundaries and turns judge uncertainty into retained, inspectable evidence rather than a blended verdict.

### Acceptance Criteria

```
✓ outcome prompt — docs/praxis/comparison-runs/judgment-prompt-pack.md defines an identity-masked
  A/B(/C) final-document packet, label-only metadata, and criterion-level verdicts for completeness,
  withheld-fact coverage, recommendation quality, detail, consistency, and useful structure with
  quoted evidence and uncertainty — guarded by manual packet assembly review
✓ process prompt — the pack separately defines an explicitly unblinded normalized target-visible
  interaction packet and criteria for question count/materiality, non-inferable-fact seeking, budget
  use, and readiness behavior — guarded by manual packet assembly review
✓ authority and ceiling — the pack excludes private target internals and Brunch diagnostic enrichment,
  records that label blinding is not style anonymity, assigns final adjudication to Dora, and names
  single-Claude-judge affinity as a ceiling — guarded by `npm run check` and manual prompt review
✓ retained execution — the pack requires recording prompt/rubric version, input packet, full model
  output, and Dora agreement/disagreement in the promoted judgment bundle — guarded by Card 4's
  promoted-bundle inventory
```

### Verification Approach

```
- Inner: `npm run check` — documentation/Markdown checks
- Outer: Card 4 manually executes both predeclared prompts against retained packets; quoted evidence
  and Dora's adjudication are the oracle
```

### Cross-cutting obligations

```
- Outcome is label-blinded; process is deliberately unblinded. Do not describe either as stronger
  anonymity than it is.
- Manual judging is round-one scope; scripted judge, calibration, and multi-run statistics remain
  owned deferrals in the frontier.
```

### Expected touched paths (tentative)

```
docs/praxis/comparison-runs/
└── judgment-prompt-pack.md   +
```

---

## Card 4 — Worked Brunch-versus-Claude tracer witness

Status: next — **outer/manual witness only; execute in an overlay-capable coordinator session or by a human operator, not by a normal builder subagent**. Held 2026-07-16 at session wrap-up: the frozen mission is not yet chosen (the packet's fictional library-lockers example is the recommended round-one candidate; its controller reveal key is not yet instantiated).

### Target Behavior

One frozen mission produces retained, target-authored ready specification documents from Brunch and Claude Code through live rendered target sessions.

### Full-card cold-start reads

```
- memory/SPEC.md — I55-L; evidence/probe lexicon
- memory/PLAN.md — frontier: agent-as-user-comparison
- docs/planning/fe-1210-agent-as-user-comparison-round-one.md — §4–§7
- docs/praxis/manual-testing.md — overlay use, fallback, cleanup, evidence capture
- docs/praxis/comparison-runs.md — comparison boundary
- docs/praxis/comparison-runs/mission-packet.md — Card 1 packet
- .agents/skills/agent-as-user-comparison/SKILL.md — Card 2 actor recipe
- docs/praxis/comparison-runs/judgment-prompt-pack.md — Card 3 prompt pack
- memory/cards/agent-as-user-comparison--round-one-proof-gates.md — cadence and document-export verdicts
```

### Boundary Crossings

```
controller packet → fresh Pi actor → live target overlay → target-visible exchange
→ target-authored final Markdown document → normalized interaction/validity record
→ masked outcome packet + unblinded process packet → manual judge → Dora adjudication
→ scratch reviewed bundle → promoted immutable evidence bundle
```

### Risks and Assumptions

```
- RISK: target access to controller-only material, substantive takeover, or an unmet budget makes a
  lane invalid
  → MITIGATION: retain the attempt with a validity note; do not rerun selectively or erase it.
- RISK: an outer actor reconstructs a Brunch document from transcript material
  → MITIGATION: accept Brunch only from settled graph state via `document-export`; the actor may
  transport the file but not synthesize it.
- RISK: Cursor consumes the deadline
  → MITIGATION: attempt and document Cursor after required lanes; a blocked-lane note is sufficient.
- ASSUMPTION: the frozen packet/recipe/prompt pack are sufficient for one real mission
  → IMPACT IF FALSE: the run is evidence of a frontier-shaping mismatch; stop before handover
  distillation and scope the response from the retained witness.
  → VALIDATE: this card's live lanes and evidence-note oracle.
```

### Posture check

Proving. This is the frontier's proof of life: controller packet → live Pi actor → two real target interfaces → target-authored documents → split judgment. It retires the parked lexical-actor ceiling only if both required lanes complete without substantive takeover.

### Acceptance Criteria

```
✓ predeclared manifest — scratch contains one immutable campaign manifest before any lane starts:
  mission/actor/rubric versions, target order, model configuration, matched budgets, validity rules,
  controller/target cwd separation, artifact inventory, and Brunch/Claude required status — oracle:
  manual evidence-note review
✓ Brunch lane — a fresh Pi actor follows the recipe through the real `npm run dev-cli` TUI, handles
  rendered structured selection with named keys, and obtains the ready specification through
  `npm run dev-cli -- document-export --workspace <dir> --spec-id <id> --out <file.md>` from settled
  state, not a transcript reconstruction — oracle: visible interaction log plus exported Markdown
✓ Claude lane — a separate fresh Pi actor drives Claude Code through its spawned live target session
  under the same mission/reveal/effort rules and retains Claude's target-authored ready Markdown —
  oracle: visible interaction log plus final document
✓ validity/cleanup — each attempt retains normalized target-visible interaction, budget/intervention
  ledger, validity note, final process status, and overlay/process cleanup status; failures and invalid
  runs remain — oracle: per-run evidence note and interactive_shell final status
✓ split judgment — a label-masked final-document outcome packet and an explicitly unblinded process
  packet are manually run through the predeclared prompts, retaining quoted assessments, uncertainty,
  and Dora's agreement/disagreement — oracle: judgment bundle inspection
✓ promoted bundle — after review, `.fixtures/runs/agent-as-user-comparison/<campaign-id>/` contains
  immutable manifest, public mission, actor/rubric versions, visible logs, final documents, validity
  notes, and judgment (never the private key); `npm run check:promoted-run-paths` passes before commit
  — oracle: bundle inventory plus command exit status
✓ Cursor disposition — Cursor is attempted after the required lanes and retained as either a valid
  document or an evidence-backed blocked-lane note; it does not invalidate Brunch-versus-Claude
  handover readiness — oracle: Cursor lane record
```

### Verification Approach

```
- Inner: `npm run check:promoted-run-paths` before committing a reviewed bundle; `npm run check` for
  any documentation/skill edits made by Cards 1–3
- Middle: artifact-inventory and packet-assembly review — proves retained evidence is portable,
  correctly split, and excludes the controller-only key
- Outer: overlay-capable coordinator/human executes the two required live lanes and manual prompt
  pack; the evidence note, target-visible logs, final documents, statuses, and Dora adjudication are
  the oracle. This witness is owned by this card, never delegated to a normal builder subagent.
```

### Cross-cutting obligations

```
- Brunch + Claude Code are required; Cursor is best-effort and documented, never a Friday blocker.
- Send input before querying; wait for the witnessed 60–70 second observe-act cadence. Empty renders
  in the first ~30 seconds are not target failure.
- No plan document is acquired unless the chosen mission's ready condition genuinely requires one;
  this tracer defines ready as a specification document.
- Brunch-only diagnostic attachments never influence outcome/process judgment or disadvantage a
  competitor.
```

### Expected touched paths (tentative)

```
.fixtures/scratch/comparisons/<campaign-id>/
├── controller/                                  +  (controller-only key; never target-visible/promoted)
├── brunch-<target-run-id>/                       +
├── claude-<target-run-id>/                       +
└── cursor-<target-run-id>/                       ?  (best-effort lane)
.fixtures/runs/agent-as-user-comparison/<campaign-id>/
├── manifest.*                                    +
├── mission-public.*                              +
├── actor-recipe-version.*                        +
├── judgment-prompt-pack-version.*                +
├── <target-run-id>/
│   ├── interaction-visible.*                     +
│   ├── final-document.md                         +
│   ├── validity-note.*                           +
│   └── cleanup-status.*                          +
└── judgment/                                     +
    ├── outcome-masked.*                          +
    ├── process-unblinded.*                       +
    └── dora-adjudication.*                       +
```

## Sequence discipline

- Cards 1–3 are authoring work that a normal builder subagent may implement. Their write paths are disjoint and their settled shape does not depend on one another's implementation findings; build them in this order for a usable cold start.
- Card 4 consumes the fixed artifacts but is **not** builder work. It requires an overlay-capable coordinator session or human operator and uses the retained evidence note/bundle as its outer oracle.
- Stop after Card 4. Do **not** pre-scope the Dora handover distillation into `docs/praxis/comparison-runs.md` plus one entry point: its useful detail and exact links must derive from the witnessed run. If Card 4 exposes a shape-changing failure, retain it and route through the frontier rather than papering it over with handover prose.

# Current-system reorientation audit

Frontier: system-reorientation-audit
Status:   active
Mode:     single
Created:  2026-08-04

## Orientation

- Containing seam: Brunch's current-state authority after FE-1311 and the July executor/comparison delivery burst.
- Frontier: `system-reorientation-audit` (FE-1316), stacked after `integrity-cleanup`; this card inventories and disposes concerns but implements no promoted fix.
- Posture: **proving** (inherited from `system-reorientation-audit`); the useful result is a trusted map of which concerns are live, already owned, obsolete, or worthy of promotion.
- Main risk: this ledger becoming a sixth planning store. It owns only the frozen concern inventory and evidence-backed disposition; `memory/PLAN.md` owns work and sequencing, while SPEC/topology own durable truth.

## Target behavior

Every concern in the frozen post-cleanup inventory has one evidence-backed current-state disposition and canonical owner.

## Cold-start reads

- `memory/PLAN.md` — frontier `system-reorientation-audit`, existing frontiers, KA evidence queue, and dependencies
- `memory/SPEC.md` — D140-L, A47-L, live tracing/evaluation decisions, and acknowledged blind spots
- `memory/POSTURE.md` — proving, free-rewrite, high-stakes boundary behavior
- `memory/cards/integrity-cleanup--closure-walkthrough.md` — preceding closed inventory and explicit exclusions
- `TESTING_FINDINGS.md` — Secure Drop SD1–SD9 and current walkthrough evidence
- `docs/planning/planning-record-substrate-assessment.md` — existing planning-substrate measurements and recommendation
- `docs/design/AGENT_TRACING.md` and `docs/design/WEB_UI_ARCHITECTURE.md` — tracing and shared-host current claims
- `src/dev/TOPOLOGY.md`, `src/executor/TOPOLOGY.md`, and relevant subtree topology files — materialized current state

## Boundary

In scope is the concern inventory below: cleanup safety, handover/evidence truth, planning/document authority, agent legibility, presentation/runtime authority, and comparison/PTY ownership.

Out of scope:

- implementing a finding;
- rerunning provider, Secure Drop, comparison, or human outer witnesses;
- rewriting Notion documents without an available Notion connection;
- changing the PTY driver merely to avoid oracle-pack identity churn;
- reopening FE-1311's closed inventory or adding inferred cleanup rows to it;
- replacing `memory/PLAN.md`, SPEC, topology files, Linear, or existing findings ledgers.

A newly discovered concern may enter only when it is a missing member of one of the six frozen lanes and includes a one-line omission justification. More than one new concern stops the audit and routes back through `ln-plan`.

## Lane charter

| Lane | Question | Existing authority | Output |
| --- | --- | --- | --- |
| L0 · cleanup safety | Did FE-1311 remove or strand a required behavior? | FE-1311 commits, closure card, D140-L, tests/build/package checks | bounded keep/fix verdict; no new cleanup sweep by analogy |
| L1 · evidence and handover | Which merged mechanisms have current valid witnesses? | PLAN KA evidence queue, TESTING findings, comparison provenance, fixture sources | implementation/evidence split and corrected handover status |
| L2 · canonical truth | Which planning and design surfaces still duplicate or contradict current topology? | PLAN, SPEC, topology files, planning-substrate assessment | keep/thin/archive/promote disposition by canonical owner |
| L3 · agent legibility | What observation loop can judge prompt, skill, and context interventions? | capture-ledger frontier, trajectory tools, product prompts/skills | smallest usable feedback loop; bounded prompt defects routed separately |
| L4 · presentation authority | What remains implementation work versus outer evidence across TUI, themes, web, and session hosting? | FE-1187, shared-host arc, web/TUI topology | existing-frontier routing; no second GUI proof |
| L5 · comparison and PTY | Which comparison doors and terminal-control seams are canonical for each study shape? | comparison prompts/skills/runbooks, end-to-end contracts, `tui-driver` consumers | authority map and only behavior-justified follow-ups |

Lanes may be investigated independently, but they do not become branches by default. A finding gets a Linear issue and Graphite branch only when `ln-plan` promotes it to a frontier.

## Disposition ledger

Status vocabulary: `new` → not yet evidenced; `partial` → evidence gathered, disposition not closed; `closed` → no follow-up; `promoted` → PLAN owns the follow-up. A promoted row carries no duplicate progress state here.

| ID | Lane | Concern | Initial evidence | Canonical owner / likely route | Closure oracle | Status |
| --- | --- | --- | --- | --- | --- | --- |
| R01 | L0 | FE-1311's five-row closure remains the only admitted cleanup work | FE-1311 closeout in `docs/archive/PLAN_HISTORY.md`; current PLAN exclusion list | `integrity-cleanup` | every required row built and aggregate package/check/build oracles satisfied | closed |
| R02 | L0 | Required behavior may have been removed through an out-of-graph consumer blind spot | D140-L; FE-1311 deletion provenance; 123 focused tests; unchanged production tree since closeout | closed — no concrete broken or stranded behavior found | named consumer failure or clean current gates plus negative deletion provenance | closed |
| R03 | L1 | Notion handover status and fixture counts drift from current repository truth | Alpha 13 tag; Wisp 88/212; NullWire 61/143; SD9 | closed by source-backed correction report to the user; external Notion edit remains with its document owner | each disputed claim mapped to current file/tag/test evidence | closed |
| R04 | L1 | KA implementation claims are ahead of current valid outer witnesses | PLAN KA evidence queue; Secure Drop witness card; comparison report state | existing KA evidence queue; no umbrella executor frontier | every claimed outcome labeled implemented, witnessed-current, failed, or unknown | promoted |
| R05 | L1 | "Current test scenarios" spans several ledgers and mixes prepared scenarios with current evidence | walkthrough plan/findings; five missions; four execution cases; three E2E contracts; fixture READMEs | closed by role-specific inventory; do not create another status document | scenario availability, implementation coverage, and current valid witness are distinguished | closed |
| R06 | L2 | Mutable queue coordination and durable repository truth are carried by overlapping planning surfaces | planning assessment versus current PLAN/Linear/Graphite authority rules | `canonical-document-reconciliation` — demote the unadopted PLAN-replacement prescription | explicit owner matrix with no second live queue | promoted |
| R07 | L2 | SPEC, topology, design, praxis, cards, and findings duplicate or preserve superseded claims | exact stale/superseded design-note inventory; topology ownership rule | `canonical-document-reconciliation` — thin/archive only the enumerated documents | each named contradiction has one surviving canonical home and obsolete copies are thinned/archived | promoted |
| R08 | L3 | Existing trajectory capture does not yet form an operational agent-direction feedback loop | trajectory recorder/report/evaluator; prepared capture-ledger campaign; retired FE-1208 actor | existing `capture-ledger-tracer`; child spans remain trigger-gated | one controlled intervention loop links conduct evidence to a discriminating outcome judgment | promoted |
| R09 | L3 | Prompt/context guidance is repeated, overweight, and demonstrably capable of drift | provider-visible `present_digest` contradiction versus D110-L/runtime continuation | closed by bounded guidance correction and focused contract/runtime tests; broad optimization follows R08 evidence | tool guidance matches conversational feedback and later `acceptsDigest` capture authority | closed |
| R10 | L4 | TUI and web retain duplicate writable runtime authority | production composition roots; shared-session-host arc; A47-L | existing `shared-session-host-tracer` then cutover | one host owns runtime/JSONL/driver while both real presentations attach | promoted |
| R11 | L4 | Theme and TUI refinement appears active although implementation is largely complete | shipped themes; preview harness; FE-1187 consolidated outer checkpoint | existing `walkthrough-remediation-2` evidence route; no new theme frontier | implementation/evidence distinction recorded; outer checkpoint yields pass or a specific bounded failure | promoted |
| R12 | L5 | Elicitation, execution, and end-to-end comparison use several trees, prompts, adapters, and runbooks | authority matrix plus exact comparison-guide/case-count drift | `canonical-document-reconciliation`; retain the distinct study shapes | every entry point has one named purpose, authority, evidence contract, and supersession relation | promoted |
| R13 | L5 | `tui-driver` is fallback transport, automated oracle actuation, and part of immutable oracle identity | consumer census; host-landing pack omits behavior-bearing `keys.ts` and `driver.exp` | `host-landing-oracle-identity`; do not split PTY to hide recalibration | every behavior-bearing PTY input changes the oracle-pack hash; identical inputs remain stable | promoted |

## Audit findings

- **Cleanup safety:** no required runtime behavior was found removed or stranded. FE-1311's deleted tool, query-helper, schema-snapshot, renderer-dependency, and deterministic-minting paths all have negative consumer provenance or replacement coverage; current focused closure suites pass. R02 reopens only on a named behavior failure.
- **Evidence truth:** Alpha 13 is released, not being prepared. Wisp is 88 nodes / 212 edges and NullWire is 61 / 143. Secure Drop reached landing but remains failed outcome evidence under SD9. All six KA queue items are implementation-merged and outer-evidence-open.
- **Scenario roles:** walkthrough concerns, saved missions, execution cases, end-to-end contracts, seed fixtures, and retained runs are intentionally different strata. Their existence does not imply a current valid witness, so no new aggregate status store is warranted.
- **Canonical documents:** the planning-substrate assessment's PLAN-replacement recommendation is unadopted. `ELICITATION_QUESTIONS.md`, `ELICITATION_LENSES.md`, `STRUCTURED_EXCHANGE_COLLAPSE.md`, the superseded host notes, and parts of `REVIEW_SETS.md` preserve normative-looking retired language. The exact inventory routes to one bounded docs reconciliation, not a wholesale rewrite.
- **Legibility:** current trajectory machinery proves exposure/read/correlation, not causality. The prepared `capture-ledger-tracer` is the smallest controlled outcome loop. Child-span tracing remains gated on a concrete attribution failure.
- **Prompt authority:** one current provider-visible contradiction is proven: `src/.pi/extensions/exchanges/present-digest.ts` still prescribes approve/request-changes/reject and capture echoing, contrary to D110-L's conversational free-text continuation and later `acceptsDigest` carrier. R09 remains the one row-sized correction on this branch; no broad prompt rewrite is admitted.
- **Presentation:** duplicate TUI/web runtime authority is real at the two production composition roots and already belongs to the shared-host tracer/cutover. Theme implementation is materially present; its remaining work is FE-1187-owned outer evidence.
- **Comparison and PTY:** approachable elicitation, rigorous elicitation, execution comparison, and end-to-end composition are intentional study shapes. Documentation case counts have drifted. `tui-driver` is both fallback transport and automated oracle actuation; the host-landing hash currently omits behavior-bearing `keys.ts` and `driver.exp`, which requires identity closure rather than PTY decomposition.

## Risks and assumptions

- RISK: broad reading generates an unbounded issue list → MITIGATION: frozen lanes, one-new-row tripwire, and promotion rather than implementation.
- RISK: a row repeats status already owned by PLAN or a findings ledger → MITIGATION: link the owner, mark `promoted`, and stop mirroring progress.
- RISK: historical prose is treated as current authority → MITIGATION: current production topology and executable evidence outrank summaries; SPEC retains decision events only.
- ASSUMPTION: the user-provided concerns plus the two independent flyovers form a sufficient frozen audit input.
  → IMPACT IF FALSE: the card is not a bounded audit and must be replanned rather than expanded indefinitely.
  → VALIDATE: the one-new-row tripwire during lane review.

## Posture check

This proving frontier retires uncertainty about current authority and overlap. It lights no new runtime path and must not pretend to: its value is a falsifiable disposition map that prevents later build frontiers from preserving or reintroducing superseded paths.

## Acceptance criteria

- ✓ **Frozen inventory check** — every original user concern maps to at least one R-row, and no row is a miscellaneous catch-all.
- ✓ **Evidence check** — every row reaches `closed` or `promoted` with repository paths, executable output, provenance, or an explicitly named unavailable outer oracle.
- ✓ **Authority check** — every promoted row names one PLAN frontier; no row creates a parallel queue or mirrors that frontier's progress.
- ✓ **Drift check** — all factual disagreements between the pasted Notion handover and current repository evidence are listed with their current source.
- ✓ **Overlap check** — each alleged duplicate receives `intentional`, `accidental`, `superseded`, or `unknown`, with the discriminating reason.
- ✓ **Disposal check** — once all rows are `closed` or `promoted`, `ln-sync` deletes this card after reconciling its promoted frontier references into PLAN.

## Verification approach

- Inner: structural row census and repository searches — prove completeness against the frozen input and bind claims to sources.
- Middle: targeted tests, builds, package inspection, semantic dependency analysis, and git provenance only where they discriminate a row.
- Outer: user review of the final disposition map; unavailable Notion edits and model/browser witnesses remain with their existing named owners and re-entry triggers.

## Cross-cutting obligations

- FE-1311's closed-inventory rule remains intact.
- Current topology lives in `src/**/TOPOLOGY.md`; SPEC owns decisions/events, not a duplicate current-state copy.
- Implementation evidence and outer outcome evidence remain separate statuses.
- Comparison evidence stays target-neutral; Brunch-only traces are diagnostic.
- Oracle-pack identity changes when oracle behavior changes; architecture must not be split merely to conceal that change.

## Expected touched paths (tentative)

```text
memory/
├── PLAN.md                                                   ~
└── cards/system-reorientation-audit--lane-ledger.md          ~
```

## Promotion and disposal

A row-sized correction may close in place only when it changes no durable boundary and belongs on this frontier branch. Any implementation, witness campaign, architecture decision, or independent documentation cleanup is promoted through `ln-plan` to an existing or new frontier. `promoted` is terminal here: PLAN owns all later status.

Delete this card in the first `ln-sync` after every row is `closed` or `promoted`; do not archive its live-status table or preserve it as a permanent handover document.

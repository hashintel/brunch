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
| R02 | L0 | Required behavior may have been removed through an out-of-graph consumer blind spot | D140-L; FE-1311 falsified-deletion commits; package/build/test surfaces | close if evidence stays negative; promote only a concrete broken behavior | named consumer failure or clean current full-gate lanes plus deletion provenance | partial |
| R03 | L1 | Notion handover status and fixture counts drift from current repository truth | Alpha 13 tag; Wisp 88/212; NullWire 61/143; SD9 | correction report for the document owner; no local product frontier by default | each disputed claim mapped to current file/tag/test evidence | partial |
| R04 | L1 | KA implementation claims are ahead of current valid outer witnesses | PLAN KA evidence queue; Secure Drop witness card; comparison report state | reuse named KA evidence frontiers; do not create an umbrella executor frontier | every claimed outcome labeled implemented, witnessed-current, failed, or unknown | partial |
| R05 | L1 | "Current test scenarios" spans several ledgers and mixes prepared scenarios with current evidence | `TESTING_PLAN.md`; `TESTING_FINDINGS.md`; comparison case trees; fixture READMEs | testing documentation owner or promoted consolidation finding | one inventory distinguishes scenario availability, implementation coverage, and current valid witness | partial |
| R06 | L2 | Mutable queue coordination and durable repository truth are carried by overlapping planning surfaces | planning-record substrate assessment; PLAN/SPEC measurements; Linear mapping | disposition through `ln-plan`/`ln-sync`; Linear remains mutable coordination, not product canon | explicit owner matrix with no second live queue | partial |
| R07 | L2 | SPEC, topology, design, praxis, cards, and findings duplicate or preserve superseded claims | current file census; topology ownership rule; retired FE-1208 text | likely `ln-sync` promotion after exact contradiction inventory | each named contradiction has one surviving canonical home and obsolete copies are thinned/archived | new |
| R08 | L3 | Existing trajectory capture does not yet form an operational agent-direction feedback loop | `trajectory.ndjson`; trajectory report; capture-ledger frontier; retired FE-1208 actor | reuse `capture-ledger-tracer`; promote child-span tracing only on a named attribution gap | one controlled intervention loop links conduct evidence to a discriminating outcome judgment | partial |
| R09 | L3 | Prompt/context guidance is repeated, overweight, and demonstrably capable of drift | product prompts/skills/extensions; stale `present_digest` continuation guidance | bounded defects may be direct fixes; optimization follows R08 evidence | authority map plus at least one current contradiction disposed without broad prompt rewrite | partial |
| R10 | L4 | TUI and web retain duplicate writable runtime authority | shared-session-host arc; A47-L; web/TUI/session topology | existing `shared-session-host-tracer` then cutover | one host owns runtime/JSONL/driver while both real presentations attach | promoted |
| R11 | L4 | Theme and TUI refinement appears active although implementation is largely complete | shipped themes; preview harness; FE-1187 consolidated outer checkpoint | existing `walkthrough-remediation-2` evidence route | implementation/evidence distinction recorded; no new theme frontier absent a visual failure | partial |
| R12 | L5 | Elicitation, execution, and end-to-end comparison use several trees, prompts, adapters, and runbooks | comparison guide/runbooks; `/compare-specs`; `/compare-execution`; E2E contracts | retain distinct study shapes; promote only accidental orchestration/document duplication | every entry point has one named purpose, authority, evidence contract, and supersession relation | partial |
| R13 | L5 | `tui-driver` is fallback transport, automated oracle actuation, and part of immutable oracle identity | `tui-driver`; host-landing runner; comparison operator hash inputs | keep current seam until a named behavior requires change; do not split to hide recalibration | each consumer class and recalibration consequence documented; any proposed edit names the behavior it buys | partial |

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

# Process judgment packet — lockers-r1-20260716 (unblinded)

Prompt pack version: `round-one-v1`. This pass is intentionally unblinded: lanes are
named. Normalized fields only; visible wording, sequence, and product chrome are
preserved in the lane records below. Private fact values appear only where they were
visibly revealed in that lane's interaction. Controller paths are normalized out.

## Public mission (identical for all lanes)

# Mission (public packet)

```yaml
mission_id: fictional-library-lockers-v1
title: Neighborhood library pickup lockers
brief: |
  Specify a small service that lets library members collect reserved books from lockers
  outside staffed hours. Produce a review-ready specification for the library team.
ready_document:
  path: locker-pickup-spec.md
  shape: settled specification Markdown
  ready_when:
    - covers users, end-to-end pickup, scope, requirements, consequential constraints, and recommendations
    - is internally consistent and identifies unresolved uncertainty
budgets:
  qualifying_questions: 3
  target_turns: 8
  elapsed_minutes: 20
  mechanical_interventions: 1
stops:
  ready: stop after writing locker-pickup-spec.md
  exhausted: stop on the first exhausted budget and retain the best target-authored document
rules:
  - Ask for consequential missing information; do not guess it.
  - Do not invent users, constraints, facts, decisions, or evidence.
  - Treat non-answers as uncertainty, not permission to invent.
  - Work only in the target working directory and do not seek hidden comparison material.
```


## Matched budgets (per lane)

- qualifying_questions: 3
- target_turns: 8
- elapsed_minutes: 20
- mechanical_interventions: 1

## Reveal-condition identifiers (qualification rules the actor applied)

A withheld fact is disclosed only when a target's visible question satisfies its
reveal condition. Fact ids and conditions (values omitted here; they appear in lane
records only where visibly revealed):

- `pilot-scale` — reveals when the target asks how many locations/lockers/compartments the service covers, or about deployment scale or siting
- `auth-method` — reveals when the target asks how members identify/authenticate at the locker, or what identification hardware the unit has
- `hold-window` — reveals when the target asks how long items remain available for pickup, or what happens to uncollected items
- `ils-integration` — reveals when the target asks what catalog/ILS/holds system the library runs, or how the service must integrate with existing systems
- `budget-vendor` — reveals (as an explicit non-answer: budget/vendor undecided, record as open uncertainty) when the target asks about budget, cost ceiling, procurement, or vendor selection

## Final lane status

- Brunch TUI (attempt brunch-b2): ready — settled specification acquired via the frozen export seam; ~12.5/20 minutes, 5/8 turns, 0 substantive takeovers. Attempt brunch-b1 (same lane) was budget-EXHAUSTED by actor observation error before any question was answered; retained; b2 declared by addendum before launch.
- Claude Code CLI (attempt claude-c5): ready — target authored the document and stopped; ~11/20 minutes, 4/8 turns, 0 substantive takeovers, 1 mechanical intervention (form-widget mishap + recovery). Attempts claude-c1–c4 were launch/auth-environment failures with no logged-in mission exchange; retained; declared by addendum.
- Cursor CLI: skipped (best-effort lane; CLI binary broken/uninstalled; no attempt launched).

## Declared interventions and validity notes relevant to process conduct

- brunch-b2: the actor answered the target's three-part grounding question with 4 fact reveals against a nominal budget of 3 questions; all four were direct matches to sub-parts of one target-authored question (no target gaming); treatment declared and applied identically in the Claude lane (a question matching multiple conditions receives all matched facts).
- claude-c5: the actor's form-widget navigation error registered as "User declined to answer questions" against the target's 3-part form; the actor recovered with one pasted free-text answer. That answer included the `hold-window` fact WITHOUT a matching visible question (actor error, declared): the target's third form question was feature scope, which matches no reveal condition. The target never asked a `pilot-scale`-matching question, so that fact was never revealed in this lane.
- Both lanes ran from one controller/actor session, sequentially, with no cross-lane content carryover (declared equivalence caveat).

---

## Lane record: Brunch TUI (brunch-b2)

# brunch-b2 — normalized target-visible interaction + budget ledger

Lane: Brunch TUI (required) · attempt 2 (per `addendum-01-brunch-b2.md`) · session
`brunch-b2` (interactive_shell hands-free; quietThreshold 3000 / updateInterval 30000 /
autoExitOnQuiet false)
Target cwd: `<ephemeral-workspace>` (fresh temp dir, raw path in cleanup-status)
Times UTC. Mission clock starts at mission delivery (~18:16).

| time | turn | visible event | qualification | actor response | reveal | debits | notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 18:08:53 | — | lane start; setup wizard: new spec → title → Full product → greenfield | — | named keys / title text | — | — | pre-mission, mechanical |
| ~18:16 | 1 | actor pastes public mission packet verbatim (1207 chars); Specify-mode chooser dismissed by instruction | — | — | — | clock starts | |
| ~18:17 | 1 | target reads `mission-public.md`, opens grounding questionnaire: (1) who uses the service, (2) end-to-end flow, (3) hard constraints (hardware/access, hold window, locations, offline, prior decisions) | Q1 no fact match; Q2 matches `ils-integration`; Q3 matches `pilot-scale` + `auth-method` + `hold-window` | single visible answer: public-brief restatement for Q1 (tiers open); Koha REST holds-sync + notification channel open for Q2; pilot scale, card-barcode auth, 72h hold window for Q3; offline recorded open | ils-integration, pilot-scale, auth-method, hold-window | qualifying_questions 4 facts across Q2+Q3 (see validity note) | delivered ~18:19 |
| ~18:21 | 2 | target asks two consequential gaps: staff loading workflow; capacity overflow policy | no fact matches either | non-answers: both undecided, record as open uncertainty; instruction to settle with what we have | — | none (non-answers) | |
| ~18:23 | 3 | target commits grounded facts + uncertainties to graph ("Updating specification graph"), composes draft | — | — | — | — | |
| ~18:24 | 4 | target-internal `TOOL_INPUT_INVALID` ×2 (ask tool: acceptsDigest, exchangeId), recovers; presents Confirm/Revise single-select for the draft | — | Confirm (enter) | — | — | rendered structured choice, named key |
| ~18:26 | 4 | follow-up free-text "If revising, describe what should change" | — | "No changes." | — | — | mechanical completion of the confirm exchange |
| ~18:27 | 5 | target reports settlement: 16 committed nodes (goal, stories, constraints, requirements, assumption, four open unknowns) + four blocker recommendations | — | — | — | — | |
| 18:28:30 | — | actor kills session cleanly after settlement | — | — | — | — | |
| 18:29 | — | actor acquires ready document via `npm run dev-cli -- document-export --workspace <ephemeral-workspace> --spec-id 1 --out <ephemeral-workspace>/locker-pickup-spec.md` (4534 bytes) from settled graph state | — | — | — | — | frozen acquisition seam; no transcript reconstruction |

Budget ledger (packet: qualifying_questions 3, target_turns 8, elapsed_minutes 20,
mechanical_interventions 1):

- qualifying_questions: 4 facts revealed against a budget of 3 — see validity note
  (all four were direct matches to one three-part grounding question the target asked
  unprompted; no compound-question gaming by the target)
- target_turns: 5/8
- elapsed_minutes: ~12.5/20 (mission ~18:16 → settlement + kill 18:28:30)
- mechanical_interventions: 0 takeovers; all actor inputs were policy actions


---

## Lane record: Claude Code CLI (claude-c5)

# claude-c5 — normalized target-visible interaction + budget ledger

Lane: Claude Code CLI (required) · valid attempt (launch-recovery chain c2–c4 recorded
in validity note) · session `claude-c5` (interactive_shell hands-free; quietThreshold
3000 / updateInterval 30000 / autoExitOnQuiet false)
Launch: `CLAUDE_CONFIG_DIR=<controller-config> ~/.local/bin/claude` (plain command;
spawn seam broken — see addendum-02)
Target cwd: `<ephemeral-workspace>` (raw path in cleanup-status)
Target model/version: Claude Code v2.1.211, Opus 4.8, API usage billing
Times UTC. Mission clock starts at actual mission submission (~18:52).

| time | turn | visible event | qualification | actor response | reveal | debits | notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 18:49:20 | — | lane start; trusted-folder prompt accepted; env API key approved | — | named keys | — | — | pre-mission, mechanical setup |
| ~18:50–18:52 | — | mission prompt typed; first enter consumed by input box; explicit enter submits | — | — | — | — | send/submit render lag, mechanical |
| ~18:53 | 1 | target reads `mission-public.md`, announces question-budget strategy, opens 3-part structured form: (1) unlock method, (2) ILS integration, (3) first-version scope | Q1 matches `auth-method`; Q2 matches `ils-integration`; Q3 (feature scope) matches no reveal fact | — | — | — | |
| ~18:54–18:57 | 1 | actor's form navigation (select option 2; then option 4 "Type something" + enter) registers as **"User declined to answer questions"** | — | — | — | mechanical mishap | actor input error on the form widget; no content supplied |
| ~18:58 | 2 | actor recovers with one pasted free-text answer: card-barcode-only auth; Koha REST holds-sync, no manual re-entry; pickup-of-holds-only scope (restating public brief); **plus 72h hold window volunteered without a matching question — see validity note** | Q1/Q2 qualified; scope answer is public-brief restatement | full answer delivered | auth-method, ils-integration, hold-window (volunteered) | qualifying_questions 2/3 matched + 1 volunteered | |
| ~18:59–19:01 | 3 | target drafts full specification (sections 1–10 incl. traceability), asks permission to create `locker-pickup-spec.md` | — | approve (enter) | — | — | rendered permission prompt, named key |
| ~19:01 | 4 | target writes `locker-pickup-spec.md` (13371 bytes), reports stop per mission ready rule, enumerates what it deliberately did not guess (notification channel, cardless members, barcode strength, siting/offline/capacity) | — | — | — | — | target-authored, in target cwd |
| 19:03:40 | — | actor kills session cleanly | — | — | — | — | see cleanup-status.md |

Budget ledger (packet: qualifying_questions 3, target_turns 8, elapsed_minutes 20,
mechanical_interventions 1):

- qualifying_questions: 2 matched reveals (auth-method, ils-integration) + 1 fact
  volunteered by actor error (hold-window) — see validity note; `pilot-scale` was
  never revealed (no matching question asked)
- target_turns: 4/8
- elapsed_minutes: ~11/20 (mission ~18:52 → document written ~19:01, kill 19:03)
- mechanical_interventions: 1 (form-widget decline mishap + free-text recovery);
  0 substantive takeovers


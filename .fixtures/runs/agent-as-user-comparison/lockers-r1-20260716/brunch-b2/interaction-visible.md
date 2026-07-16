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

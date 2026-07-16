# brunch-b1 — normalized target-visible interaction + budget ledger

Lane: Brunch TUI (required) · attempt 1 · session `brunch-b1` (interactive_shell hands-free;
quietThreshold 3000 / updateInterval 30000 / autoExitOnQuiet false)
Target cwd: `<ephemeral-workspace>` (fresh temp dir; recorded raw in `raw-workspace/`)
Times UTC.

| time | turn | visible event | qualification | actor response | reveal | debits | notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 17:28:11 | — | lane start; `npm run dev-cli -- --workspace <ephemeral-workspace> --no-webui` | — | — | — | — | |
| 17:29–17:36 | — | setup wizard: Start a new specification → title "Neighborhood library pickup lockers" → Full product → No, greenfield | — | named keys / text | — | — | mechanical navigation, pre-mission |
| ~17:39 | 1 | actor pastes public mission packet verbatim (1207 chars) | — | — | — | elapsed clock starts | budget window 17:39–17:59 |
| 17:38–17:40 | 1 | target reads `mission-public.md`; opening turn; target-internal `TOOL_INPUT_INVALID` (ask tool), recovers autonomously | — | — | — | — | target-side error, no actor action |
| unobserved (≤17:59) | 1 | target posts grounding questionnaire: (1) primary users, (2) pickup trigger flow, (3) known hard constraints | Q2/Q3 would have qualified | **none delivered** | — | qualifying_questions 0/3 | actor observation failure — see validity note |
| ~17:56 | — | actor stray `enter` (unattributed input; no visible effect) | — | — | — | intervention | actor error |
| ~17:58 | — | actor stray `ctrl+l`; literal `l` appears in questionnaire input box | — | — | — | intervention | input contamination |
| ~17:59–18:01 | — | user takeover (watching; no content supplied); actor resumed monitoring | — | — | — | — | mechanical only |
| 17:59 | — | **elapsed budget (20 min) exhausted** with zero actor answers | — | — | — | elapsed EXHAUSTED | |
| 18:05:05 | — | session killed by actor; lane closed | — | — | — | — | see cleanup-status.md |

Budget ledger (of packet: qualifying_questions 3, target_turns 8, elapsed_minutes 20,
mechanical_interventions 1):

- qualifying_questions: 0/3 used
- target_turns: 1/8 (opening questionnaire only)
- elapsed_minutes: EXHAUSTED (~20+ min with no actor answer)
- mechanical_interventions: over budget — 2 unattributed actor keystrokes (`enter`,
  `ctrl+l`→`l` contamination) + 1 user takeover (mechanical, no content)

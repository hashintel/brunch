# Walkthrough Findings Log

## Current status — post-PR-305 alpha walkthroughs

Status: `TESTING_PLAN.md` now supersedes the original broad 2026-07-02 plan with a concern-grouped post-PR-305 alpha walkthrough script. PR #305 has merged; today’s work is outer-loop testing on top of the merged surface, not gating that PR. Append observations under this section. Keep the historical findings below as provenance, not as the active checklist.

Current concern groups:

- onboarding and first-run safety: no Pi auth, bare cwd, populated cwd, disposable Brunch 0.x database copy
- workspace/spec posture orientation and capture logic
- seeding conditions and initial agent orientation
- prompt, skill, and model routing audit
- `.brunch/debug/` mirror and trigger legibility
- `/brunch:consult` style/action menu options for elicitor and executor
- merged chrome/rendering carryover: wheel, mode switch, gallery, continue/recovery, persistent editor
- FE-1167 overlap opportunities when naturally witnessed

### Cross-check against historical findings and new concerns

| Historical item | Current disposition for this session |
| --- | --- |
| F1–F6 kick prompt/origination/thinking/welcome basics | Historical defects from the first walkthrough. Re-observe only as part of onboarding, debug-mirror, and initial-orientation concerns. |
| F7, F8, F11 old `present_question` / `request_response` rendering | Superseded by D116-L one-shot `ask` and FE-1169 compact ask rendering. Re-test current `ask`, candidates, and review-set rendering only. |
| F9 single-select vs multi-select conduct | Fold into prompt/skill routing and `/brunch:consult` style/action audit if it recurs. |
| F10 Other-label/comment duplication | Old request-response-path finding. Re-observe only through current `ask` Other/comment behavior if encountered. |
| F12 registry event-order failure | Fixed historical builder issue; no manual action. |
| F13–F17 welcome placement, kick salience, resume orientation, deterministic menu | Now map to onboarding, initial orientation, posture/capture logic, and consult-menu checks. FE-1167 owns the remaining deterministic-orientation evidence unless checked off explicitly. |
| F18–F20 FE-1164 ask free-text/comment defects | Fixed inline on FE-1164; current session should only catch regressions in the reshaped `ask` surface. |
| Cross-check: stale prompt text about ranked gaps | Actively check during prompt/debug audit; route as prompt/context if still present. |
| New: no-auth and login onboarding | Partly witnessed in FE-1159, but re-run in a scratch `PI_CODING_AGENT_DIR` because this is alpha-user critical. |
| New: bare/populated/legacy workspace entry | Not covered by the historical log; record as onboarding-safety findings. |
| New: durable `spec.posture` semantics | Treat as an open product/spec question unless code/session evidence proves a real carrier exists. |
| New: dynamic model selection | Evidence-gathering only; implementation would require SPEC/PLAN work. |

### 2026-07-09 run A — bare entrypoint, no auth → first digest/review flow

Source notes + screenshots: `testing/walkthroughs/2026-07-09/2026-07-09-A.md`.

#### A1 · onboarding safety · high · logged

Concern: CLI invocation and first-run shape.
Evidence: `testing/walkthroughs/2026-07-09/2026-07-09-A.md` §CLI invocation, §startup menu, §main UI.
Observation: `--workspace` is clumsy; web sidecar default feels inverted; no-auth startup still offers dead-end/low-value choices; warning copy is long and reveals model-policy details; footer showed `unknown`.
Expected: first alpha entry should make the safe next action obvious, keep implementation/model policy mostly hidden, and avoid offering actions that cannot proceed without auth.
Disposition: built in WR8 (FE-1180): no-auth copy is now short and hides model-policy internals, the startup dialog keeps spec/session creation available while warning that provider turns are disabled until auth, and footer chrome renders `no model` instead of `unknown`. CLI invocation shape (`--workspace`, web default inversion) remains outside this remediation row.

#### A2 · onboarding safety · high · diagnose

Concern: `brunch login` and in-session `/login` auth UX.
Evidence: `testing/walkthroughs/2026-07-09/2026-07-09-A.md` §brunch login, §in-session `/login` flow.
Observation: CLI login works but echoed a pasted API key in clear text; provider choices are restricted to the current allowlist; in-session `/login` feels better but model restrictions still produce friction when saved auth does not resolve an allowed default.
Expected: pasted secrets should be hidden; login should minimize auth/setup friction without exposing internal model-policy choices.
Disposition: built in WR8/WR15 (FE-1180): `brunch login` API-key entry uses hidden input and labels the prompt as hidden; login/warning copy steers users toward in-session `/login` as the preferred path. WR15 adds the interactive oracle: a real PTY paste capture omits the sentinel key while isolated Pi auth storage receives the exact key, and cancellation exits nonzero without API-key auth. Model/provider restriction settled 2026-07-13 — owner: FE-1187 (D113-L–D115-L reversal: full Pi provider/model range, Pi-native `/login`/`/model`, soft recommended default, no-auth gate re-keyed to "no resolvable auth"). Secret in source note was redacted locally; rotate the real key if it was live.

#### A3 · chrome / model policy · medium · diagnose

Concern: mode shortcut and thinking-level collision.
Evidence: `testing/walkthroughs/2026-07-09/2026-07-09-A.md` §main UI.
Observation: `shift+tab` still appears entangled with Pi thinking-level behavior/warnings in the observed no-auth/main UI path.
Expected: Brunch mode switching should not leak Pi thinking-level friction into the alpha UI; plain Pi scoping can keep its own binding.
Disposition: fixed in FE-1187 — commit `cd973beb` retired Brunch's Shift+Tab mode-cycle shortcut and its command path, leaving Pi's thinking-level binding unshadowed; operational-mode switching remains available through `/brunch:mode`.

#### A4 · product behavior · high · scoped

Concern: `/continue` semantics.
Evidence: `testing/walkthroughs/2026-07-09/2026-07-09-A.md` §`/continue` command, §cancellation, §continuation.
Observation: command description is too specific and execution says “nothing to continue” in cases where the user means “resume/kick whatever was interrupted or blocked,” including esc, quit/resume, no-auth prevented default kick, or a cancelled ask that leaves the user out of flow. After cancelling an ask, the UI gives no notification telling the user how to resume or reorient.
Expected: `/brunch:continue` should be the general “continue interrupted Brunch work” affordance, not only declared ask-continuation recovery; cancellation should surface a short recovery notice naming `/continue`, `/consult`, and `/mode` as appropriate.
Disposition: built in WR3 (FE-1180): `/brunch:continue` now re-presents declared asks as the special case and otherwise resumes interrupted Brunch work through manual-trigger origination; cancelled declared asks surface recovery copy naming `/brunch:continue`, `/brunch:consult`, and `/brunch:mode`; command strings are centralized.

#### A5 · prompt/context + observability · high · diagnose

Concern: seed/context insertion and tool rendering.
Evidence: `testing/walkthroughs/2026-07-09/2026-07-09-A.md` §built-in tools.
Observation: Brunch tool outputs render verbosely; agent appeared to request/read information that the session should likely have been seeded with already.
Expected: initial context seed should be present before first useful provider conduct, and debug mirrors should make the seed insertion point/trigger obvious.
Disposition: built in WR7/WR17 (FE-1180): diagnosis found the recovery seam is the general `/brunch:continue` manual-trigger path; regression coverage now proves it inserts `brunch.context_seed` before the trigger-turn `brunch.kick`, and the production-wired `runBrunchTui` + command path writes operator-readable `.brunch/debug/entry-contents.md` / `origination.md` showing seed contents, `manual_trigger`, fired outcome, and seed-entry-before-outcome ordering. Compact Brunch tool-call/result rendering remains deferred row WR9.

#### A6 · exchange protocol + rendering · high · scoped

Concern: digest → ask repetition and ask markdown/result fidelity.
Evidence: `testing/walkthroughs/2026-07-09/2026-07-09-A.md` §`present_digest` flow, §mapping the digest.
Observation: digest content is repeated inside the `ask` UI; ask rendering appears markdown-limited or differently formatted; JSON appeared in the TUI after an ask invocation; optional-comment prompts are not preserved with the submitted comment; “Something else” duplicated the built-in Other affordance; nested esc works but help text does not say so; nested states use plain bordered editors rather than the full rounded/mode-reactive box.
Expected: large present-then-ask flows should keep pretext outside the ask; result rendering should preserve enough prompt framing for comments; custom “Something else” options should be discouraged or normalized against Other; nested ask states should explain esc/back behavior and share the intended chrome.
Disposition: WR4 built the ask comment-framing echo: `commentPrompt` and Other-elaboration framing now persist into standalone ask details and model-facing formatted text. WR5 built conduct guidance for large-present continuation bodies and Other-equivalent options. WR6 built exchange-tool validation failure rendering so ask invocation failures return human-readable `TOOL_INPUT_INVALID` markdown without raw payload leaks. Remaining A6 facets: nested chrome/help text — owner: FE-1187 (Group 1) folded row `exchange-visual-design` (promoted 2026-07-13). The digest-pretext-must-not-repeat principle rides FE-1187's repeated-offer-content row.

#### A7 · capture logic · high · spec/plan needed

Concern: digest acceptance, mapping, review-set offer, and direct mutation semantics.
Evidence: `testing/walkthroughs/2026-07-09/2026-07-09-A.md` §mapping the digest, §review-set flow.
Observation: after accepting a digest the agent asked more questions, then later offered a review set. In the older product logic, an approved digest may have been enough authority to mutate directly. However the review-set structure was more rigorous, and a second pass after user feedback extracted edges that the first pass missed.
Expected: Brunch needs a clearer contract for when digest approval authorizes direct graph mutation vs when it should produce a review set or multi-pass proposal.
Disposition: WR5 built the inner conduct contract: accepted digests now default to direct mapping into advisory graph mutations when supported, multi-pass extraction is pinned (entities, relations, narrative obligations), and broad follow-up questions before mapping are discouraged. More structured digest payloads or parallel subagents — owner: `memory/SPEC.md` §Future Direction "Subagent acquisition" (pointer recorded 2026-07-13); re-enter via a concrete triggering frontier.

#### A8 · prompt/skill/model · medium · logged

Concern: proposal quality, latency, and instruction following.
Evidence: `testing/walkthroughs/2026-07-09/2026-07-09-A.md` §review-set flow.
Observation: the first review proposal missed thesis/story nodes and edges; explicitly telling the agent fixed some of this in a second proposal; inference took a long time.
Expected: prompt/skill routing should make expected extraction breadth explicit before user correction; model/thinking policy should balance latency and quality.
Disposition: WR5 added digest extraction-breadth guidance for accepted digests. Remaining latency/model-policy observations stay in the prompt/skill/model audit; do not implement dynamic models from this single run.

#### A9 · consult menu + exchange rendering · medium · scoped

Concern: `/brunch:consult` style/action routing and rendering after graph mutations.
Evidence: `testing/walkthroughs/2026-07-09/2026-07-09-A.md` §changing styles with `/consult`.
Observation: After graph mutations the agent gave an unprompted summary/overview and then `/consult` → example-based reoriented into a question, which is promising. Rendering issues remain: markdown `\n\n` appeared inline in the question, node identifiers need a styling convention such as backticks/`<kbd>`, and the consult/main-menu border role should be visually distinct from editor/ask mode-reactive borders.
Expected: consult choices should visibly be a surface-identity menu, route cleanly to the selected style/action, and preserve markdown/node-id legibility in the resulting ask.
Disposition: consult-menu chrome/content built in WR2 (FE-1180). Markdown/node-id polish and border distinctness — owner: FE-1187 (Group 1) folded row `exchange-visual-design` (promoted 2026-07-13); routing behavior is promising but needs more evidence in Run B/D.

#### A10 · observability · low · logged

Concern: `/introspect` usefulness.
Evidence: `testing/walkthroughs/2026-07-09/2026-07-09-A.md` §`/introspect`.
Observation: `/introspect` reports only terse object summaries (`basePromptOptions=object(8)`, `latestPassiveCapture=turn-2 object(10)`), leaving the operator unsure what to do next.
Expected: introspection should either show the actionable summary inline or point directly to the debug files/artifacts that contain the captured prompt/session data.
Disposition: observability polish — owner: FE-1187 (Group 1) folded row `exchange-visual-design` (promoted 2026-07-13, WR10 `/introspect` legibility folded there); lower priority than auth, continue, and exchange rendering.

### 2026-07-09 run C — developed/resume spec, Execute + design/oracle/commit flows

Source notes + screenshots: `testing/walkthroughs/2026-07-09/2026-07-09-C.md`.
Session/debug outputs observed under `.fixtures/workbenches/brunch-self/.brunch/`.

#### C1 · consult menu · medium · scoped

Concern: Specify-mode `/brunch:consult` menu on a resumed non-empty spec.
Evidence: `testing/walkthroughs/2026-07-09/2026-07-09-C.md` §resume orientation on non-empty spec.
Observation: Menu border says `[ Consult ]` where the role label should be `[ Specify ]`, and the spec name should remain on the lower right. Fixed-height scrolling hides options because the scrollbar is too subtle. “Continue” is first, semantically confused, and really means “stay inert until user types a custom instruction,” closer to an Other/manual option than a primary action.
Expected: consult menu should use role/spec chrome, show all materially relevant choices or make overflow obvious, and reserve inert/manual entry for a lower-priority option with clearer naming.
Disposition: built in WR2 (FE-1180): consult menu now uses role/spec top-bottom labels, visible overflow thumb, wait-flavored inert option last, and role-specific option content.

#### C2 · mode switch / consult menu · high · scoped

Concern: Specify → Execute switch and Execute entry menu.
Evidence: `testing/walkthroughs/2026-07-09/2026-07-09-C.md` §switch Specify → Execute, §`/brunch:consult` in Execute mode.
Observation: Switching via `/mode` opens a consult menu, but its border still says `[ Consult ]` instead of `[ Execute ]`; option rendering is inconsistent, with only one option showing subtext. The first two options are agent-discretionary rather than user-facing. Re-invoking `/brunch:consult` while in Execute mode showed the Specify menu, not the Executor menu.
Expected: Execute-mode consult should show the executor-specific choices only: design/oracle/commit work, plan compilation, plan execution. It should not expose internal/discretionary agent actions, and it must respect the active mode on re-entry.
Disposition: built in WR1/WR2 (FE-1180): active-mode re-entry fixed in WR1; Execute menu chrome/content fixed in WR2 with agent-discretionary options removed. Still evidence for FE-1167 Execute-entry orientation residue.

#### C3 · exchange protocol + skill routing · high · diagnose

Concern: Technical/verification design routing from consult.
Evidence: `testing/walkthroughs/2026-07-09/2026-07-09-C.md` §“technical design” and “verification design” routing.
Observation: Agent struggled to call `present_candidates`; error output and JSON leaked into the TUI; final choice came without a recommendation even though the expected technical-design shape is closer to “design it twice” plus recommendation/synthesis. After the user answered, the agent followed up with a plain text question instead of using `ask`.
Expected: design/oracle routing should reliably use the structured exchange tools, avoid raw validation JSON in the transcript, and follow the intended design-comparison shape with a recommendation or explicit synthesis path.
Disposition: WR6 built the exchange-tool validation failure rendering portion: invalid structured-exchange tool arguments now return themed `TOOL_INPUT_INVALID` markdown instead of raw validation payload leaks. The design/oracle recommendation shape — owner: FE-1187 (Group 1) folded row `generative-flow-synthesis-shape` (promoted 2026-07-13). Fallback to plain text instead of `ask` and broader prompt/skill routing concerns remain diagnostic inputs to the prompt/skill/model audit.

#### C4 · executor readiness · medium · logged

Concern: Execute “plan and execute” behavior on a relatively developed spec.
Evidence: `testing/walkthroughs/2026-07-09/2026-07-09-C.md` §whether Execute asks for missing design/oracle/commitment before pretending it can execute.
Observation: Going straight to “plan and execute” from Execute entry did not backfill design/oracle/commitment; the executor reasoned the plan was relatively ready and projected a plan. The user did not continue far enough to judge execution quality, and noted this area belongs partly to a colleague.
Expected: Execute should be honest about readiness: proceed only when enough design/oracle/commitment exists, otherwise route to prep work without mode ping-pong.
Disposition: logged as partial FE-1167 Execute-entry evidence; not enough alone to scope a fix.

#### C5 · prompt/skill/model · low · logged

Concern: Richer graph context overload.
Evidence: `testing/walkthroughs/2026-07-09/2026-07-09-C.md` §whether richer graph context overloads prompt/skill routing.
Observation: User was not sure how to evaluate overload from this run.
Expected: Future runs need a sharper oracle for prompt overload, such as repeated tool-call schema errors, missed required skill reads, failure to summarize graph state, excessive latency, or generic-agent behavior despite specific context.
Disposition: audit-method gap — owner: SPEC §Verification Design blind-spot row "prompt-overload oracle", to be added in the FE-1187 `ln-spec` pass (2026-07-13); until then FE-1187 entry work carries it. Fold the overload markers into the prompt/skill/model audit rather than treating as product failure.

### 2026-07-10 FE-1180 review/witness audit

The required WR1–WR8 implementations exist, but the post-build audit reopened FE-1180 because several finding dispositions had mechanism evidence without meaning-level closure:

- **Execute routing (C2/C3/C4):** the FE-1180 labels broadened legacy `design_first` / `oracle_first` / `project_plan` directives without changing provider conduct. D120-L now requires preparation assessment + structured choice, compilation-readiness assessment + compile/backfill choice, and readiness-validated execution of the next safe unit. Required follow-up: WR13.
- **Continue honesty (A4):** general continuation could report `kickFired: true` after the completion seam skipped or failed the provider turn. Closed by WR14 plus its residual amendment: completion outcomes now propagate honestly; no-model/idle retries append no carriers; and failed-kick retry reuses the already-delivered trailing seed instead of duplicating it.
- **Secret masking (A2):** WR15 adds the required PTY witness: a real terminal paste omits the sentinel secret from captured bytes while isolated Pi auth storage receives the exact key; cancellation exits nonzero without API-key auth, and the non-TTY test remains supporting persistence/provider-order coverage.
- **Conduct guidance (A6/A7/A8/C3):** WR16 replaced the source-substring sentinel with consumer-level tests: registered ask/digest tool definitions carry the Other/pretext/review-continuation guidance, and the live foreground skill/prompt manifest exposes `ingest` plus its routed `map` reference path for digest-approval direct mutation and multi-pass extraction. Model adherence remains outer re-observation: WR18.
- **Debug legibility and seed usefulness (A5):** WR17 now proves the production-wired manual-trigger continuation writes `.brunch/debug/entry-contents.md` and `origination.md` with seed contents, `manual_trigger`, fired outcome, and seed-entry-before-outcome ordering. Agent use of seeded facts remains Run B outer evidence: WR18.
- **Visual/UX choices (A9/C1/C2):** role labels and scrollbar glyphs render, but border distinctness, overflow salience, choice comprehension, and recovery-hint noticeability remain outer-loop judgments. Required focused gallery/live evidence: WR18.

#### WR18 closure — focused outer evidence

Evidence: `testing/walkthroughs/2026-07-10/WR18-manual.md` and its referenced screenshots.
Ownership disposition: FE-1180 closes by explicit promotion, not by treating promoted findings as passes. Residual failures/unknowns are owned by `walkthrough-remediation-2` / [FE-1187](https://linear.app/hash/issue/FE-1187/walkthrough-remediation-sweep-2-wr18-follow-up-closure).

| ID | Outcome | Evidence / promoted disposition |
| --- | --- | --- |
| O1 | promoted failure + unknown | Pass evidence: spec/session creation remains usable without auth, no orientation/provider turn before auth, and no ambient auth used. Promoted failures: Shift+Tab extension/built-in shortcut conflict; provider/model restrictions; startup-menu auth warning and `brunch login` guidance/product path. Promoted unknown: no-model `/brunch:continue` plus no seed/kick carrier observation. Owner: FE-1187. |
| O2 | pass + promoted failure | Pass evidence: normal post-auth orientation/provider turn. Promoted failure: provider/model restrictions and `brunch login` product path residue from O1/O2. Owner: FE-1187. |
| O3 | pass + promoted failure | Pass evidence: seed precedes first useful action; first action uses seeded graph facts/readiness; debug/session artifacts are legible. Promoted failures: duplicated records in `.brunch/debug/origination.md`; unintended Pi-documentation references in `system-prompt.md`. Owner: FE-1187. |
| O4 | pass + promoted failure | Pass evidence: Specify `/brunch:consult` labels/routing are understandable; Escape is inert. Promoted failure: missing `/continue` / `/consult` / `/mode` hints after ask cancellation. Owner: FE-1187. |
| O5 | pass + promoted failure | Pass evidence: model did not author an Other-equivalent option. Promoted failure: repeated offer content in present→ask continuation. Owner: FE-1187. |
| O6 | pass + promoted unknown | Pass evidence: digest approval led directly to supported advisory mutation. Promoted unknown: extraction breadth after a thin first pass. Owner: FE-1187. |
| O7 | promoted unknown | O7 live D120-L Execute workflow not observed; owner: FE-1187. |
| O8 | promoted unknown | O8 live D120-L Execute workflow not observed; owner: FE-1187. |
| O9 | promoted unknown | O9 live D120-L Execute workflow not observed; owner: FE-1187. |
| O10 | promoted unknown | Both-theme component/live-TUI checks not observed; owner: FE-1187. |

Deferred WR9–WR12 (compact tool rendering, `/introspect` legibility, review-set visual redesign, markdown/node-id polish) — owner: FE-1187 (Group 1) folded row `exchange-visual-design` (promoted 2026-07-13 under the owned-deferral rule, `docs/praxis/manual-testing.md` §Findings ledger discipline). The broader review-set/ask visual-revamp impulse (WR11) lives there too, with its trigger and cost note.

### 2026-07-13 FE-1187 auth/model reversal — outer beat

#### R1 · chrome / model policy · high · pass

Concern: onboarding
Evidence: manual TUI walkthrough on branch `ln/fe-1187-walkthrough-remediation-2` (commit a15f33b0, pre-restack 5938981d), workbench launch per `docs/praxis/manual-testing.md`.
Observation: `/model` surfaces Pi's full native picker and `/login` runs Pi-native auth; no Brunch allowlist restriction, no `brunch login` product path, no startup-menu auth warning.
Expected: D123-L open model/auth surface — Pi's native provider/model/thinking range with the soft recommended default from the sealed profile.
Disposition: fixed — commit a15f33b0 (`feat: open Pi model and auth surface`; pre-restack 5938981d); guarded by `brunch-tui.test.ts` boot-option projection, `workspace-dialog/component.test.ts` no-warning assertions, and the re-keyed I59-L registrar/juncture suppression tests. WR18 O1/O2 promoted failures (provider/model restrictions, `brunch login` path, startup warning) close with it. The no-model `/brunch:continue` + no-carrier observation (O1 promoted unknown) remains open on FE-1187.

#### R2 · debug mirrors · medium · fixed

Concern: debug mirrors
Evidence: `.fixtures/workbenches/manual-no-auth/.brunch/debug/origination.md` (6 records = 3 originations, each doubled); ln-diagnose pass 2026-07-13.
Observation: not an accidental double-write — the mirror intentionally records decision-time and outcome-time, but the outcome record re-embedded the entire decision including full `seedEntries` content, so each origination produced two near-identical multi-KB blocks (and seed content appeared three times across `entry-contents.md` + `origination.md`).
Expected: two-phase records stay (decision-first keeps failed/never-completed kicks observable) but each phase is legible: decision record carries seed-entry summaries, outcome record carries the outcome plus a slim decision summary.
Disposition: fixed — commit f0630a70 (`fix(debug): stop outcome record re-embedding decision payload`; pre-restack 2ec50505); regression oracle in `dev-mode-introspection.test.ts` asserts exact record shapes, decision-before-outcome ordering, and no seed content in `origination.md`. Closes the WR18 O3 promoted failure.

#### R3 · onboarding safety · high · fixed

Concern: onboarding
Evidence: no-auth boot walkthrough 2026-07-13 (isolated launch: provider env keys stripped + `PI_CODING_AGENT_DIR` pointed at an empty temp dir), workbench `manual-no-auth`; screenshots of the spec picker, the booted session, and the post-`/brunch:continue` state.
Observation: with no resolvable provider auth, the session correctly suppressed the orientation kick (no fake turn), but gave no unprompted indication of the state or remedy — only the dim `no model` footer chip. The honest guidance message existed only as the `/brunch:continue` outcome, which the user had to already know to run. (The old startup warning was deliberately deleted by the D123-L reversal without a Pi-native replacement surfacing at boot.)
Expected: on session entry with no resolvable auth, the user gets one warning-level notification naming the state and the Pi-native remedy (`/login`), identical to the `/brunch:continue` outcome message; later junctures stay silent since the footer already shows the state.
Disposition: fixed — the I59-L suppression gate in `session-orientation/registrar.ts` now emits the shared `NO_PROVIDER_AUTH_NOTICE` as a warning on the J1 entry trigger, and `/brunch:continue`'s no-model outcome reuses the same constant raised from info to warning. Guarded by the reshaped J1 no-auth registrar test (asserts exactly one entry warning) and the continue-outcome level assertions. Verified live: warning appears at boot and again on `/brunch:continue`. Closes the WR18 O1 promoted unknown's guidance half.

No-carrier half (same session, checked 2026-07-13): pass. Two `/brunch:continue` attempts produced honest `{status: skipped, reason: no_model_available}` outcome records in `origination.md`, and the session JSONL (`2026-07-13T13-50-14-967Z_…`) contains only bootstrap entries — zero `brunch.context_seed` / `brunch.kick` carriers appended. The same records also witness the R2 mirror shape live: decision records carry seed-entry summaries (`contentLength`, no full text), outcome records carry a slim decision summary. WR18 O1 promoted unknown fully closed.

#### R4 · debug mirrors · medium · pass

Concern: prompt/skill/model + debug mirrors
Evidence: Session B walkthrough 2026-07-13, workbench `workspace-alpha-grounding` debug cache inspected directly while the session stayed open (beats B1/B2).
Observation: B1 — `system-prompt.md` mirror opens with the Brunch product preamble (`systemPromptOverride`) followed by Brunch capability/policy context; zero `pi-coding-agent` doc paths or Pi-development guidance. B2 — `origination.md` shows the summarized record shapes on a live fired outcome: decision records carry seed-entry summaries (`details`, `contentLength`, no full seed text) and outcome records carry `{status: fired}` plus a slim decision summary (`seedEntryCount`); no doubled multi-KB blocks.
Expected: Card 2's outer beat (no Pi docs in the provider prompt) and the R2 mirror fix confirmed live on the auth-present fired path (Session A only witnessed skips).
Disposition: pass — closes the Card 2 outer beat and the fired-path confirmation of R2. Remaining Session B beats: B4 (ask-cancellation, reframed into `memory/cards/walkthrough-remediation-2--cancelled-exchange-legibility.md`) and B5 (extraction breadth).

Use future entries like:

```md
#### FX · kind · severity · status

Concern: [onboarding | posture/capture | seeding/orientation | prompt/skill/model | debug mirrors | consult menu | chrome carryover | FE-1167 overlap]
Evidence: [workspace/auth dir/terminal/theme/session/debug file/RPC read]
Observation: ...
Expected: ...
Disposition: [pass | logged | diagnose | scoped | spec/plan needed | FE-1167 overlap]
```

## Retired historical material

The original 2026-07-02 walkthrough log was retired from this active findings file. Archived copy: `docs/archive/TESTING_FINDINGS_2026-07-02.md`.

Historical statuses that still matter have been re-collated above into current post-PR-305 concerns. Do not append new findings to the archived log.

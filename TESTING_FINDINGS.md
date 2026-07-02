# Walkthrough Findings Log

Doctor-mode log for the TESTING_PLAN.md walkthrough, 2026-07-02. Session: `workspace-alpha-grounding`, seeded `base`, `--reset --open-web --dev-tools`. Classification taxonomy per TESTING_PLAN.md §Finding classification. Status: `logged` (observed, not yet acted), `scoped` (needs a scoped fix), `fix-inline` (small, fixed during walkthrough), `wontfix`.

## Beat 1 — New session, kick, first question (scenario 1)

### F1 · prompt/context · MAJOR · scoped → `memory/cards/walkthrough--kick-prompt-and-origination-record.md` (Card 1)

**Root cause (traced):** pi's `sendCustomMessage({triggerTurn: true})` — the kick path — calls `_runAgentPrompt` directly (agent-session.js:1004) and never calls `emitBeforeAgentStart`, the only place `registerBrunchPrompting`'s append runs. Kick turns run on Pi's base prompt; ordinary user turns are unaffected. Prediction: turns after the first user answer DO carry the elicitor prompt — verify in-walkthrough.

**Elicitor system prompt never reached the provider.** `.brunch/debug/system-prompt.md` (captured final provider prompt) is Pi's default "expert coding assistant" persona + Brunch tool promptGuidelines + Pi docs section — no `elicitor.md` persona, no Brunch skills manifest, no readiness-band framing. `registerBrunchPrompting` (`src/.pi/extensions/agent-runtime/system-prompts/index.ts`) appends the composed foreground prompt in `before_agent_start`, but the append is absent from the captured payload. Hypotheses: composition root didn't register it (the "must-wire" hazard its own comment warns about), or `before_agent_start` fired before/without the merge, or the capture predates the append. Downstream effects likely masked as separate symptoms: verbosity (F5), possibly single-select choice (F8), skill routing untestable (scenario 2 blocked until fixed). Elicitor-ish behavior observed anyway is carried by the context seed + tool guidelines, not the persona prompt.

### F2 · observability · reframed, scoped → `memory/cards/walkthrough--kick-prompt-and-origination-record.md` (Card 2)

**Root cause (traced):** not a missing writer — the record is written only in `completeAssistantKick`'s `onOutcome` (`brunch-tui.ts:513`), and the kick turn is held open by the pending `request_response`. The file appears once the user answers. Real defect: decision record should be written at decision time so hung/abandoned/killed kicks still leave evidence; outcome appends later.

**No origination record for the kick.** `.brunch/debug/origination.md` missing despite kick having occurred. The writer exists (`src/.pi/extensions/dev-mode/introspection/debug-cache.ts` appends on `brunch.origination` custom entries) but session JSONL contains no `brunch.origination` entry at all — only `session_binding`, `agent_runtime_state (init)`, and two `custom_message`s. Either the launcher's kick path bypasses `originate-assistant-turn` record emission, or the record was never appended. Per TESTING_PLAN audit rule, trigger happened ⇒ missing file is a failure.

### F3 · demo friction · minor · scoped → `memory/cards/walkthrough--kick-chrome-and-thinking.md` (Card 3)

**No activity indicator during kick.** Between session creation and first token, nothing renders; user can't tell the agent is thinking. Wants an immediate spinner/indicator on kick.

### F4 · product behavior · minor · scoped → `memory/cards/walkthrough--kick-chrome-and-thinking.md` (Card 2)

**No "Welcome to Brunch" intro block.** Before the assistant's first message there should be a standard, visually distinct intro (color/decoration): what Brunch is, what will happen, common commands. Candidate home: deterministic TUI chrome on session start, not model-generated.

### F5 · prompt/context · minor · scoped → `memory/cards/walkthrough--elicitor-prompt-refinements.md` (re-observe post-F1)

**Assistant messaging too verbose.** Candidate fix: concision directive in elicitor persona ("be clear and concise; may sacrifice grammar for clarity; use lists/pseudocode/diagrams; don't over-rely on inline styling"). Re-evaluate only after F1 is fixed — the persona that would carry this guidance isn't currently reaching the model.

### F6 · transport/projection (TUI rendering) · minor · scoped → `memory/cards/walkthrough--kick-chrome-and-thinking.md` (Card 1; pi setting `hideThinkingBlock` exists)

**Thinking block rendered inline, not collapsed.** Session JSONL confirms the model emitted a proper `thinking` content block; the TUI renders it as italic inline prose above the response instead of a collapsed-by-default thinking affordance. Data is correct; rendering is the defect.

### F7 · transport/projection (TUI rendering) · minor · logged

**`present_question` transcript template hard to read.** Options render as `## 1. **…**` headings with bold-heavy styling; visual hierarchy between question, body, options, rationale is muddy. Template lives in the projection/formatter for `present_question` tool results (`src/projections/exchanges/present-question.ts` / tool-contents rendering).

### F8 · transport/projection + exchange protocol · minor · logged

**`request_response` selector rendering is raw and duplicative.** The selector re-lists all options below the already-rendered question: (a) no markdown applied — literal `**` asterisks show (`request-response.ts` maps `label: option.content` straight into the picker; `choice-source.ts` uses it verbatim); (b) each option flattened to one line; (c) options unnumbered, so they don't correlate with the numbered list above; (d) "Other" appears with no affordance/explanation of what it does. Reads as repetition of the question in a flatter style.

### F9 · prompt/context (agent judgment) · minor · scoped → `memory/cards/walkthrough--elicitor-prompt-refinements.md`

**Single-select chosen where multi-select fit.** "What's the primary thing a user is trying to figure out?" plausibly wants multiple answers. Capability exists — `present_question` supports `multiple`; the agent didn't use it. Prompt guidance nudge ("prefer multi-select when options aren't mutually exclusive") belongs in the elicitor persona / present_question promptGuideline. Blocked-by/related-to F1.

## Cross-checks recorded in passing

- `entry-contents.md` ✓ healthy: context seed at LSN 2, graph facts (counts by kind, zero-count kinds with bands), empty scratchpad, **no** gap scores/ranks — matches D101-L/D102-L expectations.
- `tool-contents.md` ✓ present with well-formed `present_question` markdown.
- Stale vocabulary in live prompt: `read_specification_context` guideline says "ranked elicitation gaps" — persisted/ranked gaps are retired (D101-L). Fix the promptGuideline text. · prompt/context · minor · scoped → `memory/cards/walkthrough--elicitor-prompt-refinements.md`
- Settlement guidance in live prompt keys advisory on **provenance** ("source-derived bulk-acquisition material"), not on plane (design/oracle/commitment). Note for scenario 4: the code-side convention is provenance-based, aligning with the proposed enforcement-by-provenance idea rather than a per-plane rule.

# Walkthrough Findings Log

Doctor-mode log for the TESTING_PLAN.md walkthrough, 2026-07-02. Session: `workspace-alpha-grounding`, seeded `base`, `--reset --open-web --dev-tools`. Classification taxonomy per TESTING_PLAN.md §Finding classification. Status: `logged` (observed, not yet acted), `scoped` (needs a scoped fix), `fix-inline` (small, fixed during walkthrough), `wontfix`.

## Beat 1 — New session, kick, first question (scenario 1)

### F1 · prompt/context · MAJOR · scoped → `memory/cards/walkthrough--kick-prompt-and-origination-record.md` (Card 1)

**Root cause (traced):** pi's `sendCustomMessage({triggerTurn: true})` — the kick path — calls `_runAgentPrompt` directly (agent-session.js:1004) and never calls `emitBeforeAgentStart`, the only place `registerBrunchPrompting`'s append runs. Kick turns run on Pi's base prompt; ordinary user turns are unaffected.

**Blast radius widened (beat 2, in vivo):** answering via the `request_response` picker resolves the tool call *inside the same kick run* — no new turn, no `before_agent_start`. The whole elicitation conversation can proceed through repeated present/request cycles within one agent run, so **every provider call in it uses the base prompt** (verified: `system-prompt.md` still has zero elicitor content after the first answer). The `before_provider_request` guard fix is confirmed as the right shape — it must repair every provider call, not just turn starts. Same mechanism explains F2 timing: origination outcome still unflushed after the answer because the run is still open.

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

## Beat 2 — First answer via "Other", follow-up question

### F10 · exchange protocol (data, not rendering) · minor · logged

**"Other" answers duplicate text into label AND comment.** `choice-source.ts:81-82`: when the user picks Other, the typed text becomes both `choice.label` and `comment`, so `formatRequestChoice` renders "Selected: **text**" followed by "Comment: > text" — same text twice. Fix: Other text is the label; comment stays empty (or ask the optional comment question separately, as the listed-choice path does). Not a rendering issue — candidate for the build batch despite the F7/F8 exclusion.

### F11 · transport/projection (TUI rendering) · minor · logged (rides F7/F8 rendering work)

**`request_response` answered-result template is flat.** "# Response / Selected: … / Comment: > …" reads as raw scaffolding; no visual tie back to the question it answers. Same family as F7/F8 — deferred with them; see the render-topology map (below/pseudo) for where the template lives (`src/agents/contexts/exchanges/request-choice.ts` et al).

## Beat 3 — Builder-reported (FE-1122 batch)

### F12 · harness (test ledger) · minor · fixed (`6e263787` on `ln/fe-1122-walkthrough-fixes`)

**`registry.test.ts` event-order failure: extra `message_start`.** Triaged: NOT pre-existing and NOT flake — commit `6eae06db` (F3 kick-activity) added `pi.on('message_start', …)` in `src/.pi/extensions/chrome/index.ts` to clear the indicator on first assistant output; `src/.pi/extensions/__tests__/registry.test.ts` is an exact registration ledger and needed the new listener added between `thinking_level_select` and `turn_end`. Fixed on the causing branch; fe-1123/fe-1124 restacked; test green (7/7).

**Postscript (doctor note):** the builder reported this failure as "unrelated/pre-existing" — wrong; its own F3 commit introduced the listener. Treat builder-thread attribution claims about test failures as unverified until traced.

## Beat 4 — Relaunch verification (batch-1 fixes live)

Verified in vivo: F1 ✓ (elicitor persona + skills manifest in captured provider prompt; agent chose multi-select unprompted, also confirming F9), F2 ✓ (`origination.md` decision record present while first question still pending), F4 ✓ (welcome renders before assistant output), F6 ✓ (thinking collapsed).

### F13 · product behavior (chrome design) · minor · logged

**Welcome block placement + styling.** The welcome copy is part of `BrunchStartupHeader` itself (`ui.setHeader`, `src/.pi/extensions/chrome/index.ts:224`), not a separate block. Wanted: welcome as its own element *after* the header, with stronger styling/decoration to stand out. Content is good.

### F14 · demo friction · minor · logged

**Kick activity indicator too low-salience.** F3 landed as a status-line entry (`setStatus('brunch.kick', 'opening assistant turn…')`, `brunch-tui.ts:510`) — user didn't notice it during a real kick. Pi exposes `setWorkingMessage` / `setWorkingVisible` / `setWorkingIndicator` (the main loading animation), which is the salient surface; the kick should probably drive that instead of (or in addition to) a status entry.

### F15 · product behavior (TUI rendering) · minor · logged

**Collapsed thinking/tool blocks should summarize what happened.** Wanted: "Thinking..." → "Thought for N seconds", "Exploring..." → "Explored N files", or generic "Working..." → "Worked for N seconds". Pi capability check: `ctx.ui.setHiddenThinkingLabel(label)` exists and is extension-settable at runtime, but it is a **single global label** propagated to all rendered assistant messages (`interactive-mode.js:1373-1381`) and reset to default on turn boundaries — so per-message retrospective labels ("Thought for 12s" on *that* block) are not natively supported; a duration-updating label would apply to every collapsed block at once. Per-message labels or tool-call collapse summaries ("Explored 4 files") for pi built-in tools would need an upstream pi change; Brunch-owned tools could get summary-style `renderCall`/`renderResult` treatment inside the exchange-rendering frontier instead. Candidates: (a) cheap — set a session-global "Worked for Ns" label at turn_end (accepting the global-label semantics), (b) upstream pi feature request for per-message labels, (c) fold Brunch-tool collapse summaries into `exchange-rendering`'s renderCall row.

## Beat 5 — Resume re-entry (relaunch without `--reset`)

### F16 · product behavior + prompt/context (re-entry framing) · MAJOR · logged

**Resume gives no "where are we" orientation.** On re-entry the session should (a) surface deterministic state/status in the TUI — current mode, graph stats, possibly tucked into the transcript as chrome — and (b) have the elicitor open with an *assessment* of the spec's current state: not a raw node/edge listing, but a summary of what the graph expresses, plus a forecast of what's TODO and what comes next. Example shape: "Welcome back to **Alpha Grounding**. This is an early-stage spec with 5 nodes and 0 edges…" followed by a compact reading of the nodes (G1/TH1/CTX1/CON1/T1) and where the elicitation is headed. This is also the natural teaching surface — the re-entry summary is where the user learns what Brunch can do next. Two homes: deterministic chrome (rides the F13 welcome-block family, resume variant) and elicitor persona/kick-prompt guidance for the assessment framing (rides the F5/F9 elicitor-refinements family). The graph facts the summary needs are already in the context seed (entry-contents cross-check ✓).

### F17 · product behavior (kick/exchange design) · MAJOR · logged

**Resume should open with a process-level mode selection, not dive back into elicitation.** First interaction on re-entry should be a `request_response` single-select asking what the user wants to do — e.g.: continue specification via design-decision questions · continue via example-based questions · generatively expand/enhance the spec from what we know · design the technical implementation · design the verification approach — and only then proceed with questioning. This is the user-facing surface of the skills manifest routing (elicit variants / propose / project) and converges with TESTING_PLAN goal 6 (generative discoverability) and the scenario 7 mode-switch probe: the generative options in this menu are exactly the paths with no discriminating seed yet (see fixture-prep worklist). Design questions to settle when scoping: is the menu deterministic kick chrome or prompt-directed agent behavior; does it appear on every resume or only when the graph is past some threshold; how a choice maps to skill routing.

## Cross-checks recorded in passing

- `entry-contents.md` ✓ healthy: context seed at LSN 2, graph facts (counts by kind, zero-count kinds with bands), empty scratchpad, **no** gap scores/ranks — matches D101-L/D102-L expectations.
- `tool-contents.md` ✓ present with well-formed `present_question` markdown.
- Stale vocabulary in live prompt: `read_specification_context` guideline says "ranked elicitation gaps" — persisted/ranked gaps are retired (D101-L). Fix the promptGuideline text. · prompt/context · minor · scoped → `memory/cards/walkthrough--elicitor-prompt-refinements.md`
- Settlement guidance in live prompt keys advisory on **provenance** ("source-derived bulk-acquisition material"), not on plane (design/oracle/commitment). Note for scenario 4: the code-side convention is provenance-based, aligning with the proposed enforcement-by-provenance idea rather than a per-plane rule.

# Exchange transcript design permutations

Brainstorm surface for how structured-exchange results might want to appear in the
transcript. Variants are divided by `---`. Placeholders in `{braces}`; concrete text
where a real example judges better than a template.

**Scope: the `content` property of the tool-result entry** — the persisted markdown
string whose readers are the model and any markdown-rendering surface. This file
does NOT design `renderResult` (the TUI presentation from `details`); that is a
separate surface with its own constraints. Markdown semantics here are for their
semantic value to those readers, not for terminal styling. Tuple variants show
present + response together, since the pair is what actually sits in the transcript.

Fields we actually have (details contract):
question — heading, body?, preface?, options[{content, rationale?}]?, allow_other?,
allow_none?, comment_prompt? · choice/choices — label, kind (listed|other), comment? ·
answer — text · review — decision (approve|request_changes|reject), comment? ·
terminal — cancelled | unavailable(message) | diagnostic(message).

## present_question — options with rationale

---

# Question: {question_content}

> {overall reason for question}

## Options

1. **{option_a_content}** {rationale_for_option_a}
2. **{option_b_content}** {rationale_for_option_b}
3. **{option_c_content}** {rationale_for_option_c}

---

# Question: {question_content}

> {overall reason for question}

## Options

1. **{option_a_content}**

    > {rationale_for_option_a}
2. **{option_b_content}**

    > {rationale_for_option_b}
3. **{option_c_content}**

    > {rationale_for_option_c}

---

# Question: {question_content}

## Options

1. **Option A**.
    > Rationale for option A
2. **Option B**.

    Rationale for option B
3. **Option C**.

    Rationale for option C

---

Em-dash inline rationale — flattest, scans as one unit per option:

**{question_content}**

{body}

1. **{option_a_content}** — {rationale_for_option_a}
2. **{option_b_content}** — {rationale_for_option_b}
3. **{option_c_content}** — {rationale_for_option_c}

---

Rationale as dim second line, no bold on rationale (current head-slice shape, evolved):

{question_content}

{body}

1. {option_a_content}
   ↳ {rationale_for_option_a}
2. {option_b_content}
   ↳ {rationale_for_option_b}

---

Preface carried as framing quote before the question (preface = elicitor working
context, D47-L):

> {preface: what I noticed / why I'm asking now}

**{question_content}**

1. {option_a_content}
2. {option_b_content}

## present_question — affordance footer (allow_other / allow_none / comment_prompt)

---

Affordances as list continuation (they read as answerable items):

1. **{option_a_content}**
2. **{option_b_content}**
3. *Other — write your own answer*
4. *None of these*

> Optional comment: {comment_prompt}

---

Affordances as quiet footer line, outside the numbered space:

1. **{option_a_content}**
2. **{option_b_content}**

*Other and none-of-these are accepted. {comment_prompt}*

---

Affordances folded into the ask line itself:

**{question_content}**
*(pick one, write your own, or say none fit — add {comment_prompt} if useful)*

1. {option_a_content}
2. {option_b_content}

## present_question — free-text (no options)

---

# Question: {question_content}

{body}

*Answer freely.*

---

Minimal — the question mark carries the affordance; no scaffolding at all:

**{question_content}**

{body}

## Tuples — question → choice (the unit users actually read)

---

Checkbox echo (your sketch) — **working favorite for all option-driven responses**
(choice, choices, candidates→choice): the full field re-renders with `[x]`/`[ ]`,
so rejected options stay visible — the negative space is signal, not noise:

# Question: {question_content}

1. **Option A** {rationale}
2. **Option B** {rationale}
3. **Option C** {rationale}

## Choice(s): A, B

- [x] Option A
- [x] Option B
- [ ] Option C

---

~~Answer as annotation on the question~~ — **rejected 2026-07-02**: requires the
response renderer to reference the paired present's details across transcript
entries; too complicated for the value. The checkbox echo above achieves the same
tie-back by re-rendering the field in the response entry itself.

---

Response ties back by echoing number + label only — no re-list:

[present_question renders as above]

**Answered:** 2. {option_b_content}

> {comment}

---

Multi-select, compact:

**Answered:** 1, 3 — {option_a_content}; {option_c_content}

---

Other (write-in) choice — label is the user's text, no duplicate comment:

**Answered (other):** {user_written_text}

---

Response in the question's own vocabulary, conversational:

> **You chose:** {option_b_content}
> **You added:** {comment}

## Tuples — question → answer (free-text)

---

# Question: {question_content}

*Answer freely.*

**Answered:**

> {answer_text_verbatim, possibly multi-paragraph}

---

Quiet variant — answer isn't quoted, it's just the next voice in the transcript:

**{question_content}**

**Answer:** {answer_text}

## Tuples — question → terminal states

---

Cancelled — one quiet line, no re-list, no heading:

*Question withdrawn.*

---

Unavailable — states the mechanism honestly but briefly:

*No interactive answer surface available — {message}.*

---

Diagnostic:

*{message}* ⏳

## present_candidates → choice

---

Candidates with rubric table, choice echoes provenance:

# Candidates: {framing}

| #   | Candidate    | {rubric_axis_1} | {rubric_axis_2} |
| --- | ------------ | --------------- | --------------- |
| 1   | **{cand_a}** | {score/note}    | {score/note}    |
| 2   | **{cand_b}** | {score/note}    | {score/note}    |

**Picked:** 2. {cand_b} *(from generate fan-out, plane: {plane})*

---

Candidates as cards (rounded-box family in renderResult; in content register,
sections):

## 1 · {cand_a_title}

{cand_a_summary}

*{rubric_axis_1}: {note} · {rubric_axis_2}: {note}*

## 2 · {cand_b_title}

{cand_b_summary}

*{rubric_axis_1}: {note} · {rubric_axis_2}: {note}*

**Picked:** #2

## present_review_set → review

---

Review set with per-item disposition, decision echoes verdict + comment:

# Review: {review_set_title}

**Drafts**

1. {draft_a_summary}
2. {draft_b_summary}

**Edges**

- {edge_description}

**Settlement:** {advisory | settled}

**Decision: Changes requested**

> {comment — required for request_changes}

---

Verdict-first — the decision is the headline, the set collapses beneath it:

## ✔ Approved — {review_set_title}

*2 drafts, 1 edge, settled.*

---

## ✕ Rejected — {review_set_title}

> {comment}

## STRUCTURAL_ILLEGAL / recovery

---

*Exchange out of order: {what was expected} — recovered by {recovery action}.*

---

> ⚠ {tool} called without a pending question. Awaiting a new present_question.

## Framing devices — establishing the question/response group

Verified: pi-tui's Markdown renders h1 as color+bold+underline and h2 as color+bold,
both with hashes stripped; h3+ keeps the literal `### ` prefix (markdown.js:245).
So `#`/`##` are display registers, usable as frame openers in any markdown-rendered
surface.

Candidate devices for making the exchange read as one grouped unit, separate from
surrounding transcript:

- **h1 opener + rule closer**: `# Question: …` opens the frame; `---` after the
  response closes it. Cheap, works in both registers.
- **Box-as-frame** (renderResult only): the rounded border label already names the
  kind; content inside goes heading-free. Tuple grouping = response box visually
  attached beneath the question box (shared width, no gap), or one box containing
  both with an internal rule.
- **Left rail**: blockquote-style gutter spanning the whole exchange — question and
  response share one continuous rail, transcript noise doesn't.
- **Symmetric labels**: frame opens `# Question:` and the response opens
  `## Answer:` — h1/h2 asymmetry makes the response read as *inside* the question's
  frame rather than a new section.

---

## Real-content permutations

### question(choice) → choice, em-dash options + checkbox echo

**★ Working favorite (2026-07-02), with one revision: Question line at h2, not h1**
(`## Question: …` — keeps h1's underline register free for larger transcript
structure; Question and Answer at equal h2 weight read as two halves of one frame).
Element semantics deliberate: blockquote = the "why" voice on both sides (elicitor's
reason under the question, user's reason under the answer), ordered list = option
field, task list = selection state.

# Question: Where should replay authority live?

> Session reload currently re-derives exchange state in two places; picking one
> owner unblocks the renderer sweep.

1. **Transcript projection** — replay is a pure fold over persisted entries; no
   second source of truth.
2. **Session store snapshot** — faster reload, but the snapshot can drift from the
   transcript it summarizes.
3. **Hybrid: snapshot + transcript checksum** — fast path with a drift tripwire.

## Answer

- [x] Transcript projection
- [ ] Session store snapshot
- [ ] Hybrid: snapshot + transcript checksum

> Drift risk outweighs reload speed at our session sizes.

---

### question(choices, multi) → choices, blockquote rationale + checkbox echo

# Question: Which surfaces must the walkthrough re-observe after this lands?

## Options

1. **Specify-mode question flow**

    > The renderer changes land directly under it.
2. **Review-set approval**

    > Shares the request_response terminal path.
3. **Candidate fan-out picker**

    > Untouched this slice, but shares the option-list component.

## Answer

- [x] Specify-mode question flow
- [x] Review-set approval
- [ ] Candidate fan-out picker

---

### question(free-text) → answer

# Question: What does "done" look like for the exchange-rendering sweep?

Answer in terms of what a user sees in the transcript, not which tests pass.

## Answer

> Every question, answer, and review in a session reads as designed product — I can
> scroll a finished session and never see raw scaffolding like bare asterisks,
> unnumbered re-lists, or a flat "# Response" header.

---

### question(choice) → choice via Other

## Question: Which terminal should the physical wheel-scroll smoke test target first?

1. **iTerm2** — primary dev environment.
2. **Kitty** — closest to pi-tui's assumed capabilities.

## Answer

- [ ] 1. **iTerm2**
- [ ] 2. **Kitty**
- [x] *Other:* Ghostty — it's what I actually use daily now.

---

### question(choice) → cancelled

# Question: Should the preview harness also cover the footer lane?

1. **Yes, now** — close the lane gap while the harness is warm.
2. **Defer** — footer rides live session state; wait for a product need.

*Question withdrawn — superseded by the component-dx pause.*

---

### candidates → choice with provenance

**★ extension (2026-07-02):** the ★ pattern applies to candidates cleanly — same
frame (`## Candidates:` h2 opener, blockquote reason), same `## Answer` + checkbox
echo (names only, table stays the reference), blockquote rationale on both sides.
The only structural difference: the option field presents as a table.

# Candidates: name for the details-to-lines projection helper

| #   | Candidate              | Reads as                           | Collision risk |
| --- | ---------------------- | ---------------------------------- | -------------- |
| 1   | **projectResultLines** | matches `projectRoundedBox` family | low            |
| 2   | **detailsToLines**     | transformation, not projection     | none           |
| 3   | **renderDetails**      | conflates with pi's renderResult   | high           |

Two answer-echo alternatives (2026-07-02) — `~~del~~` is GFM semantics: struck =
explicitly rejected, a real signal to the model.

(A) numbered + strikethrough — retains the question's option numbering (stable
reference vocabulary), bold = chosen, strike = explicitly rejected. Three signals,
no redundancy. **Preferred.**

## Answer

1. **projectResultLines**
2. ~~detailsToLines~~
3. ~~renderDetails~~

> Keeps the `project*` naming family that rounded-box established.

(B) checkbox + strikethrough — `[ ]` and `~~…~~` double-encode "not chosen"; extra
tokens saying one thing twice.

## Answer

- [x] **projectResultLines**
- [ ] ~~detailsToLines~~
- [ ] ~~renderDetails~~

> Keeps the `project*` naming family that rounded-box established.

Resolution (2026-07-02, later): **checkbox echo with embedded numbers** — restating
the original option numbers inside the checkbox items gives checkboxes the
numbering-retention property that was (A)'s main advantage, and handles `Other`
write-ins more gracefully (an unlisted answer has no number to strike, but slots
naturally into the list). Current lead, at least for multi-choice:

## Question: Which terminal should the physical wheel-scroll smoke test target first?

1. **iTerm2** — primary dev environment.
2. **Kitty** — closest to pi-tui's assumed capabilities.

## Answer

- [ ] 1. **iTerm2**
- [ ] 2. **Kitty**
- [x] *Other:* Ghostty — it's what I actually use daily now.

Still open: whether single-choice uses the same shape (uniform grammar, one `[x]`)
or the strike variant (A); decide at build time against tuple goldens + preview.

---

## Review-set evaluation (under-specified — the hard case)

Contract reality (schemas/present.ts, schemas/request.ts): the **present side is
rich** — drafts `{draft_id, plane: intent|oracle|design|plan, kind, title, body?}`
plus a typed edge taxonomy (dependency · witness±stance · rationale±stance ·
realization · refinement · exclusion · composition · cross_reference), each edge
with optional rationale, endpoints by draft_id or existing graph code. The
**response side is thin**: `decision` + one whole-set `comment` (required for
request_changes only). GitHub-style per-item comments do not fit today's contract.

Three separable design questions:

1. **Set presentation** (this frontier): make drafts + edges + settlement legible.
2. **Decision presentation** (this frontier): today's decision+comment, rendered
   ★-consistently.
3. **Per-item commentary** (NOT this frontier alone): widening the answered payload
   (e.g. `comments: [{on: draft_id | edge | 'set', body}]`) plus the collection UI
   to gather them — the UI half is `exchange-answering-chrome` turf, the payload
   half is a SPEC decision. Sketched below as aspiration, flagged.

---

### review_set presentation — numbered drafts as reference vocabulary

Draft numbers become the pronoun system; edges speak in them. Plane as inline tag,
not grouping (sets are small; grouping fragments the numbering):

## Review: capture path for elicitation scratchpad

> Three drafts and their wiring; settlement is advisory — approving commits the
> drafts, the edges ride along.

1. **[intent] Session-local asking agenda** — replace the persisted gap register
   with a session fold.
2. **[design] Scratchpad seeded from graph facts** — thin seed, no count-based
   readiness.
3. **[oracle] Closure grep-guard** — retired names cannot reappear.

**Edges**

- 2 realizes 1
- 3 witnesses 2 *(for)* — > the guard is the only deterministic proof the retirement
  holds.

*Settlement: advisory*

---

### review_set presentation — edges nested under their subject draft

Adjacency view: each draft carries its own wiring; no separate edges section to
cross-reference. Reads better when edges are few and local:

## Review: capture path for elicitation scratchpad

1. **[intent] Session-local asking agenda**
2. **[design] Scratchpad seeded from graph facts**
   - realizes → 1
3. **[oracle] Closure grep-guard**
   - witnesses → 2 *(for)*
     > the guard is the only deterministic proof the retirement holds.

*Settlement: advisory*

---

### review_set presentation — draft table + edge sentences

Table when the set is homogeneous enough to scan; edge lines below in plain
sentences:

## Review: capture path for elicitation scratchpad

| #   | Plane  | Kind      | Title                              |
| --- | ------ | --------- | ---------------------------------- |
| 1   | intent | goal      | Session-local asking agenda        |
| 2   | design | mechanism | Scratchpad seeded from graph facts |
| 3   | oracle | guard     | Closure grep-guard                 |

Draft 2 realizes draft 1. Draft 3 witnesses draft 2 (for): the guard is the only
deterministic proof the retirement holds.

*Settlement: advisory*

---

### review decision — checkbox echo over the verdict field (★-consistent)

The three verdicts ARE a single-choice field — the same task-list semantics apply,
and rejected verdicts staying visible carries signal ("changes were requested when
approve was on the table"):

## Decision

- [ ] Approve
- [x] Request changes
- [ ] Reject

> Rounded-box truncation needs fixing before this pattern propagates — otherwise
> the drafts are right.

---

### review decision — GitHub-style per-item commentary (ASPIRATION — contract widening)

Requires widened answered payload + collection UI (`exchange-answering-chrome`).
Comments quote their target by number; whole-set comment closes:

## Decision

- [x] Request changes

**On 2** *(design — Scratchpad seeded from graph facts)*

> Seed shape should exclude settled gaps, not just count them.

**On 3 → 2** *(witness edge)*

> This edge should be stance *against* until the guard actually runs in CI.

**On the set**

> Direction is right; land 1 and 3 as-is once 2's seed shape is fixed.

---

### review_set → request_changes, verdict-first

# Review: exchange-rendering head slice

**Drafts**

1. `present_question` renderer — render-from-details, rounded box, elision list.
2. F7 content template — numbered options, `why:` rationale lines.

**Edges**

- renderer → `projectRoundedBox` (new dependency, shared primitive)

**Settlement:** advisory

## ✎ Changes requested

> Rounded-box path truncates long lines instead of wrapping — fix before the
> pattern propagates to the other renderers.

---

### unavailable (headless turn)

*No interactive answer surface available — choice prompts need a TUI session; this
turn came through the web driver.*

---

## Cross-cutting dials (apply to any variant above)

- Heading register: `# Question:` label vs bare `**{question}**` — does the transcript
  need the noun, or is the box label / tool name already carrying it?
- Rationale weight: inline em-dash · indented dim line · blockquote — how much visual
  distance between an option and its why?
- Response re-listing: full checkbox echo ↔ number+label echo ↔ pure annotation of
  the question above (F8: never a flat unnumbered re-list).
- Terminal-state loudness: quiet italics vs warning glyphs — cancelled should whisper,
  STRUCTURAL_ILLEGAL may warn.
- Affordance placement: in-list items · footer line · folded into the ask.
- Tuple spacing: blank line vs rule vs nested indentation between present and response.

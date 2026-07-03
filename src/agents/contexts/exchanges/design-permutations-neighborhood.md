# Exchange transcript design permutations — neighborhood grammar for review sets

Generative permutations of the settled pattern (2026-07-02) for `present_review_set`
content: proposed nodes as the focus, edges implicit as nested relation lines, in the
same relational grammar the model already reads from the graph neighborhood
projections (`src/agents/contexts/data-model/graph/__snapshots__/neighborhood-*.md`).

**Pattern rules (settled):**

- One list item per **proposed node**: `**$CODE: Title** *(plane/kind)*`.
- `$` prefix marks a proposed node; bare codes (`REQ4`, `T1`) are existing graph nodes.
- Proposed codes are the **real next IDs** the commit would assign (kind prefix +
  next number), not arbitrary pronouns — mechanism note below.
- Body, if any, sits below the title as an indented continuation. No em-dash inline
  variant; one rule regardless of body length.
- Edges render as nested lines under a node: directional verb + bold reference. No
  `upstream:`/`downstream:` grouping — the verb carries direction. In practice new
  nodes almost always point *at* things (implements, witnesses, realizes), not the
  reverse.
- Each edge renders **once**, under the proposed node that is its natural subject —
  no mirrored double-entry.
- Edge rationale, if any, renders as a blockquote under its edge line (blockquote =
  why-voice, per the ★ grammar).

**Mechanism note (not a formatter decision — carries a contract implication):**
proposing real next IDs means the projection must know the current max code per kind
at present time — either the details payload carries `proposed_code` per draft
(computed when the review set is assembled) or the formatter consults graph state.
Payload-carried is the honest option: the code is then part of what the user approved,
and the commit path must honor it or fail loudly, never silently renumber.

**Verb vocabulary (edge category → rendered line, subject = proposed node):**

| category        | rendered under subject                | notes                                                  |
| --------------- | ------------------------------------- | ------------------------------------------------------ |
| dependency      | depends on **X**                      | subject = dependent                                    |
| witness         | witnesses **X** *(for\|against)*      | subject = oracle                                       |
| rationale       | supports **X** / argues against **X** | subject = support, stance in verb                      |
| realization     | realizes **X**                        | subject = concrete                                     |
| refinement      | refines **X**                         | subject = the refiner                                  |
| exclusion       | excludes **X**                        |                                                        |
| composition     | part of **X**                         | subject = the part                                     |
| cross_reference | relates to **X**                      | symmetric; render under whichever endpoint is proposed |

---

## 1 · Minimal set — titles only, mixed proposed/existing endpoints

(the current fixture content, re-said in this grammar)

## Review: Launch readiness review set

> Review the launch-readiness commitments together.

- **$G2: Launch safely** *(intent/goal)*
- **$REQ5: Rollback is required** *(intent/requirement)*
  - bounds **$G2**
- **$CH3: Observe rollback path** *(oracle/check)*
  - witnesses **$G2**

*Settlement: advisory*

---

## 2 · Bodies — absent, short, and multi-paragraph, one continuation rule

## Proposal: Capture path for the elicitation scratchpad

> Three drafts and their wiring; approving commits the drafts, the edges ride along.

Lorem ipsum dolor sit amet facilisis dolore et et takimata liber erat dolore consequat ipsum erat esse nulla. Sadipscing sea eu eirmod at facer dolor veniam gubergren dolor facilisis sit sit ipsum et diam diam nonumy. No vero stet ut at stet dolores nulla. 

- **$G3: Session-local asking agenda** *(intent/goal)*
- **$D12: Scratchpad seeded from graph facts** *(design/mechanism)*

  Seed is thin facts only — no count-based readiness, no dependence on
  advisory/settlement state.
  - realizes **$G3**
- **$CH4: Closure grep-guard** *(oracle/check)*

  Retired names cannot reappear anywhere under `src/`.

  Guard runs in the standard test suite, not a separate CI lane; a new source file
  using a retired name fails the suite the same run it lands.
  - witnesses **$D12** *(for)*

## Review: accepted

> Optional comment

---

## 3 · Edge rationale + stances — blockquote is the why-voice on edges too

## Proposal: Verification layers for the render sweep

> Rationale here

Lorem ipsum dolor sit amet facilisis dolore et et takimata liber erat dolore consequat ipsum erat esse nulla. Sadipscing sea eu eirmod at facer dolor veniam gubergren dolor facilisis sit sit ipsum et diam diam nonumy. No vero stet ut at stet dolores nulla. 

- **$CH5: Render-honesty invariant test** *(oracle/check)*
  - witnesses **$D13** *(for)*

    > the invariant is the only oracle that catches a silently dropped details leaf.
- **$D13: Details-first formatter contract** *(design/decision)*
  - refines **D104**
  - argues against **A9**

    > if content can be regenerated from details, the persisted-string-is-truth
    > assumption stops paying rent.

## Review: rejected

> Reason why

---

## 4 · Existing↔existing edge — no proposed host, trailing section

Edges may reference existing graph codes on both endpoints. With no proposed node to
nest under, they get one trailing group; keep it last, keep it short.

## Proposal: Reconcile rollback coverage

Lorem ipsum dolor sit amet facilisis dolore et et takimata liber erat dolore consequat ipsum erat esse nulla. Sadipscing sea eu eirmod at facer dolor veniam gubergren dolor facilisis sit sit ipsum et diam diam nonumy. No vero stet ut at stet dolores nulla. 

> Additional reasoning / rationale.

New nodes and edges:

- **$REQ6: Rollback rehearsal before each release** *(intent/requirement)*
  - refines **REQ5**
  - depends on **MOD1**

Other new edges:

- **CH1** witnesses **REQ5** *(for)*

  > the boundary test already exercises the rollback path end to end.

## Review: accepted

> Optional comment


---

## 5 · Full tuple — present + review answer, answer speaks $codes

## Review: Launch readiness review set

> Review the launch-readiness commitments together.

- **$G2: Launch safely** *(intent/goal)*
- **$REQ5: Rollback is required** *(intent/requirement)*
  - bounds **$G2**
- **$CH3: Observe rollback path** *(oracle/check)*
  - witnesses **$G2**

*Settlement: advisory*

## Review: changes requested

> $REQ5 is right but under-specified — "required" should name the rollback window.
> Land $G2 and $CH3 as-is once that's tightened.

---

## 6 · Wider taxonomy exercise — composition, exclusion, cross-reference

## Review: Split the answering chrome from transcript rendering

Lorem ipsum

> One frontier became two; these drafts record the boundary.

- **$F4: Exchange answering chrome** *(plan/frontier)*
  Owns the live answering surfaces: choice/review pickers, one-shot answer dialog.
  - part of **$F5**
  - excludes **$F6**

    > the main-editor thread is not exchange work; keeping it out is the point of
    > the split.
  - depends on **MOD7**
- **$F5: Exchange presentation arc** *(plan/frontier)*
  - relates to **F2**
- **$F6: Main editor chrome** *(plan/frontier)*

*Settlement: advisory*

---

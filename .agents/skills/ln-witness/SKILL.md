---
name: ln-witness
description: "Audit a test suite for what it actually proves — attribute tests to behavioral kernels, place each on the progressive-checkability ladder, surface unwitnessed proof obligations, and generate contrastive rivals the tests fail to rule out. Use when a slice has tests but verification confidence is unclear, when tests pass but the spec feels under-witnessed, or when the user asks what these tests prove."
argument-hint: "[test files, directory, or frontier item to audit; include relevant invariants or kernels if known]"
---

# Ln Witness

Audit a test suite for evidentiary strength, not line coverage.

A passing test is not yet a witness. A witness is a test that exercises a named claim under the mutations its kernel cares about, sits on a known rung of the progressive-checkability ladder, and rules out at least one plausible rival interpretation. `ln-witness` makes those three properties explicit and surfaces where they are missing.

Sibling skills:
- [`ln-oracles`](../ln-oracles/SKILL.md) chooses verification strategy *before* tests exist; `ln-witness` audits what the resulting tests actually prove.
- [`ln-design`](../ln-design/SKILL.md) forces rival module shapes into view before commitment; `ln-witness` forces rival *interpretations* into view to expose witness gaps. Same epistemic stance, different artifact.
- [`ln-review`](../ln-review/SKILL.md) audits code shape; `ln-witness` audits test evidence.

Do not create standalone audit documents without explicit permission. Findings reconcile back into `memory/SPEC.md` (invariants, blind spots), `memory/PLAN.md` (frontier verification notes), or the active scope card.

Read the [witness rubric](assets/witness-rubric.md) before starting. It defines the progressive-checkability ladder and the proof obligations per behavioral kernel.

## Input

What to audit: $ARGUMENTS

Read in this order:
1. `memory/SPEC.md` — invariants, acceptance criteria, verification design, and any §Active Kernels notes.
2. `memory/PLAN.md` — frontier definitions whose verification notes reference the tests under audit.
3. `docs/design/BEHAVIORAL_KERNELS.md` — the kernel taxonomy, proof obligations, and example test shapes the audit will measure against.
4. The test files themselves and the code under test.

If no intent graph or kernel annotation exists yet, the audit drops to heuristic mode: infer active kernels from test names, assertions, and code under test, and flag this softness in the report.

## Procedure

This is an **interactive process**. Present each step's findings and grill the user before moving on. Do not produce a finished audit in one pass.

### 1. Identify active kernels

For the tests in scope, name which of the fifteen behavioral kernels appear to be exercised. Use the signal-phrase routing table from `BEHAVIORAL_KERNELS.md` against test names, assertion targets, and the code under test. Keep the active set small (typically two to four kernels per scope).

**Grill**: Are these the kernels the spec considers active for this scope, or has the test suite drifted toward a different set than the spec intends? If the spec is silent on active kernels, is this an opportunity to promote them into `memory/SPEC.md`?

### 2. Audit mode — attribute and rate

For each test in scope, fill three columns:

| Column | Question |
| --- | --- |
| **Kernel** | Which kernel(s) does this test probe? `none` is a valid answer (incidental regression catcher). |
| **Witnessed claim** | Which `memory/SPEC.md` invariant, criterion, or example item does this test witness? `none` is valid but should be flagged. |
| **Ladder rung** | Where on the [progressive-checkability ladder](assets/witness-rubric.md) does this test sit? (positive example → counterexample → regression → property → runtime contract → state-machine rule → invariant → proof obligation) |

Present the table to the user. Tests with `kernel: none` or `witnessed claim: none` are either incidental or symptoms of spec gaps; both deserve a sentence of justification.

**Grill**: For tests stuck at the "positive example" rung, ask: is this the appropriate strength, or should it be promoted to a property/contract? For tests with no witnessed claim, ask: should the claim be added to `memory/SPEC.md`, or is this test load-bearing only as a regression net?

### 3. Audit mode — unwitnessed obligations

For each active kernel, list its canonical proof obligations from the [rubric](assets/witness-rubric.md) and mark which are covered by at least one test at the appropriate rung. Examples:

- Containment & topology: `add / move / delete / reorder preserves topology` — four obligations.
- State & lifecycle: `every state reachable / every transition exercised / terminal states are sinks / forbidden transitions rejected` — four obligations.
- Authority & capability: `permitted action succeeds / forbidden action rejected / delegated capability flows / revocation propagates` — four obligations.

A kernel with three of four obligations covered is an honest report; a kernel with one of four covered is a finding.

**Grill**: For each gap, ask: is this an acceptable deferral (cost exceeds value, deferred to outer loop, not currently in scope) or a real blind spot? What would trigger writing the missing test?

### 4. Rivalry mode — contrastive alternatives

This is where `ln-witness` inherits the design-it-twice DNA. For each *witnessed* invariant, generate two to four plausible rival interpretations the test suite would also satisfy. Borrow the contrastive-question shapes from `BEHAVIORAL_KERNELS.md` §Contrastive questions.

Worked shape:

```
Invariant: Deleting a project archives its tasks.

Tests witness this by asserting: after delete, tasks.status === 'archived'.

Rivals the tests fail to rule out:
  A. Tasks are archived only at the moment of delete; later mutations to
     the deleted project's tasks are silently accepted.
  B. Archived tasks remain editable through the API even though the UI
     hides them.
  C. Archive is a soft delete; a second delete on the project hard-deletes
     the tasks without warning.

Discriminating tests:
  → For A: mutate an archived task after parent delete; assert rejection.
  → For B: attempt PATCH on archived task; assert 403 or equivalent.
  → For C: double-delete the project; assert second call is idempotent.
```

Present the rivals to the user. Each rival is one of: **close** (write the discriminating test), **accept** (mark the invariant as under-witnessed with explicit scope), or **escalate** (the rival reveals real spec ambiguity — route back to `ln-disambiguate` or `ln-spec`).

**Grill**: For each rival, ask: is this a plausible interpretation in this domain, or a strawman? Plausibility matters — rivalry mode loses value if the rivals are not interpretations a reasonable reader would actually entertain.

### 5. Reconcile findings

Aggregate the audit into three buckets:

- **Strong witnesses** — tests at property/contract/invariant rung tied to named claims with no plausible uneliminated rivals.
- **Weak witnesses** — tests at example/regression rung, or tied to claims with uneliminated rivals, where promotion is feasible and worth it.
- **Honest gaps** — unwitnessed obligations and uneliminated rivals the user explicitly accepts as deferrals, with revisit triggers.

A test suite with zero weak witnesses or zero honest gaps is either trivial or dishonest.

## Output

Present the audit as a structured report in chat. Do not write a standalone audit document unless the user explicitly asks for one.

Update durable docs only where findings warrant:

- **`memory/SPEC.md`** — add or strengthen invariants the audit surfaced; record acknowledged blind spots in §Verification Design with revisit triggers.
- **`memory/PLAN.md`** — refresh `Verification` annotations on affected frontier items; queue follow-up frontier items for closing significant gaps.
- **Active scope card** — note discriminating tests to write in the current slice if they fit; do not let audit findings silently widen the slice.

### Cross-reference integrity

After writing, verify:
- Every promoted invariant has at least one named witnessing test
- Every acknowledged blind spot has a revisit trigger
- No rival marked **escalate** is left without a routing recommendation

## Routing

After presenting the audit, present these options to the user (use `tool-ask-question`):

| #   | Label                  | Target            | Why                                                          |
| --- | ---------------------- | ----------------- | ------------------------------------------------------------ |
| 1   | Close gaps now         | `ln-scope`        | Audit surfaced discriminating tests worth a focused slice    |
| 2   | Disambiguate spec      | `ln-disambiguate` | A rival revealed real ambiguity in intent                    |
| 3   | Revise spec            | `ln-spec`         | Audit promoted invariants or new blind spots into the spec   |
| 4   | Revisit oracle strategy| `ln-oracles`      | Gaps suggest the verification design itself is under-powered |
| 5   | Refactor tests         | `ln-refactor`     | Tests are correctly aimed but structurally weak              |
| 6   | Back to triage         | `ln-consult`      | Findings reshape direction; reassess                         |

Recommended: **1** if gaps are local and cheap; **2** if a rival surfaced spec ambiguity; **4** if multiple kernels show systematic under-witnessing.

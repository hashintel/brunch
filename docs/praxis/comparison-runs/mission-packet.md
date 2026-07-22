# Round-One Comparison Mission Packet

Use this format to give every target the same product-neutral mission. Keep the
**public packet** separate from the **controller-only reveal key**. Copy only
the public packet into the target working directory and opening prompt.

## Public packet

```yaml
mission_id: <stable id>
title: <short product-neutral title>
brief: |
  <what should be specified, for whom, and why>
ready_document:
  path: <target-cwd-relative path.md>
  shape: settled specification Markdown
  ready_when:
    - states the problem, users, scope, requirements, consequential constraints, and recommendations
    - is internally consistent and usable for human review
budgets:
  qualifying_questions: <count>
  target_turns: <count>
  elapsed_minutes: <count>
  mechanical_interventions: <count>
stops:
  ready: stop when the target has authored the ready document at the named path
  exhausted: stop when any budget is exhausted; retain the best target-authored document and mark it budget-exhausted
rules:
  - Ask for consequential missing information; do not guess it.
  - Do not invent users, constraints, facts, decisions, or evidence.
  - A non-answer does not authorize an invention; record the uncertainty in the document.
  - Work only in the target working directory. Do not inspect controller paths or seek hidden comparison material.
```

Budgets are matched across lanes before the first lane starts. A **qualifying question** seeks mission-relevant information that is absent from the public packet and matches a predeclared reveal condition. Rephrasing already answered material, asking about cheaply inferable facts, or asking a compound question solely to bypass the count does not qualify.

Round one always uses a settled **specification Markdown document** as the ready artifact. Brunch acquires it from settled graph state with:

```sh
npm run dev-cli -- document-export --workspace <dir> --spec-id <id> --out <dir>/<file.md>
```

Do not require a plan document unless a future mission's ready definition genuinely needs one.

## Controller-only reveal key

Store this outside every target cwd and never include its path or contents in a public prompt, public mission copy, or promoted public evidence.

```yaml
mission_id: <same stable id>
controller_root: <path outside all target working directories>
private_key_path: <controller-only path>
facts:
  - fact_id: <stable id>
    value: <exact answer; no embellishment>
    reveal_when: <specific qualifying-question condition>
    non_answer: <exact response when the mission intentionally supplies none>
```

The actor discloses only the fact(s) whose `reveal_when` condition the target's visible question satisfies. It records the question, qualification decision, disclosed answer, and budget debit. It neither volunteers nearby facts nor improves an intentionally specified non-answer.

The campaign manifest names distinct controller and target working directories and path patterns targets must not inspect. Same-user filesystem separation provides **leakage resistance, not a security boundary**.

## Run identity

After the complete campaign setup is approved and before the first lane starts, capture the immutable run identity using the [comparison provenance procedure](../comparison-runs.md#immutable-run-start-provenance). Keep `provenance.json` unchanged when the reviewed run is promoted. Do not reconstruct it later or backfill historical campaigns.

## Validity, intervention, and retention

A lane is invalid when any of these occurs:

- the target accesses or reproduces controller-only material before a qualifying reveal;
- controller-only material or its path appears in the opening prompt or target cwd;
- a human or actor takes over substantively by supplying reasoning, requirements, recommendations, or document content;
- the actor departs from the frozen reveal or matched-budget policy.

Declared mechanical recovery—such as restoring focus, resizing, resending an unchanged input, or navigating with named keys—does not itself invalidate a lane and debits the intervention budget. Retain every failed, exhausted, and invalid attempt with its validity reason; never erase or selectively rerun it. Promote the public mission with a reviewed run, but never promote the private reveal key.

## Small fictional worked example

This example is intentionally small and is not a campaign test case, a saved
`/compare-specs` mission, or a Brunch seed.

### Target-visible public packet

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

A target reviewing this public packet can see the mission and limits, but no withheld facts, reveal conditions, controller path, or private-key path. The controller keeps the separately instantiated reveal key outside the target cwd and applies it only to qualifying target-visible questions.

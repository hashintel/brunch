# Evaluation strategy

Use this procedure before running or judging a comparison campaign. A polished report cannot repair a study whose inputs, metrics, or winner rule changed after outcomes were visible.

## Freeze the campaign contract

Record before the first lane runs:

1. study question or hypothesis;
2. case ids and versions;
3. test axes:
   - **codebase mode:** greenfield or brownfield;
   - **change scope:** whole application or single feature;
   - **interface type:** frontend, backend, or full stack;
   - **plan stability:** build-to-spec or evolving;
4. lane-neutral starting input and actor knowledge;
5. provider, model, harness, actor recipe, environment, and budgets;
6. validity and intervention rules;
7. common evidence fields and unavailable-metric policy;
8. attempt count and repeated-run schedule;
9. rubric, scoring anchors, aggregation, tie rule, and winner rule; and
10. judge protocol and reveal order.

If an axis is intentionally out of scope, say so. Report results by case and axis before making a cross-case claim.

## Freeze the rubric before outcomes

Separate direct measurements from judgment:

- **Elicitation measurements:** question count, correction count, elapsed time, and budget use.
- **Elicitation judgments:** usefulness of questions, recommendation quality, requirements coverage, document structure, and coverage of withheld edge cases.
- **Execution measurements:** command/browser results, elapsed time, retries, permission prompts, interventions, cleanup, and test results.
- **Execution judgments:** correctness, code quality, architectural soundness, specification completeness, and test quality.
- **End-to-end judgments:** explicit requirement closure, correctly inferred requirements, missed requirements, and verified implementation coverage.

For every scored criterion, define the evidence source, scale, anchored examples, weighting, and what counts as `not_assessable`. Do not convert missing data to zero. Do not add criteria, weights, or tie-breakers after lane identities or outcomes are visible.

Withheld edge cases may test coverage, but their exact contents remain controller-only. The report may name the public concern and aggregate result, not the hidden fixture.

## Make LLM judging reproducible

Record:

- exact judge prompt and rubric version;
- judge model, provider, and version;
- masked artifact hashes and presentation order;
- whether order was randomized or counterbalanced;
- judge repetition count;
- raw structured judgments;
- disagreement and tie disposition; and
- any human calibration decision.

Judge masked outcomes before unblinded process evidence. A judge may classify evidence or apply the frozen rubric; it must not invent missing facts or silently repair an invalid lane. Treat judge output as a retained assessment artifact, not ground truth.

## Test deterministic execution separately

Determinism is not the same as implementation similarity. Freeze the normalization and equivalence rule before repeated runs, then hold the public specification, case, versions, environment, budgets, and intervention policy constant.

Compare at least two distinct layers:

1. **Procedure:** canonical transition and action sequence, including Petri transitions, agent roles, and action kinds.
2. **Output:** structural similarity such as file sets, module boundaries, exported signatures, tests, and behavior.

Report exact sequence equality separately from normalized similarity. Preserve every attempt id and explain exclusions through validity records. Brunch-only graph, Petri, JSONL, or plan evidence may diagnose its procedure but cannot create a common metric unavailable to another lane.

Do not claim deterministic execution from one repeated pair. State the number of valid attempts, observed variants, equivalence rule, and confidence bound. Generative code differences can coexist with deterministic orchestration, and similar trees do not prove identical procedure.

## Automation boundary

Prioritize automation where consistency matters:

- lane-neutral input delivery;
- immutable transcript, specification, event, metric, tree, and diff capture;
- schema and hash validation;
- masked/unblinded packet generation; and
- application of the frozen judge protocol.

Manual run triggering is acceptable when every run still receives the frozen input and produces the same evidence receipts. Automation does not excuse hidden retries, undisclosed intervention, or mutable artifacts.

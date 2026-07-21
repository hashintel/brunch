---
name: comparison-reporting
description: Analyze and report cross-harness elicitation, execution, or end-to-end comparisons with validity, frozen evaluation strategy, evidence, and redaction discipline. Use when designing or summarizing comparison campaigns, transcripts, attempt packets, benchmark results, harness outcomes, or publishing those findings to Notion.
---

# Comparison Reporting

Interpret retained comparison evidence before presenting it. Report validity before outcome quality, and keep presentation concerns separate from evidence policy.

When publishing to Notion, also load [Notion reporting](../notion-reporting/SKILL.md) for mutation safety and Notion formatting only. This skill owns comparison evidence policy and report grammar: keep the validity-first shape below instead of substituting Notion reporting's generic report shape.

## Inputs

Resolve:

1. comparison kind: **elicitation**, **execution**, or **end-to-end**;
2. study question, procedure or case version, and frozen test axes;
3. retained evidence paths and completeness;
4. destination audience and visibility;
5. lane identities, validity status, budgets, interventions, terminal state, and cleanup;
6. case count, attempt count, and any repeated-run determinism contract;
7. whether a scoring rubric or winner rule was frozen before the run; and
8. judge protocol, model/version, masking, repetitions, and disagreement handling.

Do not combine elicitation and execution evidence into one outcome claim merely because they share a mission or product. An end-to-end claim requires the explicit traceability procedure below and separate validity for both stages.

## Evidence order

Analyze in this order:

1. **Study design:** question, test axes, cases, sample size, rubric, and judge protocol.
2. **Provenance:** frozen input, run id, versions, and evidence identity.
3. **Validity:** protocol compliance, contamination, budget, intervention, and cleanup.
4. **Common outcome evidence:** signals available under the same contract to every lane.
5. **Process evidence:** target-visible conduct and configuration.
6. **Lane-only diagnostics:** useful for explanation, never common scoring.
7. **Interpretation:** bounded findings, limitations, and recommendations.

An invalid or failed attempt remains evidence. Never erase it, repair its artifact, or silently replace it with a cleaner attempt.

## Select the procedure

For planned campaigns, multi-case reports, judging, or repeat-run claims, first read [Evaluation strategy](references/evaluation-strategy.md).

### Elicitation comparison

Read [Elicitation comparisons](references/elicitation-comparisons.md).

First distinguish:

- approachable operator workflow with a shared top-level actor; or
- rigorous campaign with fresh actors, matched budgets, reveal policy, and explicit validity rules.

Compare the private baseline only in an operator-authorized report. For each lane, keep harness-visible framing and interaction separate from the target-authored document and operator interpretation.

### Execution comparison

Read [Execution comparisons](references/execution-comparisons.md).

Use the frozen public case plus immutable `ExecutionAttempt`, masked-outcome, and unblinded-process artifacts. Common claims use only evidence available to every lane. Treat Brunch Petri, JSONL, graph, and debug material as lane-only diagnostics.

Never publish controller-only oracle definitions, exact hidden fixtures, expected states, selector mappings, or reveal material. Report aggregate hidden-oracle outcomes and portable artifact references only.

### End-to-end comparison

Read [End-to-end comparisons](references/end-to-end-comparisons.md).

Use a requirement traceability ledger to connect the frozen baseline, target-visible elicitation, unchanged approved specification, implementation, and verification result. Keep elicitation validity and execution validity separate. Report whether a requirement was elicited, inferred, implemented, and verified; do not treat one matched pair as proof that elicitation quality caused the output difference.

## Classify issues

Use these categories explicitly:

- **Implementation:** a reproducible defect in product or harness code.
- **Runtime:** provider, process, terminal, environment, or lifecycle behavior observed during the run.
- **Protocol:** the actor, operator, budget, intervention, isolation, or evidence procedure was not followed.
- **Validity consequence:** what the preceding facts permit the comparison to claim.

Do not label a contaminated outcome as an implementation defect unless independent evidence identifies a code cause.

## Report shape

Use the general report grammar:

1. **Overview**
   - **Problem**
   - **Result**
   - **Confidence**
2. **Study design**
   - question, test axes, cases, and sample size
   - rubric, judge protocol, and winner rule
3. **Run identity and comparison kind**
4. **Validity before outcomes**
5. **Outcome by lane**
6. **Determinism evidence** when repeated runs were planned
7. **Requirement traceability** for end-to-end comparisons
8. **Comparative findings**
9. **Issue classification**
10. **Evidence**
11. **Limitations**
12. **Recommendations**
13. **Supporting material**

State “not assessable” when a common metric is unavailable. Do not infer parity from missing data.

## Judgment rules

- No winner or broad benchmark claim without a predeclared rubric and valid comparable lanes.
- Blinded outcome judgment must stay independent of unblinded process explanation.
- Preserve the exact judge prompt, model/version, masked input order, raw judgments, and disagreement disposition.
- Report objective measurements separately from rubric-scored judgments.
- A polished document does not compensate for a mission-breaking or case-breaking result.
- A successful lane in a contaminated pair can remain a useful product witness, but not comparative proof.
- Repeated-run procedure similarity and output similarity are separate claims; neither establishes broad determinism without the frozen equivalence rule and adequate sample.
- Recommendations must name whether they address implementation, runtime integration, protocol enforcement, or study design.

## References

- [Evaluation strategy](references/evaluation-strategy.md)
- [Elicitation comparisons](references/elicitation-comparisons.md)
- [Execution comparisons](references/execution-comparisons.md)
- [End-to-end comparisons](references/end-to-end-comparisons.md)
- [Report examples](references/report-examples.md)

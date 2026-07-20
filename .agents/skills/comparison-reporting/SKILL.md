---
name: comparison-reporting
description: Analyze and report cross-harness elicitation or execution comparisons with validity, contamination, evidence, and redaction discipline. Use when summarizing comparison transcripts, attempt packets, benchmark results, harness outcomes, or publishing those findings to Notion.
---

# Comparison Reporting

Interpret retained comparison evidence before presenting it. Report validity before outcome quality, and keep presentation concerns separate from evidence policy.

When publishing to Notion, also load [Notion reporting](../notion-reporting/SKILL.md) for mutation safety and Notion formatting only. This skill owns comparison evidence policy and report grammar: keep the validity-first shape below instead of substituting Notion reporting's generic report shape.

## Inputs

Resolve:

1. comparison kind: **elicitation** or **execution**;
2. procedure or case version;
3. retained evidence paths and completeness;
4. destination audience and visibility;
5. lane identities, validity status, budgets, interventions, terminal state, and cleanup; and
6. whether a scoring rubric or winner rule was frozen before the run.

Do not combine elicitation and execution evidence into one outcome claim merely because they share a mission or product.

## Evidence order

Analyze in this order:

1. **Provenance:** frozen input, run id, versions, and evidence identity.
2. **Validity:** protocol compliance, contamination, budget, intervention, and cleanup.
3. **Common outcome evidence:** signals available under the same contract to every lane.
4. **Process evidence:** target-visible conduct and configuration.
5. **Lane-only diagnostics:** useful for explanation, never common scoring.
6. **Interpretation:** bounded findings, limitations, and recommendations.

An invalid or failed attempt remains evidence. Never erase it, repair its artifact, or silently replace it with a cleaner attempt.

## Select the procedure

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
2. **Run identity and comparison kind**
3. **Validity before outcomes**
4. **Outcome by lane**
5. **Comparative findings**
6. **Issue classification**
7. **Evidence**
8. **Limitations**
9. **Recommendations**
10. **Supporting material**

State “not assessable” when a common metric is unavailable. Do not infer parity from missing data.

## Judgment rules

- No winner or broad benchmark claim without a predeclared rubric and valid comparable lanes.
- Blinded outcome judgment must stay independent of unblinded process explanation.
- A polished document does not compensate for a mission-breaking or case-breaking result.
- A successful lane in a contaminated pair can remain a useful product witness, but not comparative proof.
- Recommendations must name whether they address implementation, runtime integration, protocol enforcement, or study design.

## References

- [Elicitation comparisons](references/elicitation-comparisons.md)
- [Execution comparisons](references/execution-comparisons.md)
- [Report examples](references/report-examples.md)

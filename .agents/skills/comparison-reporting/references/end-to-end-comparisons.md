# End-to-end comparisons

Use this procedure only when the study explicitly asks whether elicitation differences survive the handoff into implementation. Sharing a mission is not enough: the approved specification must become the frozen execution input without silent repair.

## Validity chain

Judge each stage independently:

1. elicitation lane validity;
2. unchanged approved specification and handoff identity;
3. execution lane validity; and
4. requirement-level output evidence.

The overall end-to-end result is valid only when both stages are valid and the approved artifact is the exact frozen execution input. A contaminated elicitation may remain an interaction witness; an invalid execution may remain process evidence. Neither supports an end-to-end outcome ranking.

## Build the requirement traceability ledger

Use one row per atomic requirement or acceptance criterion. Record:

- stable requirement id and public wording;
- whether it existed in the private baseline;
- whether each lane elicited explicitly, omitted it, or contradicted it;
- whether the approved specification carried it into execution;
- whether the implementation satisfied, violated, or did not expose it;
- verification status and common evidence reference; and
- assessment: explicit-and-implemented, explicit-but-missed, unelicited-but-inferred, unelicited-and-missed, contradicted, or `not_assessable`.

“Inferred correctly” requires output evidence satisfying the same public criterion; plausible code or judge intuition is insufficient. Keep controller-only reveal details out of the ledger.

## Compare without causal overreach

Report:

- requirements both systems elicited and implemented;
- requirements one system elicited that the other implementation inferred correctly anyway;
- requirements explicit in one approved specification but absent or wrong in the other output;
- explicit requirements that still failed during execution; and
- withheld concerns surfaced only by the unchanged common oracle.

This supports a case-level association between elicitation coverage and implementation outcome. It does not by itself prove that structured elicitation caused the difference. Causal language requires a predeclared multi-case design that controls execution conditions and has enough valid attempts to rule out lane, model, runtime, and implementation variance.

## Report shape

Include:

1. end-to-end study question and frozen handoff identity;
2. validity by stage and lane;
3. requirement traceability summary;
4. notable explicit, inferred, missed, and contradicted requirements;
5. output verification evidence;
6. limitations and sample size; and
7. bounded recommendation for elicitation, execution, or study design.

Do not collapse elicitation and execution scores into one number unless the aggregation and winner rule were frozen before the campaign.


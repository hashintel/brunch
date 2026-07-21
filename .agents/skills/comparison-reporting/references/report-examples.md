# Comparison report examples

These examples demonstrate classification and evidence boundaries. Replace every conclusion with facts from the current run.

## Elicitation: contaminated pair, useful witness

Evidence:

- the workflow retained a private mission, visible transcripts, and unchanged documents;
- one lane stayed mission-aligned;
- a human takeover supplied substantive answers to the other lane;
- that lane's final document contradicted the mission; and
- a title-input defect has an independent code explanation.

Report excerpt:

```markdown
**Problem:** A substantive takeover changed one lane's answers, so the two documents were not produced under equivalent actor conditions.

**Result:** The clean lane remains a useful elicitation witness. The pair is contaminated and does not support a comparative benchmark claim.

**Issue classification**
- Protocol: substantive takeover violated the sole simulated-user boundary.
- Runtime: the affected session ended before the correction reached the artifact.
- Implementation: input sanitization retained terminal control-sequence residue in the title.
- Validity: outcome ranking is not supported.
```

This wording does not turn operator contamination into an elicitation-code defect.

## Execution: valid failure

Evidence:

- immutable attempt status is `valid`;
- terminal outcome is `failure`;
- build passed;
- browser oracle failed an aggregate public accessibility requirement;
- cleanup is clean;
- cost is `not_assessable`; and
- exact hidden fixtures remain controller-only.

Report excerpt:

```markdown
**Problem:** The implementation completed its build but did not satisfy the frozen public accessibility contract under the unchanged controller suite.

**Result:** This is a valid failed attempt and remains common outcome evidence. Cleanup completed. Cost is not assessable.

**Evidence**
- Public packet hash: [hash]
- Build: passed
- Browser oracle: failed — public accessibility-name contract
- Final tree and diff: [portable artifact references]

**Limitations**
- One case does not establish broad product reliability.
- Hidden fixtures and exact oracle journeys are intentionally omitted.
```

The common report does not include Brunch-only Petri or JSONL diagnostics.

## Execution: invalid attempt

Evidence:

- substantive human intervention occurred;
- attempt validity is `invalid`;
- an output artifact exists; and
- the replacement run, if any, has a different attempt id.

Report excerpt:

```markdown
**Result:** Invalid and retained. The artifact may explain process behavior but is excluded from masked outcome comparison.

**Validity reason:** Substantive human intervention violated the frozen attempt contract.

**Supporting material:** [immutable attempt reference]
```

Never overwrite this attempt with its replacement.

## Determinism: bounded repeat campaign

Evidence:

- three valid runs used the same frozen case, versions, budgets, and intervention policy;
- the predeclared canonical transition and action sequence matched in all three runs;
- generated trees differed in private helper structure but satisfied the same public contract; and
- no common output-similarity score was frozen.

Report excerpt:

```markdown
**Result:** The orchestrator's canonical procedure matched across 3/3 valid attempts under the frozen equivalence rule. Generated output was behaviorally conformant but not structurally identical.

**Confidence:** Directional evidence for this case and configuration. Three attempts do not establish broad execution determinism.

**Limitations:** Output similarity is descriptive because no common structural-similarity rubric was frozen before the campaign.
```

This distinguishes deterministic orchestration from deterministic generated code.

## End-to-end: requirement traceability

Evidence:

- both elicitation and execution stages were valid;
- the approved specifications were frozen unchanged as execution inputs;
- the private baseline contained requirement `AC7`; this audience receives only that opaque id and its aggregate public outcome;
- lane A elicited `AC7` and implemented it;
- lane B omitted `AC7`, but its output inferred and satisfied the same public criterion; and
- the unchanged common oracle passed both outputs.

Report excerpt:

```markdown
**Result:** AC7 does not distinguish the two end-to-end outcomes in this case. Lane A elicited and implemented it; lane B omitted it from the specification but inferred correctly during implementation.

**Traceability**
- Lane A: elicited explicitly → carried into frozen spec → implemented → verified.
- Lane B: not elicited → absent from frozen spec → inferred during implementation → verified.

**Validity consequence:** This row shows no observed implementation benefit from explicit elicitation for AC7. It does not establish that elicitation is generally redundant.
```

The requirement row supports a bounded case finding, not a causal benchmark claim.

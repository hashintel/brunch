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

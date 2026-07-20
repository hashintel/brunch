# Report shapes

Choose the smallest shape that answers the reader's question.

## Full findings report

```markdown
<callout icon="🔎" color="gray_bg">
	**Overview**
	**Problem:** [Why this was investigated.]
	**Result:** [What the evidence establishes.]
	**Confidence:** [Conclusive, directional, contaminated, or incomplete—and why.]
</callout>

# Findings
- **[Finding]:** [Evidence-backed explanation.]

## Evidence
- [Artifact, page, run id, URL, or file and line range.]

## Limitations
- [Missing evidence, contamination, sample limit, or unresolved ambiguity.]

## Recommendations
- [Action tied to a finding.]

## Supporting material
- [Links to detailed pages or immutable artifacts.]
```

## Compact side note

```markdown
<callout icon="📝" color="blue_bg">
	**Side note — [Topic]**
	[One-sentence conclusion.]
	**Problem:** [Observed issue.]
	**Result:** [Effect or disposition.]
	**Evidence:** [Direct reference.]
</callout>
```

## Status update

```markdown
## Status
**Result:** [Current outcome.]
- Completed: [verified work]
- Blocked: [definitive blocker]
- Next: [owned action and re-entry condition]
```

## Worked example

Source evidence:

- a tool workflow completed and retained its artifacts;
- one lane required human intervention;
- the resulting cross-lane comparison is contaminated;
- one formatting defect has a code-level cause.

Report:

```markdown
<callout icon="🔎" color="gray_bg">
	**Overview**
	**Problem:** Human intervention changed one lane's inputs, so the outputs were produced under different conditions.
	**Result:** The workflow and clean lane remain useful witnesses, but the run does not support a comparative benchmark claim.
	**Confidence:** Directional; the contamination is recorded and the implementation defect has direct code evidence.
</callout>

# Findings
- **Workflow:** artifact creation and retention completed.
- **Validity:** the intervened lane is contaminated.
- **Implementation:** the formatting defect has a reproducible code path.

## Evidence
- Retained transcript and final artifact.
- Intervention record.
- Source file and line range for the formatting defect.

## Limitations
- One run cannot establish general product performance.

## Recommendations
- Rerun the contaminated lane under the frozen protocol.
```

The example demonstrates structure only. Do not reuse its conclusions without matching evidence.

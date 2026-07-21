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

- a scheduled export failed;
- the job log and output artifact were retained;
- a malformed date setting caused the failure; and
- a corrected retry completed successfully.

Report:

```markdown
<callout icon="🔎" color="gray_bg">
	**Overview**
	**Problem:** The scheduled export failed before producing its daily file.
	**Result:** Correcting the malformed date setting restored the export on retry.
	**Confidence:** Conclusive for this incident; the failed and successful job logs show the configuration change and outcome.
</callout>

# Findings
- **Failure:** the original job rejected the configured date value.
- **Recovery:** the corrected retry produced the expected artifact.

## Evidence
- Failed and successful job logs.
- Retained output artifact from the retry.
- Configuration revision history.

## Limitations
- This report covers one scheduled export and does not establish broader service reliability.

## Recommendations
- Validate date settings when schedules are saved.
```

The example demonstrates structure only. Do not reuse its conclusions without matching evidence.

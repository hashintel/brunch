---
name: notion-reporting
description: Write, revise, and verify structured reports in Notion. Use when the user asks to create a Notion report, summarize findings on a Notion page, add an overview or side note, or turn evidence into a readable stakeholder document.
---

# Notion Reporting

Turn supplied evidence into a concise, source-grounded Notion report and publish it with the smallest safe mutation.

## Inputs

Resolve before writing:

1. target page or parent URL;
2. source evidence and whether it is complete;
3. intended audience and visibility;
4. create, append, or revise intent; and
5. any exact wording the user supplied.

Ask only when a missing answer would change the destination, confidentiality, or destructive effect. Preserve user-provided wording verbatim when requested.

## Workflow

### 1. Discover the live Notion surface

Use MCP tool discovery before invoking a Notion tool. Fetch the target page before editing it. If advanced Notion blocks are needed, read the live enhanced-Markdown resource rather than inventing syntax from memory.

### 2. Separate evidence from interpretation

Identify:

- verified facts supported by the supplied evidence;
- interpretations or classifications;
- limitations, missing evidence, and uncertainty; and
- recommendations or next actions.

Do not convert an observation into a causal claim, score, or general conclusion without evidence.

### 3. Draft top-down

Default to this order:

1. **Overview**
   - **Problem:** what prompted the report.
   - **Result:** what happened or what the evidence establishes.
   - **Confidence:** whether the result is conclusive, directional, contaminated, or incomplete.
2. **Findings**
3. **Evidence**
4. **Limitations**
5. **Recommendations or next steps**
6. **Supporting material**

Use only the sections that help the reader. Put the decision-relevant result before chronology.

### 4. Edit safely

Prefer the smallest safe mutation:

- use a targeted content update for an existing section;
- append or prepend when the user asks for a new section;
- use full-page replacement only when explicitly required and after preserving every child page and database reference.

Never overwrite, move, or delete child pages or databases incidentally. Never silently duplicate an existing report section.

### 5. Verify the result

Fetch the page again after every write. Confirm:

- the intended content is present once;
- placement and Notion formatting are correct;
- existing sections and child content remain;
- links and citations still resolve; and
- no sensitive evidence crossed the intended audience boundary.

Report completion only after this verification.

## Writing rules

- Lead with outcomes, not process narration.
- Prefer short paragraphs and compact bullets.
- Name evidence paths, URLs, dates, run ids, or line ranges when available.
- Distinguish verified facts from interpretations, limitations, and recommendations.
- Use a callout for a compact overview or side note, not for the whole report.
- Avoid decorative tables when a short list is clearer.
- Do not hide caveats in a footnote or supporting page.

## References

- [Notion edit safety](references/notion-edit-safety.md)
- [Report shapes](references/report-shapes.md)

# Round-One Judgment Prompt Pack

Version: `round-one-v1`

Run two separate manual judgments. The **outcome pass** sees identity-masked final documents only; the **process pass** sees normalized, explicitly unblinded target-visible interactions. Do not blend their evidence or verdicts.

Dora is the final adjudicator. Model judgments are evidence-referenced drafts, not comparison authority.

## Common execution rules

For each pass, retain in the promoted judgment bundle:

- this exact prompt/rubric version;
- the complete input packet as presented to the model;
- the model/provider/configuration and full unedited model output; and
- Dora's criterion-level agreement, disagreement, correction, and final interpretation.

The judge must use only its pass's packet. Exclude private reveal-key contents except the outcome packet's lane-neutral coverage checklist described below; exclude controller paths, private target internals, model reasoning, tool traces, Brunch JSONL/debug/trajectory enrichment, and any diagnostic evidence unavailable for every lane.

## Pass 1: identity-masked outcome judgment

### Assemble the packet

1. Copy each final target-authored specification without rewriting substantive content.
2. Remove explicit product names and product-identifying file metadata where removal does not alter the specification.
3. Assign randomly ordered labels `A`, `B`, and optionally `C`; store the label mapping outside the judge packet.
4. Include only label-level metadata shared by all lanes: mission id, public mission, ready-document definition, budget-exhausted/ready status, and the final document.
5. Add a lane-neutral consequential-fact coverage checklist containing fact ids and the expected requirement implications needed for scoring, not target identity, reveal history, controller paths, or lane-specific diagnostics.
6. Have a second person or deliberate review pass confirm no label mapping or product metadata remains.

This is **label blinding, not style anonymity**. Prose, structure, or product vocabulary may still suggest a source; the judge must record suspected identity only as uncertainty and must not use it as evidence.

### Outcome prompt

```text
You are judging product-neutral specification outcomes. Treat every lane label as opaque.
Use only the supplied public mission, ready definition, lane-neutral consequential-fact checklist,
shared status metadata, and final documents. Do not infer or reward product identity, hidden target
internals, interaction process, or evidence not in this packet.

For each document and each criterion below:
1. return a verdict: strong / adequate / weak / not assessable;
2. explain the verdict with one or more exact quotations and section references;
3. name material omissions, contradictions, or unsupported inventions;
4. state uncertainty and what supplied evidence limits the judgment.

Criteria:
- completeness: coverage of the mission's users, problem, scope, requirements, constraints, and ready definition;
- withheld-fact coverage: whether every consequential implication in the lane-neutral checklist is reflected accurately, without rewarding access method;
- recommendation quality: actionable, justified choices and honest treatment of tradeoffs or unresolved decisions;
- detail: enough precision for review and downstream work without invented certainty;
- consistency: compatible requirements, terms, assumptions, and recommendations across the document;
- useful structure: organization makes commitments, rationale, constraints, and open questions easy to find and use.

Then provide:
- a criterion-by-lane table;
- an overall comparison that does not erase criterion-level tradeoffs;
- any suspected source-style cues, explicitly excluded from scoring;
- confidence and the closest plausible rival interpretation.
Do not produce a winner when the supplied evidence does not support one.
```

## Pass 2: unblinded normalized process judgment

### Assemble the packet

1. Use each retained target-visible interaction record; name the product/lane explicitly.
2. Normalize field names and ordering only: timestamp/elapsed time, speaker, visible question/action, visible response, qualification/reveal decision, budget debit, intervention, readiness action, and validity/status.
3. Preserve visible wording, sequence, menus, retries, and product chrome needed to interpret conduct. Do not summarize away meaning.
4. Include the common public mission, matched budgets, reveal-condition identifiers and qualification decisions, final ready/exhausted status, and declared mechanical interventions.
5. Exclude private fact values that were never visibly revealed, private target internals, model reasoning, and Brunch-only JSONL/debug/trajectory enrichment.
6. Verify every normalized row points back to a retained visible record and that no lane received richer diagnostic context.

Process judging is intentionally unblinded: product chrome and interaction vocabulary are evidence. Normalize fields, not meaning.

### Process prompt

```text
You are judging the visible elicitation process of explicitly named products. This pass is unblinded.
Use only the supplied public mission, matched budgets, normalized target-visible interactions,
qualification/reveal records, interventions, and final status. Do not inspect or infer private target
internals, hidden reasoning, unrevealed fact values, or Brunch-only diagnostics.

For each lane and each criterion below:
1. return a verdict: strong / adequate / weak / not assessable;
2. cite exact visible questions, responses, actions, and ledger rows;
3. distinguish observed conduct from inference;
4. state uncertainty and any validity or normalization limitation.

Criteria:
- question count and materiality: number of questions and whether each could materially change the specification;
- non-inferable-fact seeking: whether questions sought consequential information absent from the public brief rather than cheaply inferable context or already answered material;
- budget use: whether question, turn, elapsed-time, and intervention budgets were used efficiently and obeyed;
- readiness behavior: whether the target sought enough information, handled uncertainty honestly, authored the named document, and stopped at ready or budget exhaustion without premature or endless iteration.

Then provide:
- a criterion-by-lane table with quoted evidence;
- notable process tradeoffs without converting them into an outcome score;
- validity concerns and their likely effect;
- confidence and the closest plausible rival interpretation.
Do not use final-document polish as a substitute for process evidence.
```

## Dora adjudication record

After both model outputs are retained, Dora records separately for every criterion:

```yaml
pass: outcome | process
criterion: <name>
model_assessment: <brief faithful summary>
dora_disposition: agree | disagree | partly-agree | not-assessable
evidence: <quoted packet references>
reason: <why, including corrections or rival interpretation>
final_interpretation: <Dora-owned conclusion>
```

Keep outcome and process conclusions separate before writing any overall interpretation. If invalidity or missing evidence prevents a conclusion, say so rather than repairing the run through judgment.

## Ceiling

A single Claude-family judge is acceptable for this one manual round, but possible affinity with the Claude Code lane is a declared ceiling—not evidence of neutrality. Upgrade to calibrated or multiple judges only when run volume or material model/Dora disagreement triggers the frontier's owned follow-on. Until then, preserve exact prompts, packets, outputs, and adjudication so readers can inspect the limitation.

# Dora adjudication — lockers-r1-20260716

Dora is the final adjudicator; the model drafts (`outcome-draft.md`,
`process-draft.md`) are evidence-referenced drafts, not comparison authority. Fill
one block per criterion per pass. Keep outcome and process conclusions separate
before writing any overall interpretation. If invalidity or missing evidence
prevents a conclusion, say so rather than repairing the run through judgment.

Reminder before starting: the outcome pass was label-masked (`A`/`B`); consult
`label-mapping.md` only AFTER recording your outcome dispositions if you want to
preserve your own blinding.

## Outcome pass

```yaml
pass: outcome
criterion: completeness
model_assessment: 'A strong (dedicated section per ready_when element); B weak (no recommendations; one-sentence pickup flow)'
dora_disposition: # agree | disagree | partly-agree | not-assessable
evidence:
reason:
final_interpretation:
```

```yaml
pass: outcome
criterion: withheld-fact coverage
model_assessment: 'both adequate, complementary failures: B captures all 4 supplied facts but drops accessibility/outdoor implications and budget-vendor record; A misses pilot-scale entirely but develops all implications of its 3 facts'
dora_disposition:
evidence:
reason:
final_interpretation:
```

```yaml
pass: outcome
criterion: recommendation quality
model_assessment: 'A strong (six sequenced, justified recommendations); B weak (none; deferrals only)'
dora_disposition:
evidence:
reason:
final_interpretation:
```

```yaml
pass: outcome
criterion: detail
model_assessment: 'A strong (failure paths, privacy/audit, no invented certainty); B adequate (precise on facts, nothing beyond them)'
dora_disposition:
evidence:
reason:
final_interpretation:
```

```yaml
pass: outcome
criterion: consistency
model_assessment: 'A strong; B adequate (any-hour access asserted beyond supplied facts; "basis: explicit" annotation strain)'
dora_disposition:
evidence:
reason:
final_interpretation:
```

```yaml
pass: outcome
criterion: useful structure
model_assessment: 'A strong (cross-reference web); B adequate (auditable atoms, no narrative connective tissue)'
dora_disposition:
evidence:
reason:
final_interpretation:
```

## Process pass

```yaml
pass: process
criterion: question count and materiality
model_assessment: 'Brunch strong (5 asks over 2 rounds, 4 reveal conditions hit); Claude adequate (one 3-part form, one slot spent on brief-inferable scope)'
dora_disposition:
evidence:
reason:
final_interpretation:
```

```yaml
pass: process
criterion: non-inferable-fact seeking
model_assessment: 'Brunch strong (4/5 conditions + 2 consequential no-fact probes); Claude adequate (2/5; declared gaps honestly but never probed pilot-scale)'
dora_disposition:
evidence:
reason:
final_interpretation:
```

```yaml
pass: process
criterion: budget use
model_assessment: 'Brunch adequate (4 facts vs 3-question budget via compound crediting — declared normalization, no target gaming); Claude strong (announced strategy, 4/8 turns, ~11/20 min; sole intervention was actor-caused)'
dora_disposition:
evidence:
reason:
final_interpretation:
```

```yaml
pass: process
criterion: readiness behavior
model_assessment: 'both strong; Brunch caveat: document produced via actor-run export seam post-kill; Claude caveat: proceeded to ready with pilot-scale never probed but declared the gap'
dora_disposition:
evidence:
reason:
final_interpretation:
```

## Overall interpretation (write last, after both passes)

<!-- Dora-owned. Note: both judge drafts flagged that the two main evidentiary
asymmetries (compound-question crediting; Claude-lane form mishap + volunteered
hold-window fact) push in opposite directions across the two passes. The prompt
pack's declared ceiling applies: single same-family judge, one manual round. -->

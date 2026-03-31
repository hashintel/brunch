---
name: ln-spike
description: "Time-boxed throwaway investigation to answer one hard question. Use when facing technical uncertainty before committing to a slice — the output is knowledge, not production code."
argument-hint: "[question to answer and what you'll try]"
---

# Dev Spike

Retire one uncertainty. Output is knowledge, not code — spike code is throwaway, never promoted directly (Beck, XP). One question per spike; if multiple unknowns exist, run multiple spikes.

## Input

The question and approach: $ARGUMENTS

## Investigate

1. State the question and what would constitute an answer.
2. Time-box the investigation. Stop when answered or exhausted.
3. Write a verdict.

## Spike Verdict

```md
## Question
[The question]

## Approach
[What was tried]

## Verdict
[Answer: yes/no/partially, with evidence]

## Recommendation
[Proceed with ln-scope, try a different approach, or abandon]
```

After the verdict:

- Update the assumption's confidence in `memory/SPEC.md` §Assumptions — retire if invalidated, promote if validated
- If the verdict produces new decisions → add to `memory/SPEC.md` §Decisions
- If the verdict surfaces new assumptions or questions → add to `memory/SPEC.md` §Assumptions
- If the verdict changes slice feasibility → update affected slices in `memory/PLAN.md`
- Mark the spike done in `memory/PLAN.md`

## Routing

After the verdict, present these options to the user (use `tool-ask-question`):

| #   | Label           | Target       | Why                                               |
| --- | --------------- | ------------ | ------------------------------------------------- |
| 1   | Scope the slice | `ln-scope`   | Question answered — ready to define the slice     |
| 2   | Spike again     | `ln-spike`   | New question emerged, needs another investigation |
| 3   | Update spec     | `ln-spec`    | Verdict requires spec-level changes               |
| 4   | Revise plan     | `ln-plan`    | Verdict changes what slices are needed            |
| 5   | Back to triage  | `ln-consult` | Verdict changes the overall direction             |

Recommended: **1** if the spike validated, **3** if it invalidated.

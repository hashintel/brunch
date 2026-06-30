---
name: elicitation
description: Ask focused questions and run the next human-facing exchange needed to move the selected spec forward. Use when the agent should acquire missing information, resolve ambiguity, or tighten the user's intent before capture or review.
---

# Elicitation

Use this skill when the best next move is to ask the user for the missing piece that would improve the selected spec.

Read [`../../contexts/about/readiness-bands.md`](../../contexts/about/readiness-bands.md) when deciding what absence means. Read [`references/question-kinds-per-intent-kind.md`](references/question-kinds-per-intent-kind.md) when you need example phrasings for a node kind.

## Procedure

```text
chain elicitation:
  current graph + gaps + latest user answer
    -> identify the smallest meaningful absence
    -> choose the node kind or relation the answer would clarify
    -> ask one focused question
    -> let capture handle graph persistence after the answer
```

Use readiness bands as signal for the next question. They do not make earlier capture illegal and they do not make later-band material self-settling.

## Do's and Don'ts

### Use It For

- Asking one focused question that reduces real uncertainty
- Resolving ambiguity between a small number of meaningful interpretations
- Moving the conversation toward information that can later be captured or reviewed
- Harmonizing advisory early outer-band signal with the inner concerns it depends on

### Do Not Use It For

- Asking a questionnaire when one discriminating question would do
- Sneaking a proposal into a question and treating it as user intent
- Continuing to ask questions when the conversation already supports a concrete capture step
- Treating a source-derived requirement, design, oracle, or plan item as settled merely because it is specific

### Working Style

1. Ask for the missing thing, not everything adjacent to it.
2. Prefer crisp distinctions over broad open-ended drift when a concrete contrast is available.
3. Keep the question anchored to the selected spec.
4. Let the user's answer become the new evidence; do not pre-interpret it as settled truth.

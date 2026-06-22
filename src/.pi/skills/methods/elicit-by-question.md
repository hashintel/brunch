# Method: elicit by question

Use this acquisition mode when the next missing material is best obtained by asking the human one focused question and letting the answer enter the transcript directly. This is the ordinary Brunch elicitation path: ask, receive, then let the capture sweep decide what becomes graph truth and what becomes agenda.

## Use when

- The current `read_elicitation_gaps` result names a concrete missing claim or orientation point.
- The human is the authority for the answer.
- The expected answer is small enough that a direct conversational reply is clearer than a paste or document read.
- You need to disambiguate among alternatives before reading or exploring more material.

## Conduct

Ask one question at a time. Prefer the question/rationale from the selected gap, adjusted only enough to fit the immediate conversation. If a structured exchange would make the response easier to submit, use the structured-exchange method; otherwise an ordinary assistant question is enough.

Do not smuggle a proposed answer into the question. The answer becomes conversational transcript content; the capture method runs after the turn and commits only high-confidence material through `mutate_graph` or maps low-confidence noticings to `elicitation_gaps`.

```pseudo
chain elicit-by-question:
  open gap or uncertainty
    -> one focused assistant question
    -> human answer in transcript
    -> capture sweep over answer
    -> next question from updated graph + gaps
```

## Anti-goals

- Do not read files or search the web just because a question could be researched; ask when the human is the source of truth.
- Do not batch unrelated questions into a questionnaire.
- Do not treat a leading question as established graph truth.
- Do not bypass the capture sweep with direct graph claims in prose.

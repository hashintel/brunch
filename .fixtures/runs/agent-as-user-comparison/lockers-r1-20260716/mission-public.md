# Mission (public packet)

```yaml
mission_id: fictional-library-lockers-v1
title: Neighborhood library pickup lockers
brief: |
  Specify a small service that lets library members collect reserved books from lockers
  outside staffed hours. Produce a review-ready specification for the library team.
ready_document:
  path: locker-pickup-spec.md
  shape: settled specification Markdown
  ready_when:
    - covers users, end-to-end pickup, scope, requirements, consequential constraints, and recommendations
    - is internally consistent and identifies unresolved uncertainty
budgets:
  qualifying_questions: 3
  target_turns: 8
  elapsed_minutes: 20
  mechanical_interventions: 1
stops:
  ready: stop after writing locker-pickup-spec.md
  exhausted: stop on the first exhausted budget and retain the best target-authored document
rules:
  - Ask for consequential missing information; do not guess it.
  - Do not invent users, constraints, facts, decisions, or evidence.
  - Treat non-answers as uncertainty, not permission to invent.
  - Work only in the target working directory and do not seek hidden comparison material.
```

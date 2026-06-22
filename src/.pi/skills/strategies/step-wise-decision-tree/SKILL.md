---
name: step-wise-decision-tree
description: "Ask one structured question at a time and branch from the answer."
---

# step-wise-decision-tree

Use this strategy to ask one structured question at a time and branch from the answer. The user should experience a clear local decision tree: one prompt, bounded response shape, then the next question chosen from what their answer made true or still unclear.

Turn structure: read the active goal and lens, inspect the pushed or pulled context, choose the single highest-value missing item, then present one typed exchange. Prefer `present_question`/`request_answer` for open text and `present_options` with `request_choice` or `request_choices` when the branch set is already known. After the response, capture only high-confidence direct statements and choose the next branch; do not batch a questionnaire.

Commitment mechanism: this is a single-exchange flow under D26-L. Graph items directly stated by the user may be captured synchronously with explicit basis; uncertain implications become follow-up questions or backlog entries.

Available graph operations are read context first, then capture/commit only through Brunch graph tools when the answer supplies clear graph truth. Use the strategy README classification guide lightly: "must" suggests requirement, "probably" suggests assumption, "picked Y over Z" suggests decision, and weak support means abstain rather than guess.

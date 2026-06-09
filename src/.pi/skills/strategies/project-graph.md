# project-graph

Use this strategy when graph material should be reviewed item-by-item before becoming truth. Your job is to derive candidate nodes and edges from existing context, dry-run them, and present a review set the user can approve, request changes on, or reject.

Turn structure: read the relevant graph context, generate candidate graph material, dry-run it through the review/proposal path, then surface only dry-run-valid material with `present_review_set` and `request_review`. Include enough rationale, grounding/support metadata, and lens labeling for the user to judge the proposal. If the user requests changes, generate a successor proposal rather than patching truth in place.

Commitment mechanism: D26-L review-set flow. Nothing is durable until review-set approval; approval commits the whole accepted set atomically through `acceptReviewSet` / CommandExecutor, and exact approved items use `basis: explicit`. Partial acceptance is not representable.

Available graph operations are read context, generate proposal, dry-run validation, and review exchange; do not call `commit_graph` directly as a shortcut. Use the same closed edge category rubric as graph commits, and abstain from proposing edges whose category cannot be justified.

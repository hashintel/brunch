# Strategy: project-graph

Generate a review-set proposal from established material. The proposal should be dry-run-valid before it reaches the user.

Approval commits the whole batch atomically. Request-changes regenerates or narrows the proposal; rejection does not create graph truth.

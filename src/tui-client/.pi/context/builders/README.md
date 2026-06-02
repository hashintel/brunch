# Brunch context builders

Builders are deterministic renderers over already-canonical state. They may later render graph, readiness, or structured-exchange snapshots into prompt context.

Builders must not query ambient Pi resources, mutate graph truth, call the `CommandExecutor`, or invent uncaptured facts. If a fact is not already canonical or explicitly supplied in the builder snapshot, do not render it as product truth.

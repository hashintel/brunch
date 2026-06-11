# read-context

Use this method when pushed prompt context is insufficient for the next elicitation move. It tells you how to sequence selected-spec reads without turning context gathering into a separate research project.

Start from the handles in the runtime prompt: selected spec, soft readiness estimate, active goal/strategy/lens, workspace posture, and any graph overview. Pull more context only when it will change the next question, proposal, capture decision, or graph write. Prefer compact overview for orientation and focused node neighborhoods for a specific claim or projected code.

Use read-only context tools such as `read_graph` and `read_session_context` where available. Keep graph truth distinct from active-context projections: accepted records are truth, while rendered summaries are orientation. If the user mentions a node code, resolve it through the product read path rather than guessing from memory.

Compose this before `generate-proposal`, `commit-graph`, and topology-driven lens questions. Out of scope: filesystem exploration unrelated to the selected spec, direct DB inspection, or treating stale prompt context as proof when a fresh graph read is needed.

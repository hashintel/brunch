# agents/contexts/exchanges/ — structured-exchange result text

SPEC decisions: D13-L, D84-L, D96-L

Owns model-facing text for structured-exchange tool results (`present_*` and `request_*`). Pi exchange adapters own schemas, registration, and TUI collection; this directory formats the returned text that becomes tool-result context.

`present_review_set` renders role-named edge drafts as plain-language relations (for example, `req-1 bounds goal-1`) rather than raw structural arrows; the role-named payload remains the proposal grammar, while model-facing text uses the graph label projection.

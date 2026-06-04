# Method: infer-and-capture

After an exchange, extract only high-confidence facts that are directly supported by the transcript. Low-confidence implications become follow-up questions or notes, not graph truth.

Capture must target the selected spec and route through Brunch-owned mutation surfaces.

Capture-analysis constraints:

- `capture_*` follows `request_*`; capture is transcript-native analysis, not graph mutation, and analyzes a completed exchange rather than creating graph truth by itself.
- For candidate selection, consume the selected candidate `user_rubric`, selected candidate `meta_rubric`, selected candidate `graph_refs`, and the user's `comment` when present.
- Do not invent final graph payloads, LSNs, or `CommandExecutor` result shapes in capture analysis.
- Future graph writes must route through `CommandExecutor`; capture analysis must never imply a graph bypass.

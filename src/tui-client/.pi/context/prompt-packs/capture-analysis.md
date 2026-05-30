# Capture analysis

- `capture_*` follows `request_*`.
- For candidate selection, capture consumes the selected candidate `user_rubric`, selected candidate `meta_rubric`, selected candidate `graph_refs`, and the user's `comment` if present.
- Capture is transcript-native analysis, not graph mutation.
- Do not invent final graph payloads, LSNs, or `CommandExecutor` result shapes in this prompt pack.
- Future graph writes must route through `CommandExecutor`; this pack must not imply a bypass.

# agents/contexts/session/ — live-session context text

SPEC decisions: D40-L, D45-L, D60-L, D83-L

Owns reusable model-facing session context fragments, currently the runtime-frame render and shared soft-readiness estimate. Transcript debug/report text is human/product debug output owned by `src/session/transcript-markdown.ts`, not agent context.

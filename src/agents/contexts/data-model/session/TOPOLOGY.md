# agents/contexts/data-model/session/ — live-session context text

SPEC decisions: D40-L, D45-L, D60-L, D83-L

Owns reusable model-facing session context fragments, currently only the runtime-frame render. There is no readiness-estimate render here: `readiness-estimate.ts` was deleted (D45-L, I31-L, `elicitation-gap-guidance` frontier) with the count-based readiness model it served. Transcript debug/report text is human/product debug output owned by `src/session/transcript-markdown.ts`, not agent context.

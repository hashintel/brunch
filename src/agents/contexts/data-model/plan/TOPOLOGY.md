# agents/contexts/data-model/plan/ — plan document output

SPEC decisions: D60-L, D83-L

Owns thin model-facing/document-output rendering for plan-plane graph nodes. This is graph-derived markdown output (`milestone`, `frontier`, `scope`) and is not a copy of `memory/PLAN.md`. Future web/download routes consume this renderer; they do not own plan text formatting. D123-L makes `scope` the canonical reviewed specification-to-execution handoff; runtime slices remain executor-derived.

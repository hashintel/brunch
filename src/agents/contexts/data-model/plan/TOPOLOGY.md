# agents/contexts/data-model/plan/ — plan document output

SPEC decisions: D60-L, D83-L

Owns thin model-facing/document-output rendering for plan-plane graph nodes. This is graph-derived markdown output (`milestone`, `frontier`, `scope`) and is not a copy of `memory/PLAN.md`. Future web/download routes consume this renderer; they do not own plan text formatting. The current `scope` support is a proving tracer for the specification-to-execution handoff; it exists in code before the wider planning-process model is promoted into canonical `memory/PLAN.md` / `memory/SPEC.md` truth.

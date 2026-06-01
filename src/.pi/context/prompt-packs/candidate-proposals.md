# Candidate proposals

- Internally reason using the D31-L meta-rubric axes: `legibility_cost_of_knowing`, `failure_modes`, `coverage_range`, and `commitment`.
- Derive user-facing `present_candidates` fields: `core_bet`, `best_fit`, `cost_complexity`, `covers_well`, `main_risks`, `lock_in_constraints`, and optional `recommendation`.
- `core_bet` is the candidate headline or thesis.
- Avoid fake low/medium/high scalar ratings for cost, risk, confidence, timeline, or verification.
- `graph_refs` are per-candidate and strictly existing graph node references: `{ node_id: string }` only.
- Do not add ad-hoc assumptions, caveats, observations, or grounding prose to `graph_refs`.
- `present_candidates` does not generate graph truth; it records user-facing comparison plus persisted meta-rubric reasoning trace for later capture.

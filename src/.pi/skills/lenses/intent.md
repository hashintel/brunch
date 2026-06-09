# intent

Use this lens when the conversation is about what the product/spec means: goals, thesis/context, terms, requirements, assumptions, constraints, invariants, decisions, criteria, and examples. The plane focus is intent; design and oracle material may appear only as support or downstream consequence.

Favor graph kinds and edges that clarify claim shape. Goals should derive requirements; assumptions with high fanout should be validated or downgraded; decisions should name rejected alternatives and rationale; constraints should bind a target through boundary edges; examples should illustrate or challenge requirements. Proof/support edges may be noted when evidence is already present, but do not turn verification planning into the center of this lens.

Interpretation rule: translate user language into the smallest honest intent claim. "Must" often points to requirement, "probably" to assumption, "we picked" to decision, "always true" to invariant, and concrete cases to examples. If the category support is weak, ask a disambiguating question rather than guessing.

Topology-driven next questions: look for goals with no derived requirements, requirements with no examples, decisions with empty rejected alternatives, and conflicting boundaries. Ask about the most graph-shaping absence first.

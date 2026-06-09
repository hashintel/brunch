# step-wise-disambiguate

Use this strategy when several plausible meanings would lead to different graph truth. Your job is to collapse ambiguity with contrastive examples instead of asking the user to define terms in the abstract.

Turn structure: name the ambiguity, offer two or three concrete interpretations, and ask the user which example is closer or what distinction is missing. Each option should differ on one graph-relevant axis: requirement vs constraint, assumption vs decision, goal vs success criterion, design boundary vs implementation preference, or proof vs example. Use `present_options` when the alternatives are crisp; use `present_question` when the user needs to rewrite the distinction.

Commitment mechanism: this remains a single-exchange flow. The chosen contrast can be captured as explicit graph truth only when the user's answer states or approves the exact claim. Otherwise, use it to refine the next question.

Available graph operations are context reads, then capture after the answer. Do not call `commit_graph` for a whole generated subgraph in this strategy. For category selection, treat contrastive signal phrases as evidence, not proof: if the user says "we don't care about X," test constraint vs negative example; if they say "we chose Y because," test decision with rejected alternatives.

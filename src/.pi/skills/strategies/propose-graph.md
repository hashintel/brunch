# propose-graph

Use this strategy when the user has accepted a concept-level direction and a coherent new subgraph would be more useful than one more question. Your job is to offer the concept, get user acceptance of that concept, then materialize the graph through Brunch graph tools.

Turn structure: read selected-spec context, summarize the proposed concept in user language, state the expected graph shape at a high level, and ask for acceptance, changes, or rejection. Once accepted, generate one `mutate_graph` batch with `create_node` and role-named `create_edge` ops that fit the accepted concept. Keep retries internal when structural diagnostics say the batch is illegal.

Commitment mechanism: D26-L direct commit. The user accepts the concept, not every node and edge, so created graph items use `basis: implicit` under D63-L. Do not present this as item-level explicit approval and do not use review-set approval language.

Available graph operations: `read_graph` for context and existing projected codes; `mutate_graph` for one atomic create-only batch with intra-batch refs and existing-node refs. Category rubric: dependency for prerequisite/blocks, proof for evidence-to-claim with stance, support for weaker argumentative support, realization for implementation/design fulfillment, boundary for constraints on targets, composition for part-whole, association for loose relation, supersession for replacement.

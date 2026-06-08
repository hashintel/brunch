# review-for-gaps

Use this method to inspect accepted or proposed commitments for missing support, contradictions, and verification debt. It is a review pass over graph meaning, not a license to rewrite the graph by yourself.

Sequence the review from the active lens. For intent, look for goals with no requirements, requirements with no examples, assumptions with high fanout, decisions without rejected alternatives, and conflicting boundaries. For design, look for unclear ownership, unbacked realization edges, and dependency direction that contradicts the stated module boundary. For oracle, look for claims without proof, criteria without targets, and obligations without evidence.

Invoke context reads first, then either ask a single clarifying question, generate a review-set proposal if item-level approval is needed, or record a gap through the product substrate when the current tools expose one. If the gap is merely a question for the user, keep it prospective; if it is a contradiction in accepted graph truth, route it toward reconciliation.

Compose with `read-context` and, when proposing repairs, `generate-proposal`. Out of scope: inventing new truth to close the gap, adding broad audit frameworks, or silently downgrading accepted commitments.

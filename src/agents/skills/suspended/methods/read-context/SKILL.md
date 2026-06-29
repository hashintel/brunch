---
name: read-context
description: "Use pushed context handles and read-only context tools for selected-spec context."
---

# read-context

Use this method when pushed prompt context is insufficient for the next elicitation move. It tells you how to sequence selected-spec reads without turning context gathering into a separate research project.

Start from the handles in the runtime prompt: selected spec, soft readiness estimate, active strategy/lens, workspace posture, and any graph overview. Pull more context only when it will change the next question, proposal, capture decision, or graph write. Prefer compact overview for orientation, then edge-local neighborhoods for the claim, design seam, oracle, or plan item under discussion.

## Edge-local preference

When a move is centered on an existing graph item, read the anchor and its neighborhood before asking or proposing. Use `src/agents/contexts/references/neighborhood-consumption-slice.md` as the conduct reference: bucket neighbors as dependencies, dependents, evidence, refinements, lateral context, open gaps, and reconciliation needs. This is usually more useful than loading all nodes of a kind, because it shows why the anchor stands and what downstream material changes if it moves.

```pseudo
context read:
  selected-spec overview
    -> anchor node / node code when present
    -> edge-local neighborhood buckets
    -> topical slice only if the next move needs projection or capture guidance
```

Use global kind lists only for orientation, coverage scans, or when no anchor exists yet. Do not infer relation direction from raw storage coordinates; rely on rendered labels, role names, and impact buckets. If the user mentions a node code, resolve it through the product read path rather than guessing from memory.

Use read-only context tools such as `read_graph`, `read_session_context`, `web_fetch`, and `web_search` where available. Reach for `web_fetch` when a specific URL is already in hand; use `web_search` only when current external context or alternate sources would change the next elicitation move. Keep graph truth distinct from active-context projections: accepted records are truth, while rendered summaries and web extracts are orientation until captured through Brunch's graph path.

Compose this before `generate-proposal`, `commit-graph`, and topology-driven lens questions. Out of scope: filesystem exploration unrelated to the selected spec, direct DB inspection, or treating stale prompt context as proof when a fresh graph read is needed.

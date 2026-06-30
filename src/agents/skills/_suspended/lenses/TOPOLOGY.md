# _suspended/lenses/ — suspended historical plane sources

SPEC decisions: D25-L, D56-L, D98-L

This directory contains historical lens-axis prompt resources only. Under D98-L they are not active prompt resources, not user-changeable runtime axes, and not model-routable skills.

## Current disposition

| Suspended source | Surviving guidance | Current live home |
| --- | --- | --- |
| `intent` | claim-shape interpretation, weak-support abstention, and intent-plane gaps | `elicit`, `review`, `propose/references/intent.md` |
| `design` | ownership, boundary, dependency-direction, and information-hiding questions/critiques | `elicit`, `review`, `propose/references/design.md` |
| `oracle` | unwitnessed-claim, checkability, evidence, and blind-spot questions/critiques | `elicit`, `review`, `propose/references/oracle.md` |

## Boundary rules

```pseudo
rules:
  agents/runtime/elicitor/ x> _suspended/lenses/ [live elicitor does not load lens-axis resources]
  _suspended/lenses/ -> agents/skills/{elicit,review,propose}/ [historical source only]
```

Do not add new active lens members here. Plane heuristics now belong to the live move that uses them: questioning in `elicit`, critique in `review`, and candidate generation in `propose`.

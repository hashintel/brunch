---
name: capture
description: Capture durable product truth from the current turn into the selected spec. Use when the elicitor has enough concrete user-provided material to record graph facts, note follow-up obligations, or update reconciliation state.
---

# capture

Use this skill when the next valuable move is to turn grounded conversation material into durable Brunch state.

## Use It For

- Recording high-confidence graph facts from the current turn
- Spawning or closing follow-up obligations when the conversation reveals them
- Updating reconciliation state when a contradiction or uncertainty becomes explicit

## Do Not Use It For

- Asking the next exploratory question
- Reading more context before you know what matters
- Proposing speculative graph structure before the user has supplied enough grounding

## Working Style

1. Start from what the user actually said or directly endorsed.
2. Prefer the smallest truthful capture over a broad speculative batch.
3. Keep the selected spec as the scope boundary.
4. If confidence is low, preserve uncertainty instead of laundering it into settled truth.

## Notes

- This is a read-only prompt resource, not a source of runtime authority by itself.
- Tool legality and exact mutation behavior remain code-owned elsewhere in the product.

---
name: ingest-paste
description: "Acquire user-provided pasted material as conversational transcript content."
---

# Method: ingest paste

Use this acquisition mode when the human provides a block of text, notes, requirements, logs, transcript excerpts, or other pasted material as the ground material for the selected spec. The paste enters the conversation directly; this method stays thin and capture stays uniform through the next banded capture-sweep.

## Use when

- The user says they will paste material, or has already pasted it.
- The material is authored or curated by the user and should be treated as conversation-provided evidence.
- The block is small or coherent enough to reason over in the main elicitor context.
- The immediate job is to absorb the pasted material, not to explore external context.

## Conduct

First acknowledge the paste as source material. If it is long, characterize its main sections briefly before capture, but do not invent a separate schema or side channel. Keep provenance legible in ordinary language: "from your pasted launch notes" is enough. Then run capture over the pasted content and any assistant characterization in the un-swept tail.

For large pasted material, compress before committing: name the sections, preserve uncertainty, and let low-confidence implications become gaps rather than graph truth.

```pseudo
chain ingest-paste:
  user paste
    -> brief assistant orientation if useful
    -> banded capture-sweep over paste/conversation
    -> explicit or implicit graph commits only when confidence is high
    -> gaps for unresolved or ambiguous implications
```

## Anti-goals

- Do not require the user to save a paste to a file before Brunch can learn from it.
- Do not treat every sentence as a graph node.
- Do not convert ambiguous pasted claims into graph truth to avoid asking follow-up questions.
- Do not create a product-side extraction stage; this is conduct in the transcript plus the standard sweep.

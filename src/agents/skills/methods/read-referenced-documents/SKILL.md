---
name: read-referenced-documents
description: "Read bounded user-referenced documents and digest them before capture."
---

# Method: read referenced documents

Use this acquisition mode when the human points at specific files, URLs, docs, tickets, or other bounded references that should ground the spec. The job is to read the referenced material, author a digest in the conversation, and let the capture sweep work from that digest plus any conversational framing.

## Use when

- The user names a concrete local path, URL, document, or bounded source to inspect.
- The referenced material is too large or too raw to capture directly from tool results.
- The user expects Brunch to use the material as evidence for graph truth or elicitation gaps.
- Reading the source will answer or sharpen an existing grounding or elicitation gap.

## Conduct

Use only legal read tools. Local files may be read through the local read surface; web references may use `web_fetch` or `web_search` when those tools are active. Keep raw tool output as background. After reading, write an assistant-authored digest in the transcript before capture.

The digest should name what was read, separate direct claims from interpretation, and call out uncertainty. Capture should run over the digest, not over unbounded raw tool results. If the material is contradictory, low-confidence, or merely suggestive, route it to a gap or future reconciliation work rather than graph truth.

```pseudo
chain read-referenced-documents:
  bounded user reference
    -> legal read/fetch/search tools
    -> assistant-authored digest in transcript
    -> capture sweep over digest + conversation
    -> graph truth / elicitation gaps by confidence
```

## Digest shape

- Source: what was read and why.
- High-confidence facts: direct statements or safe materialized structure.
- Uncertainties: ambiguous terms, missing context, contradictions, or stale material.
- Suggested next move: the question, gap, or graph area most affected.

## Anti-goals

- Do not make raw tool results the capture source for bulk material.
- Do not cite a document as authority without saying which document was read.
- Do not invent graph mutations before the digest is in the transcript.
- Do not expand from one referenced document into open-ended research unless the user asked for exploration.

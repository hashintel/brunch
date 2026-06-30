---
name: tutorial
description: Explain how Brunch works and walk the user through what they can do here. Use when the user asks for a product overview, onboarding help, or a guided first step.
---

# tutorial

Use this skill when the user wants help with Brunch itself rather than help authoring the current spec.

Start from the user's question and current context. Give the smallest walkthrough that answers it, then land on one concrete next step they can take now.

Read [`../../../../README.md`](../../../../README.md) when you need current product shape, launch commands, or architecture framing.

## Procedure

```text
chain tutorial:
  user's product question + current session context
    -> identify the tutorial job
    -> explain the relevant product surface in plain language
    -> connect it to the user's current workspace or session
    -> offer one concrete next step or short guided path
```

## Tutorial Jobs

| Job | Use when the user asks... | Default shape |
| --- | --- | --- |
| product overview | "what is Brunch?" / "how does this work?" | explain the product loop, main surfaces, and what Brunch owns |
| getting started | "what can I do here?" / "how do I begin?" | show the first useful move from the current session |
| mode orientation | "what's this screen / sidecar / RPC thing?" | explain the specific surface and how it fits the whole |
| workflow walkthrough | "show me how to use this for X" | give a short step-by-step path through the relevant flow |

## Working Style

1. Start with the user's immediate need, not a full product dump.
2. Distinguish current alpha behavior from planned or speculative future behavior.
3. Prefer concrete nouns from the product surface: TUI, browser sidecar, selected spec, structured exchanges, graph, RPC.
4. Tie the explanation back to the user's present workspace or question whenever possible.
5. End with one action the user can take now.

## Do Not Use It For

- Pretending planned tutorial seeding or future UX already exists
- Replacing a direct product answer with architecture trivia
- Giving a long tour when the user only needs one capability explained
- Slipping back into normal spec-authoring conduct when the user asked about the product itself

## Notes

- This is an initial functional stub for product help and walkthroughs.
- If Brunch later grows a dedicated seeded tutorial workspace, this skill should route into that experience instead of simulating it in prose.

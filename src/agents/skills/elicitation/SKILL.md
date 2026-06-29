---
name: elicitation
description: Ask focused questions and run the next human-facing exchange needed to move the selected spec forward. Use when the agent should acquire missing information, resolve ambiguity, or tighten the user's intent before capture or review.
---

# Elicitation

Use this skill when the best next move is to ask the user for the missing piece that would improve the selected spec.



## Do's and Don'ts

### Use It For

- Asking one focused question that reduces real uncertainty
- Resolving ambiguity between a small number of meaningful interpretations
- Moving the conversation toward information that can later be captured or reviewed

### Do Not Use It For

- Asking a questionnaire when one discriminating question would do
- Sneaking a proposal into a question and treating it as user intent
- Continuing to ask questions when the conversation already supports a concrete capture step

### Working Style

1. Ask for the missing thing, not everything adjacent to it.
2. Prefer crisp distinctions over broad open-ended drift when a concrete contrast is available.
3. Keep the question anchored to the selected spec.
4. Let the user's answer become the new evidence; do not pre-interpret it as settled truth.


### Lens vs Operational Mode

D23-L distinguishes:

- **Operational Mode** — coarse operational strategy: `elicitor`, `observer`, `reviewer`, `reconciler` (and future `generalist`).
- **Lens** — a narrower interpretive perspective applied within an Operational Mode.

The strategies described here (`step-by-step`, `disambiguate-via-examples`, `propose-scenarios-with-tradeoffs`, `propose-design-shapes`, `propose-oracle-ensembles`, `project-requirements-from-upstream`) are all **lenses within the `elicitor` Operational Mode**. `observer` and `reviewer` are Operational Modes in their own right (async background roles), not lenses.

## Lens catalogue (starter set)

Lenses split into two families by capture mechanism. The **family distinction** is the durable architectural commitment (D26-L); the specific lens list is expected to evolve.

### Extractive lenses

Produce single-exchange interactions; the `observer` Operational Mode extracts implicit info post-exchange.

- **`step-by-step`** — agent asks one focused question at a time
- **`disambiguate-via-examples`** — agent surfaces contrastive examples to force a discriminating user response (see [Behavioral Kernels](../../../../docs/design/BEHAVIORAL_KERNELS.md))

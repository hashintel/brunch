# Elicitation Testing Guide

Elicitation testing compares how well different products turn the same user need
into a review-ready specification.

The basic idea is simple:

```text
one private user mission
          |
          v
one controller acts as that user
          |
          +--> Brunch ------> specification
          +--> Claude Code -> specification
          +--> Codex -------> specification
          +--> Cursor ------> specification
          |
          v
compare the documents and conversations separately
```

## What is being tested?

The test looks at two different results:

1. **Outcome:** Is the final specification complete, consistent, useful, and
   honest about uncertainty?
2. **Process:** Did the product ask consequential questions, use the answers
   well, avoid invention, and stop at an appropriate point?

These judgments stay separate. A polished document does not excuse a poor
elicitation process, and a thoughtful conversation does not excuse an unusable
document.

## The private mission

A mission describes the simulated user's objective, context, constraints,
unknowns, decision latitude, and conversational style. Saved missions live in
[`testing/comparisons/missions/`](../../testing/comparisons/missions/README.md).

The controller keeps the mission private. Products learn its facts only through
normal questions and answers. Mission files must not contain product names,
adapters, run IDs, scoring rules, or automation instructions.

## Quick start

To test Brunch directly, open the isolated target project and run:

```sh
npx @hashintel/brunch@1.0.0-alpha.5
```

For a comparison, start from a trusted top-level project Pi session:

```text
/compare-specs
```

Choose **create**, **revise**, or **run**. To open a saved mission directly:

```text
/compare-specs minimal-petri-net-editor
```

The controller then:

1. asks which products to compare;
2. shows the exact setup for approval;
3. gives each product a fresh isolated workspace;
4. acts as the same user in each conversation;
5. runs one product at a time; and
6. saves the transcript and unchanged specification.

The controller answers only from mission truth. When something is unknown or
undecided, it says so instead of inventing an answer.

## Outputs

Temporary work goes under `.fixtures/scratch/comparisons/`. Reviewed runs may
be retained under `.fixtures/runs/agent-as-user-comparison/`.

A retained run contains:

- the approved mission and run setup;
- each product's exact visible transcript and unchanged specification;
- terminal status and cleanup evidence; and
- an operator report.

Retained runs are immutable. Mission revisions affect future runs only.

## Review

Review the outcome and process separately:

- **Outcome:** Hide product labels where practical. Compare completeness,
  consistency, structure, recommendations, omissions, contradictions, and
  invention.
- **Process:** Name each product. Compare question quality, handling of unknowns,
  use of answers, unnecessary turns, premature commitment, and stopping behavior.

Model-generated assessments are review drafts, not final authority. A human
owns the final interpretation. Do not force a winner when the evidence is mixed
or insufficient.

## Approachable and rigorous workflows

Use `/compare-specs` for an approachable operator-led comparison.

Use the rigorous procedure when you need fresh controller sessions, matched
budgets, reveal rules, retained invalid attempts, masked judgment, and structured
human adjudication. See [Comparison Runs](comparison-runs.md), the
[mission packet](comparison-runs/mission-packet.md), and the
[judgment prompt pack](comparison-runs/judgment-prompt-pack.md).

## Rules

- Use missions, not Brunch seeds, for cross-product tests.
- Never expose private mission material to a product.
- Never repair or improve a product's output.
- Retain failed, exhausted, and invalid attempts.
- Run one product at a time and clean it up before continuing.
- Filesystem separation reduces accidental leakage but is not a security boundary.

For shell setup and cleanup, follow the
[Manual Testing Protocol](manual-testing.md). The rigorous actor recipe is
[`agent-as-user-comparison`](../../.agents/skills/agent-as-user-comparison/SKILL.md).

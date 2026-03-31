---
name: ln-grill
description: "Interview the user relentlessly about a plan or design until reaching shared understanding. Use when fleshing out an idea, stress-testing a design, or when the user says \"grill me\"."
---

# Dev Grill

Walk the design tree branch by branch. Resolve dependencies between intents/desires/decisions, one by one. Be Socratic — question premises, not just requirements. The user's *why* matters as much or more than their *what*: knowing motivation lets you suggest alternatives they haven't considered.

For each question, provide your own recommended answer based on what you know. If the codebase can answer the question, explore it instead of asking.

Actively surface constraints, limitations, and irreversible choices — these are strategic inputs, not just risk factors. They shape what's *possible*, which shapes what's *worth doing*.

Pure elicitation — do not produce a plan or document.

## Routing

When understanding is reached, present these options to the user (use `tool-ask-question`):

| #   | Label           | Target     | Why                                     |
| --- | --------------- | ---------- | --------------------------------------- |
| 1   | Write a spec    | `ln-spec`  | Understanding is sufficient for a PRD   |
| 2   | Plan slices     | `ln-plan`  | Problem is clear, needs slice breakdown |
| 3   | Scope one slice | `ln-scope` | One slice is already obvious            |

Recommended: choose based on how much structure the understanding needs.

---
*Adapted from [mattpocock/skills/grill-me](https://github.com/mattpocock/skills/tree/main/grill-me).*

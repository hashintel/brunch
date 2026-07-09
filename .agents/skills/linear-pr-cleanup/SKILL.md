---
name: linear-pr-cleanup
description: Normalize Linear issues and matching GitHub PRs into concise task language. Use when the user asks to tidy, simplify, normalize, rewrite, or make Linear task and PR titles/descriptions clear, especially with prompts like "clean up this Linear and PR", "fix the ticket and PR", "make the PR clearer", or "linear-pr-cleanup FE-1234".
---

# Linear PR Cleanup

Turn a Linear issue and its matching PR into clear, concise execution language.

## Workflow

1. Inspect the Linear issue.
2. Find the matching GitHub PR from the Linear attachment or by searching the issue id.
3. Rewrite the Linear issue as a simple thesis.
4. Rewrite the PR title to match the Linear title with the issue id prefix.
5. Rewrite the PR body with concise structure.
6. Verify both Linear and GitHub after updating.

## Linear Format

The Linear issue should be short and thesis-like.

Title:

```text
<verb/object outcome>
```

Description:

```text
<one sentence describing what should be done and why it matters operationally>
```

Rules:

- Prefer plain domain terms.
- Remove implementation detail unless it defines the actual task.
- Remove long context sections, guardrails, and historical rationale.
- Keep the description to one sentence when possible.
- Do not include PR testing detail in Linear.

Example:

```text
Title: Build from committed scope

Description: Make the build architect derive build slices from committed scope packages while preserving design and verification context.
```

## PR Format

The PR title should mirror the Linear title:

```text
FE-1234: Build from committed scope
```

The PR body should be slightly richer than Linear, but still concise:

```markdown
## Why

Explain the problem or seam this PR closes.

## What

Explain the concrete change in clear domain terms.

## How to test

- `npm run verify`
- Add any manual checks or focused test commands used.
```

Rules:

- Use `Why`, `What`, and `How to test`.
- Keep each section short.
- Use accepted domain terminology consistently.
- Do not paste the whole Linear description into the PR.
- Include actual verification commands if known.
- If testing was not run, say so directly.

## Title Style

Prefer:

```text
Build from committed scope
Live scope authoring
Scope handoff to execution
```

Avoid:

```text
Consume committed scope in the build architect
Live scope authoring from elicitor to accepted review set
Prove scope as the handoff from specification to execution
```

## Command Example

When the user says:

```text
linear-pr-cleanup FE-1179
```

Produce updates like:

```text
Linear:
Title: Build from committed scope
Description: Make the build architect derive build slices from committed scope packages while preserving design and verification context.

PR:
Title: FE-1179: Build from committed scope
Body: Why / What / How to test
```

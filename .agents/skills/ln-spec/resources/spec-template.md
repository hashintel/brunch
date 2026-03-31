<!-- SPEC.md — single source of truth for WHAT we're building and WHY.
     Created by ln-spec · Read by all skills · Updated by ln-sync.
     Authority: requirements, constraints, assumptions, decisions, invariants, domain language, verification strategy.

     When re-running ln-spec: read this file first, preserve existing content, evolve sections that need change.
     Cross-referenced by PLAN.md slices and spikes via §-prefixed section links. -->

# [Project Name]

## Concept & Goal

<!-- Why this exists and what success looks like. The "why" shapes the solution space. -->

## Constraints & Non-goals

<!-- Boundaries and deliberate exclusions. What we will NOT do. -->

## Requirements

<!-- What the system must do. Extensive — cover all aspects.
     Each numbered for cross-reference from PLAN.md slices. -->

1. [Requirement]
2. ...

## Assumptions

<!-- Falsifiable beliefs accepted as true but not yet verified.
     Low-confidence assumptions are spike candidates during planning.
     Each links to the decisions it supports and the slices it implicates.
     When validated: promote to §Lexicon or §Decisions via ln-sync.
     When invalidated: record in §Decisions, flag implicated slices in PLAN.md. -->

| #   | Assumption   | Confidence      | Dependent decisions | Implicated slices | Validation approach |
| --- | ------------ | --------------- | ------------------- | ----------------- | ------------------- |
| A1  | [hypothesis] | low/medium/high | [→ §Decisions #N]   | [→ PLAN.md slice] | [how to falsify]    |

## Decisions

<!-- Ordered list — latter supersedes former.
     Each names what it resolved and what assumptions it depends on.
     No file paths or code snippets — they go stale. -->

1. **[Decision]** — [rationale]. Depends on: [A1, A2]. Supersedes: [—|#N].

## Invariants

<!-- Structural properties proven by implementation and protected by tests.
     Once established, must not regress.
     Each links to the decision it proves and the tests that protect it.
     Established by ln-build/ln-spike traceability.
     Referenced by PLAN.md slices (to establish / to respect). -->

| #   | Invariant      | Established by | Protected by | Proves            |
| --- | -------------- | -------------- | ------------ | ----------------- |
| I1  | [property]     | [slice/spike]  | [test file]  | [→ §Decisions #N] |

## Lexicon

<!-- Canonical terms. Code names must match.
     Method terms come first, then project-specific domain terms.
     Survey with ln-review; realign with ln-refactor. -->

| Term            | Definition                                                                                    |
| --------------- | --------------------------------------------------------------------------------------------- |
| **assumption**  | A falsifiable belief accepted as true; tracked with confidence, linked to decisions and slices |
| **decision**    | A recorded choice that resolves a question; ordered, with supersession chain                  |
| **invariant**   | A structural property proven by implementation and protected by tests; must not regress       |
| **requirement** | A capability the system must provide                                                          |
| **slice**       | A thin end-to-end tracer-bullet path through all integration layers                          |
| **spike**       | A time-boxed throwaway investigation to answer one hard question                             |
| **phase**       | A temporal grouping of slices and spikes in PLAN.md                                          |
| **[Term]**      | [Definition]                                                                                 |

## Verification Design

<!-- Three-tier feedback loops, cheapest first.
     Inner: agent-autonomous, always-on (ms–seconds).
     Middle: regression gates (seconds–minutes).
     Outer: human observer, strategy redirect (minutes–hours). -->

### Verification Commands

<!-- Actual commands for each check in the verification harness.
     Update as tooling evolves. -->

| Step | Check          | Command     |
| ---- | -------------- | ----------- |
| 1    | Type checking  | [command]   |
| 2    | Unit tests     | [command]   |
| 3    | Build          | [command]   |

### Feedback Loops

- **Inner loop** (ms–seconds): type checks, fast unit tests, linting — agent-autonomous, always-on
  - [specific test description] → protects [I#]
- **Middle loop** (seconds–minutes): integration tests, contract tests, property tests — regression gates
  - [specific test description] → protects [I#]
- **Outer loop** (minutes–hours): e2e tests, visual review, human observer — strategy redirect
  - [specific test description]

### Current Coverage

<!-- Updated by ln-build traceability after each slice. -->

| File          | Tests | Protects |
| ------------- | ----- | -------- |
| [test file]   | [N]   | [I#]     |

## Acceptance Criteria (exit conditions)

<!-- Observable, testable targets for completion. -->

1. [Criterion]
2. ...

<!-- SPEC.md — the single source of truth for WHAT we're building and WHY.
     Created by ln-spec · Read by all skills · Updated by ln-sync.
     Authority: requirements, constraints, assumptions, decisions, domain language, verification strategy. -->

## Concept & Goal

<!-- Why this exists and what success looks like. The "why" shapes the solution space. -->

## Constraints & Non-goals

<!-- Boundaries and deliberate exclusions. What we will NOT do. -->

## Requirements

<!-- What the system must do. Extensive — cover all aspects. -->

## Assumptions

<!-- Falsifiable beliefs accepted as true but not yet verified.
     Low-confidence assumptions are spike candidates during planning.
     Each links to the decisions it supports and the slices it implicates.
     When validated: promote to §Lexicon or §Decisions via ln-sync.
     When invalidated: record in §Decisions, flag implicated slices in PLAN.md. -->

| Assumption   | Confidence      | Dependent decisions | Implicated slices | Validation approach |
| ------------ | --------------- | ------------------- | ----------------- | ------------------- |
| [hypothesis] | low/medium/high | [→ §Decisions #N]   | [→ PLAN.md slice] | [how to falsify]    |

## Decisions

<!-- Ordered list — latter supersedes former.
     Each decision names what it resolved and what assumptions it depends on.
     No file paths or code snippets — they go stale. -->

1. **[Decision]** — [rationale]. Depends on: [§Assumptions]. Supersedes: [—|#N].

## Lexicon

<!-- Canonical terms. Code names must match.
     Method terms come first, then project-specific domain terms. -->

| Term            | Definition                                                                                    |
| --------------- | --------------------------------------------------------------------------------------------- |
| **assumption**  | A falsifiable belief accepted as true; tracked with confidence, linked to decisions and slices |
| **decision**    | A recorded choice that resolves a question; ordered, with supersession chain                  |
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

- **Inner loop** (ms–seconds): type checks, fast unit tests, linting — agent-autonomous, always-on
- **Middle loop** (seconds–minutes): integration tests, contract tests, property tests — regression gates
- **Outer loop** (minutes–hours): e2e tests, visual review, human observer — strategy redirect

## Acceptance Criteria (exit conditions)

<!-- Observable, testable targets for completion. -->

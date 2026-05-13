<!-- SPEC.md — live architecture register.
     Created by ln-spec · Read by all skills · Refreshed by ln-sync.
     Authority: product contract, active assumptions, current decisions,
     critical invariants, future direction pointers, lexicon, verification stance.

     When re-running ln-spec: read this file first, preserve existing authority,
     and evolve only the touched area. SPEC is not an implementation diary.
     Together with PLAN.md, this is the only canonical planning state; do not
     create sidecar spec ledgers without explicit permission. -->

# [Project Name]

## Product Contract

### Concept

<!-- Why this exists, what success looks like, and the product frame.
     The "why" shapes the solution space. -->

### Constraints & Non-goals

<!-- Durable boundaries and deliberate exclusions. What we will NOT do. -->

### Capability Requirements

<!-- What the system must do. Keep requirements stable and cross-referenceable.
     Group by capability area to reduce conflict churn. Do not renumber survivors casually. -->

#### [Capability area]

1. [Requirement]
2. ...

## Live Architecture Register

<!-- The live register holds active constraints, not history. Rows should survive
     because they still shape near-term work or define a durable seam. -->

### Open Assumptions

<!-- Falsifiable beliefs accepted as true but not yet verified.
     Keep only assumptions that are unresolved or still shape named frontier work.
     Validated assumptions retire by default during ln-sync unless they still constrain
     an active frontier; promote only durable product facts to Product Contract,
     Decisions, Invariants, or Lexicon. -->

| # | Assumption | Confidence | Status | Depends on | Validation approach |
| --- | --- | --- | --- | --- | --- |
| A1 | [hypothesis] | low/medium/high | open | [D# / I# / Requirement #] | [how to falsify] |

### Active Decisions

<!-- Current spine decisions only. A decision belongs here when it chooses between
     live alternatives at a seam or defines durable architectural authority.
     Micro-decisions, helper names, file layout, and implementation steps should
     live in code/design docs or be omitted. Group decisions by subsystem when useful.
     Leave concise retirement comments for removed ID ranges when helpful. -->

1. **[Decision]** — [rationale]. Depends on: [A1]. Supersedes: [—|D#].

### Critical Invariants

<!-- Seam-level properties that must not regress. Keep critical invariants live;
     retire rows that only enumerate implementation history, test filenames, or
     examples already covered by a broader invariant. Planned invariants may remain
     only when they correspond to active/next frontier work. -->

| # | Invariant | Protected by | Proves |
| --- | --- | --- | --- |
| I1 | [property] | [test/manual oracle/planned oracle] | [Requirement # / D#] |

## Future Direction Register

<!-- Product or architecture direction that shapes sequencing but is not yet current
     product contract. Prefer links to PLAN frontier items and design docs over long
     speculative prose. Move acceptance criteria to PLAN until the work becomes live. -->

### [Direction area]

- [Future direction, linked to PLAN/design docs]

## Interaction Stream Model

<!-- Optional. Keep only if actively useful as SPEC authority. Prefer a compact
     model and links to design docs over design-doc-scale detail. -->

## Layout Architecture

<!-- Optional. Keep only durable ownership/route/layout guardrails. Detailed card
     styling and implementation minutiae belong in design docs or code. -->

## Lexicon

<!-- Canonical terms. Code and planning language should converge here.
     Remove legacy aliases once they stop carrying useful transition history. -->

| Term | Definition |
| --- | --- |
| **[Term]** | [Definition] |

## Verification Design

<!-- Verification is first-class work. ln-spec owns the inner loop: commands,
     verification policy, and inner-loop oracle items. ln-oracles owns middle/outer
     loop strategy, diagnostic assessment, and blind spots. Preserve oracle sections
     written by ln-oracles unless intentionally updating them. -->

### Verification Commands

| Step | Check | Command |
| --- | --- | --- |
| 1 | Type checking | [command] |
| 2 | Unit tests | [command] |
| 3 | Build | [command] |
| all | Full gate | [command] |

### Verification Policy

<!-- General verification policy, including inner loop and gate expectations. -->

<!-- === Sections below are usually written/refreshed by ln-oracles, not ln-spec ===
     When running ln-spec, preserve these sections if they exist unless the user asked
     for verification strategy work.

### Verification Stance
### Diagnostic Assessment
### Oracle Strategy by Loop Tier
### Design Notes
### Acknowledged Blind Spots
### Current Coverage
-->

### Acceptance Criteria

<!-- Observable completion targets for the current product contract. -->

1. [Criterion]
2. ...

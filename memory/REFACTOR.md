## Problem Statement

The recent interaction-model work is functionally rich but structurally expensive to change. Interview orchestration is split across route loaders, mutation-triggered global invalidation, chat/SSE handlers, and large controller switchboards, so unrelated concerns still move together. Review-turn semantics also lose identity as they travel through the system: the UI thinks in reference codes and item text, submission payloads degrade to item indexes, and revision/change summaries fall back to text matching. The review architecture is also carrying stale overlap: interviewer-owned review sets are the real proposal seam, but observer-owned draft requirement / criterion items still linger as a competing intermediate path even though accepted review is now the sole authority for durable requirements and criteria. Fixture and walkthrough seeding have drifted too: some seeded scenarios still materialize durable requirement / criterion knowledge items before accepted review, and seeded assistant transcripts omit persisted activity summaries, so manual walkthroughs do not faithfully reflect current product truth. That makes future query-ownership work, review regeneration, naming cleanup, and outer-loop verification harder than they should be.

## Solution

Create a clearer ownership model for the interview surface before adding more behavior. The target state is:
- one stable review-item identity carried from synthesized review set through UI, submission, regeneration context, and revision diffing
- one deterministic review-authority path: interviewer-owned full-set proposal, user accept/request-changes, server-owned materialization from the accepted set, and no observer-owned review-item proposal seam
- acceptance comments, if retained, are non-authoritative annotations; any semantic change to the accepted set must go through request-changes and a regenerated interviewer-owned successor set
- one client-side specification-runtime seam that owns interview process concerns separately from read-model fetching
- independently invalidable client data domains so observer updates refresh knowledge state without tearing down transcript state
- fixture generation and walkthrough seeding that reflect current product truth, including review-authoritative requirements / criteria and persisted activity-summary replay
- lexicon-aligned naming where workspace/specification terms are canonical and deprecated names are removed rather than preserved behind aliases or adapters

## Execution Waves

### Wave 1 — Truth and safety rails

1. Add characterization tests for review-item identity, review regeneration context, fixture truth, persisted activity-summary replay, review-phase authority boundaries, and observer-update refresh boundaries so the refactor has a safety net.
2. Remove observer-owned draft requirement / criterion proposal seams so review phases no longer maintain a shadow proposal path beside interviewer-owned review sets.
3. Regenerate the fixture helpers, observer corpus fixtures, and walkthrough seeds so pre-review scenarios stop materializing durable requirement / criterion entities, review phases stop pretending observer-owned draft proposals are canonical, and seeded transcripts persist activity summaries the same way runtime turns do.

### Wave 2 — Naming and review-item identity

4. Rename newly touched user-facing and developer-facing seams from deprecated project wording to specification/workspace wording, deleting deprecated names instead of preserving aliases or adapters.
5. Introduce a canonical review-item identity model and thread it through synthesized review sets, client rendering state, submitted review feedback, and successor-turn context building.
6. Replace index-based review feedback plumbing with stable review-item identity plumbing while preserving the existing accept/request-changes behavior.

### Wave 3 — Acceptance semantics and review diffing

7. Tighten acceptance semantics so accepted review sets materialize deterministically from the structured accepted set, while any acceptance comments remain non-authoritative annotations rather than hidden semantic modifiers.
8. Extract review-turn comparison and revision-summary logic behind one dedicated module so review diffing no longer depends on content-text fallback spread across helpers.

### Wave 4 — Runtime and data ownership

9. Extract a specification-runtime seam on the client that owns in-flight interview lifecycle concerns, capture-status bookkeeping, and navigation side effects independently from view rendering.
10. Split specification data reads into explicit domains for workflow/specification core, transcript turns, and knowledge entities, but keep them behaviorally equivalent to current loads.
11. Retarget mutations and SSE observer handling to invalidate only their owned domains, with observer results refreshing knowledge state without reloading the transcript domain.

### Wave 5 — Final deletion and outer-loop validation

12. Remove the obsolete route-wide invalidation, compatibility glue, deprecated code names, and legacy adaptation branches once the new runtime and query-domain seams fully own the flow.
13. Re-run manual walkthrough seeds against the refreshed fixtures and record outer-loop findings before further interaction-model work lands.

## Decisions

- The refactor centers on interaction-surface ownership, not on changing product behavior or redesigning the workspace UI.
- Stable review-item identity becomes the canonical handle for per-item feedback, regeneration context, and revision diffing.
- Interviewer-owned review sets are the only proposal seam for requirements and criteria. The observer does not propose review items during review phases and does not participate in accepted-review materialization.
- Accepted review transfers authority directly from the structured accepted set into durable requirement / criterion state. Acceptance comments are annotations, not semantic modifiers. Any semantic change must go through request-changes and interviewer regeneration.
- Walkthrough fixtures are part of the trusted read model: seeded scenarios must obey the same review-authority rules and persisted activity-summary rules as runtime-generated data.
- Query-domain ownership is treated as the structural end state for client data refresh, with a dedicated runtime seam handling ephemeral process state.
- We are still in a seed-first, migration-light phase. Do not spend time on legacy data migrations, alias layers, adaptive readers, or deprecated-name compatibility shims; prefer destructive reseed and direct deletion of obsolete seams.
- Lexicon cleanup follows the canonical terminology in the spec: workspace and specification are product terms, and deprecated names should be removed rather than preserved behind adapters.

## Testing Decisions

- Good tests here prove behavior at the semantic boundary: review feedback survives regeneration, revision summaries remain stable under reordering/text edits, observer updates do not force transcript refresh, phase progression still behaves the same, fixture-generated walkthroughs obey review-authority rules, accepted-review persistence is deterministic from the structured accepted set, and seeded transcripts replay persisted activity summaries.
- The main coverage should sit at shared review-state helpers, fixture serialization/builders, observer corpus fixtures, server-side context/review synthesis, accepted-review materialization, client controller/runtime behavior, and route-level refresh ownership.
- Manual walkthroughs should be re-run after fixture regeneration, especially for `brownfield-grounding-replay`, `issue-tracker-requirements-ready`, `issue-tracker-criteria-ready`, and `issue-tracker-all-phases-closed`.
- Existing prior art already covers grounded cards, review revisions, controller rendering, export, app-level chat flows, and observer probes; extend that coverage with characterization tests rather than rewriting the harness.

## Out of Scope

- New product features beyond the current review and interview interaction model.
- Introducing an "accept with semantic edits" path; semantic changes remain a request-changes flow.
- Continuous workspace rendering or other layout-architecture changes unrelated to runtime/query ownership.
- Revisit / cascade thread work.
- Export content redesign beyond what falls out mechanically from stable naming and review identity.
- Legacy data migrations, aliasing, deprecated-name adapters, or permissive handling of old review/draft seams.

# Cards — Output route and markdown export refinement

Frontier item: Track B #3
Traceability: D101; I24, I87, I104

## Orientation

- Containing seam: the specification completion surface across the specification index redirect, interview completion affordances, output route preview, and server markdown export.
- Relevant frontier item: Track B #3 "Output route and markdown export refinement" in `memory/PLAN.md`.
- Volatile state: Track A is actively using `memory/CARDS.md`, so this Track B queue lives here only.
- Main open risk: output is exposed as a conditional completion surface in the plan/spec, but closed specifications still default back into grounding and the preview is still a raw markdown dump with mixed terminology.

Queue note: Card 1 and Card 2 are implementation-independent and can land in either order. Card 3 should follow them so the preview reflects the settled route semantics and document shape.

## Card 1: Closed specifications land on output `[status: done]`

**Objective**: A fully closed specification treats the output route as its completion landing while incomplete specifications keep the current phase-first routing.

**Acceptance Criteria**:

- `/specification/$id/` redirects to `/specification/$id/export` when all interview phases are closed
- Incomplete specifications still redirect to the current reachable interview phase
- Output navigation remains absent for incomplete specifications and present for completed ones in the sidebar and completion affordances
- Route tests cover both the closed-specification landing and the unchanged incomplete-specification landing
- `npm run verify` passes

**Verification**: Inner: `npm run verify`. Middle: manual walkthrough of an all-phases-closed seeded specification.

## Card 2: Markdown export foregrounds accepted outputs `[status: done]`

**Objective**: The generated markdown presents the completed specification in a deliberate canonical order with accepted review outputs as the primary content.

**Acceptance Criteria**:

- Markdown export foregrounds accepted `Requirements` and `Acceptance Criteria` in canonical section order
- Any retained supporting knowledge sections are grouped and labeled intentionally instead of mirroring the raw knowledge registry order
- Closure caveats render in human-readable canonical wording without leaking workflow-internal jargon
- Server export tests cover section ordering, caveat wording, and active-path filtering
- `npm run verify` passes

**Verification**: Inner: `npm run verify`. Middle: manual markdown export walkthrough on a completed seeded specification.

## Card 3: Output preview becomes the readable completion surface `[status: done]`

**Objective**: The output route presents the finished specification legibly under canonical specification terminology instead of as a generic export preview.

**Acceptance Criteria**:

- Output page heading, action labels, and supporting copy use canonical `specification` / `output` terminology consistently
- The ready state renders the completed document in a readable presentation rather than only a raw `<pre>` block
- Download remains available from the output route and navigation back into the specification workspace still works
- Client tests cover the completed ready state and the blocked not-yet-complete state copy
- `npm run verify` passes

**Verification**: Inner: `npm run verify`. Middle: manual completed-specification output walkthrough.

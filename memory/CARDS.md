<!-- CARDS.md — temporary batch scope cards for near-term slices.
     Derivative of PLAN.md. Delete when all cards are built or superseded.
     If a build invalidates a downstream card's assumptions, revise before building. -->

# Scope Cards

## Card 12a: Knowledge workspace review surface

### Target Behavior

A dedicated phase-oriented knowledge workspace at `/project/:id/knowledge` lets the user inspect, review-state-badge, and browse all canonical knowledge items grouped by kind, with relationship context visible per item.

### Boundary Crossings

```
→ [GET /api/projects/:id/entities]        — existing entities API already returns all 8 kind collections + relationships + review status
→ [src/client/router.tsx]                 — new route /project/$id/knowledge with route loader
→ [src/client/routes/KnowledgeWorkspace]  — phase-grouped list/detail view consuming EntitiesData
→ [src/client/routes/InterviewWorkspace]  — link/nav to knowledge workspace from sidebar or header
→ [EntitiesData / knowledge registry]     — shared types drive kind grouping and labels
```

### Risks and Assumptions

```
- RISK: the existing entities API returns all items (not active-path-filtered for non-review kinds like goal/term/context/constraint)
  → MITIGATION: the API already reads from knowledge_item which stores all captured items; active-path filtering for the review surface can be deferred to 13a since the first workspace is read-only inspection, not edit/invalidation
- RISK: decision/assumption entities use a different shape (Decision/Assumption) from KnowledgeItem
  → MITIGATION: the workspace can use the existing registry + EntitiesData shape which already handles this split; normalize display per-kind using the registry
- ASSUMPTION: a read-only inspection workspace with review-status badges is sufficient for the first slice — no inline edit, no review-action mutations from this surface
  → VALIDATE: this matches D63 and D69 which say the first workspace is list/detail review, not graph-canvas-first, and 13a owns richer review actions
```

### Acceptance Criteria

```
✓ knowledge-route-exists — /project/:id/knowledge loads and renders without error
✓ kind-grouped-display — items are grouped by kind in registry order, each group shows label and item count
✓ review-status-badges — requirements and criteria show approved/rejected/pending badges matching the sidebar
✓ relationship-context — at least one relationship type (depends_on) is visible per item that has edges
✓ empty-state — kinds with no items show the registry's emptyStateCopy
✓ navigation — the interview workspace links to the knowledge workspace and vice versa
✓ existing-tests-pass — npm run verify passes; no regression in existing workspace/sidebar/entity tests
```

### Verification Approach

```
- Inner: route/component tests — knowledge workspace renders kind-grouped items with correct badges from mock EntitiesData
- Inner: type checking — route loader and component props match existing EntitiesData shape
- Inner: lint + fmt + build — standard pipeline
- Outer: manual walkthrough — seed a criteria-ready project, navigate to knowledge workspace, verify kind groups, badges, relationships, empty states, and nav links
```

---

## Card 12b: Spec export from the reviewed knowledge layer

### Target Behavior

The export route at `/project/:id/export` renders a markdown preview of the reviewed knowledge layer from the active path, gates export behind a readiness predicate (all phases closed), and offers a download button for the `.md` file.

### Boundary Crossings

```
→ [GET /api/projects/:id/entities]        — existing entities API returns all knowledge + review status
→ [GET /api/projects/:id]                 — existing project state API returns workflow state with per-phase status/closureBasis
→ [new: GET /api/projects/:id/export]     — server-side markdown rendering from entities + workflow + phase outcomes
→ [src/server/export.ts]                  — pure function: (entities, workflow, project) → markdown string using md-pen
→ [src/client/routes/ExportPreview.tsx]    — replace placeholder with markdown preview + download button + readiness gate
→ [src/client/router.tsx]                 — export route loader fetches export data
```

### Risks and Assumptions

```
- RISK: the readiness predicate (all phases closed) may be too strict or too loose for the first version
  → MITIGATION: start with the simplest rule: all 4 phases must have status === 'closed'; refine in 13a if needed
- RISK: md-pen API surface is unfamiliar — need to verify it supports the rendering primitives we need
  → MITIGATION: md-pen is already a dependency; check its exports before building. Fallback: plain string concatenation for the first cut
- ASSUMPTION: export renders from the existing entities API shape without needing a separate export-specific query
  → VALIDATE: the entities API already returns kind-grouped collections with review status and relationships; if that's sufficient, no new DB query needed
- ASSUMPTION: closure caveats (forced-close, low-readiness) are visible in the export when closureBasis !== 'interviewer_recommended'
  → VALIDATE: workflow state already carries closureBasis per phase; the export renderer can read it
```

### Acceptance Criteria

```
✓ export-not-ready — when any phase is not closed, the export route shows a "not ready" message with per-phase status
✓ export-renders-markdown — when all phases are closed, the export route renders a markdown preview grouped by knowledge kind
✓ export-includes-caveats — phases closed with basis !== 'interviewer_recommended' show a caveat note in the export
✓ export-download — a download button produces a .md file with the same content as the preview
✓ export-api — GET /api/projects/:id/export returns { ready: boolean, markdown?: string } with the readiness predicate and rendered content
✓ existing-tests-pass — npm run verify passes
```

### Verification Approach

```
- Inner: export rendering tests — pure function tests: entities + workflow → expected markdown sections, caveat inclusion, empty-kind handling
- Inner: export API route tests — readiness gate returns not-ready when phases aren't all closed; returns markdown when ready
- Inner: type checking + lint + fmt + build
- Outer: manual walkthrough — seed an all-phases-closed project (using npm run seed), navigate to export, verify preview content matches seeded knowledge, download the file, verify it opens correctly
- Outer: manual not-ready walkthrough — seed a criteria-ready project, navigate to export, verify the gate blocks export with clear per-phase status
```

---

## Build Order

**12a then 12b.** Both share one branch (FE-574). Card 12a establishes the knowledge workspace which 12b's export route can link to ("review your knowledge before exporting"). Card 12b's readiness gate and export renderer are independent of 12a's UI, but having the knowledge workspace available makes the outer-loop export verification richer.

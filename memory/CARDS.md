<!-- CARDS.md — prepared scope-card queue for the current frontier item.
     Created by ln-scope · Consumed by ln-build · Deleted when exhausted.
     Always lives under one PLAN.md frontier item; do not mirror to PLAN.md. -->

# V1.2 Card Queue — Side-chat Annotate vertical slice

Frontier: PLAN.md Active 1 (Side-chat V1 — finish Annotate + multi-pin + top-bar patch summary).
Branch: `ka/fe-656-side-chat-v1-2` stacked on `ka/fe-656-side-chat`. Linear: FE-656.

The queue covers the **vertical slice** for V1.2 — server seam, client seam, end-to-end wiring. Top-bar UI (canonical patch surface), floating selection menu, and multi-pin all get re-scoped after Card C lands. Each card is independently shippable; sub-card boundaries match the inside-out pattern V1.1 used (functional core → I/O shell → integration).

---

## Card A — Annotation server seam (full scope) · status: `next`

### Target Behavior

A new durable `annotation` entity exists with REST CRUD: clients can create, list, and delete annotations anchored to knowledge items, persisted across server restarts, with foreign-key cascade on item deletion.

### Boundary Crossings

```
→ drizzle migration adds `annotation` table (id, specification_id FK, knowledge_item_id FK, summary, body, selection_start NULL, selection_end NULL, created_at)
→ POST /api/specifications/:id/annotations  (zod-validated body → insert → return new row)
→ GET  /api/specifications/:id/annotations  (query by spec, ordered by created_at)
→ DELETE /api/annotations/:id               (delete by id, 204 on success)
→ src/server/db.ts: getAnnotationsForSpecification, createAnnotation, deleteAnnotation
→ src/server/annotation-route.ts: handleCreate / handleList / handleDelete
→ src/server/app.ts: route registration
```

### Risks and Assumptions

```
- RISK: span-anchor schema debt → MITIGATION: schema accepts NULL selection_start/selection_end columns from day one; V1.2 leaves them NULL, V2/V3 populate them without migration churn
- RISK: orphaned annotations when knowledge_item is deleted → MITIGATION: ON DELETE CASCADE on the FK; covered by db test
- RISK: no spec-level scoping on DELETE (annotation id is enough to identify) → MITIGATION: 404 if not found; explicit no-op on already-deleted; do not require spec id in URL for DELETE (matches V1's optimistic undo pattern)
- ASSUMPTION: annotations are listable by spec but not by item in V1.2 → VALIDATE: design doc §6.4 implies per-item rendering happens in V1.2 follow-up; defer per-item GET until that card
- ASSUMPTION: annotations are user-owned, no author column needed (single-user per spec today) → VALIDATE: matches existing knowledge_item / phase_outcome shape; if multi-author lands later, add author_id then
```

### Acceptance Criteria

```
✓ db.test.ts — annotation table migration is idempotent and creates expected columns + FK constraints
✓ db.test.ts — createAnnotation / getAnnotationsForSpecification / deleteAnnotation round-trip with FK cascade behavior
✓ annotation-route.test.ts — POST returns 201 with full annotation body; 400 on missing/empty fields; 404 when spec or item missing
✓ annotation-route.test.ts — GET returns chronological array; empty for new spec
✓ annotation-route.test.ts — DELETE returns 204; idempotent on repeat
✓ build-boundary.test.ts — still under timeout after schema growth
```

### Verification Approach

```
- Inner: server unit tests (db.test.ts, annotation-route.test.ts) — endpoint behavior + schema migration shape
- Middle: deferred to Card C (e2e integration)
- Outer: deferred to Card C (manual UI flow)
```

---

## Card B — PatchListProvider client module (full scope) · status: `next`

### Target Behavior

A `PatchListProvider` component wraps the spec route layout and exposes three hooks: `usePatchList()` for mutations, `usePatchListState()` for reactive reads, `useStagedPatches({anchor?, kind?})` for filtered selectors. Internal state is a `useReducer` over a typed `PatchEvent` log; derived state is computed via a pure fold. Supports `annotate` patch kind only.

### Boundary Crossings

```
→ <PatchListProvider> mounted by src/client/routes/specification/$id/route.tsx, wrapping <SideChatHost> per the synthesis (PatchListProvider is the outer layer)
→ React context (PatchListContext)
→ Hooks: usePatchList / usePatchListState / useStagedPatches
→ Internal: useReducer<PatchListState, PatchEvent> with deriveState pure fold
→ Appliers: { annotate: (patch) => Promise<{ undo: () => Promise<void> }> } passed as prop
→ src/client/components/patch-list-host.tsx (new, sibling to side-chat-host.tsx)
→ src/client/components/patch-list-reducer.ts (new, pure fold + types)
```

### Risks and Assumptions

```
- RISK: events-as-internal-state mental model is unfamiliar → MITIGATION: keep events private to the module (no public export); hooks return derived state only; reducer file gets a header comment explaining the choice + A71 forward-compat
- RISK: Patch type as closed discriminated union breaks at every consumer when V2 adds kinds → MITIGATION: that's the point — typecheck failure is the right pressure for V2; document the upgrade path in the file header
- ASSUMPTION: pure client state suffices for V1.2 (no cross-tab, no server mirror) → VALIDATE: V1.2 manual testing; cross-tab is out of scope per design doc §4
- ASSUMPTION: `apply()` fans out sequentially (not parallel) → VALIDATE: simpler error semantics; parallelize only if perceptible latency surfaces; document choice in reducer
- ASSUMPTION: undo handle returned by appliers is sufficient for V1.2; no compensation logic needed → VALIDATE: undo round-trip in Card C tests
```

### Acceptance Criteria

```
✓ patch-list-host.test.tsx — <PatchListProvider> mounts and provides context
✓ patch-list-host.test.tsx — usePatchList() returns null outside provider; returns actions inside
✓ patch-list-host.test.tsx — stage(input) appends; usePatchListState().count === 1
✓ patch-list-host.test.tsx — discard(id) removes; editSummary(id, text) updates
✓ patch-list-host.test.tsx — apply() invokes mocked annotate applier; isApplying flips during; staged clears on success
✓ patch-list-host.test.tsx — undo() invokes the returned undo handle; canUndo flips false after
✓ patch-list-host.test.tsx — apply() failures preserve staged patches; isApplying clears; surfaces error reasonably
✓ patch-list-host.test.tsx — useStagedPatches({anchor: {kind, itemId}}) filters correctly
✓ patch-list-reducer.test.ts — pure fold (golden-file): each event yields expected derived state; full sequence stage/edit/apply/undo round-trips
```

### Verification Approach

```
- Inner: patch-list-reducer.test.ts (pure fold over event arrays)
- Inner: patch-list-host.test.tsx (React Testing Library + mocked appliers)
- Middle: deferred to Card C
- Outer: deferred to Card C
```

---

## Card C — Wire annotate end-to-end (full scope) · status: `next`

### Target Behavior

The user can stage an annotation from inside the side-chat panel, see it surfaced in the panel's inline patch list, click an in-panel Apply to persist it via the new endpoint, and click Undo to remove it from the database. The seam is end-to-end durable.

### Boundary Crossings

```
→ SideChatHost gains an "Annotate" affordance in the popover header (visible when an item is pinned)
→ Composer (summary input + body textarea + Submit button) — minimal, in-panel, re-scoped to floating selection menu later
→ Submit calls usePatchList().stage({kind: 'annotate', anchor: pinnedItem, summary, note})
→ SideChatPopover renders an inline patch list (per design §4 secondary surface) below the message log when staged > 0
→ In-panel Apply button calls usePatchList().apply()
→ Annotate applier (provided to PatchListProvider at mount) POSTs to /api/specifications/:id/annotations, returns { undo: () => DELETE /api/annotations/:id }
→ src/client/components/side-chat-popover.tsx — header gains annotate button, popover gains inline patch list section
→ src/client/components/side-chat-host.tsx — annotate composer state, stage call
→ src/client/routes/specification/$id/route.tsx — wires PatchListProvider with the annotate applier
→ src/client/lib/annotation-api.ts — fetch wrapper for create/delete (mirrors side-chat-stream pattern)
```

### Risks and Assumptions

```
- RISK: in-panel Apply duplicates V1.2-D's top-bar canonical surface → MITIGATION: in-panel Apply is intentionally minimal (inline-list-only, no overlay); add code comment that top-bar canonical lands in the next card; this is convenience UI per design §4 ("not source of truth")
- RISK: annotate composer takes focus away from chat input mid-stream → MITIGATION: disable Annotate button while stream is in-flight (re-uses existing isStreaming derivation)
- RISK: undo race — DELETE fires before POST resolves → MITIGATION: undo is only invokable via canUndo, which is false until apply returns the undo handle; reducer guarantees this
- ASSUMPTION: Manual annotate composer in side-chat header is acceptable V1.2 UX → VALIDATE: this is the inside-out scaffold; the floating selection menu (next card) is the eventual entry surface
- ASSUMPTION: Annotation persistence is volatile across page refresh in V1.2 (patch list dies on reload, applied annotations survive) → VALIDATE: reload mid-flow, applied annotations remain, staged patches do not
```

### Acceptance Criteria

```
✓ side-chat-popover.test.tsx — Annotate button renders when pinnedItem is set
✓ side-chat-popover.test.tsx — Clicking Annotate opens composer; submitting calls onAnnotateStage with summary + body
✓ side-chat-popover.test.tsx — Inline patch list renders one row per staged patch with summary + Apply + Discard
✓ side-chat-host.test.tsx — Stage flow appends to PatchListProvider; in-panel Apply triggers POST; on success, staged clears and inline list empties
✓ side-chat-host.test.tsx — Undo flow triggers DELETE; canUndo flips false
✓ app.test.ts — Integration: stage annotate → apply → annotation row exists in DB; undo → row gone
✓ app.test.ts — apply() failure (server returns 500) preserves staged patches
✓ Manual: chat-with on a graph row → pin → Annotate → submit → Apply → reload → annotation persists (verified via direct GET request or DB inspection)
```

### Verification Approach

```
- Inner: extended side-chat-popover.test.tsx + side-chat-host.test.tsx + patch-list-host.test.tsx (real applier with mocked fetch)
- Middle: app.test.ts integration test (real DB, real endpoints, real applier — annotation lifecycle round-trip)
- Outer: manual UI walk per docs/praxis/manual-testing.md
```

---

## Out of queue (re-scope after Card C)

- **V1.2-D** Top-bar patch summary scaffold (`N Edits · Undo · Apply` in app top-bar + overlay panel) — depends on Card B's hooks; can ship anytime after.
- **V1.2-E** Floating selection menu (`💬 Chat` / `📝 Annotate`) — depends on selection-detection; new design surface, warrants fresh /ln-scope.
- **V1.2-F** Multi-item pinning — touches Card A prompt-builder shape (`buildSideChatPrompt(items, ...)`); refactor warrants fresh /ln-scope.

# Web design-system port — review hardening

Frontier: web-design-system-port | n/a
Status:   active
Mode:     chain
Created:  2026-06-09

## Orientation

- **Containing seam:** `src/web` read-only React sidecar plus its method-shaped RPC cache contract. The web client may cache named Brunch RPC reads, but must refetch via `brunch.updated` hints rather than inventing a store.
- **Frontier:** `web-design-system-port` is already done; this file is review-comment hardening for the current stacked branch, not a new frontier or Linear issue. Current branch note: these fixes may land on `ln/fe-825-dx-introspection-live` because that branch contains the stacked web changes.
- **Posture:** earned (inherited from `web-design-system-port`) — the design-system shape is settled; these cards close contract drift and copied-component defects.
- **Main open risk:** completionist web polish. Keep to review-sampled defects: cache invalidation, copied disclosure behavior, canonical citations/anchors.

Frontier-level cross-cutting obligations this slice carries:

- Preserve D19-L: `brunch.updated` is a process-local invalidation hint only; clients refetch canonical projections through named RPC methods.
- Preserve D72-L/I43-L: web presentation may use the ported primitives, but node labels/accent exhaustiveness remain canonical, not web-local folklore.
- Keep the web surface read-only; do not add `workspace.activate` UI or web write paths while fixing cache refresh.

---

## Card 1 — Thread `workspace.selectionState` through web invalidation · status: next

### Objective

`workspace.selectionState` behaves like a first-class method-shaped read in the web cache: it has the server status union, is published on workspace activation/inventory changes, and is invalidated by `brunch.updated`.

### Cold-start reads

- `memory/SPEC.md` — D19-L; I22-L
- `memory/PLAN.md` — frontier: `web-design-system-port`; branch context: `dx-introspection-live`
- `src/rpc/README.md` — `brunch.updated` topics and RPC-method-to-query-key ledger
- `src/web/README.md` — web query/subscription topology

### Acceptance Criteria

```txt
✓ `WorkspaceSelectionState.status` reuses the server-side `WorkspaceSessionState['status']` union (or an exported projection type), not `string`.
✓ workspace activation/inventory-changing paths publish `workspace.selectionState` together with the relevant workspace/session update hints.
✓ `useBrunchUpdateSubscription` invalidates `queryKeys.workspace.selectionState()` for both product-update entries and legacy topic arrays.
✓ A web/RPC test proves a `brunch.updated` notification for `workspace.selectionState` refetches `workspace.selectionState` without requiring a page reload.
✓ `src/rpc/README.md` no longer says the web query key is merely a target/not implemented.
```

### Verification Approach

- Inner: focused vitest for `src/web/app.test.tsx` / subscription invalidation and `src/rpc` publisher behavior.
- Inner: type-aware lint/build catches impossible status widening if the server union changes.

### Cross-cutting obligations

- Do not add a generic event spine or cache store; this remains method-shaped invalidation.
- Do not make the read-only sidecar capable of workspace activation.

### Assumption dependency

None — D19-L already authorizes the named method/update-topic shape.

### Expected touched paths (tentative)

```txt
src/rpc/
├── product-updates.ts          ~
├── methods/workspace.ts        ?
├── handlers.test.ts            ?
├── web-host.test.ts            ?
└── README.md                   ~
src/web/
├── app.test.tsx                ~
├── queries/workspace.ts        ~
├── subscriptions/brunch-updates.ts ~
└── README.md                   ?
```

---

## Card 2 — Make `DrawerCard`'s disclosure contract executable · status: next

### Objective

`DrawerCard` can expand whenever it has drawer content, treats ReactNode presence by nullishness rather than truthiness, and exposes disclosure state to assistive tech.

### Cold-start reads

- `memory/SPEC.md` — D72-L
- `memory/PLAN.md` — frontier: `web-design-system-port`
- `memory/cards/web-design-system-port--restyle.md` — original ported primitive scope

### Acceptance Criteria

```txt
✓ A collapsed `DrawerCard` with `children` and no `summary` renders a clickable header and expands to show the drawer.
✓ `children={0}` / `summary=""`-style valid ReactNode values are not treated as absent solely because they are falsy.
✓ Toggle buttons expose `aria-expanded`; add `aria-controls` if a stable content id is introduced without speculative API growth.
✓ Existing graph/session view rendering remains unchanged except for the corrected disclosure behavior.
```

### Verification Approach

- Inner: component/unit test for collapsed-with-children, nullish ReactNode handling, and `aria-expanded`.
- Inner: existing web tests continue to pass.

### Cross-cutting obligations

- Keep the primitive local to `src/web/components`; no new component library dependency.

### Assumption dependency

None.

### Expected touched paths (tentative)

```txt
src/web/components/
├── drawer-card.tsx        ~
└── drawer-card.test.tsx   +
src/web/app.test.tsx       ?
```

---

## Card 3 — Correct review-sampled citations and markdown anchors · status: next

### Objective

Review-sampled comments and card-template anchors point to the canonical decision/invariant they name, without duplicate heading ambiguity.

### Cold-start reads

- `memory/SPEC.md` — D67-L, D72-L, I42-L, I43-L
- `memory/PLAN.md` — frontiers: `web-design-system-port`, `dx-introspection-live`
- `.agents/skills/ln-scope/SKILL.md` — full/light card template headings

### Acceptance Criteria

```txt
✓ `src/web/components/node-card.tsx` cites D72-L for plane-organized web accents and I43-L for `NodePlane` accent exhaustiveness.
✓ `.agents/skills/ln-scope/SKILL.md` has unambiguous full-card and light-card cold-start heading anchors; existing self-links resolve to the intended section or are phrased without relying on duplicate generated anchors.
✓ No unrelated SPEC/PLAN renumbering or prose rewrite is included.
```

### Verification Approach

- Inner: `npm run check` or focused markdown/text review; no runtime test needed beyond existing lint/format.

### Cross-cutting obligations

- Preserve canonical-doc pointers; do not inline SPEC/PLAN content into card templates.

### Assumption dependency

None.

### Expected touched paths (tentative)

```txt
src/web/components/node-card.tsx   ~
.agents/skills/ln-scope/SKILL.md   ~
```

# Web design-system port — restyle

Frontier: web-design-system-port
Status:   done
Mode:     chain
Created:  2026-06-09

## Orientation

- **Seam:** `src/web` — read-only React client (D52-L standalone build target; must not read SQLite/Pi RPC/JSONL directly).
- **Frontier:** `web-design-system-port` (PLAN §Frontier Definitions). Decision D72-L; invariant I43-L.
- **Posture:** earned (inherited from `web-design-system-port`) — target design exists and works in `../brunch/src/client`; each card materializes a known shape or deletes the invented aesthetic.
- **Open risk / micro-decision:** webfont delivery (Inter + Geist Mono). The old trunk imports `@fontsource-variable/inter` + `@fontsource-variable/geist-mono` (npm asset packages). Frontier says "no new packages," but the fonts *are* the most visible design token. Resolve in Card 1 (see its Risk). No other unknowns.
- **Cross-cutting obligations:** read-only contract (no web write paths, D33-L); node reference codes via canonical `NODE_KIND_METADATA` projection (D62-L), not a web-local relabeling; pre-release `migration: free-rewrite` — delete the invented design, don't preserve it; `sourcing: strip-or-build` — copy patterns, avoid new logic/framework deps.

Reference source (separate checkout, **not** imported): `../brunch/src/client/index.css`, `../brunch/src/client/components/drawer-card.tsx`, `../brunch/src/client/components/knowledge-card.tsx`.

---

## Card 1 — Port the token system into `styles.css`  ·  status: done

### Objective

Replace the warm "brunch" theme in `src/web/styles.css` with the prior trunk's token system, so every subsequent view styles against `ink/sub/hint/rule/wash/tint`, the compact type scale, and `--shadow-card`.

### Acceptance Criteria

```
✓ styles.css @theme defines: fonts (Inter sans + Geist Mono mono); gray ramp ink #202020 / sub #5b5b5b / hint #a6a6a6 / rule #e3e3e3 / wash #f0f0f0 / tint #fafafa; link #2070e6; the 11–16px type scale (xxs..base); --shadow-card / --shadow-ring / --shadow-card-ring
✓ no warm tokens remain (brunch-paper/card/rule/muted/accent/graph), no body radial/linear gradient, no backdrop-blur
✓ body background is plain (white/near-white), color-scheme light preserved, focus-visible outline retained (re-toned to the new palette)
✓ app still mounts and renders (npm run build:web succeeds; existing tests run)
```

### Verification Approach

```
- Inner: npm run verify (build:web compiles styles; vitest runs). Visual: load / in a browser.
```

### Cross-cutting obligations

```
- Tailwind v4 @theme block only; do not pull in shadcn semantic var layer (not needed by the ported primitives).
```

### Assumption dependency

`None` — purely presentational; no SPEC assumption is load-bearing.

### Webfont delivery — RESOLVED (user, 2026-06-09)

Option (a): add `@fontsource-variable/inter` + `@fontsource-variable/geist-mono` and `@import` them in `styles.css`. The "no new packages" line was not a hard rule; webfonts are approved.

### Expected touched paths (tentative)

```
src/web/
├── styles.css   ~
package.json     ?   (only if fontsource option (a) chosen)
```

---

## Card 2 — Port card primitives into `src/web/components/`  ·  status: done

### Objective

Create `src/web/components/` holding the ported `DrawerCard`, `KindBadge`, `CountBadge`, and a plane-organized node-kind → accent map adapted from the old `KnowledgeKind` vocabulary to this trunk's `NodeKind`.

### Acceptance Criteria

```
✓ src/web/components/drawer-card.tsx ports DrawerCard verbatim-in-shape (useState toggle, summary/locked/compact variants, rounded-xl + border-rule + bg-tint + shadow-[var(--shadow-card)] nesting); no shadcn dependency
✓ src/web/components/node-card.tsx (or kind-badge.tsx) exposes KindBadge + CountBadge using NODE_KIND_METADATA labels for the prefix
✓ a kindAccent map is exhaustive over NodeKind via `satisfies Record<NodeKind, …>`, organized by plane (intent/oracle/design/plan) — build fails if a kind is missing (I43-L)
✓ no new logic deps: className composition uses template literals or a tiny local cn (no clsx/tailwind-merge unless already present)
✓ npm run verify green
```

### Verification Approach

```
- Inner: npm run verify (type-aware oxlint proves the satisfies-exhaustiveness; vitest; build). Optional: a small unit test asserting KindBadge renders the NODE_KIND_METADATA label for a sample of kinds across all four planes.
```

### Cross-cutting obligations

```
- Reference codes come from NODE_KIND_METADATA + kindOrdinal (D62-L); do not hardcode a parallel prefix table.
- Only src/web imports from src/web/components/.
```

### Assumption dependency

`None`.

### Expected touched paths (tentative)

```
src/web/components/
├── drawer-card.tsx        +
├── node-card.tsx          +   (KindBadge, CountBadge, kindAccent map, node detail card)
└── node-card.test.tsx     +   (optional kind→label/accent coverage)
```

---

## Card 3 — Re-skin the three views; delete the invented aesthetic  ·  status: done

### Objective

Restyle `WorkspaceChrome`, `GraphOverviewPanel`, and `SessionPanel` into the ported language — quiet metadata-row chrome, plane-accented kind-grouped node cards with canonical reference codes, a plain session card — removing all warm/gradient/translucent styling. **Scope correction (user, 2026-06-09):** this is a *style + component-pattern port of the views we have*, not a feature rewrite. Behavior is preserved except where it was invented dead scaffolding.

### Scope decisions (user, 2026-06-09)

- **"Focus node" — REMOVED.** It was a non-functional placeholder: clicking only rendered the string `Focused read pending: graph.nodeNeighborhood(...)` and never called the `graph.nodeNeighborhood` RPC. Pre-release `migration: free-rewrite` — delete invented aesthetic/scaffolding. (The real `nodeNeighborhood` query/subscription infra in `queries/graph.ts` + `subscriptions/` is untouched and still tested.)
- **"Edge categories" — KEPT.** User finds the per-category edge summary potentially useful; restyled (`RefBadge` chips) but behavior/text (`support: 1`) preserved.
- **Counts and group labels preserved** as `Nodes` / `Edges` / `LSN` and `plane / kind` (tested DOM contract), now rendered in the compact token style with a plane-accented `KindBadge`.

### Acceptance Criteria

```
✓ WorkspaceChrome: opaque metadata-row card (rounded-xl, border-rule, bg-white, shadow-card; no rounded-[2rem], no bg-white/45, no backdrop-blur, no tracking-[0.35em] uppercase mono labels)
✓ GraphOverviewPanel: groups GraphSlice.nodes by `plane / kind`; each node renders a compact card (canonical reference code + title + body); plane-accented KindBadge + CountBadge per group; Edge-categories summary retained as RefBadge chips; Focus-node button + focused-read placeholder removed; no hover-lift animation
✓ SessionPanel + spec.tsx invalid banner: plain bordered cards in the new palette
✓ read-only contract intact: no edits to queries/, rpc-client, subscriptions/, routes loaders/params, or projection inputs (GraphSlice/WorkspaceState consumed as-is)
✓ src/web/app.test.tsx behavior preserved; only the two Focus-node assertions (+ now-unused fireEvent import) removed; all other assertions pass unchanged; npm run verify green (28 web tests, oxlint type-aware clean, build:web clean, no better-sqlite3 in bundle)
```

### Verification Approach

```
- Inner: npm run verify (vitest over updated web tests; build). 
- Outer: manual browser check of / and /spec/$specId against a seeded spec (npm run seed, launch web mode) — chrome, kind-grouped graph cards, session panel match the prior trunk's look.
```

### Cross-cutting obligations

```
- No new RPC/query/route behavior — presentation only.
- Edge badges resolve target reference codes through NODE_KIND_METADATA + kindOrdinal (D62-L).
- empty-state ("No graph nodes yet…") preserved in the new styling.
```

### Assumption dependency

`None`.

### Expected touched paths (tentative)

```
src/web/
├── routes/root.tsx                    ~   (WorkspaceChrome, SessionPanel)
├── routes/spec.tsx                    ~   (InvalidSpecRoutePage warm-styled banner)
├── features/graph/GraphOverview.tsx   ~
└── app.test.tsx                       ~
```

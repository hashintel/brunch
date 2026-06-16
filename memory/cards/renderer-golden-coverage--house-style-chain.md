# Renderer Context House-Style Chain

Frontier: renderer-golden-coverage
Status:   active
Mode:     chain
Created:  2026-06-16

## Orientation

- Seam: RENDER-stage LLM-facing context renders under `src/renderers/`, adopting the **D83-L house style** — md-pen markdown frame + TOON for uniform record sets + stringify-tree file trees + `<section>` wrappers — clustered into `<workspace>` / `<specification>` / `<session>` scopes mirroring the `workspace → spec → session` hierarchy (D19-L).
- Frontier: `renderer-golden-coverage` (FE-870, branch `ln/fe-870-renderer-golden-context-tools`), reshaped 2026-06-16 by D83-L.
- Posture: proving (inherited from `renderer-golden-coverage`) — the first two scope renders prove the house style reads well for our data before the rest migrate.
- Already landed: stock-Vitest preview apparatus (commit `70f0da81`); `src/renderers/README.md` renderer/tool/entry-copy ledger; D83-L committed (`0b210df1`); the PLAN reshape (`53c764bf`).
- **Design-pass gate (per user, 2026-06-16):** the *exact output shape* of each scope render (`<workspace>`, `<specification>`) is decided in a collaborative **design pass** before the builder finalizes output. Cards 2–3 carry `Design: PENDING`; their structural scope (data sources, invariants, file home) is settled now, but the **approved target sketch is appended to the card before build**. Card 1 (substrate) needs no design pass.
- Main risk: building a render to a shape that is not design-approved (locking a golden we then rewrite). Mitigation: the design-pass gate plus the human eyeball before every lock.
- Cross-cutting obligations: keep `renderers/` free of adapter/transport imports (D52-L); goldens co-located under `__previews__/`; the legibility rule (prose where structure misleads); `<workspace>` carries **no sessions** (D83-L scope clustering); the three new dependencies must **retire owned format code**, not merely add surface (`sourcing: strip-or-build`).

## Dependency Sketch

```text
Card 1  substrate adoption (md-pen + TOON + stringify-tree + section)   [buildable now]
  └─ unlocks Cards 2-3 (they consume the substrate)

Card 2  <workspace> context render        [Design: PENDING -> then buildable]
Card 3  <specification> context render    [Design: PENDING -> then buildable]
  (Cards 2 and 3 are independent of each other once Card 1 + their design pass land)

Later (NOT in this chain; scope after the first two land + their design passes):
  - <session> context render (migrate runtime-frame + mentions + transcript)
  - tool-result render migration (graph/*, exchanges/*) onto the md-pen substrate
  - brunch-print fork decision; renderer ledger close
```

Anti-speculation note: Cards 2–3 depend on Card 1 as a built dependency (they import the substrate) and on a **design pass** (external input), not on Card 1's implementation *findings*. Card 3's dialect should stay consistent with Card 2's approved design; if Card 2's design pass materially changes the dialect, re-touch Card 3 before building it.

---

## Card 1 — Adopt the render substrate (md-pen + TOON + stringify-tree + section)

Status: next

### Target Behavior

The renderer substrate exposes md-pen-backed markdown, TOON-backed compact data, stringify-tree-backed ASCII file trees, and a `<section>`-tag wrapper — each unit-tested — without changing existing renderer output.

### Full-card cold-start reads

```
- memory/SPEC.md   — D83-L (house style), D52-L (renderers boundary)
- memory/PLAN.md    — frontier: renderer-golden-coverage
- src/renderers/README.md            — house-style note + ledger
- src/renderers/markdown.ts          — current hand-rolled helpers + md-pen intent comment
- src/renderers/toon.ts              — pure stub naming @toon-format/toon
- md-pen API   — https://github.com/privatenumber/md-pen
- TOON         — https://github.com/toon-format/toon
- stringify-tree — https://github.com/jessitron/stringify-tree
```

### Boundary Crossings

```
→ package.json (add md-pen, @toon-format/toon, stringify-tree)
→ src/renderers/markdown.ts  (md-pen wrapper seam)
→ src/renderers/toon.ts      (TOON wrapper seam)
→ src/renderers/tree.ts      (new; stringify-tree wrapper)
→ src/renderers/section.ts   (new; tag wrapper — or fold into markdown.ts)
→ src/renderers/__tests__/   (unit tests)
```

### Risks and Assumptions

```
- RISK: backing the hand-rolled markdown helpers (markdownBullet, used heavily by graph/graph-slice + graph/node-neighborhood) could shift graph renderer output.
    → MITIGATION: preserve helper signatures; back with md-pen only where output is byte-identical. Otherwise leave graph renderers on the existing helpers until the later migration card. The existing graph goldens are the regression guard — they must not change in this card.
- ASSUMPTION: md-pen / TOON / stringify-tree are deterministic and dependency-light.
    → IMPACT IF FALSE: substrate non-determinism would undermine every downstream golden lock.
    → VALIDATE: unit tests asserting exact output; inspect installed dep trees (md-pen is zero-dep).
- RISK: three new deps under `sourcing: strip-or-build`.
    → MITIGATION: each must retire owned code (hand-rolled markdown concat) or enable a render that would otherwise be hand-built. Net owned format surface must not grow.
```

### Posture check (proving)

Scores on **invariants** (stabilizes the substrate seam the render cards build on) and **proof of life** (first real md-pen / TOON / tree output in-tree). Locking the substrate makes Cards 2–3 mechanical.

### Acceptance Criteria

```
✓ deps-added       — md-pen, @toon-format/toon, stringify-tree in package.json; `npm run verify` green.
✓ markdown-wrapper — renderers/markdown.ts exposes md-pen-backed primitives (heading, table, codeBlock, blockquote, ul, inline code, escape) for later cards; existing graph renderer goldens UNCHANGED.
✓ toon-wrapper     — renderers/toon.ts encodes a uniform record array to TOON ([N]{fields} header) via @toon-format/toon behind a thin Brunch helper + fenced-block convention; unit test locks the encoded shape.
✓ tree-wrapper     — renderers/tree.ts renders a hierarchical node input to an ASCII tree via stringify-tree; unit test locks output for a fixture tree.
✓ section-wrapper  — a section(tag, body) helper wraps body in <tag>…</tag> with the house newline convention; unit test.
✓ no-format-growth — hand-rolled markdown concatenation is removed or backed by md-pen; net owned format code does not grow.
```

### Verification Approach

```
- Inner: vitest unit tests on each wrapper (deterministic-output asserts) + `npm run verify`.
```

### Cross-cutting obligations

```
- D52-L: renderers/ imports no adapter/transport/app/web layers.
- D83-L: dependencies retire owned format code, not just add surface.
```

### Expected touched paths (tentative)

```
package.json                       ~
src/renderers/
├── markdown.ts                    ~
├── toon.ts                        ~
├── tree.ts                        +
├── section.ts                     +?   (or fold into markdown.ts)
└── __tests__/
    ├── markdown.test.ts           +?
    ├── toon.test.ts               +
    ├── tree.test.ts               +
    └── section.test.ts            +?
```

---

## Card 2 — `<workspace>` context render (house style)

Status: blocked — design pass pending
Design: PENDING — the exact markdown / TOON / tree layout is decided in a design pass and **appended to this card** before build.

### Target Behavior

The `read_workspace_context` cwd surface renders a `<workspace>` section — project identity (md), documents `.md` tree (stringify-tree, fenced), and spec roster (TOON) — carrying **no sessions** — golden-locked after design approval.

### Full-card cold-start reads

```
- memory/SPEC.md   — D83-L, D19-L, D60-L
- memory/PLAN.md    — frontier: renderer-golden-coverage
- THIS card's appended Design sketch — REQUIRED; do not build before it is present
- src/renderers/{markdown,toon,tree,section}.ts — Card 1 substrate
- src/renderers/workspace/workspace-context.ts  — current flat-bullet render to replace
- src/workspace/cwd-inventory.ts                — WorkspaceCwdInventory (cwd, hasBrunchDir, sessionFiles, topLevelEntries, markdownFiles)
- src/workspace/project-identity.ts             — discoverProjectIdentity → {name, slug, source}
- src/session/workspace-overview-context.ts     — specs[] for the roster (sessions move to <specification>)
- src/session/README.md                         — read_workspace_context consumer
```

### Data sources (structural scope — stable regardless of the design pass)

```
- Project : project-identity {name, slug} + cwd path                       → md
- Documents: cwd-inventory.markdownFiles → assembled into a .md tree        → stringify-tree (fenced)
             (flat-path → tree assembly lives in this card or tree.ts; the
              design pass decides annotation, e.g. per-dir file counts)
- Spec roster: workspace-overview specs[] {id, title, nodeCount, sessionCount} → TOON
- Sessions : NONE (D83-L scope clustering)
```

### Invariants (hold regardless of the design pass)

```
- the <workspace> render contains no session rows
- spec roster renders as TOON; documents as a fenced tree; project as md
- wrapped in <workspace>…</workspace>
- renderers/ imports stay clean (D52-L)
```

### Acceptance Criteria (skeleton — finalized by the design pass)

```
✓ workspace-section — render wrapped in <workspace>, contains project + documents tree + spec roster, no sessions.
✓ golden           — co-located golden locked under workspace/__previews__/ AFTER the user approves the design sketch.
✓ invariant        — no session content; spec roster is TOON; documents is a fenced tree.
✓ retire-old       — the flat-bullet cwd-inventory render is removed; consumers updated.
```

### Design pass (REQUIRED before build)

Produce a draft render from a representative fixture, surface it for the user's approval (the human-in-the-loop design checkpoint), append the approved sketch here, THEN build + lock.

### Expected touched paths (tentative)

```
src/renderers/workspace/
├── workspace-context.ts           ~   (cwd-inventory branch → <workspace> house style)
└── __tests__/
    ├── workspace-context.test.ts  +
    └── __previews__/              +   (after design approval)
src/workspace/cwd-inventory.ts     ?   (only if tree assembly needs richer inventory)
src/renderers/README.md            ~   (ledger row)
```

---

## Card 3 — `<specification>` context render (house style) + countTurnEntries audit

Status: blocked — design pass pending
Design: PENDING — finalize after Card 2's design pass fixes the dialect, then append the approved sketch here.

### Target Behavior

A `<specification>` section renders spec header/readiness (md), graph overview (existing `graph-slice`, embedded), ranked elicitation gaps (TOON), and the spec's sessions (TOON) with an **audited** turn count — golden-locked after design approval.

### Full-card cold-start reads

```
- memory/SPEC.md   — D83-L, D19-L, D60-L, D65-L/D75-L (gaps)
- memory/PLAN.md    — frontier: renderer-golden-coverage
- THIS card's appended Design sketch — REQUIRED before build
- src/renderers/{markdown,toon,tree,section}.ts          — Card 1 substrate
- src/renderers/graph/graph-slice.ts                     — graph overview to embed
- src/session/workspace-overview-context.ts              — sessions[] + countTurnEntries (AUDIT)
- src/session/agent-context-seed.ts                      — spec header / readiness estimate source
- the elicitation-gaps ranked read (read_elicitation_gaps) — gaps source
```

### Data sources (structural scope)

```
- Spec header : spec {id, title} + soft readiness estimate                  → md
- Graph overview: existing graph-slice render, embedded                     → (its own format; migrated later)
- Elicitation gaps: ranked read_elicitation_gaps {refersTo, question, …}    → TOON
- Sessions  : workspace-overview sessions[] filtered to THIS spec,
              {name, file, turnCount}                                       → TOON
```

### Sub-task: countTurnEntries audit (can be done independently / first)

```
- Verify src/session/workspace-overview-context.ts countTurnEntries against the CURRENT
  pi JSONL entry model before the session turn count is surfaced; fix if it rests on stale
  assumptions (D83-L open audit). Add/repair a unit test pinning the count for a fixture transcript.
```

### Invariants

```
- sessions are spec-scoped (a session binds to exactly one spec, D19-L)
- gaps and sessions render as TOON
- wrapped in <specification>…</specification>
```

### Acceptance Criteria (skeleton — finalized by the design pass)

```
✓ specification-section — render wrapped in <specification>: spec header + graph overview + ranked gaps + spec sessions.
✓ turn-count-audit      — countTurnEntries verified/fixed against the current JSONL model, with a pinning test.
✓ golden                — co-located golden locked AFTER the user approves the design sketch.
✓ invariant             — sessions spec-scoped; gaps + sessions are TOON.
```

### Design pass (REQUIRED before build)

Same checkpoint as Card 2; keep the dialect consistent with Card 2's approved shape.

### Expected touched paths (tentative)

```
src/renderers/specification/        +?   (new <specification> render home, or compose within session/workspace-overview)
└── __tests__/__previews__/         +
src/session/workspace-overview-context.ts  ~   (countTurnEntries audit; spec-scoped session list)
src/renderers/README.md             ~   (ledger row)
```

# Seam 1 READ — workspace context

Frontier: n/a (cross-cut READ seam; see `memory/CROSS_CUT_PLAN.md` §Seam 1)
Status:   done
Mode:     chain
Created:  2026-06-07

## Orientation

- **Seam:** Seam 1 — READ / context. Closes three ● ledger rows: workspace *tree + file
  counts*, *specs overview*, *sessions overview*. Sibling of the now-built graph-slices work
  (read_graph list/related modes, commits 67e986b8 / 62971be7 — disjoint code path).
- **Frontier item:** none — CROSS_CUT capability-surface slice. No new Linear issue/branch by
  default; attach to whatever branch is active when built.
- **Governing decision:** D60-L. The `cwd` agent-context subject = "filesystem kickoff
  heuristic — `.brunch?`, session count/length, README/markdown sizes, file counts"; its PULL
  is owned by `session/` and bypasses `CommandExecutor` (reads only).
- **Volatile state:** `src/.pi/extensions/context/get-cwd.ts` is a **concept stub** (design
  comment only, no implementation). `executor.listSpecs()` exists (`SpecRecord[]`); per-spec
  node count is available via `getGraphOverview(db, specId).nodes`; session files are
  enumerable via `session/workspace-session-coordinator/boot-session-store.ts`
  (exported `inspectCanonicalSessionFiles(cwd)`; the singular `inspectCanonicalSessionFile`
  is private). There is **no workspace-level reader** that aggregates
  specs-with-counts or sessions-with-grade today — `SpecScopedReaders` is per-spec (D61-L).
- **⚠ Fixture caveat (sessions-overview).** The `workspace-spread` seed set (render card
  Card A) is **graph-only** — `SeedFixture` is a graph contract (specs + nodes + edges) and
  deliberately does **not** model sessions (sessions are `.jsonl` files on disk, not graph
  truth). So `workspace-spread` exercises **specs-overview** (two specs, grade contrast,
  node counts), but **sessions-overview has no fixture**. Card B's sessions-overview must
  bind deterministic `.jsonl` sessions onto those two seeded specs (via the
  `boot-session-store` enumeration path) as its own test harness — do **not** widen
  `SeedFixture` to carry sessions.
- **Posture:** proving — each card lights up a new agent read path.
- **Design fork (resolved in Card B):** the specs/sessions overview stays an **agent-context
  pull** rendered for the elicitor, not a widening of `workspace.snapshot`. It reuses the same
  session-owned readers and the `read_workspace_context` tool surface introduced by Card A,
  but remains distinct from product/UI workspace projection state.
- **Cross-cutting obligations:** reads are read-only (no `CommandExecutor`); render projected
  handles (D62-L) where node identities appear; keep the read surface bounded to the three
  observed shapes (D60-L), not a generic workspace-query API.

---

## Card A — cwd kickoff snapshot (filesystem) — `done`

### Objective

The elicitor can read a deterministic filesystem kickoff heuristic for the launch directory:
1-level tree with nested file counts (honoring `.gitignore`), `.brunch?` + session-file
count/length, and markdown/README sizes — via a thin agent tool.

### Acceptance Criteria

```
✓ a session/-owned pull returns: presence of .brunch, session-file count and per-file
  length (lines or bytes), top-level entries with nested file counts, and markdown/README
  sizes — all deterministic, read-only
✓ .gitignore'd paths are excluded from the tree + counts
✓ exposed via a thin agent tool (mode/shape mirrors read_graph); rendered to LLM text +
  typed details (I33-L: markdown in content, JSON in details)
✓ an empty/cwd-with-no-.brunch returns a coherent "fresh workspace" snapshot, not an error
✓ get-cwd.ts stub is replaced by the real implementation (no dangling concept stub)
```

### Verification Approach

```
- Inner: session/ pull unit test over a temp dir fixture (with/without .brunch, with
  gitignored paths, with markdown files) — counts and exclusions asserted deterministically
- Inner: context extension tool test — tool returns rendered snapshot + typed details
- Render lock (optional): via the preview→lock harness once a renderer exists
```

### Cross-cutting obligations

```
- read-only filesystem pull; no CommandExecutor, no DB writes
- deterministic output (stable ordering) so it is snapshot-lockable
- gitignore-aware; do not leak ignored paths into counts or tree
```

### Assumption dependency

Depends on: D60-L `cwd` subject (designed), `boot-session-store` session enumeration (have).
Low risk. The gitignore-aware walk is the only net-new mechanism.

### Expected touched paths (tentative)

```
src/session/                         ~/+  (cwd kickoff pull: tree/counts/sizes, gitignore-aware)
src/.pi/extensions/context/get-cwd.ts ~   (replace concept stub with real tool wiring)
src/projections/workspace/           ?    (typed cwd snapshot shape, if not in session/)
src/renderers/workspace/             ?    (cwd snapshot renderer)
```

---

## Card B — specs & sessions overview (DB-backed) — `done`

### Objective

The elicitor can read a workspace overview: each spec with title, session count, and node
count; each session with turn count and readiness grade.

### Acceptance Criteria

```
✓ resolve the Card-B design fork (agent-context pull vs workspace-projection reuse) and record it
✓ a workspace-level reader lists specs with {title, sessionCount, nodeCount} (built on
  executor.listSpecs() + per-spec node count + session-file enumeration)
✓ lists sessions with {turnCount, grade} — exercised by binding deterministic .jsonl
  sessions onto the workspace-spread specs (NOT via SeedFixture; see fixture caveat)
✓ exposed via the agent tool (same surface as Card A); rendered to LLM text + typed details
✓ specs-overview: exercise with the graph-only workspace-spread fixture (two specs, grade
  contrast, node counts); a single-spec and a multi-spec workspace both render coherently
```

### Verification Approach

```
- Inner: workspace-reader unit test over a multi-spec seeded DB + session files — spec list,
  counts, and session turn/grade asserted
- Inner: tool test — overview modes return rendered text + typed details
- Render lock: via the preview→lock harness (workspace-spread fixture)
```

### Cross-cutting obligations

```
- read-only; no CommandExecutor; workspace-level reader does not break D61-L per-spec binding
  (it is a distinct workspace-scope reader, not a widening of SpecScopedReaders)
- bounded surface — overview shapes only, not a generic workspace query API (D60-L)
- if reusing workspace-projection readers, render to LLM text (not UI state); keep subjects distinct
```

### Assumption dependency

Depends on: Card A (shared tool surface), `executor.listSpecs()` (have), session enumeration
(have), the **workspace-spread fixture** (render card Card A). Medium risk — needs the design
fork resolved and a new workspace-scope reader.

### Expected touched paths (tentative)

```
src/graph/workspace-store.ts         ~    (workspace-scope reader: specs-with-counts) — OR
src/session/                         ~    (if sessions overview lives with session enumeration)
src/projections/workspace/           +    (specs/sessions overview projection)
src/renderers/workspace/             +    (overview renderer)
src/.pi/extensions/context/          ~    (overview modes on the workspace tool)
```

---

## Not in this file

- **graph slices** (kind/band/related) — built (read_graph list/related modes, commits 67e986b8 / 62971be7).
- **session context read** (binding + runtime frame) — built (`read_session_context` tool, commit b2a89e04).
- **IS_NOT / absence** (Q1) and **auto-feed / pushed surface** (○ deferred) — ledger rows
  parked pending decisions.

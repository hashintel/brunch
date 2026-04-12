# Handoff — 2026-04-12

## Phase in flow

```
grill ✓ → spec ✓ → plan ✓ → [design ✓] → scope ✓ → build ✓ → review ✓ → [sync]
```

- **Last completed skill**: `ln-review` — reviewed slices 17a and 14, no high-impact findings
- **Current skill**: `ln-handoff` + `ln-sync` (in progress)
- **Next action**: `/ln-sync` to refresh SPEC.md and PLAN.md after the implementation burst, then `/ln-scope` for slice 14a

## Session summary

Three slices landed plus a sync pass. The session started from the prior handoff which had slice 14's scope card ready.

1. **ln-sync** — Refreshed PLAN.md and SPEC.md. Trimmed slice 17 completion block to 4 lines, updated parallelism notes (17 done), updated dependency graph. Updated SPEC.md coverage table with actual test counts (interview.test.ts 10→11, InterviewWorkspace.test.tsx 21→22, workspace-loader.test.ts 2→3, export.test.ts 6→9, added manifest.test.ts).

2. **ln-scope → ln-build** for slice 17a (debug route removal + shiki decoupling):
   - Replaced `CodeBlock` in `tool.tsx` with plain `<pre><code>` for JSON rendering
   - Removed `preloadRichCodeHighlighter` from `markdown-rendering.tsx`
   - Removed `/debug` route from router
   - Deleted `ComponentDebug.tsx` + `debug-surface.tsx`
   - Created `ai-elements.stories.tsx` Ladle story with full showcase
   - Updated `build-boundary.test.ts` (no-shiki oracle, 1050KB budget) and `capability-boundaries.test.ts`
   - Retired invariant I30 (moot), updated I28/I29/I32
   - Commit: `78f7e89`

3. **ln-scope → ln-build** for slice 14 (local-first storage + npx distribution):
   - Created `project.ts` — `BrunchProject` interface, `findBrunchProject` (walk-up), `initBrunchProject`, `resolveBrunchProject`
   - Created `launcher.ts` — Express serving API + static dist/ on one port, opens browser
   - Created `cli.ts` — bin entry for `npx @hashintel/brunch`
   - Fixed `db.ts` — migrations path resolved via `import.meta.url` instead of relative `./drizzle`
   - Updated `index.ts` — dev server uses `resolveBrunchProject` when no `BRUNCH_DB` env var
   - Added `open` dependency, `bin` entry in `package.json`
   - 11 new tests (project.test.ts: 8, launcher.test.ts: 3)
   - New invariant I100 (project resolution + launcher seam)
   - Commits: `006b9b8`, `6306579`

4. **ln-review** of slices 17a and 14 — clean, no high-impact findings. One medium oracle gap: launcher-serves-static test doesn't create a mock dist/ (deferred to outer-loop manual testing).

## In-flight state

### Review findings (from ln-review, all deferred)

1. **tool.tsx: repeated `<pre><code>` pattern** — depth/low — three identical pre/code blocks in ToolInput/ToolOutput. Acceptable per YAGNI.
2. **launcher.test.ts unused import** — coupling/low — `writeFileSync` imported but unused.
3. **launcher-serves-static oracle gap** — oracle-coverage/medium — test 2 doesn't actually test static serving (no mock dist/). Deferred to outer-loop manual npx walkthrough.
4. **launcher.ts owns resolution + serving** — coupling/low — `launch(cwd)` does both project resolution and server setup. Fine for single caller.
5. **db.ts + launcher.ts: duplicated `__dirname` pattern** — coupling/low — standard ESM boilerplate, not worth abstracting.
6. **index.ts dev/production divergence** — depth/low — intentional, well-bounded.
7. **All oracle coverage met** except finding #3. Lexicon alignment clean.

### Key design insight preserved from prior session

(Carried forward from prior handoff — still relevant for 14a)
- Answered question cards are **read-only** — re-answering routes through the revisit model (Phase 8), not a casual UI toggle
- Primary blue needs adjustment to match Hash logo (lighter sky blue) — not yet resolved via Figma
- Badges should explore mono font — not yet implemented

## Priority note from user

The first delivery deadline is approaching. Priority order:
1. **Done**: slice 17 (UI refinement), slice 17a (shiki decoupling), slice 14 (local-first + npx)
2. **Must-have next**: slice 14a (brownfield/greenfield) — this must land
3. **Stretch**: slice 15 + 15a (knowledge-graph revisit) — may not land before deadline
4. **Deferred**: 13a (review lifecycle refinement), 16 (drizzle-kit audit)

## Persisted state

### Git
- **Branch**: `ln/fe-545-storage-and-distro`
- **Recent commits**: 6306579 → 006b9b8 → 415deb1 → 78f7e89
- **Working tree**: clean

### Artifacts
- `memory/SPEC.md` — **current** (coverage table updated, I30 retired, I28/I29/I32 updated, I100 added)
- `memory/PLAN.md` — **current** (slices 17a and 14 marked done, parallelism notes updated)
- `docs/design/LOCAL_STORAGE.md` — **current** (approved design, implemented in slice 14)

### Test status
264 tests: all pass. `npm run verify` green (0 lint errors, build succeeds).

## Resume prompt

```
I'm picking up from a build + review session. Read HANDOFF.md, then:
1. Run /ln-sync to refresh docs after the implementation burst (slices 17a + 14)
2. Then /ln-scope for slice 14a (greenfield/brownfield first-screen + exploration)

Key context: slice 14a depends on slice 14 which just landed. Branch is
ln/fe-545-storage-and-distro. The design doc is at docs/design/BROWNFIELD_EXPLORATION.md.

Priority: slice 14a is the last must-have for the first delivery deadline.
```

# Extract the foreground prompt-assembly core into a shared module

Frontier: subagent-reconciliation
Status:   done
Mode:     single
Created:  2026-06-24

## Orientation

- **Seam:** the foreground system-prompt assembly path (`src/.pi/extensions/system-prompts/compose.ts` + the skill-manifest loader in `src/.pi/extensions/runtime/state.ts`). Slice 2 lifts the kind-agnostic assembly pieces — `renderBrunchSkills` and the skill-manifest loader (`loadPromptResourceManifestEntries` / `skillToPromptResourceManifestEntry`) — into a module a background agent's assembled prompt (slice 3) can also consume. The foreground prompt must come out byte-identical.
- **Frontier:** `subagent-reconciliation` (SPEC D91-L names the reuse: the background prompt "reus[es] the foreground composer's extracted core (`renderBrunchSkills`, the skill-manifest loader, `composeAgentContextSeed`)"). Slice 2 of 6; gates slice 3 (background prompt assembly).
- **Handoff/finding (this session):** `composeAgentContextSeed` **already lives in the shared, non-foreground home** `src/session/agent-context-seed.ts` (its module comment explicitly separates it from system-prompt assembly). D91-L's list is stale on that one point — it is already extracted. So slice 2's real work is only `renderBrunchSkills` + the skill-manifest loader. The card challenges the third item per the first ladder rung rather than re-extracting what is already shared.
- **Open risk:** the golden tripwire (oracle 1). Four COMPOSE previews exist under `__previews__/`; the handoff warns *not all are trusted yet*. The extraction must be a pure code move (no output change), proven by an unchanged golden — but only where the golden is trusted; capture a fresh pre-extraction snapshot where it is not.

**Cross-cutting obligations (frontier-level):**
- Foreground prompt unchanged through the extraction — the golden tripwire IS the guard (D91-L / frontier acceptance).
- Preserve D39-L: the loader stays code-owned (`loadSkills({ ..., includeDefaults: false })` over explicit skill paths); no filesystem discovery is introduced by the move.
- Do NOT flip I29-L or the Subagent glossary row — they belong to slice 3.
- One branch per frontier (FE-1054); no separate issue/branch for this slice.

**Posture: proving (inherited from subagent-reconciliation).** Pure-refactor extraction is unusual for proving posture, but it scores on **invariants**: it stabilizes the shared assembly seam slice 3 depends on, and the extraction-purity oracle is the tracer that proves the move changed nothing. No new end-to-end path lights up here (that is slice 3); this slice's value is locating the seam under a no-drift guard.

## Target Behavior

`renderBrunchSkills` and the prompt-resource skill-manifest loader are exported from a kind-agnostic module that both the foreground composer and (future) background prompt assembly import, with the foreground composed prompt byte-identical to before the move.

Done 2026-06-24: `src/.pi/extensions/system-prompts/prompt-skills.ts` now exports `renderBrunchSkills`, `loadPromptResourceManifestEntries`, `skillToPromptResourceManifestEntry`, and the manifest types. `compose.ts` imports the renderer from that module; `runtime/state.ts` imports the loader while keeping `STRATEGY_RESOURCES` / `LENS_RESOURCES` / `METHOD_RESOURCES` eager in place. `composeAgentContextSeed` stayed untouched in `src/session/agent-context-seed.ts`.

## Full-card cold-start reads

```
- memory/SPEC.md   — D91-L (background prompt reuses the extracted composer core: renderBrunchSkills + skill-manifest loader + composeAgentContextSeed), D58-L (prompt-composition core / manifest emission), D85-L (two-axis <brunch-skills> manifest shape), I29-L/D44-L (current sealed shape — do NOT flip, slice 3 owns it)
- memory/PLAN.md    — frontier: subagent-reconciliation (slice 2 "extract the foreground assembly core … foreground prompt unchanged (golden tripwire)")
- src/.pi/extensions/system-prompts/compose.ts — renderBrunchSkills (private), composeAgentPrompt section order
- src/.pi/extensions/runtime/state.ts — loadPromptResourceManifestEntries / skillToPromptResourceManifestEntry (private), PromptResourceManifestEntry, the STRATEGY/LENS/METHOD_RESOURCES eager loads
- src/.pi/extensions/system-prompts/__tests__/compose.test.ts — the COMPOSE golden mechanism (toMatchFileSnapshot over __previews__/), expectPromptContracts invariants
- src/session/agent-context-seed.ts — composeAgentContextSeed (ALREADY shared; read to confirm no re-extraction needed)
```

## Boundary Crossings

```
→ src/.pi/extensions/runtime/state.ts        (skill-manifest loader: loadPromptResourceManifestEntries / skillToPromptResourceManifestEntry + PromptResourceManifestEntry type)
→ <new shared module>                         (loader + renderBrunchSkills, kind-agnostic)
→ src/.pi/extensions/system-prompts/compose.ts (imports renderBrunchSkills from the shared module instead of defining it)
→ foreground entrypoint unchanged: composeAgentPrompt → same prompt string
```

## Risks and Assumptions

```
- RISK: the extraction changes the composed prompt (foreground drift) — escapeXml, section join order, or eager-load timing subtly shifts output
    → MITIGATION: pure move — relocate the exact functions, re-export, change only import paths. Prove via the COMPOSE golden: run compose.test.ts; trusted previews must be byte-identical. This is oracle 1.
- RISK: a golden is in the "not yet trusted" set, so an unchanged snapshot proves nothing (the snapshot could be locking wrong output)
    → MITIGATION (oracle 1 caveat): before moving code, capture a FRESH pre-extraction snapshot of each preview's current output; after the move, assert byte-equality against that pre-snapshot — not just "the committed golden still matches." The pre-snapshot is a stability baseline (did THIS refactor change output), not a quality claim. Reuse the committed golden directly only where it is already trusted.
- RISK: the loader's eager module-level loads (STRATEGY_RESOURCES = loadPromptResourceManifestEntries(...)) have import-time side effects; moving the loader could change when/where they run
    → MITIGATION: keep the eager RESOURCE constants where they are consumed (state.ts) or co-locate them with the loader explicitly; the move is of the loader function, not necessarily its three eager call sites. Decide one home and keep import-time behavior identical.
- ASSUMPTION: composeAgentContextSeed needs NO extraction — it already lives in src/session/agent-context-seed.ts, outside the foreground-only path
    → IMPACT IF FALSE: minor — if slice 3 finds it still foreground-coupled, extract then; not this slice's burden
    → VALIDATE: confirmed this session — agent-context-seed.ts module comment explicitly separates it from system-prompt assembly; index.ts calls it for the bundle, compose.ts only splices. D91-L's inclusion of it in the "extract" list is stale.
    → [→ memory/SPEC.md D91-L]
- ASSUMPTION: a background prompt (slice 3) genuinely needs renderBrunchSkills + the loader (the extraction earns its place)
    → IMPACT IF FALSE: the extraction is speculative structure (ladder rung 1 violation)
    → VALIDATE: D91-L states the assembled background prompt carries "a <brunch-skills> manifest built from the manifest's skills grant" — renderBrunchSkills emits exactly that wrapper, and the loader produces the entries it needs. The reuse is named in SPEC, not anticipated. Build it.
```

## Posture check (proving)

- **Invariants:** stabilizes the shared prompt-assembly seam (the `<brunch-skills>` manifest emitter + loader) that slice 3's background prompt binds to. Landing it locates that seam under an explicit no-drift guard.
- **Tracer:** the extraction-purity oracle — foreground prompt byte-identical after the move — breaks if the "pure move" is not pure. That is the proof-of-life for the refactor.
- This slice does not light a new end-to-end path (slice 3 does); its proving value is the seam + the tripwire. No reshape needed: the slice already IS its own proof.

## Acceptance Criteria

```
✓ shared-module-home — renderBrunchSkills and loadPromptResourceManifestEntries / skillToPromptResourceManifestEntry (+ PromptResourceManifestEntry) live in one kind-agnostic module, exported for both foreground and background consumers
✓ compose-imports-shared — compose.ts imports renderBrunchSkills from the shared module; it no longer defines it privately
✓ loader-imports-shared — state.ts imports the skill-manifest loader from the shared module; the eager STRATEGY/LENS/METHOD_RESOURCES constants keep identical import-time behavior
✓ extraction-purity (oracle 1) — every trusted COMPOSE preview golden is byte-identical after the move; for any untrusted preview, output is byte-identical to a fresh pre-extraction snapshot captured before the code move
✓ context-seed-untouched — composeAgentContextSeed is NOT re-extracted (already shared); no churn to src/session/agent-context-seed.ts
✓ boundaries-hold — architecture.test.ts import-boundary rules still pass for the new module's location
✓ npm run verify passes
```

## Verification Approach

```
- Inner: extraction-purity golden — src/.pi/extensions/system-prompts/__tests__/compose.test.ts previews via toMatchFileSnapshot; trusted goldens byte-identical, untrusted goldens checked against a fresh pre-move snapshot (oracle 1). Plus expectPromptContracts invariants unchanged.
- Inner: import-boundary — architecture.test.ts confirms the shared module's home is boundary-legal (it must be importable by both .pi/extensions/system-prompts and .pi/extensions/subagents without inverting the dependency direction).
- Middle: none new — slice 2 is a refactor; behavioral coverage rides slice 3's seal oracle.
```

## Cross-cutting obligations

```
- Foreground prompt unchanged (the golden tripwire is the guard).
- Loader stays code-owned (loadSkills includeDefaults:false over explicit paths); no filesystem discovery introduced by the move (D39-L).
- Do NOT flip I29-L or the Subagent glossary row (slice 3).
- README reconciliation rides the slice that moves code: if the shared module gets a new home directory, note it in the nearest topology README this slice touches; full subagents/agents README reconciliation is slice 3.
```

## Expected touched paths (tentative)

```
src/.pi/extensions/system-prompts/
├── compose.ts                                    ~   (import renderBrunchSkills from shared module; drop private def + escapeXml if it moves with it)
├── prompt-skills.ts                              ?   (candidate shared-module home: renderBrunchSkills + loader + PromptResourceManifestEntry)
├── __tests__/compose.test.ts                     ~   (oracle-1 pre-snapshot scaffolding for untrusted previews, if needed)
src/.pi/extensions/runtime/
├── state.ts                                      ~   (import loader from shared module; keep eager RESOURCE constants' import-time behavior)
src/.pi/__tests__/
├── architecture.test.ts                          ?   (only if the new module's boundary expectation must be registered)
src/.pi/extensions/system-prompts/__previews__/   ?   (untouched if extraction is pure; present only as the assertion target)
```

Note on home: candidate is `src/.pi/extensions/system-prompts/prompt-skills.ts` (a sibling of `compose.ts`) since both kinds' prompt assembly is a system-prompt concern; an alternative is a shared file under `runtime/`. The build slice picks one that keeps `subagents` → shared-module import boundary-legal (subagents must not import the foreground-only `compose.ts`). Resolve at build time against `architecture.test.ts`.

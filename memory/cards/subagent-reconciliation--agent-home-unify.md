# Unify agent bodies under src/.pi/agents/<id>/ + renames (D90-L migration)

Frontier: subagent-reconciliation
Status:   done
Mode:     single
Created:  2026-06-24

Completed: 2026-06-24 — unified background bodies under `src/.pi/agents/<id>/SYSTEM.md`, renamed `scout`→`explorer` and `proposer`→`projector`, reclassified `reviewer` as a background manifest, preserved explicit registry discovery, and reconciled SPEC/PLAN + `.pi/agents` / `subagents` READMEs. Verification passed via `npm run check && npm run test && npm run build` after rebuilding the local `better-sqlite3` native module for the current Node ABI.

## Orientation

- **Seam:** the agent-body filesystem home + the background registry loader. Today foreground bodies live at `src/.pi/agents/<id>/SYSTEM.md` (flat, no frontmatter) while background bodies live at `src/.pi/extensions/subagents/agents/<id>.md` (frontmatter + body). D90-L's endpoint is **one home for both kinds** at `src/.pi/agents/<id>/SYSTEM.md`, discriminated only by the code-owned registry / `AgentManifest.kind` — nothing in the directory layout distinguishes foreground from background (confirmed with the user).
- **Frontier:** `subagent-reconciliation`. D90-L explicitly names this migration: "background agent bodies migrate from `src/.pi/extensions/subagents/agents/*.md` onto the canonical `src/.pi/agents/<id>/SYSTEM.md` convention, so SPEC carries one agent-body layout." Slice 3b; prerequisite for slice 6 (orchestrator body must live at `src/.pi/agents/orchestrator/`). Sequenced before the seal slice (3) to keep the body-path churn out of the seal logic.
- **User-confirmed renames (this session):** `scout` → `explorer`; `proposer` → `projector`; `reviewer` moves from foreground body to a **background** manifest (it is currently an unwired foreground `SYSTEM.md`). Pre-release posture: rename cleanly, no aliases, update all callers/tests/READMEs.
- **Open risk / disambiguation:** there is a **side-task `reviewer` drain** (D15-L/D25-L) in `src/session/prepare-next-turn.ts`, `src/projections/session/continuity-entry-classifier.ts` (`brunch.reviewer_drain`), and a D25-L citation in `src/.pi/extensions/compaction/index.ts` — these are a DIFFERENT concept from the `reviewer` *agent* and MUST NOT be touched. The agent-name refs are confined to the subagents subtree, its tests, and the two agent READMEs.

**Cross-cutting obligations (frontier-level):**
- Preserve D39-L: discovery stays code-owned (explicit registry id list; no `readdir`/scan reintroduced by the move). Frontmatter survives as background authoring DX (D90-L) — it is not a second agent model.
- Foreground prompt unchanged (the elicitor/pi-coder bodies are not edited by this slice; if a body file moves, content is byte-identical). The COMPOSE golden tripwire still guards.
- Do NOT flip I29-L or the Subagent glossary row — slice 3 owns the seal flip.
- One branch per frontier (FE-1054); no separate issue/branch.

**Posture: proving (inherited from subagent-reconciliation).** This is a structural materialization, not a probe. It scores on **invariants**: it locks D90-L's "one agent-body layout" into the file topology, retiring the two-home fragmentation. The tracer is mechanical — discovery still loads exactly the registry ids from the new home, and a planted unlisted body is still not spawnable (oracle 2 carried forward to the new path).

## Target Behavior

All agent bodies — foreground and background — live at `src/.pi/agents/<id>/SYSTEM.md` under one code-owned registry, with `scout`→`explorer`, `proposer`→`projector`, and `reviewer` reclassified as a background agent, and no `readdir` discovery anywhere.

## Full-card cold-start reads

```
- memory/SPEC.md   — D90-L (one agent-body layout; backgrounds migrate to src/.pi/agents/<id>/SYSTEM.md; frontmatter = authoring DX; code-owned discovery), D39-L (no filesystem discovery), I29-L (do NOT flip — slice 3); D15-L/D25-L (side-task reviewer drain — the OTHER reviewer, do not touch)
- memory/PLAN.md    — frontier: subagent-reconciliation (slice 3b body migration, prereq for slice 6 orchestrator standup)
- src/.pi/extensions/subagents/agents.ts — BACKGROUND_SUBAGENT_IDS, SubagentDefinition (extends BackgroundAgentManifest), parseSubagentMarkdown, loadSubagentDefinitions (per-file path), subagentAgentsDir
- src/.pi/extensions/runtime/state.ts — agentBodyResourceLocation (foreground body path resolver: ../../agents/<id>/SYSTEM.md)
- src/app/pi-subagents.ts — loadSubagentDefinitions(subagentAgentsDir()) call site
- src/.pi/agents/README.md + src/.pi/extensions/subagents/README.md — the two topology READMEs to reconcile to one home
```

## Boundary Crossings

```
→ src/.pi/agents/<id>/SYSTEM.md            (new unified home: explorer, researcher, projector, reviewer bodies land here with frontmatter)
→ src/.pi/extensions/subagents/agents.ts   (registry ids renamed; body-path resolver points at src/.pi/agents/<id>/SYSTEM.md; subagentAgentsDir retired/repointed)
→ src/app/pi-subagents.ts                  (call site follows the new dir resolution)
→ discovery: loadSubagentDefinitions over explicit ids from the unified home (no readdir)
```

## Risks and Assumptions

```
- RISK: sweeping "reviewer" rename hits the side-task reviewer drain (D15-L/D25-L) and breaks continuity
    → MITIGATION: the agent reviewer is confined to the subagents subtree + tests + agent READMEs. Do NOT touch src/session/prepare-next-turn.ts, src/projections/session/continuity-entry-classifier.ts (brunch.reviewer_drain), or the D25-L citation in compaction/index.ts. Verify by grepping the changed set excludes those paths.
- RISK: background bodies move home but lose frontmatter, breaking the registry contract
    → MITIGATION: D90-L keeps frontmatter as authoring DX. Move agents/<id>.md → agents/<id>/SYSTEM.md WITH its frontmatter intact; parseSubagentMarkdown still parses the frontmatter from the new SYSTEM.md file. The change is the path/filename, not the format.
- RISK: foreground and background bodies now share src/.pi/agents/<id>/; agentBodyResourceLocation (foreground) and the background loader could collide or diverge on path resolution
    → MITIGATION: one resolver for both kinds, or two that resolve to the identical convention. The registry (kind) is the discriminator, not the path. Confirm a foreground id and a background id resolve through the same <id>/SYSTEM.md rule.
- ASSUMPTION: reviewer's existing foreground SYSTEM.md body is acceptable as the background reviewer body (or is trivially adapted)
    → IMPACT IF FALSE: minor — the body may need a frontmatter block (name/description/tools/model/thinking) prepended to match background format; content can stay
    → VALIDATE: read src/.pi/agents/reviewer/SYSTEM.md; if it has no frontmatter, add one (tools per its read-only review role). This is authoring, not machinery.
- ASSUMPTION: subagentAgentsDir() can be retired/repointed without external consumers beyond pi-subagents.ts + index.ts re-export
    → IMPACT IF FALSE: a missed caller breaks at runtime
    → VALIDATE: grep confirms subagentAgentsDir is used only in agents.ts (def), index.ts (re-export), pi-subagents.ts (call). Safe to repoint.
    → [→ confirmed this session]
```

## Posture check (proving)

- **Invariants:** materializes D90-L's "one agent-body layout" into the file topology — the two-home fragmentation is retired, leaving one registry over one home. This is the closure of D90-L's migration clause into actual directory structure.
- **Tracer:** discovery still loads exactly the registry ids from the new home, and oracle 2 (planted unlisted body not spawnable) carries forward to the new path — both break if the move silently reintroduces scanning or misresolves the path.
- No new end-to-end path; the proving value is the locked topology + carried-forward sealing oracle. No reshape needed.

## Acceptance Criteria

```
✓ unified-home — explorer, researcher, projector, reviewer bodies live at src/.pi/agents/<id>/SYSTEM.md (frontmatter-bearing); the old src/.pi/extensions/subagents/agents/*.md files are deleted
✓ renames-complete — BACKGROUND_SUBAGENT_IDS is ['explorer', 'researcher', 'projector', 'reviewer']; no 'scout'/'proposer' agent ids remain; frontmatter name matches id (the registry id↔name check still holds)
✓ reviewer-reclassified — reviewer is a background manifest in the registry; src/.pi/agents/reviewer/SYSTEM.md carries background frontmatter; it is no longer a foreground role
✓ side-task-reviewer-untouched — brunch.reviewer_drain and the D15-L/D25-L side-task paths (prepare-next-turn.ts, continuity-entry-classifier.ts, compaction/index.ts) are unchanged
✓ code-owned-discovery-preserved — loadSubagentDefinitions resolves from explicit ids at the new home; no readdir/scan; oracle 2 (planted unlisted SYSTEM.md not spawnable) passes against the new path
✓ one-path-resolver — foreground and background bodies resolve through the same <id>/SYSTEM.md convention; kind is the discriminator
✓ readmes-reconciled — src/.pi/agents/README.md and src/.pi/extensions/subagents/README.md describe one home + the new ids; stale two-home/old-id prose removed
✓ npm run verify passes
```

## Verification Approach

```
- Inner: registry/discovery unit tests — subagents.test.ts updated to the new ids + new home path; oracle 2 (planted unlisted SYSTEM.md not spawnable) re-pointed; frontmatter id↔name check holds.
- Inner: import-boundary — architecture.test.ts still passes with the unified home (the runtime-registry-expectations rows that name future agent bodies may need re-pointing).
- Middle: foreground no-drift — COMPOSE goldens unchanged (elicitor/pi-coder bodies not edited; if reviewer's foreground body is removed from the foreground path, confirm no golden referenced it).
- Grep gate: the changed-file set excludes src/session/prepare-next-turn.ts, continuity-entry-classifier.ts, compaction/index.ts (side-task reviewer untouched).
```

## Cross-cutting obligations

```
- D39-L: code-owned discovery, no readdir, frontmatter = authoring DX only.
- Do NOT flip I29-L / Subagent glossary (slice 3).
- Do NOT touch the side-task reviewer drain (D15-L/D25-L) — different concept.
- references/<id>/ per agent is OPEN, not required — do not scaffold speculatively (user: add only if an agent has real reference material).
- One branch per frontier (FE-1054).
```

## Expected touched paths (tentative)

```
src/.pi/agents/
├── explorer/SYSTEM.md                            +   (from extensions/subagents/agents/scout.md, frontmatter kept, renamed)
├── researcher/SYSTEM.md                          +   (from extensions/subagents/agents/researcher.md)
├── projector/SYSTEM.md                           +   (from extensions/subagents/agents/proposer.md, renamed)
├── reviewer/SYSTEM.md                            ~   (reclassified fg→bg; add background frontmatter, keep content)
├── README.md                                     ~   (one home + new ids + kind-discriminated registry)
src/.pi/extensions/subagents/
├── agents/scout.md                               -   (moved/renamed)
├── agents/researcher.md                          -   (moved)
├── agents/proposer.md                            -   (moved/renamed)
├── agents.ts                                     ~   (ids → explorer/researcher/projector/reviewer; body-path → src/.pi/agents/<id>/SYSTEM.md; retire/repoint subagentAgentsDir)
├── index.ts                                      ~   (follow subagentAgentsDir change)
├── subagents.test.ts                             ~   (new ids, new home path, oracle 2 re-point)
├── README.md                                     ~   (one home + new ids; remove two-home/old-id prose)
src/app/
├── pi-subagents.ts                               ~   (dir resolution follows the unified home)
src/.pi/extensions/runtime/
├── state.ts                                      ?   (agentBodyResourceLocation: confirm it serves both kinds or stays foreground-only by convention)
src/.pi/__tests__/
├── architecture.test.ts                          ?   (runtime-registry-expectations rows naming future agent bodies, if they reference moved paths)
```

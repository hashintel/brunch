# Shared AgentManifest + collapsed op-mode source of truth + code-owned discovery

Frontier: subagent-reconciliation
Status:   done
Mode:     single
Created:  2026-06-24

## Orientation

- **Seam:** the agent-definition model. Slice 1 introduces the shared `AgentManifest` (`kind: "foreground" | "background"`) that every later slice in the frontier consumes; today foreground agents are defined three times (`kinds.ts` enums, `runtime-policy.ts` `OPERATIONAL_MODE_DEFINITIONS`/`AGENT_ROLE_DEFINITIONS`/`TOOL_POLICY_DEFINITIONS`, `state.ts` `AGENT_PROMPT_DEFINITIONS`) with `elicitor`'s `model`/`thinking`/`allowedStrategies`/`allowedLenses` hand-synced across two of them, and background agents are discovered by a `readdir` scan in `subagents/agents.ts`.
- **Frontier:** `subagent-reconciliation` (PLAN §Frontier Definitions; SPEC D90-L / D93-L). Slice 1 of 6; gates everything else. Linear/branch boundary is the frontier (FE-1054, `ln/fe-1054-subagent-reconciliation`).
- **Handoff state:** doc deltas are deliberately complete and must not be re-edited (SPEC D90-L–D93-L, I49-L, PLAN frontier all landed). I29-L and the Subagent glossary row are intentionally stale — they flip in **slice 3**, not here.
- **Open risk:** the collapse spans four files plus their consumers (`runtime-state.ts`, `compose.ts`, `pi-subagents.ts`, `subagents/index.ts`); the foreground prompt must not drift (full golden-tripwire guard is slice 2, but slice 1 must not change emitted manifest content either).

**Cross-cutting obligations (frontier-level):**
- Preserve D39-L ambient seal: discovery becomes an explicit code-owned registry id list (mirroring `loadSkills({ ..., includeDefaults: false })`); no filesystem scan, no `~/.pi`.
- Roster-shaped record: the op-mode-keyed record must make adding `execute`/`code` a single declarative entry (slice 6 is a pure declaration). It carries only `elicit`→`elicitor` now.
- Frontmatter survives as background-agent authoring DX; it is no longer a second agent model.

**Posture: proving (inherited from subagent-reconciliation).** This slice *locates and stabilizes* the load-bearing seam (the shared manifest) the whole frontier rests on, and retires a real unknown — whether the three-source collapse can hold one roster shape without foreground drift. Oracle 2 is the tracer (a planted unlisted agent must not be spawnable); it breaks if discovery is not actually code-owned.

## Target Behavior

Foreground and background agents are defined through one `AgentManifest` shape discriminated by `kind`, with foreground agents declared exactly once in a roster-shaped op-mode-keyed record and background agents resolved from an explicit code-owned registry id list — no field duplicated across `kinds.ts` / `runtime-policy.ts` / `state.ts`, and no `readdir` discovery.

## Full-card cold-start reads

```
- memory/SPEC.md   — D90-L (shared manifest + code-owned discovery), D93-L (op-mode↔foreground collapse, roster elicit/execute/code), D40-L (op_mode-derived foreground identity), D58-L (prompt-composition core); I49-L (delegatable-set boundary — field shape only this slice), I29-L/D44-L (current sealed shape — do NOT flip here, slice 3 owns it)
- memory/PLAN.md    — frontier: subagent-reconciliation (slice 1 of 6; acceptance "single source of truth + roster-ready")
- HANDOFF.md        — In-flight work (slice sequence), Cross-branch discipline (I29-L + glossary flip in slice 3, not now)
- src/.pi/extensions/subagents/README.md — current subagent topology (reconcile to unified model where this slice's code changes it; full reconciliation rides slice 3)
- src/.pi/agents/README.md — canonical foreground agent-body layout (SYSTEM.md convention)
```

## Boundary Crossings

```
→ src/session/schema/kinds.ts                          (id enums — AgentKind, manifest ids)
→ src/projections/session/runtime-policy.ts            (op-mode-keyed record: foreground manifest + tool policy + canDelegate)
→ src/.pi/extensions/runtime/state.ts                  (AGENT_PROMPT_DEFINITIONS folds into the shared manifest / loader)
→ src/.pi/extensions/subagents/agents.ts               (retire readdir; explicit registry id list → background manifests)
→ consumers: runtime-state.ts (resolve), compose.ts (definition lookup), pi-subagents.ts + subagents/index.ts (registry assembly)
```

## Risks and Assumptions

```
- RISK: collapsing AGENT_ROLE_DEFINITIONS + AGENT_PROMPT_DEFINITIONS changes emitted prompt-manifest content (foreground drift before slice 2's golden exists)
    → MITIGATION: keep the same field values; this slice is a structural re-home, not a content change. Run the existing compose.test.ts / prompt-composition goldens as the slice-1 guard; if a golden is in the "not yet trusted" set (oracle 1 caveat), eyeball the diff is empty rather than trusting the snapshot blindly.
- RISK: background frontmatter parsing (parseSubagentMarkdown) is still needed for DX, but discovery must stop scanning the directory
    → MITIGATION: keep parseSubagentMarkdown; replace loadSubagentDefinitions' readdir with an explicit id list that reads only the named files. Frontmatter stays the authoring surface; the id list is the registry.
- ASSUMPTION: op_mode↔foreground-agent is strictly 1:1 (D93-L), so defaultRole/allowedRoles collapse to a single foreground manifest per mode
    → IMPACT IF FALSE: the roster shape would need a many-roles-per-mode model, re-opening D93-L and reshaping every later slice's manifest consumption
    → VALIDATE: D93-L explicitly supersedes defaultRole/allowedRoles as a flexible many-roles model; only elicit/elicitor exists. Safe to build against.
    → [→ memory/SPEC.md D93-L]
- ASSUMPTION: canDelegate can be added to the manifest shape now and left empty for elicit (no delegatable background agents in read-only elicit, I49-L)
    → IMPACT IF FALSE: none material — the field is declared and unused until slice 4 wires the gate
    → VALIDATE: I49-L (status: planned) names canDelegate as the boundary; declaring the field now is the roster-ready groundwork.
```

## Posture check (proving)

- **Invariants:** locates/stabilizes the agent-definition seam — the single `AgentManifest` shape every later slice consumes. This is the foundational seam slice; nothing else in the frontier is buildable until it lands.
- **Uncertainty:** retires "can the three fragmented foreground sources collapse to one roster shape without foreground drift?" — the open question the frontier's proving posture names.
- **Proof of life (tracer):** oracle 2 — a planted unlisted `agents/*.md` is not spawnable — is a tracer that *breaks if discovery is not code-owned*. Landing it proves the readdir retirement is real, not cosmetic.

The slice is shaped so landing it *is* the proof of the collapse + code-owned-discovery claims. No spike needed.

## Acceptance Criteria

```
✓ agent-manifest-shape — one AgentManifest type discriminated by kind: "foreground" | "background"; foreground carries op_mode-derived identity, background carries authored identity; both carry a canDelegate set (empty for elicit)
✓ single-source-foreground — elicitor's model/thinking/allowedStrategies/allowedLenses appear in exactly one place; kinds.ts / runtime-policy.ts / state.ts no longer each restate them
✓ roster-ready — adding a foreground mode is one record entry (demonstrated by the record shape carrying only elicit→elicitor while typed for execute/code); op_mode↔foreground is 1:1
✓ code-owned-discovery — loadSubagentDefinitions resolves background agents from an explicit registry id list; no readdir/directory scan remains
✓ planted-unlisted-not-spawnable (oracle 2) — an agents/*.md not in the registry id list is not discovered and not spawnable (extends I24-L/I29-L sealing tests)
✓ frontmatter-preserved — parseSubagentMarkdown still validates background frontmatter as authoring DX; a malformed/duplicate-key frontmatter still fails loud
✓ no-foreground-drift — existing compose / prompt-composition goldens pass unchanged (structural re-home, not a content change)
✓ npm run verify passes
```

## Build Result

Status: done — implemented 2026-06-24.

- `AgentManifest` is shared through `src/session/schema/agent-manifest.ts`; foreground `elicit` now resolves from the op-mode-keyed `FOREGROUND_AGENT_ROSTER`, and background frontmatter projects into the same `kind: "background"` manifest shape.
- Background discovery is code-owned through `BACKGROUND_SUBAGENT_IDS`; `loadSubagentDefinitions` reads only listed ids and ignores planted unlisted markdown.
- Topology READMEs were reconciled for the manifest/discovery move only; SPEC D90-L/D93-L and PLAN design deltas were already complete.
- Verification: targeted slice tests passed; `npm run check` and `npx tsc -p tsconfig.build.json --noEmit` passed. `npm run test` is blocked by the existing `better-sqlite3` native module ABI mismatch (`NODE_MODULE_VERSION 137` vs required `147`), so the mutating `npm run verify` was not run in this shared worktree.

## Verification Approach

```
- Inner: unit/structural — AgentManifest shape + the collapsed record; loadSubagentDefinitions over an explicit id list; parseSubagentMarkdown still rejects malformed frontmatter. (extend src/.pi/extensions/subagents/subagents.test.ts)
- Inner: oracle 2 — planted-unlisted-agent-not-spawnable, alongside the existing sealing/discovery tests.
- Middle: foreground-prompt no-drift — existing compose.test.ts + prompt-composition goldens as the slice-1 tripwire (slice 2 adds the dedicated extraction-purity snapshot; here they only guard against accidental content change). Honor oracle 1's "not all COMPOSE goldens are trusted" caveat — eyeball an empty diff where the golden is untrusted.
```

## Cross-cutting obligations

```
- Preserve D39-L ambient seal: code-owned registry id list, no filesystem discovery, no ~/.pi.
- Roster shape must make slice 6 (execute/orchestrator + code/pi-coder) a pure declarative addition — no machinery change.
- Frontmatter is background authoring DX only, not a second agent model (D90-L).
- Do NOT flip I29-L or the Subagent glossary row — they belong to slice 3. README reconciliation rides the slice that moves the code; slice 1 touches subagents/agents.ts + the manifest, so reconcile only what this slice's code changes.
- One branch per frontier (FE-1054); no separate issue/branch for this slice.
```

## Expected touched paths (tentative)

```
src/session/schema/
├── kinds.ts                                      ~   (AgentKind + manifest id enums; roster typing)
src/projections/session/
├── runtime-policy.ts                             ~   (op-mode-keyed record: foreground manifest + tool policy + canDelegate; collapse role/mode defs)
├── runtime-state.ts                              ~   (resolve against the collapsed record)
src/.pi/extensions/runtime/
├── state.ts                                      ~   (AGENT_PROMPT_DEFINITIONS folds into shared manifest / loader)
src/.pi/extensions/subagents/
├── agents.ts                                     ~   (retire readdir; explicit registry id list; keep parseSubagentMarkdown)
├── index.ts                                      ~   (export/assemble from registry id list)
├── subagents.test.ts                             ~   (oracle 2 + code-owned discovery + frontmatter tests)
src/.pi/extensions/system-prompts/
├── compose.ts                                    ~   (definition lookup against the shared manifest)
src/app/
├── pi-subagents.ts                               ~   (assemble registry from id list, not subagentAgentsDir scan)
src/.pi/extensions/subagents/README.md            ?   (reconcile only the discovery/manifest change this slice makes)
src/session/schema/                                   (new shared AgentManifest module if it earns a home)
└── agent-manifest.ts                             ?
```

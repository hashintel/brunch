# Tool resolution + code-owned delegatable-set gate (D92-L / I49-L)

Frontier: subagent-reconciliation
Status:   done
Mode:     single
Created:  2026-06-24

## Orientation

- **Seam:** the subagent authority boundary — where the foreground op_mode decides **which background agents it may spawn**. Today the registrar (`src/.pi/extensions/subagents/index.ts`) advertises and runs **every** loaded definition (`agentCatalog(deps.definitions)`; `deps.definitions.get(entry.agent)`), so the spawnable set is "all of `BACKGROUND_SUBAGENT_IDS`" with no op_mode gate. This slice installs the **code-owned, op_mode-keyed delegatable-set allowlist** (D92-L) as the surviving safety boundary, generalizing the per-manifest `canDelegate` field (already on `AgentManifestBase`, `[]` for elicit) and enforcing it at both advertisement and execution.
- **Frontier item:** `subagent-reconciliation` (Linear FE-1054, branch `ln/fe-1054-subagent-reconciliation-ii`). Slice 4 of the 4→5→6 sequence; slices 1, 2, 3b, 3 are committed (through `e0c12d6e`).
- **Volatile handoff state:** build-the-machinery, **do not demo it** — no write-capable `worker` lands this branch; the orchestrator's `canDelegate` stays `[]` (slice 6). Slice 4's proof is **oracle 4** (a test-only write-capable manifest that `elicit` refuses to spawn), not a live capability-inversion demo. Sovereignty is already structurally true (the manifest authors `tools`, `planSubagentTools` resolves them) — this slice formalizes and asserts it, it does not re-architect tool grants.
- **Main open risk:** the slice-3 dev demo wires subagents under `context.dev` and advertises all agents. Gating on `canDelegate` while `elicit.canDelegate = []` would remove the explorer from elicit's spawnable set and silently break the dev path. The gate must be installed **with** elicit's delegatable set populated (read-only roster), so the demo's substance is preserved while the boundary becomes real.

**Cross-cutting obligations (frontier-level):**
- The allowlist is **code-owned** (lives in `FOREGROUND_AGENT_ROSTER` in `src/projections/session/runtime-policy.ts`), **never** frontmatter-authored — a manifest must not be able to self-advertise into a read-only op_mode (I49-L).
- Background tool grants stay **sovereign** (authored in the manifest `tools`, may exceed the parent's); the subset-containment model is rejected (D92-L). Do not reintroduce parent-subset filtering of child tools.
- Children still lack the `subagent` tool (no nesting); the ambient seal (D39-L) and spec isolation (I1-L) from slice 3 are untouched.
- `.pi/extensions/subagents/*` must not import `src/app/*` — the delegatable set is **injected** by the app root, like every other sealed primitive.
- One branch per frontier (FE-1054).

**Posture: proving (inherited from subagent-reconciliation).** Slice 4 **locates and stabilizes** the write-safety seam (I49-L) and **retires the load-bearing assumption** that delegation safety must come from tool-subset containment — it proves the negative-space boundary (spawnable(op_mode) == allowlist; frontmatter cannot widen it) **before** any write-capable agent or execute mode exists. Oracle 4 is the tracer: if the gate consults frontmatter instead of code, or admits an unlisted agent, the slice breaks.

## Target Behavior

A foreground op_mode can advertise and spawn only the background agents named in its code-owned delegatable-set allowlist, and a background manifest cannot widen that set from its own frontmatter.

## Full-card cold-start reads

```
- memory/SPEC.md   — D92-L (sovereign grants + code-owned op_mode-keyed delegatable-set gate), I49-L (delegatable-set is the write-safety boundary; frontmatter cannot self-advertise; test-only write-capable manifest refused by elicit), D90-L (shared manifest + canDelegate field), D40-L (registration ≠ advertisement), D39-L (ambient seal), I1-L (spec isolation), §Verification Design subagent-reconciliation oracle battery (oracle 4)
- memory/PLAN.md    — frontier: subagent-reconciliation (slice 4 line); Frontier Definitions §subagent-reconciliation
- HANDOFF.md        — slice 4 section (build-machinery-not-demo; orchestrator canDelegate=[]); the dev-gating runnable-path note
- src/projections/session/runtime-policy.ts — FOREGROUND_AGENT_ROSTER (elicit.foregroundAgent.canDelegate is the allowlist home); ResolvedBrunchAgentState; toolPolicyForRuntimeState pattern (where a delegatable resolver belongs)
- src/session/schema/agent-manifest.ts — AgentManifestBase.canDelegate, ForegroundAgentManifest, BackgroundAgentManifest
- src/.pi/extensions/subagents/index.ts — registerBrunchSubagents (agentCatalog + ParamsSchema agent enum + execute() definition lookup — the advertisement + execution sites to gate)
- src/.pi/extensions/subagents/session.ts — subagentToolPool / planSubagentTools (the tool catalog to converge; sovereignty already structural here)
- src/.pi/extensions/subagents/agents.ts — BACKGROUND_SUBAGENT_IDS, parseSubagentMarkdown (canDelegate forced [] for background — confirm frontmatter cannot author it)
- src/app/pi-subagents.ts — loadBrunchSubagents (where the injected delegatable set is threaded into BrunchSubagentsDeps)
- src/app/pi-extensions.ts — createBrunchPiExtensions opt-in channel (BRUNCH_SUBAGENT_TOOL advertisement; pass the op_mode's canDelegate)
- src/.pi/extensions/subagents/README.md — file map + startup wiring (reconcile the gate)
```

## Boundary Crossings

```
→ src/projections/session/runtime-policy.ts   (populate elicit.canDelegate with the read-only roster; add delegatableAgentsForRuntimeState resolver beside toolPolicyForRuntimeState)
→ src/app/{brunch-tui,pi-extensions,pi-subagents}.ts  (app root reads the active op_mode's canDelegate; injects it into BrunchSubagentsDeps; advertises subagent only when the set is non-empty)
→ BrunchSubagentsDeps                          (widen to carry the injected delegatableAgents allowlist)
→ registerBrunchSubagents                      (advertise = definitions ∩ allowlist; execute() refuses an agent not in the allowlist)
→ subagentToolPool / planSubagentTools         (converge the tool name→definition source so sovereign manifest grants resolve against one catalog; assert grants are not parent-filtered)
→ result: a non-allowlisted agent is neither advertised nor runnable (oracle 4)
```

## Risks and Assumptions

```
- RISK: gating on canDelegate while elicit.canDelegate = [] silently disables the slice-3 dev subagent demo (explorer no longer spawnable)
    → MITIGATION: populate elicit.canDelegate with the read-only background roster (explorer, researcher, projector, reviewer) IN THIS SLICE; the gate then preserves the demo's substance while becoming a real boundary. Verify the dev path still advertises explorer.
- RISK: the gate is read off frontmatter (BackgroundAgentManifest.canDelegate) instead of the code-owned foreground roster, letting a manifest self-advertise (I49-L violation)
    → MITIGATION: the spawnable set derives ONLY from FOREGROUND_AGENT_ROSTER[opMode].foregroundAgent.canDelegate, injected from the app root. parseSubagentMarkdown already forces background canDelegate = []; oracle 4 plants a write-capable manifest and asserts elicit refuses it.
- RISK: "converge subagentToolPool with the shared catalog" balloons into building a new global tool registry (capability-as-anticipation)
    → MITIGATION: minimum viable convergence — one shared name→definition (or name-set) source both the foreground tool wiring and subagentToolPool consume to validate/resolve sovereign grants. If no single catalog exists today, introduce the thinnest one that removes the duplicated hardcoded list; do not model tools that have no present grant. // ceiling: thin shared catalog, generalize when execute/code modes add tools (slice 6)
- ASSUMPTION: the active op_mode is resolvable at the point the subagent deps / advertisement are assembled (app root closes over the live session / runtime state)
    → IMPACT IF FALSE: the delegatable set cannot be keyed by op_mode at injection; falls back to a static elicit-only gate
    → VALIDATE: brunch-tui assembles subagents under context.dev with the live session in scope; only elicit is live, so the op_mode is effectively static this branch. Re-derivation on mode switch is a slice-6 concern. // ceiling: static op_mode at assembly, re-derive per active mode when execute/code land
    → [→ memory/SPEC.md D92-L; D93-L]
- ASSUMPTION: sovereignty needs no new code — manifests already author tools and planSubagentTools resolves them without parent filtering
    → IMPACT IF FALSE: a hidden parent-subset filter exists and must be removed to satisfy D92-L
    → VALIDATE: read planSubagentTools/subagentToolPool — confirm no parent-legal-set intersection; add a sovereignty assertion test (a manifest tool the parent lacks still resolves).
```

## Posture check (proving)

- **Proof of life:** n/a as a new end-to-end path (the path lit in slice 3); this slice proves a **negative-space** capability — that an unlisted agent is unreachable.
- **Invariants:** locates and stabilizes the I49-L write-safety seam — the delegatable-set allowlist becomes the single authority for spawnability, enforced at advertisement and execution.
- **Uncertainty:** retires the rejected subset-containment safety model (D92-L) by proving the allowlist boundary holds before any write-capable agent or execute mode exists.
- Tracer = oracle 4. The gate IS the proof; no reshape, no spike.

## Acceptance Criteria

```
✓ allowlist-resolver — delegatableAgentsForRuntimeState(state) returns the op_mode's foreground-manifest canDelegate (elicit → the read-only roster), sourced from FOREGROUND_AGENT_ROSTER, not frontmatter
✓ advertisement-gated — the subagent tool's agent enum + catalog list only (definitions ∩ the injected allowlist); a loaded-but-unlisted agent is not advertised (extends oracle 2 code-owned discovery)
✓ execution-refused — registerBrunchSubagents.execute() returns an error result for an agent not in the injected allowlist, even if a definition exists (the boundary is enforced at run, not just in the schema)
✓ frontmatter-cannot-self-advertise — a background manifest's own canDelegate stays [] and never widens the op_mode's spawnable set (I49-L)
✓ write-capable-refused — oracle 4: a test-only write-capable background manifest is refused by elicit (not in elicit.canDelegate); no execute-mode worker exists yet
✓ sovereign-grant — a background manifest may declare a tool the parent op_mode lacks and it still resolves (no parent-subset containment; D92-L)
✓ catalog-converged — subagentToolPool resolves sovereign grants against the shared tool catalog source, with no duplicated hardcoded tool list as the sole authority
✓ dev-demo-preserved — the slice-3 dev wiring still advertises explorer (elicit.canDelegate populated)
✓ docs-reconciled — subagents/README.md (+ SPEC I49-L coverage note) describe the code-owned delegatable-set gate
✓ npm run verify passes
```

## Verification Approach

```
- Middle (oracle 4, delegatable-set write-safety boundary): a deterministic test plants a TEST-ONLY write-capable background manifest (tools incl. write/edit) NOT in elicit's canDelegate; asserts (a) it is not advertised in the subagent tool schema/catalog, (b) execute() refuses it with an error result, (c) the read-only roster IS spawnable under elicit. Negative-space invariant: spawnable(op_mode) == allowlist.
- Inner: resolver unit — delegatableAgentsForRuntimeState returns elicit's canDelegate; never reads BackgroundAgentManifest.canDelegate.
- Inner: sovereignty unit — planSubagentTools resolves a manifest-authored tool the parent op_mode's policy excludes (no parent-subset filter).
- Inner: regression — existing subagents.test.ts sealing + spec-isolation assertions still hold; the dev-path advertisement still includes explorer.
```

## Cross-cutting obligations

```
- I49-L: the delegatable-set allowlist is the write-safety boundary; code-owned, op_mode-keyed; frontmatter cannot self-advertise.
- D92-L: sovereign per-agent tool grants; no parent-subset containment.
- D39-L / I1-L: ambient seal + spec isolation from slice 3 untouched.
- D40-L: registration ≠ advertisement — the gate refines advertisement, the tool stays registered default-off in non-subagent launches.
- Children still lack the subagent tool (no nesting).
- .pi/extensions/subagents/* never imports src/app/*; the allowlist is injected.
- One branch per frontier (FE-1054).
```

## Expected touched paths (tentative)

```
src/projections/session/
├── runtime-policy.ts            ~   (elicit.canDelegate ← read-only roster; add delegatableAgentsForRuntimeState resolver)
src/.pi/extensions/subagents/
├── index.ts                     ~   (advertise + execute gated by injected allowlist; widen BrunchSubagentsDeps)
├── session.ts                   ~   (converge subagentToolPool with shared catalog; sovereignty assertion surface)
├── subagents.test.ts            ~   (oracle 4 + resolver + sovereignty + dev-advertisement regression)
├── README.md                    ~   (delegatable-set gate; reconcile startup wiring)
src/app/
├── pi-subagents.ts              ~   (thread the op_mode's canDelegate into BrunchSubagentsDeps)
├── pi-extensions.ts             ~   (advertise BRUNCH_SUBAGENT_TOOL keyed to a non-empty delegatable set)
├── brunch-tui.ts                ?   (supply the active op_mode's canDelegate to the subagent deps assembly)
src/.pi/extensions/subagents/agents.ts  ?   (confirm/assert background canDelegate stays []; no widening path)
memory/SPEC.md                   ~   (I49-L: planned → covered once oracle 4 lands; D92-L pointer)
memory/PLAN.md                   ~   (slice 4 status; current execution pointer)
```

Note on slice-6 boundary: slice 4 owns the **machinery** (resolver, gate, sovereignty, shared catalog) but does NOT add the `execute`/`orchestrator` mode, a write-capable `worker`, or move `execute` out of `PLANNED_OPERATIONAL_MODE_IDS` — those are slice 6. Keep `orchestrator.canDelegate` out of scope here (it does not exist yet); the only roster edit is populating `elicit.canDelegate`.

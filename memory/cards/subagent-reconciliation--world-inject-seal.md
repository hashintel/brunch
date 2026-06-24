# Inject parent world reads + assembled background prompt (D91-L semi-permeable seal)

Frontier: subagent-reconciliation
Status:   done
Mode:     single
Created:  2026-06-24

## Orientation

- **Seam:** the sealed background child-session boundary (`src/.pi/extensions/subagents/session.ts` `runSubagent`) and its app-root assembly (`src/app/pi-subagents.ts`). Today the child is fully sealed: verbatim agent body as system prompt, no graph, no inherited world (D44-L/I29-L). This slice **reopens the seal semi-permeably** (D91-L): it stays closed against ambient leakage (in-memory auth/settings/session, no `~/.pi`) but opens to *explicitly injected* parent world — `GraphReaders` scoped to the parent `specId`, a spec/workspace seed, and a bounded session digest — and swaps the verbatim body for an **assembled** prompt.
- **Frontier:** `subagent-reconciliation`. **This is the slice where I29-L and the Subagent glossary row flip** from current-state to the new shape (the handoff/cross-branch discipline reserved them for here). D91-L's "Supersedes (on implementation)" clause activates now.
- **Prereqs (all landed):** slice 1 (shared manifest), slice 2 (extracted `renderBrunchSkills` + skill-manifest loader in `prompt-skills.ts`), slice 3b (unified agent home). `composeAgentContextSeed` is already shared in `src/session/agent-context-seed.ts`.
- **Open risk:** the asymmetric-read design (D91-L) is subtle — the **session digest** is a snapshot block baked into the prompt at spawn (snapshot-at-spawn, expensive, not re-pulled), while the **graph** is exposed as Brunch read *tools* the child calls on demand. Conflating these (e.g. baking the graph into the prompt, or exposing the digest as a live tool) breaks the design. Oracle 3 guards exactly this.

**Cross-cutting obligations (frontier-level):**
- Preserve D39-L ambient seal: world is **injected, never discovered**. The child still builds in-memory auth/settings/session and performs no `~/.pi` scan. The reopening is ONLY for app-root-supplied handles.
- Spec isolation (I1-L-style): the child's graph read tool returns the parent `specId`'s graph **and never a sibling spec**.
- Reuse the extracted composer core (`renderBrunchSkills`, the skill-manifest loader, `composeAgentContextSeed`) — do not re-implement; **minus** the foreground-only elicitation-recommendation block (D91-L).
- One branch per frontier (FE-1054).

**Posture: proving (inherited from subagent-reconciliation).** This is the frontier's **proof-of-life** slice: it lights up a new end-to-end path — a background agent that reads the parent world and returns findings. It also **closes** the largest open uncertainty (can the seal be reopened semi-permeably without ambient leakage?) and **retires** the D44-L/I29-L no-world assumption. Scores on all three proving axes. Oracle 3 is the tracer; if the assembled prompt lacks the world snapshot, or the child's graph tool leaks a sibling spec, or `details` reaches model context, the slice breaks.

## Target Behavior

A background subagent run receives an assembled (non-verbatim) system prompt carrying the injected parent world snapshot and reaches the parent `specId`'s graph through granted Brunch read tools, while the ambient seal stays closed and no sibling spec is reachable.

## Full-card cold-start reads

```
- memory/SPEC.md   — D91-L (semi-permeable seal: injected world, assembled prompt, snapshot-at-spawn, asymmetric reads — THIS slice activates its "Supersedes on implementation" clause), D39-L (ambient seal: injected-not-discovered), D60-L (pushed-context governance), D82-L (digest pattern), I1-L (spec isolation), I29-L (FLIP HERE — sealed-read-only → semi-permeable), the Subagent glossary row (FLIP HERE)
- memory/PLAN.md    — frontier: subagent-reconciliation (slice 3 "inject world reads + assembled background prompt; supersedes the D44-L/I29-L sealing clause")
- src/.pi/extensions/subagents/session.ts — runSubagent, SubagentSealedDeps, SubagentRunContext (the seal to reopen)
- src/app/pi-subagents.ts — loadBrunchSubagents (app-root assembly; where world handles are injected from the live session)
- src/.pi/extensions/graph/index.ts — GraphReaders shape, read_graph tool factory (the on-demand graph tool to grant the child)
- src/.pi/extensions/system-prompts/world-reads.ts — the foreground WorldReadCache PULL (graph + gaps), the pattern the child's snapshot reuses
- src/session/agent-context-seed.ts — composeAgentContextSeed (already shared; the world-snapshot block builder)
- src/.pi/extensions/system-prompts/prompt-skills.ts — renderBrunchSkills + loader (reuse for the <brunch-skills> block)
- src/app/brunch-tui.ts (~line 397) — how graphDeps (GraphReaders+specId), the live session, and workspace context are held at the app root (the injection source)
```

## Boundary Crossings

```
→ src/app/brunch-tui.ts / pi-subagents.ts   (app root: capture GraphReaders+specId, workspace seed, session digest via sessionManager.getBranch())
→ SubagentSealedDeps / RunSubagentInput      (widen to carry injected world: graphReads+specId, world seed, digest)
→ runSubagent                                (assemble prompt = body + bg control header + world snapshot + <brunch-skills> + router; grant graph read tools)
→ child AgentSession                          (system prompt now assembled; customTools include read_graph et al. scoped to parent specId)
→ child graph read tool → parent GraphReaders (parent specId ONLY — spec isolation)
→ result: tool-result content (findings) ; details render-only (slice 5 owns the renderer)
```

## Risks and Assumptions

```
- RISK: reopening the seal leaks ambient world (regresses D39-L)
    → MITIGATION: the reopening adds ONLY app-root-injected handles to SubagentSealedDeps; the in-memory auth/settings/session construction and no-~/.pi-discovery are untouched. Oracle 3 asserts the ambient seal is still closed.
- RISK: the child's graph read tool reaches a sibling spec (I1-L violation)
    → MITIGATION: the injected GraphReaders are scoped to the parent specId; the granted read tool binds that specId, never accepts a caller-chosen specId. Oracle 3 asserts a sibling spec is never returned.
- RISK: the assembled prompt drifts the foreground prompt (shared composer core is edited)
    → MITIGATION: reuse renderBrunchSkills/composeAgentContextSeed read-only; the background assembly is a NEW composition path, not an edit to composeAgentPrompt. Foreground COMPOSE goldens must stay byte-identical (tripwire).
- RISK: baking the graph into the prompt instead of exposing it as a tool (breaks the asymmetric-read design)
    → MITIGATION: per D91-L — session digest = snapshot block in the prompt; graph = on-demand tool. Implement exactly that split. Oracle 3 asserts the assembled prompt carries the digest/spec/workspace snapshot AND that the graph arrives via a tool call.
- ASSUMPTION: sessionManager.getBranch() (pi summarize.ts pattern) is reachable from the app root at spawn time to build the digest
    → IMPACT IF FALSE: the digest block is empty/unavailable; the seal still works for graph + spec/workspace seed but loses the conversation snapshot
    → VALIDATE: confirm the live session (liveAgentSession.current / sessionManager) is in scope where loadBrunchSubagents/the subagent deps are assembled; brunch-tui.ts already closes over liveAgentSession for command context.
    → [→ memory/SPEC.md D91-L; pi examples/extensions/summarize.ts]
- ASSUMPTION: granting read_graph (+ read_session_context / read_elicitation_gaps / read_reconciliation_needs) to the child is a tool-pool extension, not a new authority model
    → IMPACT IF FALSE: tool resolution needs the slice-4 delegatable/catalog convergence first
    → VALIDATE: slice 4 converges subagentToolPool with the shared catalog and adds the delegatable-set gate; this slice may add the graph read tools to subagentToolPool directly (sovereign grant per the background manifest's tools), with slice 4 generalizing. Keep the grant authored in the manifest's tools list (D92-L sovereign), not parent-derived.
```

## Posture check (proving)

- **Proof of life:** lights up the new end-to-end path — a background agent reads the parent graph + world snapshot and returns a digest as tool-result content. First time the seal is semi-permeable.
- **Invariants:** stabilizes the semi-permeable seal boundary (injected-not-discovered; spec-isolated; asymmetric reads; details render-only).
- **Uncertainty:** retires the D44-L/I29-L "no world, verbatim body" assumption — the load-bearing unknown of the whole frontier.
- Tracer = oracle 3. The slice IS the proof; no reshape, no spike.

## Acceptance Criteria

```
✓ assembled-prompt — the child system prompt is body + background control header (sealed child, delegated task, snapshot view) + world snapshot (digest + spec/workspace seed) + <brunch-skills> (from the manifest skills grant) + router rules; NOT the verbatim body; minus the foreground elicitation-recommendation block
✓ world-snapshot-present — a faux-provider background run's assembled prompt contains the injected session digest and spec/workspace seed (oracle 3)
✓ graph-via-tool — the child reaches the parent graph through a granted read tool (read_graph), on demand — not baked into the prompt (oracle 3, asymmetric-read design)
✓ spec-isolation — the child's graph read tool returns the parent specId's graph and NEVER a sibling spec (oracle 3, I1-L)
✓ ambient-seal-preserved — the child still builds in-memory auth/settings/session; no ~/.pi discovery; world is injected only (oracle 3, D39-L)
✓ result-content-details-split — findings return as tool-result content; details ({ agent, status, text, … }) is carried but render-only / never model context (renderer itself is slice 5)
✓ foreground-no-drift — COMPOSE goldens byte-identical (the shared composer core is reused, not edited)
✓ i29-flip — I29-L invariant + the Subagent glossary row updated to the semi-permeable shape; D91-L "Supersedes on implementation" reconciled; subagents/agents READMEs updated
✓ npm run verify passes
```

## Verification Approach

```
- Middle (oracle 3, semi-permeable seal): a faux-provider background run on the deterministic substrate asserts — (a) assembled prompt contains the world snapshot (digest + spec/workspace); (b) the child's graph read tool returns the parent specId's graph and never a sibling spec (seed two specs, assert isolation, mirrors I1-L); (c) ambient seal preserved (in-memory services, no ~/.pi); (d) result via tool-result content with details render-only.
- Inner: prompt-assembly unit — the background prompt assembler produces the expected section set (body + control header + snapshot + <brunch-skills> + router), minus the elicitation-recommendation block; reuses renderBrunchSkills/composeAgentContextSeed.
- Inner: foreground tripwire — COMPOSE goldens unchanged (compose.test.ts previews byte-identical).
- Inner: ambient-seal regression — existing subagents.test.ts sealed-service assertions still hold (no ambient base prompt / conversation / discovery).
```

## Cross-cutting obligations

```
- D39-L: world injected, never discovered; ambient seal stays closed.
- I1-L: spec isolation — parent specId only.
- Reuse the extracted composer core; do not fork or edit the foreground path (golden tripwire guards).
- Flip I29-L + Subagent glossary + reconcile D91-L pointer + subagents/agents READMEs IN THIS SLICE (the reserved flip).
- Write-capable children stay deferred (D92-L / slice 4); this slice grants READ tools only. A mutate_graph crossing back is named in D91-L but NOT built here.
- One branch per frontier (FE-1054).
```

## Expected touched paths (tentative)

```
src/.pi/extensions/subagents/
├── session.ts                                    ~   (reopen seal: widen deps for injected world; assemble prompt; grant graph read tools)
├── prompt-assembly.ts                            +   (background prompt assembler: control header + snapshot + reuse renderBrunchSkills/composeAgentContextSeed)
├── index.ts                                      ~   (thread injected-world deps through the registrar)
├── subagents.test.ts                             ~   (oracle 3: seal permeability, spec isolation, ambient-seal preserved, details render-only)
├── README.md                                     ~   (semi-permeable seal; reconcile from sealed-read-only)
src/app/
├── pi-subagents.ts                               ~   (inject GraphReaders+specId, workspace seed, session digest via getBranch())
├── brunch-tui.ts                                 ~   (supply live session/graphDeps/workspace to the subagent deps assembly)
src/.pi/extensions/graph/
├── index.ts                                      ?   (extract/expose the read_graph tool factory for child reuse, if not already reusable)
memory/SPEC.md                                    ~   (FLIP I29-L invariant + Subagent glossary row; reconcile D91-L pointer)
src/.pi/agents/README.md                          ?   (if the seal/world-read note belongs there)
```

Note on slice-4 boundary: this slice grants the graph **read** tools as a sovereign manifest-authored grant (D92-L), and may add them to `subagentToolPool` directly. Slice 4 owns converging `subagentToolPool` with the shared catalog and the op_mode delegatable-set gate — do not pull that gate forward here; keep this slice's grant manifest-authored and read-only.

# Scope Queue: ln-* skill rework — multi-card files + touched-paths manifests

Frontier: n/a (dev-workflow / skill-system change, not a `memory/PLAN.md` frontier item)
Status: active
Mode: serial-ish (Cards 1+2 implementation-independent; Card 3 textually depends on 1+2)
Created: 2026-06-03

## Context

Reworks the scope→build seam of the `ln-*` skill family to support concurrent scoping by multiple agents:

- **Storage:** move scope-card queues from single `memory/CARDS.md` → `memory/cards/<frontier-id>--<slug>.md` (multiple files per frontier permitted; one file = one independent concern or one serial mini-queue).
- **Default weighting:** multi-card preparation becomes a *bias when conditions met*, not a sanctioned exception. The hard anti-speculation gate stays — no card in a chain may depend on implementation findings from earlier cards.
- **Touched-paths manifest:** each scope card declares expected directories/files via `pseudo tree`. Path overlap between two proposed files = not independent → merge or reshape (overlap-as-independence-test).
- **Consumption:** `ln-build` uses hybrid selection (explicit file-path arg wins; else single active file = pick; else list + ask via `tool-ask-question`).
- **Lifecycle:** per-file deletion when chain exhausted or superseded; stale files tolerated temporarily; `ln-sync` sweeps.

Design synthesis lives in thread T-019e8c75-8051-73ee-a611-00c58c546cbe. Triangulated across user, this agent, oracle, and one other agent. Converged design notes in that thread.

---

## Card 1 — Rewrite `ln-scope` for multi-file scope storage

**Status:** done

### Target Behavior

`ln-scope` writes scope cards as files under `memory/cards/<frontier-id>--<slug>.md`, biases toward multi-card preparation when settled-seam + implementation-independence conditions hold, requires a tentative touched-paths manifest on every card, and rejects two proposed files for the same frontier if their declared touched paths overlap.

### Boundary Crossings

```
→ ln-scope SKILL.md (rewrite Prepared card queue, Storage, scope-card body, Traceability, Routing sections)
→ memory/cards/ directory convention (new)
→ pseudo tree notation (used inline by cards)
→ memory/PLAN.md frontier definition pointer (existing convention, lightweight)
```

### Risks and Assumptions

```
- RISK: Cold-reading agents will overproduce multi-card queues if the relaxed-default tone is too permissive → MITIGATION: keep the anti-speculation gate hard ("no card depends on earlier-card findings") and make it the first sentence of the multi-card section, not a footnote
- RISK: "Touched-paths overlap = not independent" rule gets applied mechanically and forces unnecessary serialization → MITIGATION: scope rule to *primary write paths*, allow shared read-only or test-fixture paths, give an example
- ASSUMPTION: Agents can reliably author pseudo tree blocks inline
    → IMPACT IF FALSE: scope cards become harder to write, friction increases
    → VALIDATE: examples in the rewritten SKILL.md; the pseudo skill is already well-documented
- ASSUMPTION: `<frontier-id>--<slug>.md` naming is legible when frontier id is "n/a" (skills/tooling work outside PLAN.md frontiers)
    → IMPACT IF FALSE: tooling-change card files have awkward names
    → VALIDATE: convention allows `dev--<slug>.md` or `tooling--<slug>.md` prefix when frontier-id is n/a (document this)
```

### Tracer-bullet check

- **Proof of life:** lights up the new scope-storage path end-to-end (file → ln-build consumption → cleanup).
- **Invariants:** establishes the seam for parallel-agent scope-card authorship.
- **Uncertainty:** retires the "single-file-collision under multi-agent scoping" pain.

Scores on all three. Build it.

### Acceptance Criteria

```
✓ ln-scope SKILL.md prescribes memory/cards/<frontier-id>--<slug>.md as the storage form for ALL scope cards (single or multi)
✓ ln-scope SKILL.md retains "scope the next honest slice" as the center of gravity, with multi-card preparation framed as a normal practice when conditions hold (not a sanctioned exception)
✓ ln-scope SKILL.md keeps the hard anti-speculation rule for within-file sequencing
✓ ln-scope SKILL.md adds an "Expected touched paths (tentative)" section to both full and (when non-trivial) light scope cards, using pseudo tree notation with + ~ - ? markers
✓ ln-scope SKILL.md documents the overlap-as-independence-test: two proposed files for one frontier with overlapping primary write paths must be merged or reshaped
✓ ln-scope SKILL.md documents the file metadata header (Frontier, Status, Mode, Created)
✓ ln-scope SKILL.md documents the `dev--<slug>.md` / `tooling--<slug>.md` naming fallback when frontier-id is n/a
✓ ln-scope SKILL.md updates the Routing recommendation language to point at memory/cards/ instead of memory/CARDS.md
```

### Verification Approach

```
- Inner: manual read of the rewritten SKILL.md — internally consistent, all sections cross-reference correctly, no orphan references to memory/CARDS.md remaining in this file
- Middle: invoke ln-scope on a synthetic task and confirm the loaded skill prompts the agent to write to memory/cards/ with a touched-paths section
```

### Cross-cutting obligations

```
- Preserve "frontier item = Linear issue + Graphite branch" boundary rule — multiple scope files per frontier do NOT imply multiple branches
- Preserve canonical-state authority of memory/SPEC.md + memory/PLAN.md
- Preserve pseudo skill conventions (don't invent new notation in scope cards)
```

### Expected touched paths (tentative)

```
.agents/skills/ln-scope/
└── SKILL.md   ~   [full rewrite of Prepared card queue, Storage, Traceability, Routing; add Expected touched paths section]
```

---

## Card 2 — Rewrite `ln-build` for multi-file consumption and stale-downstream invalidation

**Status:** next (independent of Card 1)

### Target Behavior

`ln-build` selects a scope-card file via hybrid policy (explicit arg / single active / ask), consumes cards from that file's queue, explicitly handles stale-downstream invalidation when one card's outcome invalidates later cards in the same file, and deletes the file when its chain is exhausted.

### Boundary Crossings

```
→ ln-build SKILL.md (rewrite Input, Re-enter, Serial execution mode, Retire derivative artifacts, Routing)
→ memory/cards/ directory (read + delete)
→ tool-ask-question (when multiple active files for one frontier)
→ memory/PLAN.md frontier definition (read lightweight "Active card files" pointer if present)
```

### Risks and Assumptions

```
- RISK: Hybrid selection ambiguity when multiple files exist for the same frontier and none specified → MITIGATION: always ask via tool-ask-question, list files with their next-ready card summary
- RISK: Stale-downstream cascade — Card A's outcome invalidates Cards B+C, agent silently continues to B → MITIGATION: explicit "if you cannot honestly verify B's premise still holds after A landed, mark B+ stale and route back to ln-scope" rule
- ASSUMPTION: Agents can recognize stale-downstream conditions without explicit machine signaling
    → IMPACT IF FALSE: builds wrong things based on invalidated premises
    → VALIDATE: rule is phrased as a re-orient checkpoint between cards in serial mode (read the next card's premise, verify it survives what you just learned)
```

### Tracer-bullet check

- **Proof of life:** consumes a card from memory/cards/ end-to-end.
- **Invariants:** establishes stale-invalidation semantics that were implicit before.

Scores on two axes. Build it.

### Acceptance Criteria

```
✓ ln-build SKILL.md replaces all references to memory/CARDS.md with memory/cards/<file> consumption
✓ ln-build SKILL.md documents the hybrid selection policy: explicit arg wins; else exactly one active file → pick; else list + ask
✓ ln-build SKILL.md documents stale-downstream invalidation as an explicit re-orient checkpoint between serial cards
✓ ln-build SKILL.md updates the per-file deletion rule: delete the consumed file when its chain is exhausted or superseded; never bulk-delete memory/cards/
✓ ln-build SKILL.md preserves the "if the card is already satisfied, do not manufacture a no-op build commit" rule
✓ ln-build SKILL.md preserves serial execution mode's stop conditions
```

### Verification Approach

```
- Inner: manual read — internally consistent, no orphan references to memory/CARDS.md
- Middle: cross-check with Card 1's ln-scope output to confirm storage names and conventions match
```

### Cross-cutting obligations

```
- Preserve TDD red-green-refactor inner loop
- Preserve canonical reconciliation discipline
- Preserve "file-scoped invocations only" rule from AGENTS.md (no bulk operations on memory/cards/)
```

### Expected touched paths (tentative)

```
.agents/skills/ln-build/
└── SKILL.md   ~   [rewrite Input, Re-enter, Serial execution mode, Retire derivative artifacts, Routing]
```

---

## Card 3 — Cross-reference sweep across ln-* skills, praxis docs, AGENTS.md

**Status:** next (depends on wording landed by Cards 1+2; scope is pre-scopable as mechanical sweep)

### Objective

Update every cross-reference to `memory/CARDS.md` across the ln-* skill family, praxis docs, and AGENTS.md to point at the new `memory/cards/<frontier-id>--<slug>.md` convention, with consistent terminology drawn from the rewritten ln-scope/ln-build.

### Acceptance Criteria

```
✓ No references to `memory/CARDS.md` remain outside Cards 1+2's output (verified by ripgrep: rg -n "CARDS\.md" returns empty in skills/docs)
✓ docs/praxis/ln-skills.md "Canonical state" table replaces the memory/CARDS.md row with a memory/cards/ row
✓ docs/praxis/graphite-workflow.md updates the prepared-queue paragraph to reference memory/cards/ and reaffirms that multiple files per frontier do not imply multiple branches
✓ AGENTS.md references to memory/CARDS.md (if any after sweep) are updated; "memory/cards/" added to the planning-doc list where appropriate
✓ ln-consult, ln-handoff (+ template), ln-sync, ln-plan (+ template), ln-oracles, planning-pr updated to reference memory/cards/
✓ memory/CARDS.md (the file currently holding this queue) is deleted after Card 3 lands and Card 3's own queue is complete — or migrated into a memory/cards/dev--ln-scope-build-rework.md file mid-sweep if that aids dogfooding; user-call at execution time
```

### Verification Approach

```
- Inner: `rg -n "CARDS\.md|memory/cards" .agents/skills/ docs/ AGENTS.md memory/` — review each hit, confirm consistency with Cards 1+2 wording
- Inner: spot-read each touched file for prose flow (terminology, capitalization)
- Middle: load ln-consult cold and confirm it routes correctly to memory/cards/ for prepared queues
```

### Cross-cutting obligations

```
- Preserve each skill's own canonical voice; mechanical replacement, not stylistic rewrite
- Preserve every existing rule that survives the storage change (don't accidentally drop discipline during text sweep)
```

### Assumption dependency

Depends on: Cards 1+2's final wording. Card 3 cannot land until 1+2 are merged.

### Promotion checklist

- [ ] requirement change — no
- [ ] new/retired assumption — no
- [ ] unvalidated high-impact assumption — no
- [ ] non-trivial design decision — no (decisions live in 1+2)
- [ ] seam-level invariant — no (invariants established in 1+2)
- [ ] frontier-level cross-cutting obligation — no
- [ ] >2 seams — no (one seam: cross-references)
- [ ] first touch in unfamiliar seam — no
- [ ] can't name containing seam — no

Stays light.

### Expected touched paths (tentative)

```
.agents/skills/
├── ln-consult/SKILL.md            ~
├── ln-handoff/
│   ├── SKILL.md                   ~
│   └── assets/handoff-template.md ~
├── ln-sync/SKILL.md               ~
├── ln-plan/
│   ├── SKILL.md                   ~
│   └── assets/plan-template.md    ~
├── ln-oracles/SKILL.md            ~
└── planning-pr/SKILL.md           ~  [verify, may be n/a]
docs/praxis/
├── ln-skills.md                   ~
└── graphite-workflow.md           ~
AGENTS.md                          ~  [verify wording in derivative-files paragraph]
memory/
└── CARDS.md                       -  [delete after queue exhausted; or migrate mid-sweep]
```

---
name: ln-execute
description: "Coordinate delegated execution of one focus — a PLAN frontier, active scope files, memory/REFACTOR.md, or a named concern — through ln-scoper/ln-builder agents, reviewing each unit independently."
argument-hint: "[frontier-id | scope-file-path | memory/REFACTOR.md | concern]"
disable-model-invocation: true
---

# Ln Execute

Drain one focus's **autonomous execution horizon**: delegate scoping to `ln-scoper`, building to `ln-builder`, independently review every returned unit, park owned gates, and stop at fog rather than inventing downstream work. The delegated skills carry the method — `ln-scope` (../ln-scope/SKILL.md) owns shape selection and card content; `ln-build` (../ln-build/SKILL.md) owns implementation, verification, acceptance, reconciliation, artifact lifecycle, and stop conditions. This skill owns only the seam between them: focus resolution, horizon classification, delegation packets, writer serialization, gate parking, and independent review.

A focus may be: a named frontier in `memory/PLAN.md`; one or more active scope files under `memory/cards/`; the active `memory/REFACTOR.md` plan; or a non-frontier concern represented by category-prefixed scope files (`dev--`, `tooling--`, `docs--`). Do not invent a PLAN frontier merely because an execution artifact exists.

## Harness contract and preflight

Delegation requires two project agents, defined per harness under the same names:

- `ln-scoper` — preloads `ln-scope`; returns scope file path(s) plus unresolved ambiguity
- `ln-builder` — preloads `ln-build`; returns completion evidence, commit identifiers, and touched paths

Both are user-less: when their loaded skill would ask a question or present routing options, they return it as their report instead of guessing. Harness-level properties (model, tool grants, research delegates) belong to the agent definitions, not to this skill. The symmetric project-local definitions live in `.claude/agents/`, `.pi/subagents/`, and `.codex/agents/`.

**Preflight — first action, before resolving the focus.** Check your own toolset: you need a subagent-delegation tool (`subagent` in Pi, `Agent` in Claude Code — whatever this harness names it) that can target agents named `ln-scoper` and `ln-builder`. Trust only what your tool surface actually offers: definition files on disk are not evidence, because the harness may have failed to load them. If the tool is absent or either agent name is not offered, report in one sentence exactly what is missing ("no subagent-delegation tool in my toolset" / "the delegation tool does not offer `ln-builder`") and stop. A missing delegation surface is a harness fault for the user to fix, never a puzzle to solve: do not hunt for another invocation path, do not drive agents through the shell, and do not scope or build inline — agent isolation is what makes the review independent.

Preflight settles *how* to delegate, once. From then on a delegation is one tool call whose input is the packet: compose the packet, invoke the tool, wait for the report. No further deliberation about whether or how to delegate is warranted.

This coordinator is deliberately limited to `ln-scope` and `ln-build`. When the horizon requires `ln-design`, `ln-diagnose`, `ln-oracles`, `ln-sync`, or another specialist method, classify that chain as **route-required** and continue any independent ready work. Do not impersonate the missing specialist or invent another agent path; report the route when it reaches the front of the remaining horizon.

## Resolve the focus

With an argument, resolve in order: exact `memory/PLAN.md` frontier id → exact artifact path under `memory/cards/` or `memory/REFACTOR.md` → a concern description to correlate with the conversation and active artifacts. Ask when multiple plausible matches remain.

Without an argument, inspect the conversation, active files under `memory/cards/`, and `memory/REFACTOR.md` when present; infer the smallest coherent focus and confirm it with the user before delegating.

## Run the focus

Work in a review-bounded loop. **Exactly one write-capable delegate may run at a time**: `ln-scoper` and `ln-builder` both count. Read-only delegation may overlap; scoping writes may not run beside a builder.

1. **Orient.** Read the canonical context for the focus: its `memory/PLAN.md` definition and sequencing (or all of `memory/REFACTOR.md`), plus `memory/SPEC.md`, `HANDOFF.md` if present, and the topology docs needed to identify posture, obligations, open risks, and the focus's completion condition. For a frontier focus, verify that the current branch matches its declared active branch before admitting a writer.
2. **Build the execution horizon.** Classify every outstanding obligation inside the focus; do not let whichever active file is easiest to see become the plan:
   - **ready artifact** — an active scope file or refactor item whose prerequisites hold;
   - **scopeable now** — captured intent determines a buildable shape without earlier-unit findings;
   - **sequentially blocked** — shape or legality depends on an earlier result; stop only that dependency chain;
   - **route-required** — needs `ln-design`, `ln-diagnose`, `ln-oracles`, `ln-sync`, `ln-spec`, `ln-plan`, or another method outside this coordinator;
   - **owned-deferrable gate** — agent/provider/browser/HITL evidence with a named owner and re-entry trigger; park it until the trigger holds;
   - **external owner** — another frontier or stream owns it;
   - **stale** — canonical residue to reconcile, not implementation work.

   Under proving posture, apply the epistemic horizon from `ln-plan/references/proving.md`: scope ahead only while the unit's shape is independent of unobserved findings. An active human-gated card does not outrank autonomous work merely because it already exists. The horizon is complete when every obligation is classified and each parked item names its owner and trigger; do not create a sidecar ledger for it.
3. **Select the next autonomous unit.** Prefer a ready artifact; otherwise take one scopeable-now obligation. Gate every scope file — pre-existing or fresh — for posture, cold-start-read completeness, write-path overlap, prerequisites, and required tool capabilities declared by the card. Among several ready artifacts, sequence dependencies and overlapping write manifests; autonomous disjoint work may continue while another chain is parked. Ask only when two ready choices have a real priority tradeoff canonical context cannot settle.
4. **Delegate scoping when needed.** With no suitable artifact and at least one scopeable-now obligation, delegate to `ln-scoper` with the packet below. It may author one unit or several genuinely independent, write-disjoint files whose shapes are fully determined now; it must not scope through fog or turn parked gates into build cards. Ensure no other writer is active, then review every returned scope for overlap, posture, cold-start reads, prerequisites, and horizon validity. Revise an invalidated refactor plan through `ln-refactor`, never `ln-scope`.
5. **Baseline and authorize working state.** Immediately before each writing delegation, inspect `git status --short`. Partition the baseline into:
   - **protected untouched paths** — pre-existing work the delegate must not modify; and
   - **authorized pre-existing paths** — active scope/plan files already modified or untracked that this unit may update, explicitly included in its tentative manifest. Authorize only changes known to belong to this execution or paths the user explicitly approves; ambiguity stays protected.

   Record the unit's allowed write manifest, including required canonical reconciliation paths. Fingerprint every protected path strongly enough to detect a second edit even when its `git status` code would stay unchanged (exact diff/content or a content hash), and preserve any baseline diff on authorized paths so the delegate cannot silently replace earlier work. A path cannot be both protected and authorized.
6. **Delegate one reviewable build unit.** Delegate to `ln-builder` with the packet below, from the repository root. For `Mode: sweep`, delegate exactly one row and return for review. For `Mode: slices` and refactor items, permit continuation only while `ln-build`'s stop conditions allow it. A missing child capability is a blocked report, not permission to find a workaround.
7. **Review claims and protected state independently.** Ensure the writer has stopped. Compare the repository with the recorded baseline first: any unexplained protected-path change blocks acceptance. Then inspect commits, diffs, acceptance evidence, verification, canonical reconciliation, skipped-test delta, and residual risk. Treat the report as claims, not completion; accept only when every claim is confirmed by repository evidence. A returned question blocks that unit; answer from canonical context or escalate rather than guessing.
8. **Recompute; park; continue.** After an accepted unit, recompute the whole horizon and revalidate every prepared downstream artifact. Park an owned-deferrable gate and continue independent ready/scopeable work. An ownerless deferral or a product decision required to shape all remaining work is **human decision needed** and stops. A route-required item blocks only its dependency chain; when no autonomous unit remains, report the required route instead of performing it inline.
9. **Stop with an honest terminal state.** Distinguish:
   - **focus complete** — its completion condition holds;
   - **autonomous horizon exhausted, owned gates outstanding** — all ready/scopeable work is done; list every gate with owner and trigger;
   - **route required** — remaining work needs a named specialist method;
   - **blocked/invalidated** — evidence or repository state prevents safe continuation; or
   - **human decision needed** — an unowned gate or product/policy choice controls the remaining horizon.

For `memory/REFACTOR.md`: its ordered `## Commits` items are already commit-sized reviewable units — never route them through `ln-scope`. Review cadence is a delegation-bound choice: **per-item** (delegate one item, review, repeat) or **batched** (the builder commits item by item under a continuation bound; the coordinator reviews the whole batch when it returns). Confirm the cadence with the user when the focus does not state it. After accepting an item, record completion using the plan's existing status convention (or prefix the item text with `[done]`); the loaded skills own final deletion of the exhausted plan.

Subagents are isolated: each receives only its delegation packet plus its one loaded skill — no session context. Transcribe into the packet every session-established decision, constraint, and exclusion the unit depends on; nothing else crosses.

## ln-scoper delegation packet

```md
Apply `ln-scope` to this work:

- Focus: <frontier id with its PLAN.md definition, or a precise concern objective>
- Selected horizon obligation: <the one scopeable-now obligation, or bounded independent set>
- Established context: <session decisions, constraints, exclusions, and parked gates this scope depends on, or `none`>
- Active scope files to overlap-test against: <`memory/cards/` paths, or `none`>
- Sequential boundary: <findings/results this scoping pass must not assume>
- Protected untouched paths: <exact paths from the baseline; coordinator retains their fingerprints, or `none`>
- Authorized pre-existing paths: <paths this scoping pass may update, or `none`>

Return the scope file path(s) written, their expected write manifests, and any unresolved ambiguity. Do not scope route-required, external-owner, or owned-deferrable items.
```

## ln-builder delegation packet

```md
Apply `ln-build` to <relative scope-file path | `memory/REFACTOR.md` directly>.

Build this reviewable execution unit:

- Selected unit: <card, sweep row, or quoted refactor commit item>
- Delegation bound: <next card | exactly one sweep row | this refactor item only | continuation while `ln-build` stop conditions permit>
- Established context: <session decisions and constraints not already in the scope file or refactor plan, or `none`>
- Refactor items only: treat the ordered commit items as prepared serial cards; the selected item is sufficient scope — do not invoke `ln-scope` or create a scope file.

Working-copy context:

- Protected untouched paths: <exact baseline paths; coordinator retains their fingerprints, or `none`>
- Authorized pre-existing paths: <already modified/untracked paths this unit may update, or `none`>
- Tentative allowed write manifest: <expected paths plus required canonical reconciliation paths>

The loaded `ln-build` skill is authoritative for implementation, verification, acceptance, reconciliation, artifact lifecycle, and stop conditions. Return its required completion evidence plus commit hashes/messages and files touched per commit.
```

## Interrupted delegation

Treat timeout or silence as interruption, not failure and not permission to launch a second writer.

1. Confirm the writer is no longer active; if uncertain, stop and ask.
2. Compare protected fingerprints/content and authorized-path diffs with the recorded baseline — not only `git status --short` — and preserve the interrupted diff.
3. Review and verify completed work normally.
4. If incomplete, delegate a fresh `ln-builder` to finish the existing diff, naming completed evidence and missing leaves; forbid restarting or reverting it.
5. Do not advance the execution state until the unit is verified and committed.

## Review decision

After inspecting the evidence, choose one:

- **accepted, continue** — claims match and another autonomous unit is ready or scopeable;
- **accepted, focus complete** — claims match and the focus's completion condition holds;
- **autonomous horizon exhausted, owned gates outstanding** — no autonomous unit remains; list each owner and trigger;
- **route required** — name the specialist method that owns the next dependency chain;
- **revision requested** — delegate a bounded correction naming exact findings;
- **rescope / revise refactor** — learning invalidated the prepared unit or changed the next best card, row, or refactor item;
- **route to `ln-spec` / `ln-plan`** — durable truth or frontier sequencing changed;
- **human decision needed** — an unowned gate or product/policy judgment controls the remaining horizon.

Report the decision, commits reviewed, verification evidence, protected-state comparison, parked gates, divergences or residual risk, and the recommended next action.

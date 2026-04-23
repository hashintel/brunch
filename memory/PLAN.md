<!-- PLAN.md — single source of truth for the live frontier.
     Created by ln-plan · Read by all skills · Updated by ln-build and ln-sync.
     Older completed work lives in docs/archive/PLAN_HISTORY.md. -->

# Plan

The live frontier remains **Track A — Interaction model**, centered on reusable interviewer-invoked context gathering. The interviewer now has format autonomy (D115 revised): it chooses whether to include options per-question based on conversational trajectory, with phase-aware submit gating and observer interpretation. Context gathering is now phase- and mode-agnostic: the interviewer can use preface cards + workspace exploration tools in any phase when cwd is available, not just brownfield grounding. Workflow-ownership extraction stays queued behind further interaction-model expansion.

## Active

### Track A — Interaction model

1. ~~**Reusable interviewer-invoked context gathering**~~ — **Done**: context gathering is now phase- and mode-agnostic. `present_preface` + exploration tools are available in all phases when `cwd` is present. "Grounding card" terminology replaced with "preface card" throughout code, tests, and canonical docs.
   - Traceability: D99, D30, D32, D83, D117; I101, I104.

## Next

### Track B — Runtime / workflow ownership

3. **Workflow ownership extraction** — extract the workflow projector/read path and transition/orchestration write path behind explicit runtime-owned seams now that the D113 lifecycle contract has a concrete proving slice.
   - Why now / unlocks: the runtime proving slice landed the deferred observer backlog seam without introducing a second durable workflow model. This cleanup can now separate transport, durable snapshot assembly, workflow projection, and workflow transition logic without guessing ahead.
   - Traceability: D110, D112, D113, D123; I24, I72, I104, I105.

4. **Continuous workspace / phase-addressable interview surface** — cumulative center pane with phase section navigation.
   - Why now / unlocks: still depends on workflow ownership extraction. Once read/write workflow ownership is explicit, a continuous workspace can adopt one chat runtime and section-addressable focus without adding new lifecycle ambiguity.
   - Traceability: A58; D86, D87, D103, D107, D110, D113, D114; I24, I102.

## Horizon

### Engagement / polish

- **Trigger-popover composer with symbol-activated auto-completion** — a persistent workspace composer textarea with character-triggered popover completions (e.g. `/` slash commands, `@` knowledge-item mentions, `#` phase/section references), built from existing `cmdk` + Radix primitives rather than importing `assistant-ui`. Feature watermark (from assistant-ui `ComposerTriggerPopover`): multiple coexisting trigger characters each with independent adapter/search, categorized + filterable item lists, directive-insert mode (leaves a chip/token in the input) vs action mode (executes and optionally strips the trigger text), keyboard navigation across categories and items, and composability with existing `PromptInput` / `InputGroup` primitives. The proving work is the generic trigger-popover mechanism and at least one concrete adapter (slash commands or knowledge mentions); additional adapters are incremental once the mechanism is proven.
  - Why now / unlocks: becomes viable only after the continuous-workspace surface establishes a persistent composer as the canonical input seam. Once that lands, this enriches the composer into a power-user interaction surface without changing the underlying structured-response contract.
  - Depends on: continuous-workspace-phase-addressable-interview-surface.
  - Traceability: A51, D89; extends the PromptInput primitive family in `src/client/components/ai-elements/`.

### Completion / reporting follow-ons

- Dashboard / result summaries and completeness metrics.

### Revisit / cascade

- Edit mode + cascade preview.
- Cascade execution + secondary thread lifecycle.

### Infrastructure / tooling / extensions

- Typed fixture-builder convergence for happy-path tests — unify happy-path review/interview test fixtures behind the same typed builders used by seed/walkthrough generation, while keeping raw inline literals only for negative/schema-invalid cases.
- Drizzle Kit audit remediation.
- Git-friendly file-based persistence representation for diffable specs.
- Headless interview driver for scripted end-to-end probes.
- MCP server adapter for core operations.

## Recently Completed

- [2026-04-23] Phase- and mode-agnostic context gathering — Done: `present_preface` + exploration tools available in all phases when `cwd` is present (not just brownfield grounding); lightweight context-gathering addendum appended to all phase prompts; "grounding card" terminology replaced with "preface card" in code, tests, and canonical docs. Verified: `npm run verify`. Watch: manual walkthrough of preface usage in design/review phases; future web-tool extensions slot into the same gate.
- [2026-04-23] Interviewer-autonomous question format with phase-aware gating — Done: revised D115 so the interviewer chooses whether to include options per-question (grounding starts open, adds suggestive options as the user narrows); observer interprets selections as resonance in grounding, commitment in design; ActiveQuestionCard has phase-aware submit gate (grounding requires free-text, design preserves selection-or-none), phase-aware "none of the above" copy, and phase-threaded rendering. Verified: `npm run verify`. Watch: validate in manual grounding walkthroughs that the interviewer exercises format autonomy well and that observer captures stay coherent.
- [2026-04-23] Brownfield workspace-analysis grounding brief parity / proving retired — Done: a real brownfield start confirmed that the grounding brief, paired question, and live activity chrome read as one coherent turn lifecycle, so the remaining uncertainty is no longer about startup parity. Verified: manual confirmation in a real brownfield run. Watch: reuse the same seam for later interviewer-invoked context gathering rather than inventing a second artifact family.
- [2026-04-23] Transcript activity chrome and workspace polish retired — Done: task activity now mirrors reasoning's auto-open/auto-collapse behavior, task/reasoning triggers can hide leading icons, live tool activity surfaces richer target details during streaming, the duplicate `src/components/ai-elements` tree was removed in favor of `src/client/components/ai-elements`, and workspace/review header layout polish landed. Verified: `npm run verify`. Watch: extend `extractToolDetail()` as new tool families need richer live targets.

Older history: `docs/archive/PLAN_HISTORY.md`

## Dependencies

```text
TRACK A — Interaction model
reusable-context-gathering  (active)

TRACK B — Runtime / workflow ownership
workflow-ownership-extraction
  └──→ continuous-workspace-phase-addressable-interview-surface
        └──→ trigger-popover-composer  (horizon / engagement)
```

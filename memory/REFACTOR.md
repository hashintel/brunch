## Problem Statement

Phase 4 established richer domain concepts — turn responses, phase-aware observer extraction, and a six-kind knowledge layer — but several important seams still speak the older model.

From a developer’s perspective, the same concept is represented multiple ways:
- the observer still reasons over a scalar answer summary instead of the structured turn response
- the live streamed question card is represented as a fabricated persisted turn with sentinel IDs and borrowed turn metadata
- the turn-response boundary is still named like a single-option selection flow
- the six knowledge kinds are re-declared across transport, context, persistence, and UI seams

This makes Phase 5 work riskier than it should be. New mode-closure and revisit work will have to thread through compatibility seams, duplicated ontology declarations, and client state that can represent impossible combinations.

## Solution

Refactor the Phase 4 foundation so the codebase speaks the Phase 4 domain model directly.

Target state:
- turn response is the canonical structured reply model for downstream consumers
- interviewer and observer context projection share one response-model seam
- live streamed questions render through a dedicated pending-question view model, not a fake persisted turn
- selection-oriented names are replaced with turn-response language
- knowledge-kind ordering, labels, and bucket definitions live behind one shared registry-style boundary

The goal is structural alignment, not feature expansion.

## Commits

1. [done] Add characterization coverage for the full turn-response and live-question seams so the refactor is protected by behavior-focused tests.
2. [done] Rename selection-oriented vocabulary to turn-response vocabulary across the core client/server boundary, keeping behavior unchanged.
3. [done] Extract one shared turn-response projection module and route both interviewer history and observer context through it instead of mixing structured and scalar seams ad hoc.
4. [done] Introduce a dedicated pending-question view model for streamed interviewer output and teach the workspace controller and workspace UI to render it without fabricating persisted turns.
   - Split turn-card state into an explicit union (`persisted turn` vs `pending question`) instead of fabricating a `ProjectStateTurn` with sentinel IDs and placeholder ancestry.
   - Rename remaining `live question` symbols to `pending question` language so the controller, view state, and tests match the refactor lexicon.
5. [done] Extract a shared knowledge-kind registry that owns ordering, labels, empty-state copy, and collection metadata for the six knowledge kinds, then adopt it across observer output, context projection, transport payloads, and sidebar rendering.
6. [done] Remove any temporary compatibility shims left by the rename/extraction sequence so the final interfaces speak only the refactored domain language.

## Decisions

- Build a shared turn-response projection boundary that owns canonical read access to selected options and free-text response content.
- Treat persisted answer text as display/compatibility copy, not the semantic source of truth for downstream model consumers.
- Represent live streamed interviewer questions as a distinct pending-question state rather than a partially invented turn record.
- Consolidate knowledge-kind metadata behind one registry-style module rather than repeating six parallel arrays and object shapes across layers.
- Prefer domain-language alignment now because upcoming readiness, review, and revisit work will multiply the cost of keeping old selection/entity terminology alive.
- Avoid schema changes unless they become necessary during implementation; this should be primarily a module/interface refactor.

## Testing Decisions

- Good tests here protect behavior at the seams: submit a turn response, rebuild context, stream a pending question, refresh durable state, and render knowledge collections without ontology drift.
- The most important coverage is characterization around response projection, workspace controller view-state derivation, observer context construction, and sidebar knowledge projection.
- Prior art already exists in the current targeted suites for app integration, parts round-trip, observer behavior, workspace controller behavior, workspace route behavior, and context projection; extend those suites rather than inventing a new test style.
- Add at least one stitched round-trip oracle that proves structured turn responses survive submit → persistence → reload → hydration → context projection coherently.
- After the shared response seam lands, extend that round-trip protection to the observer path too — not just interviewer history — so downstream consumers are protected by one middle-loop oracle family.

## Review Synthesis (2026-04-08)

- The highest-impact remaining structural smell is the workspace controller's fake persisted-turn model for streamed interviewer output. Commit 4 should remove sentinel IDs, negative option IDs, and borrowed turn ancestry by introducing a dedicated pending-question view model.
- Remaining `live question` terminology now fights the target domain language in this refactor. Commit 4 should finish the rename as part of the model split instead of leaving a mixed vocabulary behind.
- The six-knowledge-kind ontology is still duplicated across server projection, client state, and UI tabs. Commit 5 should extract one registry that owns ordering, labels, and collection metadata so these seams stop moving together.
- The shared turn-response projection seam now has unit coverage on both consumers, but a later stitched observer-path round-trip oracle should close the remaining middle-loop gap.

## Out of Scope

- Any new workflow-mode behavior for explicit phase outcomes, review lifecycle, or revisit invalidation.
- Changes to the observer’s qualitative extraction policy beyond what is required to consume the shared response projection.
- New knowledge graph write models or generic graph-edge persistence.
- UI redesign of the workspace or sidebar beyond what is required to support the refactored view models.
- External API hardening for third-party consumers.

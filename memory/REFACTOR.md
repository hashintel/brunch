## Problem Statement

The merged-stream cutover is structurally much healthier, but four seams still keep the old model alive.

First, state reads still fabricate frontier/control rows, so hydration and resume are not projection-only. Second, phase intents are preflighted through a typed endpoint but still executed through a string-command bridge, which keeps behavior coupled to exact copy. Third, persisted parts are still only JSON-safe rather than schema-safe at the cross-restart boundary. Fourth, handoff/completion artifacts still sit outside the ordered stream projection, so the workspace stream is not yet one fully unified artifact list.

Two alternatives are worth calling out:

- Keep the current text bridge and treat it as a permanent protocol. This is the lowest-effort option, but it preserves hidden coupling between copy, replay markers, and control behavior.
- Move phase entry/continue to a fully server-owned progression endpoint. This is cleaner in one sense, but it widens the refactor because it changes how transcript-visible user control actions enter the chat/runtime seam.

Recommended direction: keep transcript-visible control actions, but make them typed end-to-end and make read-model projection pure.

## Solution

The target state is a projector-first runtime where reading specification state never writes control artifacts, phase intents travel through a typed control contract instead of magic text, persisted parts are validated once at the restart/projection boundary, and handoff/completion artifacts live inside one ordered workspace-stream model.

The runtime host remains responsible for transitional compatibility with legacy control rows, but that compatibility becomes fully hidden behind mutation-time/runtime seams rather than surfacing through reads or view logic.

## Commits / Status

1. [done] Add characterization coverage for the remaining risky seams: state reads must not create frontier/control artifacts, invalid persisted part shapes must degrade safely, typed phase intents must not depend on exact display copy, and closed-phase handoff/completion ordering must remain stable.  
   - Landed in `875a88a` — `test: characterize remaining projector seams`
2. [done] Introduce one validated persisted-part decoding seam and route existing read-model helpers through it so cross-restart payloads are schema-checked once before projection logic consumes them.  
   - Landed in `7bf631b` — `refactor: validate persisted part reads`
3. [done] Split projection from reseeding by making specification-state reads pure and moving frontier/control-row fabrication behind explicit runtime-host or mutation-time entry points only.  
   - Landed in `7ac034e` — `refactor: keep project-state reads pure`
4. [done] Replace the phase-intent message-text bridge with a typed control submission contract that preserves transcript-visible control actions without depending on exact command strings.  
   - Landed in this commit — `refactor: type phase-intent control submissions`
5. [done] Fold handoff and workflow-complete artifacts into the ordered workspace-stream projection and add the minimal phase-marker/control-marker artifact support needed so the stream contract is complete.  
   - Landed in this commit — `refactor: fold terminal artifacts into workspace stream`
6. [pending] Remove obsolete string-matching control-marker heuristics and transitional adapter branches that became unnecessary once typed control submission and pure reads are in place.

## Decisions

- Prefer typed control submission over a permanently string-driven protocol.
- Keep transitional control-row compatibility hidden in the runtime host until storage cleanup can happen separately.
- Treat persisted assistant/user parts as a true restart boundary that deserves schema validation exactly once.
- Make the workspace stream the single ordered artifact model, even if some artifacts are rendered with footer-like styling.
- Do not remove legacy stored control rows in this refactor unless a later slice explicitly owns that migration.

## Testing Decisions

- Good tests here prove behavior at the contract boundary: read paths stay read-only, typed phase intents trigger the right runtime behavior, malformed persisted payloads do not leak bad shapes into projection, and closed/open phases render the right ordered artifact family.
- Focus tests on runtime state projection, phase-intent execution, persisted-part decoding, and workspace-stream ordering.
- Prior art already exists in the current projector, route, controller, and fixture tests, so the first commit should extend those seams rather than introduce a brand-new harness.
- Manual seeded reload checks still matter after the refactor, especially for kickoff-ready and recovery-ready resume states.

## Out of Scope

- Product-vocabulary renaming work.
- Full removal or migration of legacy stored control rows.
- New close-phase modal UX.
- Export-route refinement beyond whatever is needed to keep workflow-complete projection coherent.
- Broader transcript-fidelity improvements unrelated to the specific projection/runtime seams above.

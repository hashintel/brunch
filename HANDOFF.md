# Handoff

> Refreshed by `ln-sync` at 2026-05-29. This file is volatile transfer state only.
> Delete or overwrite it once the next session scopes/builds the web real-time observation slice or creates a newer handoff.

## Goal

Finish FE-744 by closing the remaining Pi-wrapping proof seams after public RPC structured-exchange parity: web real-time structured-exchange observation, then branded/themed chrome recovery.

## Session State

- **Last completed implementation flow:** builder completed the FE-744 RPC parity hardening queue after the ten-turn parity proof.
- **Current skill:** `ln-sync` — reconciling canonical docs and refreshing this handoff.
- **Flow position:** `scope → build ×4 → review → scope hardening queue → build ×3 → sync/handoff`.
- **Branch:** `ln/fe-744-pi-ui-extension-patterns`.

## Completed Since Previous Handoff

### Public RPC tuple parity queue

- `5fa4ab45` — Implement structured exchange request choices
- `7f4c6318` — Project structured exchange tuples
- `929ea746` — Move RPC elicitation onto tuple truth
- `5e323437` — Add public RPC parity proof

### Review hardening queue

- `faa4dbc2` — Harden public RPC parity exchange identity
- `f1216fbc` — Close pending exchange on terminal request status
- `a9b3abb9` — Preserve option artifacts in RPC parity

The builder reported `npm run verify` passed after the final hardening slice, and `memory/CARDS.md` was deleted as exhausted.

## Current Canonical State

- Public RPC parity is now a landed FE-744 baseline, not open scope.
- `rpc.discover`, `workspace.selectionState`, `workspace.activate`, `session.startElicitation`, `session.pendingExchange`, `elicitation.respond`, `session.elicitationExchanges`, and `session.transcriptDisplay` form the public proof surface.
- `src/probes/public-rpc-parity-proof.ts` drives ten **distinct** assistant-first structured exchanges from a fresh cwd through Brunch JSON-RPC only.
- Tuple-shaped transcript truth is the active model: `present_question`, `present_options`, `request_answer`, `request_choice`, and `request_choices` are registered structured-exchange tools; review/candidate tools remain named stubs.
- Hardened projection behavior: matching terminal `answered`, `cancelled`, and `unavailable` request tuples close pending exchanges; option `content` and optional `rationale` survive public pending/proof projections.
- `memory/PLAN.md`, `memory/SPEC.md`, and `docs/architecture/pi-ui-extension-patterns.md` have been refreshed in this sync to reflect that parity/hardening has landed.

## Next Scope Target

The next actionable item is still inside the FE-744 `pi-ui-extension-patterns` frontier:

> Scope the web real-time structured-exchange observation smoke: a browser/web client observes selected session/exchange state updating when TUI or public RPC interactions append tuple-shaped structured-exchange transcript truth.

Suggested acceptance shape:

- Web client subscribes or otherwise observes the currently selected spec/session state over the Brunch public surface.
- Starting/responding to a structured exchange through public RPC updates the browser view without a manual reload.
- The smoke covers pending exchange appearance, response/closure, transcript display/exchange projection change, and selected session identity.
- The proof stays read/observe-only from the web side unless an explicit product write path is already scoped.

After that, recover branded/themed chrome before FE-744 closeout by inspecting the retired probe implementation named in `memory/PLAN.md`:

```sh
git show 6c2e3823:.pi/extensions/brunch-chrome.ts
```

## Decisions and Assumptions

| Item | Status | Source |
| --- | --- | --- |
| Structured exchanges are durable `present_*` / `request_*` `toolResult` tuples; `renderCall` is transient. | persisted | `memory/SPEC.md` D37-L / I23-L |
| Public Brunch RPC can drive ten assistant-first structured exchanges without raw Pi RPC or a parallel prompt/turn store. | validated | `memory/SPEC.md` A23-L / I32-L; `src/probes/public-rpc-parity-proof.ts` |
| `request_choices` is now implemented and registered; multi-choice uses JSON-editor fallback semantics where needed. | persisted | `memory/SPEC.md` I23-L; structured-exchange tests |
| Matching `cancelled` and `unavailable` request tuples are terminal for projection/pending state. | persisted | `memory/SPEC.md` I23-L; projection tests |
| RPC event consumers should not assume request `tool_execution_start` precedes request extension UI. | persisted | `memory/SPEC.md` D37-L; `docs/architecture/pi-ui-extension-patterns.md` |
| Questionnaire/multi-question surfaces and distinct `skipped` terminal state remain deferred. | persisted | `memory/SPEC.md` R17 / lexicon |

## Artifact Status

| Artifact | Status |
| --- | --- |
| `memory/SPEC.md` | refreshed; A23/I23/I32 updated for landed parity/hardening |
| `memory/PLAN.md` | refreshed; FE-744 pointer now names web observation then chrome recovery |
| `docs/architecture/pi-ui-extension-patterns.md` | refreshed; no longer says ten-turn public RPC parity is missing |
| `memory/CARDS.md` | absent; last hardening queue exhausted and deleted |
| `memory/REFACTOR.md` | absent |
| `HANDOFF.md` | this volatile handoff |

## Repo State Notes

- At the start of sync, git status was clean and the branch was ahead of origin by 7 commits.
- This sync intentionally edits canonical docs plus this handoff; commit or discard those doc edits according to the session plan.
- No code changes were made in this sync.

## Resume Prompt

> Read `memory/SPEC.md`, the FE-744 section of `memory/PLAN.md`, and `HANDOFF.md`.
> Public RPC structured-exchange parity and its review hardening have landed. The immediate next step is `/ln-scope` for web real-time structured-exchange observation smoke inside FE-744. Preserve tuple-shaped transcript truth, public Brunch RPC boundaries, and the read-only observer posture for web unless a write path is explicitly scoped.

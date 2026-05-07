# Agent Mutation Surface Audit

Status: FE-698 design audit, 2026-05-07.

## Purpose

Requirement 42 and D143 establish a hard boundary: durable Brunch data mutations initiated by agents must enter through Brunch-owned handlers, not direct ORM access or harness-specific tool implementations. This document inventories the current mutation paths that are agent-originated or agent-adjacent, names the semantic operations behind them, and identifies holes before implementing an agent capability / mutation-surface registry.

This is a boundary map, not a registry implementation.

## Terms used here

- **Agent-originated**: an LLM/tool loop chooses content or an action that causes a durable write.
- **Agent-adjacent**: a user action, route, or runtime step persists agent-produced artifacts or operations intended to become agent-addressable later.
- **Authority class**:
  - `read_only`: no durable mutation.
  - `provisional_artifact`: durable or replayed context that is not accepted graph truth.
  - `proposal_only`: model/user proposes a change, but separate acceptance owns truth.
  - `commit_truth`: writes durable semantic or workflow truth.
  - `commit_process_debt`: writes obligations such as reconciliation needs.
  - `runtime_replay`: writes replay/status artifacts tied to an existing durable unit.
- **Boundary quality**:
  - `strong`: named application handler/transition owns validation and write semantics.
  - `mixed`: some semantic grouping exists, but DB helpers remain exposed at agent/tool call sites.
  - `thin`: route or agent code directly orchestrates DB helper calls.
  - `missing`: projected capability has no handler yet.

## Current mutation inventory

| Area | Current entry points | Initiator | Tables touched | Semantic operation | Authority | Boundary quality | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Specification creation | `createNewSpecification()` in `src/server/core.ts`; `POST /api/specifications` in `src/server/app.ts`; `createSpecification()` in `src/server/db.ts` | user/system | `specification` | Create specification workspace record | `commit_truth` | `strong` | Not agent-originated today, but future CLI/TUI harnesses may need it. Keep as a product handler, not a raw DB tool. |
| Phase entry / projected start | `submitPhaseIntentWithRuntimeCompatibility()` via `POST /api/specifications/:id/phase-intent`; chat route `phase-entry` command via `applyChatRouteTransition()` | user/system, future harness | `turn`, `specification.active_turn_id` after finalization | Start or continue a workflow phase by creating a successor frontier turn | `commit_truth` | `strong` | Good candidate for a future mutation-surface contract because route code delegates to runtime/transition helpers. |
| Chat continuation / answering frontier | `applyChatRouteTransition()` in `src/server/chat-route-transition.ts`; `prepareTurn()`, `resolveTurn()`, `prepareSuccessorTurn()`, `finalizeTurn()` in `src/server/core.ts` | user message plus interviewer runtime | `turn`, `specification.active_turn_id`, possibly `phase_outcome` supersession | Resolve current turn, advance interview head, create next frontier | `commit_truth` | `strong` | This is the main workflow-write seam today. Future agents should call a handler with chat-command semantics, not `createTurn()` / `advanceHead()` directly. |
| Interviewer question persistence | AI SDK tool `ask_question` from `createAskQuestionTool()`; `persistStructuredQuestion()` in `src/server/interview.ts` | internal interviewer agent | `turn`, `option` | Populate prepared assistant turn with question, rationale, impact, options, and review metadata | `commit_truth` / `proposal_only` for review-set content until accepted | `mixed` | Agent tool execution directly calls persistence helper. Semantics are named, but this should become a Brunch-owned mutation handler before exposing interviewer-like tools to external harnesses. |
| Interviewer preface presentation | AI SDK tool `present_preface`; `materializeTurnArtifacts()` in `src/server/turn-artifacts.ts`; `updateTurn()` in `app.ts` on stream finish | internal interviewer agent | `turn.assistant_parts` | Persist provisional context/preface and activity artifacts for replay | `provisional_artifact` / `runtime_replay` | `mixed` | Tool itself returns success only; durable write happens later from response artifacts. Future contract should preserve the rule that prefaces do not directly mutate graph truth. |
| Phase closure proposal | AI SDK tool `propose_phase_closure`; `createPhaseOutcome()` in `src/server/interview.ts` | internal interviewer agent | `phase_outcome` | Propose closing grounding/design for user confirmation | `proposal_only` | `mixed` | Current tool writes proposed workflow state directly. Future mutation surface should expose `phase.proposeClosure`, with confirmation as a separate handler. |
| Phase closure confirmation | `applyChatRouteTransition()` confirm branch; `confirmPhaseOutcome()`, `finalizeTurn()` | user, future harness | `turn`, `phase_outcome`, `specification.active_turn_id` | Accept interviewer-proposed phase closure | `commit_truth` | `strong` | Already a coherent transition handler. Good model for future agent mutation handlers. |
| Forced phase closure | `applyChatRouteTransition()` force-close branch; `createConfirmedPhaseOutcome()` | user, future harness | `turn`, `phase_outcome`, `specification.active_turn_id` | Close phase without interviewer recommendation | `commit_truth` | `strong` | User-authority only today. External agents should not get this by default; if exposed, authority class must remain explicit. |
| Structured response submission | `submitTurnResponseTransition()` via `POST /turns/:turnId/response` | user, future harness | `option`, `specification.mode`, `turn`, possibly `knowledge_item`, `turn_knowledge_item`, `knowledge_edge`, `phase_outcome` | Persist selected options/free text, grounding mode, and accepted review decisions | `commit_truth` | `strong` | Good existing product handler. It also materializes review truth on accept, so future tools should not bypass it by writing accepted requirements/criteria directly. |
| Requirements/criteria review materialization | `materializeAcceptedRequirementsReviewSet()`, `materializeAcceptedCriteriaReviewSet()` from `submitTurnResponseTransition()` | user acceptance of agent-generated review set | `knowledge_item`, `turn_knowledge_item`, `knowledge_edge`, `phase_outcome` | Convert accepted review set into durable requirements/criteria and grounding edges | `commit_truth` | `strong` when reached through response transition; `thin` if called directly | The semantic operation is acceptance-gated materialization. Future agents may propose review sets but must not commit them without acceptance. |
| Observer capture | `runObserver()` via `ensureObserverCapture()` / `POST /observer-capture` and trailing runtime capture | internal observer agent | `knowledge_item`, `turn_knowledge_item`, `knowledge_edge` | Extract claims and supported relationships from validated turns | `commit_truth` for captured graph truth | `mixed` | Agent runtime directly creates knowledge items and edges through DB helpers. This is the most important current agent-originated write surface to wrap before external harness access. |
| Observer result attachment / replay | `ensureObserverCapture()` in `src/server/app.ts`; observer result data parts on originating turn | internal observer runtime | `turn.assistant_parts` plus graph tables via `runObserver()` | Attach observer status/results to originating turn for replay | `runtime_replay` plus `commit_truth` | `mixed` | Needs separation between graph mutation handler and replay/status handler. Current endpoint dedupes runtime execution but not a future general mutation contract. |
| Knowledge item edit | `handlePatchKnowledgeItem()` in `src/server/edit-route.ts`; `updateKnowledgeItemContent()` | user graph edit today; future agent proposal/commit | `knowledge_item` | Edit accepted graph claim content after impact classification | `commit_truth` when soft; `proposal_only` when hard impact | `thin` | Route handler owns policy directly. Future agents must not call `updateKnowledgeItemContent()`; this should become a named mutation handler with reconciliation semantics. |
| Knowledge edge create/delete | `handleCreateKnowledgeEdge()`, `handleDeleteKnowledgeEdge()`; `addKnowledgeRelationship()`, `removeKnowledgeRelationship()` | user graph edit today; observer agent for create only | `knowledge_edge` | Add or remove semantic relationship | `commit_truth` | `thin` for route; `mixed` for observer | Edge writes need a single semantic handler that applies relation policy, provenance, support/status, and future reconciliation behavior. |
| Edge validation | `handleValidateKnowledgeEdge()` | user/UI, future agent/harness | none | Check relation policy before edge mutation | `read_only` | `strong enough` | Should become a read-only capability contract available to probes/harnesses. |
| Annotation create/delete | `handleCreateAnnotation()`, `handleDeleteAnnotation()` in `src/server/annotation-route.ts` | user side-chat/selection surface today; future agent notes possible | `annotation` | Attach or remove human annotation anchored to knowledge item/span | `commit_truth` but commentary, not graph claim truth | `thin` | User-authored today. If agents can annotate, authority should likely be `proposal_only` or visibly agent-authored. |
| Side-chat response | `handleSideChatRequest()` in `src/server/side-chat-route.ts` | side-chat assistant agent | none durable today | Generate refinement discussion around pinned graph item | `read_only` / non-durable | `strong enough` | It does not persist chat messages today. Future multi-chat substrate will convert this into durable chat turns and likely graph proposals. |
| Workspace exploration tools | `src/server/tools/*` via interviewer tool set | internal interviewer agent | none durable directly | Read files, grep, find, list directory, optionally present preface | `read_only` plus provisional preface artifact | `strong enough` for read-only | These are harness-like tools already. They should be adapted from read-only capability contracts if exposed to CLI/TUI/Pi. |
| Scenario runner artifacts | `src/server/scenario-runner.ts` | developer/probe harness | none durable today | Capture rendered prompt/context/model/output placeholders | `read_only` / artifact outside product state | `strong enough` | Future artifact persistence should use a schema and remain outside product truth unless explicitly imported. |

## Functional set vs semantic set

Current code exposes many low-level DB helpers (`createTurn`, `updateTurn`, `advanceHead`, `createKnowledgeItem`, `addKnowledgeRelationship`, etc.). These are functional primitives, not agent-addressable operations. The mutation surface should instead expose semantic handlers such as:

| Semantic operation | Current functional primitives | Notes for future handler |
| --- | --- | --- |
| `workflow.startPhase` | `prepareSuccessorTurn`, `createTurn` | Must check landing/runtime availability and active path. |
| `workflow.answerFrontier` | `resolveTurn`, `finalizeTurn`, `prepareSuccessorTurn` | Must preserve turn lineage and observer-capture scheduling. |
| `interviewer.persistQuestion` | `persistStructuredQuestion`, `createOption`, `updateTurn` | Agent-originated but production-internal today. |
| `workflow.proposePhaseClosure` | `createPhaseOutcome` | Proposal-only; separate from confirmation. |
| `workflow.confirmPhaseClosure` | `confirmPhaseOutcome`, `finalizeTurn` | User/harness authority gate. |
| `review.submitResponse` | `submitTurnResponseTransition` | Already a good handler; accepts review sets only through user action. |
| `observer.captureTurnKnowledge` | `runObserver`, `createKnowledgeItem`, relationship helpers | Should split model execution from graph-write application eventually. |
| `graph.editItemContent` | `handlePatchKnowledgeItem`, `updateKnowledgeItemContent` | Needs reconciliation/patch-ledger integration before external agent writes. |
| `graph.createEdge` / `graph.deleteEdge` | edge route handlers, relationship helpers | Needs relation support/status/provenance semantics. |
| `annotation.create` / `annotation.delete` | annotation route handlers | Not core graph truth, but still durable state. |
| `workspace.read*` | `src/server/tools/*` | Read-only capability family; useful first adapter target. |

## Holes and pressure points

1. **Observer graph writes are agent-originated and still DB-helper-shaped.** `runObserver()` directly creates items and edges. Before external or scenario-driven agents can write graph truth, this should become an application handler that accepts validated observer output and applies graph mutations with provenance and relation policy.

2. **Interviewer tools are already tools, but not Brunch capability contracts.** `ask_question` and `propose_phase_closure` are AI SDK tools whose `execute` functions write durable state. This is acceptable internally, but external harnesses should not copy those tool definitions; they should adapt Brunch-owned handlers.

3. **Graph edit routes are product handlers but not agent-safe mutation contracts.** They validate IDs and relation support, but they do not yet create reconciliation needs, patch history, support/status metadata, or agent provenance. They should be considered UI handlers awaiting migration into a mutation surface.

4. **Review acceptance is a strong existing pattern.** `submitTurnResponseTransition()` shows the desired shape: one semantic handler validates a user action and materializes durable truth. Future proposal-generating agents should feed this kind of acceptance path rather than directly creating requirements/criteria.

5. **Read-only tools are safe first registry candidates.** Workspace read/grep/find/list and relation validation can prove registry/adapters without mutation authority risk.

6. **No durable side-chat substrate yet.** Side-chat is currently SSE-only for assistant output. Multi-chat will create new durable chat mutation needs; those should be designed through the same mutation surface rather than as side-chat-specific tools.

7. **Scenario runner has no tool/capability inventory.** Probe artifacts should eventually record available capability ids and authority classes even when execution is not run, so prompt reviews can see what the agent was allowed to do.

## Projected future capability holes

| Future scenario | Needed capability contracts | Authority concerns |
| --- | --- | --- |
| CLI/TUI harness driving Brunch | create/list specs, start phase, answer frontier, read graph, maybe export | Must use workflow handlers; no ORM access. Mutations should be user-commanded or explicit. |
| Pi harness prompt probes | read graph/context packs, workspace read tools, scenario artifact capture | Keep Pi adapter read-only/proposal-only until mutation surface exists. |
| Web research probe | web search/fetch, attach provisional research preface, propose claims/sources | Research output should be provisional until accepted/observed; avoid direct graph writes initially. |
| Behavioral kernels | read graph neighborhoods, propose disambiguating questions/examples/invariants | Proposal-only until ontology/checkability handlers exist. |
| Architect proposals | read graph, propose changesets, create reconciliation needs | Must wait for patch-ledger/reconciliation semantics before committing truth. |
| Reconciliation review | list needs, propose resolution, apply accepted resolution | Requires process-debt handlers and user/HITL acceptance boundary. |
| External agent graph edit | edit item, add edge, retire claim, create example/invariant | Needs mutation handlers with provenance, support/status, reconciliation, and patch history. |

## Recommended next slices

1. **Agent capability registry skeleton** — Define stable ids, descriptions, input/output schemas, authority classes, and adapter-neutral metadata. Seed it with read-only capabilities only (`workspace.readFile`-style contracts if reused, relation validation, graph read projections) plus non-executable placeholders for mutating handlers discovered here.

2. **Observer graph mutation handler extraction** — Split `runObserver()` into model execution and `applyObserverCaptureOutput()` so the graph write operation is named, testable, provenance-aware, and eventually reusable by scenario/harness adapters.

3. **Interviewer tool handler extraction** — Move `persistStructuredQuestion()` / `createPhaseOutcome()` tool execution behind Brunch-owned handlers, then make AI SDK tools adapters over those handlers.

4. **Graph edit mutation surface design** — Before exposing graph edit tools to agents, align item/edge edit handlers with reconciliation needs and patch-ledger direction.

5. **Scenario artifact capability inventory** — Extend no-provider probe artifacts to record which capability ids and authority classes were available for a run, without executing them yet.

## Verification notes

Code-search cross-checks used for this audit:

- DB mutation helpers: `rg "export function (create|add|update|delete|set|link|record|advance|apply|insert|save|start|complete)" src/server src/shared`.
- ORM write calls: `rg "insert\\(|update\\(|delete\\(" src/server src/shared`.
- Agent/runtime seams: `runObserver`, `createAskQuestionTool`, `createProposePhaseClosureTool`, `applyChatRouteTransition`, `submitTurnResponseTransition`, side-chat and edit route handlers.

The inventory should be refreshed after the multi-chat/reconciliation substrate lands, because chat containers and `reconciliation_need` rows will add new write families.

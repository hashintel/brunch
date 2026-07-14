# Refactor Plan — Structured Exchange and Session Contract Convergence

## Problem Statement

The two stacked branches established valuable behavior, but several seams now describe the same state more than once or accept states that production cannot handle coherently:

- the branch is not currently green because a transcript test calls a retired renderer name;
- provider-facing ask parameters, runtime ask variants, and questionnaire envelopes have parallel owners;
- live asks expose cancellation operations but do not receive the turn abort signal that must drive them;
- workspace posture relies on optional coordinator facts and a Markdown-filtered proxy for whether product code exists;
- persisted questionnaire terminals can claim completion without proving that their answers match their questions;
- review-set acceptance advertises optional audit provenance that one adapter drops and another replaces with a different identifier;
- structural diagnostics lose their canonical type as they cross the session and RPC adapters;
- two expression-only helpers add indirection without owning policy.

The issue is not missing abstraction. It is missing convergence: runtime, persistence, RPC, and tests are carrying neighboring versions of the same contracts.

### Current

```text
nodes:
  provider-ask-schema: boundary
  standalone-ask-schema: boundary
  runtime-ask-shapes: local-types
  questionnaire-ui-parser: parser
  questionnaire-registry-parser: parser
  persisted-questionnaire: contract
  turn-abort: signal
  live-ask-registry: runtime-state
  workspace-topology-summary: projection
  workspace-posture: domain-state
  review-proposal-id: optional-input
  local-review-settlement: adapter
  rpc-review-settlement: adapter
  graph-change-log: store
  graph-diagnostic: canonical-type
  adapter-diagnostic: widened-type

edges:
  provider-ask-schema      -> runtime-ask-shapes
  standalone-ask-schema    -> runtime-ask-shapes
  questionnaire-ui-parser -> persisted-questionnaire
  questionnaire-registry-parser -> persisted-questionnaire
  turn-abort x> live-ask-registry                 # signal is ignored
  workspace-topology-summary -> workspace-posture # omits non-Markdown root files
  review-proposal-id -> local-review-settlement   # dropped
  review-proposal-id -> rpc-review-settlement     # replaced
  local-review-settlement, rpc-review-settlement -> graph-change-log
  graph-diagnostic -> adapter-diagnostic          # widened during handoff
```

## Solution

Converge each state space on one owner while preserving the provider requirement that tool parameters have an object root. Runtime parsing will return typed ask variants without assertions; one questionnaire submission contract will serve UI and live-registry paths; persisted questionnaire completion will reuse the same question-to-answer invariant. Live ask registration will require the turn abort signal and settle synchronously on abort.

Coordinator-produced workspace facts will be required. The narrow chrome identity will be an explicit projection of the complete spec state rather than a reason to weaken that state. Workspace population will use complete visible-file evidence while excluding Brunch-owned state, without widening the user-facing topology projection.

The unsupported review proposal audit identifier will be deleted rather than bridged. It has no production reader, cannot be recovered consistently under the canonical transcript-details contract, and currently creates false provenance. The accepted payload, operation, LSN, and change-log row remain the durable review acceptance audit. Adding richer provenance later requires a concrete reader and a carrier designed at that time.

### Desired

```text
nodes:
  provider-ask-object-schema: boundary
  typed-ask-parser: parser
  runtime-ask-variants: domain-types
  questionnaire-submission: canonical-contract
  persisted-questionnaire: contract
  turn-abort: signal
  live-ask-registry: runtime-state
  complete-workspace-inventory: projection
  complete-spec-state: domain-state
  chrome-spec-identity: view-projection
  shared-review-settlement: domain-operation
  graph-change-log: store
  graph-diagnostic: canonical-type

edges:
  provider-ask-object-schema -> typed-ask-parser
  typed-ask-parser -> runtime-ask-variants
  questionnaire-submission -> typed-ask-parser, live-ask-registry, persisted-questionnaire
  turn-abort -> live-ask-registry
  complete-workspace-inventory -> complete-spec-state
  complete-spec-state -> chrome-spec-identity, workspace-posture
  shared-review-settlement -> graph-change-log
  graph-diagnostic -> shared-review-settlement
```

Alternatives considered and rejected:

- A top-level union for ask parameters would be the cleanest TypeScript owner but is provider-illegal under the existing tool-schema contract. The target keeps one flat object boundary and adds a typed parser behind it.
- Adding proposal provenance to persisted review-set details would contradict the canonical details contract. Recovering it indirectly from historical tool-call arguments would add complexity for metadata with no reader. Direct deletion is smaller and more honest.
- Expanding the topology projection to enumerate every root file would change a model-facing/read surface for an unrelated posture need. Population should instead use complete inventory counts behind the existing projection.
- Making live-ask cancellation optional would preserve the current wiring gap. The signal is load-bearing and therefore required.

## Commits

1. [done] Restore the green baseline by moving the physical-line transcript assertion to the active all-history diagnostic renderer and run the full verification gate.
2. [done] Collapse duplicated ask parameter fields and validation into one provider-legal object-schema definition, add a typed runtime parser that returns the real standalone or continuation variants, remove the assertions, and inline the forwarding-only live-ask helper.
3. [done] Introduce one schema-owned questionnaire submission envelope and route both editor and registry parsing through it without changing terminal behavior.
4. [done] Make coordinator-produced spec posture and workspace-population facts required, split the narrow chrome identity from complete spec state, and update fixtures and previews to derive from the complete contract.
5. Carry the graph-owned diagnostic type through shared settlement and RPC results, then inline the sole-use origin-flip expression.
6. Require an abort signal when opening a live ask, settle the registry entry as cancelled on abort, clean up listeners after every terminal transition, and prove that aborted asks disappear and cannot be answered later.
7. Make persisted questionnaire completion validate exact question-to-answer correspondence through the shared questionnaire invariant, and distinguish malformed editor submissions from user cancellation.
8. Reject duplicate headless multi-select identifiers so live and interactive collection produce the same valid selection state.
9. Derive workspace population from all visible non-Brunch files, add non-Markdown-only and Brunch-only characterization cases, and keep the existing topology projection shape unchanged.
10. Delete the unread proposal audit identifier from the tool boundary, graph acceptance input, and change-log extras; strengthen local/RPC convergence tests to assert the same durable acceptance record, and reconcile the affected topology homes in this commit.

Every commit after the first starts from and ends at a passing full verification gate. The first commit restores that prerequisite.

## Decisions

- **Modules built or modified:** structured-exchange schemas and collection, live ask lifecycle, session settlement, workspace coordination, graph acceptance, and RPC settlement adapters.
- **Interface changes:** live ask opening requires cancellation provenance; coordinator inventories carry complete posture facts; ask runtime parsing returns a true variant union; diagnostics preserve their graph-owned shape.
- **Architectural decisions:** provider schema legality remains at the flat object boundary; schema ownership and runtime semantic typing are separated rather than duplicated; cancellation is part of the live ask contract; unsupported audit metadata is deleted rather than shimmed.
- **Schema changes:** questionnaire submission gains one shared envelope owner and persisted questionnaire terminals enforce cross-field correspondence. No database migration is required.
- **API contracts:** malformed questionnaire input is not cancellation; duplicate multi-select answers are invalid; aborted live exchanges are synchronously undiscoverable; review acceptance no longer claims optional proposal-entry provenance.
- **Topology homes:** the exchange schema home documents the shared questionnaire contract and proposal-id retirement; the session home documents abort-driven live ask settlement and complete workspace facts; the RPC home documents the shared questionnaire parser and review acceptance result; the graph home retires the unused change-log metadata claim if it is currently named there.

## Testing Decisions

- A good test crosses the real production owner: schema parsing for boundary shapes, the registered ask tool plus live registry for cancellation, the coordinator over a real temporary directory for workspace classification, and the shared settlement operation through both local and RPC adapters.
- Keep provider-schema tests that assert an object root and reject top-level union keywords; this is the constraint that shapes the ask parser design.
- Add a live abort test that opens through the registered tool, aborts the supplied signal, observes discovery close, and proves a subsequent answer is rejected.
- Add persisted-questionnaire rivals: missing answers, duplicate answers, mismatched kinds, unknown options, and duplicate multi-select options. Each must fail at the canonical parser rather than only in a downstream collector.
- Add workspace fixtures containing only a non-Markdown root file, only Brunch state, ignored files, and nested source files.
- Extend review-set convergence to compare durable change-log payloads, not only graph shape and operation count.
- Existing prior art includes production-adapter convergence tests, headless ask discovery tests, questionnaire schema tests, workspace coordinator temporary-directory tests, and command-executor atomic acceptance tests.
- Run the full verification gate after every commit; use targeted tests only as the red-green inner loop.

## Out of Scope

- Review-set visual redesign and transcript-ledger rendering.
- Retirement of legacy pending-exchange scans or legacy question vocabulary.
- Changing the process-lifetime terminal-state retention ceiling in the live ask registry.
- General redesign of workspace topology or project-identity discovery.
- New review provenance machinery, event spines, or transcript metadata carriers.
- Broad replacement of test-only casts outside the touched contracts.
- The declared wheel-scroll skipped test, which already names its re-enable trigger.
- Unrelated topology citation cleanup or documentation restructuring.

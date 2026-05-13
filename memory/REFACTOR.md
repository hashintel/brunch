# Runtime Design-Doc Cluster Refactor

## Problem Statement

The `docs/design/` runtime cluster contains several documents that were written at different moments in the multi-chat, side-chat, reconciliation, and changeset-ledger arc. The first consolidation pass fixed status headers and links, but the cluster still requires a content-level audit: older subsystem docs may contain future-facing claims that are now superseded by `CONVERSATIONAL_WORKSPACE_RUNTIME.md`, while the active synthesis may still rely on algorithmic or substrate details that only exist in older docs.

This makes the cluster harder for a builder or agent to navigate. A reader must infer which claims are shipped fact, which are current future direction, which are historical design pressure, and which are open questions.

## Solution

Refactor the runtime-cluster documentation so authority and supersession are explicit without deleting useful subsystem rationale.

Target state:

- `CONVERSATIONAL_WORKSPACE_RUNTIME.md` is the first-stop synthesis for the runtime cluster.
- `MULTI_CHAT.md` remains the shipped substrate reference for Phase 1 schema/migration invariants.
- `SIDE_CHAT.md` remains the user-surface history and V4 notes reference.
- `PATCH_LEDGER.md` remains historical design pressure for changeset/change semantics and reconciliation ordering.
- Each old doc clearly distinguishes shipped facts, retained rationale, superseded vocabulary/surfaces, and remaining open questions.
- Any canonical drift discovered during the audit is reported before touching `memory/SPEC.md` or `memory/PLAN.md`.

## Commits

1. Add a compact runtime-cluster supersession map to the active synthesis, naming current authority, retained subsystem details, superseded surfaces/vocabulary, and open questions.
2. Audit the side-chat design for shipped-versus-horizon claims, marking stale popover/patch-list/pending-review assumptions as historical where the unified runtime now supersedes them.
3. Audit the patch-ledger design for patch-to-changeset vocabulary boundaries, preserving target ordering and reconciliation-flow algorithms while marking old schema names as historical.
4. Audit the multi-chat substrate design for shipped Phase 1 facts versus later substrate possibilities, making clear what future thread/runtime questions are no longer owned there.
5. Run a final navigation pass over `docs/design/README.md` and local links so the cluster can be entered from the index without reading stale docs first.

Each commit is documentation-only and should leave the repository working.

## Decisions

- Treat this as a documentation refactor, not a product plan rewrite.
- Do not delete `MULTI_CHAT.md`, `SIDE_CHAT.md`, or `PATCH_LEDGER.md`; they still contain useful subsystem rationale and implementation history.
- Do not promote deferred product impulses during this pass. If the audit reveals a real SPEC/PLAN gap, record it for separate `ln-spec` / `ln-plan` handling.
- Keep future-facing vocabulary aligned with current canonical language: `changeset` / `change`, proposal turns, chat-local strategies, relation-policy directionality, and graph review distinct from reconciliation.

## Testing Decisions

- Use markdown link checks for local references after each meaningful pass.
- Use `npm run fix` after edits as the inner-loop repository check.
- Full `npm run verify` is optional before commit if the changes remain docs-only, but should be run before final submission if this branch is going to PR.
- The main review oracle is conceptual: a reader should be able to answer, from headers and first sections alone, which runtime doc owns which kind of claim.

## Out of Scope

- Changing `memory/SPEC.md` or `memory/PLAN.md` except for trivial link/path fixes explicitly approved during the audit.
- Migrating `memory/PLAN.md` to a sequencing-plus-definitions format.
- Refactoring `ln-*` skills or `AGENTS.md` planning rules.
- Implementing changeset, thread, reconciliation, or workspace runtime code.
- Creating `docs/design/SPEC_DRIFT.md` or promoting `DEFERRED_RECONCILIATIONS.md` entries.

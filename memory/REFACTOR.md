## Problem Statement

The `ln-*` skill family drifted from a tight canonical document system into a looser mature-mode system that relies more on agent judgment. The biggest regressions are: canonical terms were replaced with overlapping generic terms, canonical document authority became conditional instead of explicit, and deletion semantics for temporary working documents were weakened in favor of archives, breadcrumbs, and soft-retirement pointers. In practice this makes the family feel lighter but less strict, encourages ad hoc artifact creation, and makes it easier for active state to live outside the canonical docs.

## Solution

Restore one shared artifact vocabulary and one explicit document authority model across the `ln-*` family while keeping the useful mature-mode frontier shape. The target state is: `memory/SPEC.md` and `memory/PLAN.md` remain the only canonical planning documents, lightweight work is still allowed but must reconcile back into the canonical docs through a mandatory promotion check, temporary derivative documents are named explicitly and deleted when complete, and archival behavior is constrained to one sanctioned history sink rather than spreading across handoff and planning flows.

## Commits

1. Restore the family lexicon so planning, scoping, and build prompts all use one canonical noun system again.
2. Reassert canonical document authority and add a family-wide anti-improvisation rule that forbids inventing new planning documents or storage locations without explicit permission.
3. Tighten `ln-consult` so canonical flow is described as the default rule, with lightweight and direct-build paths framed as narrow exceptions rather than equally normal alternatives.
4. Rewrite `ln-scope` so it produces one artifact type with two weights, instead of multiple overlapping artifact nouns, and require explicit promotion when lightweight scoping discovers durable change.
5. Rewrite `ln-build` so canonical reconciliation is mandatory after every build, while the depth of reconciliation remains conditional on whether durable state changed.
6. Restore explicit temporary-document retirement rules in build and sync flows, including hard deletion of exhausted derivative documents instead of tombstones or pointers.
7. Narrow archival behavior so only plan history keeps retired work, while handoff remains volatile transfer state rather than a shadow archive.
8. Re-strengthen `ln-sync` as the ontology-repair and garbage-collection pass that merges equivalent facts, repairs references, and removes stale derivative artifacts.
9. Do a final language-and-policy sweep across the full `ln-*` family so the restored terminology, authority model, and retirement rules are consistent everywhere.

## Decisions

- Keep the mature-mode rolling-frontier plan shape rather than restoring phase-heavy planning.
- Use one canonical scoping artifact name, with light vs full expressed as weight, not as different artifact types.
- Treat `memory/SPEC.md` and `memory/PLAN.md` as the only canonical planning state.
- Treat handoff, refactor planning, and archived plan history as derivative support artifacts with narrower authority.
- Restore deletion as the default lifecycle end for temporary derivative documents.
- Keep lightweight handling for bounded work, but make canonical reconciliation mandatory even when the result is a no-op.

## Testing Decisions

- The main risk is semantic drift across prompts, so the best tests are behavioral prompt audits rather than implementation-level tests.
- Review each touched skill for the same three properties: canonical noun consistency, explicit document authority, and explicit retirement behavior.
- Validate that every place a skill permits a non-canonical artifact also states its authority boundary and end-of-life rule.
- Validate that direct-build and lightweight paths still exist, but are clearly framed as exceptions inside a governed system.
- Use diff review as the primary oracle for this refactor, with a final whole-family read-through to catch vocabulary regressions that line-by-line edits can miss.

## Out of Scope

- Reworking the broader project planning methodology outside the `ln-*` family.
- Changing the current rolling-frontier `PLAN.md` shape back to the older phase-based model.
- Adding new helper scripts, automated lint rules, or test harnesses for skill documents.
- Redesigning unrelated non-`ln-*` skills.

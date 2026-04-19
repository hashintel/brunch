## Problem Statement

Fixture seeding currently has two competing authorities: live TypeScript scenario builders and checked-in manifest artifacts. Public reseeding can therefore replay historical fixture representations instead of regenerating current truth from the same typed seams the application uses today. That makes walkthrough seeds less trustworthy as UI-test authority, invites semantic drift between manifests and the live data model, and leaves fixture behavior dependent on compatibility code that should not exist on the current-fixture path.

## Solution

Public fixture seeding should regenerate scenarios directly from current TypeScript builders at seed time. Those builders should compose a small set of typed fixture helpers that persist the same current turn artifacts, workflow facts, and accepted-review semantics the runtime owns today. Manifest capture can remain only as a non-authoritative debug/corpus seam if it still earns its keep, but public seeds and walkthrough tests should no longer depend on manifest loading, manifest compilation, or legacy fixture normalization.

## Commits

1. Add a safety-net test suite for public fixture authority: seed every public walkthrough scenario, assert the expected workflow/landing behavior still holds, and add explicit guards that public seeds do not rely on manifest-backed authority or deprecated review encodings.
2. Introduce a small typed fixture-helper layer for the recurring current-state artifacts: structured question turns, review turns, accepted review responses, phase proposals and confirmations, and grounding-card turns.
3. Migrate the existing TypeScript-authored scenarios to those helpers so public fixture construction stops hand-rolling persisted turn-part payloads in multiple places while preserving current seeded behavior.
4. Remove manifest-backed scenarios from the public seed catalog so reseeding always executes the live TypeScript builders and no longer mixes historical manifests with current fixture authority.
5. Rebuild the remaining public walkthrough scenarios that still depend on manifest slices as direct TypeScript scenarios using the helper layer, preserving the same user-visible seeded states without any manifest intermediate.
6. Simplify walkthrough and seed-catalog tests around the new authority boundary: public seeds verify current typed generation only, while any remaining manifest round-trip coverage moves to capture/corpus-focused tests instead of walkthrough authority tests.
7. Demote manifest loading, compilation, and legacy-normalization code from the current-fixture path; keep only the minimal non-public capture/corpus support that still has a clear purpose, or delete it if no longer justified after the public-seed cutover.

## Decisions

- Public fixture authority moves to live TypeScript scenario builders only.
- A small helper layer is preferred over a new fixture IR, schema re-validation pass, or generate-then-reload manifest pipeline.
- Typed fixture builders are trusted when they stay inside the application-owned seam; extra schema validation is reserved for external trust boundaries, not self-authored fixture generation in the same process.
- Manifest artifacts, if retained, are non-authoritative support for capture, corpus, or debugging rather than the source of truth for reseeding.
- No product data-model change is intended; this refactor changes fixture authority, fixture construction, and test ownership boundaries.

## Testing Decisions

- Good tests here assert seeded semantics the UI depends on: workflow status, landing derivation, persisted review metadata, accepted-review carry-forward, export content, and absence of deprecated legacy encodings in public seeds.
- The main modules under test are the public seed catalog, walkthrough scenario generation, typed fixture helpers, and any remaining manifest capture/corpus seam.
- Prior art already exists in the current walkthrough, manifest, seed CLI, and corpus round-trip tests; the refactor should reuse those expectations while reassigning manifest-only assertions away from public walkthrough authority.
- Because the public-seed authority boundary itself is changing, the first safe step is stronger characterization of the current user-visible seeded states plus explicit tests for the new “TypeScript-only public authority” rule.

## Out of Scope

- Changing the runtime workflow model, projector semantics, or persisted product contracts.
- Broad migration support for historical local databases.
- Building a new declarative fixture language, compiler, or redundant schema-validation pass for self-authored fixture builders.
- Deciding the long-term future of every manifest/corpus artifact beyond what is necessary to remove them from public seed authority.

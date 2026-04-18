## Problem Statement

The knowledge model is closer to a single coherent ontology than it was, but two important sources of drift remain.

First, the reference-code contract is not fully trustworthy. Runtime code generation has one helper, but the prefixes are maintained separately from the canonical kind registry, and the currently emitted prefixes do not match the intended contract (`G`, `T`, `A`, `D`, `CTX`, `CON`, `R`, `AC`). That means kind metadata is still split across multiple sources, and visible codes can drift across tests, stories, fixtures, and runtime output.

Second, the ontology is not fully single-sourced. The shared knowledge model defines the canonical kinds, but the observer still re-declares ontology shape and semantics manually. More importantly, the current requirement/criterion behavior appears to conflict with the intended model: the code can persist requirements and criteria directly from observer extraction, while the spec says they should become durable only through accepted review outputs. That leaves an unresolved developer-facing ambiguity about what the ontology really is.

## Solution

Make the shared knowledge registry the single source of truth for knowledge-item metadata, including reference-code prefixes, and derive all code generation from that authority. At the same time, make the observer consume shared ontology policy instead of restating it by hand.

Resolve the remaining ontology ambiguity explicitly: either requirements and criteria are synthesis-only until acceptance, or they are provisional durable items earlier in the workflow. Once that decision is made, align the observer, persistence, transport, fixtures, and tests to one model so the system stops speaking two ontologies at once.

## Commits

- [x] Add reference-code prefixes to the canonical knowledge registry and derive the code-generation helper from registry entries without changing the currently emitted codes yet.
- [x] Replace hard-coded reference-code expectations in tests and helper fixtures with derived expectations where possible, so later prefix changes become a contract update instead of a broad brittle rewrite.
- [x] Switch the canonical reference-code contract to the intended prefixes (`G`, `T`, `A`, `D`, `CTX`, `CON`, `R`, `AC`) and update runtime expectations to match.
- [ ] Normalize story, fixture, and demo code samples to the canonical reference-code scheme so non-runtime surfaces stop teaching stale identifiers.
- [ ] Extract a shared observer ontology policy that declares which knowledge kinds are valid in each phase and what semantic role each kind plays.
- [ ] Rebuild observer schema and prompt assembly from that shared ontology policy so the observer no longer hand-maintains a parallel ontology definition.
- [ ] Make an explicit architectural decision about requirement and criterion durability, then codify it in both docs and code before changing behavior.
- [ ] If requirements and criteria are review-authoritative only, remove direct pre-acceptance observer persistence for them and route them through the accepted-review path while preserving synthesis inputs for later review.
- [ ] If requirements and criteria are intentionally durable before acceptance, update the canonical documentation and tests so the spec matches the already-supported behavior instead of implying a different model.
- [ ] Sweep replay, entities payload, observer-result, and review-flow tests to ensure the final ontology and reference-code contract are expressed consistently across persistence, transport, hydration, and UI-facing examples.

## Decisions

- The canonical knowledge registry should own every stable per-kind metadata field needed by runtime and UI, including collection key, entity collection, display metadata, and reference-code prefix.
- Reference codes are a user-facing contract, not incidental formatting.
- Observer ontology policy should be derived from shared knowledge-model authority, not restated independently.
- Requirement and criterion durability must be made explicit; code and documentation cannot continue to imply different lifecycle models.
- Behavioral changes to requirement/criterion persistence come only after the contract decision is explicit and protected by tests.

## Testing Decisions

- Good tests here prove behavior at the contract boundary: emitted reference codes, accepted payload shape, persisted entity kinds, replayed captured items, and observer output handling.
- The most important tests are shared knowledge-model tests, transport-schema tests, observer tests, entity-projection tests, and transcript/replay tests.
- Prior art already exists for registry metadata, API contract parsing, observer persistence, entity projection, active-path filtering, and replayed captured items. Those should be extended rather than replaced.
- If the requirement/criterion durability decision changes behavior, the primary safety net should be end-to-end flow tests that prove when those items first become durable and how they appear in entities payloads and replay.

## Out of Scope

- Naming normalization outside the knowledge ontology and reference-code domain.
- Workflow projector, control-card, or handoff-state refactors.
- Major UI redesign of the knowledge sidebar beyond contract-alignment updates.
- Any schema/storage rewrite beyond what is required to align the ontology lifecycle and reference-code contract.

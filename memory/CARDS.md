# Scope cards — FE-736 JSONL session viability

## Orientation

- Containing seam: transcript persistence over Pi `SessionManager` JSONL under `.brunch/sessions/`, with Brunch custom transcript entries and coordinator-created session binding layered on top.
- Frontier item: `jsonl-session-viability` / FE-736 on `ln/fe-736-jsonl-session-viability`; these cards are slices inside the same frontier, not new Linear issues or branches.
- Volatile state: no `HANDOFF.md` is present; M1 captures were human-reviewed as good structural replay seeds on their current terms, but they are not final evidence for elicitation interaction logic or knowledge flow.
- Main open risk: Pi JSONL may preserve entries syntactically while Brunch accidentally consumes the wrong semantic path — file-linear entries instead of active branch, raw custom entries instead of LLM-context custom messages, or binding state that only works because the coordinator flushed through a private seam.
- Cross-cutting obligations: preserve Pi JSONL as transcript truth unless proven insufficient; avoid a parallel canonical chat/turn store; validate `WorkspaceSessionCoordinator` sessions including `/new`; keep projection handlers as oracles over canonical stores; carry the replay/property/adversarial fixture strategy forward without treating scripted M1 exchange shape as final product behavior.

## Card 1 — status: done

### Target Behavior

Coordinator-created sessions remain self-describing after Pi JSONL reload.

### Boundary Crossings

```text
→ WorkspaceSessionCoordinator-created Brunch session
→ Pi SessionManager append/flush JSONL persistence
→ Pi SessionManager.open reload
→ Brunch transcript/projection assertions
```

### Risks and Assumptions

- RISK: Pi normalizes timestamps, ids, or message content during open/rewrite → MITIGATION: compare payload fields that should be stable and explicitly document allowed timestamp/id variance.
- RISK: The coordinator's pre-assistant flush path masks reload behavior that real sessions do not share → MITIGATION: test through the public coordinator path and `SessionManager.open`, not direct JSON parsing alone.
- ASSUMPTION: Pi JSONL preserves Brunch `brunch.session_binding` custom entries across binding-only, first-message, and `/new` coordinator lifecycles → VALIDATE: open the persisted files and compare binding cardinality plus binding data → memory/SPEC.md §Open Assumptions A2-L.

### Acceptance Criteria

✓ `jsonl binding-only coordinator session reloads` — a newly coordinator-created session with no assistant message can be reopened and has exactly one `brunch.session_binding`.
✓ `jsonl coordinator pre-assistant flush does not duplicate prefix` — after a binding-only reload and first assistant/user append, the JSONL file has one session header and exactly one binding.
✓ `jsonl session reload preserves coordinator binding` — a coordinator-created transcript has exactly one `brunch.session_binding` after `SessionManager.open`, with the same session id, spec id, and spec title.
✓ `jsonl coordinator new session reloads same spec` — `createNewSessionForCurrentSpec()` creates a distinct session id/file whose reloaded binding carries the unchanged spec id and title.
✓ `jsonl session reload projects the same simple exchange` — `projectElicitationExchanges` returns the same prompt/response entry ids before and after reload for the simple coordinator-created transcript.

### Verification Approach

- Inner: round-trip unit tests — prove local reload and projection behavior against Pi `SessionManager`.
- Middle: artifact oracle — inspect the actual persisted JSONL path from the coordinator rather than an in-memory fixture.

### Cross-cutting obligations

- Use Pi-owned session entry/message types where possible; Brunch owns only semantic projection types.
- Do not introduce a canonical chat/turn table or a Brunch-side mirror store to make the test pass.
- Treat failure as viability evidence, not as an invitation to silently widen Brunch's local parser.

## Card 2 — status: done

### Target Behavior

Representative Pi message and Brunch custom transcript payloads survive Pi JSONL reload byte-equivalently.

### Boundary Crossings

```text
→ Pi raw user/assistant message fixtures and Brunch custom event fixture payloads
→ Pi SessionManager message/custom/custom_message entry persistence
→ Pi SessionManager.open reload
→ Brunch survival-matrix and context-participation assertions
```

### Risks and Assumptions

- RISK: Some future Brunch custom entries do not yet have production constructors → MITIGATION: use minimal test fixtures that exercise Pi JSONL persistence while keeping schemas local to the test or a narrowly named viability helper.
- RISK: The test over-specifies final payload schemas before their frontiers land → MITIGATION: assert preservation of representative payload envelopes, `customType` names, and context participation where required, not final product semantics.
- ASSUMPTION: Pi JSONL preserves raw Pi message payloads and unknown Brunch custom-entry payloads without requiring Pi schema changes → VALIDATE: reload a matrix of named entries and compare stable payload fields → memory/SPEC.md §Open Assumptions A2-L.

### Acceptance Criteria

✓ `jsonl raw user assistant payload survival` — representative user and assistant messages, including non-trivial content shapes beyond one plain string, survive reload without being projected into Brunch-local DTOs.
✓ `jsonl custom entry survival matrix` — `brunch.lens_switch`, `brunch.mention`, `brunch.mention_staleness_hint`, and other non-context Brunch custom entries survive reload with `customType` and `data` intact.
✓ `jsonl custom message survival matrix` — context-carrying entries such as `worldUpdate`, `brunch.side_task_result`, and structured elicitation prompts survive reload with `customType`, `content`, `display`, and `details` intact.
✓ `jsonl custom messages re-enter pi context` — after reload, `SessionManager.buildSessionContext()` includes the representative `custom_message` entries on the active branch with the same custom type and content.
✓ `jsonl continuity metadata survival` — representative `lastSeenLsn`, interest-set, and compaction-anchor metadata survives reload in the chosen transcript-native shape, including any Pi-native `compaction.details` shape chosen for anchors.
✓ `jsonl structured elicitation survival` — structured prompt/response custom entries survive reload distinctly from ordinary user/assistant messages.

### Verification Approach

- Inner: schema/shape validation at the boundary — compare raw message fields plus custom `data` / `content` / `details` round trips for representative Brunch entry families.
- Middle: round-trip oracle — persist with Pi APIs, reload with Pi APIs, then assert Brunch-visible semantics and Pi context reconstruction from the reloaded entries.

### Cross-cutting obligations

- Keep this as a JSONL viability proof, not a commitment to final side-task, mention, or continuity subsystem schemas.
- New helper names should use lexicon terms: session binding, structured elicitation entry, lens switch, side-task result, world update, mention ledger.
- Use Pi-exported entry/message types for envelopes; Brunch-owned fixture types should cover only Brunch payload semantics.
- If a payload cannot be represented without a new Brunch schema owner, stop and surface that as a design/scoping issue rather than inventing a broad store.

## Card 3 — status: done

### Target Behavior

Elicitation exchange projection after reload uses Pi's active branch.

### Boundary Crossings

```text
→ Branched Pi session fixture
→ Pi JSONL tree/leaf persistence
→ Pi SessionManager.open reload
→ Brunch elicitation exchange projection
```

### Risks and Assumptions

- RISK: `loadJsonlTranscriptEntries` currently reads file entries linearly and may not reflect Pi's active branch semantics → MITIGATION: compare projection from Pi's active branch after reload against any file-linear projection, then make the product projection use the active-branch source if needed.
- RISK: Branching APIs behave differently from the initial M1 linear captures → MITIGATION: use a minimal fork/branch fixture with one abandoned branch and one active branch.
- ASSUMPTION: Pi JSONL stores enough tree/leaf information to re-project elicitation exchanges from the active branch after reload → VALIDATE: reload the branched session and assert only active-branch prompt/response ids appear → memory/SPEC.md §Open Assumptions A12-L.

### Acceptance Criteria

✓ `jsonl active branch projection excludes abandoned exchange` — after reload, an exchange on an abandoned branch is absent from Brunch's projected exchanges.
✓ `jsonl active branch projection preserves selected exchange` — after reload, the active branch's prompt/response exchange remains projectable with stable ranges.
✓ `session.elicitationExchanges uses active branch semantics` — the RPC handler projects the selected session's active branch rather than blindly projecting every JSONL line when branch state exists.
✓ `jsonl active branch custom messages enter context only once` — reloaded custom-message entries on abandoned branches do not appear in the active branch projection or context, while active-branch custom messages do.

### Verification Approach

- Inner: round-trip projection test — builds a branched Pi session, reloads it, and compares projected exchanges from `SessionManager.getBranch()` rather than raw file order.
- Middle: RPC contract test — proves the named `session.elicitationExchanges` method follows the same active-branch semantics as the projection helper.

### Cross-cutting obligations

- Preserve D13 capture-aware projection: exchanges are derived from Pi transcript truth, not stored as canonical chat/turn rows.
- Keep RPC thin: fix projection source/semantics in the projection handler path, not by adding file params or a generic read model.
- If Pi JSONL cannot expose a stable active branch after reload, record a sharply bounded insufficiency for the M2 fallback decision.

## Card 4 — status: next

### Target Behavior

Committed M1 scripted captures are reloadable JSONL evidence for M2.

### Boundary Crossings

```text
→ `.brunch-fixtures/<brief-id>/scripted-001/` committed run bundle
→ Pi SessionManager.open-backed Brunch projection path
→ Brunch elicitation exchange projection
→ Fixture replay parity assertions
```

### Risks and Assumptions

- RISK: committed fixture metadata contains local absolute source paths that should not be part of portable parity → MITIGATION: assert parity against bundle-local JSONL and metadata fields that are intentionally stable.
- RISK: M1 scripted captures encode thin interaction logic that later changes → MITIGATION: use them only for transcript reload/projection parity, not as final elicitation-quality goldens.
- ASSUMPTION: The M1 run bundles are sufficient replay seeds for transcript-first M2 evidence → VALIDATE: reload/project each committed bundle and compare stable metadata summaries → memory/SPEC.md §Open Assumptions A2-L, A5-L.

### Acceptance Criteria

✓ `m1 fixture bundles reload for transcript parity` — briefs #1–#3 can be loaded from bundle-local JSONL without relying on `meta.session.sourceFile` absolute paths.
✓ `m1 fixture bundle metadata matches reprojected exchanges` — each bundle's projection summary equals the projection from its JSONL transcript after reload through the same projection path used by `session.elicitationExchanges`.
✓ `m1 fixture bundle bindings match briefs` — each bundle still has exactly one session binding whose spec title matches the brief title.
✓ `m1 fixture metadata treats source file as provenance only` — absolute `meta.session.sourceFile` may be present as provenance, but replay parity depends on `artifacts.jsonl` and bundle-local paths.

### Verification Approach

- Inner: fixture replay regression tests — assert stable metadata and projection summaries for committed M1 bundles.
- Middle: replay oracle — proves M1 captures are usable M2 transcript evidence without introducing a parallel fixture store or a file-linear projection special case.
- Outer: no new human review required unless the builder changes brief content or scripted user notes.

### Cross-cutting obligations

- Do not make absolute local paths part of golden fixture truth.
- Keep graph/coherence artifacts deferred in M2 unless the graph/coherence substrates land separately.
- Preserve the human-reviewed caveat: M1 captures are good structural seeds on current terms, not final product-behavior evidence.

## Queue discipline

- Build cards in order and commit after each passing slice.
- If any card demonstrates JSONL insufficiency, stop the queue, preserve the failing oracle, and route back for `ln-spike` or `ln-spec`/`ln-plan` fallback reconciliation before continuing.
- Delete `memory/CARDS.md` when all queued cards are complete or superseded.

# D82-L acquisition modes + digest + situating gap

Frontier: generalized-capture | FE-861
Status:   active
Mode:     chain
Created:  2026-06-19

## Orientation

- **Seam:** the D58-L prompt-resource manifest layer (`src/.pi/skills/` + `src/.pi/extensions/runtime/state.ts`) in front of the landed D80-L banded capture sweep. This is the last FE-861 acceptance facet — the acquisition/digest/situating layer (D82-L) — after slices 1–4 (routing gate, sweep watermark, fossil retirement, web tools) landed.
- **Frontier item:** `generalized-capture` (FE-861), block 3. Stays on branch `ln/fe-861-generalized-capture`; no new Linear issue or branch (intra-frontier slice).
- **Volatile state (HANDOFF.md):** web-tool prerequisite landed (`cc65b47d`); `methods/capture.md` already carries the gradient + "capture from the digest" line; `sweep-watermark.ts` already classifies `DIGEST_CUSTOM_TYPES` + assistant messages as in-window and raw tool results as background. So the digest is already substrate-wired — what remains is conduct + manifest + one seeded gap.
- **Main open risk:** the substance of this layer (routing quality, digest quality, mode selection) is **fitness, not gated** per the 2026-06-18 oracle design. The deterministic surface is thin (manifest legality, gap seeding, compose goldens). The one real modeling call is the situating gap's `refersTo` / predicate shape (Card 2).

Posture: proving (inherited from generalized-capture / FE-861). Confirmed against `.pi/POSTURE.md` (`certainty: proving`, `stakes: high`, `migration: free-rewrite`).

**Frontier cross-cutting obligations carried by both cards:**
- Low-confidence material never becomes graph truth — it becomes agenda (D81-L). Acquisition feeds the same sweep; it does not open a second commit path.
- Do not regrow deleted `capture-*` topology, observer/auditor queues, or product-side extraction passes (D80-L). The digest is assistant conduct in the transcript, not a product extraction stage.
- D39-L sealing: the code-owned manifest in `state.ts` is the legal-set authority. Adding a markdown file does not advertise it; no ambient Pi resource discovery.
- D40-L tool authority is unchanged: web/local read tools are already base-allowed in `elicit-read-only` (slice 4). Acquisition methods are guidance over already-legal tools — no new tool grants.

**Scope-time decisions (locked here, not findings):**
1. **Family = `methods/`.** Acquisition modes are tool-routing/sequencing competences — exactly the `methods/` family semantics ("tool-routing and sequencing guidance"). A dedicated `acquisition/` family would require extending `PromptResourceFamily`, a new id union, a new `*_RESOURCES` record, and a new selection branch in `manifestsForState` — structural theatre against a settled seam. They are always-advertised (ungated), like `read-context`/`capture`; no `METHOD_CAPABILITY` entry. Alternative (new family) is rejected unless Card 1 surfaces a concrete reason methods/ cannot carry them.
2. **Digest = conduct only.** No new schema or emit path. The bulk-mode bodies direct an assistant-authored characterization (an ordinary assistant message, already in-window per `sweep-watermark.ts`); `capture.md` already says the sweep captures from the digest while raw reads pass behind the watermark as background. The pre-wired `DIGEST_CUSTOM_TYPES` are a future structural-digest affordance, not needed this slice.

**Excluded (named, not scoped):**
- Contradiction → `reconciliation_need` outlet — its own slice (PLAN + HANDOFF both confirm).
- False-commit scenario-matrix completeness — standing frontier obligation, not this slice.
- Subagent-delegated acquisition — `subagent-adoption` frontier (D82-L successor). `explore-and-characterize` uses web tools + in-agent reasoning here.

---

## Card 1 — Acquisition modes as prompt-resource skills (+ digest conduct)

Status: done

### Target Behavior

The elicitor's four acquisition modes exist as manifest-advertised `methods/` prompt-resource skills, with the two bulk modes directing an assistant-authored digest the sweep captures over.

### Full-card cold-start reads

```
- memory/SPEC.md   — D82-L (acquisition/digest), D80-L (sweep window/watermark), D58-L (manifest world), D39-L (sealing), D47-L (preface→digest prior art); A22-L
- memory/PLAN.md    — frontier: generalized-capture (acceptance: "Acquisition modes (D82-L)")
- HANDOFF.md        — web-tool prerequisite landed; digest already watermark-classified
- src/.pi/skills/README.md — prompt-resource layout, boundary rules, body-lock ledger
- src/.pi/extensions/runtime/state.ts — MethodId union, METHOD_RESOURCES, elicitor allowedMethods, resource() helper
- src/projections/session/sweep-watermark.ts — DIGEST_CUSTOM_TYPES + in-window classification (read-only; confirms digest substrate)
```

### Boundary Crossings

```
→ src/.pi/skills/methods/*.md            (new skill bodies — prompt resources)
→ src/.pi/extensions/runtime/state.ts    (MethodId union + METHOD_RESOURCES + elicitor.allowedMethods)
→ manifestsForState / methodIdsForState  (advertise in elicit manifest; ungated)
→ compose.test.ts                        (method-name list + readability + COMPOSE golden)
```

### Risks and Assumptions

```
- RISK: four new methods bloat the elicit manifest and dilute method selection
    → MITIGATION: each body is a distinct competence with a clear "use when"; they are ungated reads, same weight class as read-context. If the manifest feels noisy, that is a fitness observation, not a gate failure.
- RISK: the digest needs a structural transcript entry, not a plain assistant message
    → MITIGATION: sweep-watermark.ts already treats assistant messages as in-window; capture.md already captures over the digest. Plain assistant-message digest is sufficient for the POC. DIGEST_CUSTOM_TYPES stay parked for a future structural digest.
- ASSUMPTION: methods/ is the right family for acquisition modes (scope-time decision 1)
    → IMPACT IF FALSE: rework Card 1's manifest wiring (one file); Card 2 is unaffected (references mode names, not family).
    → VALIDATE: the compose manifest-name + readability tests pass with methods/ entries; no new selection branch needed.
    → [→ memory/SPEC.md D82-L "structured as Brunch prompt-resource skills … each a distinct competence"]
- ASSUMPTION: acquisition-mode and digest *quality* is fitness, not gated
    → IMPACT IF FALSE: would need a new middle-loop oracle; but the 2026-06-18 oracle design (SPEC §Verification Design) explicitly lists digest quality + banded-traversal quality as outer-loop fitness.
    → VALIDATE: SPEC §Verification Design capture row; no contradicting decision.
    → [→ memory/SPEC.md §Assumptions A22-L]
```

### Posture check

Proving. This slice scores on **invariants** (locates the acquisition-mode seam: where modes live, that they are ungated methods, that the manifest is their authority) and **proof of life** (the acquisition competence layer is composable end-to-end — advertised, readable, sealed). The deterministic proof is thin by design; the layer's *behavior* is fitness. A tracer bullet that lights up the advertised layer beats a study step — build it.

### Acceptance Criteria

```
✓ compose: elicit AUTO manifest methods list includes elicit-by-question, ingest-paste, read-referenced-documents, explore-and-characterize (compose.test.ts method-name assertion updated)
✓ readability: each new skill body ≥700 chars, repo-owned under src/.pi/skills/ (compose.test.ts:313 invariant green with no new code)
✓ bulk-mode bodies (read-referenced-documents, explore-and-characterize) direct an assistant-authored digest and defer capture to the sweep over the digest; ingest-paste + elicit-by-question feed conversational content directly
✓ COMPOSE-stage prompt golden regenerated to include the four advertised acquisition methods (machine-stable; no behavioral contract hidden)
✓ D39-L sealing preserved — prompting.test.ts "no Pi resource discovery / no legacy context imports" stays green
✓ npm run verify green
```

### Verification Approach

```
- Inner: vitest (compose.test.ts manifest-name + readability + golden; prompting.test.ts sealing) + oxlint/oxfmt via npm run verify
- Middle: none new — the two deterministic capture oracles (routing gate + sweep-watermark) are landed and untouched
- Outer: fitness — does the elicitor reach for the right mode and produce useful digests? judged manually + via .brunch/debug/* (named, not gated)
```

### Cross-cutting obligations

```
- D39-L sealing: state.ts manifest is the authority; markdown alone does not advertise
- D40-L: no new tool grants (web/local read tools already base-allowed slice 4)
- digest is assistant conduct in the transcript, not a product extraction pass (D80-L)
```

### Expected touched paths (tentative)

```
src/.pi/skills/methods/
├── elicit-by-question.md           +
├── ingest-paste.md                 +
├── read-referenced-documents.md    +
├── explore-and-characterize.md     +
└── capture.md                      ?   (not touched; existing digest line was sufficient)
src/.pi/skills/README.md            ~   (layout note + body-lock ledger rows)
src/.pi/extensions/runtime/state.ts ~   (MethodId union, METHOD_RESOURCES, elicitor.allowedMethods)
src/.pi/extensions/system-prompts/__tests__/compose.test.ts ~ (method-name list + golden)
```

### Build result

- Added the four D82-L acquisition modes as ungated `methods/` resources in the code-owned manifest and elicitor allow-list.
- Wrote source-lock bodies for direct question, paste ingest, referenced-document read with digest, and bounded brownfield exploration with digest.
- Updated the skills README body-lock ledger and COMPOSE preview goldens; `capture.md` already named digest capture, so no body edit was needed there.
- Verification: `npm run verify` green (124 files, 940 passed, 1 todo; build + web build green).


---

## Card 2 — Situating gap seeded at spec creation

Status: next (depends on Card 1 mode *names* only — no implementation findings)

### Target Behavior

Spec creation seeds a grounding-band situating gap whose orientation anchors route the opening elicitation into the matching acquisition mode.

### Full-card cold-start reads

```
- memory/SPEC.md   — D82-L (situating gap), D65-L (gap substrate: refersTo NodeKind, predicate union, manual disposition, rationale read to phrase next move), D75-L (grounding-floor seeding)
- memory/PLAN.md    — frontier: generalized-capture (acceptance: "the seeded situating gap routes modes")
- src/graph/command-executor.ts — SEEDED_ELICITATION_GAPS, seedElicitationGaps, repairSeededElicitationGaps, createSpec
- src/graph/schema/elicitation-gaps.ts — GapPredicate union (manual arm), ElicitationGap shape
- src/graph/schema/elicitation-gap-fixtures.ts — GROUNDING_FLOOR_KINDS (fixture helper, presence-only; situating gap is NOT a floor presence kind)
```

### Boundary Crossings

```
→ src/graph/command-executor.ts  (SEEDED_ELICITATION_GAPS += situating gap)
→ seedElicitationGaps / createSpec   (every new spec seeds it)
→ repairSeededElicitationGaps        (floor-predating specs gain it; manual predicate handled)
→ read_elicitation_gaps              (elicitor reads the gap's question/rationale → routes to a mode)
```

### Risks and Assumptions

```
- RISK: the situating gap has no natural NodeKind to refer to (orientation is meta, not a graph node)
    → MITIGATION: refersTo: 'context' (orientation is contextual — what kind of thing / brownfield-vs-new), distinguished from the existing context *presence* gap by a manual predicate + distinct question/rationale. This is the one real modeling call; sanity-check it at build.
- RISK: the existing seeded-gap test asserts all gaps are predicateKind 'presence'
    → MITIGATION: the situating gap is predicateKind 'manual'; restructure command-executor.test.ts to assert per-gap predicateKind (6 presence + 1 manual = 7).
- ASSUMPTION: routing lives in the gap's question/rationale (D65-L: rationale is read to phrase the next move) + the advertised acquisition manifest — no elicitor SYSTEM.md edit required
    → IMPACT IF FALSE: a one-line pointer in src/.pi/agents/elicitor/SYSTEM.md (small).
    → VALIDATE: the gap rationale names the three anchors + the four modes; the elicitor already reads gaps + manifest.
    → [→ memory/SPEC.md D65-L rationale semantics]
- ASSUMPTION: repairSeededElicitationGaps tolerates a manual-predicate seed
    → IMPACT IF FALSE: small repair-path adjustment; covered by an added repair test row.
    → VALIDATE: repair test seeds a floor-predating spec and asserts the situating gap is added.
```

### Posture check

Proving. Scores on **proof of life** (the opening now carries an orientation agenda item that routes acquisition) and **uncertainty** (retires whether orientation-as-seeded-agenda — anchors promoted from skill prose to a gap, D82-L — is workable). Landing it *is* the proof: a new spec that does not seed the situating gap fails the deterministic seeding test. Build it.

### Acceptance Criteria

```
✓ createSpec seeds 7 gaps including the situating gap (refersTo: context, predicateKind: manual, band: grounding, high importance) at the create-spec LSN (command-executor.test.ts)
✓ the situating gap's question/rationale names the orientation anchors (new-from-scratch / brownfield codebase / continuation of a prior thread) and the acquisition modes each routes into
✓ repairSeededElicitationGaps adds the situating gap to a floor-predating spec (manual predicate handled; repair test row)
✓ groundingFloorGaps fixture + affordances tests stay green (situating gap is NOT a presence floor kind; GROUNDING_FLOOR_KINDS unchanged)
✓ npm run verify green
```

### Verification Approach

```
- Inner: vitest (command-executor.test.ts seeding + repair; affordances.test.ts unchanged) + npm run verify
- Middle: none new — routing gate + sweep-watermark unchanged
- Outer: fitness — does the seeded situating gap actually route the opening into the right mode? manual + .brunch/debug/* (named, not gated)
```

### Cross-cutting obligations

```
- Anti-shadowing (D65-L): the situating gap carries question/rationale, never domain content as truth
- The gap is a coverage obligation, not a hard gate (D65-L) — it guides routing, it does not wall the opening
- GROUNDING_FLOOR_KINDS (presence floor) is unchanged; the situating gap is a manual orientation seed alongside it
```

### Expected touched paths (tentative)

```
src/graph/command-executor.ts                          ~ (SEEDED_ELICITATION_GAPS += situating gap)
src/graph/__tests__/command-executor.test.ts           ~ (seeding 6→7, per-gap predicateKind; repair row)
src/.pi/agents/elicitor/SYSTEM.md                      ? (one-line routing pointer, only if gap rationale is insufficient)
src/graph/schema/elicitation-gap-fixtures.ts           ? (only if repair/fixture coupling needs reconciliation)
```

<!-- SPEC.md — live architecture register.
     Created by ln-spec · Read by all skills · Refreshed by ln-sync.
     Keep only active requirements, live assumptions, current decisions,
     critical invariants, and the verification stance. -->

# Brunch v2 — Spec Elicitation Tool

## Concept & Goal

Brunch is an AI-guided spec elicitation tool that turns natural-language project goals into structured specifications through a four-mode interview:

- **scope** — goals, terms, context, constraints
- **design** — commitments and tradeoffs
- **requirements** — capability review and gap-finding
- **criteria** — verification coverage

An interviewer agent conducts the conversation. A separate observer agent extracts typed knowledge items from each answered turn and links them into a knowledge graph. The export is built from the active path's reviewed knowledge.

Brunch supports both **greenfield** projects and **brownfield** projects. In brownfield mode, the interviewer explores the codebase through a read-only tool subset before the first scope turn. Storage is **local-first** in a `.brunch/` directory inside the project being worked on.

## Constraints & Non-goals

- Anthropic-only for now.
- No collaborative editing.
- No explicit document-ingestion UX in V1.
- No hard turn-tree branching UX in V1; revisit operates through knowledge-graph edit mode + secondary threads instead.
- No automatic cascade deletion; downstream effects are surfaced and re-resolved explicitly.
- No task-planning surface; Brunch elicits specs, it does not plan implementation work for the user.
- No offline-first or multi-tab sync layer; the current system stays server-authoritative and local-first.

## Requirements

1. `npx brunch` in a project directory with `ANTHROPIC_API_KEY` opens a working app in the browser with state in local `.brunch/`.
2. First launch offers a greenfield / brownfield choice.
3. Brownfield kickoff uses codebase exploration to ground the first interview turn.
4. Structured turns support zero / one / many option selections plus free-text rationale.
5. Users can see thinking, tool usage, and streaming progress in real time.
6. The observer extracts typed knowledge items and graph edges from answered turns.
7. The accumulated knowledge layer and readiness state stay visible during the interview.
8. Each workflow mode has deterministic closeability plus a separate readiness signal.
9. Phase close records summary text and closure basis.
10. Users can revisit knowledge through edit mode, cascade preview, and a secondary thread.
11. Requirements review synthesizes and audits the requirement set from the knowledge layer.
12. Criteria review synthesizes and audits verification conditions from approved requirements plus the knowledge layer.
13. Export is available only when workflow closure, review coverage, and staleness rules are satisfied.
14. Closing and reopening the browser resumes the project from persisted state.
15. The dashboard shows multiple elicitation runs / versions within one `.brunch/` directory.
16. Partial-scope elicitation works for a feature or bounded sub-area, not just whole-product greenfield specs.

## Assumptions

<!-- Pruned 2026-04-14: removed embedded or settled assumptions from earlier phases.
     Kept only assumptions that still materially affect future work. -->

| #   | Assumption | Confidence | Status | Depends on | Validation approach |
| --- | ---------- | ---------- | ------ | ---------- | ------------------- |
| A15 | The LLM can offer useful coarse readiness and closure recommendations, but closure authority must remain explainable and user-legible rather than model-owned. | medium | open | D65, D66 | Manual comparison of model recommendations vs user judgment across varied projects. |
| A20 | Observer results can continue to ride the existing chat stream without unacceptable perceived latency. | high | open | D22 | Measure real observer latency; fall back to a dedicated sync channel if needed. |
| A28 | `ToolLoopAgent` remains sufficient for longer multi-phase interviews without a handwritten loop. | high | open | D30 | Watch long-session manual runs and future probe harnesses. |
| A40 | The canonical scope kinds (`goal`, `term`, `context`) can be discriminated well enough for first-pass review flows if low-confidence cases stay reviewable. | medium | open | D49, D68, D86 | Validate with curated fixtures plus manual review walkthroughs. |
| A44 | The existing structured turn-response seam is sufficient for the first richer review-lifecycle refinements before a larger review-action redesign is needed. | medium | open | D57, D87 | Validate while adding richer review actions in requirements and criteria modes. |
| A47 | Read-only codebase exploration is enough to ground meaningful brownfield kickoff turns without separate document-ingestion UX. | medium | open | D32, D82, D83 | Manual brownfield walkthroughs across varied repositories. |
| A48 | Knowledge-graph edges are sufficient to drive accurate cascade preview for revisit work. | medium | open | D50, D80 | Structural cascade tests plus manual judgment about scope. |
| A49 | A modal secondary thread can resolve revisit implications without forcing a full interview restart. | medium | open | D80 | Manual revisit walkthrough once the thread lifecycle lands. |
| A50 | Layout-level `router.invalidate()` remains fast enough for sidebar refresh after observer updates. | medium | open | D22, D87 | Manual latency checks during live interviews. |

## Decisions

<!-- Pruned 2026-04-14: removed embedded micro-decisions and kept only the current seams
     that still shape forward work or future revisions. -->

10. **Distribution stays single-command and local-first** — `npx brunch` launches the app against the project's `.brunch/` state without requiring a separate hosted control plane.

22. **Observer-result sync stays in-band by default** — observer-created entity updates ride the existing chat stream and invalidate routed data from that seam unless runtime latency proves the need for a dedicated sync channel.

24. **Data Parts carry structured user replies and domain-specific assistant artifacts** — selections, free-text response content, confirmations, summaries, and observer results all share the same typed message-part boundary instead of scalar-only transport.

30. **AI SDK is the agent/runtime boundary** — `ToolLoopAgent` powers the interviewer, `generateObject` powers the observer, and AI SDK message/data-part contracts span streaming, persistence, and hydration.
32. **Brownfield kickoff uses a read-only exploration tool subset** — `read`, `grep`, `find`, and `ls` ground the first scope turn without letting the kickoff mutate the repo.
49. **Knowledge items persist generically but project through kind-specific collections** — storage stays generic; the app seam stays kind-aware.
50. **Knowledge relationships live behind one typed graph seam** — persisted graph edges are first-class and drive dependency, derivation, and revisit behavior.
57. **Structured turn response is the shared semantic boundary** — downstream consumers read structured replies, not scalar answer fallbacks.
61. **Mixed legacy/generic knowledge storage is transitional, not the target state** — the long-term architecture is one coherent generic knowledge model.
65. **Phase outcomes are explicit durable records** — workflow status, closeability, readiness, and closure provenance project from durable phase outcomes on the active path.
66. **Interviewer-recommended and user-forced closes share one transcript-friendly seam** — one phase-close transport handles both paths, with explicit closure basis.
68. **`framing` is a migration alias, not a canonical end-state kind** — long-term writes normalize into sharper scope kinds.
80. **Knowledge-graph revisit replaces hard turn-tree branching for V1** — revisit starts from edit mode on knowledge items, traces cascade through graph edges, and resolves through a modal secondary thread.
81. **Storage is local-first in `.brunch/` inside the project directory** — no global state store.
82. **Kickoff begins with greenfield vs brownfield routing** — the first screen explicitly distinguishes new concepts from existing-codebase work.
83. **Brownfield exploration feeds interviewer context, not direct knowledge writes** — the observer remains the sole durable entry point for knowledge creation.
86. **The client is organized by phase routes and three concentric layout shells** — AppLayout, ProjectLayout, and ViewLayout own the user-facing route structure.
87. **Layout-level data ownership partitions invalidation** — workflow state, knowledge state, and per-phase turns load at different route layers instead of one monolithic refresh boundary.
88. **Entities default to the active-path read model** — project-wide inventory is explicit rather than the default workspace surface.

## Critical Invariants

<!-- Pruned 2026-04-14: kept only seam-level invariants that still protect active work. -->

| #    | Invariant | Protected by | Proves |
| ---- | --------- | ------------ | ------ |
| I4   | Vite proxy routing and the runtime backend-port seam stay aligned through one explicit configuration path. | `runtime-config.test.ts` | D81 |
| I17  | Data Part schema validation remains confined to true LLM / HTTP boundaries rather than mirrored internal seams. | `parts.test.ts` | D24 |
| I24  | Interview hydration, streaming projection, controller orchestration, mutation transport, and phase-filtered rendering remain stable through the routed interview surface. | `InterviewView.test.tsx`, `-interview-data.test.ts`, `-interview-controller.test.tsx`, `client-mutation.test.ts` | D30, D86, D87 |
| I44  | Structured turn responses round-trip through persistence, hydration, projection, and UI affordance state without collapsing back to scalar semantics. | `turn-response.test.ts`, `context.test.ts`, `InterviewView.test.tsx` | D57 |
| I48  | Canonical knowledge kinds persist with provenance and project through typed entity collections plus graph edges without ontology drift. | `db.test.ts`, `knowledge.test.ts`, `EntitySidebar.test.tsx`, `GraphView.test.tsx` | D49, D50 |
| I54  | Phase-aware observer extraction widens to all canonical knowledge kinds and survives persistence plus UI refresh without breaking sync. | `observer.test.ts`, `context.test.ts`, `app.test.ts` | D30, D49 |
| I72  | Explicit phase outcomes project shared workflow status, closeability, readiness, and closure basis through one durable seam. | `phase-close.test.ts`, `db.test.ts`, `app.test.ts` | D65, D66 |
| I87  | Requirements and criteria review ground themselves in their respective inventories, persist explicit review state, and gate closeability through the shared phase-close seam correctly. | `interview.test.ts`, `db.test.ts`, `app.test.ts` | D65, D66 |
| I100 | `.brunch/` project resolution, launcher startup, actual bound URL reporting, and same-project runtime ownership stay correct in local-first distribution. | `project.test.ts`, `launcher.test.ts`, `cli.test.ts`, `runtime-config.test.ts` | D81 |
| I101 | Project mode (greenfield vs brownfield) persists through schema, API, and interviewer configuration; brownfield gets exploration context without mutating later phases. | `db.test.ts`, `interview.test.ts`, `ProjectList.test.tsx` | D82, D83 |
| I102 | File-route generation, directory-based nesting, and the three-shell route architecture remain the runtime routing source of truth; graph view stays code-split. | `router.test.tsx`, `file-route-*.test.ts`, `build-boundary.test.ts`, `GraphView.test.tsx` | D86 |
| I103 | Trusted runtime-shaped fixture scenarios normalize back into the manifest seam and drive observer probes through one canonical scenario format. | `corpus.test.ts`, `manifest.test.ts` | D49 |

## Lexicon

### Core terms

| Term | Definition |
| ---- | ---------- |
| **project** | One elicitation run within a `.brunch/` directory. |
| **turn** | One persisted interview checkpoint with parent linkage and typed parts. |
| **active path** | The trusted chain from HEAD to root in the primary conversation. |
| **phase / mode** | One workflow stage: `scope`, `design`, `requirements`, or `criteria`. |
| **phase outcome** | Durable closure artifact for a phase, including summary and closure basis. |
| **closure basis** | Whether a confirmed phase close came from interviewer recommendation or explicit user-forced closure. |
| **closeability** | Deterministic minimum bar for whether the user may close a phase now. |
| **readiness band** | Coarse descriptive signal (`low`, `medium`, `high`) separate from closeability. |
| **review state** | Explicit `pending`, `approved`, or `rejected` status carried by requirements and criteria during review phases. |
| **knowledge item** | Typed semantic record such as `goal`, `term`, `context`, `constraint`, `assumption`, `decision`, `requirement`, or `criterion`. |
| **knowledge graph** | Typed relationships among knowledge items, including `depends_on`, `derived_from`, `constrains`, `verifies`, and `refines`. |
| **secondary thread** | Modal revisit conversation anchored to a primary-path turn and used to resolve cascade implications. |
| **needs-revisit** | Flag meaning an item is affected by upstream invalidation and must be explicitly resolved before the project is whole again. |

### Boundary terms

| Term | Definition |
| ---- | ---------- |
| **greenfield** | New concept with no existing codebase context. |
| **brownfield** | Feature or sub-scope inside an existing codebase; kickoff uses read-only exploration. |
| **BrunchUIMessage** | Typed UI message contract spanning validation, persistence, SSE streaming, and hydration. |
| **Data Part** | Typed custom message part used for structured input and domain-specific assistant output. |
| **context builder** | Typed projection from project state into inference context for interviewer, observer, or closure logic. |

## Verification Design

### Verification Commands

| Step | Check | Command |
| ---- | ----- | ------- |
| 1 | Formatting | `npm run fmt:check` |
| 2 | Lint + type check | `npm run lint` |
| 3 | Unit tests | `npm run test` |
| 4 | Build | `npm run build` |
| all | Full gate | `npm run verify` |

### Verification Policy

Every meaningful code change should pass `npm run fix` in the inner loop and `npm run verify` before commit. Slices that touch the user-facing boundary should also stay manually walkthrough-able via the local app.

### Verification Stance

- **Inner loop** locks schema boundaries, domain state transitions, and seam-level regressions quickly.
- **Middle loop** proves round-trips across persistence, routing, observer sync, and workflow closure.
- **Outer loop** is still required for interview quality, brownfield grounding quality, revisit UX, and latency judgment.

### Acknowledged Blind Spots

- Qualitative interviewer quality is still a human judgment problem.
- Brownfield kickoff quality still depends on manual walkthroughs across different repos.
- Observer latency and sidebar freshness need runtime observation, not just tests.
- Revisit UX and secondary-thread adequacy cannot be closed purely by structural tests.

### Current Coverage

| File | Protects |
| ---- | -------- |
| `db.test.ts` | I48, I72, I101 |
| `app.test.ts` | I54, I72, I87 |
| `context.test.ts` | I44, I54 |
| `observer.test.ts` | I48, I54 |
| `InterviewView.test.tsx` | I24, I44, I72 |
| `interview.test.ts` | I87, I101 |
| `phase-close.test.ts` | I72 |
| `router.test.tsx` | I102 |
| `GraphView.test.tsx` | I48, I102 |
| `project.test.ts` / `launcher.test.ts` / `runtime-config.test.ts` | I4, I100 |
| `corpus.test.ts` / `manifest.test.ts` | I103 |

## Acceptance Criteria

1. `npx brunch` can start from a project directory with local-first persistence in `.brunch/`.
2. Greenfield and brownfield kickoff both work, with brownfield grounded by exploration.
3. Structured turns support rich responses without losing semantic fidelity.
4. The knowledge layer stays visible, typed, and linked through graph relationships.
5. Phase closeability, readiness, and closure provenance stay legible to the user.
6. Requirements and criteria review remain explicit, durable, and export-relevant.
7. Revisit can invalidate knowledge, surface cascade, and re-resolve through a secondary thread.
8. The routed UI stays stable across dashboard, phase views, sidebar knowledge, and graph view.
9. Resume works from persisted state.
10. The verification gate passes.

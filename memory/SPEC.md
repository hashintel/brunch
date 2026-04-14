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
- No general-purpose inline document editor in review phases; requirements and criteria review stay recommendation-led with lightweight user comments for revision.
- No offline-first or multi-tab sync layer; the current system stays server-authoritative and local-first.

## Requirements

1. `npx brunch` in a project directory with `ANTHROPIC_API_KEY` opens a working app in the browser with state in local `.brunch/`.
2. First launch offers a greenfield / brownfield choice through kickoff entry states inside the project workspace.
3. Brownfield kickoff uses codebase exploration to ground the kickoff flow and the first scope turn.
4. Structured responses support one-or-many option selections, an explicit `none of the above` path, and one attached response note.
5. Users can see thinking, tool usage, and streaming progress in real time; if live-only artifacts are shown, replay keeps durable inert placeholders instead of dropping them completely.
6. The observer extracts typed knowledge items and graph edges from answered turns.
7. The accumulated knowledge layer and readiness state stay visible during the interview.
8. Each workflow mode has deterministic closeability plus a separate readiness signal.
9. Phase close records summary text and closure basis.
10. Users can revisit knowledge through edit mode, cascade preview, and a secondary thread.
11. Requirements review synthesizes a candidate requirement set from the knowledge layer and supports lightweight per-item approve / reject / comment resolution.
12. Criteria review synthesizes a candidate verification set from approved requirements plus the knowledge layer and supports lightweight per-item approve / reject / comment resolution.
13. Export is available only when workflow closure, review coverage, and staleness rules are satisfied.
14. Closing and reopening the browser resumes the project from persisted state.
15. The dashboard shows multiple elicitation runs / versions within one `.brunch/` directory.
16. Partial-scope elicitation works for a feature or bounded sub-area, not just whole-product greenfield specs.
17. Each phase exposes an explicit entry, handoff, or completion affordance when no active turn is open; the UI must not strand the user with a bare generic composer as the only visible action.
18. Open interview phases default to the current unresolved turn or a visible generation state, and closed phases terminate in a handoff or completion artifact at the bottom of the workspace transcript.

## Assumptions

<!-- Pruned 2026-04-14: removed embedded or settled assumptions from earlier phases.
     Kept only assumptions that still materially affect future work. -->

| #   | Assumption | Confidence | Status | Depends on | Validation approach |
| --- | ---------- | ---------- | ------ | ---------- | ------------------- |
| A15 | The LLM can offer useful coarse readiness and closure recommendations, but closure authority must remain explainable and user-legible rather than model-owned. | medium | open | D65, D66 | Manual comparison of model recommendations vs user judgment across varied projects. |
| A20 | Observer results can continue to ride the existing chat stream without unacceptable perceived latency. | high | open | D22 | Measure real observer latency; fall back to a dedicated sync channel if needed. |
| A28 | `ToolLoopAgent` remains sufficient for longer multi-phase interviews without a handwritten loop. | high | open | D30 | Watch long-session manual runs and future probe harnesses. |
| A40 | The canonical scope kinds (`goal`, `term`, `context`) can be discriminated well enough for first-pass review flows if low-confidence cases stay reviewable. | medium | open | D49, D68, D86 | Validate with curated fixtures plus manual review walkthroughs. |
| A44 | The existing structured response seam is sufficient to support distinct review-set approve / reject / comment actions without introducing a second persistence model. | medium | open | D57, D90 | Validate while prototyping requirements and criteria review-list flows. |
| A47 | Read-only codebase exploration plus the current prompt-shaped kickoff handoff are enough to ground meaningful brownfield kickoff turns without separate document-ingestion UX. | medium | open | D32, D82, D83, D91 | Manual brownfield walkthroughs across varied repositories. |
| A48 | Knowledge-graph edges are sufficient to drive accurate cascade preview for revisit work. | medium | open | D50, D80 | Structural cascade tests plus manual judgment about scope. |
| A49 | A modal secondary thread can resolve revisit implications without forcing a full interview restart. | medium | open | D80 | Manual revisit walkthrough once the thread lifecycle lands. |
| A50 | Layout-level `router.invalidate()` remains fast enough for sidebar refresh after observer updates. | medium | open | D22, D87 | Manual latency checks during live interviews. |
| A51 | Kickoff plus the scope/design interview remain legible if the primary input surface is the workspace-owned active turn card rather than a persistent global composer. | medium | open | D89, D91 | Manual walkthroughs on kickoff, scope, and design states plus story review of entry / handoff patterns. |
| A52 | Lightweight per-item approve / reject / comment review is sufficient for requirements and criteria without inline editing or repeated interviewer micro-turns. | medium | open | D90 | Manual review walkthroughs on seeded requirement and criteria scenarios. |
| A53 | Contentless durable placeholders are sufficient to preserve transcript trust for live thinking/tool artifacts without persisting hidden reasoning or raw tool results. | medium | open | D92 | Manual replay/reload walkthroughs on streamed turns once transcript placeholders land. |
| A54 | An open phase can reliably project a current unresolved turn or a visible generation state on first render without requiring the user to bootstrap the phase by typing or clicking a synthetic start message. | medium | open | D89, D94 | Manual walkthroughs on kickoff-ready, design-active, and resumed phase states. |
| A55 | Observer capture can trail interviewer completion without eroding trust if the trailing status stays attached to the completed turn card rather than surfacing as a free-floating transcript row. | medium | open | D22, D95 | Manual timing walkthroughs plus runtime observation on seeded turns with known observer work. |

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
57. **Structured turn response is the shared semantic boundary** — the canonical user reply is option selection(s) plus one response note; downstream consumers read structured replies, not scalar answer fallbacks.
61. **Mixed legacy/generic knowledge storage is transitional, not the target state** — the long-term architecture is one coherent generic knowledge model.
65. **Phase outcomes are explicit durable records** — workflow status, closeability, readiness, and closure provenance project from durable phase outcomes on the active path.
66. **Interviewer-recommended and user-forced closes share one transcript-friendly seam** — one phase-close transport handles both paths, with explicit closure basis.
68. **`framing` is a migration alias, not a canonical end-state kind** — long-term writes normalize into sharper scope kinds.
80. **Knowledge-graph revisit replaces hard turn-tree branching for V1** — revisit starts from edit mode on knowledge items, traces cascade through graph edges, and resolves through a modal secondary thread.
81. **Storage is local-first in `.brunch/` inside the project directory** — no global state store.
82. **Kickoff begins with greenfield vs brownfield routing** — the first screen explicitly distinguishes new concepts from existing-codebase work.
83. **Brownfield exploration feeds interviewer context and observer grounding, not direct knowledge writes** — the observer remains the sole durable entry point for knowledge creation; kickoff grounding currently rides through repo metadata plus the first scope question's transcript-visible handoff rather than a separate persisted kickoff artifact.
86. **The client is organized by phase routes and three concentric layout shells** — AppLayout, ProjectLayout, and ViewLayout own the user-facing route structure.
87. **Layout-level data ownership partitions invalidation** — workflow state, knowledge state, and per-phase turns load at different route layers instead of one monolithic refresh boundary.
88. **Entities default to the active-path read model** — project-wide inventory is explicit rather than the default workspace surface.
89. **Primary elicitation input is workspace-owned and turn-owned** — scope/design answers happen inside the active turn card; phase entry and handoff states may have no live turn; the global bottom composer is not the canonical input seam for core elicitation. Depends on: A51. Supersedes: —.
90. **Requirements and criteria resolve through synthesized review sets** — the interviewer proposes candidate items from prior knowledge, the user acts per item through approve / reject / comment responses, and phase confirmation happens at the list level rather than through repeated micro-interviews. Depends on: A44, A52. Supersedes: —.
91. **Kickoff uses workspace entry states in the same interaction family as elicitation** — greenfield/brownfield routing and the first scoping steps live in the project workspace through dedicated kickoff cards rather than root-route modals or a bare chat shell. Depends on: A47, A51. Supersedes: —.
92. **Live-only assistant artifacts replay as contentless placeholders** — if thinking or tool use is surfaced live, hydration persists an inert marker that the artifact occurred without persisting hidden reasoning tokens or raw tool results. Depends on: A53. Supersedes: —.
93. **Replay for elicitation phases is turn-shaped, not message-shaped** — completed interview turns collapse into answered-turn records that summarize the question, the structured user response, and the capture status, while control and closure events render in their own interaction family rather than as ordinary chat bubbles. Depends on: A51, A53. Supersedes: —.
94. **Phase progression is bottom-anchored** — if a phase is open, the workspace transcript bottoms out in the current unresolved turn or a visible generation state; if a phase is closed, the transcript bottoms out in a handoff or completion artifact. Depends on: A51, A54. Supersedes: —.
95. **Observer capture may trail interviewer progression if it stays turn-owned** — interviewer completion may unlock the next turn before observer capture finishes, but any trailing observer state remains attached to the just-answered turn card rather than surfacing as a free-floating transcript row. Depends on: A20, A53, A55. Supersedes: —.

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
| I101 | Project mode (greenfield vs brownfield) persists through schema, API, interviewer configuration, and observer context; brownfield kickoff grounding reaches the first scope turn and observer without mutating later phases. | `db.test.ts`, `interview.test.ts`, `app.test.ts`, `context.test.ts`, `observer.test.ts`, `ProjectList.test.tsx` | D82, D83 |
| I102 | File-route generation, directory-based nesting, and the three-shell route architecture remain the runtime routing source of truth; graph view stays code-split. | `router.test.tsx`, `file-route-*.test.ts`, `build-boundary.test.ts`, `GraphView.test.tsx` | D86 |
| I103 | Trusted runtime-shaped fixture scenarios normalize back into the manifest seam, front-load the walkthrough seed catalog, and remain resumable/exportable through one canonical scenario format. | `corpus.test.ts`, `manifest.test.ts`, `walkthrough.test.ts` | D49 |

## Lexicon

### Core terms

| Term | Definition |
| ---- | ---------- |
| **project** | One elicitation run within a `.brunch/` directory. |
| **turn** | One persisted interview checkpoint with parent linkage and typed parts. |
| **active turn** | A live interviewer question in scope/design awaiting a structured user response inside the workspace card. |
| **answered-turn card** | The compact replay form of a completed elicitation turn, summarizing the question, the structured response, and the turn-owned capture status. |
| **response note** | The single attached text field on a structured user response; it may explain selections, add missing context, or redirect the interviewer. |
| **review set** | A synthesized candidate list used in requirements or criteria review, resolved through lightweight per-item approve / reject / comment actions. |
| **phase entry state** | The workspace state shown when a phase is open but no active turn exists yet. |
| **phase handoff state** | The workspace state shown when a phase is complete and the next phase is available. |
| **control marker** | A transcript-visible workspace event such as interview start, resume, or confirmation that is not rendered as a normal user chat bubble. |
| **turn capture status** | The per-turn state describing what the observer has captured already, is still capturing, or failed to capture from that answered turn. |
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
| **walkthrough scenario** | Named trusted fixture scenario used to seed a resumable manual-inspection workspace. |

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

- Verification is first-class work; this wave stays **manual-heavy by deliberate choice**, not by accident.
- **Inner loop** proves structural validity, boundary safety, and non-destructive behavior.
- **Middle loop** proves replay, refresh-boundary ownership, and explicit state projection where cheap automated checks can remove bad degrees of freedom.
- **Outer loop** is the authority for brownfield grounding quality, transcript legibility, waiting-state clarity, and phase-layout differentiation.
- Outer-loop UI review uses a **dramaturgical see-and-inspect** posture: judge whether the product stages its state transitions legibly for a human, not just whether bytes round-trip.

### Diagnostic Assessment

| Dimension | Score | Notes | Change trigger |
| --------- | ----- | ----- | -------------- |
| Observability | partial | Persistence, manifests, DB state, and route seams are visible in text, but the most important failures in this wave still present as browser-visible transcript disappearance, waiting-state ambiguity, and layout legibility issues. | Promote instrumentation if manual browser inspection cannot explain refresh or lock behavior confidently. |
| Reproducibility | partial | Trusted manifest seeding and capture-backed corpus give a strong base, but brownfield kickoff quality still varies by repo shape and live refresh behavior is not yet represented by a canonical replay matrix. | Promote a stronger corpus or replay harness if ad hoc brownfield/manual checks stop being trustworthy. |
| Controllability | partial | The agent can iterate on fixtures, stories, and structural tests autonomously, but the core acceptance signals for this wave remain human judgment calls. | Raise controllability only if manual review becomes the bottleneck or repeated ambiguity blocks progress. |

### Oracle Strategy by Loop Tier

| Tier | Oracle families | What they prove | Main targets |
| ---- | --------------- | --------------- | ------------ |
| Inner | Schema validation, type-aware linting, focused unit/integration tests, negative-space regressions | Boundaries remain type-safe; persistence and transport seams do not silently collapse; obvious bad failures are caught cheaply. | I4, I17, I24, I44, I48, I54, I72, I87, I100, I101, I102, I103 |
| Middle | Round-trip / replay oracles for seeded projects, hydration, export, and resume | Seeded or persisted state can be loaded, projected, re-rendered, and exported without losing required semantic markers. | Requirements 13, 14, 15; I24, I44, I100, I103 |
| Middle | Route/query ownership integration oracles | Observer updates and response mutations refresh only their owned surfaces instead of tearing down unrelated transcript state. | Requirements 5, 7, 14; A20, A50; I24, I54, I102 |
| Middle | Explicit state-model oracles for in-flight UI states | Every major in-flight mode is named, projectable, and visibly representable instead of collapsing into one opaque loading bit. | Requirement 5; I24, I44 |
| Outer | Fixture-backed manual walkthroughs on seeded scenarios | Walkthrough fixtures are useful enough to inspect phase transitions, export output, resume behavior, and missing-view discovery. | Requirements 13, 14, 15; I100, I103 |
| Outer | Brownfield kickoff walkthroughs on real repos, evaluated qualitatively | Kickoff yields durable useful knowledge and a grounded first question for feature-area work, without needing a fully automated quality score. | Requirements 3, 16; A47; I101 |
| Outer | Dramaturgical story and transcript review | Phase differentiation, transcript artifact legibility, and waiting-state clarity are judged as staged user experience rather than just structural output. | Requirement 5; A15, A28, A40, A44, A50 |

### Design Notes

- **Legible replay fidelity beats exact replay fidelity for now** — hydrated transcripts may use placeholders or summary markers to indicate that reasoning or tool activity happened at a point in the conversation, even if the full original content is not persisted.
- **Turn-first replay now beats message-first replay** — for scope/design, the replay unit should trend toward completed turns plus one live unresolved turn, not alternating assistant/user chat bubbles and stream markers.
- **Brownfield kickoff has a deliberately modest proof bar** — this wave only needs durable useful knowledge plus a grounded first question, not a fully proven framing bundle before scope can proceed.
- **Waiting states should become an explicit vocabulary in code** — the user-facing contract is that each major in-flight mode is visibly represented; deep lock/wait introspection is diagnostic scaffolding, not yet a product requirement.
- **Manual verification is intentionally lightweight** — no heavyweight scripted walkthrough protocol yet; use seeded scenarios and see-and-inspect review rather than bureaucratic checklists.
- **Kickoff strategy comparison stays qualitative unless proven insufficient** — if the brownfield mode fork remains ambiguous after manual repo comparisons, promote that question to a spike with a stronger comparison harness.

### Acknowledged Blind Spots

| Blind spot | Reason | Current mitigation | Revisit trigger |
| ---------- | ------ | ------------------ | --------------- |
| Qualitative interviewer and kickoff quality across many repo shapes | Chosen manual-first; no broad brownfield corpus or score harness yet | Manual brownfield walkthroughs on representative repos | Brownfield regressions recur or kickoff strategy debates cannot be resolved qualitatively |
| Transcript trust and readability after hydration | Exact replay of all reasoning/tool detail is intentionally deferred | Legible placeholders/summary markers plus manual transcript review | Users still cannot understand what happened after replay despite visible markers |
| Actual lock/wait causality in the UI | Instrumentation is not yet the primary investment | Require explicit visible in-flight states and inspect browser behavior manually | Manual inspection cannot explain a repeated perceived lock or disappearance bug |
| Story quality and phase differentiation | Design quality is not executable in a trustworthy way yet | Story variants reviewed against seeded walkthrough findings | Story/app drift grows or design disagreement blocks implementation |
| Observer latency and layout refresh freshness | No explicit latency budget or perf gate yet | Runtime observation during manual sessions | A20 or A50 show recurring latency or coarse refresh pain |
| Revisit UX and secondary-thread adequacy | That seam is still future work | Keep structural coverage on graph/persistence seams only | Revisit work moves from horizon into the active frontier |

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
| `corpus.test.ts` / `manifest.test.ts` / `walkthrough.test.ts` | I103 |

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
11. Scope/design use active-turn cards, requirements/criteria use review sets, and non-active phases expose entry / handoff / completion affordances instead of a bare generic composer.
12. Hydrated transcripts preserve interviewer-side structure plus stable contentless placeholders for any live-only artifacts that were shown during streaming.
13. Open phases bottom-load the current unresolved turn or a visible generation state, completed elicitation turns replay as answered-turn records, and closed phases bottom-load a handoff or completion artifact.

# Breadboard: Brunch Web UI

> Produced by `flow-shape-breadboard` · 2026-04-01
> Inputs: SPEC.md §Requirements, §Decisions D17–D20, §Lexicon

## Places

| ID | Place               | Route                     | Requirements served | Notes                                                        |
| -- | ------------------- | ------------------------- | ------------------- | ------------------------------------------------------------ |
| P1 | Project list        | `/`                       | R1, R15             | Landing page. Shows projects with phase badges.              |
| P2 | Interview workspace | `/project/:id`            | R2–R12, R14         | Main view. Conversation + entity sidebar + phase indicator.  |
| P3 | Export preview      | `/project/:id/export`     | R13                 | Rendered markdown preview + download. Guarded by spec readiness. |

P2 is the **primary place** — users spend 90%+ of time here. It contains three regions:
- **Conversation panel** (center) — active-path turns, structured question cards, streaming response
- **Entity sidebar** (right) — tabbed: decisions, assumptions, requirements, criteria. Each entity shows status + actions.
- **Header bar** — project name, phase indicator (scope → design → requirements → criteria), export button (enabled when ready)

Turn tree navigation and branch switching live within P2 (collapsible panel or header dropdown), not a separate route.

## UI Affordances

### P1 — Project list

| Affordance          | Interaction   | Effect                             |
| ------------------- | ------------- | ---------------------------------- |
| Project card        | Click         | Navigate to P2                     |
| Phase badge         | Read-only     | Shows completion per phase         |
| "New project" button| Click         | `POST /api/projects` → navigate P2 |

### P2 — Interview workspace

**Conversation panel:**

| Affordance              | Interaction    | Effect                                              |
| ----------------------- | -------------- | --------------------------------------------------- |
| Turn card               | Read           | Shows question + options + grounding + impact + answer |
| Option buttons          | Click          | `POST /api/projects/:id/chat` with selected option  |
| Free text input         | Submit         | `POST /api/projects/:id/chat` with text             |
| Streaming response      | Read           | SSE stream renders thinking → text → turn-created   |
| Phase transition prompt | Confirm/reject | Agent proposes, user confirms to advance phase      |

**Entity sidebar:**

| Affordance                | Interaction       | Effect                                                  |
| ------------------------- | ----------------- | ------------------------------------------------------- |
| Decision list             | Read              | Shows active-path decisions with dependency edges       |
| Decision → "revisit"     | Click + confirm   | `POST /api/projects/:id/branch` → conversation rewinds |
| Assumption list           | Read              | Shows assumptions with confidence badges                |
| Assumption → verify       | Click             | `PUT /api/projects/:id/assumptions/:id` action=verify   |
| Assumption → falsify      | Click + confirm   | `PUT /api/projects/:id/assumptions/:id` action=falsify → flag propagation |
| Assumption → edit content | Inline edit       | `PUT /api/projects/:id/assumptions/:id`                 |
| Requirement list          | Read              | Shows requirements with reviewed_at / stale badges      |
| Requirement → edit        | Inline edit       | `PUT /api/projects/:id/requirements/:id` → flag criteria |
| Requirement → delete      | Click + confirm   | `DELETE /api/projects/:id/requirements/:id`              |
| Requirement → review      | Click             | `PUT /api/projects/:id/requirements/:id/review`         |
| Criterion list            | Read              | Shows criteria with reviewed_at / stale badges          |
| Criterion → edit          | Inline edit       | `PUT /api/projects/:id/criteria/:id`                    |
| Criterion → delete        | Click + confirm   | `DELETE /api/projects/:id/criteria/:id`                  |
| Criterion → review        | Click             | `PUT /api/projects/:id/criteria/:id/review`             |
| "Stale" badge             | Read              | Visual flag on soft-invalidated entities                |
| Dependency expand         | Click on entity   | Shows what this entity depends on / what depends on it  |

**Header bar:**

| Affordance          | Interaction | Effect                                           |
| ------------------- | ----------- | ------------------------------------------------ |
| Phase indicator     | Read        | Shows scope → design → requirements → criteria with completion |
| Branch indicator    | Click       | Opens branch switcher dropdown                   |
| Branch → switch     | Click       | `POST /api/projects/:id/checkout` → refetch all  |
| Export button       | Click       | Navigate to P3 (disabled until spec readiness)   |

### P3 — Export preview

| Affordance       | Interaction | Effect                               |
| ---------------- | ----------- | ------------------------------------ |
| Markdown preview | Read        | Rendered from active-path entities   |
| Download button  | Click       | Download .md file                    |
| Back link        | Click       | Navigate to P2                       |

## Code Affordances (API Routes)

### Project management

| Method | Route                | Core operation     | Returns                         |
| ------ | -------------------- | ------------------ | ------------------------------- |
| GET    | /api/projects        | listProjects       | `Project[]` with phase status   |
| POST   | /api/projects        | createProject      | `Project`                       |
| GET    | /api/projects/:id    | getProject         | `Project` + `Turn[]` (active path) + `PhaseStatus` |

### Interview (SSE streaming)

| Method | Route                      | Core operation | Returns                   |
| ------ | -------------------------- | -------------- | ------------------------- |
| POST   | /api/projects/:id/chat     | conductTurn    | SSE stream (`DomainEvent` → AI SDK events) |

### Turn tree

| Method | Route                          | Core operation | Returns                     |
| ------ | ------------------------------ | -------------- | --------------------------- |
| POST   | /api/projects/:id/branch       | branch         | `Project` (updated HEAD)    |
| POST   | /api/projects/:id/checkout     | checkout       | `Project` (updated HEAD)    |

### Entities (batch read)

| Method | Route                          | Core operation                | Returns                      |
| ------ | ------------------------------ | ----------------------------- | ---------------------------- |
| GET    | /api/projects/:id/entities     | getActive{Decisions,Assumptions} + getRequirements + getCriteria | `EntityBundle` |
| GET    | /api/projects/:id/graph        | getEntityGraph                | DAG nodes + edges            |

### Entity lifecycle

| Method | Route                                      | Core operation       | Returns        |
| ------ | ------------------------------------------ | -------------------- | -------------- |
| PUT    | /api/projects/:id/assumptions/:aid         | update/verify/falsify| `Assumption`   |
| POST   | /api/projects/:id/requirements             | createRequirement    | `Requirement`  |
| PUT    | /api/projects/:id/requirements/:rid        | updateRequirement    | `Requirement`  |
| DELETE | /api/projects/:id/requirements/:rid        | deleteRequirement    | —              |
| PUT    | /api/projects/:id/requirements/:rid/review | reviewRequirement    | `Requirement`  |
| POST   | /api/projects/:id/criteria                 | createCriterion      | `Criterion`    |
| PUT    | /api/projects/:id/criteria/:cid            | updateCriterion      | `Criterion`    |
| DELETE | /api/projects/:id/criteria/:cid            | deleteCriterion      | —              |
| PUT    | /api/projects/:id/criteria/:cid/review     | reviewCriterion      | `Criterion`    |

### Export

| Method | Route                       | Core operation | Returns          |
| ------ | --------------------------- | -------------- | ---------------- |
| GET    | /api/projects/:id/export    | exportSpec     | Markdown string  |

## Data Stores

| Store             | Technology                | Holds                                  | Lifecycle          |
| ----------------- | ------------------------- | -------------------------------------- | ------------------ |
| SQLite            | Drizzle + better-sqlite3  | All entities, turn tree, join tables   | Persistent on disk |
| useChat state     | @ai-sdk/react             | Conversation messages (hydrated from turns) | Per-session, hydrated on mount |
| Entity state      | React (fetch on demand)   | Sidebar entity lists                   | Refetched after mutations |
| Phase state       | Derived from turns        | Phase indicator                        | Computed from active path |
| URL               | React Router              | Project ID, current view               | Bookmarkable       |

## Wiring

### Page load (P2)

```
Browser navigates to /project/:id
  → GET /api/projects/:id        → hydrate project + turns → useChat.setMessages()
  → GET /api/projects/:id/entities → hydrate entity sidebar
```

### Interview turn

```
User submits answer (option click or text)
  → POST /api/projects/:id/chat (SSE)
  → useChat consumes stream (thinking → text-delta → ...)
  → DomainEvent 'turn-created' signals turn saved
  → DomainEvent 'observer-complete' signals entities extracted
  → Client refetches /api/projects/:id/entities (sidebar updates)
```

### Decision revisit (branch)

```
User clicks "revisit" on a decision in sidebar
  → Confirmation dialog ("This will branch the conversation")
  → POST /api/projects/:id/branch { turnId: decision.sourceTurnId }
  → Server: branch() moves HEAD to fork point
  → Client: refetch /api/projects/:id (new active path → conversation rewinds)
  → Client: refetch /api/projects/:id/entities (path exclusion → some entities gone)
  → Sidebar shows stale badges on requirements traced to abandoned decisions
```

### Assumption falsification (flag propagation)

```
User clicks "falsify" on an assumption in sidebar
  → Confirmation dialog ("This will flag dependent entities")
  → PUT /api/projects/:id/assumptions/:id { action: 'falsify' }
  → Server: walks graph edges, nulls reviewed_at on dependents
  → Client: refetch /api/projects/:id/entities
  → Sidebar shows stale badges on affected decisions, requirements, criteria
```

### Phase transition

```
Agent sets is_resolution = true on a turn
  → DomainEvent 'phase-resolved' { phase: 'scope' }
  → Client shows phase summary modal
  → User confirms → next phase begins
  → Phase indicator updates
```

### Export

```
User clicks Export (enabled when spec readiness = true)
  → Navigate to /project/:id/export
  → GET /api/projects/:id/export
  → Server: collect active-path entities → render markdown template
  → Client: render preview + download button
```

## Handoff

### Candidate cards (vertical behaviors ready to scope)

1. **Drizzle + core extraction refactor** — Migrate raw DDL to Drizzle schema, extract interview orchestration from Express handler into core service layer. Infrastructure slice.
2. **Multi-project routing** — React Router, project list page (P1), project-scoped API routes. Replaces current single-project `/api/projects/current`.
3. **Entity sidebar** — Fetch and render active-path entities alongside the conversation. Read-only initially.
4. **Entity lifecycle API** — CRUD + review + verify/falsify endpoints for the entity sidebar to write to.
5. **Decision revisit (branch + checkout)** — Turn tree branching via sidebar, path exclusion, stale badges.

### Capsule impacts

- **New lexicon**: `entity bundle`, `entity sidebar`, `stale badge`, `spec readiness predicate`
- **New boundary**: SSE stream now carries entity lifecycle signals (`observer-complete`, `phase-resolved`), not just conversation content. The DomainEvent contract (D19) is the coordination mechanism between the streaming conversation and the REST entity sidebar.

### Open uncertainty

- **Entity editing timing**: The sidebar affords direct editing at any time, but the spec says requirements are "confirmed during the requirements review phase." Tension between structured flow and direct manipulation. Recommendation: allow direct editing always, but the review *phase* is when the agent systematically walks the list. Direct edits outside the phase are the user's prerogative.
- **Turn tree visualization**: R9 says "navigate the turn tree" but doesn't specify the widget. Options: git-log-style branch graph, dropdown branch list, or timeline with fork indicators. Recommend: start with a branch dropdown (showing HEAD of each branch) — defer the visual tree to later.
- **Entity refetch coordination**: After a turn completes, should the client poll for entities, or should the SSE stream include a signal? DomainEvent `observer-complete` already exists in D19 — use it as the refetch trigger. No polling.

### Next command

`/ln-plan` — re-slice PLAN.md to incorporate the refactor, routing, and breadboarded affordances.

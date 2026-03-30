# Refactors

## Replace Dolt with SQLite

Dolt was added mid-project (PR #4) as an experiment — the app originally ran on SQLite. The database-level git semantics (commit, diff, checkout, revert) don't map well to the product model: versioning is global, not per-project, so commits and reverts bleed across projects. The README acknowledges this and suggests per-project Dolt branches as a fix, but that adds further complexity.

A simpler approach: revert to SQLite and implement per-project versioning via snapshot tables or serialized JSON blobs. The data set per project is small (goal + assumptions + requirement tree), so a `project_snapshot` table with version numbering covers the actual user need — "what did my spec look like before the AI changed it" — without requiring Docker, a running server process, or MySQL-compatible tooling.

**What changes:**
- `server/db.js` — replace `mysql2` connection pool with `better-sqlite3` or similar
- `server/migrations/` — rewrite as SQLite-compatible DDL; add a `project_snapshot` table
- `server/routes/versions.js` — replace Dolt SQL extensions (`DOLT_DIFF`, `AS OF`, `DOLT_COMMIT`, etc.) with snapshot CRUD
- `docker-compose.yml` / `Dockerfile` — remove Dolt container dependency
- `package.json` — swap `mysql2` for an SQLite driver
- Frontend version control UI (`useVersions.ts`, `SessionPanel.tsx`) — adapt to snapshot-based API

## Fix domain terminology: assumptions, decisions, requirements, acceptance criteria

The terms "assumptions" and "requirements" as used in the codebase don't match their standard meanings, and the resulting workflow conflates two distinct concerns.

**"Assumptions" are actually design decisions.** The `wizardAssumptionsSchema` models each "assumption" with alternative options the user chooses between, and a confirm/edit/reject status. That's a decision point in a design tree, not an assumption. An assumption is a falsifiable belief you proceed on (e.g. "users have stable internet"), not something you pick from a menu of alternatives.

**"Requirements" are actually acceptance criteria.** The `wizardRequirementsSchema` produces testable statements with verification checks (`benchmark`, `e2e`, `unit`, `human_review`, `static_analysis`). These are "how will we know it's done" items — not requirements in the sense of stakeholder needs with rationale, priority, and dependencies.

The confusion surfaces in the data model itself: requirements carry a `status` field with a `decision_node` variant, acknowledging that some "requirements" are really unresolved design decisions — the thing the "assumptions" step was supposed to handle.

**What the domain model should distinguish:**
- **Assumptions** — falsifiable beliefs the spec rests on; if wrong, the spec needs rework
- **Decisions** — resolved design choices with alternatives considered (what the current "assumptions" step actually does)
- **Requirements** — what the system must do and why, with rationale and priority
- **Acceptance criteria** — testable verification of requirements (what the current "requirements" step actually produces)

**What changes:**
- `server/schemas.js` — rename and restructure schemas to reflect correct terms
- `server/routes/assumptions.js`, `server/routes/requirements.js`, `server/routes/specWizard.js` — update prompts and endpoints
- `server/migrations/` — rename tables (`assumption` → `decision`, or introduce new tables)
- Frontend components and hooks in both `Home/` and `CreateSpec/` — rename throughout
- AI prompts — rewrite to elicit each concept correctly and in the right sequence

## Model decisions as a DAG, not a tree

The current codebase doesn't model decision structure at all (the "assumptions" are a flat list). The natural impulse when correcting this is to model decisions as a tree (`parent_decision` FK), since the design interview feels like a top-down progressive refinement. But design decisions have **cross-cutting dependencies**: a decision about authentication may depend on *both* a prior deployment decision *and* a prior compliance decision — two independent upstream forks.

**Prior art confirms this is a DAG:**
- **IBIS** (Kunz & Rittel, 1970) — models design discourse as Issues → Positions → Arguments in an explicit graph; issues relate to multiple other issues.
- **QOC** (MacLean et al., 1991) — Questions, Options, Criteria; criteria apply across multiple questions, options on one question constrain others.
- **DRL** (Lee & Lai, 1991) — extends IBIS with a hypergraph; decisions depend on multiple other decisions and goals simultaneously.
- **ADRs** (Architecture Decision Records) — each record references multiple prior decisions as context; the emergent structure is a DAG.

All of these landed on "graph, not tree" for the same reason: design decisions have multiple upstream dependencies.

**Pragmatic implementation with an LLM:** The interview is linear (one question at a time). The LLM doesn't need to build a graph explicitly — it cites relevant prior decisions when posing each new question ("Given that you chose X for deployment and Y for compliance, how should auth work?"). These backward references are captured via MCP tool calls and become the DAG edges. The graph structure is **emergent from the interview**, not prescribed.

**Data model:** Replace the `parent_decision: FK` pattern with a `decision_dependency` join table:

```
decision_dependency
  decision_id    FK → Decision  (the decision that depends)
  depends_on_id  FK → Decision  (the upstream decision)
```

Keep `sort_order` on Decision for presentation sequence (the order the interview proceeded in). The tree is a **view** (pick a primary dependency for rendering), not the model. Topological sort of the DAG produces valid orderings for the spec document.

**What changes:**
- `REMODEL.md` Decision entity — replace `parent_decision` with `decision_dependency` join table
- DB schema — `decision_dependency` table instead of self-referencing FK on `decision`
- MCP tool for resolving decisions — accept `references: decision_id[]` to create edges
- Spec generation prompts — render decisions in topologically sorted order
- UI — present as a tree (primary dependency) with cross-reference indicators


## Confidence and impact belong only on Assumptions

The current codebase places `confidence` on both "assumptions" (really decisions) and "requirements" (really acceptance criteria). Neither placement is meaningful:

- **On decisions:** a decision is a resolved choice. You're not uncertain about what you chose — you might be uncertain about whether the *inputs* to the choice were correct, but that uncertainty lives in the assumptions the decision depends on.
- **On acceptance criteria:** a criterion either verifies a requirement or it doesn't. "60% confident" really means "not yet finished" — that's a workflow state (`draft` → `proposed` → `validated`), not a confidence score.

**Confidence belongs on Assumptions only.** An assumption is a belief you're proceeding on without verification. `confidence` answers: how much epistemic risk are we carrying? Paired with `impact_if_wrong`, it produces an actionable risk matrix:

| | Low impact | High impact |
|---|---|---|
| **High confidence** | Ignore | Monitor |
| **Low confidence** | Accept | **Validate first (spike)** |

This gives a downstream consumer (human or agent) a concrete signal: query low-confidence, high-impact assumptions to prioritize what to verify before starting work.

The blast radius of a falsified assumption is already computable from the data model: follow `decision_assumption` links to affected decisions, and from there to referencing criteria and risks. This is more precise than any stored numeric impact score.

**Spec-level readiness** is not a stored confidence score — it's a function of workflow state (have all phases completed?) and assumption risk (are there unresolved low-confidence assumptions?). Both are computable from the underlying entities.

**What changes:**
- Remove `confidence` from the current `entry` table (acceptance criteria)
- Remove `confidence` / `impact` from the current `assumption` table where it's on what are really decisions
- Ensure `Assumption` (the correctly-scoped entity) carries `confidence` and `impact_if_wrong`
- Remove `confidence` from any spec output schema — compute readiness from workflow + assumption state

## Consolidate to one frontend

`Home/` (432-line orchestrator + 13 hooks + 15 components) and `CreateSpec/` (349-line orchestrator + 6 hooks + 14 components) are parallel implementations of the same product. They share `apiFetch.ts` and a `LoadingIndicator` but have separate type definitions, separate streaming handlers, separate state management patterns (event bus vs. direct callbacks), and separate API call sites. This is the single largest structural problem — every other refactor has to be done twice until this is resolved.

The CreateSpec wizard is architecturally cleaner (no event bus, scoped hooks, queue-based AI orchestration). Keep it as the primary UI; repurpose v1 as an admin/debug view if needed, or retire it.

**What changes:**
- Lift shared domain types (`Assumption`, `Requirement`, `Question`, etc.) out of both `pages/*/types.ts` into a shared `client/src/types.ts`
- Lift shared API utilities and streaming logic into `client/src/api/`
- Remove `Home/projectBus.ts` (fragile mutation-by-reassignment pattern that races with async operations)
- Decide which v1-only features survive (canvas view, Dolt sidebar, LLM log viewer, model selector) and migrate or drop them

## Extract shared tool/CRUD layer on the server

The same assumption/requirement CRUD SQL (UPDATE with dynamic `sets.push()`, INSERT, DELETE) appears in both `claude.js` (as Zod-validated SDK tools) and `opencode-mcp-server.js` (as JSON Schema MCP tools). Changing a column name requires editing both files. This should be a shared repository/data-access layer that both tool surfaces call.

**What changes:**
- Create `server/model/` or `server/repositories/` with functions like `updateAssumption(pool, projectId, uuid, fields)`, `createRequirement(pool, projectId, data)`, etc.
- `claude.js` tool handlers call the repository instead of inlining SQL
- `opencode-mcp-server.js` tool handlers call the same repository
- `sessions.js` — unify `upsertRequirements` and `insertRequirementTree` (two tree-walking functions that do the same thing differently)

## Unify streaming functions in `claude.js`

`streamQueryText`, `streamQueryTextWithTools`, `streamQueryWithTools`, and `queryStructured` share ~80% structure: set headers, initialize state (`allMessages`/`fullText`/`error`/timing), define `sendEvent`, iterate `query()`, dispatch events by nested if-else, log in `finally`. The variation is which event types to handle and whether to create an MCP server. This is one parameterized function, not four.

Similarly, `opencode.js` duplicates the `LOG_SQL` string and the entire `finally { pool.execute(LOG_SQL, [...]) }` logging pattern. Logging should be extracted once.

**What changes:**
- `server/services/claude.js` — collapse four functions into one with a config/options object
- Extract DB logging into a shared `logAiCall(pool, params)` helper used by both `claude.js` and `opencode.js`
- Extract `sendEvent` / header setup into a shared streaming utility

## Eliminate OpenCode sidecar dependency

481 lines of `opencode.js` + 287 lines of `opencode-mcp-server.js` exist to proxy requests through a separate running process. The OpenCode path also requires a standalone MCP server that duplicates all tool definitions because OpenCode can't use in-process SDK tools. Replace with Vercel AI SDK (`ai` package) for direct multi-provider support without a sidecar.

**What changes:**
- Replace `@opencode-ai/sdk` with `ai` (Vercel AI SDK)
- Remove `server/services/opencode.js` and `server/services/opencode-mcp-server.js`
- Remove `opencode.json`
- Simplify `server/services/dispatch.js` — route to provider-specific AI SDK adapters instead of Claude-vs-OpenCode
- Remove `OPENCODE_URL` env var and related Docker config

## Unify schema language (pick JSON Schema or Zod, not both)

AI output schemas are defined in JSON Schema (`schemas.js`), but Claude SDK tools need Zod. So `claude.js` has a hand-rolled `buildZodSchema`/`jsonSchemaPropToZod` converter (lines 554-579) that handles a "basic subset." Meanwhile `opencode-mcp-server.js` uses JSON Schema natively. Two schema languages for the same domain creates an impedance mismatch and a maintenance surface.

**What changes:**
- Pick Zod as the single source of truth (it can generate JSON Schema via `zod-to-json-schema` when needed)
- Rewrite `server/schemas.js` in Zod
- Remove `buildZodSchema`/`jsonSchemaPropToZod` from `claude.js`
- Derive JSON Schema from Zod where MCP or structured output requires it

## Consolidate prompt templates

`clarifying.js`, `assumptions.js`, `requirements.js`, `spec.js`, and `specWizard.js` all inline multi-line prompt template strings with ad-hoc context assembly. Prompts are a first-class domain concern — they should live together, be testable, and be versioned as a unit. `specWizard.js` also duplicates Q&A formatting four times internally.

**What changes:**
- Create `server/prompts/` or `server/prompts.js` — one place for all prompt templates
- Extract `buildQAContext(answers)` from the four inline copies in `specWizard.js`
- Make prompt functions pure: `(goal, answers, assumptions) → string` — testable without mocking
- Routes become thin: validate → build prompt → call service → respond

## Remove dead dependencies

`@tanstack/react-table` and `@dnd-kit/*` are production dependencies used only in v1 (Home) for the table view and canvas drag-and-drop. If consolidating to v2, these become dead weight. `config.yaml` is an unused Dolt template that can also be removed.

## Convert server to TypeScript

The entire server is plain `.js` — no type checking, no IDE inference on function signatures, no compile-time guarantees on the shapes flowing between routes, services, and the database. The frontend is already `.tsx`, so the tooling exists. The lack of types is especially costly here because:

- AI response schemas (`schemas.js`) define shapes in JSON Schema with no corresponding TS types — callers just trust the parse
- Service functions have 5-9 positional args with no interface; the dispatch layer uses `...rest` which erases even the informal contract
- Tool CRUD handlers build dynamic SQL with `sets.push()` — a typo in a column name is a runtime error
- The `pool.execute()` return type is always `any`

Converting to TypeScript makes every other refactor safer — rename operations, schema changes, and API contract shifts all get caught at compile time instead of in production.

**What changes:**
- Rename all `server/*.js` → `server/*.ts`
- Add typed interfaces for DB row shapes, API request/response bodies, and service function signatures
- Type the `pool` wrapper (or use a typed query builder like Kysely/Drizzle)
- Align server types with client types (shared `types/` package or shared definitions)

## Adopt Vite Plus toolchain (vite, vitest, oxc, tsgo)

The current dev toolchain is loose: Vite + Vitest for the frontend, `node --watch` for the server, ESLint for linting, no formatter configured, and `tsc` for type checking. Replace with Vite Plus (`vp`) to unify the inner loop around a single fast toolchain:

- **vite** — already in use for frontend bundling
- **vitest** — already in use for tests, but coverage and watch mode aren't configured
- **oxc** (oxlint + oxfmt) — replaces ESLint + Prettier with a single Rust-native tool that's ~100x faster; enforces consistent formatting and catches lint issues without config sprawl
- **tsgo** — Microsoft's native-speed TypeScript checker; replaces `tsc` for type verification in the inner loop

This tightens the feedback loop: `vp check` runs lint + format + typecheck in one command, `vp test` runs vitest, and CI uses the same tools. Currently there's no format enforcement, no pre-commit checks, and the test suite only runs on explicit `npm test`.

**What changes:**
- Install `vite-plus` (or configure the individual tools: `oxlint`, `oxfmt`, `tsgo`)
- Replace ESLint config with oxlint rules
- Add format-on-save / pre-commit formatting via oxfmt
- Configure vitest for coverage reporting and watch mode
- Add a unified `vp check` / `vp test` / `vp build` script surface
- Update CI (if any) to use the new toolchain
- Remove ESLint, Prettier (if present), and redundant config files

---

## Priority order

1. **Adopt Vite Plus toolchain** — establishes the verification baseline everything else is tested against
2. **Convert server to TypeScript** — makes every subsequent refactor safe; prerequisite for confident renames
3. **Consolidate frontends** — halves the surface area for every subsequent refactor
4. **Extract shared tool/CRUD layer** — prerequisite for schema and prompt changes
5. **Fix domain terminology** — rename once, with the new CRUD layer and type safety in place
6. **Unify schema language** — depends on terminology being settled
7. **Consolidate prompt templates** — depends on terminology and schemas
8. **Unify streaming functions** — independent, can be done in parallel with 5-7
9. **Replace Dolt with SQLite** — independent, can be done in parallel
10. **Eliminate OpenCode sidecar** — independent, lower urgency
11. **Remove dead dependencies** — cleanup pass after consolidation

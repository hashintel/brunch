<!-- CROSS_CUT_PLAN.md — TEMPORARY working plan, NOT canonical.
     Authority: none. SPEC.md and PLAN.md remain the only canonical planning state.
     This doc captures a temporary horizontal capability ledger across the vertical
     PLAN frontiers for the current elicitor push. It does not mint frontier ids;
     when a row grows frontier-scale, promote it back into PLAN and keep only the
     row-level coverage inventory here. Retire or fold into PLAN/SPEC once the
     remaining temporary rows close.
     Owner: lunelson. Drafted with Amp. -->

# Cross-Cut Plan — Elicitor Capability Surface

## Why this doc exists

The PLAN sequences **vertical** frontiers — each a tracer bullet that proves one
architectural claim end-to-end. That structure can leave **horizontal capability
layers too shallow**: every frontier dips into "the agent's tools and knowledge"
only as far as its claim requires, so no single frontier ever *fills the layer*.

This doc cuts the other way. It treats the active agent's (elicitor's) **capability
surface** as three horizontal seams and drives each to completeness, independent of
which vertical frontier first touched it.

```diagram
                 PLAN frontiers (vertical: prove one claim end-to-end)
                review-cycle │ authority-shell │ live-ship │ probes │ seed-fixtures
               ─────────────┼─────────────────┼───────────┼────────┼──────────────
  READ  context │     ╎             ╎              ╎          ╎          ╎
  WRITE mutate  │     ╎   each frontier touches each seam only shallowly ╎
  KNOW  prompts │     ╎             ╎              ╎          ╎          ╎
```

The plan is **broadly locked**; the open items are design questions, not the cut
itself.

## Current authority split

- `memory/PLAN.md` owns frontier ids, sequencing, dependency judgment, and which work is active next.
- This file owns only the temporary elicitor READ / WRITE / KNOW row inventory and its aggregate coverage DoD.
- When one row escapes row-sized work, it gets promoted back into PLAN. As of 2026-06-08, the D65-L row is now the active PLAN frontier `elicitation-backlog` (landed), and the prompt-resource body-depth pass landed in 1ca02e38. All ● rows are now `have`/`built`; the only remaining cross-cut residue is the live per-turn "what to ask next" driver, which is an unscoped PLAN follow-on, not row-sized work.

## The seams (locked)

The elicitor's capability surface = **READ × WRITE × KNOW**, where KNOW splits into
an *orienting* sub-layer and a *procedural* sub-layer (this matches the existing
`src/.pi/skills/` split):

| Seam | What it is | Code home |
| --- | --- | --- |
| **1 — READ** | tools/context for *getting* state (workspace, graph, session) | `.pi/extensions/{graph,context}/`, `.pi/agents/contexts/`, D60-L |
| **2 — WRITE** | tools for *mutating* world (workspace, graph, session/runtime state) | `.pi/extensions/{graph,runtime,workspace}/`, `graph/CommandExecutor` |
| **3a — KNOW / orient** | goals, strategies, lenses — *what to pursue, how to shape, what to focus on* | `.pi/skills/{goals,strategies,lenses}/`, D59-L/D25-L |
| **3b — KNOW / mechanics** | methods — *how to run exchanges, capture, commit, propose* | `.pi/skills/methods/`, D58-L |

## Seam coverage ledger (the governing DoD)

This inventory is **not** an orienting note — it is the **layer-level definition-of-done**
for the cross-cut. The ln-* tracer protocol is risk-first ("does this slice prove a
claim?") and has no completeness test; that is exactly why vertical slicing leaves these
layers shallow. This ledger supplies the missing **coverage-first DoD**: a seam is done
when no POC-required (●) row is left in a `spec` / `new` / `partial` state.

The ledger is also the **anti-sprawl boundary**: "fill the layer" means *close these
specifically-enumerated rows*, never "do everything that rhymes" (cf. global AGENTS.md
§completionist sprawl). Coverage-mode is only safe because the surface is a closed list.
Most product layers should stay tracer-shallow (correct YAGNI); this layer earns a
completeness pass because the elicitor's value *is* its capability surface.

Column shape follows the now-canonical `ln-scope` coverage-ledger
(`Capability | Status | Req | Fill | Owner/next | Notes`).

**Status:** `have` (in code) · `partial` (exists, incomplete vs target) · `spec`
(designed in SPEC, not built) · `new` (beyond SPEC, needs a decision) · `built` (closed
this push). **Req:** ● required for POC · ○ deferred/post-POC. **Fill:** the posture each
row's build inherits — `proving` (row still carries an unknown) · `earned` (settled design,
just unbuilt) · — (already `have`/`built`, no build).

### Seam 1 — READ / context

DoD: every ● row is `have` or `built`.

| Capability | Status | Req | Fill | Owner / next | Notes |
| --- | --- | --- | --- | --- | --- |
| `read_graph` overview \| neighborhood | have | ● | — | — | baseline |
| generic `read`/`grep`/`find`/`ls` | have | ● | — | — | read-only in `elicit` |
| graph slice — list by kind(s) | built | ● | — | done — `read_graph` `list_by_kind` (67e986b8) | D60-L |
| graph slice — list by readiness band(s) | built | ● | — | done — `read_graph` `list_by_band` (67e986b8) | D60-L, D64-L |
| graph slice — find related-to-anchor (edge cat/dir/hops) | built | ● | — | done — `read_graph` `related` (62971be7) | D60-L, D51-L |
| graph slice — IS_NOT / absence queries | built | ● | — | done — `read_graph` `gaps` mode (79f92bc5) | D60-L 4th shape; serves D65-L backlog |
| workspace context — tree + file counts (gitignore-aware) | built | ● | — | done — `read_workspace_context` `cwd_inventory` (54ae7f86) | D60-L `cwd`; stub replaced |
| workspace context — specs overview (title, #sessions, #nodes) | built | ● | — | done — `read_workspace_context` `workspace_overview` (3642b777) | D60-L; fork resolved → agent-context read |
| workspace context — sessions overview (turn count, grade) | built | ● | — | done — `workspace_overview` (3642b777) | D60-L |
| session context read — binding + runtime frame | built | ● | — | done — `read_session_context` tool + `renderRuntimeFrame` (b2a89e04) | projection reused; R1 matcher remediation folded in |
| auto-feed / pushed read surface + deterministic trigger | spec | ○ | proving | later | D60-L *pushed*; nice-to-have |

### Seam 2 — WRITE / mutate

DoD: every ● row is `have` or `built`.

| Capability | Status | Req | Fill | Owner / next | Notes |
| --- | --- | --- | --- | --- | --- |
| `commit_graph` atomic batch **create** | have | ● | — | — | implicit basis |
| `present_review_set`/`request_review` → `acceptReviewSet` | have | ● | — | — | explicit basis |
| auto-capture (synchronous, labeled-text) | built | ● | — | done — `session.submitMessage` capture (5f5e6ac8) | shared explicit-text core reused on ordinary-message path; D66-L |
| generalized graph mutation (create/patch/delete) engine | spec | ○ | proving | card `dev-seed-fixtures--semantic-graph-mutations` | follow-on #4 owns agent patch/delete (Q5) |
| agent-facing `commit_graph` patch/delete | new | ○ | proving | Q5 | default lean: agent stays creation-only |
| spec title/description update tool | new | ○ | earned | later | none exists |
| workspace display-name update | new | ○ | proving | Q-state | unclear elicitor vs product/RPC |
| ~~agent self-switch of posture~~ | — | — | — | RESOLVED Q4 | **dissolved — agent switches nothing**; switches are user/system (D40-L) |
| user/system posture-switch surface (UI affordance reducer) | new | ○ | proving | Q-state (deferred) | derived affordance projection over runtime-policy tables |

### Seam 3a — KNOW / orient

DoD: every ● row is `have` or `built`.

| Capability | Status | Req | Fill | Owner / next | Notes |
| --- | --- | --- | --- | --- | --- |
| goals / strategies / lenses scaffolding + legal-tuple gating | have | ● | — | — | `.pi/agents/state.ts` |
| goal/strategy/lens **content depth** | built | ● | — | done — deepened bodies + manifest-wide depth test (1ca02e38) | each body now carries its facet guidance; ≥700-char floor guarded in `compose.test.ts` |
| `freestyle` strategy | built | ● | — | done — pin-only strategy (8de7f166) | AUTO-excluded, no added authority; D66-L |
| "what to ask next" driver | partial | ● | proving | unscoped follow-on | flat-table substrate landed via FE-823; live per-turn driver + capture-reflection remain follow-on work |

### Seam 3b — KNOW / mechanics (methods)

DoD: every ● row is `have` or `built`.

| Capability | Status | Req | Fill | Owner / next | Notes |
| --- | --- | --- | --- | --- | --- |
| 6 method resources scaffolding | have | ● | — | — | run-structured-exchange, infer-and-capture, commit-graph, read-context, generate-proposal, review-for-gaps |
| method **content depth** | built | ● | — | done — deepened bodies + manifest-wide depth test (1ca02e38) | each method gives tool-routing/sequencing guidance, not tool-description restatement |
| generalized capture (free text, files, refs; iterative passes) | built | ● | — | done — labeled-text core on `session.submitMessage` (5f5e6ac8) | POC bar = directly-labeled facts; richer free-text/files/refs remain A22-L fitness evidence; D66-L |
| exchange-tool `.description()` / `promptGuidelines` | built | ● | — | done — all 7 exchange tools carry both (drift correction 2026-06-07) | `src/.pi/extensions/exchanges/*` already match the `commit_graph` pattern |
| skill-commands (`gap-review`, `arbitrary-enhance`) | new | ○ | proving | Q6 (deferred) | off critical path |

### Renderer feedback-loop note

Several ● rows above produce **LLM-facing rendered text** (graph slices, workspace/session
context, rendered workspace/session text, prompt composition output). Their quality is *eyeball-judged
before it can be a test* — another thing the tracer DoD has no slot for. These rows depend
on the **render preview→lock→formalize harness** (see §Renderer feedback loops below);
treat that harness as a prerequisite oracle, not optional polish.

## Open design questions (the grill/disambiguate queue)

Resolve these — ln-grill / ln-disambiguate style — before the items they gate are
built. Ordered by leverage.

- **Q4 — Agent self-switch of posture. RESOLVED — the agent switches nothing.**
  Reframed: switching (a durable `brunch.agent_runtime_state` pin) is a **user/system
  authority**; the agent's only in-axis freedom is **AUTO** (per-turn implicit selection
  from the manifest, D58-L). So there is **no agent-facing `switch_posture` tool** to
  build — Q4 mostly dissolves.
  - *Authority rule (durable):* the agent never emits a posture switch. AUTO is its
    freedom; the user/system own pins. This collapses the per-axis "agent may switch X
    but not Y" question into one line and removes any privilege-escalation surface.
  - *Legibility dependency:* the agent's per-turn AUTO choice stays legible downstream
    **via per-emission facet stamping** (D25-L: lens/strategy stamped on emitted
    exchange payloads; capture/reviewer filter on that) — **not** via runtime-state.
    Clean split: **runtime-state = the frame/constraints (user/system-set)**;
    **emitted facets = what the agent did this turn (AUTO choice)**.
  - *User-mutable posture axes (for now):* `op_mode` (user/system), `strategy`, `lens`.
    **`goal` is NOT user-mutable** — too contingent; kept **internal/grade-derived**
    (D59-L grade-derived objective) and out of the posture-change command surface for
    now.
  - *On-parent-switch reducer default → AUTO* for the children it governs (strategy/lens);
    goal is grade-derived regardless.
  - *`source: 'agent'` reserved:* the enum keeps it, but no current path emits it; parked
    for a future execute-mode orchestrator that might legitimately steer sub-postures.
    Do not wire an agent switch by default.
  - *SPEC touch (open):* the durable authority rule ("agent switches nothing") may merit
    a one-line refinement to D40-L, and "goal not user-mutable for now" to D59-L — but
    both are load-bearing locked decisions, so promote only on explicit confirmation.
    `freestyle` (D66-L: user-pin only, AUTO never selects) is already consistent.
- **Q-state — Workspace/session/runtime state model. DEFERRED — keep current
  projection model; enhance later.** Decided to stick with the existing D40-L
  transcript-projection posture (truth stays append-only `brunch.agent_runtime_state`,
  resolved by pure projection); **no xstate, no persisted machine** for now.
  - *Real underlying need = UI affordances, not a truth machine.* The motivation was a
    **reducer** for (a) default-assignment when a parent state changes (switch op_mode /
    grade advances → reassign now-illegal goal/strategy/lens to their defaults) and
    (b) gating which options are available even within a parent state.
  - *This logic already exists server-side* as lookup tables in
    `projections/session/runtime-policy.ts` (`OPERATIONAL_MODE_DEFINITIONS`,
    `AGENT_ROLE_DEFINITIONS`, `default*` fields) and `.pi/agents/state.ts`
    (`GRADE_RANK`, `GOAL_MIN_GRADE`, `STRATEGY_MIN_GRADE`). Gating = min-grade tables +
    `allowed*` lists; defaults-on-change = the `default*` fields.
  - *Future enhancement (when UI pressure is real):* add one Brunch-owned **derived
    affordance projection** — `affordances(resolvedState) → { availableOptions per axis,
    defaultOnSwitch }` — over those tables; TUI/web/RPC clients **render** it. It is a
    pure derivation, so D40-L (projection-as-truth) is untouched.
  - *Durable constraint to preserve through the deferral:* the affordance/legality
    semantics are **Brunch-owned and shared** (D52-L thin-transport) — never
    reimplemented per client. The day the web client hand-rolls "which strategies are
    available," the legality rules have forked.
  - *Boundary clarified:* `session.runtimeState` munges **steered posture**
    (op_mode/strategy/lens/goal — switchable, reducer-governed) with **observed session
    facts** (binding/specId, world-watermark LSN, mention slots, lifecycle — derived,
    never "switched"). A reducer governs only posture. Genuinely-new runtime state still
    homeless: **active review-set state** (D45-L names it but it has no home) and
    freestyle-vs-structured turn-mode (D66-L). Park these for the later pass.
- **Q2 — `freestyle` + generalized capture. RESOLVED → SPEC D66-L / R16 refinement.**
  `freestyle` is a *strategy* value (not an op_mode, not authority): **structure-optional**,
  user-driven turns, structured tools still available, slash/skill-commands ergonomic here.
  It grows graph truth only via **generalized capture** (post-exchange capture wired onto
  the ordinary-message path `session.submitMessage` over the existing `session exchange`
  unit) — so freestyle + generalized capture are **one slice**. R16 refined: offer-first
  scoped to structured strategies, not a universal per-turn invariant. **AUTO must never
  select freestyle** (user pin only). Remaining scope-level detail: capture quality beyond
  labeled facts, per-turn vs on-demand capture, exact slash/skill-command surface (→ Q6).
- **Q3 — `unknown` nodes (the MODELLING PROBLEM). RESOLVED → SPEC D65-L / A24-L.**
  De-conflated into two concepts: `elicitation_backlog` (prospective process-agenda /
  "prospective memory" — a **flat table**, not a graph node; async + unordered; the
  prospective sibling of the retrospective `reconciliation_need`) and a deferred `risk`
  intent-node-kind (durable domain-epistemic gap). The `elicitation_backlog` table is
  the missing substrate for the "what to ask next" objective and generalized capture.
  `basis` generalized to provenance-directness (D63-L). Name locked to `elicitation_backlog`
  (over `agenda`/`need`) to signal async/unordered. Remaining scope-level detail: seed
  mechanism, mutation path, goal-layer relationship.
- **Q1 — Negative/IS_NOT graph queries. RESOLVED → dedicated `gaps` mode.** Add a fourth
  `read_graph` mode `gaps`: a base class filter (`kinds` and/or `readinessBands`) plus a
  required `absentEdgeCategory` and optional `direction` (default `both`), returning
  class-members that have **no** edge of that category in that direction. Chosen over a
  `negate` flag on the list/related modes because a *named observed shape* matches D60-L's
  enumeration style and resists "any predicate can be negated" creep, while keeping the
  positive list modes pure. Projection-aware: under `active_context` a node whose only
  qualifying edge is superseded counts as a gap (the elicitation-relevant reading); under
  `graph_truth` it does not. Bounded — single `absentEdgeCategory`, not a query language.
  **SPEC touch (RATIFIED 2026-06-07):** D60-L + glossary Agent context entry now enumerate the
  fourth observed read shape (gap query). Scoped: `memory/cards/crosscut-read--graph-gaps.md`.
  Directly serves the D65-L `elicitation_backlog` "what to ask next" driver (theses w/o
  proof, requirements w/o realization, claims w/o support).
- **Q5 — Agent `commit_graph` patch/delete.** Owned by the seed-fixtures card
  follow-on #4. Default lean: agent stays creation-only; deletion not silently
  exposed to autonomous agents.
- **Q6 — Skill-commands. DEFERRED (off critical path for POC).** Idea recorded:
  user-invoked slash/skill-commands (e.g. `gap-review`, `arbitrary-enhance`) for
  on-demand operations. **Affordance**: authority-gated by `op_mode` like any tool;
  available regardless of strategy but **ergonomic in `freestyle`** (D66-L) because no
  pending structured exchange consumes the turn. Open (when revisited): methods-exposed-
  as-commands vs a separate primitive. Not blocking POC; no SPEC decision yet.

## Working order

Option (b): start with the **no-spec-risk build-out** and let knowledge follow.
Q2/Q3/Q4/Q-state/Q6 are now resolved or deferred (see Open design questions), so the
order is coverage-driven: close ● ledger rows seam by seam.

1. **Fixtures + render harness** — card `crosscut-render--preview-harness-and-fixtures`
   (Card A fixture game plan → Card B preview→lock→formalize harness). Prerequisite oracle
   + data substrate for every ● row that emits LLM-facing text; build before the
   renderer-bearing READ rows so their output is eyeball-lockable, not test-blind.
2. **Seam 1 READ build-out** (D60-L) — **COMPLETE** (all ● rows built). The agent can now
   *see* before it steers or acts:
   1. ~~graph slices~~ — **built** (read_graph `list_by_kind`/`list_by_band` in 67e986b8;
      `related` in 62971be7).
   2. ~~session context~~ — **built** (`read_session_context` + `renderRuntimeFrame` in
      b2a89e04; R1 native `toMatchFileSnapshot` remediation folded in).
   3. ~~graph gaps~~ — **built** (read_graph `gaps` mode in 79f92bc5; D60-L 4th shape).
   4. ~~workspace context~~ — **built** (`read_workspace_context`: `cwd_inventory` in
      54ae7f86, `workspace_overview` in 3642b777; design fork resolved → agent-context read).
   - Deferred READ row (not POC-critical): auto-feed / pushed surface (○).
3. **Seam 2 WRITE** ● rows — generalized capture (D66-L, one slice with `freestyle`).
   **COMPLETE** (all ● rows built): `session.submitMessage` reuses the shared explicit-text
   capture core (5f5e6ac8), and `freestyle` is a pin-only AUTO-excluded strategy (8de7f166).
   This also closed the Seam 3a `freestyle` and Seam 3b generalized-capture ● rows.
   No posture-switch tool to build (Q4 dissolved); user/system posture surface is
   deferred to the Q-state affordance reducer.
4. **Seam 3a/3b content pass** — **COMPLETE** (all ● rows built): `freestyle` strategy
   (8de7f166), generalized-capture core (5f5e6ac8), exchange-tool `.description()` /
   `promptGuidelines` (drift correction 2026-06-07), and goal/strategy/lens/method body depth
   (1ca02e38 — deepened bodies + a manifest-wide ≥700-char depth test in `compose.test.ts`).
   FE-823 landed the D65-L substrate tracer (flat table, `createSpec` seed, command/query seam).
   Skill-commands (Q6) stay deferred; the live per-turn "what to ask next" driver +
   capture-reflection remain an unscoped PLAN follow-on.
5. **Spec reconcile** — promote the D40-L/D59-L one-line refinements (on confirmation),
   land Q1 negative-query touch, fold D65-L/D66-L outcomes into SPEC/PLAN.

State-machine (Q-state) and generalized graph mutation (the card) proceed on their
own tracks and feed Seam 2. Each step closes specific ● rows; the seam is done when no
● row sits in `spec`/`new`/`partial` (the ledger DoD), not when a tracer claim is proven.

## Renderer feedback loops

Some ● rows emit **LLM-facing rendered text** whose correctness is *aesthetic before it
is assertable*: graph-slice renderings, workspace/session context blocks, rendered
context strings, prompt-composition output. You cannot write the assertion until you have seen
and approved the shape. The tracer DoD has no slot for "look at it first," so this is a
named prerequisite oracle, not optional polish.

**Grounding (what already exists, so we extend not invent):**
- Renderer home is real: `src/renderers/<domain>/` (`graph/`, `workspace/`, `session/`,
  `exchanges/`), each with co-located `*.test.ts` (D52-L; see `renderers/README`).
  New graph-slice renderers land in `src/renderers/graph/`.
- Seed infra is real: `npm run seed` → `src/graph/seed-fixtures.ts` (`seedFixture(executor,
  fixture)`); `src/scripts/` exists as the executables home (D52-L) and may import domain.
- **The lock stage is net-new.** Current render tests are *invariant-only* (`.toContain(...)`,
  e.g. `workspace-state.test.ts`) — there is **no `toMatchFileSnapshot` / golden pattern
  in the repo yet**. The eyeball-lock stage *is* the missing oracle, not an existing habit.

**Three-stage loop — sketch → lock → formalize:**

1. **Sketch (live render-to-file).** A dev script — `src/scripts/render-preview.ts` —
   loads a **seed fixture spec** (via `seedFixture` / `npm run seed` infra), runs a chosen
   `src/renderers/<domain>/*` renderer, and writes output to a reviewable, diffable file.
   Re-run on edit; eyeball the file. Fast inner-inner loop, **no failing tests during
   exploration**. (Add an `npm run render` script; `--watch` is a later nicety.) The script
   importing renderers respects the dependency direction (`scripts → renderers`, never back).
2. **Lock.** When the shape is right, the *same file* becomes a golden master via vitest
   `expect(rendered).toMatchFileSnapshot(...)` — writes on first run, diffs after. **Artifact
   home = co-located with the renderer test** (e.g. `src/renderers/<domain>/__previews__/
   <fixture>.txt`), **not** `.fixtures/` — `.fixtures/` is reserved for the probe-first /
   transcript-backed convention (golden fixtures parked there; see `.fixtures/README`).
   Co-location keeps golden + renderer + test adjacent, matching the existing test layout.
3. **Formalize.** Add targeted **invariant** asserts for what we actually mean (e.g.
   "renders projected code G1, never the raw id"; "active-context omits superseded nodes";
   "no dangling edge endpoints") — i.e. extend the existing `.toContain` style. The
   file-snapshot catches *unintended* drift; the invariant asserts catch *semantic*
   regression. Both live in one test file.

**Scoped** (standalone, per decision): `memory/cards/crosscut-render--preview-harness-and-fixtures.md`.
That card also owns the **fixture game plan** — the chicken-and-egg upstream of the harness:
renderers need projections, projections need legal+coherent graphs, and we are short on
fixtures everywhere. Build order is inverted from the layer stack — **fixtures → projections
→ renderers → harness** — so the card delivers the two shared enablers (fixtures as
hand-authored explicit-basis SeedFixture JSON seeded through the validated `seedFixture`
path — deterministic, no live agent; and the preview→lock→formalize harness) while the seam
cards own their own projection+renderer pairs. It carries a coverage matrix
(fixtures × projections × renderers) as the audit of what exists vs. what each ● row needs.

## Canonical pointers (do not duplicate here)

- Graph mutation engine: `memory/cards/dev-seed-fixtures--semantic-graph-mutations.md`
- Read family design: SPEC D60-L. Runtime state: D40-L. Prompt composition: D58-L.
  Goals/strategies/lenses: D59-L/D25-L. Graph model lock: D54-L/D56-L/D51-L.
  Offer-first contract: R16. Capture distinction: SPEC "Capture analysis" design note.

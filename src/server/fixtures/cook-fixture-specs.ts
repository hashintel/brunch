// Reversed cook-fixture specs → seeded intent graphs (fully closed, all four phases).
//
// Each of the three `brunch cook` demo fixtures (fixtures/<name>/plan.yaml) was reversed into a
// reviewable SPEC.md (fixtures/<name>/SPEC.md). This module ingests those specs into the Brunch
// intent-graph substrate so they appear as real, export-ready specifications in the app.
//
// These graphs are observer-faithful: they carry ONLY what a real elicitation observer would
// emit — grounding/design provenance, constraints, and verifying criteria. They deliberately
// carry NO requirement→requirement `depends_on`. The plan's slice DAG (fan-out / join / gate) is
// EXECUTION order, which is plan truth, not spec truth — the observer never captures it, and the
// build-architect must re-derive it from requirement content downstream (see the spec→cook-plan
// spike: execution deps can't be derived from the graph, they must be planned). So the round-trip
// here tests that re-derivation, not shape preservation. SPEC sections map by knowledge_item.kind:
//   Concept→goal · Lexicon→term · Context→context · Constraints→constraint · Decisions→decision
//   Assumptions→assumption · Capability Requirements→requirement · Acceptance Criteria→criterion
// and the spine is wired with `derived_from` (provenance), `constrains`, and `verifies` edges.
//
// The actual interview replay (grounding → design → requirements → criteria, with proposal/
// confirmation/review turns and phase_outcome closures) lives in the content-agnostic
// `seedClosedSpecFromKnowledge` helper; this module only supplies each fixture's knowledge graph.

import { createSpecification } from '../db.js';
import {
  seedClosedSpecFromKnowledge,
  type ClosedSpecItem,
  type ClosedSpecEdge,
} from './closed-spec-builder.js';
import type { ScenarioFn } from './scenarios.js';

type SpecItem = ClosedSpecItem;
type SpecEdge = ClosedSpecEdge;

// --- Fixture 1 · parallel-utils — pure fan-out (the wall-clock proof) ---

const parallelUtilsItems: readonly SpecItem[] = [
  {
    key: 'goal',
    kind: 'goal',
    content:
      'Ship a zero-dependency TypeScript utility library whose value is its shape: one shared scaffold prerequisite, then N genuinely independent leaves that fan out and execute concurrently under brunch cook.',
  },
  {
    key: 'term-barrel',
    kind: 'term',
    content:
      'Barrel — src/index.ts re-exporting every utility; the library’s single public entry and only composition point.',
  },
  {
    key: 'term-leaf',
    kind: 'term',
    content:
      'Leaf / utility slice — one independent utility: its module, its single unit test, and its one barrel re-export.',
  },
  {
    key: 'term-scaffold',
    kind: 'term',
    content:
      'Scaffold — the shared prerequisite slice (package.json, tsconfig, initially-empty barrel); the only thing every leaf depends on.',
  },
  {
    key: 'term-fanout',
    kind: 'term',
    content:
      'Fan-out — the property that all leaves depend solely on scaffold and never on each other, making them concurrently executable.',
  },
  {
    key: 'ctx-roundtrip',
    kind: 'context',
    content:
      'Greenfield brunch cook fixture: a plan.yaml of one scaffold slice plus 8 independent leaf slices, run with --policy=parallel to demonstrate pool-bounded concurrent firing.',
  },
  {
    key: 'con-zerodep',
    kind: 'constraint',
    content: 'Zero runtime dependencies, ESM only, bun test as the sole runner.',
  },
  {
    key: 'con-noimport',
    kind: 'constraint',
    content:
      'No utility module imports another; the only shared touch-point is the barrel re-exporting them. No util→util build dependency.',
  },
  {
    key: 'con-fixed',
    kind: 'constraint',
    content:
      'Fixed surface of exactly 8 utilities; not a general lodash replacement; no bundling/publish pipeline.',
  },
  {
    key: 'd1',
    kind: 'decision',
    content: 'One module per utility, file-disjoint, single named export; the barrel re-exports each.',
    rationale: 'Independence enables unbounded fan-out and side-steps the last-wins epic merge.',
    impact: 'high',
  },
  {
    key: 'd2',
    kind: 'decision',
    content: 'Scaffold is the only shared prerequisite; every utility depends on scaffold and nothing else.',
    rationale: 'Preserves pure fan-out; any util→util edge would serialise the demo.',
    impact: 'high',
  },
  {
    key: 'd4',
    kind: 'decision',
    content: 'Each utility owns exactly one unit-test oracle; the epic owns one barrel integration oracle.',
    rationale: 'One red→green target per slice keeps the mechanical TDD lane honest.',
  },
  {
    key: 'a1',
    kind: 'assumption',
    content: 'SameValueZero is the intended equality for unique (NaN dedupes, +0/-0 collapse).',
  },
  {
    key: 'a2',
    kind: 'assumption',
    content: 'debounce needs only trailing-edge semantics (no leading-edge option).',
  },
  {
    key: 'a3',
    kind: 'assumption',
    content:
      'The last-wins epic merge is safe here because leaves are file-disjoint, so no two parallel slices write the same file.',
  },
  {
    key: 'r-scaffold',
    kind: 'requirement',
    content:
      'Provide package.json (type: module, bun test), tsconfig.json, and src/index.ts as a barrel re-exporting every utility; the barrel starts empty.',
  },
  {
    key: 'r-chunk',
    kind: 'requirement',
    content: 'chunk<T>(arr, size): split into size-N groups (last may be shorter); size <= 0 throws.',
  },
  {
    key: 'r-unique',
    kind: 'requirement',
    content: 'unique<T>(arr): elements in first-seen order, duplicates removed under SameValueZero equality.',
  },
  { key: 'r-groupby', kind: 'requirement', content: 'groupBy<T>(arr, key): Record<string, T[]>.' },
  {
    key: 'r-debounce',
    kind: 'requirement',
    content: 'debounce(fn, ms): delay invocation until ms after the last call (trailing edge).',
  },
  {
    key: 'r-retry',
    kind: 'requirement',
    content:
      'retry<T>(fn, times): retry a rejecting promise up to times before rejecting with the last error.',
  },
  { key: 'r-clamp', kind: 'requirement', content: 'clamp(n, min, max): throws if min > max.' },
  {
    key: 'r-slugify',
    kind: 'requirement',
    content:
      'slugify(s): lowercase, non-alphanumerics to single dash, collapse repeats, trim leading/trailing dashes.',
  },
  {
    key: 'r-deepequal',
    kind: 'requirement',
    content: 'deepEqual(a, b): structural equality for plain objects, arrays, and primitives.',
  },
  {
    key: 'r-compose',
    kind: 'requirement',
    content:
      'Importing the barrel exposes all 8 utilities; an integration test exercises the merged surface.',
  },
  {
    key: 'c-plan-shape',
    kind: 'criterion',
    content:
      'ln-plan re-derives one scaffold prerequisite plus 8 leaves each depending only on scaffold and none on another — a fan-out, not a serial chain.',
  },
  {
    key: 'c-parallel',
    kind: 'criterion',
    content:
      'A parallel cook run fires leaves concurrently (pool:code-agent drains to 0 and refills); wall-clock ≈ ceil(8/3) x slice vs 8 x slice serial.',
  },
  {
    key: 'c-green',
    kind: 'criterion',
    content: 'All 8 unit tests and the barrel integration test pass green in the merged tree.',
  },
  {
    key: 'c-disjoint',
    kind: 'criterion',
    content: 'No utility module imports another and dependencies is empty.',
  },
];

const parallelUtilsEdges: readonly SpecEdge[] = [
  // NB: no requirement→requirement `depends_on`. The observer captures epistemic deps, never
  // execution order between requirements — that fan-out DAG is plan truth the architect must
  // re-derive from requirement content, not spec truth the graph carries. Edges below are only
  // what a faithful observer would emit: grounding/design provenance, constraints, and criteria.
  // Grounding in goal/terms/context.
  { from: 'r-scaffold', to: 'goal', relation: 'derived_from' },
  { from: 'term-fanout', to: 'goal', relation: 'refines' },
  { from: 'term-barrel', to: 'goal', relation: 'refines' },
  { from: 'ctx-roundtrip', to: 'goal', relation: 'derived_from' },
  // Decisions derived from the vocabulary and context they were made in light of.
  { from: 'd1', to: 'term-leaf', relation: 'derived_from' },
  { from: 'd2', to: 'ctx-roundtrip', relation: 'derived_from' },
  // Constraints bound the goal and the composition requirement.
  { from: 'con-zerodep', to: 'goal', relation: 'constrains' },
  { from: 'con-noimport', to: 'r-compose', relation: 'constrains' },
  { from: 'con-fixed', to: 'goal', relation: 'constrains' },
  // Assumptions rest on decisions.
  { from: 'a3', to: 'd1', relation: 'depends_on' },
  { from: 'a1', to: 'd4', relation: 'depends_on' },
  { from: 'a2', to: 'd4', relation: 'depends_on' },
  // Criteria verify requirements.
  { from: 'c-green', to: 'r-compose', relation: 'verifies' },
  { from: 'c-parallel', to: 'r-scaffold', relation: 'verifies' },
  { from: 'c-disjoint', to: 'r-compose', relation: 'verifies' },
  { from: 'c-plan-shape', to: 'r-scaffold', relation: 'verifies' },
];

// --- Fixture 2 · layered-todo — fan-out -> join + cross-epic gate ---

const layeredTodoItems: readonly SpecItem[] = [
  {
    key: 'goal',
    kind: 'goal',
    content:
      'Build an in-memory Todo service with a CLI whose value is its dependency shape: a real fan-out→join (types → {store, validation} → service) plus a cross-epic gate (cli waits on all of core) — the shape a flat plan cannot represent.',
  },
  {
    key: 'term-join',
    kind: 'term',
    content:
      'Join — a slice depending on more than one upstream (service ← store + validation); unreachable until all upstream tokens land.',
  },
  {
    key: 'term-gate',
    kind: 'term',
    content:
      'Cross-epic gate — an epic-level dependency (cli ← core) that holds every downstream slice until the upstream epic fully clears.',
  },
  {
    key: 'term-fanout',
    kind: 'term',
    content:
      'Fan-out — sibling slices sharing one upstream with no edge between them (store and validation from types), so they run concurrently.',
  },
  {
    key: 'term-command',
    kind: 'term',
    content:
      'Command surface — the thin cli epic: add/list/done functions over TodoService, not a standalone binary.',
  },
  {
    key: 'ctx-roundtrip',
    kind: 'context',
    content:
      'Greenfield brunch cook fixture: a core epic (types, store, validation, service) and a cli epic gated on core, run with --policy=parallel to show the join and gate live in Petrinaut.',
  },
  {
    key: 'con-inmem',
    kind: 'constraint',
    content: 'In-memory only — no persistence, no I/O. Zero deps, ESM, bun test substrate.',
  },
  {
    key: 'con-edges',
    kind: 'constraint',
    content:
      'Dependency edges encode genuine build-order only: no spurious edges (they serialise) and no missing edges (the join/gate is the point).',
  },
  {
    key: 'con-disjoint',
    kind: 'constraint',
    content:
      'File-disjoint slices; service.ts may import store and validation but each is its own file so the merge stays clean.',
  },
  {
    key: 'd1',
    kind: 'decision',
    content:
      'Edges encode genuine build-order only, producing the diamond: types root; store and validation on types; service on both; commands on service.',
    rationale: 'This shape is what justifies a Petri net over a flat plan.',
    impact: 'high',
  },
  {
    key: 'd2',
    kind: 'decision',
    content:
      'service is the JOIN node — it depends on both store and validation and cannot begin until both modules exist.',
  },
  {
    key: 'd3',
    kind: 'decision',
    content:
      'The cli epic depends on the whole core epic — a cross-epic gate distinct from intra-epic slice dependencies.',
  },
  {
    key: 'd4',
    kind: 'decision',
    content:
      'File-disjoint slices, one module + one unit-test oracle per slice; epic owns one e2e integration oracle.',
  },
  {
    key: 'a1',
    kind: 'assumption',
    content:
      'A simple string id() generator (monotonic or random) suffices for the in-memory store; no collision-resistance required.',
  },
  {
    key: 'a2',
    kind: 'assumption',
    content:
      'validateTitle bounds (non-empty, <= 200 chars) are the intended contract with no trimming/normalisation expected.',
  },
  {
    key: 'r-types',
    kind: 'requirement',
    content: 'src/types.ts: Todo (id, title, done) and an id() generator. The root of the domain.',
  },
  {
    key: 'r-store',
    kind: 'requirement',
    content: 'src/store.ts: in-memory TodoStore with add/get/list/update/remove over Todo.',
  },
  {
    key: 'r-validation',
    kind: 'requirement',
    content:
      'src/validation.ts: validateTitle (non-empty, <= 200) and validateTodo, throwing on invalid input.',
  },
  {
    key: 'r-service',
    kind: 'requirement',
    content:
      'src/service.ts: TodoService composing store + validation — addTodo validates then stores; listTodos/completeTodo delegate. The join.',
  },
  {
    key: 'r-cmd-add',
    kind: 'requirement',
    content: 'src/commands/add.ts: add(service, title) creating a todo via the service and returning its id.',
  },
  {
    key: 'r-cmd-list',
    kind: 'requirement',
    content: 'src/commands/list.ts: list(service) returning formatted lines per todo ([ ]/[x] + title).',
  },
  {
    key: 'r-cmd-done',
    kind: 'requirement',
    content: 'src/commands/done.ts: done(service, id) marking a todo complete; throws if the id is unknown.',
  },
  {
    key: 'r-e2e',
    kind: 'requirement',
    content:
      'End-to-end add → list → done flows through the assembled service + commands, proving the cli epic composes over core.',
  },
  {
    key: 'c-plan-shape',
    kind: 'criterion',
    content:
      'ln-plan re-derives the diamond + cross-epic gate: types root; store/validation parallel on types; service on both; cli gated on core; commands parallel.',
  },
  {
    key: 'c-join-gate',
    kind: 'criterion',
    content:
      'A parallel cook run shows store + validation concurrent, service unreachable until both tokens land, and cli commands held until core clears.',
  },
  {
    key: 'c-green',
    kind: 'criterion',
    content: 'All per-slice unit tests and the todo-e2e integration test pass green in the merged tree.',
  },
  {
    key: 'c-disjoint',
    kind: 'criterion',
    content: 'Slices are file-disjoint; service.ts is the only module importing both store and validation.',
  },
];

const layeredTodoEdges: readonly SpecEdge[] = [
  // NB: no requirement→requirement `depends_on`. The diamond (types → {store, validation} →
  // service) and the cross-epic gate are execution order — plan truth the architect re-derives
  // from requirement content, not spec truth the observer captures. Edges below are only what a
  // faithful observer would emit.
  // Grounding.
  { from: 'r-types', to: 'goal', relation: 'derived_from' },
  { from: 'term-join', to: 'goal', relation: 'refines' },
  { from: 'term-gate', to: 'goal', relation: 'refines' },
  { from: 'ctx-roundtrip', to: 'goal', relation: 'derived_from' },
  { from: 'd2', to: 'term-join', relation: 'derived_from' },
  { from: 'd3', to: 'term-gate', relation: 'derived_from' },
  { from: 'd1', to: 'ctx-roundtrip', relation: 'derived_from' },
  // Constraints.
  { from: 'con-inmem', to: 'goal', relation: 'constrains' },
  { from: 'con-edges', to: 'r-service', relation: 'constrains' },
  { from: 'con-disjoint', to: 'goal', relation: 'constrains' },
  // Assumptions rest on decisions.
  { from: 'a1', to: 'd1', relation: 'depends_on' },
  { from: 'a2', to: 'd4', relation: 'depends_on' },
  // Criteria verify requirements.
  { from: 'c-join-gate', to: 'r-service', relation: 'verifies' },
  { from: 'c-green', to: 'r-e2e', relation: 'verifies' },
  { from: 'c-disjoint', to: 'r-service', relation: 'verifies' },
  { from: 'c-plan-shape', to: 'r-service', relation: 'verifies' },
];

// --- Fixture 3 · resilient-pipeline — halt isolation + unreachable join ---

const resilientPipelineItems: readonly SpecItem[] = [
  {
    key: 'goal',
    kind: 'goal',
    content:
      'Build a CSV parse → transform → serialize pipeline whose value is failure isolation under a Petri net: one branch is seeded with a contradiction and halts, the independent branch completes, and the join becomes provably unreachable — waiting, not failed.',
  },
  {
    key: 'term-halt',
    kind: 'term',
    content:
      'Halt token / :halted — the marking a slice deposits when it exhausts its rework/retry budget without going green; the slice stops, the net keeps running elsewhere.',
  },
  {
    key: 'term-seeded',
    kind: 'term',
    content:
      'Seeded contradiction — an intentionally unsatisfiable slice spec (transform-b’s two mutually-exclusive criteria) used to cause a halt on purpose. A fixture device, not a bug.',
  },
  {
    key: 'term-unreachable',
    kind: 'term',
    content:
      'Unreachable join — a join slice (serialize) that can never be enabled because one required upstream token never arrives; waiting, not failed.',
  },
  {
    key: 'term-isolation',
    kind: 'term',
    content:
      'Failure isolation — a halt blocks only its downstream cone while independent subtrees complete normally.',
  },
  {
    key: 'ctx-roundtrip',
    kind: 'context',
    content:
      'Greenfield brunch cook fixture run with a low retry budget (--max-retries=2) so transform-b reaches :halted fast and the blocked frontier is drawn live in Petrinaut.',
  },
  {
    key: 'con-dontfix',
    kind: 'constraint',
    content:
      'transform-b is intentionally unsatisfiable and must NOT be fixed; its contradiction is the demonstration of halt isolation.',
  },
  {
    key: 'con-isolation',
    kind: 'constraint',
    content:
      'Failure must stay isolated: the seeded halt may not break parse or transform-a; only the cone depending on transform-b (serialize) may be blocked.',
  },
  {
    key: 'con-substrate',
    kind: 'constraint',
    content:
      'In-memory, zero deps, ESM, bun test; file-disjoint slices; low retry budget for a fast deterministic halt.',
  },
  {
    key: 'd1',
    kind: 'decision',
    content:
      'transform-b’s verification encodes a genuine contradiction so its TDD loop exhausts the rework budget and deposits a halt token.',
    rationale: 'A deliberate fixture device, not a defect; the contradiction is load-bearing.',
    impact: 'high',
  },
  {
    key: 'd2',
    kind: 'decision',
    content:
      'Failure is isolated to the halted slice’s downstream cone; parse and transform-a, independent of transform-b, complete normally.',
  },
  {
    key: 'd3',
    kind: 'decision',
    content:
      'serialize is the join depending on both transforms; it is provably unreachable, not failed — reachability is not failure.',
  },
  {
    key: 'd4',
    kind: 'decision',
    content:
      'File-disjoint slices, one module + one unit-test oracle per slice; halt speed tuned via --max-retries / maxSemanticReworks.',
  },
  {
    key: 'a1',
    kind: 'assumption',
    content:
      'A low retry budget reliably drives transform-b to :halted quickly without flakiness while letting satisfiable slices finish.',
  },
  {
    key: 'a2',
    kind: 'assumption',
    content:
      'The orchestrator treats a halted upstream as token-never-arrives (serialize stays waiting/unreachable), not as a propagated failure.',
  },
  {
    key: 'r-parse',
    kind: 'requirement',
    content:
      'src/parse.ts: parse(input) parsing simple CSV (header + comma-separated rows) into row objects. The root. Satisfiable.',
  },
  {
    key: 'r-transform-a',
    kind: 'requirement',
    content:
      'src/transform-a.ts: selectColumns(rows, cols) returning each row narrowed to the given columns. Satisfiable.',
  },
  {
    key: 'r-transform-b',
    kind: 'requirement',
    content:
      'src/transform-b.ts: normalize(value) required to BOTH return the value unchanged AND upper-cased — mutually exclusive. Intentionally unsatisfiable: the seeded halt.',
  },
  {
    key: 'r-serialize',
    kind: 'requirement',
    content:
      'src/serialize.ts: serialize(rows) rendering rows back to CSV, combining transform-a and transform-b outputs. The join — provably unreachable here.',
  },
  {
    key: 'c-plan-shape',
    kind: 'criterion',
    content:
      'ln-plan re-derives parse root; transform-a and transform-b parallel on parse; serialize on both — preserving transform-b’s seeded contradiction rather than repairing it.',
  },
  {
    key: 'c-halt',
    kind: 'criterion',
    content:
      'A bounded-retry parallel cook run shows parse + transform-a at done, transform-b at :halted after exhausting its budget, and serialize waiting forever — the blocked frontier.',
  },
  {
    key: 'c-green',
    kind: 'criterion',
    content:
      'parse and transform-a unit tests pass green; serialize would pass if reached but is never enabled; transform-b is unsatisfiable by construction.',
  },
  {
    key: 'c-isolated',
    kind: 'criterion',
    content: 'The halt stays isolated: the independent subtree completes; only serialize is blocked.',
  },
];

const resilientPipelineEdges: readonly SpecEdge[] = [
  // NB: no requirement→requirement `depends_on`. The branch-and-join (parse → {transform-a,
  // transform-b} → serialize) is execution order the architect re-derives from content, not
  // spec truth the observer captures. The halt/unreachability is a runtime property of cooking
  // that plan, not a spec edge. Edges below are only what a faithful observer would emit.
  // Grounding.
  { from: 'r-parse', to: 'goal', relation: 'derived_from' },
  { from: 'term-halt', to: 'goal', relation: 'refines' },
  { from: 'term-unreachable', to: 'goal', relation: 'refines' },
  { from: 'ctx-roundtrip', to: 'goal', relation: 'derived_from' },
  { from: 'd1', to: 'term-seeded', relation: 'derived_from' },
  { from: 'd3', to: 'term-unreachable', relation: 'derived_from' },
  { from: 'd2', to: 'term-isolation', relation: 'derived_from' },
  // Constraints — the load-bearing "do not fix" constraint pins transform-b.
  { from: 'con-dontfix', to: 'r-transform-b', relation: 'constrains' },
  { from: 'con-isolation', to: 'goal', relation: 'constrains' },
  { from: 'con-substrate', to: 'goal', relation: 'constrains' },
  // Assumptions rest on decisions.
  { from: 'a1', to: 'd1', relation: 'depends_on' },
  { from: 'a2', to: 'd3', relation: 'depends_on' },
  // Criteria verify requirements.
  { from: 'c-halt', to: 'r-transform-b', relation: 'verifies' },
  { from: 'c-isolated', to: 'r-parse', relation: 'verifies' },
  { from: 'c-green', to: 'r-serialize', relation: 'verifies' },
  { from: 'c-plan-shape', to: 'r-serialize', relation: 'verifies' },
];

export const cookFixtureSpecScenarios: Record<string, ScenarioFn> = {
  'parallel-utils-spec': (db, name = 'parallel-utils (reversed cook fixture)') => {
    const project = createSpecification(db, name);
    seedClosedSpecFromKnowledge(db, project.id, {
      grounding: {
        question:
          'Sketch parallel-utils in one breath: what is it, what shape gives it value, and how is it built?',
        answer:
          'A zero-dependency TS utility library of 8 independent leaves fanning out from one scaffold prerequisite, built so a parallel cook run fires them concurrently.',
      },
      designAnswer:
        'Keep every utility file-disjoint with a single export so the leaves stay independent and fan out from one scaffold.',
      items: parallelUtilsItems,
      edges: parallelUtilsEdges,
    });
    return project.id;
  },
  'layered-todo-spec': (db, name = 'layered-todo (reversed cook fixture)') => {
    const project = createSpecification(db, name);
    seedClosedSpecFromKnowledge(db, project.id, {
      grounding: {
        question: 'Sketch layered-todo in one breath: what is it, and what dependency shape gives it value?',
        answer:
          'An in-memory Todo service + CLI whose value is its diamond join (service needs store and validation) plus a cross-epic gate (cli waits on core).',
      },
      designAnswer:
        'Encode genuine build-order only — the diamond join on service plus a cross-epic gate holding cli behind core.',
      items: layeredTodoItems,
      edges: layeredTodoEdges,
    });
    return project.id;
  },
  'resilient-pipeline-spec': (db, name = 'resilient-pipeline (reversed cook fixture)') => {
    const project = createSpecification(db, name);
    seedClosedSpecFromKnowledge(db, project.id, {
      grounding: {
        question:
          'Sketch resilient-pipeline in one breath: what is it, and what does the seeded halt demonstrate?',
        answer:
          'A CSV parse→transform→serialize pipeline where transform-b is intentionally contradictory and halts, isolating failure while the serialize join stays provably unreachable.',
      },
      designAnswer:
        'Isolate failure to the halted slice’s downstream cone; keep the serialize join waiting (unreachable), not failed.',
      items: resilientPipelineItems,
      edges: resilientPipelineEdges,
    });
    return project.id;
  },
  // Blank greenfield kickoff — no turns, no knowledge. Open it and paste the opening goal to
  // drive the parallel-utils interview live from the kickoff frontier (contrast the closed
  // `parallel-utils-spec` above, which is already export-ready).
  'parallel-utils-kickoff': (db, name = 'parallel-utils (kickoff)') => {
    const project = createSpecification(db, name);
    return project.id;
  },
};

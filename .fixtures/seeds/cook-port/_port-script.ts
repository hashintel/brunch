/**
 * Throwaway data-prep: port the three reversed cook-fixture specs from the
 * sibling main-branch worktree (`../brunch/src/server/fixtures/cook-fixture-specs.ts`)
 * into the brunch seed contract consumed by `src/graph/seed-fixtures.ts`.
 *
 * The source data (items + edges per spec, plus the grounding/design
 * interview strings) is vendored inline below, verbatim from the sibling
 * file, so this script is re-runnable from this directory alone. Each run
 * overwrites the `<slug>.json` files next to it.
 *
 *   npx tsx .fixtures/seeds/cook-port/_port-script.ts
 *
 * Transformation rules (precedent: `.fixtures/seeds/bilal-port/_port-script.ts`):
 *
 *   Node kinds map 1:1 — goal, term, context, constraint, decision,
 *   assumption, requirement, criterion all exist in brunch INTENT_KINDS.
 *   All nodes: plane "intent", basis "explicit".
 *
 *   Field translation:
 *     content → title (truncated at 140 chars) + body (full text)
 *     decision rationale / impact → appended to body ("Rationale: …",
 *       "Impact: …").
 *     decision → DecisionDetail is REQUIRED by the validator. chosen_option
 *       carries the decision content; the source never recorded rejected
 *       alternatives, and rationale is sometimes absent, so those slots are
 *       filled with the explicit marker "(not recorded in source)" rather
 *       than fabricated alternatives.
 *     term → TermDetail is REQUIRED. Source term contents follow the
 *       "Name — definition" pattern; title becomes the name part and
 *       detail.definition the remainder (full content stays in body).
 *     key → preserved in source as "cook-port [<key>]" for traceability.
 *
 *   Interview provenance (the `seedClosedSpecFromKnowledge` replay has no
 *   equivalent here — the brunch seed contract is nodes+edges only):
 *     grounding question/answer → one context node, source "cook-port-interview"
 *     designAnswer → one context node, source "cook-port-interview"
 *     each wired support[for] → goal.
 *
 *   Edge relation → brunch category (direction per category-policy roles):
 *     derived_from  → dependency  (FLIPPED: old `to` is the upstream
 *                     knowledge → source/dependency end; old `from` is the
 *                     dependent. All targets here are goal/term/context,
 *                     structural-decisional per the bilal-port rule.)
 *     depends_on    → dependency  (FLIPPED, same reasoning)
 *     refines       → support[for] (term elaborates the goal-as-claim;
 *                     same direction. Judgment call — no bilal precedent.)
 *     constrains    → boundary    (boundary → subject; same direction)
 *     verifies      → proof[for]  (oracle → claim; same direction)
 *
 *   Deliberately preserved property: NO requirement→requirement dependency
 *   edges. The source comments insist the slice DAG (fan-out/join/gate) is
 *   plan truth the architect re-derives, not spec truth the observer
 *   captures. Nothing here adds such edges.
 */

import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Source shapes (mirroring ../brunch closed-spec-builder types)
// ---------------------------------------------------------------------------

type SourceKind =
  | 'goal'
  | 'term'
  | 'context'
  | 'constraint'
  | 'decision'
  | 'assumption'
  | 'requirement'
  | 'criterion';

type SourceRelation = 'derived_from' | 'refines' | 'constrains' | 'depends_on' | 'verifies';

interface SourceItem {
  key: string;
  kind: SourceKind;
  content: string;
  rationale?: string;
  impact?: string;
}

interface SourceEdge {
  from: string;
  to: string;
  relation: SourceRelation;
}

interface SourceSpec {
  slug: string;
  name: string;
  grounding: { question: string; answer: string };
  designAnswer: string;
  items: readonly SourceItem[];
  edges: readonly SourceEdge[];
}

// ---------------------------------------------------------------------------
// Output shape (the seed contract — see src/graph/seed-fixtures.ts)
// ---------------------------------------------------------------------------

interface OutNode {
  local_id: number;
  plane: 'intent';
  kind: SourceKind;
  title: string;
  body: string | null;
  basis: 'explicit';
  source: string | null;
  detail:
    | { definition: string }
    | { chosen_option: string; rejected: string[]; rationale: string }
    | null;
}

interface OutEdge {
  category: 'dependency' | 'witness' | 'rationale' | 'exclusion';
  source_local_id: number;
  target_local_id: number;
  stance: 'for' | null;
  basis: 'explicit';
  rationale: string | null;
}

// ---------------------------------------------------------------------------
// Vendored source data — verbatim from
// ../brunch/src/server/fixtures/cook-fixture-specs.ts
// ---------------------------------------------------------------------------

const parallelUtils: SourceSpec = {
  slug: 'parallel-utils-spec',
  name: 'parallel-utils (reversed cook fixture)',
  grounding: {
    question:
      'Sketch parallel-utils in one breath: what is it, what shape gives it value, and how is it built?',
    answer:
      'A zero-dependency TS utility library of 8 independent leaves fanning out from one scaffold prerequisite, built so a parallel cook run fires them concurrently.',
  },
  designAnswer:
    'Keep every utility file-disjoint with a single export so the leaves stay independent and fan out from one scaffold.',
  items: [
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
      content:
        'One module per utility, file-disjoint, single named export; the barrel re-exports each.',
      rationale: 'Independence enables unbounded fan-out and side-steps the last-wins epic merge.',
      impact: 'high',
    },
    {
      key: 'd2',
      kind: 'decision',
      content:
        'Scaffold is the only shared prerequisite; every utility depends on scaffold and nothing else.',
      rationale: 'Preserves pure fan-out; any util→util edge would serialise the demo.',
      impact: 'high',
    },
    {
      key: 'd4',
      kind: 'decision',
      content:
        'Each utility owns exactly one unit-test oracle; the epic owns one barrel integration oracle.',
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
      content:
        'chunk<T>(arr, size): split into size-N groups (last may be shorter); size <= 0 throws.',
    },
    {
      key: 'r-unique',
      kind: 'requirement',
      content:
        'unique<T>(arr): elements in first-seen order, duplicates removed under SameValueZero equality.',
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
  ],
  edges: [
    { from: 'r-scaffold', to: 'goal', relation: 'derived_from' },
    { from: 'term-fanout', to: 'goal', relation: 'refines' },
    { from: 'term-barrel', to: 'goal', relation: 'refines' },
    { from: 'ctx-roundtrip', to: 'goal', relation: 'derived_from' },
    { from: 'd1', to: 'term-leaf', relation: 'derived_from' },
    { from: 'd2', to: 'ctx-roundtrip', relation: 'derived_from' },
    { from: 'con-zerodep', to: 'goal', relation: 'constrains' },
    { from: 'con-noimport', to: 'r-compose', relation: 'constrains' },
    { from: 'con-fixed', to: 'goal', relation: 'constrains' },
    { from: 'a3', to: 'd1', relation: 'depends_on' },
    { from: 'a1', to: 'd4', relation: 'depends_on' },
    { from: 'a2', to: 'd4', relation: 'depends_on' },
    { from: 'c-green', to: 'r-compose', relation: 'verifies' },
    { from: 'c-parallel', to: 'r-scaffold', relation: 'verifies' },
    { from: 'c-disjoint', to: 'r-compose', relation: 'verifies' },
    { from: 'c-plan-shape', to: 'r-scaffold', relation: 'verifies' },
  ],
};

const layeredTodo: SourceSpec = {
  slug: 'layered-todo-spec',
  name: 'layered-todo (reversed cook fixture)',
  grounding: {
    question:
      'Sketch layered-todo in one breath: what is it, and what dependency shape gives it value?',
    answer:
      'An in-memory Todo service + CLI whose value is its diamond join (service needs store and validation) plus a cross-epic gate (cli waits on core).',
  },
  designAnswer:
    'Encode genuine build-order only — the diamond join on service plus a cross-epic gate holding cli behind core.',
  items: [
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
      content:
        'src/commands/add.ts: add(service, title) creating a todo via the service and returning its id.',
    },
    {
      key: 'r-cmd-list',
      kind: 'requirement',
      content:
        'src/commands/list.ts: list(service) returning formatted lines per todo ([ ]/[x] + title).',
    },
    {
      key: 'r-cmd-done',
      kind: 'requirement',
      content:
        'src/commands/done.ts: done(service, id) marking a todo complete; throws if the id is unknown.',
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
      content:
        'All per-slice unit tests and the todo-e2e integration test pass green in the merged tree.',
    },
    {
      key: 'c-disjoint',
      kind: 'criterion',
      content:
        'Slices are file-disjoint; service.ts is the only module importing both store and validation.',
    },
  ],
  edges: [
    { from: 'r-types', to: 'goal', relation: 'derived_from' },
    { from: 'term-join', to: 'goal', relation: 'refines' },
    { from: 'term-gate', to: 'goal', relation: 'refines' },
    { from: 'ctx-roundtrip', to: 'goal', relation: 'derived_from' },
    { from: 'd2', to: 'term-join', relation: 'derived_from' },
    { from: 'd3', to: 'term-gate', relation: 'derived_from' },
    { from: 'd1', to: 'ctx-roundtrip', relation: 'derived_from' },
    { from: 'con-inmem', to: 'goal', relation: 'constrains' },
    { from: 'con-edges', to: 'r-service', relation: 'constrains' },
    { from: 'con-disjoint', to: 'goal', relation: 'constrains' },
    { from: 'a1', to: 'd1', relation: 'depends_on' },
    { from: 'a2', to: 'd4', relation: 'depends_on' },
    { from: 'c-join-gate', to: 'r-service', relation: 'verifies' },
    { from: 'c-green', to: 'r-e2e', relation: 'verifies' },
    { from: 'c-disjoint', to: 'r-service', relation: 'verifies' },
    { from: 'c-plan-shape', to: 'r-service', relation: 'verifies' },
  ],
};

const resilientPipeline: SourceSpec = {
  slug: 'resilient-pipeline-spec',
  name: 'resilient-pipeline (reversed cook fixture)',
  grounding: {
    question:
      'Sketch resilient-pipeline in one breath: what is it, and what does the seeded halt demonstrate?',
    answer:
      'A CSV parse→transform→serialize pipeline where transform-b is intentionally contradictory and halts, isolating failure while the serialize join stays provably unreachable.',
  },
  designAnswer:
    'Isolate failure to the halted slice’s downstream cone; keep the serialize join waiting (unreachable), not failed.',
  items: [
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
      content:
        'The halt stays isolated: the independent subtree completes; only serialize is blocked.',
    },
  ],
  edges: [
    { from: 'r-parse', to: 'goal', relation: 'derived_from' },
    { from: 'term-halt', to: 'goal', relation: 'refines' },
    { from: 'term-unreachable', to: 'goal', relation: 'refines' },
    { from: 'ctx-roundtrip', to: 'goal', relation: 'derived_from' },
    { from: 'd1', to: 'term-seeded', relation: 'derived_from' },
    { from: 'd3', to: 'term-unreachable', relation: 'derived_from' },
    { from: 'd2', to: 'term-isolation', relation: 'derived_from' },
    { from: 'con-dontfix', to: 'r-transform-b', relation: 'constrains' },
    { from: 'con-isolation', to: 'goal', relation: 'constrains' },
    { from: 'con-substrate', to: 'goal', relation: 'constrains' },
    { from: 'a1', to: 'd1', relation: 'depends_on' },
    { from: 'a2', to: 'd3', relation: 'depends_on' },
    { from: 'c-halt', to: 'r-transform-b', relation: 'verifies' },
    { from: 'c-isolated', to: 'r-parse', relation: 'verifies' },
    { from: 'c-green', to: 'r-serialize', relation: 'verifies' },
    { from: 'c-plan-shape', to: 'r-serialize', relation: 'verifies' },
  ],
};

// ---------------------------------------------------------------------------
// Port
// ---------------------------------------------------------------------------

const TITLE_MAX = 140;
const NOT_RECORDED = '(not recorded in source)';

function truncate(content: string): string {
  if (content.length <= TITLE_MAX) return content;
  return `${content.slice(0, TITLE_MAX - 1).trimEnd()}…`;
}

function toBody(item: SourceItem): string {
  let body = item.content;
  if (item.rationale) body += `\n\nRationale: ${item.rationale}`;
  if (item.impact) body += `\n\nImpact: ${item.impact}`;
  return body;
}

/** "Name — definition" split for term nodes; falls back to full content. */
function splitTerm(content: string): { name: string; definition: string } {
  const dash = content.indexOf('—');
  if (dash === -1) return { name: truncate(content), definition: content };
  return {
    name: content.slice(0, dash).trim(),
    definition: content.slice(dash + 1).trim(),
  };
}

function toTitle(item: SourceItem): string {
  if (item.kind === 'term') return splitTerm(item.content).name;
  return truncate(item.content);
}

function toDetail(item: SourceItem): OutNode['detail'] {
  if (item.kind === 'term') {
    return { definition: splitTerm(item.content).definition };
  }
  if (item.kind === 'decision') {
    return {
      chosen_option: item.content,
      rejected: [NOT_RECORDED],
      rationale: item.rationale ?? NOT_RECORDED,
    };
  }
  return null;
}

function portSpec(spec: SourceSpec): { spec: { slug: string; name: string }; nodes: OutNode[]; edges: OutEdge[] } {
  const localIdByKey = new Map<string, number>();
  let nextLocalId = 1;

  const nodes: OutNode[] = spec.items.map((item) => {
    const localId = nextLocalId++;
    localIdByKey.set(item.key, localId);
    return {
      local_id: localId,
      plane: 'intent',
      kind: item.kind,
      title: toTitle(item),
      body: toBody(item),
      basis: 'explicit',
      source: `cook-port [${item.key}]`,
      detail: toDetail(item),
    };
  });

  // Interview provenance — the source's seedClosedSpecFromKnowledge replay
  // collapses to two context nodes supporting the goal.
  const goalId = localIdByKey.get('goal');
  if (goalId === undefined) throw new Error(`${spec.slug}: no goal item`);

  const groundingId = nextLocalId++;
  nodes.push({
    local_id: groundingId,
    plane: 'intent',
    kind: 'context',
    title: 'Grounding exchange (ported interview)',
    body: `Q: ${spec.grounding.question}\n\nA: ${spec.grounding.answer}`,
    basis: 'explicit',
    source: 'cook-port-interview',
    detail: null,
  });
  const designId = nextLocalId++;
  nodes.push({
    local_id: designId,
    plane: 'intent',
    kind: 'context',
    title: 'Design answer (ported interview)',
    body: spec.designAnswer,
    basis: 'explicit',
    source: 'cook-port-interview',
    detail: null,
  });

  const edges: OutEdge[] = [
    {
      category: 'rationale',
      source_local_id: groundingId,
      target_local_id: goalId,
      stance: 'for',
      basis: 'explicit',
      rationale: null,
    },
    {
      category: 'rationale',
      source_local_id: designId,
      target_local_id: goalId,
      stance: 'for',
      basis: 'explicit',
      rationale: null,
    },
  ];

  for (const edge of spec.edges) {
    const fromId = localIdByKey.get(edge.from);
    const toId = localIdByKey.get(edge.to);
    if (fromId === undefined || toId === undefined) {
      throw new Error(`${spec.slug}: unresolved edge endpoint ${edge.from} → ${edge.to}`);
    }
    switch (edge.relation) {
      case 'derived_from':
      case 'depends_on':
        // X derived_from/depends_on Y: Y is the upstream knowledge.
        // brunch dependency: source = dependency (upstream, cascade on
        // change), target = dependent — so old `to` becomes source.
        edges.push({
          category: 'dependency',
          source_local_id: toId,
          target_local_id: fromId,
          stance: null,
          basis: 'explicit',
          rationale: null,
        });
        break;
      case 'refines':
        // term refines goal → term supports the goal-as-claim.
        edges.push({
          category: 'rationale',
          source_local_id: fromId,
          target_local_id: toId,
          stance: 'for',
          basis: 'explicit',
          rationale: null,
        });
        break;
      case 'constrains':
        edges.push({
          category: 'exclusion',
          source_local_id: fromId,
          target_local_id: toId,
          stance: null,
          basis: 'explicit',
          rationale: null,
        });
        break;
      case 'verifies':
        edges.push({
          category: 'witness',
          source_local_id: fromId,
          target_local_id: toId,
          stance: 'for',
          basis: 'explicit',
          rationale: null,
        });
        break;
    }
  }

  return { spec: { slug: spec.slug, name: spec.name }, nodes, edges };
}

for (const source of [parallelUtils, layeredTodo, resilientPipeline]) {
  const fixture = portSpec(source);
  const path = resolve(OUT_DIR, `${source.slug}.json`);
  writeFileSync(path, `${JSON.stringify(fixture, null, 2)}\n`);
  console.log(`wrote ${path} (${fixture.nodes.length} nodes, ${fixture.edges.length} edges)`);
}

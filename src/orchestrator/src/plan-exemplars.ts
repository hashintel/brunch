// FE-829 slice 3: reference-fixture exemplars for the build-architect prompt.
//
// The three hand-authored reference fixtures (`parallel-utils`,
// `layered-todo`, `resilient-pipeline`) are the target SHAPE for emitted
// plans. They are inlined here as comment-stripped YAML constants — read at
// build time from the embedded text, not from `fixtures/` at runtime, since
// the published package ships `dist` but not `fixtures/`.
//
// These are STRUCTURAL examples only: scaffold→fan-out→join, diamond
// dependencies + cross-epic gate, and a linear pipeline with a buildable
// (even if contradictory) slice. The prompt instructs the model not to copy
// exemplar ids, paths, or domain terms.

export type PlanExemplar = {
  name: string;
  shape: string;
  yaml: string;
};

const PARALLEL_UTILS = `epics:
  - id: scaffold
    summary: "Library scaffolding"
    depends_on: []
    verification: []
  - id: utils
    summary: "Independent zero-dependency utility functions"
    depends_on: [scaffold]
    verification:
      - kind: integration-test
        target: "tests/barrel.integration.test.ts"
slices:
  - id: package-setup
    epic_id: scaffold
    definition: "Set up package.json, tsconfig.json, and src/index.ts as an initially empty public barrel. The barrel-exports join slice owns the shared src/index.ts wiring after all util modules exist."
    depends_on: []
    verification:
      - kind: unit-test
        target: "tests/scaffold.test.ts"
  - id: chunk
    epic_id: utils
    definition: "Add chunk in src/chunk.ts. Do not edit src/index.ts; barrel-exports owns the shared barrel."
    depends_on: [package-setup]
    verification:
      - kind: unit-test
        target: "tests/chunk.test.ts"
  - id: unique
    epic_id: utils
    definition: "Add unique in src/unique.ts. Do not edit src/index.ts; barrel-exports owns the shared barrel."
    depends_on: [package-setup]
    verification:
      - kind: unit-test
        target: "tests/unique.test.ts"
  - id: barrel-exports
    epic_id: utils
    definition: "Update the shared public barrel src/index.ts to re-export every completed util module. This join slice is the only util slice that edits src/index.ts."
    depends_on: [chunk, unique]
    verification:
      - kind: integration-test
        target: "tests/barrel.integration.test.ts"`;

const LAYERED_TODO = `epics:
  - id: core
    summary: "In-memory todo domain: types, store, validation, service"
    depends_on: []
    verification: []
  - id: cli
    summary: "Command surface over the todo service"
    depends_on: [core]
    verification:
      - kind: integration-test
        target: "tests/todo-e2e.integration.test.ts"
slices:
  - id: types
    epic_id: core
    definition: "Add src/types.ts: the Todo type and an id() generator. The root of the domain."
    depends_on: []
    verification:
      - kind: unit-test
        target: "tests/types.test.ts"
  - id: store
    epic_id: core
    definition: "Add src/store.ts: an in-memory TodoStore over the Todo type from src/types.ts."
    depends_on: [types]
    verification:
      - kind: unit-test
        target: "tests/store.test.ts"
  - id: validation
    epic_id: core
    definition: "Add src/validation.ts using the Todo type from src/types.ts."
    depends_on: [types]
    verification:
      - kind: unit-test
        target: "tests/validation.test.ts"
  - id: service
    epic_id: core
    definition: "Add src/service.ts: a TodoService composing the store and validation."
    depends_on: [store, validation]
    verification:
      - kind: unit-test
        target: "tests/service.test.ts"
  - id: cmd-add
    epic_id: cli
    definition: "Add src/commands/add.ts over the service."
    depends_on: [service]
    verification:
      - kind: unit-test
        target: "tests/cmd-add.test.ts"`;

const RESILIENT_PIPELINE = `epics:
  - id: pipeline
    summary: "A small parse -> transform -> serialize data pipeline"
    depends_on: []
    verification: []
slices:
  - id: parse
    epic_id: pipeline
    definition: "Add src/parse.ts parsing simple CSV into row objects."
    depends_on: []
    verification:
      - kind: unit-test
        target: "tests/parse.test.ts"
  - id: transform-a
    epic_id: pipeline
    definition: "Add src/transform-a.ts narrowing each row to the given columns."
    depends_on: [parse]
    verification:
      - kind: unit-test
        target: "tests/transform-a.test.ts"
  - id: transform-b
    epic_id: pipeline
    definition: "Add src/transform-b.ts. This slice is a buildable unit even if its spec is hard to satisfy."
    depends_on: [parse]
    verification:
      - kind: unit-test
        target: "tests/transform-b.test.ts"
  - id: serialize
    epic_id: pipeline
    definition: "Add src/serialize.ts combining the outputs of transform-a and transform-b."
    depends_on: [transform-a, transform-b]
    verification:
      - kind: unit-test
        target: "tests/serialize.test.ts"`;

export const PLAN_EXEMPLARS: readonly PlanExemplar[] = [
  {
    name: 'parallel-utils',
    shape: 'scaffold slice -> many independent slices -> join slice owning the shared barrel',
    yaml: PARALLEL_UTILS,
  },
  {
    name: 'layered-todo',
    shape:
      'diamond dependency (types -> {store, validation} -> service) + cross-epic gate (cli depends_on core)',
    yaml: LAYERED_TODO,
  },
  {
    name: 'resilient-pipeline',
    shape: 'linear fan-out + join; every slice is a buildable unit',
    yaml: RESILIENT_PIPELINE,
  },
];

/**
 * Render the exemplar block for the planning prompt: each fixture labeled
 * with its structural shape, followed by its comment-stripped YAML.
 */
export function buildExemplarBlock(): string {
  return PLAN_EXEMPLARS.map((exemplar) => `### ${exemplar.name} — ${exemplar.shape}\n${exemplar.yaml}`).join(
    '\n\n',
  );
}

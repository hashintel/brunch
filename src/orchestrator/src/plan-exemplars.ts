// FE-829 slices 3-4B: reference-fixture exemplars for the build-architect prompt.
//
// The three hand-authored reference fixtures (`parallel-utils`,
// `layered-todo`, `resilient-pipeline`) are the target SHAPE for emitted
// plans. They are inlined here as comment-stripped YAML constants — read at
// build time from the embedded text, not from `fixtures/` at runtime, since
// the published package ships `dist` but not `fixtures/`.
//
// They teach the structural pattern the architect must reproduce:
// scaffold → file-disjoint per-behaviour slices → a join slice that is the
// SOLE writer of the shared coordination file. `writes` is shown so the
// model learns single-writer-per-file: in `parallel-utils` the scaffold does
// NOT write `src/index.ts`; only the `barrel-exports` join slice does. The
// prompt instructs the model not to copy exemplar ids, paths, or domain terms.

export type PlanExemplar = {
  name: string;
  shape: string;
  yaml: string;
};

const PARALLEL_UTILS = `epics:
  - id: scaffold
    summary: "Library scaffolding"
    depends_on: []
  - id: utils
    summary: "Independent zero-dependency utility functions"
    depends_on: [scaffold]
slices:
  - id: package-setup
    epic_id: scaffold
    definition: "Set up package.json and tsconfig.json. The barrel-exports join slice creates and owns the shared src/index.ts; do not write it here."
    depends_on: []
    writes: ["package.json", "tsconfig.json"]
  - id: chunk
    epic_id: utils
    definition: "Add chunk in src/chunk.ts. Do not edit src/index.ts; barrel-exports owns the shared barrel."
    depends_on: [package-setup]
    writes: ["src/chunk.ts"]
  - id: unique
    epic_id: utils
    definition: "Add unique in src/unique.ts. Do not edit src/index.ts; barrel-exports owns the shared barrel."
    depends_on: [package-setup]
    writes: ["src/unique.ts"]
  - id: barrel-exports
    epic_id: utils
    definition: "Create the shared public barrel src/index.ts re-exporting every completed util module. This join slice is the SOLE writer of src/index.ts."
    depends_on: [chunk, unique]
    writes: ["src/index.ts"]`;

const LAYERED_TODO = `epics:
  - id: core
    summary: "In-memory todo domain: types, store, validation, service"
    depends_on: []
  - id: cli
    summary: "Command surface over the todo service"
    depends_on: [core]
slices:
  - id: types
    epic_id: core
    definition: "Add src/types.ts: the Todo type and an id() generator. The root of the domain."
    depends_on: []
    writes: ["src/types.ts"]
  - id: store
    epic_id: core
    definition: "Add src/store.ts: an in-memory TodoStore over the Todo type from src/types.ts."
    depends_on: [types]
    writes: ["src/store.ts"]
  - id: validation
    epic_id: core
    definition: "Add src/validation.ts using the Todo type from src/types.ts."
    depends_on: [types]
    writes: ["src/validation.ts"]
  - id: service
    epic_id: core
    definition: "Add src/service.ts: a TodoService composing the store and validation."
    depends_on: [store, validation]
    writes: ["src/service.ts"]
  - id: cmd-add
    epic_id: cli
    definition: "Add src/commands/add.ts over the service."
    depends_on: [service]
    writes: ["src/commands/add.ts"]`;

const RESILIENT_PIPELINE = `epics:
  - id: pipeline
    summary: "A small parse -> transform -> serialize data pipeline"
    depends_on: []
slices:
  - id: parse
    epic_id: pipeline
    definition: "Add src/parse.ts parsing simple CSV into row objects."
    depends_on: []
    writes: ["src/parse.ts"]
  - id: transform-a
    epic_id: pipeline
    definition: "Add src/transform-a.ts narrowing each row to the given columns."
    depends_on: [parse]
    writes: ["src/transform-a.ts"]
  - id: transform-b
    epic_id: pipeline
    definition: "Add src/transform-b.ts. This slice is a buildable unit even if its spec is hard to satisfy."
    depends_on: [parse]
    writes: ["src/transform-b.ts"]
  - id: serialize
    epic_id: pipeline
    definition: "Add src/serialize.ts combining the outputs of transform-a and transform-b."
    depends_on: [transform-a, transform-b]
    writes: ["src/serialize.ts"]`;

export const PLAN_EXEMPLARS: readonly PlanExemplar[] = [
  {
    name: 'parallel-utils',
    shape: 'scaffold -> many file-disjoint slices -> join slice that is the sole writer of the shared barrel',
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
    shape: 'linear fan-out + join; every slice owns its own file',
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

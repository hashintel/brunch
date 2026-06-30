# orchestration/ — execute-mode projection contracts

SPEC decisions: FE-1089 cutover frontier; `brunch-orchestrator-cutover-to-next.md` Arc 1 data bridge.

## Owns

Pure contracts and projection helpers that turn `next` graph facts into execute-mode orchestration inputs. This subtree is product core: it imports graph DTOs and emits stable orchestration DTOs, but it does not register Pi tools, read SQLite, create worktrees, run Petri nets, or write plan files.

```text
orchestration/
├── README.md
├── execution-spec-snapshot.ts   graph facts -> ExecutionSpecSnapshot v1
├── execute-plan-check.ts        ExecutionSpecSnapshot -> read-only plan-input findings
├── execute-plan-outline.ts      ExecutionSpecSnapshot -> side-effect-free plan outline
└── __tests__/
```

## Boundary rules

```pseudo
rules:
  orchestration/ -> graph/schema/ [read typed DTOs]
  orchestration/ x> db/, .pi/, app/, rpc/, web/ [no storage, adapter, transport, or UI effects]
```

`ExecutionSpecSnapshot` is the durable projection seam between the spec/graph product and the native execute-mode orchestrator. Both `main`-derived imports and `next` graph reads can target this shape while their internal models continue to evolve.

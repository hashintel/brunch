# Execute mode interaction — owned gate

Date: 2026-08-10  
Frontier: FE-1348  
Source commit: `47f02b802` (`FE-1348: Validate session resume tree continuity`)  
Host: macOS arm64, Node v24.16.0, Pi v0.83.0, Brunch v1.0.0-alpha.13

## Orientation

- Seam: real TUI operational-mode switch plus public session and executor read projections.
- Row: `Execute mode interaction` only; Specify, seeded-workbench validation, graph settlement, and provider execution were not claimed.
- Cross-cutting obligations: SQLite/JSONL remained authority, provider auth was isolated, and no run or provider turn was started.
- Open risk: the current public surface does not provide enough plan/run state on this bounded seed to prove Compile or Execute availability.

## Setup

A fresh temporary workbench was produced through the documented seed command; this establishes only the bounded row input, not the separate seeded-workbench-validation row:

```sh
W=$(mktemp -d /tmp/brunch-fe1348-execute.XXXXXX)
npm run seed -- \
  --seed workspace-alpha-grounding/scope-handoff-ready \
  --workspace "$W" \
  --reset
```

The supported seed command completed with `spec 1 (5 nodes, 5 edges)` and wrote a fresh `brunch-v1.db`. The TUI was launched through `npm run tui-driver` with a fresh temporary `PI_CODING_AGENT_DIR`, so root provider credentials and settings were not visible to the process. The existing ignored `workspace-alpha-grounding` workbench was not read or changed.

## Real mode switch and render

The TUI selected `Alpha Grounding — Scope Handoff Ready`, created its first greenfield session, and rendered the normal Specify chrome. Through the real command path:

1. dismissed the initial Specify orientation;
2. entered `/brunch:mode`;
3. observed `Choose Brunch mode`, `current: Specify`, and the `Specify | Execute` picker;
4. selected Execute with Right + Enter.

The resulting render said:

```text
Brunch mode set to Execute.
[ Execute ]
Choose a process move for Execute mode
› 1. Prepare execution
    Close design, verification, and commitment gaps.
```

Advertised capability states were therefore:

| Capability | Visible state |
| --- | --- |
| Prepare | available |
| Compile | not advertised |
| Execute | not advertised |

This is capability-honest against the available readbacks below: no plan/run was exposed from which Compile or Execute could be justified. It is not evidence that a plan-bearing or run-bearing seed advertises those later moves.

## Supported readbacks

`workspace.state` identified spec `1`, session `019feb6b-a5eb-7d7c-b0d5-39960f987ce3`, and the fresh JSONL under the temporary workbench.

The explicit public runtime read:

```sh
npm run dev-cli -- rpc session.runtimeState \
  '{"specId":1,"sessionId":"019feb6b-a5eb-7d7c-b0d5-39960f987ce3"}' \
  --workspace "$W"
```

returned `status: ready`, `agent.operationalMode: execute`, `agent.role: executor`, and graph watermark `latestLsn: 3`, matching the visible Execute chrome.

The available public executor reads returned:

```text
execute.runs                 -> { "runs": [] }
execute.runTraceIndex        -> { "traces": [] }
```

`rpc.discover` exposed `execute.runs`, `execute.run`, and `execute.runTraceIndex`, but no independent plan-read method. Because the fresh seed contained no run, `execute.run` could not provide a recorded plan snapshot without manufacturing state. The row requires plan/run reads matching visible Prepare/Compile/Execute promises, so this evidence cannot close it.

## Disposition

**Owned gate; row remains `partial`.** Re-enter under FE-1348 when a suitable existing seed can be freshly established through the supported seed command with a real readable plan/run, or when a supported plan read is available. Then repeat the real mode switch and compare the Compile/Execute render with `session.runtimeState` and the public plan/run readbacks. Do not run the provider or execute the plan.

Cost/value: retaining the gate costs one later bounded PTY pass; it prevents claiming later Execute capabilities from an empty run inventory or hand-authored state.

## Cleanup

The TUI driver was stopped and removed; `npm run tui-driver -- list` returned `no sessions`. The temporary workbench and isolated Pi profile were deleted. No tracked seed/fixture, existing ignored workbench, provider profile, or production path was changed.

# POC live ship runbook

This is the outer-loop ship-correctness runbook for `poc-live-ship-gate` (FE-811). It proves the live product path through public entrypoints only; it is not a CI gate and not a deterministic model-quality benchmark.

## Boundary

- Entry point: `brunch --mode tui --open-web` (or `npm run dev -- --mode tui --open-web` from this repo).
- Workspace: a fresh isolated cwd under `.fixtures/workbenches/ship-gate-runbook`.
- Provider: a real configured model provider. Do not set `PI_OFFLINE=1` for the proof run.
- Observer: the web sidecar URL printed by the TUI. The ordinary sidecar is read-only; do not use private in-process wiring.
- Evidence home: `.fixtures/runs/ship-gate-runbook/<run-id>/`.

The run may use the public seed CLI for setup, because the proof target is product composition from launch onward rather than seed-authoring UX.

## Fresh run setup

```bash
REPO="$(git rev-parse --show-toplevel)"
WORKSPACE="$REPO/.fixtures/workbenches/ship-gate-runbook"
RUN_ID="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
RUN_DIR="$REPO/.fixtures/runs/ship-gate-runbook/$RUN_ID"

mkdir -p "$WORKSPACE" "$RUN_DIR"

# Seed two specs so selection/scope is visible before the live turn.
# --reset is scoped to Brunch runtime state in this workbench.
npm run seed -- --workspace "$WORKSPACE" --seed workspace-alpha-grounding/base --reset
npm run seed -- --workspace "$WORKSPACE" --seed workspace-beta-commitments/base
```

Launch the real product; source/dev runs mirror prompt/posture artifacts into `.brunch/debug/` automatically:

```bash
npm run dev -- --workspace "$WORKSPACE" --open-web
```

Record the sidecar URL printed by the TUI in `report.json` and open it in the browser. The launch path must be the product TUI sidecar, not a test harness or imported handler.

## Walkthrough checklist

Each row names the public surface and the artifact to capture before moving on.

| Step | Public surface | Action | Artifact |
| --- | --- | --- | --- |
| 1 | TUI startup dialog | Select/create the target spec and create a new session. Confirm stale transcripts are not resumed implicitly. | `workspace-selection.json` with selected spec/session ids; `tui-startup.md` notes. |
| 2 | Web sidecar | Open the sidecar URL and confirm it shows the selected spec graph, not the second spec. | `web-observer-before.md` and optional screenshot path in `report.json`. |
| 3 | TUI live agent | Let the assistant-originated opening turn complete. It should be seeded and gap-grounded. | `session.jsonl`; `transcript.md`; `entry-contents.md`; first assistant excerpt in `report.json`. |
| 4 | TUI exchange surface | Answer the next-best question with a directly stated fact that can close or update a gap. | `accepted-gaps-before.json`; `accepted-gaps-after.json`; answer excerpt in `report.json`. |
| 5 | Product graph path | Confirm high-confidence generalized capture committed graph truth through the normal command layer. | `graph-summary-before.json`; `graph-summary-after.json` with LSN increase and committed node titles. |
| 6 | Web observer | Confirm the web sidecar reflects the graph update for the selected spec. | `web-observer-after.md` and optional screenshot path in `report.json`. |
| 7 | TUI mode switch | Switch the operational mode from Specify to Execute (or back) using the TUI mode affordance. | `mode-before.md`; `mode-after.md`; `runtime-state-before.json`; `runtime-state-after.json`. |
| 8 | Prompt observable | Trigger or resume a turn after the mode switch so the composed system prompt mirror updates. | `system-prompt-before.md`; `system-prompt-after.md`; `mode-diff.md`. |

Stop and record a defect if any step requires importing `createRpcHandlers`, `createWorkspaceSessionCoordinator`, `createBrunchAgentSessionRuntimeFactory`, reading SQLite directly for the claim, or mutating through a non-product helper.

## Artifact schema

A committed run directory uses this shape:

```text
.fixtures/runs/ship-gate-runbook/<run-id>/
├── report.json
├── session.jsonl
├── graph-summary-before.json
├── graph-summary-after.json
├── accepted-gaps-before.json
├── accepted-gaps-after.json
├── runtime-state-before.json
├── runtime-state-after.json
├── system-prompt-before.md
├── system-prompt-after.md
├── mode-diff.md
├── web-observer-before.md
├── web-observer-after.md
├── entry-contents.md
├── tool-contents.md                 # optional; include when present
└── screenshots/                     # optional browser screenshots
```

`report.json` is the index and verdict:

```json
{
  "schemaVersion": 1,
  "probeId": "ship-gate-runbook",
  "runId": "2026-06-22T00-00-00Z",
  "generatedAt": "2026-06-22T00:00:00.000Z",
  "cwd": "<repo>/.fixtures/workbenches/ship-gate-runbook",
  "cli": "brunch --mode tui --open-web",
  "provider": { "kind": "real", "model": "<provider model id>" },
  "success": true,
  "selectedSpec": { "id": 1, "title": "<title>" },
  "selectedSession": { "id": "<pi session id>", "label": "<session label>" },
  "webSidecarUrl": "http://127.0.0.1:<port>/spec/<id>",
  "checks": {
    "publicEntrypointsOnly": true,
    "seededGapGroundedOpening": true,
    "questionAnswerGapWriteback": true,
    "highConfidenceCaptureCommitted": true,
    "webObserverReflectedGraphUpdate": true,
    "modeSwitchChangedPrompt": true
  },
  "graph": {
    "before": { "lsn": 2, "nodeCount": 4, "edgeCount": 2 },
    "after": { "lsn": 3, "nodeCount": 5, "edgeCount": 2 },
    "committedNodeTitles": ["<directly stated fact captured by the live turn>"]
  },
  "mode": {
    "before": { "operationalMode": "elicit", "label": "Specify" },
    "after": { "operationalMode": "execute", "label": "Execute" },
    "systemPromptChanged": true
  },
  "friction": [],
  "artifacts": {
    "runDir": "runs/ship-gate-runbook/2026-06-22T00-00-00Z",
    "sessionJsonl": "runs/ship-gate-runbook/2026-06-22T00-00-00Z/session.jsonl",
    "reportJson": "runs/ship-gate-runbook/2026-06-22T00-00-00Z/report.json",
    "graphBefore": "runs/ship-gate-runbook/2026-06-22T00-00-00Z/graph-summary-before.json",
    "graphAfter": "runs/ship-gate-runbook/2026-06-22T00-00-00Z/graph-summary-after.json",
    "modeBefore": "runs/ship-gate-runbook/2026-06-22T00-00-00Z/system-prompt-before.md",
    "modeAfter": "runs/ship-gate-runbook/2026-06-22T00-00-00Z/system-prompt-after.md"
  }
}
```

## Capture commands

After the run, copy only product-produced evidence from the workbench:

```bash
cp "$WORKSPACE/.brunch/debug/system-prompt.md" "$RUN_DIR/system-prompt-after.md"
cp "$WORKSPACE/.brunch/debug/entry-contents.md" "$RUN_DIR/entry-contents.md"
test -f "$WORKSPACE/.brunch/debug/tool-contents.md" && cp "$WORKSPACE/.brunch/debug/tool-contents.md" "$RUN_DIR/tool-contents.md"
cp "$WORKSPACE/.brunch/sessions/"*.jsonl "$RUN_DIR/session.jsonl"
```

Use public RPC/read projections for JSON summaries; do not read SQLite directly:

```bash
npm run dev -- rpc graph.overview '{"specId":1}' --workspace "$WORKSPACE" > "$RUN_DIR/graph-summary-after.json"
npm run dev -- rpc session.runtimeState '{"specId":1,"sessionId":"<session id>"}' --workspace "$WORKSPACE" > "$RUN_DIR/runtime-state-after.json"
```

If a human-readable transcript is useful during the run, use the workspace-local `.brunch/debug/transcript.md` emitted by the faux-harness/debug renderer. Do not add `transcript.md` as a default committed probe artifact; keep `session.jsonl` as the source evidence.

## Pass/fail rule

The run passes only if every visual claim has a matching durable artifact or projection query, and the report can be reviewed without relaunching the workbench. If a live provider produces a poor answer but the product path composes, record the friction separately from composition success. If graph writeback, web update, or posture prompt change fails, mark the report `success: false` and link the defect in PLAN before retrying.

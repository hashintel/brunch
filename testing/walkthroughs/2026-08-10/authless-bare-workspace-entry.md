# Authless bare-workspace entry

Date: 2026-08-10

Commit under test: `965cad483` (`FE-1348: Record print projection installed gate`)

Branch: `ln/fe-1348-validate-current-brunch-usage-and-testing-paths`

Driver session: `fe1348-authless-bare-r2` (120 × 40)

Workspace: `.fixtures/scratch/fe1348-authless-bare-workspace-r2`

Pi profile: `.fixtures/scratch/fe1348-authless-pi-r2`

## Sealed authless setup

The product process used a fresh `PI_CODING_AGENT_DIR`. The provider API variables present in the agent harness were explicitly removed from the child environment so neither environment auth nor the protected project `.pi/settings.json` could influence the run:

```sh
env -u ANTHROPIC_API_KEY -u GEMINI_API_KEY -u OPENAI_API_KEY -u OPENROUTER_API_KEY \
  PI_CODING_AGENT_DIR="$P" \
  npm run tui-driver -- start --name fe1348-authless-bare-r2 --cols 120 --rows 40 -- \
  npm run dev-cli -- --workspace "$W" --no-webui
```

The resulting isolated `auth.json` was exactly two bytes, SHA-256 `44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a`, and parsed as an object with zero keys.

## Exact entry interaction

Through the real source TUI:

1. At `Choose a specification`, select `Start a new specification` (`Enter`).
2. At `New specification title`, type `Authless Bare Proof` and press `Enter`.
3. At `Is this a fresh, greenfield specification?`, accept `Yes — this is greenfield` (`Enter`).

Creation remained available without auth. The resulting product screen named the recovery path exactly:

```text
Warning: No provider auth is available, so Brunch did not start an assistant turn. Run /login, then try
/brunch:continue again.
```

The footer simultaneously reported `model no model | thinking off | context ?%`. No assistant text, provider response, or structured ask appeared.

## Canonical readback and no-provider proof

The public stdio `workspace.state` read against the same workspace returned:

```json
{
  "status": "ready",
  "spec": {
    "id": 1,
    "title": "Authless Bare Proof",
    "kind": "product",
    "origin": "greenfield",
    "relatesToSpecId": null
  },
  "session": {
    "id": "019feb5f-c827-74e5-b513-0452fbf05378",
    "file": ".brunch/sessions/2026-08-10T11-12-30-759Z_019feb5f-c827-74e5-b513-0452fbf05378.jsonl"
  }
}
```

`session.runtimeState` returned Specify/elicitor state with empty graph/file mentions and `world.graph.latestLsn: null`. `session.exchanges` returned `{"status":"empty","exchanges":[],"openPrompt":null}`. `graph.overview` returned empty nodes and edges at LSN 1.

The canonical JSONL had exactly five structural entries:

```text
session
custom: brunch.session_binding
session_info
thinking_level_change
custom: brunch.agent_runtime_state
```

It contained no `message` entry and no user or assistant role. SQLite readback after normal TUI shutdown returned one spec, zero nodes, zero edges, and one change-log row. Together, the empty-auth profile, no-model TUI state, transcript shape, empty exchanges, and empty graph prove that creation persisted without hidden auth and no provider turn fired prematurely.

## Cleanup and protected-state proof

The row stopped and removed its named driver session; `npm run tui-driver -- list` returned `no sessions`. It then explicitly removed the row-owned workspace and isolated Pi profile. All three owned paths were absent:

```text
.fixtures/scratch/fe1348-authless-bare-workspace-r2
.fixtures/scratch/fe1348-authless-pi-r2
.fixtures/scratch/tui-driver/fe1348-authless-bare-r2
```

Protected paths remained unchanged:

```text
9a88610ff5725c86759f4163e824cd50ca473101ea43b49fe16ec671347ad028  .pi/settings.json
a6bf0354bf2443f74b1bba6bba729d9a8893e4e61e0f55e9e5a832e82d6a1bc9  src/dev/__tests__/interactive-shell-config.test.ts
08a0d881461dde5840c1671f89705b6f51437e6544c110ac65c5061257e08045  git diff -- .pi/settings.json
```

No fixture, seed, promoted run, production source, config, package, or tooling file was changed.

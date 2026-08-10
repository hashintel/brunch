# TUI-driver lifecycle fallback

Date: 2026-08-10
Commit under test: `d45c3800b` (`FE-1348: Validate conditional CI lane selection`)
Driver session: `fe1348-tui-lifecycle-r2`
Viewport: 120 × 40
Workspace: `.fixtures/workbenches/workspace-alpha-grounding`

## Lifecycle witness

The bounded fallback lifecycle succeeded with the current rendered entry text and a navigation-only input:

```bash
npm run tui-driver -- start --name fe1348-tui-lifecycle-r2 --cols 120 --rows 40 -- npm run dev-cli -- --workspace .fixtures/workbenches/workspace-alpha-grounding --no-webui
npm run tui-driver -- wait --name fe1348-tui-lifecycle-r2 --text "Choose a specification" --timeout-ms 30000
npm run tui-driver -- send --name fe1348-tui-lifecycle-r2 --key Down
npm run tui-driver -- screen --name fe1348-tui-lifecycle-r2
npm run tui-driver -- stop --name fe1348-tui-lifecycle-r2
npm run tui-driver -- rm --name fe1348-tui-lifecycle-r2
npm run tui-driver -- list
```

Observed command results:

```text
started "fe1348-tui-lifecycle-r2" (120x40) pid=18597
sent 0 text(s), 1 key(s) to "fe1348-tui-lifecycle-r2"
stopped "fe1348-tui-lifecycle-r2"
removed "fe1348-tui-lifecycle-r2"
no sessions
```

The successful `wait` screen showed:

```text
Choose a specification
Choose or create the spec/session before the agent loop runs.

› Continue another existing specification
  Start a new specification
  Cancel
```

After `Down`, `screen` showed the selection moved without entering a flow or triggering a provider turn:

```text
Choose a specification
Choose or create the spec/session before the agent loop runs.

  Continue another existing specification
› Start a new specification
  Cancel
```

## Cleanup and protected-state proof

The driver removed its session directory and the final `list` reported `no sessions`. The launch transiently created `.fixtures/workbenches/workspace-alpha-grounding/.brunch/workspace.json`; it was removed as session-owned residue. A sorted SHA-256 manifest of all files under the protected `.brunch/` tree then matched the pre-run manifest byte-for-byte. The pre-existing database remained at SHA-256 `36484da7d7fc7d87c0dc8066b752c541aba5e5382fc58b0264d677d4dff47c16`.

Protected tracked-path checks after cleanup:

```text
9a88610ff5725c86759f4163e824cd50ca473101ea43b49fe16ec671347ad028  .pi/settings.json
a6bf0354bf2443f74b1bba6bba729d9a8893e4e61e0f55e9e5a832e82d6a1bc9  src/dev/__tests__/interactive-shell-config.test.ts
08a0d881461dde5840c1671f89705b6f51437e6544c110ac65c5061257e08045  git diff -- .pi/settings.json
```

Repository documentation already teaches `Choose a specification`, so the stale prior scripted expectation did not require a finding or documentation change.

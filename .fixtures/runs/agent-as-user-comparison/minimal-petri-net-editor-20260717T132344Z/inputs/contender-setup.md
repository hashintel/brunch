# Approved contender setup

## Run identity

- Mission id: `minimal-petri-net-editor`
- Run id: `minimal-petri-net-editor-20260717T132344Z`
- Requested target document: `petri-net-editor-spec.md`
- Scratch run: `.fixtures/scratch/comparisons/minimal-petri-net-editor-20260717T132344Z/`
- Immutable retained run: `.fixtures/runs/agent-as-user-comparison/minimal-petri-net-editor-20260717T132344Z/`

## Selected lanes and order

1. Brunch
2. Claude Code

Every lane requires a separately identifiable fresh harness-level Pi actor session and a fresh isolated target cwd.

## Exact target-visible framing

### Brunch

> The requested review-ready document is `petri-net-editor-spec.md`.

Adapter:

- Launch `npm run dev-cli -- --workspace <fresh-target-cwd>`.
- Use built-in Specify mode.
- Export only settled graph state with `npm run dev-cli -- document-export --workspace <fresh-target-cwd> --spec-id <id> --out <fresh-target-cwd>/petri-net-editor-spec.md`.

Target cwd: `.fixtures/scratch/comparisons/minimal-petri-net-editor-20260717T132344Z/lanes/brunch/target/`

### Claude Code

> Conduct a question-led specification conversation with me, then author the review-ready Markdown specification at `petri-net-editor-spec.md` in your current working directory. Ask before settling important product decisions; do not assume facts I have not provided.

Adapter:

- `spawn: { agent: "claude" }`
- Claude authors `petri-net-editor-spec.md` in its fresh target cwd.

Target cwd: `.fixtures/scratch/comparisons/minimal-petri-net-editor-20260717T132344Z/lanes/claude-code/target/`

## Approved preflight record

- Comparison homes existed and the scratch and retained run identities were unused.
- Brunch reached built-in Specify mode in an isolated preflight workspace and produced rendered output using `anthropic / claude-sonnet-4-6`.
- Claude Code adapter version `2.1.212` returned `CLAUDE_ADAPTER_OK` from its configured Fable 5 provider. Optional project MCP servers were rejected; three unrelated MCP servers reported needing authentication.
- Installed `pi-interactive-shell` was lock-resolved to `0.13.0`; the push/prune extensions and quiet/update configuration were present.
- Fresh Pi actor preflight session `comparison-actor-preflight-3` confirmed `interactive_shell` availability.
- Preflight processes were killed and no matching process remained in the final process scan.

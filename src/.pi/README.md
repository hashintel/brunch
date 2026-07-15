# Brunch Pi Extensions

## Brunch product tool names

### Brunch-registered read-only wrappers
These wrap Pi-style read-only file tools under Brunch policy:

- `read`
- `grep`
- `find`
- `ls`

### Web acquisition tools
From `src/.pi/extensions/web-tools/`:

- `web_fetch`
- `web_search`

### Workspace / session context tools
From `src/.pi/extensions/brunch-data/context/`:

- `read_workspace_context`
- `read_specification_context`
- `read_session_context`

### Graph tools
Registered when graph deps are available:

- `mutate_graph`
- `read_graph`

### Elicitation scratchpad tools

- `read_elicitation_scratchpad`
- `update_elicitation_scratchpad`

### Reconciliation tools
Registered when graph deps are available:

- `read_reconciliation_needs`
- `update_reconciliation_needs`

### Structured exchange tools
From `src/.pi/extensions/exchanges/`:

- `ask`
- `present_candidates`
- `present_digest`
- `present_review_set`

Legacy persisted transcript vocabulary (read support only, not active registration):

- `present_question`

### Alternatives card tool
Registered from `src/.pi/components/alternatives.ts`:

- `present_alternatives`

Note: registered by the product shell, but not in the current elicitor/executor active-tool allowlists I found.

### Subagent tool
Registered only when the sealed product config provides delegatable agents:

- `subagent`

### Execute-mode tools
From `src/.pi/extensions/executor/` and `src/session/schema/tool-names.ts`:

- `execute_status`
- `execute_orchestrate`
- `execute_snapshot`
- `execute_plan_check`
- `execute_plan_outline`
- `execute_plan_outline_artifact`
- `execute_plan_draft`
- `execute_plan_draft_artifact`
- `execute_plan_preview`
- `execute_plan_file`
- `execute_launch`
- `execute_run_create`
- `execute_worktree_create`
- `execute_populate`
- `execute_source_policy`
- `execute_source_copy`
- `execute_report_init`
- `execute_slice_start`
- `execute_slice_execute`
- `execute_agent_result`
- `execute_test_result`
- `execute_slice_complete`
- `execute_run_complete`
- `execute_petri_export`
- `execute_promotion_prepare`
- `execute_land_preflight`

Note: `execute_plan_outline_artifact` and `execute_plan_draft_artifact` are registered graph-dependent tools, but excluded from the executor active-tool list per `src/agents/runtime/executor/active-tools.ts`.

### Dev-gated introspection/query tools
Only registered when dev introspection query tools are enabled:

- `brunch_session_query`
- `brunch_introspect_query`

## Active allowlists

### Specify / elicitor mode allows

- `read`
- `grep`
- `find`
- `ls`
- `web_fetch`
- `web_search`
- `read_workspace_context`
- `read_specification_context`
- `read_session_context`
- `read_graph`
- `mutate_graph`
- `read_elicitation_scratchpad`
- `update_elicitation_scratchpad`
- `read_reconciliation_needs`
- `update_reconciliation_needs`
- `ask`
- `present_candidates`
- `present_digest`
- `present_review_set`
- `subagent`

### Execute mode allows

Everything in elicitor mode, plus the execute tools listed in `src/agents/runtime/executor/active-tools.ts`.

Audited `src/.pi/extensions/` read-only. Family: `matrix`.

## Responsibility rendering

```text
legend:
  R = runtime hook
  T = agent tool
  UI = interactive Pi UI
  C = config/topology only
  . = no direct Pi API

| extension                        | kind | owns                                 | Pi/API surface                                                                                                                        |
| -------------------------------- | ---- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| session-lifecycle.ts             | R    | session-boundary refresh             | pi.on(session_start,before_agent_start,message_start); ctx.sessionManager                                                             |
| chrome.ts                        | R/UI | TUI title/footer chrome              | pi.on(session_start,model_select,thinking_level_select,turn_end); pi.getThinkingLevel; ctx.getContextUsage; ctx.ui.setFooter/setTitle |
| command-policy.ts                | R/UI | block Pi branch/tree flows           | pi.on(session_before_tree,session_before_fork); ctx.ui.notify                                                                         |
| operational-mode.ts              | R/T  | read-only tool posture + hard blocks | pi.registerTool(read,grep,find,ls); pi.getAllTools; pi.setActiveTools; pi.on(session_start,before_agent_start,tool_call,user_bash)    |
| prompting.ts                     | R    | Brunch prompt injection/tool posture | pi.on(before_agent_start); pi.getAllTools; pi.setActiveTools                                                                          |
| mention-autocomplete.ts          | R/UI | #graph mention prompt + autocomplete | pi.on(before_agent_start,session_start); ctx.ui.addAutocompleteProvider                                                               |
| alternatives.ts                  | T/UI | durable alternatives card transcript | pi.registerMessageRenderer; pi.registerTool(present_alternatives); pi.sendMessage                                                     |
| structured-exchange/index.ts     | T    | present/request exchange tool bundle | pi.registerTool(...)                                                                                                                  |
| structured-exchange/request-*.ts | T/UI | collect answer/choice/review         | defineTool; ctx.hasUI; ctx.ui.editor/select/input                                                                                     |
| structured-exchange/present-*.ts | T    | persist displayable offers           | defineTool; renderCall/renderResult                                                                                                   |
| graph/index.ts                   | T    | commit_graph/read_graph registrar    | pi.registerTool(commit_graph,read_graph)                                                                                              |
| graph/command-adapter.ts         | .    | Pi params -> CommandExecutor adapter | .                                                                                                                                     |
| graph/tool-schemas.ts            | .    | Pi-facing TypeBox schemas            | pi-ai Type/StringEnum only                                                                                                            |
| commands.ts                      | R/UI | /brunch:* commands + shortcut        | pi.registerCommand; pi.registerShortcut; ctx.ui.notify                                                                                |
| workspace-dialog.ts              | UI   | spec/session picker + switching      | ctx.waitForIdle; ctx.ui.custom/notify; ctx.switchSession; ctx.sessionManager.getSessionFile                                           |
| snapshot-cwd.ts                  | C    | future snapshot-tool concept note    | .                                                                                                                                     |
| auto-compaction-anchors.json     | C    | compaction preservation contract     | .                                                                                                                                     |
| subagents/config.json            | C    | future subagent config               | .                                                                                                                                     |
| present-candidates.ts            | C    | named but unregistered stub          | .                                                                                                                                     |
```

## Pi API caller index

```text
| Pi API / context API           | callers                                                                                                                                                         |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| pi.registerTool                | operational-mode.ts; alternatives.ts; structured-exchange/index.ts; graph/index.ts                                                                              |
| defineTool                     | structured-exchange/present-question.ts; present-options.ts; present-review-set.ts; request-answer.ts; request-choice.ts; request-choices.ts; request-review.ts |
| pi.registerMessageRenderer     | alternatives.ts                                                                                                                                                 |
| pi.sendMessage                 | alternatives.ts                                                                                                                                                 |
| pi.registerCommand             | commands.ts                                                                                                                                                     |
| pi.registerShortcut            | commands.ts                                                                                                                                                     |
| pi.on                          | session-lifecycle.ts; chrome.ts; command-policy.ts; operational-mode.ts; prompting.ts; mention-autocomplete.ts                                                  |
| pi.getAllTools                 | operational-mode.ts; prompting.ts                                                                                                                               |
| pi.setActiveTools              | operational-mode.ts; prompting.ts                                                                                                                               |
| pi.getThinkingLevel            | chrome.ts                                                                                                                                                       |
| ctx.sessionManager             | session-lifecycle.ts; chrome.ts; operational-mode.ts; workspace-dialog.ts                                                                                       |
| ctx.getContextUsage            | chrome.ts                                                                                                                                                       |
| ctx.waitForIdle                | workspace-dialog.ts                                                                                                                                             |
| ctx.switchSession              | workspace-dialog.ts                                                                                                                                             |
| ctx.ui.setFooter/setTitle      | chrome.ts                                                                                                                                                       |
| ctx.ui.notify                  | command-policy.ts; commands.ts; workspace-dialog.ts                                                                                                             |
| ctx.ui.custom                  | workspace-dialog.ts                                                                                                                                             |
| ctx.ui.addAutocompleteProvider | mention-autocomplete.ts                                                                                                                                         |
| ctx.hasUI                      | structured-exchange/request-answer.ts; request-choice.ts; request-choices.ts; request-review.ts                                                                 |
| ctx.ui.editor                  | structured-exchange/request-answer.ts; request-choices.ts                                                                                                       |
| ctx.ui.select                  | structured-exchange/request-choice.ts; request-review.ts                                                                                                        |
| ctx.ui.input                   | structured-exchange/request-choice.ts; request-review.ts                                                                                                        |
```

## Audit notes

- `graph/*` keeps the intended boundary: no `db/` imports found under `src/.pi/extensions/`; graph access is injected through `CommandExecutor` / snapshot readers.
- `structured-exchange` is the largest Pi tool surface. `present_*` tools produce durable transcript content; `request_*` tools are the only ones that require interactive UI.
- `commands.ts` owns registration; `workspace-dialog.ts` owns command implementation. That split is clean.
- `snapshot-cwd.ts`, `auto-compaction-anchors.json`, `subagents/config.json`, and `present-candidates.ts` are topology/config/stub surfaces, not active Pi registrations.
- `.DS_Store` is non-project noise in the extension directory.

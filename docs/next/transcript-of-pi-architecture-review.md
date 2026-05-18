---
title: Evaluate the architecture of `pi` packages
threadId: T-019e34d3-549a-73d5-a5d1-8cc9245b4ef0
created: 2026-05-17T07:25:25.530Z
agentMode: smart
---

# Evaluate the architecture of `pi` packages

## User

I'd like to potentially use the system-explainer skill, to explain the project we're currently in; however let's start with whatever your standard approach would be for this. I'd like to understand how the different packages here work together, specifically in the case of the `packages/coding-agent/`

## Assistant

**Tool Use:** `Bash`

```json
{
  "cmd": "ls packages/",
  "cwd": "/Users/lunelson/Clones/earendil-works/pi"
}
```

**Tool Use:** `Read`

```json
{
  "path": "/Users/lunelson/Clones/earendil-works/pi/README.md"
}
```

## User

**Tool Result:** `TU-033I9o5X0tFyvBwAB6GouA`

```
{
  "output": "agent\nai\ncoding-agent\ntui\nweb-ui\n",
  "exitCode": 0
}
```

**Tool Result:** `TU-033I9o5glINSmeRVl4yjCz`

```
{
  "content": "1: <p align=\"center\">\n2:   <a href=\"https://pi.dev\">\n3:     <img alt=\"pi logo\" src=\"https://pi.dev/logo-auto.svg\" width=\"128\">\n4:   </a>\n5: </p>\n6: <p align=\"center\">\n7:   <a href=\"https://discord.com/invite/3cU7Bz4UPx\"><img alt=\"Discord\" src=\"https://img.shields.io/badge/discord-community-5865F2?style=flat-square&logo=discord&logoColor=white\" /></a>\n8: </p>\n9: <p align=\"center\">\n10:   <a href=\"https://pi.dev\">pi.dev</a> domain graciously donated by\n11:   <br /><br />\n12:   <a href=\"https://exe.dev\"><img src=\"packages/coding-agent/docs/images/exy.png\" alt=\"Exy mascot\" width=\"48\" /><br />exe.dev</a>\n13: </p>\n14: \n15: > New issues and PRs from new contributors are auto-closed by default. Maintainers review auto-closed issues daily. See [CONTRIBUTING.md](CONTRIBUTING.md).\n16: \n17: ---\n18: \n19: # Pi Agent Harness Mono Repo\n20: \n21: This is the home of the pi agent harness project including our self extensible coding agent.\n22: \n23: * **[@earendil-works/pi-coding-agent](packages/coding-agent)**: Interactive coding agent CLI\n24: * **[@earendil-works/pi-agent-core](packages/agent)**: Agent runtime with tool calling and state management\n25: * **[@earendil-works/pi-ai](packages/ai)**: Unified multi-provider LLM API (OpenAI, Anthropic, Google, …)\n26: \n27: To learn more about pi:\n28: \n29: * [Visit pi.dev](https://pi.dev), the project website with demos\n30: * [Read the documentation](https://pi.dev/docs/latest), but you can also ask the agent to explain itself\n31: \n32: ## Share your OSS coding agent sessions\n33: \n34: If you use pi or other coding agents for open source work, please share your sessions.\n35: \n36: Public OSS session data helps improve coding agents with real-world tasks, tool use, failures, and fixes instead of toy benchmarks.\n37: \n38: For the full explanation, see [this post on X](https://x.com/badlogicgames/status/2037811643774652911).\n39: \n40: To publish sessions, use [`badlogic/pi-share-hf`](https://github.com/badlogic/pi-share-hf). Read its README.md for setup instructions. All you need is a Hugging Face account, the Hugging Face CLI, and `pi-share-hf`.\n41: \n42: You can also watch [this video](https://x.com/badlogicgames/status/2041151967695634619), where I show how I publish my `pi-mono` sessions.\n43: \n44: I regularly publish my own `pi-mono` work sessions here:\n45: \n46: - [badlogicgames/pi-mono on Hugging Face](https://huggingface.co/datasets/badlogicgames/pi-mono)\n47: \n48: ## All Packages\n49: \n50: | Package | Description |\n51: |---------|-------------|\n52: | **[@earendil-works/pi-ai](packages/ai)** | Unified multi-provider LLM API (OpenAI, Anthropic, Google, etc.) |\n53: | **[@earendil-works/pi-agent-core](packages/agent)** | Agent runtime with tool calling and state management |\n54: | **[@earendil-works/pi-coding-agent](packages/coding-agent)** | Interactive coding agent CLI |\n55: | **[@earendil-works/pi-tui](packages/tui)** | Terminal UI library with differential rendering |\n56: | **[@earendil-works/pi-web-ui](packages/web-ui)** | Web components for AI chat interfaces |\n57: \n58: For Slack/chat automation and workflows see [earendil-works/pi-chat](https://github.com/earendil-works/pi-chat).\n59: \n60: ## Contributing\n61: \n62: See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines and [AGENTS.md](AGENTS.md) for project-specific rules (for both humans and agents).\n63: \n64: ## Development\n65: \n66: ```bash\n67: npm install          # Install all dependencies\n68: npm run build        # Build all packages\n69: npm run check        # Lint, format, and type check\n70: ./test.sh            # Run tests (skips LLM-dependent tests without API keys)\n71: ./pi-test.sh         # Run pi from sources (can be run from any directory)\n72: ```\n73: \n74: > **Note:** `npm run check` requires `npm run build` to be run first. The web-ui package uses `tsc` which needs compiled `.d.ts` files from dependencies.\n75: \n76: ## License\n77: \n78: MIT",
  "absolutePath": "/Users/lunelson/Clones/earendil-works/pi/README.md"
}
```

## Assistant

**Tool Use:** `Bash`

```json
{
  "cmd": "for p in agent ai coding-agent tui web-ui; do echo \"=== $p ===\"; jq '{name, dependencies, peerDependencies, bin}' packages/$p/package.json 2>/dev/null; done",
  "cwd": "/Users/lunelson/Clones/earendil-works/pi"
}
```

**Tool Use:** `Bash`

```json
{
  "cmd": "ls packages/coding-agent/ && echo \"---src---\" && ls packages/coding-agent/src/",
  "cwd": "/Users/lunelson/Clones/earendil-works/pi"
}
```

**Tool Use:** `Bash`

```json
{
  "cmd": "ls packages/agent/src/ packages/ai/src/ packages/tui/src/ packages/web-ui/src/ 2>/dev/null",
  "cwd": "/Users/lunelson/Clones/earendil-works/pi"
}
```

## User

**Tool Result:** `TU-033I9oGrGDPHO5X5MneMux`

```
{
  "output": "=== agent ===\n{\n  \"name\": \"@earendil-works/pi-agent-core\",\n  \"dependencies\": {\n    \"@earendil-works/pi-ai\": \"^0.74.1\",\n    \"ignore\": \"^7.0.5\",\n    \"typebox\": \"^1.1.24\",\n    \"yaml\": \"^2.8.2\"\n  },\n  \"peerDependencies\": null,\n  \"bin\": null\n}\n=== ai ===\n{\n  \"name\": \"@earendil-works/pi-ai\",\n  \"dependencies\": {\n    \"@anthropic-ai/sdk\": \"^0.91.1\",\n    \"@aws-sdk/client-bedrock-runtime\": \"^3.1030.0\",\n    \"@google/genai\": \"^1.40.0\",\n    \"@mistralai/mistralai\": \"^2.2.0\",\n    \"http-proxy-agent\": \"^7.0.2\",\n    \"https-proxy-agent\": \"^7.0.6\",\n    \"openai\": \"6.26.0\",\n    \"partial-json\": \"^0.1.7\",\n    \"typebox\": \"^1.1.24\"\n  },\n  \"peerDependencies\": null,\n  \"bin\": {\n    \"pi-ai\": \"./dist/cli.js\"\n  }\n}\n=== coding-agent ===\n{\n  \"name\": \"@earendil-works/pi-coding-agent\",\n  \"dependencies\": {\n    \"@earendil-works/pi-agent-core\": \"^0.74.1\",\n    \"@earendil-works/pi-ai\": \"^0.74.1\",\n    \"@earendil-works/pi-tui\": \"^0.74.1\",\n    \"@silvia-odwyer/photon-node\": \"^0.3.4\",\n    \"chalk\": \"^5.5.0\",\n    \"diff\": \"^8.0.2\",\n    \"glob\": \"^13.0.1\",\n    \"highlight.js\": \"^10.7.3\",\n    \"hosted-git-info\": \"^9.0.2\",\n    \"ignore\": \"^7.0.5\",\n    \"jiti\": \"^2.7.0\",\n    \"minimatch\": \"^10.2.3\",\n    \"proper-lockfile\": \"^4.1.2\",\n    \"typebox\": \"^1.1.24\",\n    \"undici\": \"^7.19.1\",\n    \"yaml\": \"^2.8.2\"\n  },\n  \"peerDependencies\": null,\n  \"bin\": {\n    \"pi\": \"dist/cli.js\"\n  }\n}\n=== tui ===\n{\n  \"name\": \"@earendil-works/pi-tui\",\n  \"dependencies\": {\n    \"get-east-asian-width\": \"^1.3.0\",\n    \"marked\": \"^15.0.12\"\n  },\n  \"peerDependencies\": null,\n  \"bin\": null\n}\n=== web-ui ===\n{\n  \"name\": \"@earendil-works/pi-web-ui\",\n  \"dependencies\": {\n    \"@lmstudio/sdk\": \"^1.5.0\",\n    \"@earendil-works/pi-ai\": \"^0.74.1\",\n    \"@earendil-works/pi-tui\": \"^0.74.1\",\n    \"typebox\": \"^1.1.24\",\n    \"docx-preview\": \"^0.3.7\",\n    \"jszip\": \"^3.10.1\",\n    \"lucide\": \"^0.544.0\",\n    \"ollama\": \"^0.6.0\",\n    \"pdfjs-dist\": \"5.4.394\",\n    \"xlsx\": \"https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz\"\n  },\n  \"peerDependencies\": {\n    \"@mariozechner/mini-lit\": \"^0.2.0\",\n    \"lit\": \"^3.3.1\"\n  },\n  \"bin\": null\n}\n",
  "exitCode": 0
}
```

**Tool Result:** `TU-033I9oIAwy7dnaTXDoOtbG`

```
{
  "output": "CHANGELOG.md\ndocs\nexamples\npackage.json\nREADME.md\nscripts\nsrc\ntest\ntsconfig.build.json\ntsconfig.examples.json\nvitest.config.ts\n---src---\nbun\ncli\ncli.ts\nconfig.ts\ncore\nindex.ts\nmain.ts\nmigrations.ts\nmodes\npackage-manager-cli.ts\nutils\n",
  "exitCode": 0
}
```

**Tool Result:** `TU-033I9oJ24ipnSuqZnBr4ie`

```
{
  "output": "packages/agent/src/:\nagent-loop.ts\nagent.ts\nharness\nindex.ts\nnode.ts\nproxy.ts\ntypes.ts\n\npackages/ai/src/:\napi-registry.ts\nbedrock-provider.ts\ncli.ts\nenv-api-keys.ts\nimage-models.generated.ts\nimage-models.ts\nimages-api-registry.ts\nimages.ts\nindex.ts\nmodels.generated.ts\nmodels.ts\noauth.ts\nproviders\nsession-resources.ts\nstream.ts\ntypes.ts\nutils\n\npackages/tui/src/:\nautocomplete.ts\ncomponents\neditor-component.ts\nfuzzy.ts\nindex.ts\nkeybindings.ts\nkeys.ts\nkill-ring.ts\nstdin-buffer.ts\nterminal-image.ts\nterminal.ts\ntui.ts\nundo-stack.ts\nutils.ts\n\npackages/web-ui/src/:\napp.css\nChatPanel.ts\ncomponents\ndialogs\nindex.ts\nprompts\nstorage\ntools\nutils\n",
  "exitCode": 0
}
```

## Assistant

Good — dependency picture is clear. Let me look deeper into `coding-agent`'s internals before summarizing.

**Tool Use:** `Bash`

```json
{
  "cmd": "ls packages/coding-agent/src/core/ packages/coding-agent/src/cli/ packages/coding-agent/src/modes/ packages/coding-agent/src/utils/ packages/coding-agent/src/bun/ 2>/dev/null",
  "cwd": "/Users/lunelson/Clones/earendil-works/pi"
}
```

**Tool Use:** `Read`

```json
{
  "path": "/Users/lunelson/Clones/earendil-works/pi/packages/coding-agent/src/main.ts",
  "read_range": [
    1,
    100
  ]
}
```

**Tool Use:** `Read`

```json
{
  "path": "/Users/lunelson/Clones/earendil-works/pi/packages/coding-agent/src/index.ts"
}
```

**Tool Use:** `Read`

```json
{
  "path": "/Users/lunelson/Clones/earendil-works/pi/packages/agent/src/index.ts"
}
```

**Tool Use:** `Read`

```json
{
  "path": "/Users/lunelson/Clones/earendil-works/pi/packages/ai/src/index.ts"
}
```

## User

**Tool Result:** `TU-033I9oRiqj3Pm0mGqnf4zb`

```
{
  "output": "packages/coding-agent/src/bun/:\ncli.ts\nregister-bedrock.ts\nrestore-sandbox-env.ts\n\npackages/coding-agent/src/cli/:\nargs.ts\nconfig-selector.ts\nfile-processor.ts\ninitial-message.ts\nlist-models.ts\nsession-picker.ts\n\npackages/coding-agent/src/core/:\nagent-session-runtime.ts\nagent-session-services.ts\nagent-session.ts\nauth-guidance.ts\nauth-storage.ts\nbash-executor.ts\ncompaction\ndefaults.ts\ndiagnostics.ts\nevent-bus.ts\nexec.ts\nexport-html\nextensions\nfooter-data-provider.ts\nindex.ts\nkeybindings.ts\nmessages.ts\nmodel-registry.ts\nmodel-resolver.ts\noutput-guard.ts\npackage-manager.ts\nprompt-templates.ts\nprovider-display-names.ts\nresolve-config-value.ts\nresource-loader.ts\nsdk.ts\nsession-cwd.ts\nsession-manager.ts\nsettings-manager.ts\nskills.ts\nslash-commands.ts\nsource-info.ts\nsystem-prompt.ts\ntelemetry.ts\ntimings.ts\ntools\n\npackages/coding-agent/src/modes/:\nindex.ts\ninteractive\nprint-mode.ts\nrpc\n\npackages/coding-agent/src/utils/:\nansi.ts\nchangelog.ts\nchild-process.ts\nclipboard-image.ts\nclipboard-native.ts\nclipboard.ts\nexif-orientation.ts\nfrontmatter.ts\nfs-watch.ts\ngit.ts\nhighlight-js-lib-index.d.ts\nhtml.ts\nimage-convert.ts\nimage-resize.ts\nmime.ts\npaths.ts\nphoton.ts\npi-user-agent.ts\nshell.ts\nsleep.ts\nsyntax-highlight.ts\ntools-manager.ts\nversion-check.ts\n",
  "exitCode": 0
}
```

**Tool Result:** `TU-033I9oTXdJJYSjMA6XOilm`

```
{
  "content": "1: /**\n2:  * Main entry point for the coding agent CLI.\n3:  *\n4:  * This file handles CLI argument parsing and translates them into\n5:  * createAgentSession() options. The SDK does the heavy lifting.\n6:  */\n7: \n8: import { resolve } from \"node:path\";\n9: import { createInterface } from \"node:readline\";\n10: import { type ImageContent, modelsAreEqual } from \"@earendil-works/pi-ai\";\n11: import { ProcessTerminal, setKeybindings, TUI } from \"@earendil-works/pi-tui\";\n12: import chalk from \"chalk\";\n13: import { type Args, type Mode, parseArgs, printHelp } from \"./cli/args.js\";\n14: import { processFileArguments } from \"./cli/file-processor.js\";\n15: import { buildInitialMessage } from \"./cli/initial-message.js\";\n16: import { listModels } from \"./cli/list-models.js\";\n17: import { selectSession } from \"./cli/session-picker.js\";\n18: import { ENV_SESSION_DIR, expandTildePath, getAgentDir, VERSION } from \"./config.js\";\n19: import { type CreateAgentSessionRuntimeFactory, createAgentSessionRuntime } from \"./core/agent-session-runtime.js\";\n20: import {\n21: \ttype AgentSessionRuntimeDiagnostic,\n22: \tcreateAgentSessionFromServices,\n23: \tcreateAgentSessionServices,\n24: } from \"./core/agent-session-services.js\";\n25: import { formatNoModelsAvailableMessage } from \"./core/auth-guidance.js\";\n26: import { AuthStorage } from \"./core/auth-storage.js\";\n27: import { exportFromFile } from \"./core/export-html/index.js\";\n28: import type { ExtensionFactory } from \"./core/extensions/types.js\";\n29: import { KeybindingsManager } from \"./core/keybindings.js\";\n30: import type { ModelRegistry } from \"./core/model-registry.js\";\n31: import { resolveCliModel, resolveModelScope, type ScopedModel } from \"./core/model-resolver.js\";\n32: import { restoreStdout, takeOverStdout } from \"./core/output-guard.js\";\n33: import type { CreateAgentSessionOptions } from \"./core/sdk.js\";\n34: import {\n35: \tformatMissingSessionCwdPrompt,\n36: \tgetMissingSessionCwdIssue,\n37: \tMissingSessionCwdError,\n38: \ttype SessionCwdIssue,\n39: } from \"./core/session-cwd.js\";\n40: import { SessionManager } from \"./core/session-manager.js\";\n41: import { SettingsManager } from \"./core/settings-manager.js\";\n42: import { printTimings, resetTimings, time } from \"./core/timings.js\";\n43: import { runMigrations, showDeprecationWarnings } from \"./migrations.js\";\n44: import { InteractiveMode, runPrintMode, runRpcMode } from \"./modes/index.js\";\n45: import { ExtensionSelectorComponent } from \"./modes/interactive/components/extension-selector.js\";\n46: import { initTheme, stopThemeWatcher } from \"./modes/interactive/theme/theme.js\";\n47: import { handleConfigCommand, handlePackageCommand } from \"./package-manager-cli.js\";\n48: import { isLocalPath } from \"./utils/paths.js\";\n49: \n50: /**\n51:  * Read all content from piped stdin.\n52:  * Returns undefined if stdin is a TTY (interactive terminal).\n53:  */\n54: async function readPipedStdin(): Promise<string | undefined> {\n55: \t// If stdin is a TTY, we're running interactively - don't read stdin\n56: \tif (process.stdin.isTTY) {\n57: \t\treturn undefined;\n58: \t}\n59: \n60: \treturn new Promise((resolve) => {\n61: \t\tlet data = \"\";\n62: \t\tprocess.stdin.setEncoding(\"utf8\");\n63: \t\tprocess.stdin.on(\"data\", (chunk) => {\n64: \t\t\tdata += chunk;\n65: \t\t});\n66: \t\tprocess.stdin.on(\"end\", () => {\n67: \t\t\tresolve(data.trim() || undefined);\n68: \t\t});\n69: \t\tprocess.stdin.resume();\n70: \t});\n71: }\n72: \n73: function collectSettingsDiagnostics(\n74: \tsettingsManager: SettingsManager,\n75: \tcontext: string,\n76: ): AgentSessionRuntimeDiagnostic[] {\n77: \treturn settingsManager.drainErrors().map(({ scope, error }) => ({\n78: \t\ttype: \"warning\",\n79: \t\tmessage: `(${context}, ${scope} settings) ${error.message}`,\n80: \t}));\n81: }\n82: \n83: function reportDiagnostics(diagnostics: readonly AgentSessionRuntimeDiagnostic[]): void {\n84: \tfor (const diagnostic of diagnostics) {\n85: \t\tconst color = diagnostic.type === \"error\" ? chalk.red : diagnostic.type === \"warning\" ? chalk.yellow : chalk.dim;\n86: \t\tconst prefix = diagnostic.type === \"error\" ? \"Error: \" : diagnostic.type === \"warning\" ? \"Warning: \" : \"\";\n87: \t\tconsole.error(color(`${prefix}${diagnostic.message}`));\n88: \t}\n89: }\n90: \n91: function isTruthyEnvFlag(value: string | undefined): boolean {\n92: \tif (!value) return false;\n93: \treturn value === \"1\" || value.toLowerCase() === \"true\" || value.toLowerCase() === \"yes\";\n94: }\n95: \n96: type AppMode = \"interactive\" | \"print\" | \"json\" | \"rpc\";\n97: \n98: function resolveAppMode(parsed: Args, stdinIsTTY: boolean): AppMode {\n99: \tif (parsed.mode === \"rpc\") {\n100: \t\treturn \"rpc\";\n[... omitted lines 101 to 716 ...]",
  "absolutePath": "/Users/lunelson/Clones/earendil-works/pi/packages/coding-agent/src/main.ts"
}
```

**Tool Result:** `TU-033I9oWXiqdcJJVwyRrsdY`

```
{
  "content": "1: // Core session management\n2: \n3: // Config paths\n4: export { getAgentDir, VERSION } from \"./config.js\";\n5: export {\n6: \tAgentSession,\n7: \ttype AgentSessionConfig,\n8: \ttype AgentSessionEvent,\n9: \ttype AgentSessionEventListener,\n10: \ttype ModelCycleResult,\n11: \ttype ParsedSkillBlock,\n12: \ttype PromptOptions,\n13: \tparseSkillBlock,\n14: \ttype SessionStats,\n15: } from \"./core/agent-session.js\";\n16: // Auth and model registry\n17: export {\n18: \ttype ApiKeyCredential,\n19: \ttype AuthCredential,\n20: \ttype AuthStatus,\n21: \tAuthStorage,\n22: \ttype AuthStorageBackend,\n23: \tFileAuthStorageBackend,\n24: \tInMemoryAuthStorageBackend,\n25: \ttype OAuthCredential,\n26: } from \"./core/auth-storage.js\";\n27: // Compaction\n28: export {\n29: \ttype BranchPreparation,\n30: \ttype BranchSummaryResult,\n31: \ttype CollectEntriesResult,\n32: \ttype CompactionResult,\n33: \ttype CutPointResult,\n34: \tcalculateContextTokens,\n35: \tcollectEntriesForBranchSummary,\n36: \tcompact,\n37: \tDEFAULT_COMPACTION_SETTINGS,\n38: \testimateTokens,\n39: \ttype FileOperations,\n40: \tfindCutPoint,\n41: \tfindTurnStartIndex,\n42: \ttype GenerateBranchSummaryOptions,\n43: \tgenerateBranchSummary,\n44: \tgenerateSummary,\n45: \tgetLastAssistantUsage,\n46: \tprepareBranchEntries,\n47: \tserializeConversation,\n48: \tshouldCompact,\n49: } from \"./core/compaction/index.js\";\n50: export { createEventBus, type EventBus, type EventBusController } from \"./core/event-bus.js\";\n51: // Extension system\n52: export type {\n53: \tAgentEndEvent,\n54: \tAgentStartEvent,\n55: \tAgentToolResult,\n56: \tAgentToolUpdateCallback,\n57: \tAppKeybinding,\n58: \tAutocompleteProviderFactory,\n59: \tBashToolCallEvent,\n60: \tBeforeAgentStartEvent,\n61: \tBeforeAgentStartEventResult,\n62: \tBeforeProviderRequestEvent,\n63: \tBeforeProviderRequestEventResult,\n64: \tBuildSystemPromptOptions,\n65: \tCompactOptions,\n66: \tContextEvent,\n67: \tContextUsage,\n68: \tCustomToolCallEvent,\n69: \tEditToolCallEvent,\n70: \tExecOptions,\n71: \tExecResult,\n72: \tExtension,\n73: \tExtensionActions,\n74: \tExtensionAPI,\n75: \tExtensionCommandContext,\n76: \tExtensionCommandContextActions,\n77: \tExtensionContext,\n78: \tExtensionContextActions,\n79: \tExtensionError,\n80: \tExtensionEvent,\n81: \tExtensionFactory,\n82: \tExtensionFlag,\n83: \tExtensionHandler,\n84: \tExtensionRuntime,\n85: \tExtensionShortcut,\n86: \tExtensionUIContext,\n87: \tExtensionUIDialogOptions,\n88: \tExtensionWidgetOptions,\n89: \tFindToolCallEvent,\n90: \tGrepToolCallEvent,\n91: \tInputEvent,\n92: \tInputEventResult,\n93: \tInputSource,\n94: \tKeybindingsManager,\n95: \tLoadExtensionsResult,\n96: \tLsToolCallEvent,\n97: \tMessageRenderer,\n98: \tMessageRenderOptions,\n99: \tProviderConfig,\n100: \tProviderModelConfig,\n101: \tReadToolCallEvent,\n102: \tRegisteredCommand,\n103: \tRegisteredTool,\n104: \tResolvedCommand,\n105: \tSessionBeforeCompactEvent,\n106: \tSessionBeforeForkEvent,\n107: \tSessionBeforeSwitchEvent,\n108: \tSessionBeforeTreeEvent,\n109: \tSessionCompactEvent,\n110: \tSessionShutdownEvent,\n111: \tSessionStartEvent,\n112: \tSessionTreeEvent,\n113: \tSlashCommandInfo,\n114: \tSlashCommandSource,\n115: \tSourceInfo,\n116: \tTerminalInputHandler,\n117: \tToolCallEvent,\n118: \tToolCallEventResult,\n119: \tToolDefinition,\n120: \tToolExecutionMode,\n121: \tToolInfo,\n122: \tToolRenderResultOptions,\n123: \tToolResultEvent,\n124: \tTurnEndEvent,\n125: \tTurnStartEvent,\n126: \tUserBashEvent,\n127: \tUserBashEventResult,\n128: \tWidgetPlacement,\n129: \tWorkingIndicatorOptions,\n130: \tWriteToolCallEvent,\n131: } from \"./core/extensions/index.js\";\n132: export {\n133: \tcreateExtensionRuntime,\n134: \tdefineTool,\n135: \tdiscoverAndLoadExtensions,\n136: \tExtensionRunner,\n137: \tisBashToolResult,\n138: \tisEditToolResult,\n139: \tisFindToolResult,\n140: \tisGrepToolResult,\n141: \tisLsToolResult,\n142: \tisReadToolResult,\n143: \tisToolCallEventType,\n144: \tisWriteToolResult,\n145: \twrapRegisteredTool,\n146: \twrapRegisteredTools,\n147: } from \"./core/extensions/index.js\";\n148: // Footer data provider (git branch + extension statuses - data not otherwise available to extensions)\n149: export type { ReadonlyFooterDataProvider } from \"./core/footer-data-provider.js\";\n150: export { convertToLlm } from \"./core/messages.js\";\n151: export { ModelRegistry } from \"./core/model-registry.js\";\n152: export type {\n153: \tPackageManager,\n154: \tPathMetadata,\n155: \tProgressCallback,\n156: \tProgressEvent,\n157: \tResolvedPaths,\n158: \tResolvedResource,\n159: } from \"./core/package-manager.js\";\n160: export { DefaultPackageManager } from \"./core/package-manager.js\";\n161: export type { ResourceCollision, ResourceDiagnostic, ResourceLoader } from \"./core/resource-loader.js\";\n162: export { DefaultResourceLoader, loadProjectContextFiles } from \"./core/resource-loader.js\";\n163: // SDK for programmatic usage\n164: export {\n165: \tAgentSessionRuntime,\n166: \ttype AgentSessionRuntimeDiagnostic,\n167: \ttype AgentSessionServices,\n168: \ttype CreateAgentSessionFromServicesOptions,\n169: \ttype CreateAgentSessionOptions,\n170: \ttype CreateAgentSessionResult,\n171: \ttype CreateAgentSessionRuntimeFactory,\n172: \ttype CreateAgentSessionRuntimeResult,\n173: \ttype CreateAgentSessionServicesOptions,\n174: \t// Factory\n175: \tcreateAgentSession,\n176: \tcreateAgentSessionFromServices,\n177: \tcreateAgentSessionRuntime,\n178: \tcreateAgentSessionServices,\n179: \tcreateBashTool,\n180: \t// Tool factories (for custom cwd)\n181: \tcreateCodingTools,\n182: \tcreateEditTool,\n183: \tcreateFindTool,\n184: \tcreateGrepTool,\n185: \tcreateLsTool,\n186: \tcreateReadOnlyTools,\n187: \tcreateReadTool,\n188: \tcreateWriteTool,\n189: \ttype PromptTemplate,\n190: } from \"./core/sdk.js\";\n191: export {\n192: \ttype BranchSummaryEntry,\n193: \tbuildSessionContext,\n194: \ttype CompactionEntry,\n195: \tCURRENT_SESSION_VERSION,\n196: \ttype CustomEntry,\n197: \ttype CustomMessageEntry,\n198: \ttype FileEntry,\n199: \tgetLatestCompactionEntry,\n200: \ttype ModelChangeEntry,\n201: \tmigrateSessionEntries,\n202: \ttype NewSessionOptions,\n203: \tparseSessionEntries,\n204: \ttype SessionContext,\n205: \ttype SessionEntry,\n206: \ttype SessionEntryBase,\n207: \ttype SessionHeader,\n208: \ttype SessionInfo,\n209: \ttype SessionInfoEntry,\n210: \tSessionManager,\n211: \ttype SessionMessageEntry,\n212: \ttype ThinkingLevelChangeEntry,\n213: } from \"./core/session-manager.js\";\n214: export {\n215: \ttype CompactionSettings,\n216: \ttype ImageSettings,\n217: \ttype PackageSource,\n218: \ttype RetrySettings,\n219: \tSettingsManager,\n220: } from \"./core/settings-manager.js\";\n221: // Skills\n222: export {\n223: \tformatSkillsForPrompt,\n224: \ttype LoadSkillsFromDirOptions,\n225: \ttype LoadSkillsResult,\n226: \tloadSkills,\n227: \tloadSkillsFromDir,\n228: \ttype Skill,\n229: \ttype SkillFrontmatter,\n230: } from \"./core/skills.js\";\n231: export { createSyntheticSourceInfo } from \"./core/source-info.js\";\n232: // Tools\n233: export {\n234: \ttype BashOperations,\n235: \ttype BashSpawnContext,\n236: \ttype BashSpawnHook,\n237: \ttype BashToolDetails,\n238: \ttype BashToolInput,\n239: \ttype BashToolOptions,\n240: \tcreateBashToolDefinition,\n241: \tcreateEditToolDefinition,\n242: \tcreateFindToolDefinition,\n243: \tcreateGrepToolDefinition,\n244: \tcreateLocalBashOperations,\n245: \tcreateLsToolDefinition,\n246: \tcreateReadToolDefinition,\n247: \tcreateWriteToolDefinition,\n248: \tDEFAULT_MAX_BYTES,\n249: \tDEFAULT_MAX_LINES,\n250: \ttype EditOperations,\n251: \ttype EditToolDetails,\n252: \ttype EditToolInput,\n253: \ttype EditToolOptions,\n254: \ttype FindOperations,\n255: \ttype FindToolDetails,\n256: \ttype FindToolInput,\n257: \ttype FindToolOptions,\n258: \tformatSize,\n259: \ttype GrepOperations,\n260: \ttype GrepToolDetails,\n261: \ttype GrepToolInput,\n262: \ttype GrepToolOptions,\n263: \ttype LsOperations,\n264: \ttype LsToolDetails,\n265: \ttype LsToolInput,\n266: \ttype LsToolOptions,\n267: \ttype ReadOperations,\n268: \ttype ReadToolDetails,\n269: \ttype ReadToolInput,\n270: \ttype ReadToolOptions,\n271: \ttype ToolsOptions,\n272: \ttype TruncationOptions,\n273: \ttype TruncationResult,\n274: \ttruncateHead,\n275: \ttruncateLine,\n276: \ttruncateTail,\n277: \ttype WriteOperations,\n278: \ttype WriteToolInput,\n279: \ttype WriteToolOptions,\n280: \twithFileMutationQueue,\n281: } from \"./core/tools/index.js\";\n282: // Main entry point\n283: export { type MainOptions, main } from \"./main.js\";\n284: // Run modes for programmatic SDK usage\n285: export {\n286: \tInteractiveMode,\n287: \ttype InteractiveModeOptions,\n288: \ttype ModelInfo,\n289: \ttype PrintModeOptions,\n290: \tRpcClient,\n291: \ttype RpcClientOptions,\n292: \ttype RpcCommand,\n293: \ttype RpcEventListener,\n294: \ttype RpcResponse,\n295: \ttype RpcSessionState,\n296: \trunPrintMode,\n297: \trunRpcMode,\n298: } from \"./modes/index.js\";\n299: // UI components for extensions\n300: export {\n301: \tArminComponent,\n302: \tAssistantMessageComponent,\n303: \tBashExecutionComponent,\n304: \tBorderedLoader,\n305: \tBranchSummaryMessageComponent,\n306: \tCompactionSummaryMessageComponent,\n307: \tCustomEditor,\n308: \tCustomMessageComponent,\n309: \tDynamicBorder,\n310: \tExtensionEditorComponent,\n311: \tExtensionInputComponent,\n312: \tExtensionSelectorComponent,\n313: \tFooterComponent,\n314: \tkeyHint,\n315: \tkeyText,\n316: \tLoginDialogComponent,\n317: \tModelSelectorComponent,\n318: \tOAuthSelectorComponent,\n319: \ttype RenderDiffOptions,\n320: \trawKeyHint,\n321: \trenderDiff,\n322: \tSessionSelectorComponent,\n323: \ttype SettingsCallbacks,\n324: \ttype SettingsConfig,\n325: \tSettingsSelectorComponent,\n326: \tShowImagesSelectorComponent,\n327: \tSkillInvocationMessageComponent,\n328: \tThemeSelectorComponent,\n329: \tThinkingSelectorComponent,\n330: \tToolExecutionComponent,\n331: \ttype ToolExecutionOptions,\n332: \tTreeSelectorComponent,\n333: \ttruncateToVisualLines,\n334: \tUserMessageComponent,\n335: \tUserMessageSelectorComponent,\n336: \ttype VisualTruncateResult,\n337: } from \"./modes/interactive/components/index.js\";\n338: // Theme utilities for custom tools and extensions\n339: export {\n340: \tgetLanguageFromPath,\n341: \tgetMarkdownTheme,\n342: \tgetSelectListTheme,\n343: \tgetSettingsListTheme,\n344: \thighlightCode,\n345: \tinitTheme,\n346: \tTheme,\n347: \ttype ThemeColor,\n348: } from \"./modes/interactive/theme/theme.js\";\n349: // Clipboard utilities\n350: export { copyToClipboard } from \"./utils/clipboard.js\";\n351: export { parseFrontmatter, stripFrontmatter } from \"./utils/frontmatter.js\";\n352: // Shell utilities\n353: export { getShellConfig } from \"./utils/shell.js\";",
  "absolutePath": "/Users/lunelson/Clones/earendil-works/pi/packages/coding-agent/src/index.ts"
}
```

**Tool Result:** `TU-033I9oWmRPn80xKv4AIfXG`

```
{
  "content": "1: // Core Agent\n2: export * from \"./agent.js\";\n3: // Loop functions\n4: export * from \"./agent-loop.js\";\n5: export * from \"./harness/agent-harness.js\";\n6: export {\n7: \ttype BranchPreparation,\n8: \ttype BranchSummaryDetails,\n9: \ttype CollectEntriesResult,\n10: \tcollectEntriesForBranchSummary,\n11: \tgenerateBranchSummary,\n12: \tprepareBranchEntries,\n13: } from \"./harness/compaction/branch-summarization.js\";\n14: export {\n15: \tcalculateContextTokens,\n16: \tcompact,\n17: \tDEFAULT_COMPACTION_SETTINGS,\n18: \testimateContextTokens,\n19: \testimateTokens,\n20: \tfindCutPoint,\n21: \tfindTurnStartIndex,\n22: \tgenerateSummary,\n23: \tgetLastAssistantUsage,\n24: \tprepareCompaction,\n25: \tserializeConversation,\n26: \tshouldCompact,\n27: } from \"./harness/compaction/compaction.js\";\n28: export * from \"./harness/messages.js\";\n29: export * from \"./harness/prompt-templates.js\";\n30: export * from \"./harness/session/jsonl-repo.js\";\n31: export * from \"./harness/session/memory-repo.js\";\n32: export * from \"./harness/session/repo-utils.js\";\n33: export * from \"./harness/session/session.js\";\n34: export { uuidv7 } from \"./harness/session/uuid.js\";\n35: export * from \"./harness/skills.js\";\n36: export * from \"./harness/system-prompt.js\";\n37: // Harness\n38: export * from \"./harness/types.js\";\n39: export * from \"./harness/utils/shell-output.js\";\n40: export * from \"./harness/utils/truncate.js\";\n41: // Proxy utilities\n42: export * from \"./proxy.js\";\n43: // Types\n44: export * from \"./types.js\";",
  "absolutePath": "/Users/lunelson/Clones/earendil-works/pi/packages/agent/src/index.ts"
}
```

**Tool Result:** `TU-033I9oWsaEWBSvfNBEqK9w`

```
{
  "content": "1: export type { Static, TSchema } from \"typebox\";\n2: export { Type } from \"typebox\";\n3: \n4: export * from \"./api-registry.js\";\n5: export * from \"./env-api-keys.js\";\n6: export * from \"./image-models.js\";\n7: export * from \"./images.js\";\n8: export * from \"./images-api-registry.js\";\n9: export * from \"./models.js\";\n10: export type { BedrockOptions, BedrockThinkingDisplay } from \"./providers/amazon-bedrock.js\";\n11: export type { AnthropicEffort, AnthropicOptions, AnthropicThinkingDisplay } from \"./providers/anthropic.js\";\n12: export type { AzureOpenAIResponsesOptions } from \"./providers/azure-openai-responses.js\";\n13: export * from \"./providers/faux.js\";\n14: export type { GoogleOptions } from \"./providers/google.js\";\n15: export type { GoogleThinkingLevel } from \"./providers/google-shared.js\";\n16: export type { GoogleVertexOptions } from \"./providers/google-vertex.js\";\n17: export * from \"./providers/images/register-builtins.js\";\n18: export type { MistralOptions } from \"./providers/mistral.js\";\n19: export type {\n20: \tOpenAICodexResponsesOptions,\n21: \tOpenAICodexWebSocketDebugStats,\n22: } from \"./providers/openai-codex-responses.js\";\n23: export type { OpenAICompletionsOptions } from \"./providers/openai-completions.js\";\n24: export type { OpenAIResponsesOptions } from \"./providers/openai-responses.js\";\n25: export * from \"./providers/register-builtins.js\";\n26: export * from \"./session-resources.js\";\n27: export * from \"./stream.js\";\n28: export * from \"./types.js\";\n29: export * from \"./utils/diagnostics.js\";\n30: export * from \"./utils/event-stream.js\";\n31: export * from \"./utils/json-parse.js\";\n32: export type {\n33: \tOAuthAuthInfo,\n34: \tOAuthCredentials,\n35: \tOAuthLoginCallbacks,\n36: \tOAuthPrompt,\n37: \tOAuthProvider,\n38: \tOAuthProviderId,\n39: \tOAuthProviderInfo,\n40: \tOAuthProviderInterface,\n41: \tOAuthSelectOption,\n42: \tOAuthSelectPrompt,\n43: } from \"./utils/oauth/types.js\";\n44: export * from \"./utils/overflow.js\";\n45: export * from \"./utils/typebox-helpers.js\";\n46: export * from \"./utils/validation.js\";",
  "absolutePath": "/Users/lunelson/Clones/earendil-works/pi/packages/ai/src/index.ts"
}
```

## Assistant

I've got enough to give you a grounded overview. Here is my standard answer before we consider applying any explainer skill.

### Package dependency graph

```diagram
                    ╭───────────╮
                    │  pi-ai    │  ← provider SDKs (OpenAI, Anthropic,
                    │ (packages │     Google, Bedrock, Mistral, …),
                    │   /ai)    │     unified streaming, models registry
                    ╰─────┬─────╯
                          │
                          ▼
                 ╭────────────────╮
                 │ pi-agent-core  │  ← agent loop, tool calling,
                 │ (packages/     │     session/JSONL repo, compaction,
                 │   agent)       │     system prompts, skills loader
                 ╰───┬────────────╯
                     │
        ┌────────────┴───────────────────────┐
        ▼                                    ▼
╭────────────────────╮              ╭────────────────╮
│ pi-coding-agent    │              │   pi-web-ui    │
│ (packages/         │              │ (uses pi-ai +  │
│   coding-agent)    │              │  pi-tui for    │
│   = `pi` CLI       │              │  web chat UI)  │
╰───┬────────────────╯              ╰────────────────╯
    │ depends on
    ▼
╭────────────────────╮
│      pi-tui        │  ← terminal renderer, editor, keybindings,
│ (packages/tui)     │     diff rendering, image-in-terminal
╰────────────────────╯
```

- **pi-ai** is the leaf: it normalizes every provider into one streaming API + a generated `models.ts`. No internal deps.
- **pi-agent-core** sits on top of pi-ai and adds the *agent runtime* (the loop, tool invocation, conversation state, JSONL session repo, compaction, skill loading, prompt assembly).
- **pi-tui** is independent — pure terminal rendering primitives (no AI/agent knowledge).
- **pi-coding-agent** is the product. It composes `pi-agent-core` + `pi-ai` + `pi-tui` into the `pi` CLI binary and the SDK (`createAgentSession`).
- **pi-web-ui** is the parallel web frontend — it reuses `pi-ai` (for provider streaming in the browser) and `pi-tui` (some shared utilities) but does **not** depend on `pi-agent-core` or `pi-coding-agent`.

### Internal shape of `packages/coding-agent/`

The package is organized as **CLI shell → core runtime → modes → utilities**:

```diagram
src/
├── cli.ts, main.ts          ← entry: arg parsing, mode dispatch
├── cli/                     ← arg parsing, file/image processing,
│                              model & session pickers
├── core/                    ← the engine
│   ├── sdk.ts               ← createAgentSession() — the public API
│   ├── agent-session.ts     ← session object: events, prompts, model cycling
│   ├── agent-session-runtime.ts
│   ├── agent-session-services.ts   ← wires services (auth, registry, settings, …)
│   ├── session-manager.ts          ← JSONL session persistence + migration
│   ├── settings-manager.ts         ← layered settings (project/user/system)
│   ├── auth-storage.ts             ← API keys + OAuth credentials
│   ├── model-registry.ts / model-resolver.ts
│   ├── tools/                      ← bash, read, write, edit, grep, find, ls
│   ├── compaction/                 ← context-window summarization
│   ├── extensions/                 ← extension/plugin host
│   ├── skills.ts, slash-commands.ts
│   ├── system-prompt.ts, prompt-templates.ts
│   ├── export-html/                ← HTML transcript export
│   └── event-bus.ts, output-guard.ts, telemetry.ts
├── modes/                   ← how the session is driven
│   ├── interactive/         ← full TUI app (components, theme)
│   ├── print-mode.ts        ← one-shot non-interactive ("pi 'do X'")
│   └── rpc/                 ← RPC server/client for embedding
├── bun/                     ← Bun-specific shims
├── utils/                   ← clipboard, git, shell, images, paths…
└── migrations.ts            ← session schema migrations
```

**Key boundaries:**

1. **`core/sdk.ts`** is the *only* surface intended for programmatic embedders. It exposes `createAgentSession`, `createAgentSessionRuntime`, `createAgentSessionServices`, and tool factories. The CLI itself is just one consumer of this SDK.
2. **`core/agent-session-services.ts`** is the wiring layer: it constructs `AuthStorage`, `ModelRegistry`, `SettingsManager`, `SessionManager`, `KeybindingsManager`, `ResourceLoader`, `PackageManager`, `ExtensionRunner`, then passes them to a session.
3. **`core/agent-session.ts`** is the session object — it owns the conversation state and emits events (`turn:start`, `tool:call`, `tool:result`, `agent:end`, etc.) that the modes subscribe to.
4. **`modes/`** chooses how the session is presented: interactive TUI, single-shot print, or RPC. All three are thin presentations over the same session API.
5. **`core/extensions/`** is the plugin system — extensions can add tools, slash commands, keybindings, UI components, and hook events without modifying the core.
6. **`core/tools/`** holds the built-in coding tools (bash/read/write/edit/grep/find/ls). Each has both a `*ToolDefinition` (for the agent) and a factory for custom CWDs.

### Where each dependency package is used inside coding-agent

- `pi-ai` — providers, model lookup, streaming primitives, `ImageContent`, OAuth types.
- `pi-agent-core` — re-exported pieces of session, compaction, prompt-template, skills loader, harness types (coding-agent re-wraps many of these with its own coding-specific defaults).
- `pi-tui` — `TUI`, `ProcessTerminal`, `setKeybindings`, components for the interactive mode.

### Suggested next step

Given the size (the `index.ts` alone exports ~150 symbols), a good explainer would have these tabs:

1. **Overview** — package graph above
2. **Lifecycle** — request → session → agent loop → tool call → result → event → render
3. **Modes** — interactive vs print vs RPC
4. **Tools** — built-ins + extension tools
5. **Session & compaction** — JSONL repo, cut points, summaries
6. **Auth & models** — auth storage, model registry, provider resolution
7. **Extensions** — hook points and capability surface
8. **SDK** — embedding the agent programmatically

Want me to (a) drill into one of these areas in detail, (b) load and run the `interactive-system-explainer` skill to produce the HTML artifact, or (c) sketch the scenario data first so the simulator has something concrete to show?

## User

let me circle this a little differently: where in this arrangement would you draw "server", "client", and "persistence" (DB, files) boundaries? And speculate: if the "server" side of this was tasked with maintaining more than just the session, but also some kind of structured data that ostensibly the user and agent would both operate on, where would that live and how would the tools for modifying it be exposed? how would the authority be modelled?

## Assistant

Good question. Let me ground this in what's actually in the code, then speculate.

### Current boundaries (grounded)

```diagram
  ╭─────────────── CLIENT (presentation) ────────────────╮
  │  modes/interactive/   (TUI app)                      │
  │  modes/print-mode     (one-shot stdout)              │
  │  modes/rpc/           (JSON-RPC over stdio)          │
  │     ▲                  └─ RpcClient is already       │
  │     │                     exported — a client/server │
  │     │                     split exists in-process    │
  ╰─────┼────────────────────────────────────────────────╯
        │ events + commands  (event-bus.ts)
  ╭─────┼─── "SERVER" (in-process today) ────────────────╮
  │  core/sdk.ts                 createAgentSession()    │
  │  core/agent-session.ts       conversation owner      │
  │  core/agent-session-runtime  loop driver             │
  │  core/agent-session-services service container       │
  │     │  injects ↓                                     │
  │  core/tools/*                bash/read/write/…       │
  │  core/extensions/*           plugin host             │
  │  core/compaction/*           context management      │
  │  pi-agent-core               agent loop + harness    │
  │  pi-ai                       LLM provider client     │
  ╰─────┼────────────────────────────────────────────────╯
        │ via injected services
  ╭─────▼────── PERSISTENCE (all file-based) ────────────╮
  │  SessionManager       JSONL session log per session  │
  │  AuthStorage          auth.json (pluggable backend!) │
  │  SettingsManager      layered JSON: system/user/proj │
  │  PackageManager       installed extensions on disk   │
  │  ResourceLoader       project context files          │
  │  + the working tree    (the "data" the tools edit)   │
  ╰──────────────────────────────────────────────────────╯
```

Three observations that matter for the speculation:

1. **The server/client split is already latent.** `modes/rpc/` plus `RpcClient`/`runRpcMode` exports show the team has already isolated "drive a session" from "render a session." Today both halves live in the same process; promoting to a network boundary is mostly a transport swap.
2. **Services are injected, not hard-coded.** `AuthStorage` ships with `FileAuthStorageBackend` *and* `InMemoryAuthStorageBackend` — the contract is explicitly pluggable. `agent-session-services.ts` is a DI container. That means each persistence concern can be swapped for a remote/DB backend without rewriting the runtime.
3. **The current "structured data" the agent operates on is the file system.** Tools = file system verbs (`read`, `write`, `edit`, `grep`, `find`, `ls`, `bash`). The whole tool vocabulary assumes "the user and the agent share a working tree, OS arbitrates access." That's the implicit authority model today.

### Speculation: adding shared structured data

Suppose the server now owns a structured store (records, not files) that both the user (via web-ui) and the agent (via tools) mutate.

#### Where it lives in the package graph

The natural shape, given the existing seams:

```diagram
  ╭───────────────────╮       ╭───────────────────────╮
  │   pi-web-ui       │       │  pi-coding-agent      │
  │  (user client)    │       │  (agent client)       │
  │   reads/writes    │       │  exposes records as   │
  │   records via UI  │       │  tools to the LLM     │
  ╰────────┬──────────╯       ╰──────────┬────────────╯
           │                              │
           │  same protocol               │  same protocol
           │  (extend rpc/ or HTTP)       │
           ▼                              ▼
        ╭──────────────────────────────────────╮
        │   NEW: pi-record-server              │
        │   - record schemas (typebox)         │
        │   - command/event log                │
        │   - projections / read models        │
        │   - subscription stream              │
        │   - authority gate                   │
        ╰──────────────────┬───────────────────╯
                           │
                           ▼
                   ╭──────────────╮
                   │  DB / event  │
                   │  log         │
                   ╰──────────────╯
```

A new package — call it `pi-record-server` — would own the structured data. It would be the *first* package in the repo that needs a real DB (SQLite at minimum; the existing JSONL pattern doesn't survive multi-writer concurrency). It would emit a stream of events so both clients stay in sync; the web-ui already speaks event streams, and the agent's `event-bus.ts` is the same pattern.

The agent's *access* to records would be a new tool family inside `coding-agent` — e.g. `record_query`, `record_get`, `record_create`, `record_update`, `record_subscribe` — registered the same way `createBashTool` etc. are today. Because tools are already `ToolDefinition` objects with input schemas, you'd just point them at the server's RPC instead of `fs.*`. The system prompt would describe the record schema the same way it currently describes the file tree.

#### How tools would be exposed

Two routes, both supported by the existing extension system:

- **Built-in route:** add `core/tools/record-*.ts` alongside the file tools, with factory functions like `createRecordQueryTool({ client, schema })`. They'd participate in the same `wrapRegisteredTool` machinery, the same approval flow, the same diff rendering (with a "record diff" component instead of file diff).
- **Extension route:** ship as an extension package (`pi-record-tools`) that registers tools via `ExtensionRuntime`. This is probably preferable — the extensions system already exists for exactly this "add a tool family without modifying core" use case, and the tools are domain-specific.

#### How authority would be modeled

This is the genuinely hard part, and the existing code gives you three primitives to compose:

| Existing primitive | What it gives you for records |
|---|---|
| `ToolExecutionMode` (read-only / mutating / dangerous) | Per-tool risk classification, surfaces approval prompts |
| `AuthStorage` (per-credential, pluggable) | Agent *runs as* a user identity, not as "the agent" |
| `BeforeAgentStartEvent` / `BeforeProviderRequestEvent` hooks | Policy gates that can deny or transform a request |
| `event-bus` + JSONL append-only log | Existing event-sourcing muscle memory |

A reasonable model:

1. **The agent acts as a delegate of an authenticated user.** `AuthStorage` already carries that identity; reuse it as the actor on every record command. Every event is attributed: `actor: { kind: "agent", on_behalf_of: <user> }` vs `actor: { kind: "user", id: <user> }`. This makes audit trivially recoverable.

2. **Authority is field-level, not record-level.** Schemas (typebox is already the project's schema lib) carry `@authority` annotations: e.g. `status` is agent-writable, `approved_by` is user-only, `notes` is either. The server enforces this on every command, regardless of which client issued it.

3. **Three tiers of agent action, mirroring `ToolExecutionMode`:**
   - **Autonomous:** record reads, schema-allowed writes to agent-owned fields. No prompt.
   - **Requires confirmation:** writes to shared fields, deletions. Uses the existing tool-approval UI flow (same surface as a dangerous bash command).
   - **Forbidden / human-only:** writes the schema marks user-only. Tool returns a structured "needs human" result the agent can route to the user via a slash command or web-ui notification.

4. **Commands, not CRUD.** Tools should expose verbs that match domain transitions (`approve_invoice`, `assign_owner`) rather than `update(table, id, patch)`. This is what makes authority *checkable* — the gate knows what's being attempted, not just which bytes are changing. (This is exactly the `stateful-systems` skill's discipline, and it would fit this slice cleanly.)

5. **Optimistic concurrency on every write.** Each record carries a version; the agent's tool input must echo the version it read. The server rejects stale writes and returns the current state; the agent re-reads and decides. This protects against the user editing in the web-ui while the agent is mid-turn.

6. **Subscription = the agent's "watch" tool.** Long-running sessions can subscribe to record changes; injected as a system message ("user changed status to X") so the agent's plan stays consistent with reality.

#### What this implies for the repo

- New package: `pi-record-server` (server + schema definitions + client lib).
- New package or extension: record tools for `coding-agent`.
- `web-ui` grows a record browser/editor that talks the same protocol.
- `auth-storage` becomes the cross-cutting identity, not just an LLM-credential bag.
- The `rpc/` mode generalizes into "the agent's connection to the server" — local stdio for single-user use, network for shared.
- JSONL session files stay; record state moves to SQLite/Postgres.

If you want, I can sketch this as a concrete `stateful-systems` design packet (states, commands, events, invariants) — that would be the natural feeder into an `interactive-system-explainer` artifact, since the explainer skill explicitly says "if lifecycle behavior is unclear, model it first."

## User

I'd like to keep talking about how the other parts work, and how this would work with them: right now the four possible ways of interacting with the system seem to be TUI, GUI (web), print-mode, and JSON-RPC over stdio; in the scenario you outlined above, would all functionalities be exposable through all of these forms?

## Assistant

Good framing, but one correction up front: today **web-ui does not actually depend on coding-agent** — it imports `pi-ai` and `pi-tui` only. So at the moment it's a parallel browser chat product, not a frontend over the agent. To make the four-mode story true, web-ui would need to become an RPC client of the agent runtime (the existing `modes/rpc/` is the natural transport — same JSON-RPC protocol, just websocket instead of stdio).

Given that, the four modes really split along **two axes**, not one:

```diagram
                  Human present in the loop?
                  ┌────────────────┬────────────────┐
                  │      yes       │       no       │
  ┌───────────────┼────────────────┼────────────────┤
  │ rich          │     web        │  RPC (driven   │
  │ rendering     │                │  by another    │
  │               │                │  program)      │
  ├───────────────┼────────────────┼────────────────┤
  │ stream/text   │     TUI        │    print       │
  │ only          │                │                │
  └───────────────┴────────────────┴────────────────┘
```

That collapses the question. There are really two pairs:

- **Human-interactive: TUI + web.** Both must reach full feature parity for the record system — just different presentations of the same session.
- **Headless: print + RPC.** Neither has a live human; either the run is fully autonomous, or a driving program substitutes for one.

### Which capabilities cross all four

| Capability | TUI | Web | Print | RPC |
|---|---|---|---|---|
| Read records / queries | ✓ | ✓ | ✓ (dump JSON) | ✓ |
| Write agent-owned fields | ✓ | ✓ | ✓ | ✓ |
| Subscribe to live updates | ✓ | ✓ | n/a (one-shot) | ✓ (event stream) |
| Tool execution attribution | ✓ | ✓ | ✓ | ✓ |
| Confirmation-gated writes | ✓ (dialog) | ✓ (modal) | needs `--auto-approve` policy | ✓ (driver decides) |
| User-only writes | ✓ (suspend agent, prompt user) | ✓ (native UI) | **cannot service** | ✓ only if driver is a UI |
| Direct user editing of records (no agent) | awkward | natural | n/a | n/a |
| Multi-user simultaneous | poor | natural | n/a | depends on driver |

So the answer is **no, not symmetrically** — but the asymmetry follows from the medium, not from the architecture. Three categories:

#### 1. Capabilities that genuinely span all four
The *agent's* operations on records: query, read, agent-scoped writes, subscribe. These are RPC verbs; every mode is just a different presentation of the same call. The tool definitions in `coding-agent` don't change — only what surrounds them does.

#### 2. Capabilities that need a human-interactive mode
Anything in the authority model that says "user-only" or "needs confirmation." Print mode literally cannot service these — there's no one to ask. Two reasonable fallbacks:
- **Refuse**: tool returns `{ status: "requires_human", reason: …}`, the agent records it as a blocker and exits with a non-zero code.
- **Auto-policy**: `--auto-approve=safe` etc., as a deliberate operator choice. This is already the pattern coding-agent uses for `bash` and `edit` in print mode.

RPC sits in the middle: confirmation-gated calls become events the driver receives, and the driver either has its own UI (web, another TUI) or its own policy. The existing `event-bus` machinery already models this — `BeforeAgentStartEvent` and tool-call events can be intercepted and answered.

#### 3. Capabilities that are only natural in one mode
- **Bulk record browsing/editing without invoking the agent** is really a web-ui thing. You could build a TUI record browser (the existing selector components could be repurposed), but the web is the right surface for tables, forms, and multi-user editing.
- **Pure pipeline use** ("read these record IDs, summarize, exit") is the print mode's whole reason to exist.
- **Embedding in another app** is RPC's reason to exist.

### The architectural consequence

If you want symmetry where it's achievable, the design discipline is:

1. **All record operations are commands defined once**, as schemas (typebox fits), executed by the server. Tools in `coding-agent` and UI affordances in `web-ui` both compile down to the same command set. No mode has private capabilities.
2. **The "needs human" result is a first-class outcome**, not an exception. Every tool can return it; every mode has a defined behavior for it (UI: prompt; print: fail with structured reason; RPC: emit event).
3. **The event stream is the synchronization substrate.** The agent subscribes the same way the web-ui subscribes. Print mode subscribes only briefly. RPC forwards events to the driver. Today this is `event-bus.ts` in-process; promoting it to a network stream is the main work.
4. **Web-ui becomes a peer of TUI**, not a separate product — both implemented as clients of the same RPC protocol. The current `modes/rpc/` types (`RpcCommand`, `RpcResponse`, `RpcEventListener`) are already shaped like this.

So the cleaner statement is: **all functionality is exposable through the human-interactive modes; the headless modes expose everything that doesn't require a live human, plus a structured "needs human" outcome that headless drivers can route however they want.**

Want to look at the actual `modes/rpc/` shape next, to see how close it already is to being that universal protocol?

## User

I'd like to understand more about how the web-ui currently works, as an aside, first: I'm surprised that it does not involve the same agent core; what is the use-case for it?

## Assistant

**Tool Use:** `Read`

```json
{
  "path": "/Users/lunelson/Clones/earendil-works/pi/packages/web-ui/package.json"
}
```

**Tool Use:** `Bash`

```json
{
  "cmd": "ls packages/web-ui/ && echo \"---src---\" && ls packages/web-ui/src/ && echo \"---components---\" && ls packages/web-ui/src/components/ 2>/dev/null && echo \"---tools---\" && ls packages/web-ui/src/tools/ 2>/dev/null && echo \"---storage---\" && ls packages/web-ui/src/storage/ 2>/dev/null",
  "cwd": "/Users/lunelson/Clones/earendil-works/pi"
}
```

**Tool Use:** `Read`

```json
{
  "path": "/Users/lunelson/Clones/earendil-works/pi/packages/web-ui/src/index.ts"
}
```

## User

**Tool Result:** `TU-033IAUbb8XCoBzsz6ASmDY`

```
{
  "content": "1: {\n2: \t\"name\": \"@earendil-works/pi-web-ui\",\n3: \t\"version\": \"0.74.1\",\n4: \t\"description\": \"Reusable web UI components for AI chat interfaces powered by @earendil-works/pi-ai\",\n5: \t\"type\": \"module\",\n6: \t\"main\": \"dist/index.js\",\n7: \t\"types\": \"dist/index.d.ts\",\n8: \t\"exports\": {\n9: \t\t\".\": \"./dist/index.js\",\n10: \t\t\"./app.css\": \"./dist/app.css\"\n11: \t},\n12: \t\"scripts\": {\n13: \t\t\"clean\": \"shx rm -rf dist\",\n14: \t\t\"build\": \"tsc -p tsconfig.build.json && tailwindcss -i ./src/app.css -o ./dist/app.css --minify\",\n15: \t\t\"dev\": \"concurrently --names \\\"build,example\\\" --prefix-colors \\\"cyan,green\\\" \\\"tsc -p tsconfig.build.json --watch --preserveWatchOutput\\\" \\\"tailwindcss -i ./src/app.css -o ./dist/app.css --watch\\\" \\\"npm run dev --prefix example\\\"\",\n16: \t\t\"dev:tsc\": \"concurrently --names \\\"build\\\" --prefix-colors \\\"cyan\\\" \\\"tsc -p tsconfig.build.json --watch --preserveWatchOutput\\\" \\\"tailwindcss -i ./src/app.css -o ./dist/app.css --watch\\\"\",\n17: \t\t\"check\": \"biome check --write --error-on-warnings . && tsc --noEmit && cd example && biome check --write --error-on-warnings . && tsc --noEmit\"\n18: \t},\n19: \t\"dependencies\": {\n20: \t\t\"@lmstudio/sdk\": \"^1.5.0\",\n21: \t\t\"@earendil-works/pi-ai\": \"^0.74.1\",\n22: \t\t\"@earendil-works/pi-tui\": \"^0.74.1\",\n23: \t\t\"typebox\": \"^1.1.24\",\n24: \t\t\"docx-preview\": \"^0.3.7\",\n25: \t\t\"jszip\": \"^3.10.1\",\n26: \t\t\"lucide\": \"^0.544.0\",\n27: \t\t\"ollama\": \"^0.6.0\",\n28: \t\t\"pdfjs-dist\": \"5.4.394\",\n29: \t\t\"xlsx\": \"https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz\"\n30: \t},\n31: \t\"peerDependencies\": {\n32: \t\t\"@mariozechner/mini-lit\": \"^0.2.0\",\n33: \t\t\"lit\": \"^3.3.1\"\n34: \t},\n35: \t\"devDependencies\": {\n36: \t\t\"@mariozechner/mini-lit\": \"^0.2.0\",\n37: \t\t\"@tailwindcss/cli\": \"^4.0.0-beta.14\",\n38: \t\t\"concurrently\": \"^9.2.1\",\n39: \t\t\"typescript\": \"^5.7.3\"\n40: \t},\n41: \t\"keywords\": [\n42: \t\t\"ai\",\n43: \t\t\"chat\",\n44: \t\t\"ui\",\n45: \t\t\"components\",\n46: \t\t\"llm\",\n47: \t\t\"web-components\",\n48: \t\t\"mini-lit\"\n49: \t],\n50: \t\"author\": \"Mario Zechner\",\n51: \t\"license\": \"MIT\"\n52: }",
  "absolutePath": "/Users/lunelson/Clones/earendil-works/pi/packages/web-ui/package.json"
}
```

**Tool Result:** `TU-033IAUcZrvnYc40boar8Fu`

```
{
  "output": "CHANGELOG.md\nexample\npackage.json\nREADME.md\nscripts\nsrc\ntsconfig.build.json\ntsconfig.json\n---src---\napp.css\nChatPanel.ts\ncomponents\ndialogs\nindex.ts\nprompts\nstorage\ntools\nutils\n---components---\nAgentInterface.ts\nAttachmentTile.ts\nConsoleBlock.ts\nCustomProviderCard.ts\nExpandableSection.ts\nInput.ts\nmessage-renderer-registry.ts\nMessageEditor.ts\nMessageList.ts\nMessages.ts\nProviderKeyInput.ts\nsandbox\nSandboxedIframe.ts\nStreamingMessageContainer.ts\nThinkingBlock.ts\n---tools---\nartifacts\nextract-document.ts\nindex.ts\njavascript-repl.ts\nrenderer-registry.ts\nrenderers\ntypes.ts\n---storage---\napp-storage.ts\nbackends\nstore.ts\nstores\ntypes.ts\n",
  "exitCode": 0
}
```

**Tool Result:** `TU-033IAUex9wdqL8GaKgIysH`

```
{
  "content": "1: // Main chat interface\n2: \n3: export type { Agent, AgentMessage, AgentState, ThinkingLevel } from \"@earendil-works/pi-agent-core\";\n4: export type { Model } from \"@earendil-works/pi-ai\";\n5: export { ChatPanel } from \"./ChatPanel.js\";\n6: // Components\n7: export { AgentInterface } from \"./components/AgentInterface.js\";\n8: export { AttachmentTile } from \"./components/AttachmentTile.js\";\n9: export { ConsoleBlock } from \"./components/ConsoleBlock.js\";\n10: export { CustomProviderCard } from \"./components/CustomProviderCard.js\";\n11: export { ExpandableSection } from \"./components/ExpandableSection.js\";\n12: export { Input } from \"./components/Input.js\";\n13: export { MessageEditor } from \"./components/MessageEditor.js\";\n14: export { MessageList } from \"./components/MessageList.js\";\n15: // Message components\n16: export type { ArtifactMessage, UserMessageWithAttachments } from \"./components/Messages.js\";\n17: export {\n18: \tAbortedMessage,\n19: \tAssistantMessage,\n20: \tconvertAttachments,\n21: \tdefaultConvertToLlm,\n22: \tisArtifactMessage,\n23: \tisUserMessageWithAttachments,\n24: \tToolMessage,\n25: \tToolMessageDebugView,\n26: \tUserMessage,\n27: } from \"./components/Messages.js\";\n28: // Message renderer registry\n29: export {\n30: \tgetMessageRenderer,\n31: \ttype MessageRenderer,\n32: \ttype MessageRole,\n33: \tregisterMessageRenderer,\n34: \trenderMessage,\n35: } from \"./components/message-renderer-registry.js\";\n36: export { ProviderKeyInput } from \"./components/ProviderKeyInput.js\";\n37: export {\n38: \ttype SandboxFile,\n39: \tSandboxIframe,\n40: \ttype SandboxResult,\n41: \ttype SandboxUrlProvider,\n42: } from \"./components/SandboxedIframe.js\";\n43: export { StreamingMessageContainer } from \"./components/StreamingMessageContainer.js\";\n44: // Sandbox Runtime Providers\n45: export { ArtifactsRuntimeProvider } from \"./components/sandbox/ArtifactsRuntimeProvider.js\";\n46: export { AttachmentsRuntimeProvider } from \"./components/sandbox/AttachmentsRuntimeProvider.js\";\n47: export { type ConsoleLog, ConsoleRuntimeProvider } from \"./components/sandbox/ConsoleRuntimeProvider.js\";\n48: export {\n49: \ttype DownloadableFile,\n50: \tFileDownloadRuntimeProvider,\n51: } from \"./components/sandbox/FileDownloadRuntimeProvider.js\";\n52: export { RuntimeMessageBridge } from \"./components/sandbox/RuntimeMessageBridge.js\";\n53: export { RUNTIME_MESSAGE_ROUTER } from \"./components/sandbox/RuntimeMessageRouter.js\";\n54: export type { SandboxRuntimeProvider } from \"./components/sandbox/SandboxRuntimeProvider.js\";\n55: export { ThinkingBlock } from \"./components/ThinkingBlock.js\";\n56: export { ApiKeyPromptDialog } from \"./dialogs/ApiKeyPromptDialog.js\";\n57: export { AttachmentOverlay } from \"./dialogs/AttachmentOverlay.js\";\n58: export { CustomProviderDialog } from \"./dialogs/CustomProviderDialog.js\";\n59: // Dialogs\n60: export { ModelSelector } from \"./dialogs/ModelSelector.js\";\n61: export { PersistentStorageDialog } from \"./dialogs/PersistentStorageDialog.js\";\n62: export { ProvidersModelsTab } from \"./dialogs/ProvidersModelsTab.js\";\n63: export { SessionListDialog } from \"./dialogs/SessionListDialog.js\";\n64: export { ApiKeysTab, ProxyTab, SettingsDialog, SettingsTab } from \"./dialogs/SettingsDialog.js\";\n65: // Prompts\n66: export {\n67: \tARTIFACTS_RUNTIME_PROVIDER_DESCRIPTION_RO,\n68: \tARTIFACTS_RUNTIME_PROVIDER_DESCRIPTION_RW,\n69: \tATTACHMENTS_RUNTIME_DESCRIPTION,\n70: } from \"./prompts/prompts.js\";\n71: // Storage\n72: export { AppStorage, getAppStorage, setAppStorage } from \"./storage/app-storage.js\";\n73: export { IndexedDBStorageBackend } from \"./storage/backends/indexeddb-storage-backend.js\";\n74: export { Store } from \"./storage/store.js\";\n75: export type {\n76: \tAutoDiscoveryProviderType,\n77: \tCustomProvider,\n78: \tCustomProviderType,\n79: } from \"./storage/stores/custom-providers-store.js\";\n80: export { CustomProvidersStore } from \"./storage/stores/custom-providers-store.js\";\n81: export { ProviderKeysStore } from \"./storage/stores/provider-keys-store.js\";\n82: export { SessionsStore } from \"./storage/stores/sessions-store.js\";\n83: export { SettingsStore } from \"./storage/stores/settings-store.js\";\n84: export type {\n85: \tIndexConfig,\n86: \tIndexedDBConfig,\n87: \tSessionData,\n88: \tSessionMetadata,\n89: \tStorageBackend,\n90: \tStorageTransaction,\n91: \tStoreConfig,\n92: } from \"./storage/types.js\";\n93: // Artifacts\n94: export { ArtifactElement } from \"./tools/artifacts/ArtifactElement.js\";\n95: export { ArtifactPill } from \"./tools/artifacts/ArtifactPill.js\";\n96: export { type Artifact, ArtifactsPanel, type ArtifactsParams } from \"./tools/artifacts/artifacts.js\";\n97: export { ArtifactsToolRenderer } from \"./tools/artifacts/artifacts-tool-renderer.js\";\n98: export { HtmlArtifact } from \"./tools/artifacts/HtmlArtifact.js\";\n99: export { ImageArtifact } from \"./tools/artifacts/ImageArtifact.js\";\n100: export { MarkdownArtifact } from \"./tools/artifacts/MarkdownArtifact.js\";\n101: export { SvgArtifact } from \"./tools/artifacts/SvgArtifact.js\";\n102: export { TextArtifact } from \"./tools/artifacts/TextArtifact.js\";\n103: export { createExtractDocumentTool, extractDocumentTool } from \"./tools/extract-document.js\";\n104: // Tools\n105: export { getToolRenderer, registerToolRenderer, renderTool, setShowJsonMode } from \"./tools/index.js\";\n106: export { createJavaScriptReplTool, javascriptReplTool } from \"./tools/javascript-repl.js\";\n107: export { renderCollapsibleHeader, renderHeader } from \"./tools/renderer-registry.js\";\n108: export { BashRenderer } from \"./tools/renderers/BashRenderer.js\";\n109: export { CalculateRenderer } from \"./tools/renderers/CalculateRenderer.js\";\n110: // Tool renderers\n111: export { DefaultRenderer } from \"./tools/renderers/DefaultRenderer.js\";\n112: export { GetCurrentTimeRenderer } from \"./tools/renderers/GetCurrentTimeRenderer.js\";\n113: export type { ToolRenderer, ToolRenderResult } from \"./tools/types.js\";\n114: export type { Attachment } from \"./utils/attachment-utils.js\";\n115: // Utils\n116: export { loadAttachment } from \"./utils/attachment-utils.js\";\n117: export { clearAuthToken, getAuthToken } from \"./utils/auth-token.js\";\n118: export { formatCost, formatModelCost, formatTokenCount, formatUsage } from \"./utils/format.js\";\n119: export { i18n, setLanguage, translations } from \"./utils/i18n.js\";\n120: export { applyProxyIfNeeded, createStreamFn, isCorsError, shouldUseProxyForProvider } from \"./utils/proxy-utils.js\";",
  "absolutePath": "/Users/lunelson/Clones/earendil-works/pi/packages/web-ui/src/index.ts"
}
```

## Assistant

Correction to my earlier statement — I was wrong. Web-ui **does** use `pi-agent-core` (line 3 of its `index.ts` re-exports `Agent`, `AgentMessage`, `AgentState`, `ThinkingLevel`). It's missing from the `package.json` `dependencies` block, which is what threw me. So the dependency reality is:

```diagram
                ╭───────────╮
                │  pi-ai    │
                ╰─────┬─────╯
                      ▼
              ╭────────────────╮
              │ pi-agent-core  │  ← the Agent class runs here
              ╰───┬────────┬───╯
                  │        │
                  ▼        ▼
          ╭────────────╮  ╭──────────────╮
          │ pi-coding- │  │  pi-web-ui   │
          │  agent     │  │              │
          ╰────────────╯  ╰──────────────╯
                  │             │
                  ▼             ▼
              pi-tui        pi-tui (utils)
```

Both `coding-agent` and `web-ui` are **peers sitting on top of `pi-agent-core`**. Same agent loop, completely different tool surface, completely different runtime environment.

### What web-ui actually is

Looking at its source, it is **a browser-native chat app in the spirit of claude.ai**, not a frontend to the coding agent:

**Runtime model:**
- Pure client-side. No backend. The browser holds the API keys (BYOK via `ProviderKeyInput`, `CustomProviderCard`) and talks directly to OpenAI/Anthropic/etc., with an optional CORS proxy.
- Sessions persist in **IndexedDB** (`storage/backends/indexeddb-storage-backend.ts`, `SessionsStore`, `SettingsStore`) — the equivalent of coding-agent's JSONL files, but browser-local.
- Built as web components on `lit` + `@mariozechner/mini-lit` + Tailwind.

**Tool surface (`src/tools/`):**
- `javascript-repl` — JS REPL executed in-page
- `extract-document` — parses PDF/DOCX/XLSX uploads in the browser (pdfjs, jszip, xlsx)
- `artifacts/` — Claude-style artifacts: HTML, SVG, Image, Markdown, Text, each rendered into a sandboxed iframe
- A renderer registry (`tool-renderer-registry`, `message-renderer-registry`) so consumers can plug in custom tool/message UIs

**Conspicuously absent:** anything that touches a file system, a shell, a project tree. No `bash`, `read`, `edit`, `grep`. The toolset is what the browser can safely do *to itself*.

**Sandbox machinery (`components/sandbox/`):**
- `SandboxedIframe` plus a runtime-provider model (`ArtifactsRuntimeProvider`, `AttachmentsRuntimeProvider`, `FileDownloadRuntimeProvider`, `ConsoleRuntimeProvider`) and a `RuntimeMessageBridge` / `RuntimeMessageRouter`.
- This is the substitute for OS-level isolation: untrusted LLM-generated code runs in an iframe and talks to the host page via a postMessage protocol.

**Re-exported types from agent-core** confirm the integration depth: it uses the same `Agent`, `AgentMessage`, `AgentState` types — i.e. the same conversation/turn machinery as coding-agent. It just feeds that agent a different toolbox.

### The use case

Two ways to read it:

1. **Library** ("Reusable web UI components for AI chat interfaces powered by @earendil-works/pi-ai" — direct from `package.json`). Someone builds a custom AI app in the browser; web-ui supplies the chat panel, message list, attachment handling, provider/model selectors, sandboxed artifact rendering, IndexedDB persistence, JS REPL, document extraction. They get a Claude.ai-ish stack out of the box.

2. **Reference app.** There's an `example/` folder; the `dev` script runs `npm run dev --prefix example`. So the package doubles as a working browser chat app — useful as a demo and as a way for the maintainers to dogfood the components.

### Why it doesn't share coding-agent's runtime

Three reasons that fall out of the design:

- **Environment.** Coding-agent's tools assume Node, a filesystem, a shell, `proper-lockfile`, `glob`, `chalk`, `undici`. None of that runs in a browser. Web-ui's tools assume `window`, iframes, IndexedDB, postMessage. The agent loop is shared because it's pure logic; everything below it is OS-bound.
- **Trust model.** Coding-agent's tools operate on *the user's machine*, gated by approval prompts. Web-ui's tools operate on *the page itself*, gated by iframe sandboxing. Different threat surfaces, different gates.
- **Deployment.** Coding-agent is a CLI you install. Web-ui is shipped to a browser, possibly serverless. The "backend" is the LLM provider directly.

### How this changes the earlier conversation

This makes the original "four modes" picture more honest:

- TUI and print mode are **`coding-agent` running locally with file-system tools**.
- RPC is **the same `coding-agent`, but driven by another program**.
- Web-ui is **a different agent product entirely** — same agent core, different tool surface, browser-resident.

So for the speculative record-server story: web-ui would not "become a frontend over coding-agent." It would become **a second agent that happens to share the record store**, with its own toolset (the record tools running over a network protocol) instead of artifacts/REPL/extract. Coding-agent gets the same record tools alongside its file tools. The record server is the shared spine; the two agents are siblings, not stacked.

That actually matches your earlier framing better — there isn't one server with four clients, there are two agents (CLI + browser) plus a record server, and the four "modes" really mean "four ways to drive *the coding agent specifically*."

## User

OK that's more clear now. So now tell me more about how prompts are context are composed, given that the core agent loop seems to be shared, but the two paths (CLI vs WEB) compose different capabilities, tools, orientations: how is the context on any given turn composed for the agent in the WEB scenario, different to that in one of the CLI scenarios, and where does this logic live?

## Assistant

**Tool Use:** `Bash`

```json
{
  "cmd": "ls packages/agent/src/harness/ && echo \"---\" && wc -l packages/agent/src/harness/system-prompt.ts packages/agent/src/harness/prompt-templates.ts packages/agent/src/agent.ts packages/agent/src/agent-loop.ts 2>/dev/null",
  "cwd": "/Users/lunelson/Clones/earendil-works/pi"
}
```

**Tool Use:** `Bash`

```json
{
  "cmd": "wc -l packages/coding-agent/src/core/system-prompt.ts packages/coding-agent/src/core/prompt-templates.ts packages/coding-agent/src/core/agent-session.ts packages/web-ui/src/ChatPanel.ts packages/web-ui/src/components/AgentInterface.ts packages/web-ui/src/prompts/*.ts 2>/dev/null",
  "cwd": "/Users/lunelson/Clones/earendil-works/pi"
}
```

**Tool Use:** `Bash`

```json
{
  "cmd": "ls packages/web-ui/src/prompts/ packages/agent/src/harness/session/ 2>/dev/null",
  "cwd": "/Users/lunelson/Clones/earendil-works/pi"
}
```

## User

**Tool Result:** `TU-033IAgfkYr3MdtQPpWKuKb`

```
{
  "output": "agent-harness.ts\ncompaction\nenv\nmessages.ts\nprompt-templates.ts\nsession\nskills.ts\nsystem-prompt.ts\ntypes.ts\nutils\n---\n      34 packages/agent/src/harness/system-prompt.ts\n     267 packages/agent/src/harness/prompt-templates.ts\n     554 packages/agent/src/agent.ts\n     718 packages/agent/src/agent-loop.ts\n    1573 total\n",
  "exitCode": 0
}
```

**Tool Result:** `TU-033IAggh95xZ1htfRfyzqs`

```
{
  "output": "     172 packages/coding-agent/src/core/system-prompt.ts\n     298 packages/coding-agent/src/core/prompt-templates.ts\n    3110 packages/coding-agent/src/core/agent-session.ts\n     209 packages/web-ui/src/ChatPanel.ts\n     403 packages/web-ui/src/components/AgentInterface.ts\n     282 packages/web-ui/src/prompts/prompts.ts\n    4474 total\n",
  "exitCode": 0
}
```

**Tool Result:** `TU-033IAgj6mHC1sa3al5oOAm`

```
{
  "output": "packages/agent/src/harness/session/:\njsonl-repo.ts\njsonl-storage.ts\nmemory-repo.ts\nmemory-storage.ts\nrepo-utils.ts\nsession.ts\nuuid.ts\n\npackages/web-ui/src/prompts/:\nprompts.ts\n",
  "exitCode": 0
}
```

## Assistant

**Tool Use:** `Read`

```json
{
  "path": "/Users/lunelson/Clones/earendil-works/pi/packages/agent/src/harness/system-prompt.ts"
}
```

**Tool Use:** `Read`

```json
{
  "path": "/Users/lunelson/Clones/earendil-works/pi/packages/agent/src/harness/prompt-templates.ts"
}
```

**Tool Use:** `Read`

```json
{
  "path": "/Users/lunelson/Clones/earendil-works/pi/packages/coding-agent/src/core/system-prompt.ts"
}
```

## User

**Tool Result:** `TU-033IAgohi2bRaaK9v5pjI5`

```
{
  "content": "1: import type { Skill } from \"./types.js\";\n2: \n3: export function formatSkillsForSystemPrompt(skills: Skill[]): string {\n4: \tconst visibleSkills = skills.filter((skill) => !skill.disableModelInvocation);\n5: \tif (visibleSkills.length === 0) return \"\";\n6: \n7: \tconst lines = [\n8: \t\t\"The following skills provide specialized instructions for specific tasks.\",\n9: \t\t\"Read the full skill file when the task matches its description.\",\n10: \t\t\"When a skill file references a relative path, resolve it against the skill directory (parent of SKILL.md / dirname of the path) and use that absolute path in tool commands.\",\n11: \t\t\"\",\n12: \t\t\"<available_skills>\",\n13: \t];\n14: \n15: \tfor (const skill of visibleSkills) {\n16: \t\tlines.push(\"  <skill>\");\n17: \t\tlines.push(`    <name>${escapeXml(skill.name)}</name>`);\n18: \t\tlines.push(`    <description>${escapeXml(skill.description)}</description>`);\n19: \t\tlines.push(`    <location>${escapeXml(skill.filePath)}</location>`);\n20: \t\tlines.push(\"  </skill>\");\n21: \t}\n22: \n23: \tlines.push(\"</available_skills>\");\n24: \treturn lines.join(\"\\n\");\n25: }\n26: \n27: function escapeXml(value: string): string {\n28: \treturn value\n29: \t\t.replace(/&/g, \"&amp;\")\n30: \t\t.replace(/</g, \"&lt;\")\n31: \t\t.replace(/>/g, \"&gt;\")\n32: \t\t.replace(/\"/g, \"&quot;\")\n33: \t\t.replace(/'/g, \"&apos;\");\n34: }",
  "absolutePath": "/Users/lunelson/Clones/earendil-works/pi/packages/agent/src/harness/system-prompt.ts"
}
```

**Tool Result:** `TU-033IAgpVudadO2EdHNYky4`

```
{
  "content": "1: import { parse } from \"yaml\";\n2: import { type ExecutionEnv, type FileInfo, type PromptTemplate, type Result, toError } from \"./types.js\";\n3: \n4: export type PromptTemplateDiagnosticCode = \"file_info_failed\" | \"list_failed\" | \"read_failed\" | \"parse_failed\";\n5: \n6: /** Warning produced while loading prompt templates. */\n7: export interface PromptTemplateDiagnostic {\n8: \t/** Diagnostic severity. Currently only warnings are emitted. */\n9: \ttype: \"warning\";\n10: \t/** Stable diagnostic code. */\n11: \tcode: PromptTemplateDiagnosticCode;\n12: \t/** Human-readable diagnostic message. */\n13: \tmessage: string;\n14: \t/** Path associated with the diagnostic. */\n15: \tpath: string;\n16: }\n17: \n18: interface PromptTemplateFrontmatter {\n19: \tdescription?: string;\n20: \t\"argument-hint\"?: string;\n21: \t[key: string]: unknown;\n22: }\n23: \n24: /**\n25:  * Load prompt templates from one or more paths.\n26:  *\n27:  * Directory inputs load direct `.md` children non-recursively. File inputs load explicit `.md` files. Missing paths and\n28:  * non-markdown files are skipped. Read and parse failures are returned as diagnostics.\n29:  */\n30: export async function loadPromptTemplates(\n31: \tenv: ExecutionEnv,\n32: \tpaths: string | string[],\n33: ): Promise<{ promptTemplates: PromptTemplate[]; diagnostics: PromptTemplateDiagnostic[] }> {\n34: \tconst promptTemplates: PromptTemplate[] = [];\n35: \tconst diagnostics: PromptTemplateDiagnostic[] = [];\n36: \tfor (const path of Array.isArray(paths) ? paths : [paths]) {\n37: \t\tconst infoResult = await env.fileInfo(path);\n38: \t\tif (!infoResult.ok) {\n39: \t\t\tif (infoResult.error.code !== \"not_found\") {\n40: \t\t\t\tdiagnostics.push({\n41: \t\t\t\t\ttype: \"warning\",\n42: \t\t\t\t\tcode: \"file_info_failed\",\n43: \t\t\t\t\tmessage: infoResult.error.message,\n44: \t\t\t\t\tpath,\n45: \t\t\t\t});\n46: \t\t\t}\n47: \t\t\tcontinue;\n48: \t\t}\n49: \t\tconst info = infoResult.value;\n50: \t\tconst kind = await resolveKind(env, info, diagnostics);\n51: \t\tif (kind === \"directory\") {\n52: \t\t\tconst result = await loadTemplatesFromDir(env, info.path);\n53: \t\t\tpromptTemplates.push(...result.promptTemplates);\n54: \t\t\tdiagnostics.push(...result.diagnostics);\n55: \t\t} else if (kind === \"file\" && info.name.endsWith(\".md\")) {\n56: \t\t\tconst result = await loadTemplateFromFile(env, info.path);\n57: \t\t\tif (result.promptTemplate) promptTemplates.push(result.promptTemplate);\n58: \t\t\tdiagnostics.push(...result.diagnostics);\n59: \t\t}\n60: \t}\n61: \treturn { promptTemplates, diagnostics };\n62: }\n63: \n64: /**\n65:  * Load prompt templates from source-tagged paths.\n66:  *\n67:  * Source values are preserved exactly and attached to every loaded prompt template and diagnostic. The agent package does\n68:  * not interpret source values; applications define their own provenance shape.\n69:  */\n70: export async function loadSourcedPromptTemplates<TSource, TPromptTemplate extends PromptTemplate = PromptTemplate>(\n71: \tenv: ExecutionEnv,\n72: \tinputs: Array<{ path: string; source: TSource }>,\n73: \tmapPromptTemplate?: (promptTemplate: PromptTemplate, source: TSource) => TPromptTemplate,\n74: ): Promise<{\n75: \tpromptTemplates: Array<{ promptTemplate: TPromptTemplate; source: TSource }>;\n76: \tdiagnostics: Array<PromptTemplateDiagnostic & { source: TSource }>;\n77: }> {\n78: \tconst promptTemplates: Array<{ promptTemplate: TPromptTemplate; source: TSource }> = [];\n79: \tconst diagnostics: Array<PromptTemplateDiagnostic & { source: TSource }> = [];\n80: \tfor (const input of inputs) {\n81: \t\tconst result = await loadPromptTemplates(env, input.path);\n82: \t\tfor (const promptTemplate of result.promptTemplates) {\n83: \t\t\tpromptTemplates.push({\n84: \t\t\t\tpromptTemplate: mapPromptTemplate\n85: \t\t\t\t\t? mapPromptTemplate(promptTemplate, input.source)\n86: \t\t\t\t\t: (promptTemplate as TPromptTemplate),\n87: \t\t\t\tsource: input.source,\n88: \t\t\t});\n89: \t\t}\n90: \t\tfor (const diagnostic of result.diagnostics) diagnostics.push({ ...diagnostic, source: input.source });\n91: \t}\n92: \treturn { promptTemplates, diagnostics };\n93: }\n94: \n95: async function loadTemplatesFromDir(\n96: \tenv: ExecutionEnv,\n97: \tdir: string,\n98: ): Promise<{ promptTemplates: PromptTemplate[]; diagnostics: PromptTemplateDiagnostic[] }> {\n99: \tconst promptTemplates: PromptTemplate[] = [];\n100: \tconst diagnostics: PromptTemplateDiagnostic[] = [];\n101: \tconst entriesResult = await env.listDir(dir);\n102: \tif (!entriesResult.ok) {\n103: \t\tdiagnostics.push({\n104: \t\t\ttype: \"warning\",\n105: \t\t\tcode: \"list_failed\",\n106: \t\t\tmessage: entriesResult.error.message,\n107: \t\t\tpath: dir,\n108: \t\t});\n109: \t\treturn { promptTemplates, diagnostics };\n110: \t}\n111: \tconst entries = entriesResult.value;\n112: \n113: \tfor (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {\n114: \t\tconst kind = await resolveKind(env, entry, diagnostics);\n115: \t\tif (kind !== \"file\" || !entry.name.endsWith(\".md\")) continue;\n116: \t\tconst result = await loadTemplateFromFile(env, entry.path);\n117: \t\tif (result.promptTemplate) promptTemplates.push(result.promptTemplate);\n118: \t\tdiagnostics.push(...result.diagnostics);\n119: \t}\n120: \treturn { promptTemplates, diagnostics };\n121: }\n122: \n123: async function loadTemplateFromFile(\n124: \tenv: ExecutionEnv,\n125: \tfilePath: string,\n126: ): Promise<{ promptTemplate: PromptTemplate | null; diagnostics: PromptTemplateDiagnostic[] }> {\n127: \tconst diagnostics: PromptTemplateDiagnostic[] = [];\n128: \tconst rawContent = await env.readTextFile(filePath);\n129: \tif (!rawContent.ok) {\n130: \t\tdiagnostics.push({\n131: \t\t\ttype: \"warning\",\n132: \t\t\tcode: \"read_failed\",\n133: \t\t\tmessage: rawContent.error.message,\n134: \t\t\tpath: filePath,\n135: \t\t});\n136: \t\treturn { promptTemplate: null, diagnostics };\n137: \t}\n138: \n139: \tconst parsed = parseFrontmatter<PromptTemplateFrontmatter>(rawContent.value);\n140: \tif (!parsed.ok) {\n141: \t\tdiagnostics.push({\n142: \t\t\ttype: \"warning\",\n143: \t\t\tcode: \"parse_failed\",\n144: \t\t\tmessage: parsed.error.message,\n145: \t\t\tpath: filePath,\n146: \t\t});\n147: \t\treturn { promptTemplate: null, diagnostics };\n148: \t}\n149: \n150: \tconst { frontmatter, body } = parsed.value;\n151: \tconst firstLine = body.split(\"\\n\").find((line) => line.trim());\n152: \tlet description = typeof frontmatter.description === \"string\" ? frontmatter.description : \"\";\n153: \tif (!description && firstLine) {\n154: \t\tdescription = firstLine.slice(0, 60);\n155: \t\tif (firstLine.length > 60) description += \"...\";\n156: \t}\n157: \treturn {\n158: \t\tpromptTemplate: {\n159: \t\t\tname: basenameEnvPath(filePath).replace(/\\.md$/i, \"\"),\n160: \t\t\tdescription,\n161: \t\t\tcontent: body,\n162: \t\t},\n163: \t\tdiagnostics,\n164: \t};\n165: }\n166: \n167: async function resolveKind(\n168: \tenv: ExecutionEnv,\n169: \tinfo: FileInfo,\n170: \tdiagnostics: PromptTemplateDiagnostic[],\n171: ): Promise<\"file\" | \"directory\" | undefined> {\n172: \tif (info.kind === \"file\" || info.kind === \"directory\") return info.kind;\n173: \tconst canonicalPath = await env.canonicalPath(info.path);\n174: \tif (!canonicalPath.ok) {\n175: \t\tif (canonicalPath.error.code !== \"not_found\") {\n176: \t\t\tdiagnostics.push({\n177: \t\t\t\ttype: \"warning\",\n178: \t\t\t\tcode: \"file_info_failed\",\n179: \t\t\t\tmessage: canonicalPath.error.message,\n180: \t\t\t\tpath: info.path,\n181: \t\t\t});\n182: \t\t}\n183: \t\treturn undefined;\n184: \t}\n185: \tconst target = await env.fileInfo(canonicalPath.value);\n186: \tif (!target.ok) {\n187: \t\tif (target.error.code !== \"not_found\") {\n188: \t\t\tdiagnostics.push({\n189: \t\t\t\ttype: \"warning\",\n190: \t\t\t\tcode: \"file_info_failed\",\n191: \t\t\t\tmessage: target.error.message,\n192: \t\t\t\tpath: info.path,\n193: \t\t\t});\n194: \t\t}\n195: \t\treturn undefined;\n196: \t}\n197: \treturn target.value.kind === \"file\" || target.value.kind === \"directory\" ? target.value.kind : undefined;\n198: }\n199: \n200: function parseFrontmatter<T extends Record<string, unknown>>(\n201: \tcontent: string,\n202: ): Result<{ frontmatter: T; body: string }, Error> {\n203: \ttry {\n204: \t\tconst normalized = content.replace(/\\r\\n/g, \"\\n\").replace(/\\r/g, \"\\n\");\n205: \t\tif (!normalized.startsWith(\"---\")) return { ok: true, value: { frontmatter: {} as T, body: normalized } };\n206: \t\tconst endIndex = normalized.indexOf(\"\\n---\", 3);\n207: \t\tif (endIndex === -1) return { ok: true, value: { frontmatter: {} as T, body: normalized } };\n208: \t\tconst yamlString = normalized.slice(4, endIndex);\n209: \t\tconst body = normalized.slice(endIndex + 4).trim();\n210: \t\treturn { ok: true, value: { frontmatter: (parse(yamlString) ?? {}) as T, body } };\n211: \t} catch (error) {\n212: \t\treturn { ok: false, error: toError(error) };\n213: \t}\n214: }\n215: \n216: function basenameEnvPath(path: string): string {\n217: \tconst normalized = path.replace(/\\/+$/, \"\");\n218: \tconst slashIndex = normalized.lastIndexOf(\"/\");\n219: \treturn slashIndex === -1 ? normalized : normalized.slice(slashIndex + 1);\n220: }\n221: \n222: /** Parse an argument string using simple shell-style single and double quotes. */\n223: export function parseCommandArgs(argsString: string): string[] {\n224: \tconst args: string[] = [];\n225: \tlet current = \"\";\n226: \tlet inQuote: string | null = null;\n227: \n228: \tfor (let i = 0; i < argsString.length; i++) {\n229: \t\tconst char = argsString[i]!;\n230: \t\tif (inQuote) {\n231: \t\t\tif (char === inQuote) inQuote = null;\n232: \t\t\telse current += char;\n233: \t\t} else if (char === '\"' || char === \"'\") {\n234: \t\t\tinQuote = char;\n235: \t\t} else if (char === \" \" || char === \"\\t\") {\n236: \t\t\tif (current) {\n237: \t\t\t\targs.push(current);\n238: \t\t\t\tcurrent = \"\";\n239: \t\t\t}\n240: \t\t} else {\n241: \t\t\tcurrent += char;\n242: \t\t}\n243: \t}\n244: \tif (current) args.push(current);\n245: \treturn args;\n246: }\n247: \n248: /** Substitute prompt template placeholders (`$1`, `$@`, `$ARGUMENTS`, `${@:N}`, `${@:N:L}`) with command arguments. */\n249: export function substituteArgs(content: string, args: string[]): string {\n250: \tlet result = content;\n251: \tresult = result.replace(/\\$(\\d+)/g, (_, num: string) => args[parseInt(num, 10) - 1] ?? \"\");\n252: \tresult = result.replace(/\\$\\{@:(\\d+)(?::(\\d+))?\\}/g, (_, startStr: string, lengthStr?: string) => {\n253: \t\tlet start = parseInt(startStr, 10) - 1;\n254: \t\tif (start < 0) start = 0;\n255: \t\tif (lengthStr) return args.slice(start, start + parseInt(lengthStr, 10)).join(\" \");\n256: \t\treturn args.slice(start).join(\" \");\n257: \t});\n258: \tconst allArgs = args.join(\" \");\n259: \tresult = result.replace(/\\$ARGUMENTS/g, allArgs);\n260: \tresult = result.replace(/\\$@/g, allArgs);\n261: \treturn result;\n262: }\n263: \n264: /** Format a prompt template invocation with positional arguments. */\n265: export function formatPromptTemplateInvocation(template: PromptTemplate, args: string[] = []): string {\n266: \treturn substituteArgs(template.content, args);\n267: }",
  "absolutePath": "/Users/lunelson/Clones/earendil-works/pi/packages/agent/src/harness/prompt-templates.ts"
}
```

**Tool Result:** `TU-033IAgq2ZGcIR7LzoSMKPS`

```
{
  "content": "1: /**\n2:  * System prompt construction and project context loading\n3:  */\n4: \n5: import { getDocsPath, getExamplesPath, getReadmePath } from \"../config.js\";\n6: import { formatSkillsForPrompt, type Skill } from \"./skills.js\";\n7: \n8: export interface BuildSystemPromptOptions {\n9: \t/** Custom system prompt (replaces default). */\n10: \tcustomPrompt?: string;\n11: \t/** Tools to include in prompt. Default: [read, bash, edit, write] */\n12: \tselectedTools?: string[];\n13: \t/** Optional one-line tool snippets keyed by tool name. */\n14: \ttoolSnippets?: Record<string, string>;\n15: \t/** Additional guideline bullets appended to the default system prompt guidelines. */\n16: \tpromptGuidelines?: string[];\n17: \t/** Text to append to system prompt. */\n18: \tappendSystemPrompt?: string;\n19: \t/** Working directory. */\n20: \tcwd: string;\n21: \t/** Pre-loaded context files. */\n22: \tcontextFiles?: Array<{ path: string; content: string }>;\n23: \t/** Pre-loaded skills. */\n24: \tskills?: Skill[];\n25: }\n26: \n27: /** Build the system prompt with tools, guidelines, and context */\n28: export function buildSystemPrompt(options: BuildSystemPromptOptions): string {\n29: \tconst {\n30: \t\tcustomPrompt,\n31: \t\tselectedTools,\n32: \t\ttoolSnippets,\n33: \t\tpromptGuidelines,\n34: \t\tappendSystemPrompt,\n35: \t\tcwd,\n36: \t\tcontextFiles: providedContextFiles,\n37: \t\tskills: providedSkills,\n38: \t} = options;\n39: \tconst resolvedCwd = cwd;\n40: \tconst promptCwd = resolvedCwd.replace(/\\\\/g, \"/\");\n41: \n42: \tconst now = new Date();\n43: \tconst year = now.getFullYear();\n44: \tconst month = String(now.getMonth() + 1).padStart(2, \"0\");\n45: \tconst day = String(now.getDate()).padStart(2, \"0\");\n46: \tconst date = `${year}-${month}-${day}`;\n47: \n48: \tconst appendSection = appendSystemPrompt ? `\\n\\n${appendSystemPrompt}` : \"\";\n49: \n50: \tconst contextFiles = providedContextFiles ?? [];\n51: \tconst skills = providedSkills ?? [];\n52: \n53: \tif (customPrompt) {\n54: \t\tlet prompt = customPrompt;\n55: \n56: \t\tif (appendSection) {\n57: \t\t\tprompt += appendSection;\n58: \t\t}\n59: \n60: \t\t// Append project context files\n61: \t\tif (contextFiles.length > 0) {\n62: \t\t\tprompt += \"\\n\\n# Project Context\\n\\n\";\n63: \t\t\tprompt += \"Project-specific instructions and guidelines:\\n\\n\";\n64: \t\t\tfor (const { path: filePath, content } of contextFiles) {\n65: \t\t\t\tprompt += `## ${filePath}\\n\\n${content}\\n\\n`;\n66: \t\t\t}\n67: \t\t}\n68: \n69: \t\t// Append skills section (only if read tool is available)\n70: \t\tconst customPromptHasRead = !selectedTools || selectedTools.includes(\"read\");\n71: \t\tif (customPromptHasRead && skills.length > 0) {\n72: \t\t\tprompt += formatSkillsForPrompt(skills);\n73: \t\t}\n74: \n75: \t\t// Add date and working directory last\n76: \t\tprompt += `\\nCurrent date: ${date}`;\n77: \t\tprompt += `\\nCurrent working directory: ${promptCwd}`;\n78: \n79: \t\treturn prompt;\n80: \t}\n81: \n82: \t// Get absolute paths to documentation and examples\n83: \tconst readmePath = getReadmePath();\n84: \tconst docsPath = getDocsPath();\n85: \tconst examplesPath = getExamplesPath();\n86: \n87: \t// Build tools list based on selected tools.\n88: \t// A tool appears in Available tools only when the caller provides a one-line snippet.\n89: \tconst tools = selectedTools || [\"read\", \"bash\", \"edit\", \"write\"];\n90: \tconst visibleTools = tools.filter((name) => !!toolSnippets?.[name]);\n91: \tconst toolsList =\n92: \t\tvisibleTools.length > 0 ? visibleTools.map((name) => `- ${name}: ${toolSnippets![name]}`).join(\"\\n\") : \"(none)\";\n93: \n94: \t// Build guidelines based on which tools are actually available\n95: \tconst guidelinesList: string[] = [];\n96: \tconst guidelinesSet = new Set<string>();\n97: \tconst addGuideline = (guideline: string): void => {\n98: \t\tif (guidelinesSet.has(guideline)) {\n99: \t\t\treturn;\n100: \t\t}\n101: \t\tguidelinesSet.add(guideline);\n102: \t\tguidelinesList.push(guideline);\n103: \t};\n104: \n105: \tconst hasBash = tools.includes(\"bash\");\n106: \tconst hasGrep = tools.includes(\"grep\");\n107: \tconst hasFind = tools.includes(\"find\");\n108: \tconst hasLs = tools.includes(\"ls\");\n109: \tconst hasRead = tools.includes(\"read\");\n110: \n111: \t// File exploration guidelines\n112: \tif (hasBash && !hasGrep && !hasFind && !hasLs) {\n113: \t\taddGuideline(\"Use bash for file operations like ls, rg, find\");\n114: \t} else if (hasBash && (hasGrep || hasFind || hasLs)) {\n115: \t\taddGuideline(\"Prefer grep/find/ls tools over bash for file exploration (faster, respects .gitignore)\");\n116: \t}\n117: \n118: \tfor (const guideline of promptGuidelines ?? []) {\n119: \t\tconst normalized = guideline.trim();\n120: \t\tif (normalized.length > 0) {\n121: \t\t\taddGuideline(normalized);\n122: \t\t}\n123: \t}\n124: \n125: \t// Always include these\n126: \taddGuideline(\"Be concise in your responses\");\n127: \taddGuideline(\"Show file paths clearly when working with files\");\n128: \n129: \tconst guidelines = guidelinesList.map((g) => `- ${g}`).join(\"\\n\");\n130: \n131: \tlet prompt = `You are an expert coding assistant operating inside pi, a coding agent harness. You help users by reading files, executing commands, editing code, and writing new files.\n132: \n133: Available tools:\n134: ${toolsList}\n135: \n136: In addition to the tools above, you may have access to other custom tools depending on the project.\n137: \n138: Guidelines:\n139: ${guidelines}\n140: \n141: Pi documentation (read only when the user asks about pi itself, its SDK, extensions, themes, skills, or TUI):\n142: - Main documentation: ${readmePath}\n143: - Additional docs: ${docsPath}\n144: - Examples: ${examplesPath} (extensions, custom tools, SDK)\n145: - When asked about: extensions (docs/extensions.md, examples/extensions/), themes (docs/themes.md), skills (docs/skills.md), prompt templates (docs/prompt-templates.md), TUI components (docs/tui.md), keybindings (docs/keybindings.md), SDK integrations (docs/sdk.md), custom providers (docs/custom-provider.md), adding models (docs/models.md), pi packages (docs/packages.md)\n146: - When working on pi topics, read the docs and examples, and follow .md cross-references before implementing\n147: - Always read pi .md files completely and follow links to related docs (e.g., tui.md for TUI API details)`;\n148: \n149: \tif (appendSection) {\n150: \t\tprompt += appendSection;\n151: \t}\n152: \n153: \t// Append project context files\n154: \tif (contextFiles.length > 0) {\n155: \t\tprompt += \"\\n\\n# Project Context\\n\\n\";\n156: \t\tprompt += \"Project-specific instructions and guidelines:\\n\\n\";\n157: \t\tfor (const { path: filePath, content } of contextFiles) {\n158: \t\t\tprompt += `## ${filePath}\\n\\n${content}\\n\\n`;\n159: \t\t}\n160: \t}\n161: \n162: \t// Append skills section (only if read tool is available)\n163: \tif (hasRead && skills.length > 0) {\n164: \t\tprompt += formatSkillsForPrompt(skills);\n165: \t}\n166: \n167: \t// Add date and working directory last\n168: \tprompt += `\\nCurrent date: ${date}`;\n169: \tprompt += `\\nCurrent working directory: ${promptCwd}`;\n170: \n171: \treturn prompt;\n172: }",
  "absolutePath": "/Users/lunelson/Clones/earendil-works/pi/packages/coding-agent/src/core/system-prompt.ts"
}
```

## Assistant

**Tool Use:** `Read`

```json
{
  "path": "/Users/lunelson/Clones/earendil-works/pi/packages/web-ui/src/ChatPanel.ts"
}
```

**Tool Use:** `Read`

```json
{
  "path": "/Users/lunelson/Clones/earendil-works/pi/packages/web-ui/src/components/AgentInterface.ts"
}
```

**Tool Use:** `Read`

```json
{
  "path": "/Users/lunelson/Clones/earendil-works/pi/packages/web-ui/src/prompts/prompts.ts"
}
```

## User

**Tool Result:** `TU-033IAgxM2jj2x754zivmpV`

```
{
  "content": "1: import { Badge } from \"@mariozechner/mini-lit/dist/Badge.js\";\n2: import { html, LitElement } from \"lit\";\n3: import { customElement, state } from \"lit/decorators.js\";\n4: import \"./components/AgentInterface.js\";\n5: import type { Agent, AgentTool } from \"@earendil-works/pi-agent-core\";\n6: import type { AgentInterface } from \"./components/AgentInterface.js\";\n7: import { ArtifactsRuntimeProvider } from \"./components/sandbox/ArtifactsRuntimeProvider.js\";\n8: import { AttachmentsRuntimeProvider } from \"./components/sandbox/AttachmentsRuntimeProvider.js\";\n9: import type { SandboxRuntimeProvider } from \"./components/sandbox/SandboxRuntimeProvider.js\";\n10: import { ArtifactsPanel, ArtifactsToolRenderer } from \"./tools/artifacts/index.js\";\n11: import { registerToolRenderer } from \"./tools/renderer-registry.js\";\n12: import type { Attachment } from \"./utils/attachment-utils.js\";\n13: import { i18n } from \"./utils/i18n.js\";\n14: \n15: const BREAKPOINT = 800; // px - switch between overlay and side-by-side\n16: \n17: @customElement(\"pi-chat-panel\")\n18: export class ChatPanel extends LitElement {\n19: \t@state() public agent?: Agent;\n20: \t@state() public agentInterface?: AgentInterface;\n21: \t@state() public artifactsPanel?: ArtifactsPanel;\n22: \t@state() private hasArtifacts = false;\n23: \t@state() private artifactCount = 0;\n24: \t@state() private showArtifactsPanel = false;\n25: \t@state() private windowWidth = 0;\n26: \n27: \tprivate resizeHandler = () => {\n28: \t\tthis.windowWidth = window.innerWidth;\n29: \t\tthis.requestUpdate();\n30: \t};\n31: \n32: \tcreateRenderRoot() {\n33: \t\treturn this;\n34: \t}\n35: \n36: \toverride connectedCallback() {\n37: \t\tsuper.connectedCallback();\n38: \t\tthis.windowWidth = window.innerWidth; // Set initial width after connection\n39: \t\twindow.addEventListener(\"resize\", this.resizeHandler);\n40: \t\tthis.style.display = \"flex\";\n41: \t\tthis.style.flexDirection = \"column\";\n42: \t\tthis.style.height = \"100%\";\n43: \t\tthis.style.minHeight = \"0\";\n44: \t\t// Update width after initial render\n45: \t\trequestAnimationFrame(() => {\n46: \t\t\tthis.windowWidth = window.innerWidth;\n47: \t\t\tthis.requestUpdate();\n48: \t\t});\n49: \t}\n50: \n51: \toverride disconnectedCallback() {\n52: \t\tsuper.disconnectedCallback();\n53: \t\twindow.removeEventListener(\"resize\", this.resizeHandler);\n54: \t}\n55: \n56: \tasync setAgent(\n57: \t\tagent: Agent,\n58: \t\tconfig?: {\n59: \t\t\tonApiKeyRequired?: (provider: string) => Promise<boolean>;\n60: \t\t\tonBeforeSend?: () => void | Promise<void>;\n61: \t\t\tonCostClick?: () => void;\n62: \t\t\tonModelSelect?: () => void;\n63: \t\t\tsandboxUrlProvider?: () => string;\n64: \t\t\ttoolsFactory?: (\n65: \t\t\t\tagent: Agent,\n66: \t\t\t\tagentInterface: AgentInterface,\n67: \t\t\t\tartifactsPanel: ArtifactsPanel,\n68: \t\t\t\truntimeProvidersFactory: () => SandboxRuntimeProvider[],\n69: \t\t\t) => AgentTool<any>[];\n70: \t\t},\n71: \t) {\n72: \t\tthis.agent = agent;\n73: \n74: \t\t// Create AgentInterface\n75: \t\tthis.agentInterface = document.createElement(\"agent-interface\") as AgentInterface;\n76: \t\tthis.agentInterface.session = agent;\n77: \t\tthis.agentInterface.enableAttachments = true;\n78: \t\tthis.agentInterface.enableModelSelector = true;\n79: \t\tthis.agentInterface.enableThinkingSelector = true;\n80: \t\tthis.agentInterface.showThemeToggle = false;\n81: \t\tthis.agentInterface.onApiKeyRequired = config?.onApiKeyRequired;\n82: \t\tthis.agentInterface.onModelSelect = config?.onModelSelect;\n83: \t\tthis.agentInterface.onBeforeSend = config?.onBeforeSend;\n84: \t\tthis.agentInterface.onCostClick = config?.onCostClick;\n85: \n86: \t\t// Set up artifacts panel\n87: \t\tthis.artifactsPanel = new ArtifactsPanel();\n88: \t\tthis.artifactsPanel.agent = agent; // Pass agent for HTML artifact runtime providers\n89: \t\tif (config?.sandboxUrlProvider) {\n90: \t\t\tthis.artifactsPanel.sandboxUrlProvider = config.sandboxUrlProvider;\n91: \t\t}\n92: \t\t// Register the standalone tool renderer (not the panel itself)\n93: \t\tregisterToolRenderer(\"artifacts\", new ArtifactsToolRenderer(this.artifactsPanel));\n94: \n95: \t\t// Runtime providers factory for REPL tools (read-write access)\n96: \t\tconst runtimeProvidersFactory = () => {\n97: \t\t\tconst attachments: Attachment[] = [];\n98: \t\t\tfor (const message of this.agent!.state.messages) {\n99: \t\t\t\tif (message.role === \"user-with-attachments\") {\n100: \t\t\t\t\tmessage.attachments?.forEach((a) => {\n101: \t\t\t\t\t\tattachments.push(a);\n102: \t\t\t\t\t});\n103: \t\t\t\t}\n104: \t\t\t}\n105: \t\t\tconst providers: SandboxRuntimeProvider[] = [];\n106: \n107: \t\t\t// Add attachments provider if there are attachments\n108: \t\t\tif (attachments.length > 0) {\n109: \t\t\t\tproviders.push(new AttachmentsRuntimeProvider(attachments));\n110: \t\t\t}\n111: \n112: \t\t\t// Add artifacts provider with read-write access (for REPL)\n113: \t\t\tproviders.push(new ArtifactsRuntimeProvider(this.artifactsPanel!, this.agent!, true));\n114: \n115: \t\t\treturn providers;\n116: \t\t};\n117: \n118: \t\tthis.artifactsPanel.onArtifactsChange = () => {\n119: \t\t\tconst count = this.artifactsPanel?.artifacts?.size ?? 0;\n120: \t\t\tconst created = count > this.artifactCount;\n121: \t\t\tthis.hasArtifacts = count > 0;\n122: \t\t\tthis.artifactCount = count;\n123: \t\t\tif (this.hasArtifacts && created) {\n124: \t\t\t\tthis.showArtifactsPanel = true;\n125: \t\t\t}\n126: \t\t\tthis.requestUpdate();\n127: \t\t};\n128: \n129: \t\tthis.artifactsPanel.onClose = () => {\n130: \t\t\tthis.showArtifactsPanel = false;\n131: \t\t\tthis.requestUpdate();\n132: \t\t};\n133: \n134: \t\tthis.artifactsPanel.onOpen = () => {\n135: \t\t\tthis.showArtifactsPanel = true;\n136: \t\t\tthis.requestUpdate();\n137: \t\t};\n138: \n139: \t\t// Set tools on the agent\n140: \t\t// Pass runtimeProvidersFactory so consumers can configure their own REPL tools\n141: \t\tconst additionalTools =\n142: \t\t\tconfig?.toolsFactory?.(agent, this.agentInterface, this.artifactsPanel, runtimeProvidersFactory) || [];\n143: \t\tconst tools = [this.artifactsPanel.tool, ...additionalTools];\n144: \t\tthis.agent.state.tools = tools;\n145: \n146: \t\t// Reconstruct artifacts from existing messages\n147: \t\t// Temporarily disable the onArtifactsChange callback to prevent auto-opening on load\n148: \t\tconst originalCallback = this.artifactsPanel.onArtifactsChange;\n149: \t\tthis.artifactsPanel.onArtifactsChange = undefined;\n150: \t\tawait this.artifactsPanel.reconstructFromMessages(this.agent.state.messages);\n151: \t\tthis.artifactsPanel.onArtifactsChange = originalCallback;\n152: \n153: \t\tthis.hasArtifacts = this.artifactsPanel.artifacts.size > 0;\n154: \t\tthis.artifactCount = this.artifactsPanel.artifacts.size;\n155: \n156: \t\tthis.requestUpdate();\n157: \t}\n158: \n159: \trender() {\n160: \t\tif (!this.agent || !this.agentInterface) {\n161: \t\t\treturn html`<div class=\"flex items-center justify-center h-full\">\n162: \t\t\t\t<div class=\"text-muted-foreground\">No agent set</div>\n163: \t\t\t</div>`;\n164: \t\t}\n165: \n166: \t\tconst isMobile = this.windowWidth < BREAKPOINT;\n167: \n168: \t\t// Set panel props\n169: \t\tif (this.artifactsPanel) {\n170: \t\t\tthis.artifactsPanel.collapsed = !this.showArtifactsPanel;\n171: \t\t\tthis.artifactsPanel.overlay = isMobile;\n172: \t\t}\n173: \n174: \t\treturn html`\n175: \t\t\t<div class=\"relative w-full h-full overflow-hidden flex\">\n176: \t\t\t\t<div class=\"h-full\" style=\"${!isMobile && this.showArtifactsPanel && this.hasArtifacts ? \"width: 50%;\" : \"width: 100%;\"}\">\n177: \t\t\t\t\t\t${this.agentInterface}\n178: \t\t\t\t\t</div>\n179: \n180: \t\t\t\t\t<!-- Floating pill when artifacts exist and panel is collapsed -->\n181: \t\t\t\t\t${\n182: \t\t\t\t\t\tthis.hasArtifacts && !this.showArtifactsPanel\n183: \t\t\t\t\t\t\t? html`\n184: \t\t\t\t\t\t\t\t<button\n185: \t\t\t\t\t\t\t\t\tclass=\"absolute z-30 top-4 left-1/2 -translate-x-1/2 pointer-events-auto\"\n186: \t\t\t\t\t\t\t\t\t@click=${() => {\n187: \t\t\t\t\t\t\t\t\t\tthis.showArtifactsPanel = true;\n188: \t\t\t\t\t\t\t\t\t\tthis.requestUpdate();\n189: \t\t\t\t\t\t\t\t\t}}\n190: \t\t\t\t\t\t\t\t\ttitle=${i18n(\"Show artifacts\")}\n191: \t\t\t\t\t\t\t\t>\n192: \t\t\t\t\t\t\t\t\t${Badge(html`\n193: \t\t\t\t\t\t\t\t\t\t<span class=\"inline-flex items-center gap-1\">\n194: \t\t\t\t\t\t\t\t\t\t\t<span>${i18n(\"Artifacts\")}</span>\n195: \t\t\t\t\t\t\t\t\t\t\t<span class=\"text-[10px] leading-none bg-primary-foreground/20 text-primary-foreground rounded px-1 font-mono tabular-nums\">${this.artifactCount}</span>\n196: \t\t\t\t\t\t\t\t\t\t</span>\n197: \t\t\t\t\t\t\t\t\t`)}\n198: \t\t\t\t\t\t\t\t</button>\n199: \t\t\t\t\t\t\t`\n200: \t\t\t\t\t\t\t: \"\"\n201: \t\t\t\t\t}\n202: \n203: \t\t\t\t<div class=\"h-full ${isMobile ? \"absolute inset-0 pointer-events-none\" : \"\"}\" style=\"${!isMobile ? (!this.hasArtifacts || !this.showArtifactsPanel ? \"display: none;\" : \"width: 50%;\") : \"\"}\">\n204: \t\t\t\t\t${this.artifactsPanel}\n205: \t\t\t\t</div>\n206: \t\t\t</div>\n207: \t\t`;\n208: \t}\n209: }",
  "absolutePath": "/Users/lunelson/Clones/earendil-works/pi/packages/web-ui/src/ChatPanel.ts"
}
```

**Tool Result:** `TU-033IAgyQigoMmIrIBOEWkj`

```
{
  "content": "1: import { streamSimple, type ToolResultMessage, type Usage } from \"@earendil-works/pi-ai\";\n2: import { html, LitElement } from \"lit\";\n3: import { customElement, property, query } from \"lit/decorators.js\";\n4: import { ModelSelector } from \"../dialogs/ModelSelector.js\";\n5: import type { MessageEditor } from \"./MessageEditor.js\";\n6: import \"./MessageEditor.js\";\n7: import \"./MessageList.js\";\n8: import \"./Messages.js\"; // Import for side effects to register the custom elements\n9: import { getAppStorage } from \"../storage/app-storage.js\";\n10: import \"./StreamingMessageContainer.js\";\n11: import type { Agent, AgentEvent } from \"@earendil-works/pi-agent-core\";\n12: import type { Attachment } from \"../utils/attachment-utils.js\";\n13: import { formatUsage } from \"../utils/format.js\";\n14: import { i18n } from \"../utils/i18n.js\";\n15: import { createStreamFn } from \"../utils/proxy-utils.js\";\n16: import type { UserMessageWithAttachments } from \"./Messages.js\";\n17: import type { StreamingMessageContainer } from \"./StreamingMessageContainer.js\";\n18: \n19: @customElement(\"agent-interface\")\n20: export class AgentInterface extends LitElement {\n21: \t// Optional external session: when provided, this component becomes a view over the session\n22: \t@property({ attribute: false }) session?: Agent;\n23: \t@property({ type: Boolean }) enableAttachments = true;\n24: \t@property({ type: Boolean }) enableModelSelector = true;\n25: \t@property({ type: Boolean }) enableThinkingSelector = true;\n26: \t@property({ type: Boolean }) showThemeToggle = false;\n27: \t// Optional custom API key prompt handler - if not provided, uses default dialog\n28: \t@property({ attribute: false }) onApiKeyRequired?: (provider: string) => Promise<boolean>;\n29: \t// Optional callback called before sending a message\n30: \t@property({ attribute: false }) onBeforeSend?: () => void | Promise<void>;\n31: \t// Optional callback called before executing a tool call - return false to prevent execution\n32: \t@property({ attribute: false }) onBeforeToolCall?: (toolName: string, args: any) => boolean | Promise<boolean>;\n33: \t// Optional callback called when cost display is clicked\n34: \t@property({ attribute: false }) onCostClick?: () => void;\n35: \t// Optional callback to override model selector behavior\n36: \t@property({ attribute: false }) onModelSelect?: () => void;\n37: \n38: \t// References\n39: \t@query(\"message-editor\") private _messageEditor!: MessageEditor;\n40: \t@query(\"streaming-message-container\") private _streamingContainer!: StreamingMessageContainer;\n41: \n42: \tprivate _autoScroll = true;\n43: \tprivate _lastScrollTop = 0;\n44: \tprivate _lastClientHeight = 0;\n45: \tprivate _scrollContainer?: HTMLElement;\n46: \tprivate _resizeObserver?: ResizeObserver;\n47: \tprivate _unsubscribeSession?: () => void;\n48: \n49: \tpublic setInput(text: string, attachments?: Attachment[]) {\n50: \t\tconst update = () => {\n51: \t\t\tif (!this._messageEditor) requestAnimationFrame(update);\n52: \t\t\telse {\n53: \t\t\t\tthis._messageEditor.value = text;\n54: \t\t\t\tthis._messageEditor.attachments = attachments || [];\n55: \t\t\t}\n56: \t\t};\n57: \t\tupdate();\n58: \t}\n59: \n60: \tpublic setAutoScroll(enabled: boolean) {\n61: \t\tthis._autoScroll = enabled;\n62: \t}\n63: \n64: \tprotected override createRenderRoot(): HTMLElement | DocumentFragment {\n65: \t\treturn this;\n66: \t}\n67: \n68: \toverride willUpdate(changedProperties: Map<string, any>) {\n69: \t\tsuper.willUpdate(changedProperties);\n70: \n71: \t\t// Re-subscribe when session property changes\n72: \t\tif (changedProperties.has(\"session\")) {\n73: \t\t\tthis.setupSessionSubscription();\n74: \t\t}\n75: \t}\n76: \n77: \toverride async connectedCallback() {\n78: \t\tsuper.connectedCallback();\n79: \n80: \t\tthis.style.display = \"flex\";\n81: \t\tthis.style.flexDirection = \"column\";\n82: \t\tthis.style.height = \"100%\";\n83: \t\tthis.style.minHeight = \"0\";\n84: \n85: \t\t// Wait for first render to get scroll container\n86: \t\tawait this.updateComplete;\n87: \t\tthis._scrollContainer = this.querySelector(\".overflow-y-auto\") as HTMLElement;\n88: \n89: \t\tif (this._scrollContainer) {\n90: \t\t\t// Set up ResizeObserver to detect content changes\n91: \t\t\tthis._resizeObserver = new ResizeObserver(() => {\n92: \t\t\t\tif (this._autoScroll && this._scrollContainer) {\n93: \t\t\t\t\tthis._scrollContainer.scrollTop = this._scrollContainer.scrollHeight;\n94: \t\t\t\t}\n95: \t\t\t});\n96: \n97: \t\t\t// Observe the content container inside the scroll container\n98: \t\t\tconst contentContainer = this._scrollContainer.querySelector(\".max-w-3xl\");\n99: \t\t\tif (contentContainer) {\n100: \t\t\t\tthis._resizeObserver.observe(contentContainer);\n101: \t\t\t}\n102: \n103: \t\t\t// Set up scroll listener with better detection\n104: \t\t\tthis._scrollContainer.addEventListener(\"scroll\", this._handleScroll);\n105: \t\t}\n106: \n107: \t\t// Subscribe to external session if provided\n108: \t\tthis.setupSessionSubscription();\n109: \t}\n110: \n111: \toverride disconnectedCallback() {\n112: \t\tsuper.disconnectedCallback();\n113: \n114: \t\t// Clean up observers and listeners\n115: \t\tif (this._resizeObserver) {\n116: \t\t\tthis._resizeObserver.disconnect();\n117: \t\t\tthis._resizeObserver = undefined;\n118: \t\t}\n119: \n120: \t\tif (this._scrollContainer) {\n121: \t\t\tthis._scrollContainer.removeEventListener(\"scroll\", this._handleScroll);\n122: \t\t}\n123: \n124: \t\tif (this._unsubscribeSession) {\n125: \t\t\tthis._unsubscribeSession();\n126: \t\t\tthis._unsubscribeSession = undefined;\n127: \t\t}\n128: \t}\n129: \n130: \tprivate setupSessionSubscription() {\n131: \t\tif (this._unsubscribeSession) {\n132: \t\t\tthis._unsubscribeSession();\n133: \t\t\tthis._unsubscribeSession = undefined;\n134: \t\t}\n135: \t\tif (!this.session) return;\n136: \n137: \t\t// Set default streamFn with proxy support if not already set\n138: \t\tif (this.session.streamFn === streamSimple) {\n139: \t\t\tthis.session.streamFn = createStreamFn(async () => {\n140: \t\t\t\tconst enabled = await getAppStorage().settings.get<boolean>(\"proxy.enabled\");\n141: \t\t\t\treturn enabled ? (await getAppStorage().settings.get<string>(\"proxy.url\")) || undefined : undefined;\n142: \t\t\t});\n143: \t\t}\n144: \n145: \t\t// Set default getApiKey if not already set\n146: \t\tif (!this.session.getApiKey) {\n147: \t\t\tthis.session.getApiKey = async (provider: string) => {\n148: \t\t\t\tconst key = await getAppStorage().providerKeys.get(provider);\n149: \t\t\t\treturn key ?? undefined;\n150: \t\t\t};\n151: \t\t}\n152: \n153: \t\tthis._unsubscribeSession = this.session.subscribe(async (ev: AgentEvent) => {\n154: \t\t\tswitch (ev.type) {\n155: \t\t\t\tcase \"message_start\":\n156: \t\t\t\tcase \"turn_start\":\n157: \t\t\t\tcase \"turn_end\":\n158: \t\t\t\tcase \"agent_start\":\n159: \t\t\t\t\tthis.requestUpdate();\n160: \t\t\t\t\tbreak;\n161: \t\t\t\tcase \"message_end\":\n162: \t\t\t\t\t// Clear streaming container when a message completes\n163: \t\t\t\t\t// to prevent duplicate rendering (stable list now has this message)\n164: \t\t\t\t\tif (this._streamingContainer) {\n165: \t\t\t\t\t\tthis._streamingContainer.setMessage(null, true);\n166: \t\t\t\t\t}\n167: \t\t\t\t\tthis.requestUpdate();\n168: \t\t\t\t\tbreak;\n169: \t\t\t\tcase \"agent_end\":\n170: \t\t\t\t\t// Clear streaming container when agent finishes\n171: \t\t\t\t\tif (this._streamingContainer) {\n172: \t\t\t\t\t\tthis._streamingContainer.isStreaming = false;\n173: \t\t\t\t\t\tthis._streamingContainer.setMessage(null, true);\n174: \t\t\t\t\t}\n175: \t\t\t\t\tthis.requestUpdate();\n176: \t\t\t\t\tbreak;\n177: \t\t\t\tcase \"message_update\":\n178: \t\t\t\t\tif (this._streamingContainer) {\n179: \t\t\t\t\t\tconst isStreaming = this.session?.state.isStreaming || false;\n180: \t\t\t\t\t\tthis._streamingContainer.isStreaming = isStreaming;\n181: \t\t\t\t\t\tthis._streamingContainer.setMessage(ev.message, !isStreaming);\n182: \t\t\t\t\t}\n183: \t\t\t\t\tthis.requestUpdate();\n184: \t\t\t\t\tbreak;\n185: \t\t\t}\n186: \t\t});\n187: \t}\n188: \n189: \tprivate _handleScroll = (_ev: any) => {\n190: \t\tif (!this._scrollContainer) return;\n191: \n192: \t\tconst currentScrollTop = this._scrollContainer.scrollTop;\n193: \t\tconst scrollHeight = this._scrollContainer.scrollHeight;\n194: \t\tconst clientHeight = this._scrollContainer.clientHeight;\n195: \t\tconst distanceFromBottom = scrollHeight - currentScrollTop - clientHeight;\n196: \n197: \t\t// Ignore relayout due to message editor getting pushed up by stats\n198: \t\tif (clientHeight < this._lastClientHeight) {\n199: \t\t\tthis._lastClientHeight = clientHeight;\n200: \t\t\treturn;\n201: \t\t}\n202: \n203: \t\t// Only disable auto-scroll if user scrolled UP or is far from bottom\n204: \t\tif (currentScrollTop !== 0 && currentScrollTop < this._lastScrollTop && distanceFromBottom > 50) {\n205: \t\t\tthis._autoScroll = false;\n206: \t\t} else if (distanceFromBottom < 10) {\n207: \t\t\t// Re-enable if very close to bottom\n208: \t\t\tthis._autoScroll = true;\n209: \t\t}\n210: \n211: \t\tthis._lastScrollTop = currentScrollTop;\n212: \t\tthis._lastClientHeight = clientHeight;\n213: \t};\n214: \n215: \tpublic async sendMessage(input: string, attachments?: Attachment[]) {\n216: \t\tif ((!input.trim() && attachments?.length === 0) || this.session?.state.isStreaming) return;\n217: \t\tconst session = this.session;\n218: \t\tif (!session) throw new Error(\"No session set on AgentInterface\");\n219: \t\tif (!session.state.model) throw new Error(\"No model set on AgentInterface\");\n220: \n221: \t\t// Check if API key exists for the provider (only needed in direct mode)\n222: \t\tconst provider = session.state.model.provider;\n223: \t\tconst apiKey = await getAppStorage().providerKeys.get(provider);\n224: \n225: \t\t// If no API key, prompt for it\n226: \t\tif (!apiKey) {\n227: \t\t\tif (!this.onApiKeyRequired) {\n228: \t\t\t\tconsole.error(\"No API key configured and no onApiKeyRequired handler set\");\n229: \t\t\t\treturn;\n230: \t\t\t}\n231: \n232: \t\t\tconst success = await this.onApiKeyRequired(provider);\n233: \n234: \t\t\t// If still no API key, abort the send\n235: \t\t\tif (!success) {\n236: \t\t\t\treturn;\n237: \t\t\t}\n238: \t\t}\n239: \n240: \t\t// Call onBeforeSend hook before sending\n241: \t\tif (this.onBeforeSend) {\n242: \t\t\tawait this.onBeforeSend();\n243: \t\t}\n244: \n245: \t\t// Only clear editor after we know we can send\n246: \t\tthis._messageEditor.value = \"\";\n247: \t\tthis._messageEditor.attachments = [];\n248: \t\tthis._autoScroll = true; // Enable auto-scroll when sending a message\n249: \n250: \t\t// Compose message with attachments if any\n251: \t\tif (attachments && attachments.length > 0) {\n252: \t\t\tconst message: UserMessageWithAttachments = {\n253: \t\t\t\trole: \"user-with-attachments\",\n254: \t\t\t\tcontent: input,\n255: \t\t\t\tattachments,\n256: \t\t\t\ttimestamp: Date.now(),\n257: \t\t\t};\n258: \t\t\tawait this.session?.prompt(message);\n259: \t\t} else {\n260: \t\t\tawait this.session?.prompt(input);\n261: \t\t}\n262: \t}\n263: \n264: \tprivate renderMessages() {\n265: \t\tif (!this.session)\n266: \t\t\treturn html`<div class=\"p-4 text-center text-muted-foreground\">${i18n(\"No session available\")}</div>`;\n267: \t\tconst state = this.session.state;\n268: \t\t// Build a map of tool results to allow inline rendering in assistant messages\n269: \t\tconst toolResultsById = new Map<string, ToolResultMessage<any>>();\n270: \t\tfor (const message of state.messages) {\n271: \t\t\tif (message.role === \"toolResult\") {\n272: \t\t\t\ttoolResultsById.set(message.toolCallId, message);\n273: \t\t\t}\n274: \t\t}\n275: \t\treturn html`\n276: \t\t\t<div class=\"flex flex-col gap-3\">\n277: \t\t\t\t<!-- Stable messages list - won't re-render during streaming -->\n278: \t\t\t\t<message-list\n279: \t\t\t\t\t.messages=${this.session.state.messages}\n280: \t\t\t\t\t.tools=${state.tools}\n281: \t\t\t\t\t.pendingToolCalls=${this.session ? this.session.state.pendingToolCalls : new Set<string>()}\n282: \t\t\t\t\t.isStreaming=${state.isStreaming}\n283: \t\t\t\t\t.onCostClick=${this.onCostClick}\n284: \t\t\t\t></message-list>\n285: \n286: \t\t\t\t<!-- Streaming message container - manages its own updates -->\n287: \t\t\t\t<streaming-message-container\n288: \t\t\t\t\tclass=\"${state.isStreaming ? \"\" : \"hidden\"}\"\n289: \t\t\t\t\t.tools=${state.tools}\n290: \t\t\t\t\t.isStreaming=${state.isStreaming}\n291: \t\t\t\t\t.pendingToolCalls=${state.pendingToolCalls}\n292: \t\t\t\t\t.toolResultsById=${toolResultsById}\n293: \t\t\t\t\t.onCostClick=${this.onCostClick}\n294: \t\t\t\t></streaming-message-container>\n295: \t\t\t</div>\n296: \t\t`;\n297: \t}\n298: \n299: \tprivate renderStats() {\n300: \t\tif (!this.session) return html`<div class=\"text-xs h-5\"></div>`;\n301: \n302: \t\tconst state = this.session.state;\n303: \t\tconst totals = state.messages\n304: \t\t\t.filter((m) => m.role === \"assistant\")\n305: \t\t\t.reduce(\n306: \t\t\t\t(acc, msg: any) => {\n307: \t\t\t\t\tconst usage = msg.usage;\n308: \t\t\t\t\tif (usage) {\n309: \t\t\t\t\t\tacc.input += usage.input;\n310: \t\t\t\t\t\tacc.output += usage.output;\n311: \t\t\t\t\t\tacc.cacheRead += usage.cacheRead;\n312: \t\t\t\t\t\tacc.cacheWrite += usage.cacheWrite;\n313: \t\t\t\t\t\tacc.cost.total += usage.cost.total;\n314: \t\t\t\t\t}\n315: \t\t\t\t\treturn acc;\n316: \t\t\t\t},\n317: \t\t\t\t{\n318: \t\t\t\t\tinput: 0,\n319: \t\t\t\t\toutput: 0,\n320: \t\t\t\t\tcacheRead: 0,\n321: \t\t\t\t\tcacheWrite: 0,\n322: \t\t\t\t\ttotalTokens: 0,\n323: \t\t\t\t\tcost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },\n324: \t\t\t\t} satisfies Usage,\n325: \t\t\t);\n326: \n327: \t\tconst hasTotals = totals.input || totals.output || totals.cacheRead || totals.cacheWrite;\n328: \t\tconst totalsText = hasTotals ? formatUsage(totals) : \"\";\n329: \n330: \t\treturn html`\n331: \t\t\t<div class=\"text-xs text-muted-foreground flex justify-between items-center h-5\">\n332: \t\t\t\t<div class=\"flex items-center gap-1\">\n333: \t\t\t\t\t${this.showThemeToggle ? html`<theme-toggle></theme-toggle>` : html``}\n334: \t\t\t\t</div>\n335: \t\t\t\t<div class=\"flex ml-auto items-center gap-3\">\n336: \t\t\t\t\t${\n337: \t\t\t\t\t\ttotalsText\n338: \t\t\t\t\t\t\t? this.onCostClick\n339: \t\t\t\t\t\t\t\t? html`<span class=\"cursor-pointer hover:text-foreground transition-colors\" @click=${this.onCostClick}>${totalsText}</span>`\n340: \t\t\t\t\t\t\t\t: html`<span>${totalsText}</span>`\n341: \t\t\t\t\t\t\t: \"\"\n342: \t\t\t\t\t}\n343: \t\t\t\t</div>\n344: \t\t\t</div>\n345: \t\t`;\n346: \t}\n347: \n348: \toverride render() {\n349: \t\tif (!this.session)\n350: \t\t\treturn html`<div class=\"p-4 text-center text-muted-foreground\">${i18n(\"No session set\")}</div>`;\n351: \n352: \t\tconst session = this.session;\n353: \t\tconst state = this.session.state;\n354: \t\treturn html`\n355: \t\t\t<div class=\"flex flex-col h-full bg-background text-foreground\">\n356: \t\t\t\t<!-- Messages Area -->\n357: \t\t\t\t<div class=\"flex-1 overflow-y-auto\">\n358: \t\t\t\t\t<div class=\"max-w-3xl mx-auto p-4 pb-0\">${this.renderMessages()}</div>\n359: \t\t\t\t</div>\n360: \n361: \t\t\t\t<!-- Input Area -->\n362: \t\t\t\t<div class=\"shrink-0\">\n363: \t\t\t\t\t<div class=\"max-w-3xl mx-auto px-2\">\n364: \t\t\t\t\t\t<message-editor\n365: \t\t\t\t\t\t\t.isStreaming=${state.isStreaming}\n366: \t\t\t\t\t\t\t.currentModel=${state.model}\n367: \t\t\t\t\t\t\t.thinkingLevel=${state.thinkingLevel}\n368: \t\t\t\t\t\t\t.showAttachmentButton=${this.enableAttachments}\n369: \t\t\t\t\t\t\t.showModelSelector=${this.enableModelSelector}\n370: \t\t\t\t\t\t\t.showThinkingSelector=${this.enableThinkingSelector}\n371: \t\t\t\t\t\t\t.onSend=${(input: string, attachments: Attachment[]) => {\n372: \t\t\t\t\t\t\t\tthis.sendMessage(input, attachments);\n373: \t\t\t\t\t\t\t}}\n374: \t\t\t\t\t\t\t.onAbort=${() => session.abort()}\n375: \t\t\t\t\t\t\t.onModelSelect=${() => {\n376: \t\t\t\t\t\t\t\tif (this.onModelSelect) {\n377: \t\t\t\t\t\t\t\t\tthis.onModelSelect();\n378: \t\t\t\t\t\t\t\t} else {\n379: \t\t\t\t\t\t\t\t\tModelSelector.open(state.model, (model) => {\n380: \t\t\t\t\t\t\t\t\t\tsession.state.model = model;\n381: \t\t\t\t\t\t\t\t\t});\n382: \t\t\t\t\t\t\t\t}\n383: \t\t\t\t\t\t\t}}\n384: \t\t\t\t\t\t\t.onThinkingChange=${\n385: \t\t\t\t\t\t\t\tthis.enableThinkingSelector\n386: \t\t\t\t\t\t\t\t\t? (level: \"off\" | \"minimal\" | \"low\" | \"medium\" | \"high\") => {\n387: \t\t\t\t\t\t\t\t\t\t\tsession.state.thinkingLevel = level;\n388: \t\t\t\t\t\t\t\t\t\t}\n389: \t\t\t\t\t\t\t\t\t: undefined\n390: \t\t\t\t\t\t\t}\n391: \t\t\t\t\t\t></message-editor>\n392: \t\t\t\t\t\t${this.renderStats()}\n393: \t\t\t\t\t</div>\n394: \t\t\t\t</div>\n395: \t\t\t</div>\n396: \t\t`;\n397: \t}\n398: }\n399: \n400: // Register custom element with guard\n401: if (!customElements.get(\"agent-interface\")) {\n402: \tcustomElements.define(\"agent-interface\", AgentInterface);\n403: }",
  "absolutePath": "/Users/lunelson/Clones/earendil-works/pi/packages/web-ui/src/components/AgentInterface.ts"
}
```

**Tool Result:** `TU-033IAgz6dUlzk0S2QMRNqA`

```
{
  "content": "1: /**\n2:  * Centralized tool prompts/descriptions.\n3:  * Each prompt is either a string constant or a template function.\n4:  */\n5: \n6: // ============================================================================\n7: // JavaScript REPL Tool\n8: // ============================================================================\n9: \n10: export const JAVASCRIPT_REPL_TOOL_DESCRIPTION = (runtimeProviderDescriptions: string[]) => `# JavaScript REPL\n11: \n12: ## Purpose\n13: Execute JavaScript code in a sandboxed browser environment with full Web APIs.\n14: \n15: ## When to Use\n16: - Quick calculations or data transformations\n17: - Testing JavaScript code snippets in isolation\n18: - Processing data with libraries (XLSX, CSV, etc.)\n19: - Creating artifacts from data\n20: \n21: ## Environment\n22: - ES2023+ JavaScript (async/await, optional chaining, nullish coalescing, etc.)\n23: - All browser APIs: DOM, Canvas, WebGL, Fetch, Web Workers, WebSockets, Crypto, etc.\n24: - Import any npm package: await import('https://esm.run/package-name')\n25: \n26: ## Common Libraries\n27: - XLSX: const XLSX = await import('https://esm.run/xlsx');\n28: - CSV: const Papa = (await import('https://esm.run/papaparse')).default;\n29: - Chart.js: const Chart = (await import('https://esm.run/chart.js/auto')).default;\n30: - Three.js: const THREE = await import('https://esm.run/three');\n31: \n32: ## Persistence between tool calls\n33: - Objects stored on global scope do not persist between calls.\n34: - Use artifacts as a key-value JSON object store:\n35:   - Use createOrUpdateArtifact(filename, content) to persist data between calls. JSON objects are auto-stringified.\n36:   - Use listArtifacts() and getArtifact(filename) to read persisted data. JSON files are auto-parsed to objects.\n37:   - Prefer to use a single artifact throughout the session to store intermediate data (e.g. 'data.json').\n38: \n39: ## Input\n40: - You have access to the user's attachments via listAttachments(), readTextAttachment(id), and readBinaryAttachment(id)\n41: - You have access to previously created artifacts via listArtifacts() and getArtifact(filename)\n42: \n43: ## Output\n44: - All console.log() calls are captured for you to inspect. The user does not see these logs.\n45: - Create artifacts for file results (images, JSON, CSV, etc.) which persiste throughout the\n46:   session and are accessible to you and the user.\n47: \n48: ## Example\n49: const data = [10, 20, 15, 25];\n50: const sum = data.reduce((a, b) => a + b, 0);\n51: const avg = sum / data.length;\n52: console.log('Sum:', sum, 'Average:', avg);\n53: \n54: ## Important Notes\n55: - Graphics: Use fixed dimensions (800x600), NOT window.innerWidth/Height\n56: - Chart.js: Set options: { responsive: false, animation: false }\n57: - Three.js: renderer.setSize(800, 600) with matching aspect ratio\n58: \n59: ## Helper Functions (Automatically Available)\n60: \n61: These functions are injected into the execution environment and available globally:\n62: \n63: ${runtimeProviderDescriptions.join(\"\\n\\n\")}\n64: `;\n65: \n66: // ============================================================================\n67: // Artifacts Tool\n68: // ============================================================================\n69: \n70: export const ARTIFACTS_TOOL_DESCRIPTION = (runtimeProviderDescriptions: string[]) => `# Artifacts\n71: \n72: Create and manage persistent files that live alongside the conversation.\n73: \n74: ## When to Use - Artifacts Tool vs REPL\n75: \n76: **Use artifacts tool when YOU are the author:**\n77: - Writing research summaries, analysis, ideas, documentation\n78: - Creating markdown notes for user to read\n79: - Building HTML applications/visualizations that present data\n80: - Creating HTML artifacts that render charts from programmatically generated data\n81: \n82: **Use repl + artifact storage functions when CODE processes data:**\n83: - Scraping workflows that extract and store data\n84: - Processing CSV/Excel files programmatically\n85: - Data transformation pipelines\n86: - Binary file generation requiring libraries (PDF, DOCX)\n87: \n88: **Pattern: REPL generates data → Artifacts tool creates HTML that visualizes it**\n89: Example: repl scrapes products → stores products.json → you author dashboard.html that reads products.json and renders Chart.js visualizations\n90: \n91: ## Input\n92: - { action: \"create\", filename: \"notes.md\", content: \"...\" } - Create new file\n93: - { action: \"update\", filename: \"notes.md\", old_str: \"...\", new_str: \"...\" } - Update part of file (PREFERRED)\n94: - { action: \"rewrite\", filename: \"notes.md\", content: \"...\" } - Replace entire file (LAST RESORT)\n95: - { action: \"get\", filename: \"data.json\" } - Retrieve file content\n96: - { action: \"delete\", filename: \"old.csv\" } - Delete file\n97: - { action: \"htmlArtifactLogs\", filename: \"app.html\" } - Get console logs from HTML artifact\n98: \n99: ## Returns\n100: Depends on action:\n101: - create/update/rewrite/delete: Success status or error\n102: - get: File content\n103: - htmlArtifactLogs: Console logs and errors\n104: \n105: ## Supported File Types\n106: ✅ Text-based files you author: .md, .txt, .html, .js, .css, .json, .csv, .svg\n107: ❌ Binary files requiring libraries (use repl): .pdf, .docx\n108: \n109: ## Critical - Prefer Update Over Rewrite\n110: ❌ NEVER: get entire file + rewrite to change small sections\n111: ✅ ALWAYS: update for targeted edits (token efficient)\n112: ✅ Ask: Can I describe the change as old_str → new_str? Use update.\n113: \n114: ---\n115: \n116: ## HTML Artifacts\n117: \n118: Interactive HTML applications that can visualize data from other artifacts.\n119: \n120: ### Data Access\n121: - Can read artifacts created by repl and user attachments\n122: - Use to build dashboards, visualizations, interactive tools\n123: - See Helper Functions section below for available functions\n124: \n125: ### Requirements\n126: - Self-contained single file\n127: - Import ES modules from esm.sh: <script type=\"module\">import X from 'https://esm.sh/pkg';</script>\n128: - Use Tailwind CDN: <script src=\"https://cdn.tailwindcss.com\"></script>\n129: - Can embed images from any domain: <img src=\"https://example.com/image.jpg\">\n130: - MUST set background color explicitly (avoid transparent)\n131: - Inline CSS or Tailwind utility classes\n132: - No localStorage/sessionStorage\n133: \n134: ### Styling\n135: - Use Tailwind utility classes for clean, functional designs\n136: - Ensure responsive layout (iframe may be resized)\n137: - Avoid purple gradients, AI aesthetic clichés, and emojis\n138: \n139: ### Helper Functions (Automatically Available)\n140: \n141: These functions are injected into HTML artifact sandbox:\n142: \n143: ${runtimeProviderDescriptions.join(\"\\n\\n\")}\n144: `;\n145: \n146: // ============================================================================\n147: // Artifacts Runtime Provider\n148: // ============================================================================\n149: \n150: export const ARTIFACTS_RUNTIME_PROVIDER_DESCRIPTION_RW = `\n151: ### Artifacts Storage\n152: \n153: Create, read, update, and delete files in artifacts storage.\n154: \n155: #### When to Use\n156: - Store intermediate results between tool calls\n157: - Save generated files (images, CSVs, processed data) for user to view and download\n158: \n159: #### Do NOT Use For\n160: - Content you author directly, like summaries of content you read (use artifacts tool instead)\n161: \n162: #### Functions\n163: - listArtifacts() - List all artifact filenames, returns Promise<string[]>\n164: - getArtifact(filename) - Read artifact content, returns Promise<string | object>. JSON files auto-parse to objects, binary files return base64 string\n165: - createOrUpdateArtifact(filename, content, mimeType?) - Create or update artifact, returns Promise<void>. JSON files auto-stringify objects, binary requires base64 string with mimeType\n166: - deleteArtifact(filename) - Delete artifact, returns Promise<void>\n167: \n168: #### Example\n169: JSON workflow:\n170: \\`\\`\\`javascript\n171: // Fetch and save\n172: const response = await fetch('https://api.example.com/products');\n173: const products = await response.json();\n174: await createOrUpdateArtifact('products.json', products);\n175: \n176: // Later: read and filter\n177: const all = await getArtifact('products.json');\n178: const cheap = all.filter(p => p.price < 100);\n179: await createOrUpdateArtifact('cheap.json', cheap);\n180: \\`\\`\\`\n181: \n182: Binary file (image):\n183: \\`\\`\\`javascript\n184: const canvas = document.createElement('canvas');\n185: canvas.width = 800; canvas.height = 600;\n186: const ctx = canvas.getContext('2d');\n187: ctx.fillStyle = 'blue';\n188: ctx.fillRect(0, 0, 800, 600);\n189: // Remove data:image/png;base64, prefix\n190: const base64 = canvas.toDataURL().split(',')[1];\n191: await createOrUpdateArtifact('chart.png', base64, 'image/png');\n192: \\`\\`\\`\n193: `;\n194: \n195: export const ARTIFACTS_RUNTIME_PROVIDER_DESCRIPTION_RO = `\n196: ### Artifacts Storage\n197: \n198: Read files from artifacts storage.\n199: \n200: #### When to Use\n201: - Read artifacts created by REPL or artifacts tool\n202: - Access data from other HTML artifacts\n203: - Load configuration or data files\n204: \n205: #### Do NOT Use For\n206: - Creating new artifacts (not available in HTML artifacts)\n207: - Modifying artifacts (read-only access)\n208: \n209: #### Functions\n210: - listArtifacts() - List all artifact filenames, returns Promise<string[]>\n211: - getArtifact(filename) - Read artifact content, returns Promise<string | object>. JSON files auto-parse to objects, binary files return base64 string\n212: \n213: #### Example\n214: JSON data:\n215: \\`\\`\\`javascript\n216: const products = await getArtifact('products.json');\n217: const html = products.map(p => \\`<div>\\${p.name}: $\\${p.price}</div>\\`).join('');\n218: document.body.innerHTML = html;\n219: \\`\\`\\`\n220: \n221: Binary image:\n222: \\`\\`\\`javascript\n223: const base64 = await getArtifact('chart.png');\n224: const img = document.createElement('img');\n225: img.src = 'data:image/png;base64,' + base64;\n226: document.body.appendChild(img);\n227: \\`\\`\\`\n228: `;\n229: \n230: // ============================================================================\n231: // Attachments Runtime Provider\n232: // ============================================================================\n233: \n234: export const ATTACHMENTS_RUNTIME_DESCRIPTION = `\n235: ### User Attachments\n236: \n237: Read files the user uploaded to the conversation.\n238: \n239: #### When to Use\n240: - Process user-uploaded files (CSV, JSON, Excel, images, PDFs)\n241: \n242: #### Functions\n243: - listAttachments() - List all attachments, returns array of {id, fileName, mimeType, size}\n244: - readTextAttachment(id) - Read attachment as text, returns string\n245: - readBinaryAttachment(id) - Read attachment as binary data, returns Uint8Array\n246: \n247: #### Example\n248: CSV file:\n249: \\`\\`\\`javascript\n250: const files = listAttachments();\n251: const csvFile = files.find(f => f.fileName.endsWith('.csv'));\n252: const csvData = readTextAttachment(csvFile.id);\n253: const rows = csvData.split('\\\\n').map(row => row.split(','));\n254: \\`\\`\\`\n255: \n256: Excel file:\n257: \\`\\`\\`javascript\n258: const XLSX = await import('https://esm.run/xlsx');\n259: const files = listAttachments();\n260: const xlsxFile = files.find(f => f.fileName.endsWith('.xlsx'));\n261: const bytes = readBinaryAttachment(xlsxFile.id);\n262: const workbook = XLSX.read(bytes);\n263: const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);\n264: \\`\\`\\`\n265: `;\n266: \n267: // ============================================================================\n268: // Extract Document Tool\n269: // ============================================================================\n270: \n271: export const EXTRACT_DOCUMENT_DESCRIPTION = `# Extract Document\n272: \n273: Extract plain text from documents on the web (PDF, DOCX, XLSX, PPTX).\n274: \n275: ## When to Use\n276: User wants you to read a document at a URL.\n277: \n278: ## Input\n279: - { url: \"https://example.com/document.pdf\" } - URL to PDF, DOCX, XLSX, or PPTX\n280: \n281: ## Returns\n282: Structured plain text with page/sheet/slide delimiters.`;",
  "absolutePath": "/Users/lunelson/Clones/earendil-works/pi/packages/web-ui/src/prompts/prompts.ts"
}
```

## Assistant

Here's the picture — and an important asymmetry between the two sides.

### What's actually shared in `pi-agent-core`

Surprisingly little of the prompt-composition logic is in the core. The core provides:

- The **`Agent` class** with `state.messages`, `state.tools`, `state.model`, and a `prompt()` method. The Agent does not build a system prompt; it receives whatever messages it's handed.
- The **agent loop** (`agent-loop.ts`) — stream, accumulate tool calls, run tools, append results, loop.
- A tiny helper, `formatSkillsForSystemPrompt`, that emits a `<available_skills>` XML block. That's the entire shared "prompt building" surface — 34 lines.
- A **prompt template loader** (`prompt-templates.ts`, 267 lines) that loads `.md` files with YAML frontmatter and supports `$1`, `$@`, `$ARGUMENTS` substitution. This is what slash commands are made of.

So the core says: *here's how a turn flows and how to format skills; everything else is your problem*. The two consumers take wildly different views on "everything else."

### CLI: a built-on-the-fly system prompt around a filesystem

`coding-agent/src/core/system-prompt.ts` owns the composition. On every session start, `buildSystemPrompt` produces a single string with this layered structure:

```diagram
  ╭─ buildSystemPrompt(options) ─────────────────────────╮
  │  1. Either customPrompt OR the default coding role:  │
  │     "You are an expert coding assistant operating    │
  │      inside pi..."                                   │
  │                                                      │
  │  2. Available tools (filtered by selectedTools,      │
  │     each with a one-line snippet)                    │
  │                                                      │
  │  3. Guidelines — tool-aware:                         │
  │     - if bash but no grep/find/ls:                   │
  │         "Use bash for file operations like rg/find"  │
  │     - if bash + grep/find/ls:                        │
  │         "Prefer grep/find/ls over bash (faster,      │
  │          respects .gitignore)"                       │
  │     - plus user-supplied promptGuidelines            │
  │     - always: "Be concise", "Show file paths"        │
  │                                                      │
  │  4. Pi docs map (README/docs/examples paths)         │
  │                                                      │
  │  5. appendSystemPrompt (verbatim)                    │
  │                                                      │
  │  6. # Project Context (AGENTS.md + other context     │
  │     files loaded by ResourceLoader, each rendered    │
  │     as ## <path> + content)                          │
  │                                                      │
  │  7. <available_skills> XML (only if `read` tool      │
  │     is available; otherwise omitted)                 │
  │                                                      │
  │  8. Current date: YYYY-MM-DD                         │
  │  9. Current working directory: <cwd>                 │
  ╰──────────────────────────────────────────────────────╯
```

Key properties:

- **The prompt knows about the filesystem and the tools simultaneously.** Guidelines are computed from the actual tool selection — turn off `grep`/`find`/`ls`, and the agent is told to use `bash`. This is real coupling between prompt content and tool registration.
- **Project context is injected as text.** `AGENTS.md` and friends are read once at session start and concatenated into the system prompt under a `# Project Context` heading. That's why your project's `AGENTS.md` rules end up actually influencing the model.
- **Skills are presented as XML, not loaded.** The prompt only lists `<name>`, `<description>`, `<location>` per skill. The model reads the full skill file via the `read` tool when it decides one is relevant — which is why skills are gated on `read` being available.
- **Per-turn additions are minimal.** The system prompt is built once; subsequent turns just append the new user message (text + optional `ImageContent` for images) and let `SessionManager` keep the JSONL log. Compaction may summarize older turns to keep the context bounded.

### Web: a thin system prompt, fat tool descriptions

The web side does **not have a `buildSystemPrompt` equivalent**. There is no file in `web-ui/src/` that composes a system prompt. Instead:

- The **embedder** (the consuming app — see `web-ui/example/`) constructs the `Agent` and decides what system message it carries.
- `ChatPanel.setAgent(agent, config)` then *receives* that agent and only **augments tools**, **wires `streamFn` and `getApiKey`**, and **subscribes** to events:

  ```ts
  // ChatPanel.setAgent excerpt
  const additionalTools = config?.toolsFactory?.(...) || [];
  const tools = [this.artifactsPanel.tool, ...additionalTools];
  this.agent.state.tools = tools;
  ```

- `AgentInterface` is a pure view: it subscribes to `AgentEvent`s (`message_start`, `message_update`, `turn_end`, …) and calls `session.prompt(input)` when the user sends.

So where does the model's "orientation" come from? **From the tool descriptions themselves.** Look at `web-ui/src/prompts/prompts.ts`:

- `JAVASCRIPT_REPL_TOOL_DESCRIPTION(...)` — a ~50-line mini-manual explaining the JS environment, which packages to import from esm.run, persistence model, helpers.
- `ARTIFACTS_TOOL_DESCRIPTION(...)` — ~75 lines covering when to use artifacts vs REPL, HTML-artifact requirements, styling guidance.
- `ARTIFACTS_RUNTIME_PROVIDER_DESCRIPTION_RW` / `_RO` — describes the `listArtifacts()`, `getArtifact()`, `createOrUpdateArtifact()` API.
- `ATTACHMENTS_RUNTIME_DESCRIPTION` — describes `listAttachments()`, `readTextAttachment()`, etc.

These descriptions are concatenated **into each tool's description field**, and the runtime-provider snippets are **interpolated into the tools that expose them**. The model learns "what world am I in?" by reading the tool descriptions, not the system prompt.

### The two strategies, contrasted

|  | CLI (coding-agent) | Web (web-ui) |
|---|---|---|
| Who builds the system prompt | `buildSystemPrompt` in coding-agent | Embedder (or none at all) |
| Where the agent learns its "world" | System prompt: cwd, AGENTS.md, tool guidelines, skills XML | Tool descriptions: each tool ships a mini-manual |
| Project context | Loaded files concatenated into prompt | No project; the conversation is the project |
| Skills | Loaded from disk, listed in XML, gated on `read` | Not used |
| Attachments | Text/image inlined as message content | Stored on `UserMessageWithAttachments`; tool runtime exposes them via JS APIs (`listAttachments()`) — the LLM-generated code reads them at runtime, not the prompt |
| Persistence | JSONL via `SessionManager`, compaction-aware | IndexedDB via `SessionsStore` |
| Per-turn additions | Minimal: new user message | Minimal: new user message; attachments referenced by id |
| Coupling between tools and prompt | Tight: guidelines change with tool set | Loose: each tool is self-describing |

### Why this asymmetry exists (and what it implies)

It maps to the two environments cleanly:

- **The CLI has a fixed world** — a working directory, a project, a small stable tool vocabulary. So the system prompt can be authoritative about the world ("you are in `/Users/.../pi`, here are your tools, here are the project rules") and the tool descriptions can stay terse.
- **The web has a malleable world** — no cwd, no project files, tools added by the embedder (`toolsFactory`), arbitrary attachment types in IndexedDB. So the system prompt can't predict the world; instead, each tool carries the orientation needed to use it, and runtime providers (artifacts/attachments) extend that orientation by composing their own description fragments into the tools they augment.

The consequence for your earlier record-server speculation: the **CLI side would integrate record tools by extending `buildSystemPrompt`** (adding a "Records" section like "Project Context", plus tool snippets and guidelines), while the **web side would integrate them as fat self-describing tools** (an `RecordsToolRenderer` plus tool descriptions that explain the schema and authority model). Same record server, two prompt-composition idioms — both already supported by the existing seams.

## User

OK and within a single conversation: I assume that along with the user prompt at each turn, the actual inference call receives this *preceded by some kind of rendering of the transcript up to this point*, does it not? how is that controlled?

## Assistant

**Tool Use:** `Read`

```json
{
  "path": "/Users/lunelson/Clones/earendil-works/pi/packages/agent/src/agent.ts"
}
```

## User

**Tool Result:** `TU-033IAtZnhXRoUNm6wp9nl4`

```
{
  "content": "1: import {\n2: \ttype ImageContent,\n3: \ttype Message,\n4: \ttype Model,\n5: \ttype SimpleStreamOptions,\n6: \tstreamSimple,\n7: \ttype TextContent,\n8: \ttype ThinkingBudgets,\n9: \ttype Transport,\n10: } from \"@earendil-works/pi-ai\";\n11: import { runAgentLoop, runAgentLoopContinue } from \"./agent-loop.js\";\n12: import type {\n13: \tAfterToolCallContext,\n14: \tAfterToolCallResult,\n15: \tAgentContext,\n16: \tAgentEvent,\n17: \tAgentLoopConfig,\n18: \tAgentLoopTurnUpdate,\n19: \tAgentMessage,\n20: \tAgentState,\n21: \tAgentTool,\n22: \tBeforeToolCallContext,\n23: \tBeforeToolCallResult,\n24: \tQueueMode,\n25: \tStreamFn,\n26: \tToolExecutionMode,\n27: } from \"./types.js\";\n28: \n29: export type { QueueMode } from \"./types.js\";\n30: \n31: function defaultConvertToLlm(messages: AgentMessage[]): Message[] {\n32: \treturn messages.filter(\n33: \t\t(message) => message.role === \"user\" || message.role === \"assistant\" || message.role === \"toolResult\",\n34: \t);\n35: }\n36: \n37: const EMPTY_USAGE = {\n38: \tinput: 0,\n39: \toutput: 0,\n40: \tcacheRead: 0,\n41: \tcacheWrite: 0,\n42: \ttotalTokens: 0,\n43: \tcost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },\n44: };\n45: \n46: const DEFAULT_MODEL = {\n47: \tid: \"unknown\",\n48: \tname: \"unknown\",\n49: \tapi: \"unknown\",\n50: \tprovider: \"unknown\",\n51: \tbaseUrl: \"\",\n52: \treasoning: false,\n53: \tinput: [],\n54: \tcost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },\n55: \tcontextWindow: 0,\n56: \tmaxTokens: 0,\n57: } satisfies Model<any>;\n58: \n59: type MutableAgentState = Omit<AgentState, \"isStreaming\" | \"streamingMessage\" | \"pendingToolCalls\" | \"errorMessage\"> & {\n60: \tisStreaming: boolean;\n61: \tstreamingMessage?: AgentMessage;\n62: \tpendingToolCalls: Set<string>;\n63: \terrorMessage?: string;\n64: };\n65: \n66: function createMutableAgentState(\n67: \tinitialState?: Partial<Omit<AgentState, \"pendingToolCalls\" | \"isStreaming\" | \"streamingMessage\" | \"errorMessage\">>,\n68: ): MutableAgentState {\n69: \tlet tools = initialState?.tools?.slice() ?? [];\n70: \tlet messages = initialState?.messages?.slice() ?? [];\n71: \n72: \treturn {\n73: \t\tsystemPrompt: initialState?.systemPrompt ?? \"\",\n74: \t\tmodel: initialState?.model ?? DEFAULT_MODEL,\n75: \t\tthinkingLevel: initialState?.thinkingLevel ?? \"off\",\n76: \t\tget tools() {\n77: \t\t\treturn tools;\n78: \t\t},\n79: \t\tset tools(nextTools: AgentTool<any>[]) {\n80: \t\t\ttools = nextTools.slice();\n81: \t\t},\n82: \t\tget messages() {\n83: \t\t\treturn messages;\n84: \t\t},\n85: \t\tset messages(nextMessages: AgentMessage[]) {\n86: \t\t\tmessages = nextMessages.slice();\n87: \t\t},\n88: \t\tisStreaming: false,\n89: \t\tstreamingMessage: undefined,\n90: \t\tpendingToolCalls: new Set<string>(),\n91: \t\terrorMessage: undefined,\n92: \t};\n93: }\n94: \n95: /** Options for constructing an {@link Agent}. */\n96: export interface AgentOptions {\n97: \tinitialState?: Partial<Omit<AgentState, \"pendingToolCalls\" | \"isStreaming\" | \"streamingMessage\" | \"errorMessage\">>;\n98: \tconvertToLlm?: (messages: AgentMessage[]) => Message[] | Promise<Message[]>;\n99: \ttransformContext?: (messages: AgentMessage[], signal?: AbortSignal) => Promise<AgentMessage[]>;\n100: \tstreamFn?: StreamFn;\n101: \tgetApiKey?: (provider: string) => Promise<string | undefined> | string | undefined;\n102: \tonPayload?: SimpleStreamOptions[\"onPayload\"];\n103: \tonResponse?: SimpleStreamOptions[\"onResponse\"];\n104: \tbeforeToolCall?: (context: BeforeToolCallContext, signal?: AbortSignal) => Promise<BeforeToolCallResult | undefined>;\n105: \tafterToolCall?: (context: AfterToolCallContext, signal?: AbortSignal) => Promise<AfterToolCallResult | undefined>;\n106: \tprepareNextTurn?: (\n107: \t\tsignal?: AbortSignal,\n108: \t) => Promise<AgentLoopTurnUpdate | undefined> | AgentLoopTurnUpdate | undefined;\n109: \tsteeringMode?: QueueMode;\n110: \tfollowUpMode?: QueueMode;\n111: \tsessionId?: string;\n112: \tthinkingBudgets?: ThinkingBudgets;\n113: \ttransport?: Transport;\n114: \tmaxRetryDelayMs?: number;\n115: \ttoolExecution?: ToolExecutionMode;\n116: }\n117: \n118: class PendingMessageQueue {\n119: \tprivate messages: AgentMessage[] = [];\n120: \n121: \tconstructor(public mode: QueueMode) {}\n122: \n123: \tenqueue(message: AgentMessage): void {\n124: \t\tthis.messages.push(message);\n125: \t}\n126: \n127: \thasItems(): boolean {\n128: \t\treturn this.messages.length > 0;\n129: \t}\n130: \n131: \tdrain(): AgentMessage[] {\n132: \t\tif (this.mode === \"all\") {\n133: \t\t\tconst drained = this.messages.slice();\n134: \t\t\tthis.messages = [];\n135: \t\t\treturn drained;\n136: \t\t}\n137: \n138: \t\tconst first = this.messages[0];\n139: \t\tif (!first) {\n140: \t\t\treturn [];\n141: \t\t}\n142: \t\tthis.messages = this.messages.slice(1);\n143: \t\treturn [first];\n144: \t}\n145: \n146: \tclear(): void {\n147: \t\tthis.messages = [];\n148: \t}\n149: }\n150: \n151: type ActiveRun = {\n152: \tpromise: Promise<void>;\n153: \tresolve: () => void;\n154: \tabortController: AbortController;\n155: };\n156: \n157: /**\n158:  * Stateful wrapper around the low-level agent loop.\n159:  *\n160:  * `Agent` owns the current transcript, emits lifecycle events, executes tools,\n161:  * and exposes queueing APIs for steering and follow-up messages.\n162:  */\n163: export class Agent {\n164: \tprivate _state: MutableAgentState;\n165: \tprivate readonly listeners = new Set<(event: AgentEvent, signal: AbortSignal) => Promise<void> | void>();\n166: \tprivate readonly steeringQueue: PendingMessageQueue;\n167: \tprivate readonly followUpQueue: PendingMessageQueue;\n168: \n169: \tpublic convertToLlm: (messages: AgentMessage[]) => Message[] | Promise<Message[]>;\n170: \tpublic transformContext?: (messages: AgentMessage[], signal?: AbortSignal) => Promise<AgentMessage[]>;\n171: \tpublic streamFn: StreamFn;\n172: \tpublic getApiKey?: (provider: string) => Promise<string | undefined> | string | undefined;\n173: \tpublic onPayload?: SimpleStreamOptions[\"onPayload\"];\n174: \tpublic onResponse?: SimpleStreamOptions[\"onResponse\"];\n175: \tpublic beforeToolCall?: (\n176: \t\tcontext: BeforeToolCallContext,\n177: \t\tsignal?: AbortSignal,\n178: \t) => Promise<BeforeToolCallResult | undefined>;\n179: \tpublic afterToolCall?: (\n180: \t\tcontext: AfterToolCallContext,\n181: \t\tsignal?: AbortSignal,\n182: \t) => Promise<AfterToolCallResult | undefined>;\n183: \tpublic prepareNextTurn?: (\n184: \t\tsignal?: AbortSignal,\n185: \t) => Promise<AgentLoopTurnUpdate | undefined> | AgentLoopTurnUpdate | undefined;\n186: \tprivate activeRun?: ActiveRun;\n187: \t/** Session identifier forwarded to providers for cache-aware backends. */\n188: \tpublic sessionId?: string;\n189: \t/** Optional per-level thinking token budgets forwarded to the stream function. */\n190: \tpublic thinkingBudgets?: ThinkingBudgets;\n191: \t/** Preferred transport forwarded to the stream function. */\n192: \tpublic transport: Transport;\n193: \t/** Optional cap for provider-requested retry delays. */\n194: \tpublic maxRetryDelayMs?: number;\n195: \t/** Tool execution strategy for assistant messages that contain multiple tool calls. */\n196: \tpublic toolExecution: ToolExecutionMode;\n197: \n198: \tconstructor(options: AgentOptions = {}) {\n199: \t\tthis._state = createMutableAgentState(options.initialState);\n200: \t\tthis.convertToLlm = options.convertToLlm ?? defaultConvertToLlm;\n201: \t\tthis.transformContext = options.transformContext;\n202: \t\tthis.streamFn = options.streamFn ?? streamSimple;\n203: \t\tthis.getApiKey = options.getApiKey;\n204: \t\tthis.onPayload = options.onPayload;\n205: \t\tthis.onResponse = options.onResponse;\n206: \t\tthis.beforeToolCall = options.beforeToolCall;\n207: \t\tthis.afterToolCall = options.afterToolCall;\n208: \t\tthis.prepareNextTurn = options.prepareNextTurn;\n209: \t\tthis.steeringQueue = new PendingMessageQueue(options.steeringMode ?? \"one-at-a-time\");\n210: \t\tthis.followUpQueue = new PendingMessageQueue(options.followUpMode ?? \"one-at-a-time\");\n211: \t\tthis.sessionId = options.sessionId;\n212: \t\tthis.thinkingBudgets = options.thinkingBudgets;\n213: \t\tthis.transport = options.transport ?? \"auto\";\n214: \t\tthis.maxRetryDelayMs = options.maxRetryDelayMs;\n215: \t\tthis.toolExecution = options.toolExecution ?? \"parallel\";\n216: \t}\n217: \n218: \t/**\n219: \t * Subscribe to agent lifecycle events.\n220: \t *\n221: \t * Listener promises are awaited in subscription order and are included in\n222: \t * the current run's settlement. Listeners also receive the active abort\n223: \t * signal for the current run.\n224: \t *\n225: \t * `agent_end` is the final emitted event for a run, but the agent does not\n226: \t * become idle until all awaited listeners for that event have settled.\n227: \t */\n228: \tsubscribe(listener: (event: AgentEvent, signal: AbortSignal) => Promise<void> | void): () => void {\n229: \t\tthis.listeners.add(listener);\n230: \t\treturn () => this.listeners.delete(listener);\n231: \t}\n232: \n233: \t/**\n234: \t * Current agent state.\n235: \t *\n236: \t * Assigning `state.tools` or `state.messages` copies the provided top-level array.\n237: \t */\n238: \tget state(): AgentState {\n239: \t\treturn this._state;\n240: \t}\n241: \n242: \t/** Controls how queued steering messages are drained. */\n243: \tset steeringMode(mode: QueueMode) {\n244: \t\tthis.steeringQueue.mode = mode;\n245: \t}\n246: \n247: \tget steeringMode(): QueueMode {\n248: \t\treturn this.steeringQueue.mode;\n249: \t}\n250: \n[... omitted lines 251 to 304 ...]\n305: \t */\n306: \twaitForIdle(): Promise<void> {\n307: \t\treturn this.activeRun?.promise ?? Promise.resolve();\n308: \t}\n309: \n310: \t/** Clear transcript state, runtime state, and queued messages. */\n311: \treset(): void {\n312: \t\tthis._state.messages = [];\n313: \t\tthis._state.isStreaming = false;\n314: \t\tthis._state.streamingMessage = undefined;\n315: \t\tthis._state.pendingToolCalls = new Set<string>();\n316: \t\tthis._state.errorMessage = undefined;\n317: \t\tthis.clearFollowUpQueue();\n318: \t\tthis.clearSteeringQueue();\n319: \t}\n320: \n321: \t/** Start a new prompt from text, a single message, or a batch of messages. */\n322: \tasync prompt(message: AgentMessage | AgentMessage[]): Promise<void>;\n323: \tasync prompt(input: string, images?: ImageContent[]): Promise<void>;\n324: \tasync prompt(input: string | AgentMessage | AgentMessage[], images?: ImageContent[]): Promise<void> {\n325: \t\tif (this.activeRun) {\n326: \t\t\tthrow new Error(\n327: \t\t\t\t\"Agent is already processing a prompt. Use steer() or followUp() to queue messages, or wait for completion.\",\n328: \t\t\t);\n329: \t\t}\n330: \t\tconst messages = this.normalizePromptInput(input, images);\n331: \t\tawait this.runPromptMessages(messages);\n332: \t}\n333: \n334: \t/** Continue from the current transcript. The last message must be a user or tool-result message. */\n335: \tasync continue(): Promise<void> {\n336: \t\tif (this.activeRun) {\n337: \t\t\tthrow new Error(\"Agent is already processing. Wait for completion before continuing.\");\n338: \t\t}\n339: \n340: \t\tconst lastMessage = this._state.messages[this._state.messages.length - 1];\n341: \t\tif (!lastMessage) {\n342: \t\t\tthrow new Error(\"No messages to continue from\");\n343: \t\t}\n344: \n345: \t\tif (lastMessage.role === \"assistant\") {\n346: \t\t\tconst queuedSteering = this.steeringQueue.drain();\n347: \t\t\tif (queuedSteering.length > 0) {\n348: \t\t\t\tawait this.runPromptMessages(queuedSteering, { skipInitialSteeringPoll: true });\n349: \t\t\t\treturn;\n350: \t\t\t}\n351: \n352: \t\t\tconst queuedFollowUps = this.followUpQueue.drain();\n353: \t\t\tif (queuedFollowUps.length > 0) {\n354: \t\t\t\tawait this.runPromptMessages(queuedFollowUps);\n355: \t\t\t\treturn;\n356: \t\t\t}\n357: \n358: \t\t\tthrow new Error(\"Cannot continue from message role: assistant\");\n359: \t\t}\n360: \n361: \t\tawait this.runContinuation();\n362: \t}\n363: \n364: \tprivate normalizePromptInput(\n365: \t\tinput: string | AgentMessage | AgentMessage[],\n366: \t\timages?: ImageContent[],\n367: \t): AgentMessage[] {\n368: \t\tif (Array.isArray(input)) {\n369: \t\t\treturn input;\n370: \t\t}\n371: \n372: \t\tif (typeof input !== \"string\") {\n373: \t\t\treturn [input];\n374: \t\t}\n375: \n376: \t\tconst content: Array<TextContent | ImageContent> = [{ type: \"text\", text: input }];\n377: \t\tif (images && images.length > 0) {\n378: \t\t\tcontent.push(...images);\n379: \t\t}\n380: \t\treturn [{ role: \"user\", content, timestamp: Date.now() }];\n381: \t}\n382: \n383: \tprivate async runPromptMessages(\n384: \t\tmessages: AgentMessage[],\n385: \t\toptions: { skipInitialSteeringPoll?: boolean } = {},\n386: \t): Promise<void> {\n387: \t\tawait this.runWithLifecycle(async (signal) => {\n388: \t\t\tawait runAgentLoop(\n389: \t\t\t\tmessages,\n390: \t\t\t\tthis.createContextSnapshot(),\n391: \t\t\t\tthis.createLoopConfig(options),\n392: \t\t\t\t(event) => this.processEvents(event),\n393: \t\t\t\tsignal,\n394: \t\t\t\tthis.streamFn,\n395: \t\t\t);\n396: \t\t});\n397: \t}\n398: \n399: \tprivate async runContinuation(): Promise<void> {\n400: \t\tawait this.runWithLifecycle(async (signal) => {\n401: \t\t\tawait runAgentLoopContinue(\n402: \t\t\t\tthis.createContextSnapshot(),\n403: \t\t\t\tthis.createLoopConfig(),\n404: \t\t\t\t(event) => this.processEvents(event),\n405: \t\t\t\tsignal,\n406: \t\t\t\tthis.streamFn,\n407: \t\t\t);\n408: \t\t});\n409: \t}\n410: \n411: \tprivate createContextSnapshot(): AgentContext {\n412: \t\treturn {\n413: \t\t\tsystemPrompt: this._state.systemPrompt,\n414: \t\t\tmessages: this._state.messages.slice(),\n415: \t\t\ttools: this._state.tools.slice(),\n416: \t\t};\n417: \t}\n418: \n419: \tprivate createLoopConfig(options: { skipInitialSteeringPoll?: boolean } = {}): AgentLoopConfig {\n420: \t\tlet skipInitialSteeringPoll = options.skipInitialSteeringPoll === true;\n421: \t\treturn {\n422: \t\t\tmodel: this._state.model,\n423: \t\t\treasoning: this._state.thinkingLevel === \"off\" ? undefined : this._state.thinkingLevel,\n424: \t\t\tsessionId: this.sessionId,\n425: \t\t\tonPayload: this.onPayload,\n426: \t\t\tonResponse: this.onResponse,\n427: \t\t\ttransport: this.transport,\n428: \t\t\tthinkingBudgets: this.thinkingBudgets,\n429: \t\t\tmaxRetryDelayMs: this.maxRetryDelayMs,\n430: \t\t\ttoolExecution: this.toolExecution,\n431: \t\t\tbeforeToolCall: this.beforeToolCall,\n432: \t\t\tafterToolCall: this.afterToolCall,\n433: \t\t\tprepareNextTurn: this.prepareNextTurn ? async () => await this.prepareNextTurn?.(this.signal) : undefined,\n434: \t\t\tconvertToLlm: this.convertToLlm,\n435: \t\t\ttransformContext: this.transformContext,\n436: \t\t\tgetApiKey: this.getApiKey,\n437: \t\t\tgetSteeringMessages: async () => {\n438: \t\t\t\tif (skipInitialSteeringPoll) {\n439: \t\t\t\t\tskipInitialSteeringPoll = false;\n440: \t\t\t\t\treturn [];\n441: \t\t\t\t}\n442: \t\t\t\treturn this.steeringQueue.drain();\n443: \t\t\t},\n444: \t\t\tgetFollowUpMessages: async () => this.followUpQueue.drain(),\n445: \t\t};\n446: \t}\n447: \n448: \tprivate async runWithLifecycle(executor: (signal: AbortSignal) => Promise<void>): Promise<void> {\n449: \t\tif (this.activeRun) {\n450: \t\t\tthrow new Error(\"Agent is already processing.\");\n451: \t\t}\n452: \n453: \t\tconst abortController = new AbortController();\n454: \t\tlet resolvePromise = () => {};\n455: \t\tconst promise = new Promise<void>((resolve) => {\n456: \t\t\tresolvePromise = resolve;\n457: \t\t});\n458: \t\tthis.activeRun = { promise, resolve: resolvePromise, abortController };\n459: \n460: \t\tthis._state.isStreaming = true;\n461: \t\tthis._state.streamingMessage = undefined;\n462: \t\tthis._state.errorMessage = undefined;\n463: \n464: \t\ttry {\n465: \t\t\tawait executor(abortController.signal);\n466: \t\t} catch (error) {\n467: \t\t\tawait this.handleRunFailure(error, abortController.signal.aborted);\n468: \t\t} finally {\n469: \t\t\tthis.finishRun();\n470: \t\t}\n471: \t}\n472: \n473: \tprivate async handleRunFailure(error: unknown, aborted: boolean): Promise<void> {\n474: \t\tconst failureMessage = {\n475: \t\t\trole: \"assistant\",\n476: \t\t\tcontent: [{ type: \"text\", text: \"\" }],\n477: \t\t\tapi: this._state.model.api,\n478: \t\t\tprovider: this._state.model.provider,\n479: \t\t\tmodel: this._state.model.id,\n480: \t\t\tusage: EMPTY_USAGE,\n481: \t\t\tstopReason: aborted ? \"aborted\" : \"error\",\n482: \t\t\terrorMessage: error instanceof Error ? error.message : String(error),\n483: \t\t\ttimestamp: Date.now(),\n484: \t\t} satisfies AgentMessage;\n485: \t\tawait this.processEvents({ type: \"message_start\", message: failureMessage });\n486: \t\tawait this.processEvents({ type: \"message_end\", message: failureMessage });\n487: \t\tawait this.processEvents({ type: \"turn_end\", message: failureMessage, toolResults: [] });\n488: \t\tawait this.processEvents({ type: \"agent_end\", messages: [failureMessage] });\n489: \t}\n490: \n491: \tprivate finishRun(): void {\n492: \t\tthis._state.isStreaming = false;\n493: \t\tthis._state.streamingMessage = undefined;\n494: \t\tthis._state.pendingToolCalls = new Set<string>();\n495: \t\tthis.activeRun?.resolve();\n496: \t\tthis.activeRun = undefined;\n497: \t}\n498: \n499: \t/**\n500: \t * Reduce internal state for a loop event, then await listeners.\n501: \t *\n502: \t * `agent_end` only means no further loop events will be emitted. The run is\n503: \t * considered idle later, after all awaited listeners for `agent_end` finish\n504: \t * and `finishRun()` clears runtime-owned state.\n505: \t */\n506: \tprivate async processEvents(event: AgentEvent): Promise<void> {\n507: \t\tswitch (event.type) {\n508: \t\t\tcase \"message_start\":\n509: \t\t\t\tthis._state.streamingMessage = event.message;\n510: \t\t\t\tbreak;\n511: \n512: \t\t\tcase \"message_update\":\n513: \t\t\t\tthis._state.streamingMessage = event.message;\n514: \t\t\t\tbreak;\n515: \n516: \t\t\tcase \"message_end\":\n517: \t\t\t\tthis._state.streamingMessage = undefined;\n518: \t\t\t\tthis._state.messages.push(event.message);\n519: \t\t\t\tbreak;\n520: \n521: \t\t\tcase \"tool_execution_start\": {\n522: \t\t\t\tconst pendingToolCalls = new Set(this._state.pendingToolCalls);\n523: \t\t\t\tpendingToolCalls.add(event.toolCallId);\n524: \t\t\t\tthis._state.pendingToolCalls = pendingToolCalls;\n525: \t\t\t\tbreak;\n526: \t\t\t}\n527: \n528: \t\t\tcase \"tool_execution_end\": {\n529: \t\t\t\tconst pendingToolCalls = new Set(this._state.pendingToolCalls);\n530: \t\t\t\tpendingToolCalls.delete(event.toolCallId);\n531: \t\t\t\tthis._state.pendingToolCalls = pendingToolCalls;\n532: \t\t\t\tbreak;\n533: \t\t\t}\n534: \n535: \t\t\tcase \"turn_end\":\n536: \t\t\t\tif (event.message.role === \"assistant\" && event.message.errorMessage) {\n537: \t\t\t\t\tthis._state.errorMessage = event.message.errorMessage;\n538: \t\t\t\t}\n539: \t\t\t\tbreak;\n540: \n541: \t\t\tcase \"agent_end\":\n542: \t\t\t\tthis._state.streamingMessage = undefined;\n543: \t\t\t\tbreak;\n544: \t\t}\n545: \n546: \t\tconst signal = this.activeRun?.abortController.signal;\n547: \t\tif (!signal) {\n548: \t\t\tthrow new Error(\"Agent listener invoked outside active run\");\n549: \t\t}\n550: \t\tfor (const listener of this.listeners) {\n551: \t\t\tawait listener(event, signal);\n552: \t\t}\n553: \t}\n554: }",
  "absolutePath": "/Users/lunelson/Clones/earendil-works/pi/packages/agent/src/agent.ts"
}
```

## Assistant

**Tool Use:** `Bash`

```json
{
  "cmd": "grep -nE \"convertToLlm|transformContext|stream\\(|streamFn|messages:\" packages/agent/src/agent-loop.ts | head -60",
  "cwd": "/Users/lunelson/Clones/earendil-works/pi"
}
```

**Tool Use:** `Bash`

```json
{
  "cmd": "wc -l packages/coding-agent/src/core/messages.ts && head -100 packages/coding-agent/src/core/messages.ts",
  "cwd": "/Users/lunelson/Clones/earendil-works/pi"
}
```

## User

**Tool Result:** `TU-033IAtk9nqf6Qm1Ii13sgk`

```
{
  "output": "36:\tstreamFn?: StreamFn,\n48:\t\tstreamFn,\n61: * via `convertToLlm`. If it doesn't, the LLM provider will reject the request.\n62: * This cannot be validated here since `convertToLlm` is only called once per turn.\n68:\tstreamFn?: StreamFn,\n87:\t\tstreamFn,\n101:\tstreamFn?: StreamFn,\n106:\t\tmessages: [...context.messages, ...prompts],\n116:\tawait runLoop(currentContext, newMessages, config, signal, emit, streamFn);\n125:\tstreamFn?: StreamFn,\n141:\tawait runLoop(currentContext, newMessages, config, signal, emit, streamFn);\n161:\tstreamFn?: StreamFn,\n193:\t\t\tconst message = await streamAssistantResponse(currentContext, config, signal, emit, streamFn);\n198:\t\t\t\tawait emit({ type: \"agent_end\", messages: newMessages });\n249:\t\t\t\tawait emit({ type: \"agent_end\", messages: newMessages });\n268:\tawait emit({ type: \"agent_end\", messages: newMessages });\n280:\tstreamFn?: StreamFn,\n284:\tif (config.transformContext) {\n285:\t\tmessages = await config.transformContext(messages, signal);\n289:\tconst llmMessages = await config.convertToLlm(messages);\n294:\t\tmessages: llmMessages,\n298:\tconst streamFunction = streamFn || streamSimple;\n391:\tmessages: ToolResultMessage[];\n404:\tconst messages: ToolResultMessage[] = [];\n495:\tconst messages: ToolResultMessage[] = [];\n",
  "exitCode": 0
}
```

**Tool Result:** `TU-033IAtkFGR8h8v09mTNqLw`

```
{
  "output": "     195 packages/coding-agent/src/core/messages.ts\n/**\n * Custom message types and transformers for the coding agent.\n *\n * Extends the base AgentMessage type with coding-agent specific message types,\n * and provides a transformer to convert them to LLM-compatible messages.\n */\n\nimport type { AgentMessage } from \"@earendil-works/pi-agent-core\";\nimport type { ImageContent, Message, TextContent } from \"@earendil-works/pi-ai\";\n\nexport const COMPACTION_SUMMARY_PREFIX = `The conversation history before this point was compacted into the following summary:\n\n<summary>\n`;\n\nexport const COMPACTION_SUMMARY_SUFFIX = `\n</summary>`;\n\nexport const BRANCH_SUMMARY_PREFIX = `The following is a summary of a branch that this conversation came back from:\n\n<summary>\n`;\n\nexport const BRANCH_SUMMARY_SUFFIX = `</summary>`;\n\n/**\n * Message type for bash executions via the ! command.\n */\nexport interface BashExecutionMessage {\n\trole: \"bashExecution\";\n\tcommand: string;\n\toutput: string;\n\texitCode: number | undefined;\n\tcancelled: boolean;\n\ttruncated: boolean;\n\tfullOutputPath?: string;\n\ttimestamp: number;\n\t/** If true, this message is excluded from LLM context (!! prefix) */\n\texcludeFromContext?: boolean;\n}\n\n/**\n * Message type for extension-injected messages via sendMessage().\n * These are custom messages that extensions can inject into the conversation.\n */\nexport interface CustomMessage<T = unknown> {\n\trole: \"custom\";\n\tcustomType: string;\n\tcontent: string | (TextContent | ImageContent)[];\n\tdisplay: boolean;\n\tdetails?: T;\n\ttimestamp: number;\n}\n\nexport interface BranchSummaryMessage {\n\trole: \"branchSummary\";\n\tsummary: string;\n\tfromId: string;\n\ttimestamp: number;\n}\n\nexport interface CompactionSummaryMessage {\n\trole: \"compactionSummary\";\n\tsummary: string;\n\ttokensBefore: number;\n\ttimestamp: number;\n}\n\n// Extend CustomAgentMessages via declaration merging\ndeclare module \"@earendil-works/pi-agent-core\" {\n\tinterface CustomAgentMessages {\n\t\tbashExecution: BashExecutionMessage;\n\t\tcustom: CustomMessage;\n\t\tbranchSummary: BranchSummaryMessage;\n\t\tcompactionSummary: CompactionSummaryMessage;\n\t}\n}\n\n/**\n * Convert a BashExecutionMessage to user message text for LLM context.\n */\nexport function bashExecutionToText(msg: BashExecutionMessage): string {\n\tlet text = `Ran \\`${msg.command}\\`\\n`;\n\tif (msg.output) {\n\t\ttext += `\\`\\`\\`\\n${msg.output}\\n\\`\\`\\``;\n\t} else {\n\t\ttext += \"(no output)\";\n\t}\n\tif (msg.cancelled) {\n\t\ttext += \"\\n\\n(command cancelled)\";\n\t} else if (msg.exitCode !== null && msg.exitCode !== undefined && msg.exitCode !== 0) {\n\t\ttext += `\\n\\nCommand exited with code ${msg.exitCode}`;\n\t}\n\tif (msg.truncated && msg.fullOutputPath) {\n\t\ttext += `\\n\\n[Output truncated. Full output: ${msg.fullOutputPath}]`;\n\t}\n\treturn text;\n}\n\nexport function createBranchSummaryMessage(summary: string, fromId: string, timestamp: string): BranchSummaryMessage {\n",
  "exitCode": 0
}
```

## Assistant

**Tool Use:** `Read`

```json
{
  "path": "/Users/lunelson/Clones/earendil-works/pi/packages/coding-agent/src/core/messages.ts",
  "read_range": [
    100,
    195
  ]
}
```

**Tool Use:** `Read`

```json
{
  "path": "/Users/lunelson/Clones/earendil-works/pi/packages/agent/src/agent-loop.ts",
  "read_range": [
    270,
    360
  ]
}
```

## User

**Tool Result:** `TU-033IAts0uWI90WkgPsROZM`

```
{
  "content": "[... omitted lines 1 to 99 ...]\n100: export function createBranchSummaryMessage(summary: string, fromId: string, timestamp: string): BranchSummaryMessage {\n101: \treturn {\n102: \t\trole: \"branchSummary\",\n103: \t\tsummary,\n104: \t\tfromId,\n105: \t\ttimestamp: new Date(timestamp).getTime(),\n106: \t};\n107: }\n108: \n109: export function createCompactionSummaryMessage(\n110: \tsummary: string,\n111: \ttokensBefore: number,\n112: \ttimestamp: string,\n113: ): CompactionSummaryMessage {\n114: \treturn {\n115: \t\trole: \"compactionSummary\",\n116: \t\tsummary: summary,\n117: \t\ttokensBefore,\n118: \t\ttimestamp: new Date(timestamp).getTime(),\n119: \t};\n120: }\n121: \n122: /** Convert CustomMessageEntry to AgentMessage format */\n123: export function createCustomMessage(\n124: \tcustomType: string,\n125: \tcontent: string | (TextContent | ImageContent)[],\n126: \tdisplay: boolean,\n127: \tdetails: unknown | undefined,\n128: \ttimestamp: string,\n129: ): CustomMessage {\n130: \treturn {\n131: \t\trole: \"custom\",\n132: \t\tcustomType,\n133: \t\tcontent,\n134: \t\tdisplay,\n135: \t\tdetails,\n136: \t\ttimestamp: new Date(timestamp).getTime(),\n137: \t};\n138: }\n139: \n140: /**\n141:  * Transform AgentMessages (including custom types) to LLM-compatible Messages.\n142:  *\n143:  * This is used by:\n144:  * - Agent's transormToLlm option (for prompt calls and queued messages)\n145:  * - Compaction's generateSummary (for summarization)\n146:  * - Custom extensions and tools\n147:  */\n148: export function convertToLlm(messages: AgentMessage[]): Message[] {\n149: \treturn messages\n150: \t\t.map((m): Message | undefined => {\n151: \t\t\tswitch (m.role) {\n152: \t\t\t\tcase \"bashExecution\":\n153: \t\t\t\t\t// Skip messages excluded from context (!! prefix)\n154: \t\t\t\t\tif (m.excludeFromContext) {\n155: \t\t\t\t\t\treturn undefined;\n156: \t\t\t\t\t}\n157: \t\t\t\t\treturn {\n158: \t\t\t\t\t\trole: \"user\",\n159: \t\t\t\t\t\tcontent: [{ type: \"text\", text: bashExecutionToText(m) }],\n160: \t\t\t\t\t\ttimestamp: m.timestamp,\n161: \t\t\t\t\t};\n162: \t\t\t\tcase \"custom\": {\n163: \t\t\t\t\tconst content = typeof m.content === \"string\" ? [{ type: \"text\" as const, text: m.content }] : m.content;\n164: \t\t\t\t\treturn {\n165: \t\t\t\t\t\trole: \"user\",\n166: \t\t\t\t\t\tcontent,\n167: \t\t\t\t\t\ttimestamp: m.timestamp,\n168: \t\t\t\t\t};\n169: \t\t\t\t}\n170: \t\t\t\tcase \"branchSummary\":\n171: \t\t\t\t\treturn {\n172: \t\t\t\t\t\trole: \"user\",\n173: \t\t\t\t\t\tcontent: [{ type: \"text\" as const, text: BRANCH_SUMMARY_PREFIX + m.summary + BRANCH_SUMMARY_SUFFIX }],\n174: \t\t\t\t\t\ttimestamp: m.timestamp,\n175: \t\t\t\t\t};\n176: \t\t\t\tcase \"compactionSummary\":\n177: \t\t\t\t\treturn {\n178: \t\t\t\t\t\trole: \"user\",\n179: \t\t\t\t\t\tcontent: [\n180: \t\t\t\t\t\t\t{ type: \"text\" as const, text: COMPACTION_SUMMARY_PREFIX + m.summary + COMPACTION_SUMMARY_SUFFIX },\n181: \t\t\t\t\t\t],\n182: \t\t\t\t\t\ttimestamp: m.timestamp,\n183: \t\t\t\t\t};\n184: \t\t\t\tcase \"user\":\n185: \t\t\t\tcase \"assistant\":\n186: \t\t\t\tcase \"toolResult\":\n187: \t\t\t\t\treturn m;\n188: \t\t\t\tdefault:\n189: \t\t\t\t\t// biome-ignore lint/correctness/noSwitchDeclarations: fine\n190: \t\t\t\t\tconst _exhaustiveCheck: never = m;\n191: \t\t\t\t\treturn undefined;\n192: \t\t\t}\n193: \t\t})\n194: \t\t.filter((m) => m !== undefined);\n195: }",
  "absolutePath": "/Users/lunelson/Clones/earendil-works/pi/packages/coding-agent/src/core/messages.ts"
}
```

**Tool Result:** `TU-033IAtsOtIk1V97ehM05ud`

```
{
  "content": "[... omitted lines 1 to 269 ...]\n270: \n271: /**\n272:  * Stream an assistant response from the LLM.\n273:  * This is where AgentMessage[] gets transformed to Message[] for the LLM.\n274:  */\n275: async function streamAssistantResponse(\n276: \tcontext: AgentContext,\n277: \tconfig: AgentLoopConfig,\n278: \tsignal: AbortSignal | undefined,\n279: \temit: AgentEventSink,\n280: \tstreamFn?: StreamFn,\n281: ): Promise<AssistantMessage> {\n282: \t// Apply context transform if configured (AgentMessage[] → AgentMessage[])\n283: \tlet messages = context.messages;\n284: \tif (config.transformContext) {\n285: \t\tmessages = await config.transformContext(messages, signal);\n286: \t}\n287: \n288: \t// Convert to LLM-compatible messages (AgentMessage[] → Message[])\n289: \tconst llmMessages = await config.convertToLlm(messages);\n290: \n291: \t// Build LLM context\n292: \tconst llmContext: Context = {\n293: \t\tsystemPrompt: context.systemPrompt,\n294: \t\tmessages: llmMessages,\n295: \t\ttools: context.tools,\n296: \t};\n297: \n298: \tconst streamFunction = streamFn || streamSimple;\n299: \n300: \t// Resolve API key (important for expiring tokens)\n301: \tconst resolvedApiKey =\n302: \t\t(config.getApiKey ? await config.getApiKey(config.model.provider) : undefined) || config.apiKey;\n303: \n304: \tconst response = await streamFunction(config.model, llmContext, {\n305: \t\t...config,\n306: \t\tapiKey: resolvedApiKey,\n307: \t\tsignal,\n308: \t});\n309: \n310: \tlet partialMessage: AssistantMessage | null = null;\n311: \tlet addedPartial = false;\n312: \n313: \tfor await (const event of response) {\n314: \t\tswitch (event.type) {\n315: \t\t\tcase \"start\":\n316: \t\t\t\tpartialMessage = event.partial;\n317: \t\t\t\tcontext.messages.push(partialMessage);\n318: \t\t\t\taddedPartial = true;\n319: \t\t\t\tawait emit({ type: \"message_start\", message: { ...partialMessage } });\n320: \t\t\t\tbreak;\n321: \n322: \t\t\tcase \"text_start\":\n323: \t\t\tcase \"text_delta\":\n324: \t\t\tcase \"text_end\":\n325: \t\t\tcase \"thinking_start\":\n326: \t\t\tcase \"thinking_delta\":\n327: \t\t\tcase \"thinking_end\":\n328: \t\t\tcase \"toolcall_start\":\n329: \t\t\tcase \"toolcall_delta\":\n330: \t\t\tcase \"toolcall_end\":\n331: \t\t\t\tif (partialMessage) {\n332: \t\t\t\t\tpartialMessage = event.partial;\n333: \t\t\t\t\tcontext.messages[context.messages.length - 1] = partialMessage;\n334: \t\t\t\t\tawait emit({\n335: \t\t\t\t\t\ttype: \"message_update\",\n336: \t\t\t\t\t\tassistantMessageEvent: event,\n337: \t\t\t\t\t\tmessage: { ...partialMessage },\n338: \t\t\t\t\t});\n339: \t\t\t\t}\n340: \t\t\t\tbreak;\n341: \n342: \t\t\tcase \"done\":\n343: \t\t\tcase \"error\": {\n344: \t\t\t\tconst finalMessage = await response.result();\n345: \t\t\t\tif (addedPartial) {\n346: \t\t\t\t\tcontext.messages[context.messages.length - 1] = finalMessage;\n347: \t\t\t\t} else {\n348: \t\t\t\t\tcontext.messages.push(finalMessage);\n349: \t\t\t\t}\n350: \t\t\t\tif (!addedPartial) {\n351: \t\t\t\t\tawait emit({ type: \"message_start\", message: { ...finalMessage } });\n352: \t\t\t\t}\n353: \t\t\t\tawait emit({ type: \"message_end\", message: finalMessage });\n354: \t\t\t\treturn finalMessage;\n355: \t\t\t}\n356: \t\t}\n357: \t}\n358: \n359: \tconst finalMessage = await response.result();\n360: \tif (addedPartial) {\n[... omitted lines 361 to 718 ...]",
  "absolutePath": "/Users/lunelson/Clones/earendil-works/pi/packages/agent/src/agent-loop.ts"
}
```

## Assistant

Yes — every turn rebuilds the full LLM payload from the running transcript. The control surface for that rendering is small and explicit. Here's the exact path.

### Per-turn flow inside `streamAssistantResponse`

```diagram
                                                                   per turn
  ╭─────────────────────────────╮   transformContext?   ╭───────────────────╮
  │ context.messages            │ ───────────────────▶  │ AgentMessage[]    │
  │ (the live transcript:       │  (optional pre-pass:  │ (post-transform)  │
  │  AgentMessage[])            │   summarize, redact,  ╰─────────┬─────────╯
  │                             │   reorder, etc.)                │
  ╰─────────────────────────────╯                                 ▼
                                                       config.convertToLlm()
                                                                  │
                                                                  ▼
                                                       ╭──────────────────────╮
                                                       │ llmMessages:         │
                                                       │ Message[] (only      │
                                                       │ user/assistant/      │
                                                       │ toolResult shapes,   │
                                                       │ no custom roles)     │
                                                       ╰──────────┬───────────╯
                                                                  ▼
                              ╭───────────────────────────────────────────────╮
                              │ Context = {                                   │
                              │   systemPrompt: context.systemPrompt,         │
                              │   messages:     llmMessages,                  │
                              │   tools:        context.tools,                │
                              │ }                                             │
                              ╰───────────────────────────────────────────────╯
                                                                  │
                                                                  ▼
                                       streamFn(model, context, { … signal, key })
```

So **the transcript is rendered on every turn**, freshly, from `agent.state.messages`. There is no incremental append to a server-side conversation object — the full conversation, plus the system prompt, plus the tools, is shipped each time.

### The three points of control

`Agent` exposes exactly three hooks for shaping that rendering, and they fire in this order:

#### 1. `transformContext(messages, signal): Promise<AgentMessage[]>`
Pre-pass that rewrites the `AgentMessage[]` itself. Same role types in, same role types out. This is where **truncation, summarization, redaction, and reordering** belong. The coding-agent's compaction runs here (replacing older turns with a `compactionSummary` message).

#### 2. `convertToLlm(messages): Message[] | Promise<Message[]>`
The **mandatory** projection from the agent's internal message vocabulary to the provider-visible vocabulary. Default implementation in `agent.ts`:

```ts
function defaultConvertToLlm(messages: AgentMessage[]): Message[] {
  return messages.filter(
    (message) => message.role === "user" || message.role === "assistant" || message.role === "toolResult",
  );
}
```

— it drops anything that isn't one of those three roles.

The coding-agent overrides this in `core/messages.ts` to handle the **custom roles it introduces via declaration merging**:

```ts
declare module "@earendil-works/pi-agent-core" {
  interface CustomAgentMessages {
    bashExecution:      BashExecutionMessage;
    custom:             CustomMessage;
    branchSummary:      BranchSummaryMessage;
    compactionSummary:  CompactionSummaryMessage;
  }
}
```

…and the override projects each custom role to a `user` message with shaped text:

| Custom role | Renders as |
|---|---|
| `bashExecution` | `user` msg: ``Ran `cmd`\n```output``` `` (skipped entirely if `excludeFromContext` — the `!!` prefix in the TUI) |
| `custom` | `user` msg with the extension's content |
| `branchSummary` | `user` msg wrapped in `BRANCH_SUMMARY_PREFIX/SUFFIX` |
| `compactionSummary` | `user` msg wrapped in `COMPACTION_SUMMARY_PREFIX/SUFFIX` (`"The conversation history before this point was compacted into the following summary:\n<summary>…</summary>"`) |

So compaction's job is two-fold: `transformContext` swaps the cut-off prefix of messages for a single `compactionSummary` message, then `convertToLlm` renders that as a wrapped user message the LLM sees. From the model's point of view, the previous N turns simply become one "previous summary" user turn.

#### 3. `streamFn`
Where the actual provider call happens. Defaults to `streamSimple` from `pi-ai`. Web-ui replaces it with `createStreamFn(...)` that wraps `streamSimple` with optional CORS-proxy logic (see `AgentInterface.setupSessionSubscription`). Coding-agent leaves it as the default.

Note what the rendering **does not** include automatically: the system prompt is just held on `agent.state.systemPrompt` and passed alongside the messages — it is **not** re-rendered or recomposed per turn. It's set once at session start (`AgentSession` builds it via `buildSystemPrompt`) and reused.

### How each side configures this

| Hook | CLI (coding-agent) | Web (web-ui) |
|---|---|---|
| `systemPrompt` | Built by `buildSystemPrompt` at session start: role + tools + guidelines + AGENTS.md + skills XML + cwd + date | Set by the embedder (or left empty); web-ui itself doesn't compose one |
| `transformContext` | Used for compaction (replace older turns with `compactionSummary`); also the place extensions can hook context shaping | Not set by default — the transcript is passed through unchanged |
| `convertToLlm` | Overridden to project `bashExecution`, `custom`, `branchSummary`, `compactionSummary` into `user` messages | Uses `defaultConvertToLlm` — drops anything not user/assistant/toolResult (which is fine, web-ui doesn't introduce extra roles); ChatPanel's `defaultConvertToLlm` export is just a re-export of the core one |
| `streamFn` | Default `streamSimple` | Wrapped in `createStreamFn` for CORS proxy support |
| Tools | Built-in coding tools + extension tools; described in system prompt | Artifacts tool + embedder-supplied tools; described in each tool's own description field |

### Where this leads conceptually

There are basically three layers controlling what the model sees per turn:

```diagram
  ╭──────────────────────────────────────────────╮
  │  systemPrompt   ← built once, reused         │  ← "the world"
  ╰──────────────────────────────────────────────╯
  ╭──────────────────────────────────────────────╮
  │  AgentMessage[] in agent.state.messages      │  ← "the journal"
  │  ↓ transformContext (shape the journal)      │
  │  ↓ convertToLlm    (project to LLM roles)    │
  │  = Message[]                                 │
  ╰──────────────────────────────────────────────╯
  ╭──────────────────────────────────────────────╮
  │  tools          ← live from agent.state.tools │  ← "the verbs"
  ╰──────────────────────────────────────────────╯
```

The agent core enforces only this rigid contract — system prompt + messages + tools — and the two hooks (`transformContext`, `convertToLlm`) are the *only* sanctioned places to manipulate the journal before it ships. Custom message roles (added via TS declaration merging into `CustomAgentMessages`) only become legible to the model when `convertToLlm` knows how to render them.

For your earlier record-server speculation, this is the key seam: a record-watch subscription (e.g. "user changed status while you were thinking") would inject a `recordChange` custom message via the extension API, and the coding-agent's `convertToLlm` would gain a case to render it as a system-style user message — exactly the pattern `compactionSummary` and `branchSummary` already use. No core changes needed; only a custom role and a projection clause.

## User

so if i understand correctly, there is a function exposed from the agent core, which lets implementations control how the raw messages are actuall rendered to the "transcript view" that is submitted to the actual LLM call? meaning: optional filtering, formatting, etc.?

## Assistant

Yes — exactly. The seam is **two functions, both swappable per `Agent` instance**, both invoked on every turn inside `streamAssistantResponse`:

```ts
// agent-loop.ts, streamAssistantResponse
let messages = context.messages;                          // AgentMessage[]
if (config.transformContext) {
  messages = await config.transformContext(messages, signal); // AgentMessage[] → AgentMessage[]
}
const llmMessages = await config.convertToLlm(messages);  // AgentMessage[] → Message[]

const llmContext: Context = {
  systemPrompt: context.systemPrompt,
  messages:     llmMessages,
  tools:        context.tools,
};
await streamFunction(config.model, llmContext, { …, apiKey, signal });
```

So per turn there's a two-stage render pipeline:

| Stage | Signature | Output type | What it's for |
|---|---|---|---|
| `transformContext` (optional) | `(messages, signal) => Promise<AgentMessage[]>` | Same vocabulary | **Reshape the journal**: filter out messages, replace a prefix with a summary, redact secrets, drop tool noise, reorder. Compaction lives here. |
| `convertToLlm` (mandatory, defaulted) | `(messages) => Message[] \| Promise<Message[]>` | LLM vocabulary | **Project to the wire format**: drop roles the LLM doesn't know about, format custom messages as user-text, escape, wrap with prefixes/suffixes. |

Both are set on the `Agent` instance:

```ts
new Agent({
  transformContext: async (msgs) => /* … */,
  convertToLlm:     (msgs)       => /* … */,
});
// or later:
agent.transformContext = …;
agent.convertToLlm = …;
```

The default `convertToLlm` is the deliberately conservative one in `agent.ts`:

```ts
function defaultConvertToLlm(messages: AgentMessage[]): Message[] {
  return messages.filter(
    (m) => m.role === "user" || m.role === "assistant" || m.role === "toolResult",
  );
}
```

— everything else is silently dropped. That's why custom roles only "exist" for the LLM if you provide a `convertToLlm` that knows how to render them, as coding-agent does for `bashExecution`, `custom`, `branchSummary`, `compactionSummary`.

A few subtleties worth knowing:

- **The transcript array itself is not mutated.** `transformContext` returns a new array; `convertToLlm` returns a new array. The agent's `state.messages` keeps the raw journal intact (including custom roles), so the UI can still render bash blocks, custom messages, branch summaries, etc., as their original types. Only the LLM gets the projected view.
- **The system prompt is *not* part of this pipeline.** It's stored separately on `context.systemPrompt` and passed alongside the messages. Both functions only shape the body of the conversation, never the system message.
- **Tools are also not part of this pipeline.** `context.tools` is passed through unchanged from `agent.state.tools`. If you want the tool list visible to the LLM to vary per turn, you have to mutate `agent.state.tools` directly (or via the `prepareNextTurn` hook).
- **Order matters and is fixed.** `transformContext` runs first, `convertToLlm` second. So a compactor can introduce a custom `compactionSummary` message during `transformContext`, knowing that `convertToLlm` will project it into a `user` message a few lines later.
- **Both hooks see `signal`.** They can be async and abortable — important if the transform itself calls the LLM (which compaction does, to generate the summary).
- **There is no "rendered transcript" cached anywhere.** Every turn re-runs both functions over the current `agent.state.messages`. Cheap because both are pure-ish projections; expensive if compaction needs to summarize, which is why the compaction logic uses `shouldCompact` to decide whether to act.

So your mental model is right: the agent core's contract is "give me messages + a system prompt + tools," and these two functions are the only sanctioned, instance-configurable place where an implementation gets to decide what "messages" actually means when it's time to talk to the LLM.

## User

you mentioned a "DI container" earlier in one of your summaries, can you tell me more about what this is?

## Assistant

**Tool Use:** `Bash`

```json
{
  "cmd": "wc -l packages/coding-agent/src/core/agent-session-services.ts packages/coding-agent/src/core/agent-session-runtime.ts packages/coding-agent/src/core/sdk.ts",
  "cwd": "/Users/lunelson/Clones/earendil-works/pi"
}
```

**Tool Use:** `Read`

```json
{
  "path": "/Users/lunelson/Clones/earendil-works/pi/packages/coding-agent/src/core/agent-session-services.ts"
}
```

## User

**Tool Result:** `TU-033IBANeDFUucfMfMnHVyo`

```
{
  "output": "     198 packages/coding-agent/src/core/agent-session-services.ts\n     409 packages/coding-agent/src/core/agent-session-runtime.ts\n     413 packages/coding-agent/src/core/sdk.ts\n    1020 total\n",
  "exitCode": 0
}
```

**Tool Result:** `TU-033IBAOm6czxAZxL28Mo7a`

```
{
  "content": "1: import { join } from \"node:path\";\n2: import type { ThinkingLevel } from \"@earendil-works/pi-agent-core\";\n3: import type { Model } from \"@earendil-works/pi-ai\";\n4: import { getAgentDir } from \"../config.js\";\n5: import { AuthStorage } from \"./auth-storage.js\";\n6: import type { SessionStartEvent, ToolDefinition } from \"./extensions/index.js\";\n7: import { ModelRegistry } from \"./model-registry.js\";\n8: import { DefaultResourceLoader, type DefaultResourceLoaderOptions, type ResourceLoader } from \"./resource-loader.js\";\n9: import { type CreateAgentSessionOptions, type CreateAgentSessionResult, createAgentSession } from \"./sdk.js\";\n10: import type { SessionManager } from \"./session-manager.js\";\n11: import { SettingsManager } from \"./settings-manager.js\";\n12: \n13: /**\n14:  * Non-fatal issues collected while creating services or sessions.\n15:  *\n16:  * Runtime creation returns diagnostics to the caller instead of printing or\n17:  * exiting. The app layer decides whether warnings should be shown and whether\n18:  * errors should abort startup.\n19:  */\n20: export interface AgentSessionRuntimeDiagnostic {\n21: \ttype: \"info\" | \"warning\" | \"error\";\n22: \tmessage: string;\n23: }\n24: \n25: /**\n26:  * Inputs for creating cwd-bound runtime services.\n27:  *\n28:  * These services are recreated whenever the effective session cwd changes.\n29:  * CLI-provided resource paths should be resolved to absolute paths before they\n30:  * reach this function, so later cwd switches do not reinterpret them.\n31:  */\n32: export interface CreateAgentSessionServicesOptions {\n33: \tcwd: string;\n34: \tagentDir?: string;\n35: \tauthStorage?: AuthStorage;\n36: \tsettingsManager?: SettingsManager;\n37: \tmodelRegistry?: ModelRegistry;\n38: \textensionFlagValues?: Map<string, boolean | string>;\n39: \tresourceLoaderOptions?: Omit<DefaultResourceLoaderOptions, \"cwd\" | \"agentDir\" | \"settingsManager\">;\n40: }\n41: \n42: /**\n43:  * Inputs for creating an AgentSession from already-created services.\n44:  *\n45:  * Use this after services exist and any cwd-bound model/tool/session options\n46:  * have been resolved against those services.\n47:  */\n48: export interface CreateAgentSessionFromServicesOptions {\n49: \tservices: AgentSessionServices;\n50: \tsessionManager: SessionManager;\n51: \tsessionStartEvent?: SessionStartEvent;\n52: \tmodel?: Model<any>;\n53: \tthinkingLevel?: ThinkingLevel;\n54: \tscopedModels?: Array<{ model: Model<any>; thinkingLevel?: ThinkingLevel }>;\n55: \ttools?: string[];\n56: \tnoTools?: CreateAgentSessionOptions[\"noTools\"];\n57: \tcustomTools?: ToolDefinition[];\n58: }\n59: \n60: /**\n61:  * Coherent cwd-bound runtime services for one effective session cwd.\n62:  *\n63:  * This is infrastructure only. The AgentSession itself is created separately so\n64:  * session options can be resolved against these services first.\n65:  */\n66: export interface AgentSessionServices {\n67: \tcwd: string;\n68: \tagentDir: string;\n69: \tauthStorage: AuthStorage;\n70: \tsettingsManager: SettingsManager;\n71: \tmodelRegistry: ModelRegistry;\n72: \tresourceLoader: ResourceLoader;\n73: \tdiagnostics: AgentSessionRuntimeDiagnostic[];\n74: }\n75: \n76: function applyExtensionFlagValues(\n77: \tresourceLoader: ResourceLoader,\n78: \textensionFlagValues: Map<string, boolean | string> | undefined,\n79: ): AgentSessionRuntimeDiagnostic[] {\n80: \tif (!extensionFlagValues) {\n81: \t\treturn [];\n82: \t}\n83: \n84: \tconst diagnostics: AgentSessionRuntimeDiagnostic[] = [];\n85: \tconst extensionsResult = resourceLoader.getExtensions();\n86: \tconst registeredFlags = new Map<string, { type: \"boolean\" | \"string\" }>();\n87: \tfor (const extension of extensionsResult.extensions) {\n88: \t\tfor (const [name, flag] of extension.flags) {\n89: \t\t\tregisteredFlags.set(name, { type: flag.type });\n90: \t\t}\n91: \t}\n92: \n93: \tconst unknownFlags: string[] = [];\n94: \tfor (const [name, value] of extensionFlagValues) {\n95: \t\tconst flag = registeredFlags.get(name);\n96: \t\tif (!flag) {\n97: \t\t\tunknownFlags.push(name);\n98: \t\t\tcontinue;\n99: \t\t}\n100: \t\tif (flag.type === \"boolean\") {\n101: \t\t\textensionsResult.runtime.flagValues.set(name, true);\n102: \t\t\tcontinue;\n103: \t\t}\n104: \t\tif (typeof value === \"string\") {\n105: \t\t\textensionsResult.runtime.flagValues.set(name, value);\n106: \t\t\tcontinue;\n107: \t\t}\n108: \t\tdiagnostics.push({\n109: \t\t\ttype: \"error\",\n110: \t\t\tmessage: `Extension flag \"--${name}\" requires a value`,\n111: \t\t});\n112: \t}\n113: \n114: \tif (unknownFlags.length > 0) {\n115: \t\tdiagnostics.push({\n116: \t\t\ttype: \"error\",\n117: \t\t\tmessage: `Unknown option${unknownFlags.length === 1 ? \"\" : \"s\"}: ${unknownFlags.map((name) => `--${name}`).join(\", \")}`,\n118: \t\t});\n119: \t}\n120: \n121: \treturn diagnostics;\n122: }\n123: \n124: /**\n125:  * Create cwd-bound runtime services.\n126:  *\n127:  * Returns services plus diagnostics. It does not create an AgentSession.\n128:  */\n129: export async function createAgentSessionServices(\n130: \toptions: CreateAgentSessionServicesOptions,\n131: ): Promise<AgentSessionServices> {\n132: \tconst cwd = options.cwd;\n133: \tconst agentDir = options.agentDir ?? getAgentDir();\n134: \tconst authStorage = options.authStorage ?? AuthStorage.create(join(agentDir, \"auth.json\"));\n135: \tconst settingsManager = options.settingsManager ?? SettingsManager.create(cwd, agentDir);\n136: \tconst modelRegistry = options.modelRegistry ?? ModelRegistry.create(authStorage, join(agentDir, \"models.json\"));\n137: \tconst resourceLoader = new DefaultResourceLoader({\n138: \t\t...(options.resourceLoaderOptions ?? {}),\n139: \t\tcwd,\n140: \t\tagentDir,\n141: \t\tsettingsManager,\n142: \t});\n143: \tawait resourceLoader.reload();\n144: \n145: \tconst diagnostics: AgentSessionRuntimeDiagnostic[] = [];\n146: \tconst extensionsResult = resourceLoader.getExtensions();\n147: \tfor (const { name, config, extensionPath } of extensionsResult.runtime.pendingProviderRegistrations) {\n148: \t\ttry {\n149: \t\t\tmodelRegistry.registerProvider(name, config);\n150: \t\t} catch (error) {\n151: \t\t\tconst message = error instanceof Error ? error.message : String(error);\n152: \t\t\tdiagnostics.push({\n153: \t\t\t\ttype: \"error\",\n154: \t\t\t\tmessage: `Extension \"${extensionPath}\" error: ${message}`,\n155: \t\t\t});\n156: \t\t}\n157: \t}\n158: \textensionsResult.runtime.pendingProviderRegistrations = [];\n159: \tdiagnostics.push(...applyExtensionFlagValues(resourceLoader, options.extensionFlagValues));\n160: \n161: \treturn {\n162: \t\tcwd,\n163: \t\tagentDir,\n164: \t\tauthStorage,\n165: \t\tsettingsManager,\n166: \t\tmodelRegistry,\n167: \t\tresourceLoader,\n168: \t\tdiagnostics,\n169: \t};\n170: }\n171: \n172: /**\n173:  * Create an AgentSession from previously created services.\n174:  *\n175:  * This keeps session creation separate from service creation so callers can\n176:  * resolve model, thinking, tools, and other session inputs against the target\n177:  * cwd before constructing the session.\n178:  */\n179: export async function createAgentSessionFromServices(\n180: \toptions: CreateAgentSessionFromServicesOptions,\n181: ): Promise<CreateAgentSessionResult> {\n182: \treturn createAgentSession({\n183: \t\tcwd: options.services.cwd,\n184: \t\tagentDir: options.services.agentDir,\n185: \t\tauthStorage: options.services.authStorage,\n186: \t\tsettingsManager: options.services.settingsManager,\n187: \t\tmodelRegistry: options.services.modelRegistry,\n188: \t\tresourceLoader: options.services.resourceLoader,\n189: \t\tsessionManager: options.sessionManager,\n190: \t\tmodel: options.model,\n191: \t\tthinkingLevel: options.thinkingLevel,\n192: \t\tscopedModels: options.scopedModels,\n193: \t\ttools: options.tools,\n194: \t\tnoTools: options.noTools,\n195: \t\tcustomTools: options.customTools,\n196: \t\tsessionStartEvent: options.sessionStartEvent,\n197: \t});\n198: }",
  "absolutePath": "/Users/lunelson/Clones/earendil-works/pi/packages/coding-agent/src/core/agent-session-services.ts"
}
```

## Assistant

Good prompt to revisit — I overstated it earlier. Looking at the actual code, **it's not a DI container in the framework sense**. There's no registration step, no resolution graph, no lifecycle/scope manager, no autowiring. What I should have said is "**a service bundle with manual dependency injection**." Let me describe what it actually is.

### What's literally in the file

Two plain functions and one plain interface:

```ts
// the bundle
interface AgentSessionServices {
  cwd: string;
  agentDir: string;
  authStorage:     AuthStorage;
  settingsManager: SettingsManager;
  modelRegistry:   ModelRegistry;
  resourceLoader:  ResourceLoader;
  diagnostics:     AgentSessionRuntimeDiagnostic[];
}

// constructor for the bundle
createAgentSessionServices(options): Promise<AgentSessionServices>

// constructor for a session that takes the bundle
createAgentSessionFromServices({ services, sessionManager, … }): Promise<…>
```

That's the entire mechanism. No framework, no decorators, no provider tokens.

### What `createAgentSessionServices` actually does

It's manual construction with **two affordances** that make it useful:

1. **Every service has a default but is also injectable.** Look at the `??` chain:
   ```ts
   const authStorage     = options.authStorage     ?? AuthStorage.create(join(agentDir, "auth.json"));
   const settingsManager = options.settingsManager ?? SettingsManager.create(cwd, agentDir);
   const modelRegistry   = options.modelRegistry   ?? ModelRegistry.create(authStorage, …);
   const resourceLoader  = new DefaultResourceLoader({ …, cwd, agentDir, settingsManager });
   ```
   If the caller passes one in, use it; otherwise construct the file-backed default. This is the "dependency injection" part — but it's done with constructor parameters and nullish coalescing, not a container.

2. **The construction order encodes the dependency graph.** `modelRegistry` needs `authStorage`; `resourceLoader` needs `settingsManager`; so they're built in that order. There's no DAG resolver; the human author of this function arranged the lines correctly.

After construction, it also does a tiny amount of **post-wiring**: it asks `resourceLoader` for extensions, registers their providers with `modelRegistry`, applies extension flag values. That's not DI either — it's a setup script that happens to live next to the constructor.

### Why I called it a "DI container"

Two patterns made me reach for the term, both of them weaker than what a real container provides:

- **The bundle interface.** `AgentSessionServices` collects the long-lived, cwd-bound services into one object that's threaded through subsequent calls (`createAgentSessionFromServices({ services, … })`). That's a *service locator* shape — one object you ask for whatever you need.
- **Pluggable backends behind interfaces.** `AuthStorage` accepts an `AuthStorageBackend`; `ResourceLoader` is the interface, `DefaultResourceLoader` is the implementation. So when I said "everything's injectable," what's actually true is *some things have an interface seam* — `AuthStorage`, `SessionManager` (via `AuthStorageBackend`, JSONL vs memory repo in `pi-agent-core`), `ResourceLoader`. Others (`SettingsManager`, `ModelRegistry`) are concrete classes that you can substitute by passing a pre-built instance, but they don't have a formal interface.

So the right characterization is: **manual, constructor-based DI, packaged as a service bundle, with optional override of any service**. Plus a couple of explicit interface seams (`AuthStorageBackend`, the session repo abstraction in `pi-agent-core`) where pluggability is formalized.

### Why the design works for them anyway

For this codebase's needs, the lack of a real container is fine — arguably better. Three reasons:

1. **The dependency graph is shallow and stable.** Five services with clear ordering. A container would add ceremony without removing complexity.
2. **The "scope" question is solved by recreation.** Comments in the file say: *"These services are recreated whenever the effective session cwd changes."* Instead of scoped resolution (request/session scopes in a container), they just rebuild the bundle. Simple, explicit, easy to reason about.
3. **The two-phase construction is the real value.** `createAgentSessionServices` first (slow: loads settings, scans extensions, reads auth file), then `createAgentSessionFromServices` second (fast: builds a session against existing services). This is what lets the CLI resolve "which model and tools?" *against* the services before instantiating the session — exactly the comment at the top of the file. A container would force you to either resolve everything up front or write factory functions to defer.

### More accurate vocabulary, going forward

When I said "DI container" I should have said one of:

- **Service bundle / context object** — most accurate; the `AgentSessionServices` interface is the thing.
- **Composition root** — the function `createAgentSessionServices` is the place where defaults are wired together and overrides are accepted.
- **Manual constructor injection** — the technique used inside both `createAgentSessionServices` and `createAgentSessionFromServices`.

So for the earlier conversation about a hypothetical record server: the relevant point still holds — you'd extend `AgentSessionServices` with a `recordClient`, default-construct it in `createAgentSessionServices`, and let callers inject a mock or alternate implementation. But it's "extend the bundle and the constructor function," not "register a binding with a container." Just plain TypeScript with deliberate seams.

## User

OK so now, how is all of this meant to be consumed and used? Is one meant to fork/copy the monorepo and build on it, or to start a new project from scratch that depends upon these packages, and uses their exposed options, hooks, and plugin APIs?

## Assistant

**Tool Use:** `Bash`

```json
{
  "cmd": "ls packages/coding-agent/docs/ packages/coding-agent/examples/ 2>/dev/null",
  "cwd": "/Users/lunelson/Clones/earendil-works/pi"
}
```

**Tool Use:** `Read`

```json
{
  "path": "/Users/lunelson/Clones/earendil-works/pi/packages/coding-agent/README.md",
  "read_range": [
    1,
    100
  ]
}
```

## User

**Tool Result:** `TU-033IBO4H6Kd3D6zystmhxk`

```
{
  "output": "packages/coding-agent/docs/:\ncompaction.md\ncustom-provider.md\ndevelopment.md\ndocs.json\nextensions.md\nimages\nindex.md\njson.md\nkeybindings.md\nmodels.md\npackages.md\nprompt-templates.md\nproviders.md\nquickstart.md\nrpc.md\nsdk.md\nsession-format.md\nsessions.md\nsettings.md\nshell-aliases.md\nskills.md\nterminal-setup.md\ntermux.md\nthemes.md\ntmux.md\ntui.md\nusage.md\nwindows.md\n\npackages/coding-agent/examples/:\nextensions\nREADME.md\nrpc-extension-ui.ts\nsdk\n",
  "exitCode": 0
}
```

**Tool Result:** `TU-033IBO6TrlgSk2pVHx2tAc`

```
{
  "content": "1: <p align=\"center\">\n2:   <a href=\"https://pi.dev\">\n3:     <img alt=\"pi logo\" src=\"https://pi.dev/logo-auto.svg\" width=\"128\">\n4:   </a>\n5: </p>\n6: <p align=\"center\">\n7:   <a href=\"https://discord.com/invite/3cU7Bz4UPx\"><img alt=\"Discord\" src=\"https://img.shields.io/badge/discord-community-5865F2?style=flat-square&logo=discord&logoColor=white\" /></a>\n8:   <a href=\"https://www.npmjs.com/package/@earendil-works/pi-coding-agent\"><img alt=\"npm\" src=\"https://img.shields.io/npm/v/@earendil-works/pi-coding-agent?style=flat-square\" /></a>\n9: </p>\n10: <p align=\"center\">\n11:   <a href=\"https://pi.dev\">pi.dev</a> domain graciously donated by\n12:   <br /><br />\n13:   <a href=\"https://exe.dev\"><img src=\"docs/images/exy.png\" alt=\"Exy mascot\" width=\"48\" /><br />exe.dev</a>\n14: </p>\n15: \n16: > New issues and PRs from new contributors are auto-closed by default. Maintainers review auto-closed issues daily. See [CONTRIBUTING.md](../../CONTRIBUTING.md).\n17: \n18: ---\n19: \n20: Pi is a minimal terminal coding harness. Adapt pi to your workflows, not the other way around, without having to fork and modify pi internals. Extend it with TypeScript [Extensions](#extensions), [Skills](#skills), [Prompt Templates](#prompt-templates), and [Themes](#themes). Put your extensions, skills, prompt templates, and themes in [Pi Packages](#pi-packages) and share them with others via npm or git.\n21: \n22: Pi ships with powerful defaults but skips features like sub agents and plan mode. Instead, you can ask pi to build what you want or install a third party pi package that matches your workflow.\n23: \n24: Pi runs in four modes: interactive, print or JSON, RPC for process integration, and an SDK for embedding in your own apps. See [openclaw/openclaw](https://github.com/openclaw/openclaw) for a real-world SDK integration.\n25: \n26: ## Share your OSS coding agent sessions\n27: \n28: If you use pi for open source work, please share your coding agent sessions.\n29: \n30: Public OSS session data helps improve models, prompts, tools, and evaluations using real development workflows.\n31: \n32: For the full explanation, see [this post on X](https://x.com/badlogicgames/status/2037811643774652911).\n33: \n34: To publish sessions, use [`badlogic/pi-share-hf`](https://github.com/badlogic/pi-share-hf). Read its README.md for setup instructions. All you need is a Hugging Face account, the Hugging Face CLI, and `pi-share-hf`.\n35: \n36: You can also watch [this video](https://x.com/badlogicgames/status/2041151967695634619), where I show how I publish my `pi-mono` sessions.\n37: \n38: I regularly publish my own `pi-mono` work sessions here:\n39: \n40: - [badlogicgames/pi-mono on Hugging Face](https://huggingface.co/datasets/badlogicgames/pi-mono)\n41: \n42: ## Table of Contents\n43: \n44: - [Quick Start](#quick-start)\n45: - [Providers & Models](#providers--models)\n46: - [Interactive Mode](#interactive-mode)\n47:   - [Editor](#editor)\n48:   - [Commands](#commands)\n49:   - [Keyboard Shortcuts](#keyboard-shortcuts)\n50:   - [Message Queue](#message-queue)\n51: - [Sessions](#sessions)\n52:   - [Branching](#branching)\n53:   - [Compaction](#compaction)\n54: - [Settings](#settings)\n55: - [Context Files](#context-files)\n56: - [Customization](#customization)\n57:   - [Prompt Templates](#prompt-templates)\n58:   - [Skills](#skills)\n59:   - [Extensions](#extensions)\n60:   - [Themes](#themes)\n61:   - [Pi Packages](#pi-packages)\n62: - [Programmatic Usage](#programmatic-usage)\n63: - [Philosophy](#philosophy)\n64: - [CLI Reference](#cli-reference)\n65: \n66: ---\n67: \n68: ## Quick Start\n69: \n70: ```bash\n71: curl -fsSL https://pi.dev/install.sh | sh\n72: ```\n73: \n74: Or with npm:\n75: \n76: ```bash\n77: npm install -g @earendil-works/pi-coding-agent\n78: ```\n79: \n80: Authenticate with an API key:\n81: \n82: ```bash\n83: export ANTHROPIC_API_KEY=sk-ant-...\n84: pi\n85: ```\n86: \n87: Or use your existing subscription:\n88: \n89: ```bash\n90: pi\n91: /login  # Then select provider\n92: ```\n93: \n94: Then just talk to pi. By default, pi gives the model four tools: `read`, `write`, `edit`, and `bash`. The model uses these to fulfill your requests. Add capabilities via [skills](#skills), [prompt templates](#prompt-templates), [extensions](#extensions), or [pi packages](#pi-packages).\n95: \n96: **Platform notes:** [Windows](docs/windows.md) | [Termux (Android)](docs/termux.md) | [tmux](docs/tmux.md) | [Terminal setup](docs/terminal-setup.md) | [Shell aliases](docs/shell-aliases.md)\n97: \n98: ---\n99: \n100: ## Providers & Models\n[... omitted lines 101 to 653 ...]",
  "absolutePath": "/Users/lunelson/Clones/earendil-works/pi/packages/coding-agent/README.md"
}
```

## Assistant

**Tool Use:** `Bash`

```json
{
  "cmd": "ls packages/coding-agent/examples/extensions/ packages/coding-agent/examples/sdk/ 2>/dev/null && echo \"---\" && head -30 packages/coding-agent/examples/README.md 2>/dev/null",
  "cwd": "/Users/lunelson/Clones/earendil-works/pi"
}
```

**Tool Use:** `Bash`

```json
{
  "cmd": "sed -n '400,653p' packages/coding-agent/README.md",
  "cwd": "/Users/lunelson/Clones/earendil-works/pi"
}
```

## User

**Tool Result:** `TU-033IBOD9fUzCtAdsOmFr35`

```
{
  "output": "packages/coding-agent/examples/extensions/:\nauto-commit-on-exit.ts\nbash-spawn-hook.ts\nbookmark.ts\nborder-status-editor.ts\nbuilt-in-tool-renderer.ts\nclaude-rules.ts\ncommands.ts\nconfirm-destructive.ts\ncustom-compaction.ts\ncustom-footer.ts\ncustom-header.ts\ncustom-provider-anthropic\ncustom-provider-gitlab-duo\ndirty-repo-guard.ts\ndoom-overlay\ndynamic-resources\ndynamic-tools.ts\nevent-bus.ts\nfile-trigger.ts\ngit-checkpoint.ts\ngithub-issue-autocomplete.ts\nhandoff.ts\nhello.ts\nhidden-thinking-label.ts\ninline-bash.ts\ninput-transform.ts\ninteractive-shell.ts\nmac-system-theme.ts\nmessage-renderer.ts\nminimal-mode.ts\nmodal-editor.ts\nmodel-status.ts\nnotify.ts\noverlay-qa-tests.ts\noverlay-test.ts\npermission-gate.ts\npirate.ts\nplan-mode\npreset.ts\nprompt-customizer.ts\nprotected-paths.ts\nprovider-payload.ts\nqna.ts\nquestion.ts\nquestionnaire.ts\nrainbow-editor.ts\nREADME.md\nreload-runtime.ts\nrpc-demo.ts\nsandbox\nsend-user-message.ts\nsession-name.ts\nshutdown-command.ts\nsnake.ts\nspace-invaders.ts\nssh.ts\nstatus-line.ts\nstructured-output.ts\nsubagent\nsummarize.ts\nsystem-prompt-header.ts\ntic-tac-toe.ts\ntimed-confirm.ts\ntitlebar-spinner.ts\ntodo.ts\ntool-override.ts\ntools.ts\ntrigger-compact.ts\ntruncated-tool.ts\nwidget-placement.ts\nwith-deps\nworking-indicator.ts\nworking-message-test.ts\n\npackages/coding-agent/examples/sdk/:\n01-minimal.ts\n02-custom-model.ts\n03-custom-prompt.ts\n04-skills.ts\n05-tools.ts\n06-extensions.ts\n07-context-files.ts\n08-prompt-templates.ts\n09-api-keys-and-oauth.ts\n10-settings.ts\n11-sessions.ts\n12-full-control.ts\n13-session-runtime.ts\nREADME.md\n---\n# Examples\n\nExample code for pi-coding-agent SDK and extensions.\n\n## Directories\n\n### [sdk/](sdk/)\nProgrammatic usage via `createAgentSession()`. Shows how to customize models, prompts, tools, extensions, and session management.\n\n### [extensions/](extensions/)\nExample extensions demonstrating:\n- Lifecycle event handlers (tool interception, safety gates, context modifications)\n- Custom tools (todo lists, questions, subagents, output truncation)\n- Commands and keyboard shortcuts\n- Custom UI (footers, headers, editors, overlays)\n- Git integration (checkpoints, auto-commit)\n- System prompt modifications and custom compaction\n- External integrations (SSH, file watchers, system theme sync)\n- Custom providers (Anthropic with custom streaming, GitLab Duo)\n\n## Documentation\n\n- [SDK Reference](sdk/README.md)\n- [Extensions Documentation](../docs/extensions.md)\n- [Skills Documentation](../docs/skills.md)\n",
  "exitCode": 0
}
```

**Tool Result:** `TU-033IBOEIjNqjVY5R1nf4Av`

```
{
  "output": "pi list\npi update                               # update pi and packages (skips pinned packages)\npi update --extensions                  # update packages only\npi update --self                        # update pi only\npi update --self --force                # reinstall pi even if current\npi update npm:@foo/pi-tools             # update one package\npi config                               # enable/disable extensions, skills, prompts, themes\n```\n\nPackages install to `~/.pi/agent/git/` (git) or global npm. Use `-l` for project-local installs (`.pi/git/`, `.pi/npm/`). Git packages install dependencies with `npm install --omit=dev` by default, so runtime deps must be listed under `dependencies`; when `npmCommand` is configured, git packages use plain `install` for compatibility with wrappers. If you use a Node version manager and want package installs to reuse a stable npm context, set `npmCommand` in `settings.json`, for example `[\"mise\", \"exec\", \"node@20\", \"--\", \"npm\"]`.\n\nCreate a package by adding a `pi` key to `package.json`:\n\n```json\n{\n  \"name\": \"my-pi-package\",\n  \"keywords\": [\"pi-package\"],\n  \"pi\": {\n    \"extensions\": [\"./extensions\"],\n    \"skills\": [\"./skills\"],\n    \"prompts\": [\"./prompts\"],\n    \"themes\": [\"./themes\"]\n  }\n}\n```\n\nWithout a `pi` manifest, pi auto-discovers from conventional directories (`extensions/`, `skills/`, `prompts/`, `themes/`).\n\nSee [docs/packages.md](docs/packages.md).\n\n---\n\n## Programmatic Usage\n\n### SDK\n\n```typescript\nimport { AuthStorage, createAgentSession, ModelRegistry, SessionManager } from \"@earendil-works/pi-coding-agent\";\n\nconst authStorage = AuthStorage.create();\nconst modelRegistry = ModelRegistry.create(authStorage);\nconst { session } = await createAgentSession({\n  sessionManager: SessionManager.inMemory(),\n  authStorage,\n  modelRegistry,\n});\n\nawait session.prompt(\"What files are in the current directory?\");\n```\n\nFor advanced multi-session runtime replacement, use `createAgentSessionRuntime()` and `AgentSessionRuntime`.\n\nSee [docs/sdk.md](docs/sdk.md) and [examples/sdk/](examples/sdk/).\n\n### RPC Mode\n\nFor non-Node.js integrations, use RPC mode over stdin/stdout:\n\n```bash\npi --mode rpc\n```\n\nRPC mode uses strict LF-delimited JSONL framing. Clients must split records on `\\n` only. Do not use generic line readers like Node `readline`, which also split on Unicode separators inside JSON payloads.\n\nSee [docs/rpc.md](docs/rpc.md) for the protocol.\n\n---\n\n## Philosophy\n\nPi is aggressively extensible so it doesn't have to dictate your workflow. Features that other tools bake in can be built with [extensions](#extensions), [skills](#skills), or installed from third-party [pi packages](#pi-packages). This keeps the core minimal while letting you shape pi to fit how you work.\n\n**No MCP.** Build CLI tools with READMEs (see [Skills](#skills)), or build an extension that adds MCP support. [Why?](https://mariozechner.at/posts/2025-11-02-what-if-you-dont-need-mcp/)\n\n**No sub-agents.** There's many ways to do this. Spawn pi instances via tmux, or build your own with [extensions](#extensions), or install a package that does it your way.\n\n**No permission popups.** Run in a container, or build your own confirmation flow with [extensions](#extensions) inline with your environment and security requirements.\n\n**No plan mode.** Write plans to files, or build it with [extensions](#extensions), or install a package.\n\n**No built-in to-dos.** They confuse models. Use a TODO.md file, or build your own with [extensions](#extensions).\n\n**No background bash.** Use tmux. Full observability, direct interaction.\n\nRead the [blog post](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/) for the full rationale.\n\n---\n\n## CLI Reference\n\n```bash\npi [options] [@files...] [messages...]\n```\n\n### Package Commands\n\n```bash\npi install <source> [-l]     # Install package, -l for project-local\npi remove <source> [-l]      # Remove package\npi uninstall <source> [-l]   # Alias for remove\npi update [source|self|pi]   # Update pi and packages (skips pinned packages)\npi update --extensions       # Update packages only\npi update --self             # Update pi only\npi update --self --force     # Reinstall pi even if current\npi update --extension <src>  # Update one package\npi list                      # List installed packages\npi config                    # Enable/disable package resources\n```\n\n### Modes\n\n| Flag | Description |\n|------|-------------|\n| (default) | Interactive mode |\n| `-p`, `--print` | Print response and exit |\n| `--mode json` | Output all events as JSON lines (see [docs/json.md](docs/json.md)) |\n| `--mode rpc` | RPC mode for process integration (see [docs/rpc.md](docs/rpc.md)) |\n| `--export <in> [out]` | Export session to HTML |\n\nIn print mode, pi also reads piped stdin and merges it into the initial prompt:\n\n```bash\ncat README.md | pi -p \"Summarize this text\"\n```\n\n### Model Options\n\n| Option | Description |\n|--------|-------------|\n| `--provider <name>` | Provider (anthropic, openai, google, etc.) |\n| `--model <pattern>` | Model pattern or ID (supports `provider/id` and optional `:<thinking>`) |\n| `--api-key <key>` | API key (overrides env vars) |\n| `--thinking <level>` | `off`, `minimal`, `low`, `medium`, `high`, `xhigh` |\n| `--models <patterns>` | Comma-separated patterns for Ctrl+P cycling |\n| `--list-models [search]` | List available models |\n\n### Session Options\n\n| Option | Description |\n|--------|-------------|\n| `-c`, `--continue` | Continue most recent session |\n| `-r`, `--resume` | Browse and select session |\n| `--session <path\\|id>` | Use specific session file or partial UUID |\n| `--fork <path\\|id>` | Fork specific session file or partial UUID into a new session |\n| `--session-dir <dir>` | Custom session storage directory |\n| `--no-session` | Ephemeral mode (don't save) |\n\n### Tool Options\n\n| Option | Description |\n|--------|-------------|\n| `--tools <list>`, `-t <list>` | Allowlist specific tool names across built-in, extension, and custom tools |\n| `--no-builtin-tools`, `-nbt` | Disable built-in tools by default but keep extension/custom tools enabled |\n| `--no-tools`, `-nt` | Disable all tools by default |\n\nAvailable built-in tools: `read`, `bash`, `edit`, `write`, `grep`, `find`, `ls`\n\n### Resource Options\n\n| Option | Description |\n|--------|-------------|\n| `-e`, `--extension <source>` | Load extension from path, npm, or git (repeatable) |\n| `--no-extensions` | Disable extension discovery |\n| `--skill <path>` | Load skill (repeatable) |\n| `--no-skills` | Disable skill discovery |\n| `--prompt-template <path>` | Load prompt template (repeatable) |\n| `--no-prompt-templates` | Disable prompt template discovery |\n| `--theme <path>` | Load theme (repeatable) |\n| `--no-themes` | Disable theme discovery |\n| `--no-context-files`, `-nc` | Disable AGENTS.md and CLAUDE.md context file discovery |\n\nCombine `--no-*` with explicit flags to load exactly what you need, ignoring settings.json (e.g., `--no-extensions -e ./my-ext.ts`).\n\n### Other Options\n\n| Option | Description |\n|--------|-------------|\n| `--system-prompt <text>` | Replace default prompt (context files and skills still appended) |\n| `--append-system-prompt <text>` | Append to system prompt |\n| `--verbose` | Force verbose startup |\n| `-h`, `--help` | Show help |\n| `-v`, `--version` | Show version |\n\n### File Arguments\n\nPrefix files with `@` to include in the message:\n\n```bash\npi @prompt.md \"Answer this\"\npi -p @screenshot.png \"What's in this image?\"\npi @code.ts @test.ts \"Review these files\"\n```\n\n### Examples\n\n```bash\n# Interactive with initial prompt\npi \"List all .ts files in src/\"\n\n# Non-interactive\npi -p \"Summarize this codebase\"\n\n# Non-interactive with piped stdin\ncat README.md | pi -p \"Summarize this text\"\n\n# Different model\npi --provider openai --model gpt-4o \"Help me refactor\"\n\n# Model with provider prefix (no --provider needed)\npi --model openai/gpt-4o \"Help me refactor\"\n\n# Model with thinking level shorthand\npi --model sonnet:high \"Solve this complex problem\"\n\n# Limit model cycling\npi --models \"claude-*,gpt-4o\"\n\n# Read-only mode\npi --tools read,grep,find,ls -p \"Review the code\"\n\n# High thinking level\npi --thinking high \"Solve this complex problem\"\n```\n\n### Environment Variables\n\n| Variable | Description |\n|----------|-------------|\n| `PI_CODING_AGENT_DIR` | Override config directory (default: `~/.pi/agent`) |\n| `PI_CODING_AGENT_SESSION_DIR` | Override session storage directory (overridden by `--session-dir`) |\n| `PI_PACKAGE_DIR` | Override package directory (useful for Nix/Guix where store paths tokenize poorly) |\n| `PI_OFFLINE` | Disable startup network operations, including update checks, package update checks, and install/update telemetry |\n| `PI_SKIP_VERSION_CHECK` | Skip the Pi version update check at startup. This prevents the `pi.dev` latest-version request |\n| `PI_TELEMETRY` | Override install/update telemetry. Use `1`/`true`/`yes` to enable or `0`/`false`/`no` to disable. This does not disable update checks |\n| `PI_CACHE_RETENTION` | Set to `long` for extended prompt cache (Anthropic: 1h, OpenAI: 24h) |\n| `VISUAL`, `EDITOR` | External editor for Ctrl+G |\n\n---\n\n## Contributing & Development\n\nSee [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines and [docs/development.md](docs/development.md) for setup, forking, and debugging.\n\n---\n\n## License\n\nMIT\n\n## See Also\n\n- [@earendil-works/pi-ai](https://www.npmjs.com/package/@earendil-works/pi-ai): Core LLM toolkit\n- [@earendil-works/pi-agent-core](https://www.npmjs.com/package/@earendil-works/pi-agent-core): Agent framework\n- [@earendil-works/pi-tui](https://www.npmjs.com/package/@earendil-works/pi-tui): Terminal UI components\n",
  "exitCode": 0
}
```

## Assistant

The intended consumption model is **explicitly not "fork and modify."** From the README's opening line: *"Adapt pi to your workflows, not the other way around, without having to fork and modify pi internals."* The whole architecture is shaped around that promise. There are four sanctioned consumption paths, in increasing depth:

### 1. Use `pi` as-is, extend it in place (most common)

Install the published CLI, then add capabilities through the resource system:

```bash
npm install -g @earendil-works/pi-coding-agent
pi install <package>          # or pi install -l <package> for project-local
```

A **pi package** is just a regular npm/git package with a `pi` key in its `package.json` (or conventional `extensions/`, `skills/`, `prompts/`, `themes/` directories). Pi auto-discovers them at startup. The four resource kinds it loads:

- **Skills** — Markdown files with YAML frontmatter that get surfaced to the model.
- **Prompt templates** — Markdown files exposed as slash commands with `$1`/`$@`/`$ARGUMENTS` substitution.
- **Themes** — TUI styling.
- **Extensions** — TypeScript files that hook the lifecycle: add tools, commands, keybindings, UI components, intercept tool calls, modify the system prompt, register custom providers.

The 70+ files in `examples/extensions/` (auto-commit, dirty-repo-guard, custom-compaction, doom-overlay, snake, plan-mode, subagent, …) show that essentially every "feature" you'd normally fork to add can be done as an extension. The maintainers explicitly excluded things like sub-agents and plan mode from the core, on purpose, so the extension API has to carry that weight.

This is what 95% of users are meant to do.

### 2. Embed via SDK (`createAgentSession`)

For wrapping the agent in your own app — a different UI, a different shell, a bot, a CI runner — you import from `@earendil-works/pi-coding-agent`:

```ts
import { AuthStorage, createAgentSession, ModelRegistry, SessionManager } from "@earendil-works/pi-coding-agent";

const authStorage = AuthStorage.create();
const modelRegistry = ModelRegistry.create(authStorage);
const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(),
  authStorage,
  modelRegistry,
});

await session.prompt("What files are in the current directory?");
```

The `examples/sdk/` folder is a graduated tour: `01-minimal` → `02-custom-model` → `03-custom-prompt` → `04-skills` → `05-tools` → `06-extensions` → `07-context-files` → `08-prompt-templates` → `09-api-keys-and-oauth` → `10-settings` → `11-sessions` → `12-full-control` → `13-session-runtime`. That progression is the intended on-ramp: each example adds one more piece of customization without abandoning the previous ones.

`createAgentSessionRuntime` and `createAgentSessionServices` (the service bundle we just discussed) are for cases that need to swap sessions in-process or share services across many sessions — e.g. a long-lived server hosting multiple users.

The README literally points to a real example: *"See [openclaw/openclaw](https://github.com/openclaw/openclaw) for a real-world SDK integration."*

### 3. Drive from another process via RPC

For non-Node integrations (Python, Go, Rust, a desktop app, a Slack bot):

```bash
pi --mode rpc
```

JSON-RPC over stdio with strict LF-delimited JSONL framing. `RpcClient`, `RpcCommand`, `RpcResponse`, `RpcSessionState`, `RpcEventListener` are exported. This is the "treat pi as a server, write your own client" path — same agent, no Node embedding required.

### 4. Pipe / batch via print mode

```bash
cat README.md | pi -p "Summarize this text"
pi -p "Review the code"
```

For shell pipelines and CI. This is just print mode + stdin piping; not really a "consumption model" per se, more an interaction mode.

---

### Where forking actually makes sense

The README does not forbid forking, and `docs/development.md` covers it — but it's positioned as the path for contributors to the project itself, not for consumers. The honest cases for forking are:

- You want to change the **agent loop**, the **system-prompt builder**, the **session JSONL format**, or the **compaction algorithm** in ways the existing hooks don't expose. (These are deep enough that they're not exposed by design.)
- You want to add a **new built-in provider** that needs deep changes in `pi-ai`.
- You want to **rebrand and redistribute** as a different product (which is what `openclaw` appears to do — though I haven't read its source).

If you're forking to add a tool, a UI element, a command, a context-shaping rule, a footer, a status indicator, an autocompleter, a theme, a slash command, a credential manager, a confirmation gate, a context file convention, or a custom message renderer — there's already an extension hook for that, and the example folder probably has a 50-line demo. The architecture punishes forking by making it unnecessary.

### How this maps to your earlier record-server thought experiment

Each consumption path lands a different way:

| Path | How it gets record tools |
|---|---|
| Pi package | Publish `pi-record-tools` as an npm package; `pi install pi-record-tools` adds the tools to anyone's pi |
| SDK embed | Pass record tools as `customTools` to `createAgentSession`, supply your own services bundle that includes a record client |
| RPC driver | The driver process talks to both pi and the record server; record tools live in pi as in the package case |
| Print mode | Same package install; auto-approve policies decide which record writes are allowed unattended |

So the layering for that hypothetical feature would be: **the record server is a new package, the record tools are a pi package (extension), and consumers pick their integration depth from the four paths above** — none of which involve modifying the pi monorepo.

The Philosophy section of the README codifies this stance: "No MCP. No sub-agents. No permission popups. No plan mode. No built-in to-dos. No background bash." Each absence is paired with "use an extension or install a package." The unwritten rule is: *if a feature would limit how someone wants to work, it doesn't go in the core; it goes in an extension you can choose to load or not.*

## User

let's imagine a tool that users can install with `npm i -g foobar`. This tool would be invokable from a directory on a user's system, and would *wrap the local agent*, and expose interactions with this agent through different modes, including web-ui, e.g.

```sh
foobar # starts chat TUI for local-agent
foobar --mode web # opens web GUI-over-local-agent
foobar --mode rpc # addresses local-agent via RPC
```

`foobar` would scope and store all relevant data to the `cwd`, in a local `.foobar/` directory. It would create an SQLite store for its structured data; it may also use JSONL for the raw session data. It would not expose pi's extension/customization APIs but it would use them itself?

How should such a thing be constructed? which of the pi packages would it depend on?

## Assistant

Good thought experiment. Let me work through it concretely. The key insight is that `foobar` is building **a product, not a fork** — same relationship to pi as `coding-agent` has to `pi-agent-core`, just at the next layer up.

### Dependency choice: what to depend on

You have a clean two-option fork here:

#### Option A (recommended): depend on `pi-coding-agent` directly
```
foobar
└── @earendil-works/pi-coding-agent
      ├── pi-agent-core  (transitive)
      ├── pi-ai          (transitive)
      └── pi-tui         (transitive)
```

You inherit the full harness: `createAgentSession`, `SessionManager` (JSONL, compaction, branching), `AuthStorage`, `ModelRegistry`, `SettingsManager`, `ExtensionRunner`, all the built-in coding tools, the TUI components, `InteractiveMode`, `runPrintMode`, `runRpcMode`, `RpcClient`. You override what you don't want via the SDK's options. **This is the right starting point unless you discover a constraint.**

#### Option B: depend on `pi-agent-core` only
Skip coding-agent entirely. You write your own session manager, auth, model registry, system-prompt builder, mode dispatcher. You get only the `Agent` class and the agent loop. Useful if `foobar` has a wildly different domain (no filesystem, no coding tools, no project-context-files concept) — but most products won't.

The vast majority of foobar-shaped products land on Option A. The harness *is* the value.

#### What about web-ui?

`pi-web-ui` is a **components library**, not a server. Its components expect an `Agent` instance in the same JS context. In your design the agent runs on the server (in `.foobar/`), so the components don't fit out of the box. Two realistic stances:

- **Adapt web-ui:** depend on it and write a "remote Agent proxy" — a thin class that implements the bits of `Agent` that `AgentInterface` reads (state.messages, state.tools, subscribe, prompt, abort) and forwards them over websocket to the server. Most of the rendering, attachments, artifacts, sandbox, model picker can be reused.
- **Skip web-ui:** write your own browser UI in whatever framework you prefer. Lighter footprint, no Lit dependency, but you rebuild message rendering, streaming, model picker, etc.

The pragmatic answer is **start without it, add it later if reusable parts justify the dependency.** The components are nice but they're shaped for a specific BYOK-in-browser product.

### Architecture sketch

```diagram
                              user runs `foobar [--mode …]`
                                          │
                                          ▼
                              ╭─────────────────────╮
                              │  foobar CLI         │
                              │  (single binary,    │
                              │   chooses mode)     │
                              ╰─────────┬───────────╯
              ┌───────────────┬─────────┴─────────┬─────────────────┐
              ▼               ▼                   ▼                 ▼
       (default TUI)    --mode web           --mode rpc        --mode print
              │               │                   │                 │
              │               ▼                   │                 │
              │       ╭───────────────╮            │                 │
              │       │ local HTTP +  │            │                 │
              │       │ websocket     │            │                 │
              │       │ server (host) │            │                 │
              │       ╰───────┬───────╯            │                 │
              │               │                   │                 │
              ▼               ▼                   ▼                 ▼
        ╭──────────────────────────────────────────────────────────────╮
        │  SHARED LAYER: foobar agent host                             │
        │  ─ AgentSessionRuntime (createAgentSession from pi-coding-   │
        │    agent)                                                    │
        │  ─ foobar built-in extension (records tools + UI bits)       │
        │  ─ foobar curated system prompt                              │
        │  ─ foobar curated toolset (subset of coding-agent tools +    │
        │    record tools)                                             │
        │  ─ services bundle: SessionManager / AuthStorage /           │
        │    ModelRegistry / SettingsManager / ResourceLoader          │
        │    all pointed at .foobar/                                   │
        ╰──────────────────────────────┬───────────────────────────────╯
                                       ▼
                          ╭────────────────────────╮
                          │   .foobar/  (per-cwd)   │
                          │                         │
                          │  data.db   (SQLite —    │
                          │   records, projections, │
                          │   indices)              │
                          │                         │
                          │  sessions/*.jsonl       │
                          │   (pi SessionManager)   │
                          │                         │
                          │  auth.json              │
                          │   (pi AuthStorage)      │
                          │                         │
                          │  settings.json          │
                          │   (foobar settings,     │
                          │   optionally pi too)    │
                          ╰─────────────────────────╯
```

### How each mode resolves

#### Default (TUI)
Two paths, in order of laziness:

```ts
// Easiest: re-use InteractiveMode wholesale
import { main } from "@earendil-works/pi-coding-agent";
await main({
  cwd: process.cwd(),
  agentDir: path.join(process.cwd(), ".foobar"),
  // synthesize the args you want users to be able to pass; ignore everything else
  args: { /* curated */ },
  // hardcode foobar's services / extensions
});
```

Or — for tighter control — call the lower-level pieces:

```ts
import {
  createAgentSessionServices,
  createAgentSessionFromServices,
  InteractiveMode,
} from "@earendil-works/pi-coding-agent";

const services = await createAgentSessionServices({
  cwd: process.cwd(),
  agentDir: path.join(process.cwd(), ".foobar"),
});

const { session } = await createAgentSessionFromServices({
  services,
  sessionManager: SessionManager.create({ dir: ".foobar/sessions" }),
  customTools: foobarTools,                  // your record tools
  noTools: false,
  tools: ["read", "grep", "find", "ls"],     // curated subset of built-ins
});

await new InteractiveMode({ session, ... }).run();
```

#### `--mode web`
This is the mode that actually changes the architecture. You need a server process **because the agent runs in Node** (reads `.foobar/data.db`, runs tools that touch the filesystem), and the browser is just a remote head.

```ts
// foobar/src/modes/web.ts
import express from "express";       // or hono, fastify, h3 — any HTTP server
import { WebSocketServer } from "ws";
import { createAgentSessionServices, createAgentSessionFromServices } from "@earendil-works/pi-coding-agent";

const services = await createAgentSessionServices({ cwd, agentDir });
const { session } = await createAgentSessionFromServices({ services, ... });

const app = express();
app.use(express.static(/* foobar's built-in web bundle */));
const server = app.listen(port);

const wss = new WebSocketServer({ server });
wss.on("connection", (ws) => {
  // Mirror session events to the websocket
  const unsub = session.subscribe(async (event) => {
    ws.send(JSON.stringify({ type: "event", event }));
  });
  ws.on("message", async (raw) => {
    const cmd = JSON.parse(raw.toString());
    if (cmd.type === "prompt") await session.prompt(cmd.text);
    if (cmd.type === "abort")  session.abort();
    // …read records, list records, write records, etc.
  });
  ws.on("close", unsub);
});

console.log(`foobar web at http://localhost:${port}`);
```

Notice this is **the same JSON-RPC vocabulary that pi's `--mode rpc` already speaks**, just over websocket instead of stdio. So a cleaner implementation: reuse pi's RPC dispatcher directly and pipe it to the websocket — you get the protocol "for free."

Browser bundle: ship it as a static `dist/` baked into the npm package; serve it from express. Use web-ui's components with a `RemoteAgent` proxy, or roll your own — your call.

#### `--mode rpc`
Almost trivial — delegate:

```ts
// foobar/src/modes/rpc.ts
import { runRpcMode } from "@earendil-works/pi-coding-agent";
await runRpcMode({
  services,
  customTools: foobarTools,
  // … foobar's curated config
});
```

Users get pi's well-tested JSON-RPC protocol; foobar just gets to configure the services and tools.

#### `--mode print`
Same delegation:

```ts
import { runPrintMode } from "@earendil-works/pi-coding-agent";
await runPrintMode({ services, prompt, ... });
```

### SQLite + records integration

Three pieces, all internal to foobar:

```diagram
  ╭───────────────────────────────────────────────────────────╮
  │  foobar/src/records/                                      │
  │  ─ db.ts            (better-sqlite3 connection)           │
  │  ─ schema.sql       (tables, indices, triggers)           │
  │  ─ migrations.ts    (versioned schema migrations)         │
  │  ─ commands.ts      (typed commands: createX, updateX)    │
  │  ─ queries.ts       (typed reads + subscriptions)         │
  │  ─ events.ts        (emit on every write — for ws +       │
  │                      agent watch tool)                    │
  ╰───────────────────────────────────────────────────────────╯
                              │
                              ▼
  ╭───────────────────────────────────────────────────────────╮
  │  foobar/src/agent-extension.ts                            │
  │  Registers as a pi ExtensionFactory:                      │
  │   - tools:  record_query, record_get, record_create,      │
  │             record_update, record_subscribe               │
  │   - hooks:  beforeToolCall → authority gate               │
  │             prepareNextTurn → inject watched changes      │
  │   - slash commands: /records, /undo                       │
  ╰───────────────────────────────────────────────────────────╯
                              │
                              ▼
  ╭───────────────────────────────────────────────────────────╮
  │  foobar/src/web-api.ts                                    │
  │  HTTP/WS endpoints for the browser UI:                    │
  │   - GET  /api/records?…                                   │
  │   - POST /api/records/:type                               │
  │   - WS   subscribe to /api/events (record changes +       │
  │          session events)                                  │
  ╰───────────────────────────────────────────────────────────╯
```

The crucial pattern: **records have one source of truth (SQLite via `records/`), and two consumers (the pi extension for agent access, the web-api for user access).** Both go through the same `commands.ts` so authority gates and event emission fire regardless of who initiated the change. Same `commands.ts` is what the TUI's slash commands call too.

### Closing the loop on "uses pi's extension API but doesn't expose it"

You consume the extension API by **calling `createAgentSessionServices`/`createAgentSession` with hardcoded `extensionFactories` and tool lists, and never reading user-supplied `--extension`/`--skill`/`--prompt-template` flags from the CLI.**

You can even be belt-and-braces about it:

- Pass `noTools: true` then explicitly pass your `tools` list + `customTools`.
- Override `customPrompt` so pi's default coding-assistant prompt doesn't appear.
- Use `createAgentSessionServices` with `resourceLoaderOptions` that disable disk discovery for extensions/skills/prompt templates/themes.
- Set `agentDir` to `.foobar/` so pi's `~/.pi/agent/` paths don't get touched at all.

The result: pi's extension *plumbing* runs internally and powers foobar's features; pi's extension *contract* never reaches the end user. From their point of view foobar is opinionated and self-contained.

### Summary

| Concern | Choice |
|---|---|
| Core dep | `@earendil-works/pi-coding-agent` |
| Web UI dep | Add `@earendil-works/pi-web-ui` only if reusing its components; otherwise skip |
| Agent location | Always Node (so file tools + SQLite work) |
| Web mode shape | Local HTTP+WS server; browser is a thin remote head over JSON-RPC |
| RPC mode | Delegate to `runRpcMode` |
| TUI mode | Delegate to `InteractiveMode` or `main()` with curated args |
| Print mode | Delegate to `runPrintMode` |
| Structured data | SQLite in `.foobar/data.db`, owned by a `records/` module |
| Records → agent | Internal pi extension registering tools + hooks |
| Records → user | HTTP/WS endpoints from foobar's own web server |
| Sessions | `SessionManager` pointed at `.foobar/sessions/*.jsonl` |
| Auth/models | `AuthStorage`/`ModelRegistry` pointed at `.foobar/` |
| User-facing extension API | None — foobar consumes pi's API; users see only foobar's CLI flags |

The whole thing fits in one npm package, a few thousand lines of TypeScript, plus a static web bundle. The interesting work is in `records/` and the web frontend; everything else is delegation.

## User

let me push slightly on the web server API: you said the browser is a thin remote head over JSON-RPC, but then also acknowledged that there might be REST-like endpoints for the structured data. These sound potentially divergent

## Assistant

You're right, and that was a sloppy moment in my sketch. Two protocols for one product is a real cost: two clients to maintain, two error models, two auth stories, two ways for things to drift. Let me retract the REST endpoints and argue for a cleaner shape.

### The honest position: one protocol, used for both

The same reasons that made JSON-RPC the right fit for the agent — long-lived connection, bidirectional, server-pushed events, structured method/result/error — apply just as well to records. Records aren't a different kind of thing; they're another set of methods on the same bus.

```diagram
        ╭──── browser ────╮      ╭──── headless driver ────╮
        │  WebSocket      │      │  stdio                  │
        ╰────────┬────────╯      ╰────────────┬────────────╯
                 │                            │
                 ▼                            ▼
        ╭────────────────────────────────────────────────╮
        │  foobar JSON-RPC dispatcher                    │
        │                                                │
        │  session.* methods   (already pi's rpc)        │
        │   - session.prompt                             │
        │   - session.abort                              │
        │   - session.subscribe                          │
        │                                                │
        │  records.* methods   (foobar adds)             │
        │   - records.query     {type, where, …}         │
        │   - records.get       {type, id}               │
        │   - records.create    {type, data, idemKey}    │
        │   - records.update    {type, id, ifVersion, …} │
        │   - records.delete    {type, id, ifVersion}    │
        │   - records.subscribe {type?, id?}             │
        │                                                │
        │  events (server → client, unsolicited)         │
        │   - session_event                              │
        │   - records.changed                            │
        ╰────────────────────────────────────────────────╯
```

The browser is now a JSON-RPC client over WS. A curl-equivalent headless driver speaks the same protocol over stdio (or another WS). The agent's record tools speak the same protocol *internally* (just function calls on the same dispatcher, not even going over a transport). One vocabulary, three call sites, zero translation layers.

### Why this is genuinely better, not just neater

Three concrete benefits, beyond "less code":

1. **The agent's record tools and the browser's record actions go through the exact same command layer.** When the agent does `records.update` and when a user clicks "save" in the web UI, they hit the same authority gate, the same optimistic-concurrency check, the same `records.changed` event emission. With a split (RPC for agent, REST for UI), you'd duplicate that logic or have the REST layer call into the RPC layer — extra code and a place to drift.

2. **Subscriptions are first-class, not bolted on.** `records.subscribe` returns a subscription id; the server pushes `records.changed` events until you `records.unsubscribe`. With REST you'd need either polling or a parallel SSE/WS channel, which is the divergence problem in miniature.

3. **The same protocol description doubles as the wire format for two existing modes.** `foobar --mode rpc` and the browser are the same protocol, just different transports. New tooling (`foobar-cli`, `foobar-watch`, language SDKs) only has to learn one thing.

### What about the REST appeal?

The reason REST kept sneaking into my earlier sketch is real and worth naming. REST is good at three things foobar legitimately needs:

| REST is good at | Honest assessment |
|---|---|
| Debuggability with `curl` | True. A `foobar-cli get records/invoices/123` thin wrapper around JSON-RPC covers this. |
| External integrations (webhooks in, links out) | Webhooks specifically *do* need HTTP. So does sharing a permalink to a record. |
| File uploads (multipart) | Real concern. WS handles binary but multipart is awkward. |
| Caching with HTTP intermediaries | Not relevant here — single-user local server. |
| Resource-shaped URLs | Aesthetic; doesn't reduce code. |

So the principled compromise is: **keep one primary protocol (JSON-RPC over WS for browser, stdio for headless drivers), and add a thin HTTP surface only where the *transport* genuinely matters.** That second surface should be a *projection of the same commands*, not a parallel implementation. Concretely:

```
HTTP surface (thin, optional, transport-driven):
  GET    /api/records/:type/:id        → calls records.get internally
  POST   /webhooks/:source             → translates payload into records.* commands
  POST   /api/uploads                  → multipart, returns blob id usable in records.*
  GET    /api/health                   → liveness
  GET    /                             → serves the static web bundle
```

These endpoints all delegate to the same internal command functions; they're shims, not a second API. The browser does *not* use them — it talks WS exclusively. The HTTP surface exists for external callers and uploads.

A useful guideline: **if a feature requires a long-lived connection or pushes events, it's WS. If it only needs request-response and a non-WS caller exists, it can be HTTP.** Records normally fall in the first bucket. Webhooks and uploads in the second.

### The mental model

```diagram
                            ╭─────────────────────╮
                            │   commands.ts       │  ← single source of truth
                            │   (typed verbs,     │
                            │    authority gate,  │
                            │    event emit)      │
                            ╰──────────┬──────────╯
                                       │ called by
            ┌──────────────┬───────────┼───────────┬───────────────┐
            ▼              ▼           ▼           ▼               ▼
        records.*    session tool   web HTTP    webhook       slash command
        RPC method   handlers       shim        receiver      (TUI)
            │              │           │           │               │
            └────────┬─────┴─────┬─────┴─────┬─────┴───────────────┘
                     ▼           ▼           ▼
              browser WS    agent (Node)   external
                            (in-process)   HTTP callers
```

Every actor — browser, agent, headless RPC driver, webhook source, TUI slash command — calls the same set of typed command functions. The transports differ; the surface doesn't.

So: yes, REST endpoints were divergent; retracting them as a primary surface. The correct primary is **JSON-RPC for everything, served over WS to the browser and stdio for headless mode.** A small HTTP surface stays only for the things HTTP is specifically needed for, and it's strictly a shim over the same command layer — never the agent's path, never the browser's path.

## User

the possible exception that seems plausible to me at first, was that maybe there are read-only REST endpoints, i.e. just GET, to facilitate data loading and display; but maybe this is not necessary. How would the front-end architecture work then, assuming we're using React, when the server I/O is all RPC over websockets?

## Assistant

Good — you're right that read-only GETs *feel* plausible but they don't actually buy you much here, because the data you want to load is the same data you want to *watch* (records change, the agent might be writing them mid-view). Once a view needs live updates, fetching it once over GET means you have to layer a WS subscription on top anyway. Better to start with the subscription.

Here's how the frontend architecture works.

### Three primitives, one transport

The whole React app needs exactly three data primitives, all implemented over the single WS connection:

| Primitive | Maps to | When |
|---|---|---|
| **Query** | One JSON-RPC call, response cached by `(method, params)` | Reads where you don't need live updates (settings, dropdown options, schema metadata) |
| **Subscription** | `records.subscribe` → one snapshot + a stream of `records.changed` events | Any view of records — list pages, detail pages, dashboards |
| **Mutation** | One JSON-RPC call, returns result + invalidates/updates cache | Writes: `records.create`, `records.update`, `session.prompt` |

This is the same trichotomy GraphQL uses, and Relay/Apollo/tRPC/TanStack Query all support — there's nothing exotic about it.

### Client layer (transport + state)

```diagram
                            ╭───────────────────────╮
                            │  WebSocket (one,      │
                            │   foobar:port/ws)     │
                            ╰───────────┬───────────╯
                                        │
                            ╭───────────▼───────────╮
                            │  RpcClient (singleton)│
                            │  - connect / reconnect│
                            │  - id ↔ request map   │
                            │  - subscription map   │
                            │  - re-subscribe on    │
                            │    reconnect          │
                            ╰───────────┬───────────╯
                                        │
              ╭─────────────────────────┼─────────────────────────╮
              ▼                         ▼                         ▼
        useQuery(method,         useSubscription(            useMutation(method)
                 params)                 method, params)
              │                         │                         │
              ▼                         ▼                         ▼
         TanStack Query           TanStack Query             TanStack Query
         queryFn = rpc.call       initialData = first         mutationFn = rpc.call
                                   event; onUpdate →           onMutate = optimistic
                                   queryClient.setQueryData    onSettled = invalidate
```

**One WebSocket, one client, three hooks.** The RpcClient owns the wire; the hooks own the React integration; TanStack Query owns the cache and re-render scheduling. Each piece does one thing.

A typical view ends up looking like this:

```tsx
function InvoiceDetail({ id }: { id: string }) {
  const { data: invoice, status } = useSubscription("records.subscribe", {
    type: "invoice",
    id,
  });
  const updateInvoice = useMutation("records.update");

  if (status === "loading") return <Skeleton />;
  if (!invoice) return <NotFound />;

  return (
    <Form
      defaultValues={invoice}
      onSubmit={(values) =>
        updateInvoice.mutate({
          type: "invoice",
          id,
          ifVersion: invoice.version,
          data: values,
        })
      }
    />
  );
}
```

No fetch, no useEffect data loading, no manual cache invalidation. The subscription handles initial load *and* live updates uniformly. The mutation handles writes *and* concurrency (the `ifVersion` round-trips).

### Why TanStack Query, given the trichotomy

I'd reach for TanStack Query rather than rolling state management because:

- It already understands `(method, params) → cached result` semantics — that's its whole model. You just supply a custom `queryFn` that calls `rpc.call(method, params)`.
- It has battle-tested **optimistic updates** with rollback (`onMutate` / `onError`), which you'll want for record edits.
- It handles **request deduplication**: two components subscribing to the same record share one subscription on the wire.
- The cache invalidation API (`queryClient.invalidateQueries`, `setQueryData`) is exactly what a subscription handler needs to push live updates into.
- It plays nicely with React Suspense / `use()` if you want that idiom.

The only thing it doesn't natively do is WS subscriptions. You bridge that in ~30 lines:

```ts
function useSubscription(method, params) {
  const queryClient = useQueryClient();
  const queryKey = [method, params];

  const query = useQuery({
    queryKey,
    queryFn: () => rpc.call(method, params),         // initial snapshot
    staleTime: Infinity,                              // don't refetch — we're subscribed
  });

  useEffect(() => {
    const sub = rpc.subscribe(method, params, (event) => {
      queryClient.setQueryData(queryKey, event.value);
    });
    return () => sub.unsubscribe();
  }, [method, JSON.stringify(params)]);

  return query;
}
```

That's it. Everything else — render scheduling, garbage collection of stale data, devtools — comes from TanStack.

### What about the initial load?

This is the question REST GETs feel like they solve, but the answer is straightforward:

- Foobar's web server serves a **static SPA bundle** (HTML + JS + CSS, the same dist baked into the npm package).
- The HTML loads instantly; the JS opens the WS; the first roundtrip happens on localhost.
- First paint shows route shell + skeletons; subscriptions resolve in single-digit milliseconds.
- For a single-user local dev tool, you cannot perceive the difference between this and SSR.

If you wanted to optimize further, the truly cheap trick is: **inject the initial cache snapshot into the HTML**. Foobar's HTTP handler for `/` can run the relevant queries server-side, JSON-stringify them, and bake them into a `<script id="__initial_cache">…</script>` tag. The React app reads that on mount and seeds `queryClient.setQueryData` before any WS roundtrip happens. This makes first paint truly instantaneous and is ~50 lines of code total. Whether it's worth it depends on perceived snappiness; you can ship without it and add later.

### Routing and code-splitting

Standard React Router (or TanStack Router, which integrates nicely with TanStack Query) with `lazy()` per route. Because data loading goes through the WS subscription primitive, **there are no data-loading waterfalls** — code loads while data subscriptions kick off in parallel. The classic SPA cold-start problem (load JS → load data → render) collapses to (load JS + open WS in parallel → render).

If you go with TanStack Router, the loader pattern works cleanly:

```ts
const route = createRoute({
  path: "/invoices/$id",
  loader: ({ params }) => queryClient.ensureQueryData({
    queryKey: ["records.get", { type: "invoice", id: params.id }],
    queryFn: () => rpc.call("records.get", { type: "invoice", id: params.id }),
  }),
  component: InvoiceDetail,
});
```

The loader pre-warms the cache before the component mounts; the component then upgrades that cache entry to a live subscription via `useSubscription`. Best of both worlds.

### Reconnect, errors, optimistic concurrency

Three behaviors the RpcClient + hooks layer needs to handle, all standard:

- **Reconnect:** when the WS drops, the client opens a new one and re-issues every active subscription. TanStack Query treats this as if the subscription's data became fresh again; no UI flicker beyond a brief stale state.
- **Errors:** RPC errors come back as standard JSON-RPC `{ code, message, data }` and are exposed through TanStack's `error` field on each hook. You handle them per-view (banner, toast, inline) like any async error.
- **Optimistic concurrency:** `records.update` returns `{ ok: false, code: "version_conflict", current }` when `ifVersion` is stale. The mutation's `onError` shows a conflict UI and offers "discard local / merge / keep mine"; rolling back the optimistic update is a one-liner in TanStack.

### When you'd actually reach for a REST GET

Three honest cases left over:

1. **A user shares a permalink to a specific record.** Opening that URL needs an HTML page; the page can either (a) be served by the same SPA shell and load via WS subscription on mount (recommended), or (b) be SSR'd from a GET handler. The SPA path is simpler.
2. **An external tool wants to grep records without speaking JSON-RPC.** This is what `foobar-cli` is for — a small CLI wrapper around the WS client. If you also expose a `GET /api/records/:type/:id` shim it's strictly a convenience for `curl`.
3. **A static asset that happens to be a record.** Images, attachments, generated PDFs — they need `Content-Type` headers and HTTP caching. These genuinely should be HTTP, but they're files, not records.

None of these are reasons to introduce REST as the *frontend's* data path. The browser stays on the WS spine; the HTTP surface stays a small shim for things HTTP is uniquely good at.

### The thing this all enables

Once every view in the React app is a `useSubscription`, the app becomes **eventually consistent with the server's record store, by construction.** When the agent updates a record, every open browser tab shows the change immediately. When the user edits in tab A, tab B sees it. When two clients race, optimistic concurrency catches the conflict at write time. You never write a refresh button, you never write a polling loop, you never write a "stale data" warning — those failure modes simply don't exist in the data plane.

That's the architectural payoff for committing to one protocol with subscriptions as a first-class primitive. The frontend gets simpler, not more complex.

## User

OK excellent. very interesting. I think we're getting close to the outline of an MVP for such a product. A further question: Let's imagine that the structured records this application lets you build, together with an agent, are the nodes and edges of an *intent graph*. This intent graph as a whole, constitutes the specification for a software project, which means that it must remain structurally legal (local rules) as well as semantically legal (global coherence). This also means that in any given agent session, continuity of context such as elicited by the agent, and expressed by the user, is important. In an application architecture which allows multiple sessions however, and also allows direct user-editing in some way, there is the possibility that this continuity becomes disrupted between turns. In this architecture the way we are imagining it so far, how can I determine between turns, if the overall "state of the world / coherence state" of the intent-graph might have changed between turns of a session, due to changes that were made outside of that session?

## Assistant

Great question — and it cuts to the deepest architectural problem in this design. Let me work through it carefully.

The problem decomposes into **four distinct questions** that often get conflated:

```diagram
  ╭─ "Has the world changed since my session last looked?" ─────╮
  │  Q1: DETECTION   — Did anything change at all?              │
  │  Q2: RELEVANCE   — Of what changed, what matters to me?     │
  │  Q3: COHERENCE   — Is the graph still globally legal?       │
  │  Q4: RECONCILE   — How does the agent learn about it?       │
  ╰─────────────────────────────────────────────────────────────╯
```

Each needs its own mechanism, and they compose.

### Q1 — Detection: a monotonic clock for the graph

The cheapest answer: every write to the records store advances a **monotonic Log Sequence Number** (LSN, or call it `graphRevision`). One counter, graph-wide.

```sql
CREATE TABLE graph_clock (lsn INTEGER PRIMARY KEY);
CREATE TABLE change_log (
  lsn        INTEGER PRIMARY KEY,
  ts         INTEGER NOT NULL,
  actor      TEXT NOT NULL,       -- session_id, user, agent_on_behalf_of, …
  op         TEXT NOT NULL,       -- create | update | delete | edge_add | edge_remove
  record_type TEXT NOT NULL,
  record_id  TEXT NOT NULL,
  diff       BLOB NOT NULL,       -- json patch
  invariants_violated TEXT        -- nullable; populated by validator
);
```

Every command writes one row to `change_log` and advances `graph_clock`. The append-only log is the source of truth for "what happened." Per-record `version` columns are derived from this — the existence of the log is what makes detection possible without polling individual records.

A session, between turns, asks one cheap question:

```ts
const currentLsn = await records.getCurrentLsn();
if (currentLsn > session.lastSeenLsn) {
  // something happened — proceed to Q2
}
```

That's the gross filter. Constant-time, no false negatives.

### Q2 — Relevance: a per-session interest set

The vast majority of changes are not relevant to any given session. You need a **session-scoped read set** that grows as the agent (and the user, via the UI) touches the graph.

Three layers of interest, in increasing aggressiveness:

| Layer | Members | When added |
|---|---|---|
| **Direct** | Record IDs the session read, wrote, or whose subscribe stream it consumed | On every records.* call inside the session |
| **Mentioned** | Record IDs that appear in user prompts or assistant messages (extracted by regex on `record:` URIs, or by an LLM pass during compaction) | On message ingest |
| **Neighborhood** | 1-hop edges out from the direct set; optionally further | Computed at query time, not stored |

Persist the Direct + Mentioned sets alongside session state (`.foobar/sessions/<id>.jsonl` already has the right shape; add `interest_set` lines as a new entry type). The Neighborhood is computed on demand against the current graph.

Between turns:

```ts
const events = await records.changesSince(session.lastSeenLsn, {
  actor: { not: session.id },         // exclude self-writes
});
const relevant = events.filter(e =>
  session.interestSet.has(e.record_id) ||
  session.interestSet.hasNeighbor(e.record_id, depth=1)
);
```

If `relevant` is empty, the change cloud is "background noise" — record progress in some other session, an unrelated edit by the user. Update `lastSeenLsn` silently and proceed.

If `relevant` is non-empty, you have a **divergence**.

### Q3 — Coherence: a separable, queryable property

Treat coherence as **a property of the graph that has its own lifecycle**, not as a synchronous validation gate. Two reasons:

1. **Performance**: global coherence checks are expensive (graph traversals, cycle detection, constraint propagation). You don't want every write to pay that cost.
2. **Honesty**: a graph can be locally legal everywhere yet globally incoherent. Pretending writes can always restore coherence is a lie.

Concretely:

```sql
CREATE TABLE coherence (
  id                 INTEGER PRIMARY KEY,
  computed_at_lsn    INTEGER NOT NULL,
  state              TEXT NOT NULL,     -- clean | dirty | validating | incoherent
  violations         BLOB NOT NULL      -- json[]: rule_id, scope, message, evidence
);
```

Two things populate it:

- **Structural validation** runs **eagerly** on every write — these are local invariants enforced as DB constraints or per-command precondition checks. A write that breaks structure is rejected at commit. The graph is never structurally illegal.
- **Semantic validation** runs **lazily / out-of-band** — a coherence validator subscribes to `records.changed`, debounces, and re-evaluates global rules over the graph (or affected subgraphs, with dependency tracking). It writes a new `coherence` row each time it completes. The graph can be in `dirty` state during validation, `incoherent` after if violations are found.

This means the system has a **coherence state**, not just a coherence answer. You can ask it three questions:

| Question | Answer |
|---|---|
| Is the graph currently believed coherent? | `state` field |
| Was that determination current as of which LSN? | `computed_at_lsn` |
| What violations exist? | `violations` |

For session-level reasoning, the second one matters most: if `computed_at_lsn < currentLsn`, the coherence verdict is stale and a fresh validation should be queued.

### Q4 — Reconciliation: the agent learns at the turn boundary

Now the architectural payoff. We already saw that the agent loop has a **`prepareNextTurn`** hook that runs between turns and can inject a turn update. And we saw that **custom message roles** can be added via TypeScript declaration merging into `CustomAgentMessages`, with their projection to LLM-visible content defined by `convertToLlm`. These are the only seams you need.

```diagram
  ╭──────────────────────────────────────────────────────────────╮
  │  foobar agent extension's prepareNextTurn:                   │
  │                                                              │
  │  1. const currentLsn = records.getCurrentLsn()               │
  │  2. if (currentLsn === session.lastSeenLsn) return undefined │
  │  3. const events = records.changesSince(session.lastSeenLsn, │
  │                       excludeActor: session.id)              │
  │  4. const relevant = filterByInterestSet(events, session)    │
  │  5. const coh = records.getCoherenceState()                  │
  │  6. session.lastSeenLsn = currentLsn                         │
  │  7. if (relevant.empty && coh.clean) return undefined        │
  │  8. return {                                                 │
  │       messagesToAppend: [{                                   │
  │         role: "worldUpdate",                                 │
  │         relevantChanges: relevant,                           │
  │         coherenceState: coh,                                 │
  │         timestamp: Date.now(),                               │
  │       }],                                                    │
  │     }                                                        │
  ╰──────────────────────────────────────────────────────────────╯
```

The `worldUpdate` custom message role is declared and projected:

```ts
declare module "@earendil-works/pi-agent-core" {
  interface CustomAgentMessages {
    worldUpdate: WorldUpdateMessage;
  }
}

// in convertToLlm:
case "worldUpdate":
  return {
    role: "user",
    content: [{ type: "text", text: formatWorldUpdate(m) }],
  };
```

Where `formatWorldUpdate` produces something like:

```
[Note: while this conversation was idle, the intent graph changed in ways
relevant to what we've been discussing.]

Changes since the last turn (3 relevant of 17 total):
  - Goal G-payments-v2 (was: status=draft, now: status=approved)
      changed by: user, 12:43
  - Constraint C-pci-required (added)
      created by: user, 12:44
  - Task T-stripe-integration (was: depends_on=[G-payments-v1],
                                now: depends_on=[G-payments-v2])
      changed by: session S-789 (Alice), 12:45

Coherence: as of LSN 18472 (current), graph is INCOHERENT.
Violations:
  - rule: tasks_must_link_to_active_goal
    scope: T-checkout-flow
    message: links to deleted goal G-checkout-v0
    evidence: …

Please take these into account before proceeding. You may need to:
  - re-read records you were working with
  - revise plans that assumed prior state
  - decline to make changes that would conflict
  - help resolve coherence violations if relevant to this conversation
```

The agent reads this as user-attributed context at the top of its next response. It can choose to re-fetch records, ask the user clarifying questions, propose a recovery, or surface the coherence problem.

### The flow, end-to-end

```diagram
  user types prompt              user edits in web UI         another session writes
         │                                │                            │
         │                                ▼                            ▼
         │                  ╭─────────────────────────────────────────────╮
         │                  │  records server: every command              │
         │                  │   - append to change_log                    │
         │                  │   - advance graph_clock                     │
         │                  │   - emit records.changed event              │
         │                  │   - update per-record version               │
         │                  │   - structural validation (sync)            │
         │                  ╰─────────────┬───────────────────────────────╯
         │                                │
         │                                ▼
         │                  ╭─────────────────────────────────────────────╮
         │                  │  coherence validator (async, debounced)     │
         │                  │   - recomputes global invariants            │
         │                  │   - writes new coherence row                │
         │                  ╰─────────────────────────────────────────────╯
         ▼
  ╭─────────────────────────────────────────────────────────────────────────╮
  │  session.prompt(...) is called                                          │
  │                                                                         │
  │  agent loop, before LLM call:                                           │
  │   1. prepareNextTurn fires                                              │
  │   2. compares lastSeenLsn → currentLsn                                  │
  │   3. fetches relevant changes + coherence state                         │
  │   4. if non-empty: appends a worldUpdate custom message                 │
  │                                                                         │
  │  agent loop, building LLM payload (we mapped this earlier):             │
  │   5. transformContext runs                                              │
  │   6. convertToLlm projects worldUpdate → user message                   │
  │   7. systemPrompt + messages + tools shipped to provider                │
  │                                                                         │
  │  agent loop, during turn:                                               │
  │   8. every tool call to records.* updates session.interestSet           │
  │      and session.lastSeenLsn                                            │
  ╰─────────────────────────────────────────────────────────────────────────╯
```

### The properties this gives you

- **No polling.** The clock + change log is the source of truth; the session checks it at one moment, the turn boundary.
- **No false negatives.** If `currentLsn > lastSeenLsn`, the system knows the world has changed. It can be deliberate about how loudly to tell the agent.
- **Tunable false positives.** The interest set + neighborhood depth controls how often "something changed but it doesn't matter" leaks into the conversation. Start tight (Direct only), widen if the agent makes incoherent decisions.
- **Explicit coherence as a first-class signal.** The agent doesn't infer coherence from the records' surface; it sees the validator's verdict and the violations directly.
- **Honest about staleness.** Because `coherence.computed_at_lsn` is recorded, the agent can be told "coherence verdict is current" vs "verdict is stale; treat with skepticism."
- **One mechanism serves all event sources.** Other sessions, direct UI edits, webhooks, future collaborators — they all advance the same LSN, write to the same log, are filtered by the same interest set.

### The subtler dimensions

A few things the MVP doesn't need to solve but the architecture should leave room for:

**Snapshot vs live consistency within a turn.** A turn is a sequence of tool calls that may take minutes. Do you let mid-turn changes from other actors affect the agent? For an intent graph, I'd say **no**: the turn operates against a snapshot, and any updates that landed mid-turn surface at the *next* turn boundary. This keeps the agent's reasoning internally coherent. The cost is occasional staleness; the gain is no thrashing.

**Read-set conflict at turn-end.** When the turn finishes and its writes are about to commit, you can check: were any records in the turn's read set modified by another actor since the turn started? If yes, you've got a transactional conflict. Options: reject the writes (forces the agent to retry with fresh data — expensive), accept the writes (last-writer-wins), or accept-and-flag (writes land, but `coherence` immediately enters `dirty` and the validator runs). Accept-and-flag is the friendliest for an MVP.

**Hard vs soft incoherence response.** Structural violations should never exist (commit-time enforcement). Semantic violations have severity: some make the graph unusable (the agent should refuse to elaborate the affected subtree until repaired), others are just warnings. Encode `severity` in the violation record and let the agent's prompt template decide how to react.

**Coherence-aware compaction.** When the conversation gets long enough to compact, the compaction summary should *include* the interest set and recent coherence verdicts, not just the message text. Otherwise the compacted session loses its grip on the graph it was reasoning about. This is the right place to keep the "what was this conversation about, in graph terms?" anchor.

**Coherence is itself a graph property — surface it in the UI too.** The web UI should show the coherence badge alongside the graph view, with violations clickable. The agent's `worldUpdate` injection and the user's UI experience should be two views of the same state — neither should be authoritative over the other.

### The minimum viable version

For an MVP, ship:

- `graph_clock` + `change_log` tables with monotonic LSN.
- Per-session `lastSeenLsn` and `interestSet` (Direct only, no Neighborhood yet).
- A synchronous structural validator (DB constraints + per-command checks).
- A trivial coherence validator that runs on every commit (no debounce yet) and writes verdicts to `coherence`.
- A `prepareNextTurn` hook in the foobar agent extension that produces `worldUpdate` messages when relevant.
- A `worldUpdate` custom message role with a plain-text projection.

That's ~600 lines of TypeScript + SQL. You can ship a coherent (pun intended) MVP without ever optimizing, then add Neighborhood depth, debouncing, dependency-tracked re-validation, read-set conflict checks, and severity-aware response policies as real usage reveals which corners actually hurt.

The deep payoff: because every cross-session, cross-actor change leaves a trace in one place (the change log), and because the agent's awareness of "what changed" goes through one place (the `prepareNextTurn` hook), you have **a single point in the architecture where the continuity-of-context problem is solved**. Add a new mode (collaborator joining the session, headless bot writing records), and that point is the only thing that needs to know.
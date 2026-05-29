import { access, readdir } from "node:fs/promises"
import { dirname, extname, join, relative, sep } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

import {
  type ExtensionAPI,
  type ExtensionFactory,
} from "@earendil-works/pi-coding-agent"

import { type GraphMentionSource } from "./.pi/extensions/mention-autocomplete.js"
import { FIXTURE_GRAPH_MENTION_SOURCE } from "./.pi/extensions/mention-autocomplete.js"
import { type BrunchChromeState } from "./.pi/extensions/chrome.js"
import { type BrunchSessionBoundaryHandler } from "./.pi/extensions/session-lifecycle.js"
import { type BrunchSpecSessionPickerOptions } from "./.pi/extensions/workspace-dialog.js"

export { registerBrunchAlternatives } from "./.pi/extensions/alternatives.js"
export { BRUNCH_BRANCH_FLOW_BLOCKED_MESSAGE } from "./.pi/extensions/command-policy.js"
export {
  registerBrunchMentionAutocomplete,
  type GraphMentionCandidate,
  type GraphMentionSource,
} from "./.pi/extensions/mention-autocomplete.js"
export {
  BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE,
  DEFAULT_BRUNCH_AGENT_STATE,
  appendBrunchAgentRuntimeInit,
  appendBrunchAgentRuntimeSwitch,
  projectBrunchAgentState,
  registerBrunchOperationalModePolicy,
  type AgentLensId,
  type AgentRoleDefinition,
  type AgentRoleId,
  type AgentStrategyId,
  type BrunchAgentState,
  type BrunchAgentStateEntryData,
  type BrunchAgentStateEntrySessionManager,
  type OperationalModeDefinition,
  type OperationalModeId,
  type ResolvedBrunchAgentState,
} from "./.pi/extensions/operational-mode.js"
export {
  chromeStateForWorkspace,
  projectBrunchChromeFooterLines,
  renderBrunchChrome,
  type BrunchChromeCoherenceVerdict,
  type BrunchChromeFooterTelemetry,
  type BrunchChromeStage,
  type BrunchChromeState,
  type BrunchChromeUi,
  type BrunchChromeWorkerStatus,
} from "./.pi/extensions/chrome.js"
export {
  bindBrunchSessionBoundary,
  registerBrunchSessionBoundaryRefreshHandlers,
  type BrunchSessionBoundaryHandler,
} from "./.pi/extensions/session-lifecycle.js"
export {
  BRUNCH_WORKSPACE_COMMAND,
  BRUNCH_WORKSPACE_SHORTCUT,
  registerBrunchWorkspaceDialog,
  runBrunchWorkspaceAction,
  runBrunchWorkspaceCommand,
  type BrunchSpecSessionPickerOptions,
} from "./.pi/extensions/workspace-dialog.js"

export interface BrunchPiExtensionShellOptions
  extends BrunchSpecSessionPickerOptions {
  graphMentionSource?: GraphMentionSource
}

export interface BrunchProductExtensionContext {
  chrome: BrunchChromeState
  onSessionBoundary?: BrunchSessionBoundaryHandler
  options: BrunchPiExtensionShellOptions
  graphMentionSource: GraphMentionSource
}

export const BRUNCH_PRODUCT_EXTENSION_READY = "ready" as const

export interface BrunchExtensionMeta {
  productStatus: typeof BRUNCH_PRODUCT_EXTENSION_READY | "wip" | "dev-only"
  loadOrder?: number
}

export type BrunchProductExtensionRegistration = (
  pi: ExtensionAPI,
  context: BrunchProductExtensionContext,
) => void | Promise<void>

export interface BrunchProductExtensionEntry {
  path: string
  meta: BrunchExtensionMeta & {
    productStatus: typeof BRUNCH_PRODUCT_EXTENSION_READY
  }
  registerProductExtension: BrunchProductExtensionRegistration
}

interface BrunchExtensionModule {
  brunchExtensionMeta?: BrunchExtensionMeta
  registerBrunchProductExtension?: BrunchProductExtensionRegistration
}

const EXTENSIONS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  ".pi",
  "extensions",
)

export async function discoverBrunchProductExtensionEntries(
  extensionsDir: string = EXTENSIONS_DIR,
): Promise<BrunchProductExtensionEntry[]> {
  const entryFiles = await discoverExtensionEntryFiles(extensionsDir)
  const entries = await Promise.all(
    entryFiles.map(async (file) => {
      const module = (await import(
        pathToFileURL(file).href
      )) as BrunchExtensionModule
      const meta = module.brunchExtensionMeta
      if (meta?.productStatus !== BRUNCH_PRODUCT_EXTENSION_READY) {
        return undefined
      }
      if (module.registerBrunchProductExtension === undefined) {
        throw new Error(
          `Prod-ready Brunch extension ${file} must export registerBrunchProductExtension`,
        )
      }
      return {
        path: normalizeExtensionPath(relative(extensionsDir, file)),
        meta: {
          ...meta,
          productStatus: BRUNCH_PRODUCT_EXTENSION_READY,
        },
        registerProductExtension: module.registerBrunchProductExtension,
      }
    }),
  )
  return entries
    .filter(
      (entry): entry is BrunchProductExtensionEntry => entry !== undefined,
    )
    .sort(
      (left, right) =>
        (left.meta.loadOrder ?? 0) - (right.meta.loadOrder ?? 0) ||
        left.path.localeCompare(right.path),
    )
}

async function discoverExtensionEntryFiles(
  extensionsDir: string,
): Promise<string[]> {
  const dirents = await readdir(extensionsDir, { withFileTypes: true })
  const files: string[] = []
  for (const dirent of dirents) {
    const file = join(extensionsDir, dirent.name)
    if (dirent.isFile() && isExtensionEntrypointFile(dirent.name)) {
      files.push(file)
    }
    if (dirent.isDirectory()) {
      for (const extension of [".ts", ".js"]) {
        const indexFile = join(file, `index${extension}`)
        if (await fileExists(indexFile)) files.push(indexFile)
      }
    }
  }
  return files
}

function isExtensionEntrypointFile(file: string): boolean {
  const extension = extname(file)
  return (extension === ".ts" || extension === ".js") && !file.endsWith(".d.ts")
}

async function fileExists(file: string): Promise<boolean> {
  try {
    await access(file)
    return true
  } catch {
    return false
  }
}

function normalizeExtensionPath(path: string): string {
  return path.split(sep).join("/")
}

export function createBrunchPiExtensionShell(
  chrome: BrunchChromeState,
  onSessionBoundary: BrunchSessionBoundaryHandler | undefined,
  options: BrunchPiExtensionShellOptions,
): ExtensionFactory {
  return async (pi) => {
    const context: BrunchProductExtensionContext = {
      chrome,
      ...(onSessionBoundary === undefined ? {} : { onSessionBoundary }),
      options,
      graphMentionSource:
        options.graphMentionSource ?? FIXTURE_GRAPH_MENTION_SOURCE,
    }
    const entries = await discoverBrunchProductExtensionEntries()
    for (const entry of entries) {
      await entry.registerProductExtension(pi, context)
    }
  }
}

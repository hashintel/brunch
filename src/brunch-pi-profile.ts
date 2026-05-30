import process from "node:process"

import {
  SettingsManager,
  type ExtensionFactory,
} from "@earendil-works/pi-coding-agent"

export interface BrunchPiProfileOptions {
  cwd: string
  agentDir: string
  extensionFactories: ExtensionFactory[]
}

export interface BrunchPiProfile {
  settingsManager: SettingsManager
  resourceLoaderOptions: BrunchResourceLoaderOptions
}

export interface BrunchResourceLoaderOptions {
  noContextFiles: true
  noExtensions: true
  noPromptTemplates: true
  noSkills: true
  noThemes: true
  extensionFactories: ExtensionFactory[]
}

export function createBrunchPiProfile({
  cwd,
  agentDir,
  extensionFactories,
}: BrunchPiProfileOptions): BrunchPiProfile {
  return {
    settingsManager: createBrunchSettingsManager(cwd, agentDir),
    resourceLoaderOptions: brunchResourceLoaderOptions(extensionFactories),
  }
}

export function brunchResourceLoaderOptions(
  extensionFactories: ExtensionFactory[],
): BrunchResourceLoaderOptions {
  return {
    noContextFiles: true,
    noExtensions: true,
    noPromptTemplates: true,
    noSkills: true,
    noThemes: true,
    extensionFactories,
  }
}

export function applyBrunchOfflineDefault(
  env: { PI_OFFLINE?: string } = process.env,
): void {
  env.PI_OFFLINE ??= "1"
}

export function createBrunchSettingsManager(
  cwd: string,
  agentDir: string,
): SettingsManager {
  const settingsManager = SettingsManager.create(cwd, agentDir)
  settingsManager.getQuietStartup = () => true
  return settingsManager
}

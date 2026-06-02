import process from 'node:process';

import { SettingsManager, type ExtensionFactory } from '@earendil-works/pi-coding-agent';

export const BRUNCH_SETTINGS_POLICY = {
  quietStartup: true,
  packages: [],
  extensions: [],
  skills: [],
  prompts: [],
  themes: [],
  enableSkillCommands: false,
  doubleEscapeAction: 'none',
  compaction: {
    enabled: true,
    reserveTokens: 16384,
    keepRecentTokens: 20000,
  },
  branchSummary: {
    reserveTokens: 16384,
    skipPrompt: false,
  },
  retry: {
    enabled: true,
    maxRetries: 3,
    baseDelayMs: 2000,
    provider: {
      maxRetryDelayMs: 60000,
    },
  },
  terminal: {
    showImages: true,
    imageWidthCells: 60,
    clearOnShrink: false,
    showTerminalProgress: false,
  },
  images: {
    autoResize: true,
    blockImages: false,
  },
  transport: 'auto',
  collapseChangelog: false,
  enableInstallTelemetry: false,
  showHardwareCursor: false,
  editorPaddingX: 0,
  autocompleteMaxVisible: 5,
  markdown: {
    codeBlockIndent: '  ',
  },
  warnings: {},
} satisfies Parameters<typeof SettingsManager.inMemory>[0];

export const BRUNCH_SETTINGS_AUDITED_GETTERS = [
  'getGlobalSettings',
  'getProjectSettings',
  'getLastChangelogVersion',
  'getSessionDir',
  'getDefaultProvider',
  'getDefaultModel',
  'getSteeringMode',
  'getFollowUpMode',
  'getTheme',
  'getDefaultThinkingLevel',
  'getTransport',
  'getCompactionEnabled',
  'getCompactionReserveTokens',
  'getCompactionKeepRecentTokens',
  'getCompactionSettings',
  'getBranchSummarySettings',
  'getBranchSummarySkipPrompt',
  'getRetryEnabled',
  'getRetrySettings',
  'getProviderRetrySettings',
  'getHideThinkingBlock',
  'getShellPath',
  'getQuietStartup',
  'getShellCommandPrefix',
  'getNpmCommand',
  'getCollapseChangelog',
  'getEnableInstallTelemetry',
  'getHttpIdleTimeoutMs',
  'getPackages',
  'getExtensionPaths',
  'getSkillPaths',
  'getPromptTemplatePaths',
  'getThemePaths',
  'getEnableSkillCommands',
  'getThinkingBudgets',
  'getShowImages',
  'getImageWidthCells',
  'getClearOnShrink',
  'getShowTerminalProgress',
  'getImageAutoResize',
  'getBlockImages',
  'getEnabledModels',
  'getDoubleEscapeAction',
  'getTreeFilterMode',
  'getShowHardwareCursor',
  'getEditorPaddingX',
  'getAutocompleteMaxVisible',
  'getCodeBlockIndent',
  'getWarnings',
] as const;

export interface BrunchPiProfileOptions {
  cwd: string;
  agentDir: string;
  extensionFactories: ExtensionFactory[];
}

export interface BrunchPiProfile {
  settingsManager: SettingsManager;
  resourceLoaderOptions: BrunchResourceLoaderOptions;
}

export interface BrunchResourceLoaderOptions {
  noContextFiles: true;
  noExtensions: true;
  noPromptTemplates: true;
  noSkills: true;
  noThemes: true;
  extensionFactories: ExtensionFactory[];
}

export function createBrunchPiProfile({
  cwd,
  agentDir,
  extensionFactories,
}: BrunchPiProfileOptions): BrunchPiProfile {
  return {
    settingsManager: createBrunchSettingsManager(cwd, agentDir),
    resourceLoaderOptions: brunchResourceLoaderOptions(extensionFactories),
  };
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
  };
}

export function applyBrunchOfflineDefault(env: { PI_OFFLINE?: string } = process.env): void {
  env.PI_OFFLINE ??= '1';
}

export function createBrunchSettingsManager(_cwd: string, _agentDir: string): SettingsManager {
  return SettingsManager.inMemory(BRUNCH_SETTINGS_POLICY);
}

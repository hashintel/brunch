import process from 'node:process';

import { SettingsManager, type ExtensionFactory } from '@earendil-works/pi-coding-agent';

export const BRUNCH_SETTINGS_POLICY = {
  quietStartup: true,
  defaultProjectTrust: 'never',
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
  enableAnalytics: false,
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
  'getDefaultProjectTrust',
  'getShellCommandPrefix',
  'getNpmCommand',
  'getCollapseChangelog',
  'getEnableInstallTelemetry',
  'getEnableAnalytics',
  'getTrackingId',
  'getHttpIdleTimeoutMs',
  'getWebSocketConnectTimeoutMs',
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

export interface BrunchPiSettingsOptions {
  cwd: string;
  agentDir: string;
  extensionFactories: ExtensionFactory[];
}

export interface BrunchPiSettings {
  settingsManager: SettingsManager;
  resourceLoaderOptions: BrunchResourceLoaderOptions;
}

export interface BrunchResourceLoaderOptions {
  noContextFiles: true;
  noExtensions: true;
  noPromptTemplates: true;
  noSkills: true;
  noThemes: true;
  // D39-L seal: pin the append-system-prompt source to empty so Pi's resource
  // loader never falls through to ambient discovery of `<cwd>/.pi/APPEND_SYSTEM.md`
  // or `<agentDir>/APPEND_SYSTEM.md`. Without this an ambient global append leaks
  // into the Brunch system prompt (the other no* flags do not cover it).
  appendSystemPrompt: string[];
  extensionFactories: ExtensionFactory[];
}

export function createBrunchPiSettings({
  cwd,
  agentDir,
  extensionFactories,
}: BrunchPiSettingsOptions): BrunchPiSettings {
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
    appendSystemPrompt: [],
    extensionFactories,
  };
}

export function applyBrunchOfflineDefault(
  env: { PI_OFFLINE?: string; PI_SKIP_VERSION_CHECK?: string } = process.env,
): void {
  env.PI_OFFLINE ??= '1';
  env.PI_SKIP_VERSION_CHECK ??= '1';
}

export function createBrunchSettingsManager(_cwd: string, _agentDir: string): SettingsManager {
  return SettingsManager.inMemory(BRUNCH_SETTINGS_POLICY);
}

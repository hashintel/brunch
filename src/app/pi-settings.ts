import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  DefaultResourceLoader,
  SettingsManager,
  type ExtensionFactory,
  type Theme,
} from '@earendil-works/pi-coding-agent';

import { cleanupBrunchKeybindingFilePolicy } from './pi-keybindings.js';

/**
 * Brunch theme pair. The `light/dark` slash syntax enables Pi's native
 * terminal color-scheme auto-sync: the interactive theme controller resolves
 * the pair against the detected terminal background and re-resolves live on
 * terminal color-scheme change events (e.g. macOS appearance flips).
 */
const BRUNCH_LIGHT_THEME_NAME = 'brunch-light';
const BRUNCH_DARK_THEME_NAME = 'brunch-dark';
const BRUNCH_THEME_SETTING = `${BRUNCH_LIGHT_THEME_NAME}/${BRUNCH_DARK_THEME_NAME}`;

const BRUNCH_BASE_SYSTEM_PROMPT = `You are a Brunch product agent. Help the user shape and execute a graph-native specification through the Brunch capabilities, policy, and live context appended below.

Be concise. Use only the tools and prompt resources exposed by the active Brunch runtime.`;

/**
 * Theme JSONs live beside the Pi runtime surface in `.pi/themes/` and are
 * mirrored into `dist/.pi/themes/` by `build:pi-assets`, so this relative
 * resolution works from both the source and built trees.
 */
const BRUNCH_THEME_DIR = fileURLToPath(new URL('../.pi/themes/', import.meta.url));
export const BRUNCH_SETTINGS_POLICY = {
  quietStartup: true,
  defaultProvider: 'anthropic',
  defaultModel: 'claude-sonnet-4-6',
  defaultProjectTrust: 'never', // TODO: change this?
  packages: [],
  extensions: [],
  skills: [],
  prompts: [],
  themes: [],
  theme: BRUNCH_THEME_SETTING,
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
  hideThinkingBlock: true,
  terminal: {
    showImages: true,
    imageWidthCells: 60,
    clearOnShrink: false,
    // OSC 9;4 terminal-native progress: the liveness channel for working
    // state now that the buffer spinner is static (scrollback-safe working
    // indicator in src/.pi/extensions/chrome/). Degrades silently where
    // unsupported.
    showTerminalProgress: true,
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
  'getThemeSetting',
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
  // pi 0.80.x additions — defaults acknowledged, no Brunch policy pin:
  // cache-miss notices default off, external editor resolves $VISUAL/$EDITOR,
  // and output padding defaults to 1.
  'getShowCacheMissNotices',
  'getExternalEditorCommand',
  'getOutputPad',
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

export interface BrunchStartupThemeOptions {
  cwd: string;
  agentDir: string;
  env?: NodeJS.ProcessEnv;
}

export interface BrunchResourceLoaderOptions {
  noContextFiles: true;
  noExtensions: true;
  noPromptTemplates: true;
  noSkills: true;
  noThemes: true;
  // Brunch-owned themes enter through the explicit path seam; `noThemes`
  // continues to seal out ambient global/project theme discovery.
  additionalThemePaths: string[];
  // D39-L seal: pin the append-system-prompt source to empty so Pi's resource
  // loader never falls through to ambient discovery of `<cwd>/.pi/APPEND_SYSTEM.md`
  // or `<agentDir>/APPEND_SYSTEM.md`. Without this an ambient global append leaks
  // into the Brunch system prompt (the other no* flags do not cover it).
  appendSystemPrompt: string[];
  // Replace Pi's coding-assistant prompt wholesale through its supported loader
  // surface; Pi's default includes documentation meant for Pi development.
  systemPromptOverride: () => string;
  extensionFactories: ExtensionFactory[];
}

export function createBrunchPiSettings({
  cwd,
  agentDir,
  extensionFactories,
}: BrunchPiSettingsOptions): BrunchPiSettings {
  cleanupBrunchKeybindingFilePolicy(agentDir);
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
    additionalThemePaths: [BRUNCH_THEME_DIR],
    appendSystemPrompt: [],
    systemPromptOverride: () => BRUNCH_BASE_SYSTEM_PROMPT,
    extensionFactories,
  };
}

export async function resolveBrunchStartupTheme({
  cwd,
  agentDir,
  env = process.env,
}: BrunchStartupThemeOptions): Promise<Theme | undefined> {
  const settingsManager = createBrunchSettingsManager(cwd, agentDir);
  const resourceLoader = new DefaultResourceLoader({
    cwd,
    agentDir,
    settingsManager,
    ...brunchResourceLoaderOptions([]),
  });
  await resourceLoader.reload();
  const themeName =
    detectStartupTerminalTheme(env) === 'light' ? BRUNCH_LIGHT_THEME_NAME : BRUNCH_DARK_THEME_NAME;
  return resourceLoader.getThemes().themes.find((theme) => theme.name === themeName);
}

function detectStartupTerminalTheme(env: NodeJS.ProcessEnv): 'dark' | 'light' {
  // ceiling: COLORFGBG only captures startup background; live-theme-controller remains the runtime-change upgrade path.
  const colorfgbg = env.COLORFGBG ?? '';
  const background = Number.parseInt(colorfgbg.split(';').at(-1) ?? '', 10);
  if (!Number.isNaN(background)) {
    return background < 8 ? 'dark' : 'light';
  }
  return 'dark';
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

import { basename, resolve } from 'node:path';

import type {
  ExtensionAPI,
  ExtensionContext,
  ExtensionUIContext,
  Theme,
  ThemeColor,
} from '@earendil-works/pi-coding-agent';
import { truncateToWidth, visibleWidth } from '@earendil-works/pi-tui';

import {
  projectBrunchAgentState,
  type ResolvedBrunchAgentState,
} from '../../../projections/session/runtime-state.js';
import type {
  AgentLensSelection,
  AgentStrategySelection,
  OperationalModeId,
} from '../../../session/runtime-state.js';
import type {
  WorkspaceProjectState,
  WorkspaceSessionChromeState,
  WorkspaceSessionReadyState,
} from '../../../session/workspace-session-coordinator.js';
import { BrunchStartupHeader } from '../../components/chrome-header.js';

type BrunchChromeStage = 'idle' | 'streaming' | 'observer-review';
type BrunchChromeWorkerStatus = 'idle' | 'queued' | 'running' | 'blocked';
type BrunchChromeCoherenceVerdict = 'unknown' | 'coherent' | 'needs_review' | 'incoherent';

interface BrunchChromeContextUsage {
  usedTokens: number;
  maxTokens: number;
}

interface BrunchChromeRuntimeState {
  bundle?: string;
  role?: string;
  model?: string;
  thinking?: string;
  mode?: OperationalModeId;
  strategy?: AgentStrategySelection;
  lens?: AgentLensSelection;
}

interface BrunchChromeBuildState {
  version?: string;
  dev?: string;
}

interface BrunchChromeLiveContextUsage {
  tokens?: number | null;
  contextWindow?: number | null;
  percent?: number | null;
}

interface BrunchChromeModelTelemetry {
  id: string;
  provider?: string;
  reasoning?: boolean;
  contextWindow?: number;
}

interface BrunchChromeStartupHeaderState {
  decision: 'continue' | 'openSession' | 'newSpec' | 'newSession';
}

export interface BrunchChromeFooterTelemetry {
  statuses?: ReadonlyMap<string, string>;
  contextUsage?: BrunchChromeContextUsage;
  liveContextUsage?: BrunchChromeLiveContextUsage;
  model?: BrunchChromeModelTelemetry | null;
  thinkingLevel?: string;
  availableProviderCount?: number;
  agentState?: ResolvedBrunchAgentState;
}

export interface BrunchChromeRenderOptions {
  telemetry?: () => BrunchChromeFooterTelemetry;
  bindFooterRenderRequest?: (requestRender: (() => void) | null) => void;
}

export interface BrunchChromeState extends WorkspaceSessionChromeState {
  project?: WorkspaceProjectState;
  session: {
    id: string;
    label?: string;
  };
  webSidecarUrl?: string;
  startupHeader?: BrunchChromeStartupHeaderState;
  runtime?: BrunchChromeRuntimeState;
  build?: BrunchChromeBuildState;
  contextUsage?: BrunchChromeContextUsage;
  worker?: {
    stage?: BrunchChromeStage;
    status?: BrunchChromeWorkerStatus;
  };
  coherence?: BrunchChromeCoherenceVerdict;
}

export type BrunchChromeUi = Pick<ExtensionUIContext, 'setFooter' | 'setHeader' | 'setTitle'>;

type BrunchChromeTheme = Pick<Theme, 'fg'>;

const CONTEXT_GAUGE_WIDTH = 12;
const BAR_FILLED = '━';
const BAR_EMPTY = '─';

/**
 * Lateral padding in columns, matching Pi's standard `Text` component default
 * (`paddingX = 1`) used for transcript content and the built-in header.
 */
const CHROME_PADDING_X = 1;

export function projectBrunchChromeFooterLines(
  chrome: BrunchChromeState,
  telemetry?: BrunchChromeFooterTelemetry,
  width?: number,
  theme?: BrunchChromeTheme,
): string[] {
  const available =
    width === undefined ? Number.POSITIVE_INFINITY : Math.max(1, width - CHROME_PADDING_X * 2);
  const statuses = sanitizeChromeStatuses(telemetry?.statuses);

  const specSessionPart = keyedStatusPart(
    theme,
    'spec / session',
    'opt-b',
    `${formatSpec(chrome)} / ${chrome.session.label ?? chrome.session.id}`,
  );
  const specSessionLine = chrome.webSidecarUrl
    ? alignChromeColumns(specSessionPart, formatWebUiPart(chrome.webSidecarUrl, theme), available)
    : truncateChromeLine(specSessionPart, available, theme);
  const modelLine = alignChromeColumns(
    style(theme, 'dim', formatModel(chrome, telemetry)),
    renderContextGauge(chrome, telemetry, theme),
    available,
  );

  const lines = [
    specSessionLine,
    truncateChromeLine(renderBrunchStatusLine(chrome, telemetry, theme), available, theme),
    modelLine,
  ];
  if (statuses.length > 0) {
    lines.push(truncateChromeLine(statuses.join(' '), available, theme));
  }
  lines.push('');
  const leftMargin = ' '.repeat(CHROME_PADDING_X);
  return lines.map((line) => (line.length > 0 ? leftMargin + line : line));
}

function sanitizeChromeStatuses(statuses: ReadonlyMap<string, string> | undefined): string[] {
  return [...(statuses ?? new Map())]
    .filter(([key, value]) => key !== 'brunch.chrome' && value.trim().length > 0)
    .map(([, value]) => sanitizeStatusText(value));
}

function sanitizeStatusText(text: string): string {
  return text
    .replace(/[\r\n\t]/g, ' ')
    .replace(/ +/g, ' ')
    .trim();
}

function formatWebUiPart(url: string, theme: BrunchChromeTheme | undefined): string {
  return style(theme, 'dim', `ui: ${sanitizeStatusText(url)}`);
}

function alignChromeColumns(left: string, right: string, width: number): string {
  if (!Number.isFinite(width)) return `${left}  ${right}`;

  const leftWidth = visibleWidth(left);
  const rightWidth = visibleWidth(right);
  const minPadding = 2;
  if (leftWidth + minPadding + rightWidth <= width) {
    return left + ' '.repeat(width - leftWidth - rightWidth) + right;
  }

  const availableForRight = width - leftWidth - minPadding;
  if (availableForRight <= 0) return truncateToWidth(left, width);
  const truncatedRight = truncateToWidth(right, availableForRight, '');
  return (
    left + ' '.repeat(Math.max(minPadding, width - leftWidth - visibleWidth(truncatedRight))) + truncatedRight
  );
}

function truncateChromeLine(text: string, width: number, theme: BrunchChromeTheme | undefined): string {
  return Number.isFinite(width) ? truncateToWidth(text, width, style(theme, 'dim', '...')) : text;
}

export function chromeStateForWorkspace(
  workspace: WorkspaceSessionReadyState,
  options: { webSidecarUrl?: string; startupHeader?: BrunchChromeStartupHeaderState } = {},
): BrunchChromeState {
  return {
    ...workspace.chrome,
    session: {
      id: workspace.session.id,
      label: workspace.session.name ?? workspace.session.id,
    },
    ...(options.webSidecarUrl ? { webSidecarUrl: options.webSidecarUrl } : {}),
    ...(options.startupHeader ? { startupHeader: options.startupHeader } : {}),
  };
}

export function renderBrunchChrome(
  ui: BrunchChromeUi,
  chrome: BrunchChromeState,
  options?: BrunchChromeRenderOptions,
): void {
  ui.setFooter((tui, theme, footerData) => {
    options?.bindFooterRenderRequest?.(() => tui.requestRender());
    return {
      render: (width: number) =>
        projectBrunchChromeFooterLines(
          chrome,
          {
            ...options?.telemetry?.(),
            statuses: footerData.getExtensionStatuses(),
            availableProviderCount: footerData.getAvailableProviderCount(),
          },
          width,
          theme,
        ),
      invalidate: () => {},
      dispose: () => {
        options?.bindFooterRenderRequest?.(null);
      },
    };
  });
  if (chrome.startupHeader) {
    ui.setHeader(
      (_tui, theme) =>
        new BrunchStartupHeader(
          {
            project: formatProject(chrome),
            spec: formatSpec(chrome),
            session: chrome.session.label ?? chrome.session.id,
            ...(chrome.webSidecarUrl ? { sidecarUrl: chrome.webSidecarUrl } : {}),
          },
          theme,
        ),
    );
  }
  ui.setTitle(formatChromeTitle(chrome));
}

export function registerBrunchChrome(
  pi: ExtensionAPI,
  chrome: BrunchChromeState,
  hooks?: { readonly bindChromeRefresh?: (refresh: () => void) => void },
): void {
  let requestFooterRender: (() => void) | null = null;
  hooks?.bindChromeRefresh?.(() => requestFooterRender?.());

  pi.on('session_start', async (_event, ctx) => {
    renderBrunchChrome(ctx.ui, chrome, {
      telemetry: () => footerTelemetryFromContext(ctx, pi),
      bindFooterRenderRequest: (requestRender) => {
        requestFooterRender = requestRender;
      },
    });
  });

  pi.on('model_select', async () => {
    requestFooterRender?.();
  });
  pi.on('thinking_level_select', async () => {
    requestFooterRender?.();
  });
  pi.on('turn_end', async () => {
    requestFooterRender?.();
  });
}

export default function brunchChrome(pi: ExtensionAPI): void {
  registerBrunchChrome(pi, {
    cwd: process.cwd(),
    spec: null,
    session: { id: 'direct-pi' },
    startupHeader: { decision: 'continue' },
  });
}

function footerTelemetryFromContext(ctx: ExtensionContext, pi: ExtensionAPI): BrunchChromeFooterTelemetry {
  const liveContextUsage = ctx.getContextUsage();
  return {
    ...(liveContextUsage ? { liveContextUsage } : {}),
    model: ctx.model
      ? {
          id: ctx.model.id,
          provider: ctx.model.provider,
          reasoning: ctx.model.reasoning,
          contextWindow: ctx.model.contextWindow,
        }
      : null,
    thinkingLevel: pi.getThinkingLevel(),
    agentState: projectBrunchAgentState(ctx.sessionManager.getEntries()),
  };
}

function formatChromeTitle(chrome: BrunchChromeState): string {
  const spec = chrome.spec?.title;
  return spec ? `brunch — ${formatProject(chrome)} · ${spec}` : `brunch — ${formatProject(chrome)}`;
}

function formatProject(chrome: BrunchChromeState): string {
  return chrome.project?.name ?? basename(resolve(chrome.cwd));
}

function formatSpec(chrome: BrunchChromeState): string {
  return chrome.spec?.title ?? 'no spec selected';
}

function renderBrunchStatusLine(
  chrome: BrunchChromeState,
  telemetry: BrunchChromeFooterTelemetry | undefined,
  theme: BrunchChromeTheme | undefined,
): string {
  const runtime = telemetry?.agentState;
  const parts = [
    keyedStatusPart(
      theme,
      'mode',
      'opt-m',
      runtime?.operationalMode ?? chrome.runtime?.mode ?? 'not reported',
    ),
    keyedStatusPart(
      theme,
      'strategy',
      'opt-s',
      runtime?.agentStrategy ?? chrome.runtime?.strategy ?? 'not reported',
    ),
    keyedStatusPart(theme, 'lens', 'opt-l', runtime?.agentLens ?? chrome.runtime?.lens ?? 'not reported'),
  ];
  return parts.join(style(theme, 'dim', ' | '));
}

function keyedStatusPart(
  theme: BrunchChromeTheme | undefined,
  label: string,
  key: string,
  value: string,
): string {
  return `${style(theme, 'accent', label)} ${style(theme, 'dim', `[${key}]:`)} ${style(theme, 'success', value)}`;
}

function formatModel(chrome: BrunchChromeState, telemetry: BrunchChromeFooterTelemetry | undefined): string {
  const model = telemetry?.model;
  const modelName = model?.id ?? chrome.runtime?.model ?? 'no model';
  const thinking = telemetry?.thinkingLevel ?? chrome.runtime?.thinking;
  let label = modelName;
  if (thinking && (model?.reasoning !== false || chrome.runtime?.thinking)) {
    label = thinking === 'off' ? `${modelName} • thinking off` : `${modelName} • ${thinking}`;
  }
  if ((telemetry?.availableProviderCount ?? 0) > 1 && model?.provider) {
    return `(${model.provider}) ${label}`;
  }
  return label;
}

function renderContextGauge(
  chrome: BrunchChromeState,
  telemetry: BrunchChromeFooterTelemetry | undefined,
  theme: BrunchChromeTheme | undefined,
): string {
  const live = telemetry?.liveContextUsage;
  const usage = telemetry?.contextUsage ?? chrome.contextUsage;
  const modelWindow = telemetry?.model?.contextWindow ?? 0;
  const contextWindow = live?.contextWindow ?? usage?.maxTokens ?? modelWindow;
  const tokens = live?.tokens ?? usage?.usedTokens ?? null;
  const percent = live?.percent ?? percentageFromUsage(tokens, contextWindow);

  const clamped = Math.max(0, Math.min(100, percent ?? 0));
  const filled = percent === null ? 0 : Math.round((clamped / 100) * CONTEXT_GAUGE_WIDTH);
  const empty = CONTEXT_GAUGE_WIDTH - filled;
  const color = clamped >= 90 ? 'error' : clamped >= 70 ? 'warning' : 'accent';
  const bar = style(theme, color, BAR_FILLED.repeat(filled)) + style(theme, 'dim', BAR_EMPTY.repeat(empty));
  const percentText = percent === null ? '?%' : `${Math.round(clamped)}%`;
  const counts =
    tokens === null
      ? `?/${formatTokens(contextWindow)}`
      : `${formatTokens(tokens)}/${formatTokens(contextWindow)}`;

  return `${style(theme, 'dim', 'ctx ')}${bar} ${style(theme, 'dim', `${percentText} ${counts}`)}`;
}

function percentageFromUsage(
  tokens: number | null | undefined,
  contextWindow: number | null | undefined,
): number | null {
  if (tokens === null || tokens === undefined || !contextWindow || contextWindow <= 0) return null;
  return (tokens / contextWindow) * 100;
}

function formatTokens(count: number | null | undefined): string {
  const safeCount = Math.max(0, count ?? 0);
  if (safeCount < 1000) return safeCount.toString();
  if (safeCount < 10000) return `${(safeCount / 1000).toFixed(1)}k`;
  if (safeCount < 1000000) return `${Math.round(safeCount / 1000)}k`;
  if (safeCount < 10000000) return `${(safeCount / 1000000).toFixed(1)}M`;
  return `${Math.round(safeCount / 1000000)}M`;
}

function style(theme: BrunchChromeTheme | undefined, color: ThemeColor, text: string): string {
  return theme ? theme.fg(color, text) : text;
}

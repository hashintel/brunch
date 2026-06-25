/**
 * Brunch operational-mode policy.
 *
 * Runtime state is transcript-backed: `.pi` registers concrete Pi tools and
 * applies active/blocked names from the projected Brunch runtime policy rather
 * than owning a second authority list.
 */

import { homedir } from 'node:os';

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import {
  createFindTool,
  createGrepTool,
  createLsTool,
  createReadTool,
} from '@earendil-works/pi-coding-agent';
import { Text } from '@earendil-works/pi-tui';

import { activeToolNamesForPosture } from '../../../../agents/runtime/state.js';
import { groundingFloorGaps } from '../../../../graph/schema/elicitation-gap-fixtures.js';
import type { ElicitationGap } from '../../../../graph/schema/elicitation-gaps.js';
import {
  isToolBlockedForRuntimeState,
  toolPolicyForRuntimeState,
} from '../../../../projections/session/runtime-policy.js';

export { agentBodyResourceLocation } from '../../../../agents/runtime/state.js';

export {
  DEFAULT_BRUNCH_AGENT_STATE,
  projectBrunchAgentState,
  type ResolvedBrunchAgentState,
} from '../../../../projections/session/runtime-state.js';

export {
  BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE,
  appendBrunchAgentRuntimeInit,
  appendBrunchAgentRuntimeSwitch,
  parseBrunchAgentState,
  type BrunchAgentState,
  type BrunchAgentStateEntryData,
  type BrunchAgentStateEntrySessionManager,
} from '../../../../session/runtime-state.js';
import {
  projectBrunchAgentState,
  type ResolvedBrunchAgentState,
} from '../../../../projections/session/runtime-state.js';
import {
  appendBrunchAgentRuntimeInit,
  type BrunchAgentStateEntrySessionManager,
} from '../../../../session/runtime-state.js';

interface CustomEntryLike {
  type?: unknown;
  customType?: unknown;
  data?: unknown;
}

function shortenPath(path: string): string {
  const home = homedir();
  if (path.startsWith(home)) return `~${path.slice(home.length)}`;
  return path;
}

interface SessionManagerLike {
  getEntries(): readonly CustomEntryLike[];
}

function projectBrunchAgentStateFromSessionManager(
  sessionManager: SessionManagerLike | undefined,
): ResolvedBrunchAgentState {
  return projectBrunchAgentState(sessionManager?.getEntries() ?? []);
}

function supportsBrunchAgentStateEntries(
  sessionManager: SessionManagerLike | undefined,
): sessionManager is BrunchAgentStateEntrySessionManager {
  return (
    sessionManager !== undefined &&
    typeof (sessionManager as Partial<BrunchAgentStateEntrySessionManager>).appendCustomEntry === 'function'
  );
}

export function activeToolNamesForBrunchAgentState(
  pi: ExtensionAPI,
  state: ResolvedBrunchAgentState,
  gaps?: readonly ElicitationGap[],
  devAllowedToolNames?: readonly string[],
): string[] {
  return activeToolNamesForPosture({
    registeredToolNames: pi.getAllTools().map((tool) => tool.name),
    state,
    gaps: gaps ?? conservativeUncoveredFloorGaps(),
    devAllowedToolNames,
  });
}

function applyBrunchToolPolicy(
  pi: ExtensionAPI,
  state: ResolvedBrunchAgentState,
  devAllowedToolNames?: readonly string[],
): void {
  pi.setActiveTools(
    activeToolNamesForBrunchAgentState(pi, state, conservativeUncoveredFloorGaps(), devAllowedToolNames),
  );
}

/**
 * Explicit fail-closed posture for composition points where selected-spec gap
 * reads are not available (registration-time policy before context exists, or
 * a composition with no graph). Never a substitute for real gap reads on a
 * live selected-spec path.
 */
export function conservativeUncoveredFloorGaps(): readonly ElicitationGap[] {
  return groundingFloorGaps({
    defaultCoverage: 0,
    specId: 0,
    idSuffix: 'runtime-policy-fallback',
    rationale: 'Conservative fallback before selected-spec gaps are available.',
    createdAtLsn: 0,
  });
}

interface TextLikeContent {
  type: string;
  text?: string;
}

interface TextToolResultLike {
  content?: TextLikeContent[];
}

interface TextContent {
  type: 'text';
  text: string;
}

function firstText(result: TextToolResultLike): TextContent | undefined {
  return result.content?.find(
    (content): content is TextContent => content.type === 'text' && typeof content.text === 'string',
  );
}

function nonEmptyLineCount(text: string): number {
  return text
    .trim()
    .split('\n')
    .filter((line) => line.trim().length > 0).length;
}

function emptyResult() {
  return new Text('', 0, 0);
}

const toolCache = new Map<string, ReturnType<typeof createReadOnlyTools>>();

function createReadOnlyTools(cwd: string) {
  return {
    read: createReadTool(cwd),
    grep: createGrepTool(cwd),
    find: createFindTool(cwd),
    ls: createLsTool(cwd),
  };
}

function getReadOnlyTools(cwd: string) {
  let tools = toolCache.get(cwd);
  if (!tools) {
    tools = createReadOnlyTools(cwd);
    toolCache.set(cwd, tools);
  }
  return tools;
}

function supportsOperationalModePolicy(pi: ExtensionAPI): boolean {
  const candidate = pi as Partial<ExtensionAPI>;
  return (
    typeof candidate.registerTool === 'function' &&
    typeof candidate.getAllTools === 'function' &&
    typeof candidate.setActiveTools === 'function'
  );
}

export function registerBrunchOperationalModePolicy(
  pi: ExtensionAPI,
  options: { devAllowedToolNames?: readonly string[] | undefined } = {},
) {
  if (!supportsOperationalModePolicy(pi)) {
    return;
  }

  pi.registerTool({
    ...getReadOnlyTools(process.cwd()).read,
    label: 'read',
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return getReadOnlyTools(ctx.cwd).read.execute(toolCallId, params, signal, onUpdate);
    },
    renderCall(args, theme) {
      const path = shortenPath(args.path || '');
      const range =
        args.offset !== undefined || args.limit !== undefined
          ? theme.fg(
              'muted',
              `:${args.offset ?? 1}${
                args.limit !== undefined ? `-${(args.offset ?? 1) + args.limit - 1}` : ''
              }`,
            )
          : '';
      return new Text(
        `${theme.fg('toolTitle', theme.bold('read'))} ${theme.fg('accent', path || '…')}${range}`,
        0,
        0,
      );
    },
    renderResult() {
      return emptyResult();
    },
  });

  pi.registerTool({
    ...getReadOnlyTools(process.cwd()).grep,
    label: 'grep',
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return getReadOnlyTools(ctx.cwd).grep.execute(toolCallId, params, signal, onUpdate);
    },
    renderCall(args, theme) {
      const path = shortenPath(args.path || '.');
      const glob = args.glob ? theme.fg('muted', ` ${args.glob}`) : '';
      return new Text(
        `${theme.fg('toolTitle', theme.bold('grep'))} ${theme.fg('accent', `/${args.pattern || '…'}/`)} ${theme.fg('muted', path)}${glob}`,
        0,
        0,
      );
    },
    renderResult(result, { expanded }, theme) {
      const text = firstText(result)?.text ?? '';
      if (expanded && text.trim().length > 0) {
        return new Text(`\n${theme.fg('toolOutput', text.trim())}`, 0, 0);
      }
      const count = nonEmptyLineCount(text);
      return count > 0 ? new Text(theme.fg('muted', `→ ${count} matches`), 0, 0) : emptyResult();
    },
  });

  pi.registerTool({
    ...getReadOnlyTools(process.cwd()).find,
    label: 'find',
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return getReadOnlyTools(ctx.cwd).find.execute(toolCallId, params, signal, onUpdate);
    },
    renderCall(args, theme) {
      const path = shortenPath(args.path || '.');
      return new Text(
        `${theme.fg('toolTitle', theme.bold('find'))} ${theme.fg('accent', args.pattern || '…')} ${theme.fg('muted', path)}`,
        0,
        0,
      );
    },
    renderResult(result, { expanded }, theme) {
      const text = firstText(result)?.text ?? '';
      if (expanded && text.trim().length > 0) {
        return new Text(`\n${theme.fg('toolOutput', text.trim())}`, 0, 0);
      }
      const count = nonEmptyLineCount(text);
      return count > 0 ? new Text(theme.fg('muted', `→ ${count} files`), 0, 0) : emptyResult();
    },
  });

  pi.registerTool({
    ...getReadOnlyTools(process.cwd()).ls,
    label: 'ls',
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return getReadOnlyTools(ctx.cwd).ls.execute(toolCallId, params, signal, onUpdate);
    },
    renderCall(args, theme) {
      const path = shortenPath(args.path || '.');
      return new Text(`${theme.fg('toolTitle', theme.bold('ls'))} ${theme.fg('accent', path)}`, 0, 0);
    },
    renderResult(result, { expanded }, theme) {
      const text = firstText(result)?.text ?? '';
      if (expanded && text.trim().length > 0) {
        return new Text(`\n${theme.fg('toolOutput', text.trim())}`, 0, 0);
      }
      const count = nonEmptyLineCount(text);
      return count > 0 ? new Text(theme.fg('muted', `→ ${count} entries`), 0, 0) : emptyResult();
    },
  });

  pi.on('session_start', async (_event, ctx) => {
    if (supportsBrunchAgentStateEntries(ctx?.sessionManager)) {
      appendBrunchAgentRuntimeInit(ctx.sessionManager as BrunchAgentStateEntrySessionManager);
    }
    const state = projectBrunchAgentStateFromSessionManager(ctx?.sessionManager);
    applyBrunchToolPolicy(pi, state, options.devAllowedToolNames);
  });

  pi.on('before_agent_start', async (_event, ctx) => {
    const state = projectBrunchAgentStateFromSessionManager(ctx?.sessionManager);
    applyBrunchToolPolicy(pi, state, options.devAllowedToolNames);
  });

  pi.on('tool_call', async (event, ctx) => {
    const state = projectBrunchAgentStateFromSessionManager(ctx?.sessionManager);
    if (!isToolBlockedForRuntimeState(state, event.toolName)) return;
    const blockedToolNames = toolPolicyForRuntimeState(state).blockedToolNames.join(', ');

    return {
      block: true,
      reason:
        `Brunch tool policy blocks "${event.toolName}". ` +
        `Blocked tools in ${state.operationalMode} mode: ${blockedToolNames}.`,
    };
  });

  pi.on('user_bash', (event, ctx) => {
    const state = projectBrunchAgentStateFromSessionManager(ctx?.sessionManager);
    const blockedToolNames = toolPolicyForRuntimeState(state).blockedToolNames.join(', ');
    return {
      result: {
        output:
          `Brunch tool policy blocks shell commands in ${state.operationalMode} mode ` +
          `(${blockedToolNames}): ${event.command}`,
        exitCode: 1,
        cancelled: false,
        truncated: false,
      },
    };
  });
}

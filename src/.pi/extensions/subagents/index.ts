/**
 * Brunch subagent registrar (D44-L).
 *
 * Registers a single `subagent` Pi tool that delegates an isolated, read-only
 * reasoning task to a sealed SDK child session (see `session.ts`). Supports a
 * single `{ agent, task }` call or a parallel `{ tasks: [...] }` fan-out, with
 * concurrency bounded by a simple Promise semaphore.
 *
 * Registration is separate from advertisement (D40-L): the tool is registered
 * here, but only becomes an active/advertised tool when the operational-mode
 * policy opt-in includes it. It is never part of the base `elicit` allowlist.
 */

import type { ExtensionAPI, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { Text } from '@earendil-works/pi-tui';
import { Type, type Static } from 'typebox';

import type { SubagentDefinition } from './agents.js';
import {
  runSubagent as defaultRunSubagent,
  type SubagentResult,
  type SubagentSealedDeps,
} from './session.js';

export {
  loadSubagentDefinitions,
  parseSubagentMarkdown,
  subagentAgentsDir,
  type SubagentDefinition,
} from './agents.js';
export {
  DEFAULT_SUBAGENT_CONFIG,
  loadSubagentConfig,
  parseSubagentConfig,
  subagentConfigPath,
  type SubagentConfig,
} from './config.js';
export {
  planSubagentTools,
  resolveSubagentModel,
  runSubagent,
  type SubagentInjectedWorld,
  type SubagentResult,
  type SubagentRunContext,
  type SubagentSealedDeps,
} from './session.js';

export const BRUNCH_SUBAGENT_TOOL = 'subagent';

export interface BrunchSubagentsDeps extends SubagentSealedDeps {
  readonly definitions: Map<string, SubagentDefinition>;
  readonly delegatableAgents: readonly string[];
  readonly maxConcurrency: number;
  /** Injectable runner (defaults to the real sealed-session runner) for testing. */
  readonly runSubagent?: typeof defaultRunSubagent;
}

/** Bounded-concurrency gate built from Promise primitives. */
export function createSemaphore(max: number): <T>(task: () => Promise<T>) => Promise<T> {
  const limit = Math.max(1, Math.floor(max));
  let active = 0;
  const waiters: Array<() => void> = [];

  const release = (): void => {
    const next = waiters.shift();
    if (next) {
      next();
      return;
    }
    active -= 1;
  };

  return async <T>(task: () => Promise<T>): Promise<T> => {
    if (active >= limit) {
      await new Promise<void>((resolve) => waiters.push(resolve));
    } else {
      active += 1;
    }
    try {
      return await task();
    } finally {
      release();
    }
  };
}

function agentCatalog(definitions: Map<string, SubagentDefinition>): string {
  return [...definitions.values()]
    .map((definition) => `${definition.name} — ${definition.description}`)
    .join('; ');
}

function spawnableDefinitions(deps: BrunchSubagentsDeps): Map<string, SubagentDefinition> {
  const definitions = new Map<string, SubagentDefinition>();
  for (const agent of deps.delegatableAgents) {
    const definition = deps.definitions.get(agent);
    if (definition) definitions.set(agent, definition);
  }
  return definitions;
}

function formatResults(results: readonly SubagentResult[]): string {
  const [only] = results;
  if (results.length === 1 && only) return only.text;
  return results
    .map((result) => `## ${result.agent}${result.status === 'error' ? ' (error)' : ''}\n\n${result.text}`)
    .join('\n\n---\n\n');
}

interface ThemeLike {
  fg(kind: string, value: string): string;
  bold(value: string): string;
}

interface TextToolResultLike {
  readonly content: readonly { readonly type: string; readonly text?: string }[];
  readonly details?: unknown;
}

interface SubagentToolTask {
  readonly agent: string;
  readonly task: string;
}

interface SubagentToolParams {
  readonly agent?: string;
  readonly task?: string;
  readonly tasks?: readonly SubagentToolTask[];
}

function firstText(result: TextToolResultLike): string {
  return result.content.find((part) => part.type === 'text')?.text ?? '';
}

function previewText(value: string, maxChars: number): string {
  return value.length > maxChars ? `${value.slice(0, maxChars - 3)}...` : value;
}

function renderContextComponent(context: unknown): Text | undefined {
  return context && typeof context === 'object' && 'lastComponent' in context
    ? (context as { lastComponent?: Text }).lastComponent
    : undefined;
}

function renderContextIsError(context: unknown): boolean {
  return Boolean(
    context &&
    typeof context === 'object' &&
    'isError' in context &&
    (context as { isError?: boolean }).isError,
  );
}

function renderSubagentCall(args: Partial<SubagentToolParams>, theme: ThemeLike, context: unknown): Text {
  const text = renderContextComponent(context) ?? new Text('', 0, 0);
  const hasSingleShape = args.agent !== undefined || args.task !== undefined;
  const hasParallelShape = args.tasks !== undefined;
  const title = theme.fg('toolTitle', theme.bold('subagent '));

  if ((hasSingleShape && hasParallelShape) || (!hasSingleShape && !hasParallelShape)) {
    text.setText(title + theme.fg('error', 'invalid shape: use { agent, task } or { tasks: [...] }'));
    return text;
  }

  if (hasParallelShape) {
    const tasks = args.tasks ?? [];
    const lines = [
      title + theme.fg('accent', `parallel (${tasks.length})`),
      ...tasks.slice(0, 3).map((task) => {
        return `  ${theme.fg('accent', task.agent)} ${theme.fg('dim', previewText(task.task, 80))}`;
      }),
    ];
    if (tasks.length > 3) lines.push(theme.fg('muted', `  ... +${tasks.length - 3} more`));
    text.setText(lines.join('\n'));
    return text;
  }

  text.setText(
    title +
      theme.fg('accent', args.agent ?? '(missing agent)') +
      '\n  ' +
      theme.fg('dim', previewText(args.task ?? '(missing task)', 100)),
  );
  return text;
}

function subagentResultDetails(details: unknown): readonly SubagentResult[] {
  if (
    !details ||
    typeof details !== 'object' ||
    !('results' in details) ||
    !Array.isArray((details as { results?: unknown }).results)
  ) {
    return [];
  }
  return (details as { results: SubagentResult[] }).results;
}

function resultCounts(results: readonly SubagentResult[]): { ok: number; error: number } {
  let ok = 0;
  let error = 0;
  for (const result of results) {
    if (result.status === 'ok') {
      ok += 1;
    } else {
      error += 1;
    }
  }
  return { ok, error };
}

function renderSubagentResult(
  result: TextToolResultLike,
  options: { expanded: boolean; isPartial: boolean },
  theme: ThemeLike,
  context: unknown,
): Text {
  const text = renderContextComponent(context) ?? new Text('', 0, 0);
  if (options.isPartial) {
    text.setText(theme.fg('warning', 'Subagents running...'));
    return text;
  }
  if (renderContextIsError(context)) {
    text.setText(theme.fg('error', firstText(result) || 'Subagent failed'));
    return text;
  }

  const results = subagentResultDetails(result.details);
  if (results.length === 0) {
    text.setText(theme.fg('muted', firstText(result) || 'No subagent output'));
    return text;
  }

  const counts = resultCounts(results);
  const summary =
    results.length === 1
      ? `${results[0]!.agent} ${results[0]!.status}`
      : `${counts.ok} ok, ${counts.error} error`;
  const lines = [
    theme.fg(counts.error > 0 ? 'warning' : 'success', summary),
    ...results.map((entry) => {
      const statusKind = entry.status === 'ok' ? 'success' : 'error';
      return `  ${theme.fg('accent', entry.agent)} ${theme.fg(statusKind, entry.status)}`;
    }),
  ];

  if (options.expanded) {
    for (const entry of results) {
      lines.push(
        '',
        theme.fg('toolTitle', theme.bold(entry.agent)),
        theme.fg('dim', previewText(entry.text, 800)),
      );
    }
  }

  text.setText(lines.join('\n'));
  return text;
}

export function registerBrunchSubagents(pi: ExtensionAPI, deps: BrunchSubagentsDeps): void {
  const run = deps.runSubagent ?? defaultRunSubagent;
  const limit = createSemaphore(deps.maxConcurrency);
  const visibleDefinitions = spawnableDefinitions(deps);
  const agentNames = [...visibleDefinitions.keys()];

  const TaskSchema = Type.Object({
    agent: Type.String({
      enum: agentNames,
      description: `Subagent to run. One of: ${agentNames.join(', ')}.`,
    }),
    task: Type.String({
      description:
        'Self-contained task. The subagent has no memory of this conversation, so include all needed context.',
    }),
  });

  const ParamsSchema = Type.Object({
    agent: Type.Optional(
      Type.String({
        enum: agentNames,
        description: `Subagent to run (single mode). One of: ${agentNames.join(', ')}.`,
      }),
    ),
    task: Type.Optional(Type.String({ description: 'Self-contained task for single mode.' })),
    tasks: Type.Optional(
      Type.Array(TaskSchema, {
        minItems: 1,
        description: 'Parallel mode: run several subagent tasks concurrently.',
      }),
    ),
  });
  type Params = Static<typeof ParamsSchema>;

  const tool: ToolDefinition<typeof ParamsSchema, { results: SubagentResult[] }> = {
    name: BRUNCH_SUBAGENT_TOOL,
    label: 'subagent',
    description:
      `Delegate an isolated, read-only reasoning task to a sealed child agent. ` +
      `Each subagent runs in its own context with no memory of this conversation — put everything it needs in "task". ` +
      `Use a single { agent, task } or fan out with { tasks: [{ agent, task }, ...] }. ` +
      `Available agents: ${agentCatalog(visibleDefinitions)}.`,
    parameters: ParamsSchema,
    async execute(_toolCallId, params: Params, signal, _onUpdate, ctx) {
      const hasSingleShape = params.agent !== undefined || params.task !== undefined;
      const hasParallelShape = params.tasks !== undefined;
      if (hasSingleShape && hasParallelShape) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'subagent accepts either { agent, task } or { tasks: [...] }, not both.',
            },
          ],
          details: { results: [] },
        };
      }

      const requested =
        params.tasks ?? (params.agent && params.task ? [{ agent: params.agent, task: params.task }] : []);
      if (requested.length === 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'subagent requires either { agent, task } or { tasks: [{ agent, task }, ...] }.',
            },
          ],
          details: { results: [] },
        };
      }

      const runContext = { cwd: ctx.cwd, modelRegistry: ctx.modelRegistry, model: ctx.model, signal };
      const results = await Promise.all(
        requested.map((entry) =>
          limit(async (): Promise<SubagentResult> => {
            const definition = visibleDefinitions.get(entry.agent);
            if (!definition) {
              return {
                agent: entry.agent,
                status: 'error',
                text:
                  `Subagent "${entry.agent}" is not available in this operational mode. ` +
                  `Available: ${agentNames.join(', ') || 'none'}.`,
              };
            }
            return run({ definition, task: entry.task, ctx: runContext, deps });
          }),
        ),
      );

      return {
        content: [{ type: 'text' as const, text: formatResults(results) }],
        details: { results },
      };
    },
    renderCall(args, theme, context) {
      return renderSubagentCall(args, theme, context);
    },
    renderResult(result, options, theme, context) {
      return renderSubagentResult(result, options, theme, context);
    },
  };

  pi.registerTool(tool as never);
}

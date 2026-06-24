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

function formatResults(results: readonly SubagentResult[]): string {
  const [only] = results;
  if (results.length === 1 && only) return only.text;
  return results
    .map((result) => `## ${result.agent}${result.status === 'error' ? ' (error)' : ''}\n\n${result.text}`)
    .join('\n\n---\n\n');
}

export function registerBrunchSubagents(pi: ExtensionAPI, deps: BrunchSubagentsDeps): void {
  const run = deps.runSubagent ?? defaultRunSubagent;
  const limit = createSemaphore(deps.maxConcurrency);
  const agentNames = [...deps.definitions.keys()];

  const TaskSchema = Type.Object({
    agent: Type.String({ description: `Subagent to run. One of: ${agentNames.join(', ')}.` }),
    task: Type.String({
      description:
        'Self-contained task. The subagent has no memory of this conversation, so include all needed context.',
    }),
  });

  const ParamsSchema = Type.Object({
    agent: Type.Optional(
      Type.String({ description: `Subagent to run (single mode). One of: ${agentNames.join(', ')}.` }),
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
      `Available agents: ${agentCatalog(deps.definitions)}.`,
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
            const definition = deps.definitions.get(entry.agent);
            if (!definition) {
              return {
                agent: entry.agent,
                status: 'error',
                text: `Unknown subagent "${entry.agent}". Available: ${agentNames.join(', ')}.`,
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
  };

  pi.registerTool(tool as never);
}

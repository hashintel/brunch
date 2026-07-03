/**
 * App composition root for Brunch subagents (D44-L).
 *
 * Loads the bundled agent definitions + config and assembles the sealed runtime
 * dependencies a subagent child session needs, using Brunch's sealed Pi profile
 * (D39-L). Keeping this wiring in the app layer lets `.pi/extensions/subagents`
 * stay free of `src/app` imports — it receives the sealed primitives by
 * injection.
 */

import type { GraphReaders } from '../.pi/extensions/brunch-data/index.js';
import { loadSubagentDefinitions, subagentAgentsDir } from '../.pi/extensions/subagents/agents.js';
import { loadSubagentConfig, subagentConfigPath } from '../.pi/extensions/subagents/config.js';
import type { BrunchSubagentsDeps } from '../.pi/extensions/subagents/index.js';
import type {
  AgentPromptSessionContext,
  AgentPromptSpecContext,
  AgentPromptWorkspaceContext,
} from '../agents/contexts/seeds/turn-context.js';
import { latestElicitationScratchpad } from '../session/elicitation-scratchpad.js';
import { brunchResourceLoaderOptions, createBrunchSettingsManager } from './pi-settings.js';

export interface LoadBrunchSubagentsOptions {
  readonly cwd: string;
  readonly agentDir: string;
  readonly delegatableAgents: readonly string[];
  readonly world?: LoadBrunchSubagentsWorld;
}

export interface LoadBrunchSubagentsWorld {
  readonly graph: {
    readonly specId: number;
    readonly reads: GraphReaders;
  };
  readonly spec: AgentPromptSpecContext;
  readonly workspace: AgentPromptWorkspaceContext;
  readonly session?: AgentPromptSessionContext;
  readonly sessionBranch: readonly unknown[];
}

/**
 * Load the bundled subagent registry and assemble its sealed dependencies.
 * The result is passed to `createBrunchPiExtensions({ subagents })`, which
 * registers the `subagent` tool default-off (it is only advertised when the
 * operational-mode opt-in includes it).
 */
export async function loadBrunchSubagents(options: LoadBrunchSubagentsOptions): Promise<BrunchSubagentsDeps> {
  const [definitions, config] = await Promise.all([
    loadSubagentDefinitions(subagentAgentsDir()),
    loadSubagentConfig(subagentConfigPath()),
  ]);

  return {
    definitions,
    delegatableAgents: options.delegatableAgents,
    maxConcurrency: config.maxConcurrency,
    agentDir: options.agentDir,
    createSettingsManager: () => createBrunchSettingsManager(options.cwd, options.agentDir),
    resourceLoaderOptions: brunchResourceLoaderOptions([]),
    ...(options.world
      ? {
          injectedWorld: {
            snapshot: {
              spec: options.world.spec,
              workspace: options.world.workspace,
              ...(options.world.session ? { session: options.world.session } : {}),
              scratchpad: latestElicitationScratchpad(
                options.world.sessionBranch as Parameters<typeof latestElicitationScratchpad>[0],
              ),
              sessionDigest: renderSubagentSessionDigest(options.world.sessionBranch),
            },
            graph: options.world.graph,
          },
        }
      : {}),
  };
}

export function renderSubagentSessionDigest(entries: readonly unknown[], maxEntries = 6): string {
  if (entries.length === 0) return '- recent entries: none';
  if (maxEntries <= 0)
    return entries.length > 0
      ? `- omitted earlier entries: ${entries.length}\n- recent entries: none`
      : '- recent entries: none';
  const recent = entries.slice(-maxEntries);
  const omitted = entries.length - recent.length;
  return [
    omitted > 0 ? `- omitted earlier entries: ${omitted}` : '',
    '- recent entries:',
    ...recent.map(
      (entry, index) => `  - ${entries.length - recent.length + index + 1}: ${entrySummary(entry)}`,
    ),
  ]
    .filter(Boolean)
    .join('\n');
}

function entrySummary(entry: unknown): string {
  if (!isRecord(entry)) return truncate(String(entry));
  const type = stringField(entry, 'type') ?? 'entry';
  if (type === 'message' && isRecord(entry.message)) {
    const role = stringField(entry.message, 'role') ?? stringField(entry.message, 'type') ?? 'message';
    return `${type}/${role}: ${truncate(JSON.stringify(entry.message))}`;
  }
  const customType = stringField(entry, 'customType');
  if (customType) return `${type}/${customType}: ${truncate(JSON.stringify(entry.data ?? {}))}`;
  return `${type}: ${truncate(JSON.stringify(entry))}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function truncate(value: string, maxLength = 220): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`;
}

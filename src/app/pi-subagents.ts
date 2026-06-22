/**
 * App composition root for Brunch subagents (D44-L).
 *
 * Loads the bundled agent definitions + config and assembles the sealed runtime
 * dependencies a subagent child session needs, using Brunch's sealed Pi profile
 * (D39-L). Keeping this wiring in the app layer lets `.pi/extensions/subagents`
 * stay free of `src/app` imports — it receives the sealed primitives by
 * injection.
 */

import { loadSubagentDefinitions, subagentAgentsDir } from '../.pi/extensions/subagents/agents.js';
import { loadSubagentConfig, subagentConfigPath } from '../.pi/extensions/subagents/config.js';
import type { BrunchSubagentsDeps } from '../.pi/extensions/subagents/index.js';
import { brunchResourceLoaderOptions, createBrunchSettingsManager } from './pi-settings.js';

export interface LoadBrunchSubagentsOptions {
  readonly cwd: string;
  readonly agentDir: string;
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
    maxConcurrency: config.maxConcurrency,
    agentDir: options.agentDir,
    createSettingsManager: () => createBrunchSettingsManager(options.cwd, options.agentDir),
    resourceLoaderOptions: brunchResourceLoaderOptions([]),
  };
}

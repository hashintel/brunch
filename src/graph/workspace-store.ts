import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { createDb } from '../db/connection.js';
import { CommandExecutor } from './command-executor.js';
import { getGraphOverview, getNodeNeighborhood } from './snapshot.js';
import type { GraphOverview, NeighborhoodOptions, NeighborhoodResult } from './snapshot.js';

const BRUNCH_DIR = '.brunch';
const DATA_DB_FILE = 'data.db';

/**
 * Spec-scoped snapshot readers. Returned by `WorkspaceGraphRuntime.forSpec`
 * so callers (Pi extensions, RPC handlers, probes) interact with a single
 * spec's graph without ever needing to thread `specId` through every call.
 */
export interface SpecScopedReaders {
  readonly getGraphOverview: () => GraphOverview;
  readonly getNodeNeighborhood: (nodeId: number, options?: NeighborhoodOptions) => NeighborhoodResult;
}

export interface WorkspaceGraphRuntime {
  readonly commandExecutor: CommandExecutor;
  /** Bind snapshot readers to a single spec (D61-L). */
  readonly forSpec: (specId: number) => SpecScopedReaders;
}

export async function openWorkspaceGraphRuntime(cwd: string): Promise<WorkspaceGraphRuntime> {
  const db = await openWorkspaceDb(cwd);
  return {
    commandExecutor: new CommandExecutor(db),
    forSpec(specId: number): SpecScopedReaders {
      return {
        getGraphOverview: () => getGraphOverview(db, specId),
        getNodeNeighborhood: (nodeId, options) => getNodeNeighborhood(db, specId, nodeId, options),
      };
    },
  };
}

export async function openWorkspaceCommandExecutor(cwd: string): Promise<CommandExecutor> {
  return (await openWorkspaceGraphRuntime(cwd)).commandExecutor;
}

async function openWorkspaceDb(cwd: string) {
  const brunchDir = join(cwd, BRUNCH_DIR);
  await mkdir(brunchDir, { recursive: true });
  return createDb(join(brunchDir, DATA_DB_FILE));
}

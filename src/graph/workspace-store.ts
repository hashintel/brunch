import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { createDb } from '../db/connection.js';
import { CommandExecutor } from './command-executor.js';
import { getGraphOverview, getNodeNeighborhood } from './snapshot.js';
import type { GraphOverview, NeighborhoodOptions, NeighborhoodResult } from './snapshot.js';

const BRUNCH_DIR = '.brunch';
const DATA_DB_FILE = 'data.db';

export interface WorkspaceGraphRuntime {
  readonly commandExecutor: CommandExecutor;
  readonly snapshots: {
    readonly getGraphOverview: () => GraphOverview;
    readonly getNodeNeighborhood: (nodeId: number, options?: NeighborhoodOptions) => NeighborhoodResult;
  };
}

export async function openWorkspaceGraphRuntime(cwd: string): Promise<WorkspaceGraphRuntime> {
  const db = await openWorkspaceDb(cwd);
  return {
    commandExecutor: new CommandExecutor(db),
    snapshots: {
      getGraphOverview: () => getGraphOverview(db),
      getNodeNeighborhood: (nodeId, options) => getNodeNeighborhood(db, nodeId, options),
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

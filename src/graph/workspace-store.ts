import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { createDb } from '../db/connection.js';
import { CommandExecutor } from './command-executor.js';
import {
  getGraphGaps,
  getGraphOverview,
  getGraphSliceByKinds,
  getGraphSliceByReadinessBands,
  getRelatedNodes,
  getNodeNeighborhood,
  resolveGraphNodeCode,
} from './snapshot.js';
import type {
  GraphOverview,
  GraphOverviewOptions,
  GraphGapsOptions,
  GraphSliceByKindsOptions,
  GraphSliceByReadinessBandsOptions,
  NeighborhoodOptions,
  NeighborhoodResult,
  RelatedNodesOptions,
  RelatedNodesResult,
} from './snapshot.js';

const BRUNCH_DIR = '.brunch';
const DATA_DB_FILE = 'data.db';

/**
 * Spec-scoped snapshot readers. Returned by `WorkspaceGraphRuntime.forSpec`
 * so callers (Pi extensions, RPC handlers, probes) interact with a single
 * spec's graph without ever needing to thread `specId` through every call.
 */
export interface SpecScopedReaders {
  readonly getGraphOverview: (options?: GraphOverviewOptions) => GraphOverview;
  readonly getGraphSliceByKinds: (options: GraphSliceByKindsOptions) => GraphOverview;
  readonly getGraphSliceByReadinessBands: (options: GraphSliceByReadinessBandsOptions) => GraphOverview;
  readonly getGraphGaps: (options: GraphGapsOptions) => GraphOverview;
  readonly getRelatedNodes: (options: RelatedNodesOptions) => RelatedNodesResult;
  readonly getNodeNeighborhood: (nodeId: number, options?: NeighborhoodOptions) => NeighborhoodResult;
  readonly resolveNodeCode: (code: string) => number | undefined;
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
        getGraphOverview: (options) => getGraphOverview(db, specId, options),
        getGraphSliceByKinds: (options) => getGraphSliceByKinds(db, specId, options),
        getGraphSliceByReadinessBands: (options) => getGraphSliceByReadinessBands(db, specId, options),
        getGraphGaps: (options) => getGraphGaps(db, specId, options),
        getRelatedNodes: (options) => getRelatedNodes(db, specId, options),
        getNodeNeighborhood: (nodeId, options) => getNodeNeighborhood(db, specId, nodeId, options),
        resolveNodeCode: (code) => resolveGraphNodeCode(db, specId, code),
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

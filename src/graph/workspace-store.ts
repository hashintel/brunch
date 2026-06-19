import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { BRUNCH_DIR } from '../constants.js';
import { createDb } from '../db/connection.js';
import { CommandExecutor } from './command-executor.js';
import {
  getElicitationGaps,
  getNodes,
  getOpenReconciliationNeeds,
  latestGraphLsn,
  queryGraph,
  resolveGraphEdgeId,
  resolveGraphNodeCode,
} from './queries.js';
import type {
  GetNodesOptions,
  GraphReadOptions,
  GraphSlice,
  GraphFilter,
  NodeNeighborhood,
  NodeSelector,
} from './queries.js';

/**
 * Spec-scoped graph reads. Returned by `WorkspaceGraphRuntime.forSpec`
 * so callers interact with one spec's graph without threading `specId` through
 * every read.
 */
export interface SpecScopedReaders {
  readonly queryGraph: (filter?: GraphFilter, options?: GraphReadOptions) => GraphSlice;
  readonly getNodes: (
    selectors: readonly NodeSelector[],
    options?: GetNodesOptions,
  ) => readonly NodeNeighborhood[];
  readonly resolveNodeCode: (code: string) => number | undefined;
  readonly resolveEdgeId: (edgeId: number) => number | undefined;
  readonly getElicitationGaps: () => ReturnType<typeof getElicitationGaps>;
  readonly getOpenReconciliationNeeds: () => ReturnType<typeof getOpenReconciliationNeeds>;
  /** Cheap current-LSN read; detect graph change without a full queryGraph. */
  readonly latestLsn: () => number;
}

export interface WorkspaceGraphRuntime {
  readonly commandExecutor: CommandExecutor;
  /** Bind graph reads to a single spec (D61-L). */
  readonly forSpec: (specId: number) => SpecScopedReaders;
}

export async function openWorkspaceGraphRuntime(cwd: string): Promise<WorkspaceGraphRuntime> {
  const db = await openWorkspaceDb(cwd);
  const commandExecutor = new CommandExecutor(db);
  commandExecutor.repairSeededElicitationGaps();
  return {
    commandExecutor,
    forSpec(specId: number): SpecScopedReaders {
      return {
        queryGraph: (filter, options) => queryGraph(db, specId, filter, options),
        getNodes: (selectors, options) => getNodes(db, specId, selectors, options),
        resolveNodeCode: (code) => resolveGraphNodeCode(db, specId, code),
        resolveEdgeId: (edgeId) => resolveGraphEdgeId(db, specId, edgeId),
        getElicitationGaps: () => getElicitationGaps(db, specId),
        getOpenReconciliationNeeds: () => getOpenReconciliationNeeds(db, specId),
        latestLsn: () => latestGraphLsn(db, specId),
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
  return createDb(join(brunchDir, 'data.db'));
}

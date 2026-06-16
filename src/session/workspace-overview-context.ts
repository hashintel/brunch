import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

import { openWorkspaceGraphRuntime } from '../graph/index.js';
import { renderWorkspaceContext } from '../renderers/workspace/workspace-context.js';
import { inspectWorkspaceCwdInventory, type WorkspaceTopologyEntry } from '../workspace/cwd-inventory.js';
import type { ProjectIdentity } from '../workspace/project-identity.js';
import { inspectCanonicalSessionFiles } from './workspace-session-coordinator/canonical-session-files.js';

interface WorkspaceSpecOverview {
  readonly id: number;
  readonly title: string;
  readonly nodeCount: number;
  readonly sessionCount: number;
}

interface WorkspaceSessionOverview {
  readonly id: string;
  readonly file: string;
  readonly specId: number;
  readonly specTitle: string;
  readonly turnCount: number;
}

export interface WorkspaceOverview {
  readonly status: 'ready';
  readonly cwd: string;
  readonly project: ProjectIdentity;
  readonly specs: readonly WorkspaceSpecOverview[];
  readonly sessions: readonly WorkspaceSessionOverview[];
  readonly topology: WorkspaceTopologyEntry;
}

/**
 * The pre-rendered workspace overview section every origination entry point
 * seeds (D78-L revised 2026-06-12). One composition over inspect + render so
 * no call site can drift to a thinner seed.
 */
export async function renderWorkspaceOverviewContext(cwd: string): Promise<string> {
  return renderWorkspaceContext(await inspectWorkspaceOverview(cwd));
}

export async function inspectWorkspaceOverview(cwd: string): Promise<WorkspaceOverview> {
  const resolvedCwd = resolve(cwd);
  const cwdInventory = await inspectWorkspaceCwdInventory(resolvedCwd);
  const graph = await openWorkspaceGraphRuntime(resolvedCwd);
  const specs = graph.commandExecutor
    .listSpecs()
    .map((spec) => ({
      id: spec.id,
      title: spec.name,
      nodeCount: graph.forSpec(spec.id).queryGraph().nodes.length,
    }))
    .sort((left, right) => left.title.localeCompare(right.title));
  const specsById = new Map(specs.map((spec) => [spec.id, spec]));
  const sessions = await inspectCanonicalSessionFiles(resolvedCwd);
  const availableSessions = await Promise.all(
    sessions
      .filter((session) => session.available)
      .map(async (session) => {
        const spec = specsById.get(session.specId);
        if (!spec) {
          return null;
        }
        const entries = await readJsonl(session.file);
        return {
          id: session.id,
          file: basename(session.file),
          specId: session.specId,
          specTitle: spec.title,
          turnCount: countTurnEntries(entries),
        } satisfies WorkspaceSessionOverview;
      }),
  );
  const sessionsBySpecId = new Map<number, number>();
  const visibleSessions = availableSessions
    .filter((session): session is WorkspaceSessionOverview => session != null)
    .sort((left, right) => left.file.localeCompare(right.file));

  for (const session of visibleSessions) {
    sessionsBySpecId.set(session.specId, (sessionsBySpecId.get(session.specId) ?? 0) + 1);
  }

  return {
    status: 'ready',
    cwd: resolvedCwd,
    project: cwdInventory.project,
    specs: specs.map((spec) => ({
      id: spec.id,
      title: spec.title,
      nodeCount: spec.nodeCount,
      sessionCount: sessionsBySpecId.get(spec.id) ?? 0,
    })),
    sessions: visibleSessions,
    topology: cwdInventory.topology,
  };
}

async function readJsonl(file: string): Promise<unknown[]> {
  const content = await readFile(file, 'utf8');
  return content
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as unknown);
}

function countTurnEntries(entries: readonly unknown[]): number {
  return entries.filter((entry) => {
    const type = (entry as { type?: unknown }).type;
    return type === 'user' || type === 'assistant';
  }).length;
}

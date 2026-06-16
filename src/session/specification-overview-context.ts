import { resolve } from 'node:path';

import { sortElicitationGapsForAsking } from '../graph/elicitation-driver.js';
import { openWorkspaceGraphRuntime } from '../graph/index.js';
import { type SpecificationContextRenderInput } from '../renderers/specification/specification-context.js';
import { inspectWorkspaceOverview } from './workspace-overview-context.js';

export interface SpecificationOverviewContext extends SpecificationContextRenderInput {
  readonly status: 'ready';
}

export async function inspectSpecificationOverview(
  cwd: string,
  specId: number,
): Promise<SpecificationOverviewContext> {
  const resolvedCwd = resolve(cwd);
  const workspace = await inspectWorkspaceOverview(resolvedCwd);
  const spec = workspace.specs.find((entry) => entry.id === specId);
  if (!spec) {
    throw new Error(`Cannot read specification context for unknown spec ${specId}`);
  }

  const graphRuntime = await openWorkspaceGraphRuntime(resolvedCwd);
  const specReaders = graphRuntime.forSpec(specId);
  const graph = specReaders.queryGraph();
  const readinessGaps = specReaders.getElicitationGaps();
  const gaps = sortElicitationGapsForAsking(readinessGaps);

  return {
    status: 'ready',
    spec: { id: spec.id, title: spec.title },
    graph,
    sessions: workspace.sessions.filter((session) => session.specId === specId),
    gaps,
    readinessGaps,
  };
}

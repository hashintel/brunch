import { resolve } from 'node:path';

import { sortElicitationGapsForAsking } from '../graph/elicitation-driver.js';
import { openWorkspaceGraphRuntime, type ElicitationGap, type GraphSlice } from '../graph/index.js';
import {
  renderSpecificationContext,
  type SpecificationContextRenderInput,
} from '../renderers/specification/specification-context.js';
import { inspectWorkspaceOverview, type WorkspaceOverview } from './workspace-overview-context.js';

export interface SpecificationOverviewContext extends SpecificationContextRenderInput {
  readonly status: 'ready';
}

export async function renderSpecificationOverviewContext(cwd: string, specId: number): Promise<string> {
  return renderSpecificationContext(await inspectSpecificationOverview(cwd, specId));
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
  const gaps = sortElicitationGapsForAsking(specReaders.getElicitationGaps());

  return {
    status: 'ready',
    spec: { id: spec.id, title: spec.title },
    graph,
    sessions: workspace.sessions.filter((session) => session.specId === specId),
    gaps,
  };
}

export type SpecificationContextSession = WorkspaceOverview['sessions'][number];
export type SpecificationContextGraph = GraphSlice;
export type SpecificationContextGap = ElicitationGap;

import { resolve } from 'node:path';

import { type SpecificationContextRenderInput } from '../agents/contexts/data-model/spec/spec-context.js';
import { openWorkspaceGraphRuntime } from '../graph/index.js';
import { latestElicitationScratchpad } from './elicitation-scratchpad.js';
import { inspectWorkspaceOverview } from './workspace-overview-context.js';

export interface SpecificationOverviewContext extends SpecificationContextRenderInput {
  readonly status: 'ready';
}

export async function inspectSpecificationOverview(
  cwd: string,
  specId: number,
  sessionEntries: Parameters<typeof latestElicitationScratchpad>[0] = [],
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
  const scratchpad = latestElicitationScratchpad(sessionEntries);

  return {
    status: 'ready',
    spec: { id: spec.id, title: spec.title },
    graph,
    sessions: workspace.sessions.filter((session) => session.specId === specId),
    scratchpad,
  };
}

import { projectExecuteGraph } from '../../../executor/execute-projection.js';
import type { LaunchCurrentProjection } from '../../../executor/launch.js';
import { readPlanFileProvenance, type PlanFileProvenance } from '../../../executor/plan-file.js';
import { readRunMetadata, runMetadataPath } from '../../../executor/run.js';
import { detectWorkspaceCapabilities } from '../../../executor/workspace-detection.js';
import type { GraphReaders } from '../brunch-data/graph/index.js';

type ExecutionMode = PlanFileProvenance['mode'];
type ExecuteGraphInput = Parameters<typeof projectExecuteGraph>[0];

export async function buildCurrentProjectionForSpec(args: {
  readonly cwd: string;
  readonly specId: number;
  readonly reads: Pick<GraphReaders, 'queryGraph' | 'forSpec'>;
  readonly mode?: ExecutionMode | undefined;
}): Promise<{
  readonly current: LaunchCurrentProjection;
  readonly projection: ReturnType<typeof projectExecuteGraph>;
}> {
  const mode = await resolveMode({ cwd: args.cwd, specId: String(args.specId), mode: args.mode });
  const graph = queryGraphForSpec(args.reads, args.specId);
  // Host-workspace facts inform only brownfield planning; greenfield runs build in an
  // isolated substrate where the host manifest is not a capability signal.
  const detectedCapabilities = mode === 'brownfield' ? await detectWorkspaceCapabilities(args.cwd) : [];
  const projection = projectExecuteGraph({
    specId: args.specId,
    mode,
    graphLsn: graph.lsn,
    nodes: graph.nodes as ExecuteGraphInput['nodes'],
    edges: graph.edges as ExecuteGraphInput['edges'],
    detectedCapabilities,
  });
  return {
    projection,
    current: {
      specId: String(args.specId),
      mode,
      source: projection.source,
      checkStatus: projection.check.status,
    },
  };
}

export async function buildCurrentProjectionForRun(args: {
  readonly cwd: string;
  readonly runId: string;
  readonly fallbackSpecId: number;
  readonly reads: Pick<GraphReaders, 'queryGraph' | 'forSpec'>;
  readonly mode?: ExecutionMode | undefined;
}): Promise<{
  readonly current: LaunchCurrentProjection;
  readonly projection: ReturnType<typeof projectExecuteGraph>;
}> {
  const metadata = await readRunMetadata(runMetadataPath(args.cwd, args.runId));
  const parsedSpecId = Number(metadata?.specId ?? args.fallbackSpecId);
  const specId = Number.isFinite(parsedSpecId) && parsedSpecId > 0 ? parsedSpecId : args.fallbackSpecId;
  return buildCurrentProjectionForSpec({
    cwd: args.cwd,
    specId,
    reads: args.reads,
    mode: args.mode,
  });
}

function queryGraphForSpec(reads: Pick<GraphReaders, 'queryGraph' | 'forSpec'>, specId: number) {
  return (reads.forSpec?.(specId) ?? reads).queryGraph(undefined, { visibility: 'active' });
}

async function resolveMode(args: {
  readonly cwd: string;
  readonly specId: string;
  readonly mode?: ExecutionMode | undefined;
}): Promise<ExecutionMode> {
  if (args.mode) return args.mode;
  const provenance = await readPlanFileProvenance({ cwd: args.cwd, specId: args.specId });
  return provenance?.mode ?? 'greenfield';
}

/** Graph tool registrar — wires commit_graph and read_graph as Pi tools. */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

import type { CommandExecutor } from '../../../graph/command-executor.js';
import type {
  EdgeCategory,
  EdgeDirection,
  GraphFilter,
  GraphSlice,
  GraphVisibility,
  NodeKind,
  NodeNeighborhood,
  NodeSelector,
  ReadinessBand,
} from '../../../graph/index.js';
import { formatNeighborhood } from '../../../renderers/graph/neighborhood.js';
import { graphMutationProductUpdates, type ProductUpdatePublisher } from '../../../rpc/product-updates.js';
import {
  translateCommitGraph,
  formatCommitGraphResult,
  formatGraphOverview,
  formatRelatedNodesResult,
  formatStructuralIllegal,
} from './command-adapter.js';
import { CommitGraphParams, ReadGraphParams } from './tool-schemas.js';

export interface GraphReaders {
  readonly queryGraph: (filter?: GraphFilter, options?: { visibility?: GraphVisibility }) => GraphSlice;
  readonly getNodes: (
    selectors: readonly NodeSelector[],
    options?: { hops?: number; visibility?: GraphVisibility },
  ) => readonly NodeNeighborhood[];
  readonly resolveNodeCode: (code: string) => number | undefined;
}

export interface BrunchGraphDeps {
  readonly specId: number;
  readonly commandExecutor: CommandExecutor;
  readonly reads: GraphReaders;
  readonly productUpdates?: ProductUpdatePublisher;
}

export function registerBrunchGraph(pi: ExtensionAPI, deps: BrunchGraphDeps): void {
  const { commandExecutor, reads } = deps;

  pi.registerTool({
    name: 'commit_graph',
    label: 'Commit Graph',
    description:
      'Atomically create a batch of nodes and edges in the specification graph. ' +
      "Each node gets a temporary batch ref (e.g. 'n1') that edges can reference. " +
      'Edges can also reference existing nodes by projected code via {existingCode: "G1"}. ' +
      'The entire batch succeeds or fails atomically.',
    promptSnippet: 'Atomically commit nodes and edges to the specification graph',
    promptGuidelines: [
      'Use commit_graph to persist specification elements (goals, requirements, decisions, etc.) after the user has accepted the concept.',
      'Each node must have a unique batch `ref` string. Edges reference nodes by their `ref` or by `{existingCode: "G1"}` for nodes already in the selected spec.',
      'If commit_graph returns STRUCTURAL_ILLEGAL, read the diagnostics, fix the issues, and retry. Do not show intermediate failures to the user.',
      'The `stance` field is required on `proof` and `support` edges, and invalid on all other categories.',
      'Node kinds `decision` and `term` require a `detail` object; all other kinds must omit `detail`.',
    ],
    parameters: CommitGraphParams,

    async execute(_toolCallId, params) {
      const specId = deps.specId;
      const input = translateCommitGraph(params, specId, reads.resolveNodeCode);
      const result = 'status' in input ? input : commandExecutor.commitGraph(input);
      const text = formatCommitGraphResult(result);
      if (result.status === 'success') {
        deps.productUpdates?.publish(graphMutationProductUpdates({ specId, lsn: result.lsn }));
      }

      return { content: [{ type: 'text' as const, text }], details: result };
    },
  });

  pi.registerTool({
    name: 'read_graph',
    label: 'Read Graph',
    description:
      'Read the current specification graph. ' +
      "Use mode 'overview' for a full graph summary, or " +
      "mode 'neighborhood' with nodeCode to see a specific node and its neighbors.",
    promptSnippet: 'Read the specification graph (overview or node neighborhood)',
    promptGuidelines: [
      "Use read_graph with mode 'overview' to see all nodes and edges before committing new graph elements.",
      "Use read_graph with mode 'neighborhood' and a projected nodeCode such as G1 or CON2 to inspect a specific node and its connections.",
      "Use read_graph with mode 'list_by_kind' and one or more kinds to inspect a bounded graph slice.",
      "Use read_graph with mode 'list_by_band' and readiness bands (grounding, elicitation, commitment) to inspect spec evidence by band.",
      "Use read_graph with mode 'gaps' to find nodes in a bounded base class that lack one edge category in the chosen direction.",
      "Set show to 'all' when you need superseded nodes; otherwise the default 'active' hides superseded nodes and dangling edges.",
    ],
    parameters: ReadGraphParams,

    async execute(_toolCallId, params) {
      const options = params.show === undefined ? undefined : { visibility: params.show };
      let text: string;
      let details:
        | GraphSlice
        | readonly NodeNeighborhood[]
        | {
            readonly status: 'structural_illegal';
            readonly diagnostics: readonly { readonly field: string; readonly message: string }[];
          };

      if (params.mode === 'overview') {
        const slice = reads.queryGraph(undefined, options);
        text = formatGraphOverview(slice);
        details = slice;
      } else if (params.mode === 'list_by_kind') {
        const slice = reads.queryGraph({ kinds: params.kinds as readonly NodeKind[] }, options);
        text = formatGraphOverview(slice, 'Graph slice by kind');
        details = slice;
      } else if (params.mode === 'list_by_band') {
        const slice = reads.queryGraph({ bands: params.readinessBands as readonly ReadinessBand[] }, options);
        text = formatGraphOverview(slice, 'Graph slice by readiness band');
        details = slice;
      } else if (params.mode === 'gaps') {
        const hasBaseFilter = (params.kinds?.length ?? 0) > 0 || (params.readinessBands?.length ?? 0) > 0;
        if (!hasBaseFilter) {
          details = {
            status: 'structural_illegal',
            diagnostics: [
              {
                field: 'kinds|readinessBands',
                message: 'gaps mode requires kinds and/or readinessBands as a base filter',
              },
            ],
          };
          text = formatStructuralIllegal(details);
        } else if (params.absentEdgeCategory == null) {
          details = {
            status: 'structural_illegal',
            diagnostics: [
              { field: 'absentEdgeCategory', message: 'absentEdgeCategory is required for gaps mode' },
            ],
          };
          text = formatStructuralIllegal(details);
        } else {
          const filter: GraphFilter = {
            ...(params.kinds != null ? { kinds: params.kinds as readonly NodeKind[] } : {}),
            ...(params.readinessBands != null
              ? { bands: params.readinessBands as readonly ReadinessBand[] }
              : {}),
            lacksEdge: {
              categories: [params.absentEdgeCategory],
              ...(params.direction !== undefined ? { direction: params.direction } : {}),
            },
          };
          const slice = reads.queryGraph(filter, options);
          text = formatGraphOverview(slice, 'Graph gaps');
          details = slice;
        }
      } else if (params.mode === 'related') {
        if ((params.anchorCodes?.length ?? 0) === 0) {
          details = {
            status: 'structural_illegal',
            diagnostics: [{ field: 'anchorCodes', message: 'related mode requires anchorCodes' }],
          };
          text = formatStructuralIllegal(details);
        } else if (params.edgeCategory == null) {
          details = {
            status: 'structural_illegal',
            diagnostics: [{ field: 'edgeCategory', message: 'edgeCategory is required for related mode' }],
          };
          text = formatStructuralIllegal(details);
        } else {
          const anchorCodes = params.anchorCodes ?? [];
          const readsForAnchors = reads.getNodes(
            anchorCodes.map((code) => ({ code })),
            { ...options, hops: params.hops ?? 1 },
          );
          text = formatRelatedNodesResult({
            status: 'success',
            anchors: filterNodeNeighborhoodEdges(readsForAnchors, params.edgeCategory, params.direction),
          });
          details = readsForAnchors;
        }
      } else if (params.nodeCode == null) {
        details = {
          status: 'structural_illegal',
          diagnostics: [{ field: 'nodeCode', message: 'nodeCode is required for neighborhood mode' }],
        };
        text = formatStructuralIllegal(details);
      } else {
        const nodeRead = reads.getNodes([{ code: params.nodeCode }], {
          ...options,
          hops: params.hops ?? 1,
        });
        text = formatNeighborhood(
          nodeRead[0] ?? { selector: { code: params.nodeCode }, status: 'not_found', related: [], edges: [] },
        );
        details = nodeRead;
      }

      return { content: [{ type: 'text' as const, text }], details };
    },
  });
}

function filterNodeNeighborhoodEdges(
  neighborhoods: readonly NodeNeighborhood[],
  category: EdgeCategory,
  direction: EdgeDirection | undefined,
): readonly NodeNeighborhood[] {
  return neighborhoods.map((neighborhood) => {
    if (neighborhood.status === 'not_found') return neighborhood;
    const edges = neighborhood.edges.filter((edge) => {
      if (edge.category !== category) return false;
      if (direction === 'outgoing') return edge.sourceId === neighborhood.node.id;
      if (direction === 'incoming') return edge.targetId === neighborhood.node.id;
      return true;
    });
    const relatedIds = new Set(edges.flatMap((edge) => [edge.sourceId, edge.targetId]));
    relatedIds.delete(neighborhood.node.id);
    return {
      ...neighborhood,
      related: neighborhood.related.filter((node) => relatedIds.has(node.id)),
      edges,
    };
  });
}

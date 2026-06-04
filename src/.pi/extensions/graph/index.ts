/**
 * Graph tool registrar — wires commit_graph and read_graph as Pi tools.
 *
 * SPEC: D4-L (one mutation surface), D20-L (CommandExecutor boundary),
 *       D52-L (graph/ imports db/; .pi/extensions/ imports graph/),
 *       D53-L (commitGraph atomic batch), I26-L (no db/ imports here)
 *
 * This module does NOT import from db/. All graph access routes through
 * the CommandExecutor and snapshot reader functions passed as explicit
 * dependencies from the extension shell.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

import { formatNeighborhood } from '../../../graph/format/neighborhood.js';
import { projectNeighborhood } from '../../../graph/project/neighborhood.js';
import type { CommandExecutor } from '../../../graph/command-executor.js';
import type { GraphOverview, NeighborhoodResult } from '../../../graph/snapshot.js';
import { graphMutationProductUpdates, type ProductUpdatePublisher } from '../../../rpc/product-updates.js';
import { translateCommitGraph, formatCommitGraphResult, formatGraphOverview } from './command-adapter.js';
import { CommitGraphParams, ReadGraphParams } from './tool-schemas.js';

// ---------------------------------------------------------------------------
// Dependencies injected by the extension shell
// ---------------------------------------------------------------------------

/** Pre-bound snapshot readers so the extension never touches db/ directly. */
export interface GraphSnapshotReaders {
  readonly getGraphOverview: () => GraphOverview;
  readonly getNodeNeighborhood: (nodeId: number, options?: { hops?: number }) => NeighborhoodResult;
  readonly resolveNodeCode: (code: string) => number | undefined;
}

/**
 * Selected-spec-bound dependencies for the Brunch graph extension.
 *
 * The shell pre-binds these to the workspace's active spec (D61-L) so the
 * agent-facing `commit_graph` / `read_graph` tools never receive `specId`
 * from the LLM and cannot reach into another spec's graph truth.
 */
export interface BrunchGraphDeps {
  readonly specId: number;
  readonly commandExecutor: CommandExecutor;
  readonly snapshots: GraphSnapshotReaders;
  readonly productUpdates?: ProductUpdatePublisher;
}

// ---------------------------------------------------------------------------
// Registrar
// ---------------------------------------------------------------------------

export function registerBrunchGraph(pi: ExtensionAPI, deps: BrunchGraphDeps): void {
  const { commandExecutor, snapshots } = deps;

  // ── commit_graph ────────────────────────────────────────────────────
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
      const input = translateCommitGraph(params, specId, snapshots.resolveNodeCode);
      const result = commandExecutor.commitGraph(input);
      const text = formatCommitGraphResult(result);
      if (result.status === 'success') {
        deps.productUpdates?.publish(graphMutationProductUpdates({ specId, lsn: result.lsn }));
      }

      return {
        content: [{ type: 'text' as const, text }],
        details: result,
      };
    },
  });

  // ── read_graph ──────────────────────────────────────────────────────
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
    ],
    parameters: ReadGraphParams,

    async execute(_toolCallId, params) {
      let text: string;
      let details: GraphOverview | NeighborhoodResult;

      if (params.mode === 'overview') {
        const overview = snapshots.getGraphOverview();
        text = formatGraphOverview(overview);
        details = overview;
      } else {
        if (params.nodeCode == null) {
          throw new Error('nodeCode is required for neighborhood mode');
        }
        const nodeId = snapshots.resolveNodeCode(params.nodeCode);
        if (nodeId === undefined) {
          throw new Error(`nodeCode ${params.nodeCode} does not resolve in the selected spec`);
        }
        const neighborhood = snapshots.getNodeNeighborhood(
          nodeId,
          params.hops != null ? { hops: params.hops } : undefined,
        );
        text = formatNeighborhood(projectNeighborhood(neighborhood));
        details = neighborhood;
      }

      return {
        content: [{ type: 'text' as const, text }],
        details,
      };
    },
  });
}

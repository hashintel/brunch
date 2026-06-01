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

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"
import { StringEnum } from "@earendil-works/pi-ai"
import { Type } from "typebox"

import type { CommandExecutor } from "../../../graph/command-executor.js"
import type {
  GraphOverview,
  NeighborhoodResult,
} from "../../../graph/snapshot.js"
import {
  INTENT_KINDS,
  ORACLE_KINDS,
  DESIGN_KINDS,
  PLAN_KINDS,
  EDGE_CATEGORIES,
  EDGE_STANCES,
  NODE_BASES,
} from "../../../graph/index.js"
import {
  translateCommitGraph,
  formatCommitGraphResult,
  formatGraphOverview,
  formatNeighborhoodResult,
} from "./command-adapter.js"

// ---------------------------------------------------------------------------
// Dependencies injected by the extension shell
// ---------------------------------------------------------------------------

/** Pre-bound snapshot readers so the extension never touches db/ directly. */
export interface GraphSnapshotReaders {
  readonly getGraphOverview: () => GraphOverview
  readonly getNodeNeighborhood: (
    nodeId: number,
    options?: { hops?: number },
  ) => NeighborhoodResult
}

export interface BrunchGraphDeps {
  readonly commandExecutor: CommandExecutor
  readonly snapshots: GraphSnapshotReaders
}

// ---------------------------------------------------------------------------
// Tool parameter schemas (TypeBox v1.x / Pi's typebox)
// ---------------------------------------------------------------------------

const ALL_KINDS = [
  ...INTENT_KINDS,
  ...ORACLE_KINDS,
  ...DESIGN_KINDS,
  ...PLAN_KINDS,
] as const

const CommitNodeSchema = Type.Object({
  ref: Type.String({
    description: "Temporary batch reference id (e.g. 'n1', 'n2')",
  }),
  plane: StringEnum(["intent", "oracle", "design", "plan"] as const),
  kind: StringEnum([...ALL_KINDS]),
  title: Type.String({ description: "Node title — must be non-empty" }),
  body: Type.Optional(Type.String({ description: "Extended description" })),
  basis: Type.Optional(StringEnum([...NODE_BASES])),
  source: Type.Optional(
    Type.String({
      description: "Epistemic attribution (e.g. 'stakeholder', 'derived')",
    }),
  ),
  detail: Type.Optional(
    Type.Unknown({
      description:
        "Per-kind detail: decision requires {chosen_option, rejected, rationale}; term requires {definition, aliases?}",
    }),
  ),
})

const EdgeRefSchema = Type.Union([
  Type.String({ description: "Intra-batch ref (e.g. 'n1')" }),
  Type.Object({
    existing: Type.Number({ description: "Id of an existing node" }),
  }),
])

const CommitEdgeSchema = Type.Object({
  category: StringEnum([...EDGE_CATEGORIES]),
  source: EdgeRefSchema,
  target: EdgeRefSchema,
  stance: Type.Optional(StringEnum([...EDGE_STANCES])),
  rationale: Type.Optional(Type.String()),
})

const CommitGraphParams = Type.Object({
  nodes: Type.Array(CommitNodeSchema, {
    description: "Nodes to create in this batch",
  }),
  edges: Type.Array(CommitEdgeSchema, {
    description: "Edges to create, referencing batch refs or existing node ids",
  }),
})

const ReadGraphParams = Type.Object({
  mode: StringEnum(["overview", "neighborhood"] as const),
  node_id: Type.Optional(
    Type.Number({
      description: "Required for neighborhood mode — the anchor node id",
    }),
  ),
  hops: Type.Optional(
    Type.Number({ description: "Neighborhood traversal depth (default: 1)" }),
  ),
})

// ---------------------------------------------------------------------------
// Registrar
// ---------------------------------------------------------------------------

export function registerBrunchGraph(
  pi: ExtensionAPI,
  deps: BrunchGraphDeps,
): void {
  const { commandExecutor, snapshots } = deps

  // ── commit_graph ────────────────────────────────────────────────────
  pi.registerTool({
    name: "commit_graph",
    label: "Commit Graph",
    description:
      "Atomically create a batch of nodes and edges in the specification graph. " +
      "Each node gets a temporary batch ref (e.g. 'n1') that edges can reference. " +
      "Edges can also reference existing nodes by id via {existing: <id>}. " +
      "The entire batch succeeds or fails atomically.",
    promptSnippet:
      "Atomically commit nodes and edges to the specification graph",
    promptGuidelines: [
      "Use commit_graph to persist specification elements (goals, requirements, decisions, etc.) after the user has accepted the concept.",
      "Each node must have a unique batch `ref` string. Edges reference nodes by their `ref` or by `{existing: <id>}` for nodes already in the graph.",
      "If commit_graph returns STRUCTURAL_ILLEGAL, read the diagnostics, fix the issues, and retry. Do not show intermediate failures to the user.",
      "The `stance` field is required on `proof` and `support` edges, and invalid on all other categories.",
      "Node kinds `decision` and `term` require a `detail` object; all other kinds must omit `detail`.",
    ],
    parameters: CommitGraphParams,

    async execute(_toolCallId, params) {
      const input = translateCommitGraph(params)
      const result = commandExecutor.commitGraph(input)
      const text = formatCommitGraphResult(result)

      return {
        content: [{ type: "text" as const, text }],
        details: result,
      }
    },
  })

  // ── read_graph ──────────────────────────────────────────────────────
  pi.registerTool({
    name: "read_graph",
    label: "Read Graph",
    description:
      "Read the current specification graph. " +
      "Use mode 'overview' for a full graph summary, or " +
      "mode 'neighborhood' with a node_id to see a specific node and its neighbors.",
    promptSnippet:
      "Read the specification graph (overview or node neighborhood)",
    promptGuidelines: [
      "Use read_graph with mode 'overview' to see all nodes and edges before committing new graph elements.",
      "Use read_graph with mode 'neighborhood' and a node_id to inspect a specific node and its connections.",
    ],
    parameters: ReadGraphParams,

    async execute(_toolCallId, params) {
      let text: string

      if (params.mode === "overview") {
        text = formatGraphOverview(snapshots.getGraphOverview())
      } else {
        if (params.node_id == null) {
          throw new Error("node_id is required for neighborhood mode")
        }
        text = formatNeighborhoodResult(
          snapshots.getNodeNeighborhood(
            params.node_id,
            params.hops != null ? { hops: params.hops } : undefined,
          ),
        )
      }

      return {
        content: [{ type: "text" as const, text }],
        details: {},
      }
    },
  })
}

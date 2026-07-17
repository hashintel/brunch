/**
 * Reusable bounded seed renderers for explicit origination/background context
 * assembly. `origination.ts` owns the one-shot foreground continuity payload;
 * background adapters may assemble an app-root snapshot from these renderers.
 * Later foreground graph and scratchpad detail is read on demand, so this
 * module does not compose an eager per-turn foreground bundle.
 *
 * Input:  already-read selected spec/workspace/session or graph facts
 * Output: one rendered seed string (lossy, bounded)
 */

import type { GraphSlice } from '../../../graph/queries.js';
import type { GraphNode } from '../../../graph/schema/nodes.js';
import type { ElicitationScratchpadItem } from '../../../session/elicitation-scratchpad.js';
import type { WorkspacePostureState } from '../../../session/workspace-session-coordinator.js';
import { formatGraphOverview } from '../data-model/graph/graph-slice.js';

type GraphSeedLens = 'auto' | 'intent' | 'design' | 'oracle';

export interface AgentPromptSpecContext {
  id: number;
  name: string;
}

export interface AgentPromptWorkspaceContext {
  cwd: string;
  posture?: Partial<WorkspacePostureState>;
}

export interface AgentPromptSessionContext {
  readonly id?: string;
  readonly label?: string;
}

// ----- selected-workspace seed -----

export interface RenderCwdContextInput {
  readonly spec: AgentPromptSpecContext;
  readonly workspace: AgentPromptWorkspaceContext;
  readonly session?: AgentPromptSessionContext;
  readonly scratchpad: readonly ElicitationScratchpadItem[];
}

export function renderWorkspaceSeed(input: RenderCwdContextInput): string {
  return [
    '[Selected workspace context]',
    `- cwd: ${input.workspace.cwd}`,
    `- selected spec: ${input.spec.name} (#${input.spec.id})`,
    `- selected session: ${renderSession(input.session)}`,
    `- workspace posture: ${renderPosture(input.workspace.posture)}`,
    '- ambient Pi resources: not scanned; Brunch prompt resources come only from code-owned manifests',
    '- graph scope: selected spec only; no workspace-global graph fallback',
    `- elicitation scratchpad: ${input.scratchpad.length} item(s), ${countOpen(input.scratchpad)} open`,
  ].join('\n');
}

function countOpen(items: readonly ElicitationScratchpadItem[]): number {
  return items.filter((item) => item.disposition === 'open').length;
}

function renderSession(session: AgentPromptSessionContext | undefined): string {
  if (!session?.id && !session?.label) return 'unrecorded';
  if (session.id && session.label) return `${session.label} (${session.id})`;
  return session.id ?? session.label ?? 'unrecorded';
}

function renderPosture(posture: AgentPromptWorkspaceContext['posture']): string {
  if (!posture) return 'unrecorded';
  const entries = Object.entries(posture).filter((entry): entry is [string, string] =>
    Boolean(entry[1]?.trim()),
  );
  return entries.length > 0 ? entries.map(([key, value]) => `${key}=${value}`).join('; ') : 'unrecorded';
}

// ----- selected-spec graph seed -----

export interface RenderGraphContextOptions {
  readonly lens: GraphSeedLens;
  readonly maxNodes?: number;
  readonly maxEdges?: number;
}

const DEFAULT_MAX_NODES = 8;
const DEFAULT_MAX_EDGES = 8;

export function renderGraphSeed(overview: GraphSlice, options: RenderGraphContextOptions): string {
  const maxNodes = options.maxNodes ?? DEFAULT_MAX_NODES;
  const maxEdges = options.maxEdges ?? DEFAULT_MAX_EDGES;
  const emphasizedNodes = [...overview.nodes].sort((a, b) => {
    const byLens = lensScore(b, options.lens) - lensScore(a, options.lens);
    return byLens || a.id - b.id;
  });
  const selectedNodes = emphasizedNodes.slice(0, maxNodes);
  const selectedEdges = overview.edges.slice(0, maxEdges);
  const omittedNodes = Math.max(overview.nodes.length - selectedNodes.length, 0);
  const omittedEdges = Math.max(overview.edges.length - selectedEdges.length, 0);

  const lines = [
    `Emphasis: ${lensEmphasis(options.lens)}`,
    formatGraphOverview(
      { lsn: overview.lsn, nodes: selectedNodes, edges: selectedEdges },
      `Selected-spec graph overview · ${options.lens} lens`,
    ),
  ];

  if (omittedNodes > 0 || omittedEdges > 0) {
    lines.push(`Omitted: ${omittedNodes} node(s), ${omittedEdges} edge(s).`);
  }

  return lines.join('\n\n');
}

function lensScore(node: GraphNode, lens: GraphSeedLens): number {
  if (node.plane === lens) return 4;
  if (lens === 'intent' && node.plane === 'plan') return 1;
  if (lens === 'design' && (node.plane === 'intent' || node.plane === 'plan')) return 1;
  if (lens === 'oracle' && node.kind === 'invariant') return 2;
  return 0;
}

function lensEmphasis(lens: GraphSeedLens): string {
  switch (lens) {
    case 'intent':
      return 'intent claims, terms, assumptions, constraints, and decisions first';
    case 'design':
      return 'design modules/interfaces and boundary implications first';
    case 'oracle':
      return 'verification checks, evidence, obligations, and proof gaps first';
    case 'auto':
      return 'AUTO lens selection pending; keep intent, design, and oracle cues visible';
  }
}

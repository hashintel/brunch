/**
 * Agent context-seed composition — an agent-context concern, not a
 * system-prompt or Pi-adapter concern.
 *
 * Owns the per-turn pushed context blocks the agent receives each turn: the
 * selected-workspace seed and the selected-spec graph seed. This is session/
 * world state rendered for the agent, distinct from system-prompt assembly
 * (`agents/runtime/compose.ts`), which only splices these blocks
 * into the prompt frame. Keeping composition here means cycling operational
 * modes — which swaps the agent role and therefore the system prompt — does not
 * re-own context derivation: the prompt layer consumes a bundle it does not
 * compose. Mirrors `origination.ts` (continuity seed entry); this is
 * its ephemeral per-turn sibling.
 *
 * Input:  selected spec/workspace/session + gaps + already-read graph slice + lens
 * Output: rendered context block strings (lossy, bounded)
 * Used by: `.pi/extensions/agent-runtime/system-prompts` (before_agent_start) via composeAgentContextSeed
 */

import { renderSoftReadinessEstimate } from '../../../agents/contexts/session/readiness-estimate.js';
import type { GraphSlice } from '../../../graph/queries.js';
import type { ElicitationGap } from '../../../graph/schema/elicitation-gaps.js';
import { formatGraphNodeCode, type GraphNode } from '../../../graph/schema/nodes.js';
import type { AgentLensSelection } from '../../../session/schema/kinds.js';
import type { WorkspacePostureState } from '../../../session/workspace-session-coordinator.js';

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

export interface ComposeAgentContextSeedInput {
  readonly spec: AgentPromptSpecContext;
  readonly workspace: AgentPromptWorkspaceContext;
  readonly session?: AgentPromptSessionContext;
  readonly gaps: readonly ElicitationGap[];
  readonly graph: GraphSlice;
  readonly lens: AgentLensSelection;
}

/**
 * Compose the per-turn pushed context blocks from already-read world state.
 * The caller (the Pi extension) performs the PULL (graph query, gap read) and
 * passes the data in; this module owns only the RENDER/COMPOSE of the blocks,
 * so the same bundle is reusable across mode/prompt switches that do not change
 * world state.
 */
export function composeAgentContextSeed(input: ComposeAgentContextSeedInput): readonly string[] {
  return [
    renderWorkspaceSeed({
      spec: input.spec,
      workspace: input.workspace,
      ...(input.session ? { session: input.session } : {}),
      gaps: input.gaps,
    }),
    renderGraphSeed(input.graph, { lens: input.lens }),
  ];
}

// ----- selected-workspace seed -----

export interface RenderCwdContextInput {
  readonly spec: AgentPromptSpecContext;
  readonly workspace: AgentPromptWorkspaceContext;
  readonly session?: AgentPromptSessionContext;
  readonly gaps: readonly ElicitationGap[];
}

export function renderWorkspaceSeed(input: RenderCwdContextInput): string {
  return [
    '[Selected workspace context]',
    `- cwd: ${input.workspace.cwd}`,
    `- selected spec: ${input.spec.name} (#${input.spec.id}); ${renderSoftReadinessEstimate(input.gaps)}`,
    `- selected session: ${renderSession(input.session)}`,
    `- workspace posture: ${renderPosture(input.workspace.posture)}`,
    '- ambient Pi resources: not scanned; Brunch prompt resources come only from code-owned manifests',
    '- graph scope: selected spec only; no workspace-global graph fallback',
  ].join('\n');
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
  readonly lens: AgentLensSelection;
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
  const nodesById = new Map(overview.nodes.map((node) => [node.id, node]));

  const lines = [
    `[Selected-spec graph context · ${options.lens} lens]`,
    `- selected-spec lsn: ${overview.lsn}; nodes: ${overview.nodes.length}; edges: ${overview.edges.length}`,
    `- emphasis: ${lensEmphasis(options.lens)}`,
  ];

  if (overview.nodes.length === 0) {
    lines.push('- graph: empty');
    return lines.join('\n');
  }

  lines.push('- emphasized nodes:');
  for (const node of emphasizedNodes.slice(0, maxNodes)) {
    lines.push(`  - ${formatNode(node)}`);
  }
  if (overview.nodes.length > maxNodes) {
    lines.push(`  - …${overview.nodes.length - maxNodes} more node(s) omitted`);
  }

  if (overview.edges.length > 0) {
    lines.push('- edges:');
    for (const edge of overview.edges.slice(0, maxEdges)) {
      const stance = edge.stance ? `/${edge.stance}` : '';
      const source = nodesById.get(edge.sourceId);
      const target = nodesById.get(edge.targetId);
      const sourceCode = source ? formatGraphNodeCode(source.kind, source.kindOrdinal) : `#${edge.sourceId}`;
      const targetCode = target ? formatGraphNodeCode(target.kind, target.kindOrdinal) : `#${edge.targetId}`;
      lines.push(`  - ${sourceCode} -[${edge.category}${stance}]-> ${targetCode}`);
    }
    if (overview.edges.length > maxEdges) {
      lines.push(`  - …${overview.edges.length - maxEdges} more edge(s) omitted`);
    }
  }

  return lines.join('\n');
}

function lensScore(node: GraphNode, lens: AgentLensSelection): number {
  if (node.plane === lens) return 4;
  if (lens === 'intent' && node.plane === 'plan') return 1;
  if (lens === 'design' && (node.plane === 'intent' || node.plane === 'plan')) return 1;
  if (lens === 'oracle' && node.kind === 'invariant') return 2;
  return 0;
}

function lensEmphasis(lens: AgentLensSelection): string {
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

function formatNode(node: GraphNode): string {
  const body = node.body ? ` — ${truncate(node.body, 120)}` : '';
  return `[${formatGraphNodeCode(node.kind, node.kindOrdinal)}] ${node.plane}/${node.kind}: ${node.title}${body}`;
}

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`;
}

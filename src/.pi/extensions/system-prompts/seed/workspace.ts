import type { ElicitationGap } from '../../../../graph/schema/elicitation-gaps.js';
import {
  renderSoftReadinessEstimate,
  type AgentPromptSpecContext,
  type AgentPromptWorkspaceContext,
} from '../compose.js';

export interface AgentPromptSessionContext {
  readonly id?: string;
  readonly label?: string;
}

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

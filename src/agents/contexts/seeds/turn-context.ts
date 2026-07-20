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

import type { ElicitationScratchpadItem } from '../../../session/elicitation-scratchpad.js';
import type { WorkspacePostureState } from '../../../session/workspace-session-coordinator.js';
import { renderWorkspacePosture } from '../../shared/posture-context.js';

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
    `- workspace posture: ${renderWorkspacePosture(input.workspace.posture)}`,
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

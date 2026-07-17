import type {
  AgentPromptSpecContext,
  AgentPromptWorkspaceContext,
} from '../../contexts/seeds/turn-context.js';

export interface LiveElicitorPushedContext {
  readonly contextHandles?: readonly string[];
  readonly renderedContexts?: readonly string[];
}

export interface RenderLiveElicitorContextInput {
  readonly spec: AgentPromptSpecContext;
  /**
   * Selected-workspace facts for the live frame. `workspace.posture` is the
   * workspace working-posture stub, not D118-L spec posture; established spec
   * posture arrives once through origination continuity.
   */
  readonly workspace: AgentPromptWorkspaceContext;
  /** Caller-supplied context only; never an asking-agenda or style carrier. */
  readonly context?: LiveElicitorPushedContext;
}

export function renderLiveElicitorContext(input: RenderLiveElicitorContextInput): string {
  return joinSections([renderSelectedSpecWorkspace(input), renderPushedContext(input.context)]);
}

function renderSelectedSpecWorkspace(input: RenderLiveElicitorContextInput): string {
  return [
    '[Brunch live elicitor context]',
    `- selected spec: ${input.spec.name} (#${input.spec.id})`,
    `- workspace: ${input.workspace.cwd}`,
    `- workspace posture: ${renderPosture(input.workspace.posture)}`,
    '- context style: plain selected-spec/workspace orientation; no strategy, lens, readiness, or gap-recommendation shaping',
  ].join('\n');
}

function renderPosture(posture: AgentPromptWorkspaceContext['posture']): string {
  if (!posture) return 'unrecorded';
  const entries = Object.entries(posture).filter((entry): entry is [string, string] =>
    Boolean(entry[1]?.trim()),
  );
  return entries.length > 0 ? entries.map(([key, value]) => `${key}=${value}`).join('; ') : 'unrecorded';
}

function renderPushedContext(context: LiveElicitorPushedContext | undefined): string {
  const handles = context?.contextHandles ?? [];
  const renderedContexts = context?.renderedContexts ?? [];
  return [
    '[Brunch live elicitor pushed context]',
    ...(handles.length ? handles.map((handle) => `- handle: ${handle}`) : ['- handles: none pushed']),
    ...(renderedContexts.length
      ? ['- rendered context blocks:', ...renderedContexts.map(indentBlock)]
      : ['- rendered context blocks: none pushed']),
  ].join('\n');
}

function indentBlock(value: string): string {
  return value
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n');
}

function joinSections(sections: readonly string[]): string {
  return sections
    .map((section) => section.trim())
    .filter(Boolean)
    .join('\n\n');
}

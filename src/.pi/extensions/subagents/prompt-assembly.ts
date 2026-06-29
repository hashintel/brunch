import type {
  AgentPromptSpecContext,
  AgentPromptWorkspaceContext,
  AgentPromptSessionContext,
} from '../../../agents/contexts/seeds/turn-context.js';
import { renderWorkspaceSeed } from '../../../agents/contexts/seeds/turn-context.js';
import type { ElicitationGap } from '../../../graph/schema/elicitation-gaps.js';
import type { SubagentDefinition } from './agents.js';

interface PromptManifests {
  readonly strategies: readonly [];
  readonly lenses: readonly [];
  readonly methods: readonly [];
}

export interface BackgroundWorldSnapshot {
  readonly spec: AgentPromptSpecContext;
  readonly workspace: AgentPromptWorkspaceContext;
  readonly session?: AgentPromptSessionContext;
  readonly gaps: readonly ElicitationGap[];
  readonly sessionDigest?: string;
}

export interface ComposeBackgroundSubagentPromptInput {
  readonly definition: SubagentDefinition;
  readonly world?: BackgroundWorldSnapshot;
}

export interface ComposeBackgroundSubagentPromptResult {
  readonly prompt: string;
  readonly manifests: PromptManifests;
}

export function composeBackgroundSubagentPrompt(
  input: ComposeBackgroundSubagentPromptInput,
): ComposeBackgroundSubagentPromptResult {
  const manifests = manifestsForBackgroundSubagent(input.definition);
  const prompt = joinSections([
    input.definition.systemPrompt,
    renderBackgroundControl(input.definition),
    renderWorldSnapshot(input.world),
    renderBackgroundRouterRules(input.definition),
  ]);

  return { prompt, manifests };
}

function manifestsForBackgroundSubagent(definition: SubagentDefinition): PromptManifests {
  if (
    definition.skills.strategies.length > 0 ||
    definition.skills.lenses.length > 0 ||
    definition.skills.methods.length > 0
  ) {
    throw new Error('Background subagent prompt resources are suspended and must not be advertised.');
  }
  return {
    strategies: [],
    lenses: [],
    methods: [],
  };
}

function renderBackgroundControl(definition: SubagentDefinition): string {
  const tools = definition.tools.join(', ') || 'none';
  return [
    '[Brunch background subagent control]',
    `- agent: ${definition.name}`,
    '- host: sealed SDK child session',
    '- delegated task: delivered as the first user message',
    '- world view: explicit app-root snapshot at spawn plus granted read tools',
    '- ambient Pi resources: sealed out; do not infer resources from ~/.pi or project .pi discovery',
    `- model: ${definition.model}; thinking: ${definition.thinking}`,
    `- manifest tool grant: ${tools}`,
  ].join('\n');
}

function renderWorldSnapshot(world: BackgroundWorldSnapshot | undefined): string {
  if (!world) {
    return [
      '[Brunch injected world snapshot]',
      '- selected workspace/spec: unavailable',
      '- session digest: unavailable',
      '- graph access: unavailable unless a granted read tool is present',
    ].join('\n');
  }

  const sessionDigest = world.sessionDigest?.trim() || 'unavailable';
  return [
    '[Brunch injected world snapshot]',
    indentBlock(
      renderWorkspaceSeed({
        spec: world.spec,
        workspace: world.workspace,
        ...(world.session ? { session: world.session } : {}),
        gaps: world.gaps,
      }),
    ),
    '[Parent session digest]',
    indentBlock(sessionDigest),
    '- graph access: use granted Brunch read tools such as read_graph; the graph itself is not baked into this prompt',
  ].join('\n');
}

function renderBackgroundRouterRules(definition: SubagentDefinition): string {
  const hasSkills =
    definition.skills.strategies.length > 0 ||
    definition.skills.lenses.length > 0 ||
    definition.skills.methods.length > 0;
  return [
    '[Brunch background routing]',
    '- Treat the task message as the caller authority; do not assume access to the parent conversation beyond this snapshot.',
    '- Use only tools listed in the manifest tool grant and actually advertised to you.',
    hasSkills
      ? '- Use only prompt resources advertised in <brunch-skills>; read a listed resource before applying its detailed method.'
      : '- No Brunch prompt resources are advertised for this background agent.',
    '- Return findings as concise assistant text; structured details are render-only and not model context.',
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

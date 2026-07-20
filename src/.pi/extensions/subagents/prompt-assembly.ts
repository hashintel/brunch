import type {
  AgentPromptSpecContext,
  AgentPromptWorkspaceContext,
  AgentPromptSessionContext,
} from '../../../agents/contexts/seeds/turn-context.js';
import { renderWorkspaceSeed } from '../../../agents/contexts/seeds/turn-context.js';
import { loadLiveBrunchSkillManifestEntries, renderBrunchSkills } from '../../../agents/skills/registry.js';
import type { ElicitationScratchpadItem } from '../../../session/elicitation-scratchpad.js';
import type { SubagentDefinition } from './agents.js';

export interface BackgroundWorldSnapshot {
  readonly spec: AgentPromptSpecContext;
  readonly workspace: AgentPromptWorkspaceContext;
  readonly session?: AgentPromptSessionContext;
  readonly scratchpad: readonly ElicitationScratchpadItem[];
  readonly sessionDigest?: string;
}

export interface ComposeBackgroundSubagentPromptInput {
  readonly definition: SubagentDefinition;
  readonly world?: BackgroundWorldSnapshot;
}

export interface ComposeBackgroundSubagentPromptResult {
  readonly prompt: string;
}

export function composeBackgroundSubagentPrompt(
  input: ComposeBackgroundSubagentPromptInput,
): ComposeBackgroundSubagentPromptResult {
  const prompt = joinSections([
    input.definition.systemPrompt,
    renderBackgroundControl(input.definition),
    renderWorldSnapshot(input.world),
    renderGrantedSkills(input.definition),
    renderBackgroundRouterRules(input.definition),
  ]);

  return { prompt: `${prompt}\n` };
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
        scratchpad: world.scratchpad,
      }),
    ),
    '[Parent session digest]',
    indentBlock(sessionDigest),
    '- graph access: use granted Brunch read tools such as read_graph; the graph itself is not baked into this prompt',
  ].join('\n');
}

function renderGrantedSkills(definition: SubagentDefinition): string {
  if (definition.skills.length === 0) return '';
  const granted = new Set(definition.skills);
  return renderBrunchSkills(loadLiveBrunchSkillManifestEntries().filter((entry) => granted.has(entry.name)));
}

function renderBackgroundRouterRules(definition: SubagentDefinition): string {
  return [
    '[Brunch background routing]',
    '- Treat the task message as the caller authority; do not assume access to the parent conversation beyond this snapshot.',
    '- Use only tools listed in the manifest tool grant and actually advertised to you.',
    ...(definition.skills.length > 0
      ? [
          '- Use only prompt resources advertised in <brunch-skills>; read a listed skill before applying its detailed guidance.',
        ]
      : []),
    '- Return findings as Markdown assistant text; foreground retains collation and every mutation authority.',
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

import type { KnowledgeKind } from '@/shared/knowledge.js';

import { renderPromptAsset } from './prompt-loader.js';

export interface SideChatPinnedItem {
  kind: KnowledgeKind;
  referenceCode: string;
  content: string;
  rationale?: string | null;
}

export interface SideChatSpecContext {
  specName: string;
  groundingSummary?: string | null;
}

export interface SideChatPromptMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface SideChatPriorTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface SideChatPromptPayload {
  system: string;
  messages: SideChatPromptMessage[];
}

export interface SideChatActiveAnnotation {
  referenceCode: string;
  snapshot: string;
  body: string | null;
}

export interface BuildPromptOptions {
  activeAnnotations?: readonly SideChatActiveAnnotation[];
  spanHint?: string;
}

const SIDE_CHAT_ROLE_PROMPT = renderPromptAsset('side-chat.role');

function formatActiveAnnotations(annotations: readonly SideChatActiveAnnotation[]): string {
  const lines = annotations.map((annotation, index) => {
    const head = `${index + 1}. [${annotation.referenceCode}] «${annotation.snapshot}»`;
    return annotation.body ? `${head}\n   Note: ${annotation.body}` : head;
  });
  return ['User-pinned snippets:', ...lines].join('\n');
}

function buildSystemPrompt(specContext: SideChatSpecContext, options: BuildPromptOptions): string {
  const backgroundLines = [`Background context (do not treat as the primary focus):`];
  backgroundLines.push(`- Specification name: ${specContext.specName}`);
  if (specContext.groundingSummary) {
    backgroundLines.push(`- Grounding summary: ${specContext.groundingSummary}`);
  }
  const sections = [SIDE_CHAT_ROLE_PROMPT, backgroundLines.join('\n')];
  if (options.activeAnnotations && options.activeAnnotations.length > 0) {
    sections.push(formatActiveAnnotations(options.activeAnnotations));
  }
  return sections.join('\n\n');
}

function buildUserMessageContent(item: SideChatPinnedItem, message: string, spanHint?: string): string {
  const lines = [`Pinned ${item.kind} [${item.referenceCode}]:`, item.content];
  if (item.rationale) {
    lines.push('', `Rationale: ${item.rationale}`);
  }
  lines.push('', `User message: ${buildUserText(message, spanHint)}`);
  return lines.join('\n');
}

function buildUserText(message: string, spanHint?: string): string {
  return spanHint ? `About the highlighted phrase «${spanHint}»: ${message}` : message;
}

function completedHistory(history: readonly SideChatPriorTurn[]): SideChatPriorTurn[] {
  return history.at(-1)?.role === 'user' ? history.slice(0, -1) : [...history];
}

export function buildSideChatPrompt(
  item: SideChatPinnedItem,
  message: string,
  specContext: SideChatSpecContext,
  history: readonly SideChatPriorTurn[] = [],
  options: BuildPromptOptions = {},
): SideChatPromptPayload {
  const turns: SideChatPriorTurn[] = [...completedHistory(history), { role: 'user', text: message }];
  const messages: SideChatPromptMessage[] = turns.map((turn, index) => {
    const isLatestTurn = index === turns.length - 1;
    if (index === 0 && turn.role === 'user') {
      return {
        role: 'user',
        content: buildUserMessageContent(item, turn.text, isLatestTurn ? options.spanHint : undefined),
      };
    }
    if (isLatestTurn && turn.role === 'user') {
      return { role: 'user', content: buildUserText(turn.text, options.spanHint) };
    }
    return { role: turn.role, content: turn.text };
  });
  return {
    system: buildSystemPrompt(specContext, options),
    messages,
  };
}

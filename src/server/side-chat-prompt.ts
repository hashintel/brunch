import type { KnowledgeKind } from '@/shared/knowledge.js';

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

export interface SideChatPromptPayload {
  system: string;
  messages: SideChatPromptMessage[];
}

const SIDE_CHAT_ROLE_PROMPT = `You are the side-chat assistant in Brunch. The user has pinned a specific knowledge item from their spec and wants to discuss it with you in place.

Your job is to help the user think about the pinned item: explain it, surface its assumptions, weigh tradeoffs, suggest refinements. Stay focused on the pinned item — only widen the discussion when the user explicitly asks.

You are NOT conducting a structured interview. Do not ask multiple-choice questions, do not propose closing phases, and do not follow a phase-by-phase elicitation script. Respond conversationally in plain text.`;

function buildSystemPrompt(specContext: SideChatSpecContext): string {
  const backgroundLines = [`Background context (do not treat as the primary focus):`];
  backgroundLines.push(`- Specification name: ${specContext.specName}`);
  if (specContext.groundingSummary) {
    backgroundLines.push(`- Grounding summary: ${specContext.groundingSummary}`);
  }
  return `${SIDE_CHAT_ROLE_PROMPT}\n\n${backgroundLines.join('\n')}`;
}

function buildUserMessageContent(item: SideChatPinnedItem, message: string): string {
  const lines = [`Pinned ${item.kind} [${item.referenceCode}]:`, item.content];
  if (item.rationale) {
    lines.push('', `Rationale: ${item.rationale}`);
  }
  lines.push('', `User message: ${message}`);
  return lines.join('\n');
}

export function buildSideChatPrompt(
  item: SideChatPinnedItem,
  message: string,
  specContext: SideChatSpecContext,
): SideChatPromptPayload {
  return {
    system: buildSystemPrompt(specContext),
    messages: [
      {
        role: 'user',
        content: buildUserMessageContent(item, message),
      },
    ],
  };
}

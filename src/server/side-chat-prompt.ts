import { tool } from 'ai';
import * as z from 'zod/v4';

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

export type SideChatMode = 'explore' | 'edit';

export interface BuildPromptOptions {
  activeAnnotations?: readonly SideChatActiveAnnotation[];
  spanHint?: string;
  mode?: SideChatMode;
}

const SIDE_CHAT_ROLE_PROMPT = `You are the side-chat assistant in Brunch. The user has pinned a specific knowledge item from their spec and wants to discuss it with you in place.

Your job is to help the user think about the pinned item: explain it, surface its assumptions, weigh tradeoffs, suggest refinements. Stay focused on the pinned item — only widen the discussion when the user explicitly asks.

You are NOT conducting a structured interview. Do not ask multiple-choice questions, do not propose closing phases, and do not follow a phase-by-phase elicitation script. Respond conversationally in plain text.`;

// FE-698 migration: when the shared prompt registry lands, move
// SIDE_CHAT_EDIT_MODE_PROMPT into that registry and replace the inline addendum
// with a registry lookup keyed on mode.
const SIDE_CHAT_EDIT_MODE_PROMPT = `You are now in Edit mode. The user wants to change the pinned item's content or rationale.

When the user asks for a wording change, factual correction, terser phrasing, or rationale clarification of the pinned item, call the propose_edit tool with the proposed new content (and new rationale, if applicable). The user reviews and applies the proposed edit through the patch list — do not assume the change has been applied yet.

If the user asks an exploration question, asks you to compare alternatives, or otherwise wants discussion rather than a concrete edit, respond conversationally without calling propose_edit.

Only propose edits to the currently pinned item. Do not propose edits to other items, even if the user references them.`;

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
  if (options.mode === 'edit') {
    sections.push(SIDE_CHAT_EDIT_MODE_PROMPT);
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

// FE-698 migration: when the shared prompt registry lands, move proposeEditTool
// (and any future propose_edge / propose_drill_down tools) into the registry's
// tool surface and replace getSideChatTools with a registry lookup.
export const proposeEditToolName = 'propose_edit' as const;

export const proposeEditInputSchema = z.object({
  newContent: z.string().trim().min(1),
  newRationale: z.string().trim().min(1).optional(),
});

const proposeEditOutputSchema = z.object({
  newContent: z.string(),
  newRationale: z.string().optional(),
});

export type ProposeEditInput = z.infer<typeof proposeEditInputSchema>;

const proposeEditTool = tool({
  description:
    'Propose an edit to the currently pinned knowledge item. Call this when the user asks for a wording change, factual correction, terser phrasing, or rationale clarification of the pinned item. The user reviews and applies the edit through the patch list — do not assume the edit has been applied.',
  inputSchema: proposeEditInputSchema,
  outputSchema: proposeEditOutputSchema,
  execute: async (input) => ({
    newContent: input.newContent,
    ...(input.newRationale ? { newRationale: input.newRationale } : {}),
  }),
});

export function getSideChatTools(mode: SideChatMode = 'explore') {
  if (mode === 'edit') {
    return { [proposeEditToolName]: proposeEditTool } as const;
  }
  return {} as const;
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

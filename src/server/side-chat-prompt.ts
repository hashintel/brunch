import { tool } from 'ai';
import * as z from 'zod/v4';

import { edgeRelationSchema } from '@/shared/api-types.js';
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

export type SideChatMode = 'explore' | 'edit';

export interface BuildPromptOptions {
  activeAnnotations?: readonly SideChatActiveAnnotation[];
  spanHint?: string;
  mode?: SideChatMode;
}

const SIDE_CHAT_ROLE_PROMPT = renderPromptAsset('side-chat.role');

// FE-698 migration: when the shared prompt registry lands, move
// SIDE_CHAT_EDIT_MODE_PROMPT into that registry and replace the inline addendum
// with a registry lookup keyed on mode.
const SIDE_CHAT_EDIT_MODE_PROMPT = `You are now in Edit mode. The user wants to refine the pinned item — its content, its rationale, or how it relates to other items in the spec.

You have three tools available in Edit mode:

- propose_edit: when the user asks for a wording change, factual correction, terser phrasing, or rationale clarification of the pinned item. Call with the proposed newContent (and newRationale if applicable).
- propose_edge: when the user asks to link the pinned item to another item by reference code (for example "G3" or "D7"). Call with targetReferenceCode + relation. Valid relations: depends_on, derived_from, constrains, verifies, refines.
- propose_drill_down: when the user asks to deepen one specific area of the pinned item ("dig into X", "let's go deeper on Y"). Call with focusArea naming the area to deepen.

The user reviews and applies any proposed change through the patch list — do not assume changes are applied.

If the user asks an exploration question, asks you to compare alternatives, or otherwise wants discussion rather than a concrete change, respond conversationally without calling any tool.

Only propose changes for the currently pinned item. Do not propose changes to other items, even if the user references them.`;

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
// (and proposeEdgeTool / proposeDrillDownTool) into the registry's tool surface
// and replace getSideChatTools with a registry lookup.
export const proposeEditToolName = 'propose_edit' as const;
export const proposeEdgeToolName = 'propose_edge' as const;
export const proposeDrillDownToolName = 'propose_drill_down' as const;

export const proposeEditInputSchema = z.object({
  newContent: z.string().trim().min(1),
  newRationale: z.string().trim().min(1).optional(),
});

export const proposeEdgeInputSchema = z.object({
  targetReferenceCode: z.string().trim().min(1),
  relation: edgeRelationSchema,
});

export const proposeDrillDownInputSchema = z.object({
  focusArea: z.string().trim().min(1),
});

const proposeEditOutputSchema = z.object({
  newContent: z.string(),
  newRationale: z.string().optional(),
});

const proposeEdgeOutputSchema = z.object({
  targetReferenceCode: z.string(),
  relation: edgeRelationSchema,
});

const proposeDrillDownOutputSchema = z.object({
  focusArea: z.string(),
});

export type ProposeEditInput = z.infer<typeof proposeEditInputSchema>;
export type ProposeEdgeInput = z.infer<typeof proposeEdgeInputSchema>;
export type ProposeDrillDownInput = z.infer<typeof proposeDrillDownInputSchema>;

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

const proposeEdgeTool = tool({
  description:
    'Propose a graph relationship from the currently pinned knowledge item to another item identified by its reference code. Call this when the user asks to link, depend on, derive from, constrain, verify, or refine another item by code (for example "G3" or "D7"). The user reviews and applies the edge through the patch list.',
  inputSchema: proposeEdgeInputSchema,
  outputSchema: proposeEdgeOutputSchema,
  execute: async (input) => ({
    targetReferenceCode: input.targetReferenceCode,
    relation: input.relation,
  }),
});

const proposeDrillDownTool = tool({
  description:
    'Propose deepening one specific area of the currently pinned knowledge item. Call this when the user asks to "go deeper on X", "drill into Y", or otherwise wants more detailed exploration of a specific aspect. The user reviews the proposed focus area through the patch list. Note: drill-down apply is deferred to V3; staging the patch is the V2 surface.',
  inputSchema: proposeDrillDownInputSchema,
  outputSchema: proposeDrillDownOutputSchema,
  execute: async (input) => ({
    focusArea: input.focusArea,
  }),
});

type EditModeTools = {
  [proposeEditToolName]: typeof proposeEditTool;
  [proposeEdgeToolName]: typeof proposeEdgeTool;
  [proposeDrillDownToolName]: typeof proposeDrillDownTool;
};

export function getSideChatTools(mode: SideChatMode = 'explore'): Partial<EditModeTools> {
  if (mode === 'edit') {
    return {
      [proposeEditToolName]: proposeEditTool,
      [proposeEdgeToolName]: proposeEdgeTool,
      [proposeDrillDownToolName]: proposeDrillDownTool,
    };
  }
  return {};
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

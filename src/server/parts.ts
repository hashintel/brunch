import { z } from 'zod';

import type { DomainEvent } from './core.js';

// --- Assistant part types (assembled from DomainEvents) ---

export type ReasoningPart = { type: 'reasoning'; text: string };
export type TextPart = { type: 'text'; text: string };
export type ToolInvocationPart = {
  type: 'tool-invocation';
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  state: 'result';
};

export type AssistantPart = ReasoningPart | TextPart | ToolInvocationPart;

// --- Data Part schemas (Zod v4) ---

export const dataOptionSelectionSchema = z.object({
  turnId: z.number(),
  selectedOptionId: z.number(),
  rationale: z.string().optional(),
});

export const dataConfirmationSchema = z.object({
  turnId: z.number(),
  confirmed: z.boolean(),
});

export type DataOptionSelection = z.infer<typeof dataOptionSelectionSchema>;
export type DataConfirmation = z.infer<typeof dataConfirmationSchema>;

// --- User part types ---

export type DataOptionSelectionPart = { type: 'data-option-selection'; data: DataOptionSelection };
export type DataConfirmationPart = { type: 'data-confirmation'; data: DataConfirmation };
export type UserPart = TextPart | DataOptionSelectionPart | DataConfirmationPart;

// --- Assembler ---

/**
 * Accumulate DomainEvents into assistant parts[].
 * Consecutive deltas of the same type are merged into a single part.
 * Tool call args JSON fragments are concatenated and parsed on tool-call-end.
 */
export function assembleAssistantParts(events: DomainEvent[]): AssistantPart[] {
  const parts: AssistantPart[] = [];
  let currentType: 'reasoning' | 'text' | null = null;
  let currentText = '';
  const toolArgs = new Map<string, { toolName: string; json: string }>();

  function flushText() {
    if (currentType && currentText) {
      parts.push(
        currentType === 'reasoning'
          ? { type: 'reasoning', text: currentText }
          : { type: 'text', text: currentText },
      );
    }
    currentType = null;
    currentText = '';
  }

  for (const event of events) {
    switch (event.type) {
      case 'thinking': {
        if (currentType !== 'reasoning') flushText();
        currentType = 'reasoning';
        currentText += event.delta;
        break;
      }
      case 'text-delta': {
        if (currentType !== 'text') flushText();
        currentType = 'text';
        currentText += event.delta;
        break;
      }
      case 'tool-call-start': {
        flushText();
        toolArgs.set(event.toolCallId, { toolName: event.toolName, json: '' });
        break;
      }
      case 'tool-call-delta': {
        const entry = toolArgs.get(event.toolCallId);
        if (entry) entry.json += event.delta;
        break;
      }
      case 'tool-call-end': {
        const entry = toolArgs.get(event.toolCallId);
        if (entry) {
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(entry.json) as Record<string, unknown>;
          } catch {
            args = { _raw: entry.json };
          }
          parts.push({
            type: 'tool-invocation',
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            args,
            state: 'result',
          });
          toolArgs.delete(event.toolCallId);
        }
        break;
      }
      case 'stream-end': {
        flushText();
        break;
      }
    }
  }

  flushText();
  return parts;
}

/** Serialize parts to JSON for persistence. */
export function serializeParts(parts: AssistantPart[] | UserPart[]): string {
  return JSON.stringify(parts);
}

/** Deserialize parts from persisted JSON. */
export function deserializeAssistantParts(json: string): AssistantPart[] {
  return JSON.parse(json) as AssistantPart[];
}

export function deserializeUserParts(json: string): UserPart[] {
  return JSON.parse(json) as UserPart[];
}

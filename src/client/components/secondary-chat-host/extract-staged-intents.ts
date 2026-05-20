// Pure adapter from secondary-chat assistant messages → staged-patch
// decisions. No React, no state, no side effects. The hook in
// `secondary-chat-host.tsx` wraps this with `useChat` plumbing + a dedupe
// ref + a dispatch loop.
//
// Each tool-call yields exactly one ToolCallDecision:
//   - `status: 'stage'` — caller should call `patchList.stage(intent)` and
//     mark the toolCallId consumed.
//   - `status: 'skip'`  — caller should mark the toolCallId consumed but
//     not stage anything (e.g. self-referential edge).
//   - `status: 'defer'` — caller should NOT mark the toolCallId consumed;
//     a later input arrival (e.g. `data-edit-impact`) may re-emit `stage`.
//
// Tool parts in pre-finalised states (`input-streaming` etc.) emit no
// decision at all — they don't appear in the returned array.

import type { BrunchUIMessage, BrunchUIMessagePart, EditImpactTier } from '@/shared/chat.js';

import type { PatchAnchor, StagePatchInput } from '../patch-list-reducer.js';

type ToolProposePart = Extract<
  BrunchUIMessagePart,
  { type: 'tool-propose_edit' | 'tool-propose_edge' | 'tool-propose_drill_down' }
>;

function getToolPart(part: BrunchUIMessagePart): ToolProposePart | null {
  if (
    part.type === 'tool-propose_edit' ||
    part.type === 'tool-propose_edge' ||
    part.type === 'tool-propose_drill_down'
  ) {
    return part;
  }
  return null;
}

export function summarizeEditContent(content: string): string {
  const trimmed = content.trim();
  return trimmed.length > 60 ? `${trimmed.slice(0, 57)}…` : trimmed;
}

export type ToolCallDecision =
  | { readonly toolCallId: string; readonly status: 'stage'; readonly intent: StagePatchInput }
  | { readonly toolCallId: string; readonly status: 'skip' | 'defer'; readonly reason: string };

export interface ExtractStagedIntentsContext {
  readonly producerChatId: number;
  readonly pinnedAnchor: PatchAnchor;
  readonly editImpactByToolCallId: ReadonlyMap<string, EditImpactTier>;
  readonly resolveTargetAnchor: (referenceCode: string) => PatchAnchor | undefined;
}

export function extractStagedIntents(
  messages: readonly BrunchUIMessage[],
  ctx: ExtractStagedIntentsContext,
): readonly ToolCallDecision[] {
  const decisions: ToolCallDecision[] = [];

  for (const message of messages) {
    if (message.role !== 'assistant') continue;
    for (const rawPart of message.parts) {
      const part = getToolPart(rawPart);
      if (!part) continue;
      if (part.state !== 'input-available' && part.state !== 'output-available') continue;

      const toolCallId = part.toolCallId;

      if (part.type === 'tool-propose_edit') {
        const input = part.input as { newContent: string; newRationale?: string };
        const impact = ctx.editImpactByToolCallId.get(toolCallId);
        if (impact === undefined) {
          decisions.push({ toolCallId, status: 'defer', reason: 'awaiting-edit-impact' });
          continue;
        }
        decisions.push({
          toolCallId,
          status: 'stage',
          intent: {
            kind: 'edit',
            producerChatId: ctx.producerChatId,
            anchor: ctx.pinnedAnchor,
            summary: summarizeEditContent(input.newContent),
            newContent: input.newContent,
            ...(input.newRationale ? { newRationale: input.newRationale } : {}),
            impact,
          },
        });
      } else if (part.type === 'tool-propose_edge') {
        const input = part.input as { targetReferenceCode: string; relation: string };
        const targetAnchor = ctx.resolveTargetAnchor(input.targetReferenceCode);
        if (!targetAnchor) {
          decisions.push({ toolCallId, status: 'skip', reason: 'unresolved-target-refcode' });
          continue;
        }
        if (targetAnchor.kind === ctx.pinnedAnchor.kind && targetAnchor.itemId === ctx.pinnedAnchor.itemId) {
          decisions.push({ toolCallId, status: 'skip', reason: 'self-referential-edge' });
          continue;
        }
        decisions.push({
          toolCallId,
          status: 'stage',
          intent: {
            kind: 'edge',
            producerChatId: ctx.producerChatId,
            anchor: ctx.pinnedAnchor,
            targetAnchor,
            relation: input.relation,
            summary: `Edge: ${input.targetReferenceCode} (${input.relation})`,
          },
        });
      } else {
        const input = part.input as { focusArea: string };
        decisions.push({
          toolCallId,
          status: 'stage',
          intent: {
            kind: 'drill-down',
            producerChatId: ctx.producerChatId,
            anchor: ctx.pinnedAnchor,
            summary: `Drill-down: ${input.focusArea}`,
            focusArea: input.focusArea,
          },
        });
      }
    }
  }

  return decisions;
}
